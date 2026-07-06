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

// Get DOM elements before setting up listeners
const passwordGate = document.getElementById("passwordGate");
const galleryPanel = document.getElementById("galleryPanel");
const passwordForm = document.getElementById("passwordForm");
const galleryPasswordInput = document.getElementById("galleryPassword");
const passwordStatus = document.getElementById("passwordStatus");
const galleryStatus = document.getElementById("galleryStatus");
const galleryList = document.getElementById("galleryList");
const sortBy = document.getElementById("sortBy");
const playAllVideosBtn = document.getElementById("playAllVideosBtn");
const stopPlayAllBtn = document.getElementById("stopPlayAllBtn");
const mediaModal = document.getElementById("mediaModal");
const modalCloseBtn = document.getElementById("modalCloseBtn");
const modalTitle = document.getElementById("modalTitle");
const modalSubtitle = document.getElementById("modalSubtitle");
const modalMetaText = document.getElementById("modalMetaText");
const modalMediaShell = document.getElementById("modalMediaShell");
const modalFullscreenBtn = document.getElementById("modalFullscreenBtn");
const modalDownloadBtn = document.getElementById("modalDownloadBtn");
const modalDeleteBtn = document.getElementById("modalDeleteBtn");

let entries = [];
let activeModalEntry = null;
let activeModalMedia = null;

// Play All state
let isPlayingAll = false;
let playAllQueue = [];
let playAllCurrentIndex = 0;

// WebM files recorded by MediaRecorder often lack duration metadata, causing
// browsers to report duration=Infinity and pin the seekbar thumb at the far
// right. Seeking to a very large time forces the browser to scan the file and
// determine the real duration, then we reset to the beginning.
function fixInfiniteDuration(media) {
  if (!isFinite(media.duration)) {
    media.currentTime = Number.MAX_SAFE_INTEGER;
    media.addEventListener("timeupdate", () => { media.currentTime = 0; }, { once: true });
  }
}

// Wait for config and DOM to load before setting up listeners
document.addEventListener("DOMContentLoaded", async () => {
  // Wait for config to be available (set by config-loader.js)
  let retries = 0;
  while (!window.appConfig && retries < 100) {
    await new Promise(resolve => setTimeout(resolve, 10));
    retries++;
  }

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

  // Password listener needs GALLERY_PASSWORD to be set
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

  playAllVideosBtn.addEventListener("click", startPlayAll);
  stopPlayAllBtn.addEventListener("click", stopPlayAll);

  modalCloseBtn.addEventListener("click", () => closeMediaModal());
  modalFullscreenBtn.addEventListener("click", () => closeMediaModal());
  modalDownloadBtn.addEventListener("click", () => {
    if (!activeModalEntry) {
      return;
    }
    void downloadEntry(activeModalEntry);
  });
  modalDeleteBtn.addEventListener("click", () => {
    if (!activeModalEntry) {
      return;
    }
    void deleteEntry(activeModalEntry, modalDeleteBtn);
  });
  mediaModal.addEventListener("click", (event) => {
    if (event.target === mediaModal || event.target.matches("[data-close-modal]")) {
      closeMediaModal();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (!mediaModal.classList.contains("hidden") && event.key === "Escape") {
      closeMediaModal();
    }
  });
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

function startPlayAll() {
  // Filter videos only and sort oldest first
  const videos = entries
    .filter(entry => entry.mediaType === "video")
    .sort((a, b) => Number(a.createdAtMs || 0) - Number(b.createdAtMs || 0));

  if (!videos.length) {
    setGalleryStatus("No videos available to play.", true);
    return;
  }

  isPlayingAll = true;
  playAllQueue = videos;
  playAllCurrentIndex = 0;

  playAllVideosBtn.disabled = true;
  stopPlayAllBtn.disabled = false;

  setGalleryStatus(`Playing all videos (oldest first). ${videos.length} video${videos.length === 1 ? "" : "s"}.`, false);

  // Open modal and play first video
  openPlayAllModal();
}

function stopPlayAll() {
  isPlayingAll = false;
  playAllQueue = [];
  playAllCurrentIndex = 0;

  playAllVideosBtn.disabled = false;
  stopPlayAllBtn.disabled = true;

  closeMediaModal();
  setGalleryStatus("Play All stopped.", false);
}

function openPlayAllModal() {
  if (playAllCurrentIndex >= playAllQueue.length) {
    // Reached end of queue
    setGalleryStatus("Finished playing all videos.", false);
    stopPlayAll();
    return;
  }

  const entry = playAllQueue[playAllCurrentIndex];
  openMediaModal(entry, true);
}

function handlePlayAllEnded() {
  if (isPlayingAll) {
    playAllCurrentIndex++;
    openPlayAllModal();
  }
}

function openMediaModal(entry, isPlayAll = false) {
  if (!entry) {
    return;
  }

  closeMediaModal();
  activeModalEntry = entry;

  const media = entry.mediaType === "audio" ? document.createElement("audio") : document.createElement("video");
  media.controls = true;
  media.className = "modal-media";
  media.playsInline = entry.mediaType !== "audio";
  media.src = entry.downloadURL;
  media.addEventListener("loadedmetadata", () => fixInfiniteDuration(media));

  if (isPlayAll) {
    media.autoplay = true;
    media.addEventListener("ended", handlePlayAllEnded);
  }

  modalMediaShell.innerHTML = "";
  modalMediaShell.appendChild(media);
  activeModalMedia = media;

  modalTitle.textContent = entry.guestName || "Anonymous";
  modalSubtitle.textContent = entry.guestMessage ? entry.guestMessage : "No note provided.";

  let playAllText = "";
  if (isPlayAll) {
    const total = playAllQueue.length;
    const current = playAllCurrentIndex + 1;
    playAllText = `<div><strong>Play All</strong> ${current} of ${total}</div>`;
  }

  modalMetaText.innerHTML = `
    ${playAllText}
    <div><strong>Recorded</strong> ${formatDate(entry.createdAtMs)}</div>
    <div><strong>Duration</strong> ${Math.max(1, Math.round(entry.durationSeconds || 0))}s</div>
  `;
  modalFullscreenBtn.textContent = "Close Preview";
  mediaModal.classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closeMediaModal() {
  if (activeModalMedia) {
    activeModalMedia.pause?.();
    activeModalMedia.removeAttribute("src");
    activeModalMedia.load?.();
  }

  modalMediaShell.innerHTML = "";
  activeModalMedia = null;
  activeModalEntry = null;
  mediaModal.classList.add("hidden");
  document.body.classList.remove("modal-open");
  modalTitle.textContent = "Preview";
  modalSubtitle.textContent = "";
  modalMetaText.innerHTML = "";
  modalFullscreenBtn.textContent = "Close Preview";

  if (document.fullscreenElement && document.exitFullscreen) {
    void document.exitFullscreen().catch(() => {});
  }
}

async function downloadEntry(entry) {
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
}

async function deleteEntry(entry, button) {
  const confirmed = window.confirm("Delete this upload permanently?");
  if (!confirmed) {
    return;
  }
  if (button) {
    button.disabled = true;
  }
  setGalleryStatus("Deleting upload...", false);
  try {
    if (entry.storagePath) {
      await deleteObject(ref(storage, entry.storagePath));
    }
    await deleteDoc(doc(db, "greetings", entry.id));
    if (activeModalEntry?.id === entry.id) {
      closeMediaModal();
    }
    setGalleryStatus("Upload deleted.", false, true);
  } catch (error) {
    setGalleryStatus(error.message || "Could not delete upload.", true);
  } finally {
    if (button) {
      button.disabled = false;
    }
  }
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
    media.className = "gallery-media";
    if (entry.mediaType !== "audio") {
      media.playsInline = true;
    }
    media.src = entry.downloadURL;
    media.addEventListener("loadedmetadata", () => fixInfiniteDuration(media));
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

    const enlargeBtn = document.createElement("button");
    enlargeBtn.type = "button";
    enlargeBtn.className = "btn btn-secondary";
    enlargeBtn.textContent = "Enlarge";
    enlargeBtn.addEventListener("click", () => {
      openMediaModal(entry, false);
    });
    actions.appendChild(enlargeBtn);

    const downloadBtn = document.createElement("button");
    downloadBtn.type = "button";
    downloadBtn.className = "btn btn-secondary";
    downloadBtn.textContent = "Download";
    downloadBtn.addEventListener("click", () => {
      void downloadEntry(entry);
    });
    actions.appendChild(downloadBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => {
      void deleteEntry(entry, deleteBtn);
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

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "guest";
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
