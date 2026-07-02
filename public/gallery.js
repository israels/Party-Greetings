import { db, storage } from "./firebase-config.js";
import {
  deleteDoc,
  doc,
  onSnapshot,
  collection,
  orderBy,
  query
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { deleteObject, ref } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js";

// Gallery password is loaded from config.js via window.appConfig
// (set by config-loader.js)
let GALLERY_PASSWORD = null;

// Wait for config to be loaded
document.addEventListener("DOMContentLoaded", () => {
  if (!window.appConfig) {
    setGalleryStatus("Configuration error: appConfig not loaded", true);
    return;
  }
  GALLERY_PASSWORD = window.appConfig.galleryPassword;
  if (!GALLERY_PASSWORD || GALLERY_PASSWORD === "CHANGE_ME_TO_A_STRONG_PASSWORD") {
    setGalleryStatus(
      "⚠️  Gallery password not configured. Check config.js.",
      true
    );
  }
});

const passwordGate = document.getElementById("passwordGate");
const galleryPanel = document.getElementById("galleryPanel");
const passwordForm = document.getElementById("passwordForm");
const galleryPasswordInput = document.getElementById("galleryPassword");
const passwordStatus = document.getElementById("passwordStatus");
const galleryStatus = document.getElementById("galleryStatus");
const galleryList = document.getElementById("galleryList");
const sortBy = document.getElementById("sortBy");
const downloadAllBtn = document.getElementById("downloadAllBtn");

let entries = [];

passwordForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const entered = galleryPasswordInput.value.trim();
  if (entered !== GALLERY_PASSWORD) {
    passwordStatus.textContent = "Incorrect password. Try again.";
    passwordStatus.classList.add("error");
    return;
  }
  passwordStatus.textContent = "";
  passwordGate.classList.add("hidden");
  galleryPanel.classList.remove("hidden");
  initGalleryFeed();
});

sortBy.addEventListener("change", () => {
  renderGallery();
});

downloadAllBtn.addEventListener("click", async () => {
  if (!entries.length) {
    setGalleryStatus("No files available to download.", true);
    return;
  }
  if (!window.JSZip) {
    setGalleryStatus("Zip library failed to load.", true);
    return;
  }

  setGalleryStatus("Preparing ZIP download...", false);
  downloadAllBtn.disabled = true;
  const zip = new window.JSZip();
  let complete = 0;

  try {
    for (const item of entries) {
      const response = await fetch(item.downloadURL);
      if (!response.ok) {
        throw new Error(`Unable to fetch ${item.fileName || item.id}`);
      }
      const blob = await response.blob();
      const fallbackExt = item.mediaType === "audio" ? "webm" : "webm";
      const fileName = item.fileName || `${item.id}.${fallbackExt}`;
      zip.file(fileName, blob);
      complete += 1;
      setGalleryStatus(`Preparing ZIP... ${complete}/${entries.length}`, false);
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const guestSlug = slugify(window.appConfig?.guestName || "guest");
    downloadBlob(zipBlob, `${guestSlug}-blessings-${Date.now()}.zip`);
    setGalleryStatus("ZIP download is ready.", false, true);
  } catch (error) {
    setGalleryStatus(error.message || "Failed to prepare ZIP download.", true);
  } finally {
    downloadAllBtn.disabled = false;
  }
});

function initGalleryFeed() {
  setGalleryStatus("Loading blessings...", false);
  const q = query(collection(db, "greetings"), orderBy("createdAtMs", "desc"));
  onSnapshot(
    q,
    (snapshot) => {
      entries = snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }));
      renderGallery();
      setGalleryStatus(`Loaded ${entries.length} blessing${entries.length === 1 ? "" : "s"}.`, false);
    },
    (error) => {
      setGalleryStatus(error.message || "Could not load gallery.", true);
    }
  );
}

function renderGallery() {
  const sorted = sortEntries([...entries], sortBy.value);
  galleryList.innerHTML = "";

  if (!sorted.length) {
    galleryList.innerHTML = "<p>No blessings uploaded yet.</p>";
    return;
  }

  for (const entry of sorted) {
    const article = document.createElement("article");
    article.className = "gallery-item";

    const media = entry.mediaType === "audio" ? document.createElement("audio") : document.createElement("video");
    media.controls = true;
    if (entry.mediaType !== "audio") {
      media.playsInline = true;
    }
    media.src = entry.downloadURL;
    article.appendChild(media);

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.innerHTML = `
      <div><strong>${escapeHtml(entry.guestName || "Anonymous")}</strong></div>
      <div>${entry.guestMessage ? escapeHtml(entry.guestMessage) : "No note provided."}</div>
      <div>${formatDate(entry.createdAtMs)} • ${Math.max(1, Math.round(entry.durationSeconds || 0))}s</div>
    `;
    article.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "item-actions";

    const downloadBtn = document.createElement("button");
    downloadBtn.type = "button";
    downloadBtn.className = "btn btn-secondary";
    downloadBtn.textContent = "Download";
    downloadBtn.addEventListener("click", async () => {
      try {
        const response = await fetch(entry.downloadURL);
        if (!response.ok) {
          throw new Error("Download failed.");
        }
        const blob = await response.blob();
        const fallbackExt = entry.mediaType === "audio" ? "webm" : "webm";
        downloadBlob(blob, entry.fileName || `${entry.id}.${fallbackExt}`);
      } catch (error) {
        setGalleryStatus(error.message || "Failed to download file.", true);
      }
    });
    actions.appendChild(downloadBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", async () => {
      const confirmed = window.confirm("Delete this upload permanently?");
      if (!confirmed) {
        return;
      }
      deleteBtn.disabled = true;
      setGalleryStatus("Deleting upload...", false);
      try {
        if (entry.storagePath) {
          await deleteObject(ref(storage, entry.storagePath));
        }
        await deleteDoc(doc(db, "greetings", entry.id));
        setGalleryStatus("Upload deleted.", false, true);
      } catch (error) {
        setGalleryStatus(error.message || "Could not delete upload.", true);
      } finally {
        deleteBtn.disabled = false;
      }
    });
    actions.appendChild(deleteBtn);

    article.appendChild(actions);
    galleryList.appendChild(article);
  }
}

function sortEntries(items, sortValue) {
  if (sortValue === "date-asc") {
    return items.sort((a, b) => Number(a.createdAtMs || 0) - Number(b.createdAtMs || 0));
  }
  if (sortValue === "name-asc") {
    return items.sort((a, b) => String(a.guestName || "").localeCompare(String(b.guestName || "")));
  }
  if (sortValue === "name-desc") {
    return items.sort((a, b) => String(b.guestName || "").localeCompare(String(a.guestName || "")));
  }
  return items.sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0));
}

function setGalleryStatus(message, isError, isSuccess = false) {
  galleryStatus.textContent = message;
  galleryStatus.classList.remove("error", "ok");
  if (isError) {
    galleryStatus.classList.add("error");
  } else if (isSuccess) {
    galleryStatus.classList.add("ok");
  }
}

function formatDate(createdAtMs) {
  if (!createdAtMs) {
    return "Unknown date";
  }
  const date = new Date(createdAtMs);
  return date.toLocaleString();
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
