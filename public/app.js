import { db, storage } from "./firebase-config.js";
import { addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { getDownloadURL, ref, uploadBytesResumable } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js";

const MAX_SECONDS = 90;
const WARNING_SECONDS = 15;

const enableMediaBtn = document.getElementById("enableMediaBtn");
const flipCameraBtn = document.getElementById("flipCameraBtn");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const retakeBtn = document.getElementById("retakeBtn");
const uploadBtn = document.getElementById("uploadBtn");
const recordAnotherBtn = document.getElementById("recordAnotherBtn");

const liveVideo = document.getElementById("liveVideo");
const playbackVideo = document.getElementById("playbackVideo");
const playbackAudio = document.getElementById("playbackAudio");
const timerLabel = document.getElementById("timerLabel");
const timer = document.getElementById("timer");
const statusEl = document.getElementById("status");
const thankYou = document.getElementById("thankYou");

const uploadForm = document.getElementById("uploadForm");
const guestNameInput = document.getElementById("guestName");
const guestMessageInput = document.getElementById("guestMessage");
const progressWrap = document.getElementById("progressWrap");
const uploadProgress = document.getElementById("uploadProgress");
const uploadProgressText = document.getElementById("uploadProgressText");
const stepPanels = document.querySelectorAll("[data-step-panel]");
const workflowProgressTrack = document.getElementById("workflowProgressTrack");
const workflowProgressFill = document.getElementById("workflowProgressFill");
const workflowProgressStep = document.getElementById("workflowProgressStep");
const reviewSection = document.getElementById("reviewSection");
const cameraOverlay = document.getElementById("cameraOverlay");
const videoWrap = document.getElementById("videoWrap");

const introNextBtn = document.getElementById("introNextBtn");
const recordBackBtn = document.getElementById("recordBackBtn");

let mode = "video";
let facingMode = "user";
let stream = null;
let mediaRecorder = null;
let chunks = [];
let recordedBlob = null;
let recordedMediaType = null;
let isRecording = false;
let recordingStartedAt = 0;
let timerIntervalId = null;
let autoStopId = null;
let recordedDurationSeconds = 0;
let currentStep = 0;

introNextBtn.addEventListener("click", () => {
  goToStep(1);
});

recordBackBtn.addEventListener("click", () => {
  if (isRecording) return;
  goToStep(0);
});

const modeInputs = document.querySelectorAll('input[name="mode"]');
modeInputs.forEach((input) => {
  input.addEventListener("change", async (event) => {
    if (isRecording) return;
    mode = event.target.value;
    recordedBlob = null;
    recordedMediaType = null;
    uploadBtn.disabled = true;
    reviewSection.classList.add("hidden");
    progressWrap.classList.add("hidden");
    resetPreviewOnly();
    renderIdleTimer();
    if (stream) {
      await setupStream();
    } else {
      syncControlAvailability();
    }
  });
});

enableMediaBtn.addEventListener("click", async () => {
  await attemptCameraSetup();
});

flipCameraBtn.addEventListener("click", async () => {
  if (mode !== "video" || isRecording) {
    return;
  }
  facingMode = facingMode === "user" ? "environment" : "user";
  try {
    await setupStream();
    setStatus(`Switched to ${facingMode === "user" ? "front" : "rear"} camera.`, false);
  } catch (error) {
    setStatus(normalizeError(error), true);
  }
});

startBtn.addEventListener("click", async () => {
  try {
    setStatus("", false);
    if (!stream) {
      await setupStream();
    }
    resetPlaybackElements();
    startRecording();
  } catch (error) {
    setStatus(normalizeError(error), true);
  }
});

stopBtn.addEventListener("click", () => {
  if (!isRecording || !mediaRecorder) {
    return;
  }
  mediaRecorder.stop();
});

retakeBtn.addEventListener("click", async () => {
  recordedBlob = null;
  recordedMediaType = null;
  recordedDurationSeconds = 0;
  uploadBtn.disabled = true;
  reviewSection.classList.add("hidden");
  progressWrap.classList.add("hidden");
  thankYou.classList.add("hidden");
  recordAnotherBtn.classList.add("hidden");
  try {
    await setupStream();
    renderIdleTimer();
    setStatus("Ready for a fresh take.", false);
  } catch (error) {
    setStatus(normalizeError(error), true);
  }
});

recordAnotherBtn.addEventListener("click", async () => {
  guestNameInput.value = "";
  guestMessageInput.value = "";
  await retakeAndPrep();
  goToStep(1);
});

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!recordedBlob) {
    setStatus("Please record a blessing first.", true);
    return;
  }

  const guestName = guestNameInput.value.trim() || "Anonymous";
  const guestMessage = guestMessageInput.value.trim();
  const mediaType = recordedMediaType || mode;
  const ext = getExtension(recordedBlob.type, mediaType);
  const timestamp = Date.now();
  const safeGuest = slugify(guestName);
  const fileName = `${timestamp}_${safeGuest}.${ext}`;
  const storagePath = `greetings/${new Date().getFullYear()}/${fileName}`;

  progressWrap.classList.remove("hidden");
  uploadProgress.value = 0;
  uploadProgressText.textContent = "0%";
  uploadBtn.disabled = true;
  setStatus("Uploading your blessing...", false);

  const mediaRef = ref(storage, storagePath);
  const uploadTask = uploadBytesResumable(mediaRef, recordedBlob, {
    contentType: recordedBlob.type || (mediaType === "video" ? "video/webm" : "audio/webm")
  });

  uploadTask.on(
    "state_changed",
    (snapshot) => {
      const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
      uploadProgress.value = percent;
      uploadProgressText.textContent = `${percent}%`;
      setStatus(`Upload in progress... ${percent}%`, false);
    },
    (error) => {
      setStatus(`Upload failed: ${normalizeError(error)}`, true);
      uploadBtn.disabled = false;
    },
    async () => {
      const downloadURL = await getDownloadURL(mediaRef);
      await addDoc(collection(db, "greetings"), {
        guestName,
        guestMessage,
        mediaType,
        mimeType: recordedBlob.type || null,
        fileName,
        storagePath,
        downloadURL,
        sizeBytes: recordedBlob.size,
        durationSeconds: recordedDurationSeconds,
        createdAtMs: Date.now(),
        createdAt: serverTimestamp()
      });
      setStatus("Upload complete. Your blessing has been saved.", false, true);
      thankYou.classList.remove("hidden");
      recordAnotherBtn.classList.remove("hidden");
      uploadProgress.value = 100;
      uploadProgressText.textContent = "100%";
      goToStep(2, { force: true });
    }
  );
});

window.addEventListener("beforeunload", () => {
  cleanupStream();
});

async function retakeAndPrep() {
  recordedBlob = null;
  recordedMediaType = null;
  recordedDurationSeconds = 0;
  uploadBtn.disabled = true;
  reviewSection.classList.add("hidden");
  progressWrap.classList.add("hidden");
  uploadProgress.value = 0;
  uploadProgressText.textContent = "0%";
  thankYou.classList.add("hidden");
  recordAnotherBtn.classList.add("hidden");
  await setupStream();
  renderIdleTimer();
  setStatus("You can record another blessing now.", false);
}

async function setupStream() {
  cleanupStream();
  const constraints = mode === "video" ? videoConstraints() : audioConstraints();
  stream = await navigator.mediaDevices.getUserMedia(constraints);
  if (mode === "video") {
    liveVideo.srcObject = stream;
    liveVideo.classList.remove("hidden");
  } else {
    liveVideo.srcObject = null;
    liveVideo.classList.add("hidden");
  }
  syncControlAvailability();
}

function startRecording() {
  const options = pickRecorderOptions(mode);
  mediaRecorder = options ? new MediaRecorder(stream, options) : new MediaRecorder(stream);
  chunks = [];
  recordingStartedAt = Date.now();
  isRecording = true;
  startBtn.disabled = true;
  stopBtn.disabled = false;
  uploadBtn.disabled = true;
  reviewSection.classList.add("hidden");
  thankYou.classList.add("hidden");
  recordAnotherBtn.classList.add("hidden");

  timerLabel.textContent = "Recording...";
  startTimerLoop();
  autoStopId = window.setTimeout(() => {
    if (mediaRecorder?.state === "recording") {
      mediaRecorder.stop();
      setStatus("Reached 90 seconds. Recording stopped automatically.", false);
    }
  }, MAX_SECONDS * 1000);

  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  mediaRecorder.onstop = () => {
    isRecording = false;
    stopBtn.disabled = true;
    startBtn.disabled = false;
    clearTimers();

    recordedDurationSeconds = Math.min(MAX_SECONDS, Math.round((Date.now() - recordingStartedAt) / 1000));
    const recorderType = mediaRecorder.mimeType || (mode === "video" ? "video/webm" : "audio/webm");
    recordedBlob = new Blob(chunks, { type: recorderType });
    recordedMediaType = mode;
    renderPlayback(recordedBlob, recordedMediaType);
    uploadBtn.disabled = false;
    reviewSection.classList.remove("hidden");
    setStatus("Review your blessing, then upload or retake.", false);
  };

  mediaRecorder.start(1000);
}

function renderPlayback(blob, mediaType) {
  const objectUrl = URL.createObjectURL(blob);
  liveVideo.classList.add("hidden");
  playbackVideo.classList.add("hidden");
  playbackAudio.classList.add("hidden");

  if (mediaType === "video") {
    playbackVideo.src = objectUrl;
    playbackVideo.classList.remove("hidden");
  } else {
    playbackAudio.src = objectUrl;
    playbackAudio.classList.remove("hidden");
  }
}

function resetPlaybackElements() {
  playbackVideo.pause();
  playbackAudio.pause();
  playbackVideo.removeAttribute("src");
  playbackAudio.removeAttribute("src");
  playbackVideo.classList.add("hidden");
  playbackAudio.classList.add("hidden");
  if (mode === "video") {
    liveVideo.classList.remove("hidden");
  }
}

function resetPreviewOnly() {
  playbackVideo.pause();
  playbackAudio.pause();
  playbackVideo.removeAttribute("src");
  playbackAudio.removeAttribute("src");
  playbackVideo.classList.add("hidden");
  playbackAudio.classList.add("hidden");
}

function renderIdleTimer() {
  timerLabel.textContent = "Ready to record";
  timer.textContent = "01:30 remaining";
  timer.classList.remove("warning");
}

function startTimerLoop() {
  renderTimer();
  timerIntervalId = window.setInterval(renderTimer, 250);
}

function renderTimer() {
  const elapsed = (Date.now() - recordingStartedAt) / 1000;
  const remaining = Math.max(0, MAX_SECONDS - elapsed);
  timer.textContent = `${formatSeconds(Math.round(remaining))} remaining`;
  timerLabel.textContent = `${formatSeconds(Math.round(elapsed))} recorded`;
  if (remaining <= WARNING_SECONDS) {
    timer.classList.add("warning");
  } else {
    timer.classList.remove("warning");
  }
}

function clearTimers() {
  if (timerIntervalId) {
    clearInterval(timerIntervalId);
    timerIntervalId = null;
  }
  if (autoStopId) {
    clearTimeout(autoStopId);
    autoStopId = null;
  }
}

function cleanupStream() {
  clearTimers();
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }
  syncControlAvailability();
}

function pickRecorderOptions(selectedMode) {
  const candidates =
    selectedMode === "video"
      ? ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/mp4"]
      : ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) {
      return { mimeType: type };
    }
  }
  return null;
}

function videoConstraints() {
  return {
    video: {
      facingMode: { ideal: facingMode },
      width: { ideal: 960, max: 1280 },
      height: { ideal: 540, max: 720 },
      frameRate: { ideal: 24, max: 30 }
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  };
}

function audioConstraints() {
  return {
    video: false,
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  };
}

function setStatus(message, isError, isSuccess = false) {
  statusEl.textContent = message;
  statusEl.classList.remove("error", "ok");
  if (isError) {
    statusEl.classList.add("error");
  } else if (isSuccess) {
    statusEl.classList.add("ok");
  }
}

function normalizeError(error) {
  if (!error) {
    return "Unknown error.";
  }
  if (error.name === "NotAllowedError") {
    return "Permission denied. Please allow camera and microphone access, then try again.";
  }
  if (error.name === "NotFoundError") {
    return "No camera/microphone was found on this device.";
  }
  return error.message || String(error);
}

function formatSeconds(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "guest";
}

function getExtension(mimeType, mediaType) {
  if (mimeType.includes("mp4")) {
    return "mp4";
  }
  if (mimeType.includes("mpeg")) {
    return "mp3";
  }
  if (mimeType.includes("ogg")) {
    return "ogg";
  }
  if (mediaType === "audio") {
    return "webm";
  }
  return "webm";
}

function goToStep(step, { force = false } = {}) {
  const safeStep = Math.max(0, Math.min(2, step));
  if (!force && !canAccessStep(safeStep)) {
    return;
  }
  currentStep = safeStep;
  updateStepUI();
  if (safeStep === 1 && !stream) {
    attemptCameraSetup();
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function canAccessStep(step) {
  if (step <= currentStep) return true;
  if (step === 1) return true;
  if (step === 2) return !recordAnotherBtn.classList.contains("hidden");
  return false;
}

function updateStepUI() {
  stepPanels.forEach((panel) => {
    const panelStep = Number(panel.dataset.stepPanel);
    const isActive = panelStep === currentStep;
    panel.classList.toggle("active", isActive);
    panel.classList.toggle("hidden", !isActive);
  });

  const stepNumber = currentStep + 1;
  const totalSteps = 3;
  const progressPercent = (stepNumber / totalSteps) * 100;
  workflowProgressFill.style.width = `${progressPercent}%`;
  workflowProgressTrack.setAttribute("aria-valuenow", String(stepNumber));
  workflowProgressTrack.setAttribute("aria-valuetext", `Step ${stepNumber} of ${totalSteps}`);
  workflowProgressStep.textContent = `Step ${stepNumber} of ${totalSteps}`;

  syncControlAvailability();
}

function syncControlAvailability() {
  const hasStream = !!stream;
  const isVideo = mode === "video";

  // Camera permission overlay: visible when no stream
  cameraOverlay.classList.toggle("hidden", hasStream);
  enableMediaBtn.textContent = isVideo ? "Enable Camera + Microphone" : "Enable Microphone";

  // Video wrap: hide when audio mode with active stream (nothing useful to show)
  videoWrap.classList.toggle("hidden", !isVideo && hasStream);

  // Flip camera: overlaid circle button, only when video stream is live
  flipCameraBtn.classList.toggle("hidden", !isVideo || !hasStream);
  flipCameraBtn.disabled = isRecording;

  // Start only available when stream is ready
  startBtn.disabled = !hasStream || isRecording;
}

async function attemptCameraSetup() {
  enableMediaBtn.disabled = true;
  setStatus("Requesting access\u2026", false);
  try {
    await setupStream();
    setStatus("Ready to record.", false);
  } catch (error) {
    setStatus(normalizeError(error), true);
  } finally {
    enableMediaBtn.disabled = false;
  }
}

renderIdleTimer();
goToStep(0, { force: true });
