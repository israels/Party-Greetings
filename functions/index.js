const { onObjectFinalized } = require("firebase-functions/v2/storage");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const { spawn } = require("node:child_process");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const { randomUUID } = require("node:crypto");

admin.initializeApp();

const db = admin.firestore();

exports.convertWebmToMp4 = onObjectFinalized(
  {
    region: "us-west1",
    memory: "1GiB",
    timeoutSeconds: 540,
    maxInstances: 5,
    cpu: 1
  },
  async (event) => {
    const object = event.data;
    const objectPath = object.name;
    const sourceBucketName = object.bucket;
    const contentType = object.contentType || "";

    if (!objectPath) {
      logger.warn("Skipping object finalize without object path");
      return;
    }

    if (!objectPath.startsWith("greetings/")) {
      return;
    }

    if (!sourceBucketName) {
      logger.warn("Skipping object finalize without bucket name", { objectPath });
      return;
    }

    const sourceBucket = admin.storage().bucket(sourceBucketName);

    if (objectPath.endsWith(".mp4")) {
      return;
    }

    const isWebm = objectPath.endsWith(".webm") || contentType.includes("webm");
    if (!isWebm) {
      logger.info("Skipping non-WebM object", { objectPath, contentType });
      return;
    }

    const snapshot = await db
      .collection("greetings")
      .where("storagePath", "==", objectPath)
      .limit(1)
      .get();

    if (snapshot.empty) {
      logger.warn("No greeting record found for uploaded media", { objectPath });
      return;
    }

    const greetingDoc = snapshot.docs[0];
    const data = greetingDoc.data();
    const sourceFileName = path.basename(objectPath);
    const outputFileName = sourceFileName.replace(/\.[^.]+$/, ".mp4");
    const outputStoragePath = objectPath.replace(/\.[^.]+$/, ".mp4");

    if (data.conversionStatus === "completed" && data.mp4StoragePath === outputStoragePath) {
      logger.info("Conversion already completed", { objectPath, outputStoragePath });
      return;
    }

    const outputAlreadyExists = await sourceBucket
      .file(outputStoragePath)
      .exists()
      .then((result) => result[0])
      .catch(() => false);

    if (outputAlreadyExists) {
      const existingFile = sourceBucket.file(outputStoragePath);
      const mp4DownloadURL = await ensureFirebaseDownloadUrl(existingFile, outputStoragePath, sourceBucketName);
      await greetingDoc.ref.update({
        conversionStatus: "completed",
        mp4StoragePath: outputStoragePath,
        mp4FileName: outputFileName,
        mp4DownloadURL,
        conversionCompletedAt: Date.now(),
        conversionError: null
      });
      return;
    }

    const attemptCount = Number(data.conversionAttempts || 0) + 1;
    await greetingDoc.ref.update({
      conversionStatus: "processing",
      conversionStartedAt: Date.now(),
      conversionAttempts: attemptCount,
      conversionError: null
    });

    const tmpInputPath = path.join(os.tmpdir(), sourceFileName);
    const tmpOutputPath = path.join(os.tmpdir(), outputFileName);

    try {
      await sourceBucket.file(objectPath).download({ destination: tmpInputPath });

      await runFfmpeg(tmpInputPath, tmpOutputPath, contentType);

      const outputStat = await fs.stat(tmpOutputPath);
      if (!outputStat.size || outputStat.size < 1024) {
        throw new Error(`Converted MP4 is unexpectedly small (${outputStat.size} bytes).`);
      }

      const downloadToken = randomUUID();

      await sourceBucket.upload(tmpOutputPath, {
        destination: outputStoragePath,
        metadata: {
          contentType: "video/mp4",
          metadata: {
            firebaseStorageDownloadTokens: downloadToken
          }
        }
      });

      const mp4DownloadURL = buildFirebaseDownloadUrl(sourceBucketName, outputStoragePath, downloadToken);

      await greetingDoc.ref.update({
        conversionStatus: "completed",
        mp4StoragePath: outputStoragePath,
        mp4FileName: outputFileName,
        mp4DownloadURL,
        mp4SizeBytes: outputStat.size,
        conversionCompletedAt: Date.now(),
        conversionError: null
      });

      logger.info("Conversion complete", {
        objectPath,
        outputStoragePath,
        conversionAttempts: attemptCount
      });
    } catch (error) {
      logger.error("Conversion failed", {
        objectPath,
        error: error.message
      });

      await greetingDoc.ref.update({
        conversionStatus: "failed",
        conversionError: String(error.message || "Unknown conversion error"),
        conversionFailedAt: Date.now()
      });
      throw error;
    } finally {
      await Promise.allSettled([fs.unlink(tmpInputPath), fs.unlink(tmpOutputPath)]);
    }
  }
);

function runFfmpeg(inputPath, outputPath, contentType) {
  // Balanced profile for mobile playback: keep compatibility, reduce file size.
  const args = contentType.startsWith("audio/")
    ? [
        "-y",
        "-i",
        inputPath,
        "-vn",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-movflags",
        "+faststart",
        outputPath
      ]
    : [
        "-y",
        "-i",
        inputPath,
        "-c:v",
        "libx264",
        "-preset",
        "faster",
        "-crf",
        "23",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-movflags",
        "+faststart",
        outputPath
      ];

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";

    ffmpeg.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    ffmpeg.on("error", reject);

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`ffmpeg exited with code ${code}. ${stderr.slice(-1500)}`));
    });
  });
}

async function ensureFirebaseDownloadUrl(file, objectPath, bucketName) {
  const [metadata] = await file.getMetadata();
  const existingTokenRaw = metadata?.metadata?.firebaseStorageDownloadTokens || "";
  const existingToken = String(existingTokenRaw).split(",").find(Boolean);
  if (existingToken) {
    return buildFirebaseDownloadUrl(bucketName, objectPath, existingToken);
  }

  const generatedToken = randomUUID();
  await file.setMetadata({
    metadata: {
      ...(metadata?.metadata || {}),
      firebaseStorageDownloadTokens: generatedToken
    }
  });
  return buildFirebaseDownloadUrl(bucketName, objectPath, generatedToken);
}

function buildFirebaseDownloadUrl(bucketName, objectPath, token) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`;
}
