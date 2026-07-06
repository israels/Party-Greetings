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
const sequenceScope = document.getElementById("sequenceScope");
const playAllVideosBtn = document.getElementById("playAllVideosBtn");
const mediaModal = document.getElementById("mediaModal");
const modalCloseBtn = document.getElementById("modalCloseBtn");
const modalTitle = document.getElementById("modalTitle");
const modalSubtitle = document.getElementById("modalSubtitle");
const modalMetaText = document.getElementById("modalMetaText");
const modalMediaShell = document.getElementById("modalMediaShell");
const modalFullscreenBtn = document.getElementById("modalFullscreenBtn");
const modalDownloadBtn = document.getElementById("modalDownloadBtn");
const modalDeleteBtn = document.getElementById("modalDeleteBtn");
const modalSequenceControls = document.getElementById("modalSequenceControls");
const modalPrevBtn = document.getElementById("modalPrevBtn");
const modalPauseBtn = document.getElementById("modalPauseBtn");
const modalNextBtn = document.getElementById("modalNextBtn");
const modalSequenceProgress = document.getElementById("modalSequenceProgress");
const modalAutoplayContinueBtn = document.getElementById("modalAutoplayContinueBtn");

const AUTOPLAY_PREF_KEY = "gallerySequentialAutoplay";

let entries = [];
let activeModalEntry = null;
let activeModalMedia = null;

// Sequential state
let isSequentialMode = false;
let sequentialQueue = [];
let sequentialCurrentIndex = -1;
let shouldAutoAdvance = false;
let lastAutoplayBlocked = false;

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
    handleSortOrScopeChange();
    renderGallery();
  });

  if (sequenceScope) {
    sequenceScope.addEventListener("change", () => {
      handleSortOrScopeChange();
    });
  }

  if (playAllVideosBtn) {
    playAllVideosBtn.addEventListener("click", () => {
      void startSequentialPlayback();
    });
  }
  updatePlaySequenceButton();

  if (modalPrevBtn) {
    modalPrevBtn.addEventListener("click", () => {
      void goToPreviousSequentialEntry();
    });
  }

  if (modalNextBtn) {
    modalNextBtn.addEventListener("click", () => {
      void goToNextSequentialEntry();
    });
  }

  if (modalPauseBtn) {
    modalPauseBtn.addEventListener("click", () => {
      void toggleSequentialPause();
    });
  }

  if (modalAutoplayContinueBtn) {
    modalAutoplayContinueBtn.addEventListener("click", () => {
      void continueAfterAutoplayBlock();
    });
  }

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
    if (mediaModal.classList.contains("hidden")) {
      return;
    }

    if (event.key === "Escape") {
      closeMediaModal();
      return;
    }

    if (!isSequentialMode) {
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      void goToPreviousSequentialEntry();
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      void goToNextSequentialEntry();
      return;
    }

    if (event.key === " " || event.code === "Space") {
      event.preventDefault();
      void toggleSequentialPause();
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
      if (isSequentialMode) {
        refreshSequentialQueue(activeModalEntry?.id || null);
      }
    renderGallery();
      setGalleryStatus(`Loaded ${entries.length} blessing${entries.length === 1 ? "" : "s"}.`, false);
    },
    (error) => {
      setGalleryStatus(error.message || "Could not load gallery.", true);
    }
  );
}

async function startSequentialPlayback(startEntryId = null) {
  refreshSequentialQueue(startEntryId);

  if (!sequentialQueue.length) {
    setGalleryStatus("No media available for the selected sequential scope.", true);
    return;
  }

  const autoplayPref = getAutoplayPreference();
  if (!autoplayPref) {
    const wantsAutoplay = window.confirm(
      "Enable continuous autoplay in sequential mode?\n\nSelect OK for autoplay, or Cancel to manually start each next item."
    );
    setAutoplayPreference(wantsAutoplay ? "always" : "manual");
  }

  isSequentialMode = true;
  shouldAutoAdvance = true;
  updateSequentialControls();
  updatePlaySequenceButton();

  const currentScope = getScopeLabel(sequenceScope?.value || "video");
  setGalleryStatus(`Sequential mode started (${currentScope}).`, false);
  await openSequentialCurrentEntry(true);
}

function stopSequentialPlayback(options = {}) {
  const keepStatus = options.keepStatus === true;
  isSequentialMode = false;
  sequentialQueue = [];
  sequentialCurrentIndex = -1;
  shouldAutoAdvance = false;
  lastAutoplayBlocked = false;
  hideAutoplayContinueButton();
  updateSequentialControls();
  updatePlaySequenceButton();

  if (!keepStatus) {
    setGalleryStatus("Sequential mode stopped.", false);
  }
}

async function openSequentialCurrentEntry(tryAutoplay) {
  if (!isSequentialMode || sequentialCurrentIndex < 0 || sequentialCurrentIndex >= sequentialQueue.length) {
    return;
  }
  const entry = sequentialQueue[sequentialCurrentIndex];
  openMediaModal(entry, { sequential: true });
  if (tryAutoplay && getAutoplayPreference() === "always") {
    await tryPlayActiveMedia(true);
  }
}

async function goToNextSequentialEntry() {
  if (!isSequentialMode) {
    return;
  }
  if (sequentialCurrentIndex >= sequentialQueue.length - 1) {
    stopSequentialPlayback({ keepStatus: true });
    setGalleryStatus("Reached the end of the sequence.", false);
    return;
  }
  sequentialCurrentIndex += 1;
  await openSequentialCurrentEntry(true);
}

async function goToPreviousSequentialEntry() {
  if (!isSequentialMode) {
    return;
  }
  if (sequentialCurrentIndex <= 0) {
    return;
  }
  sequentialCurrentIndex -= 1;
  await openSequentialCurrentEntry(false);
}

function refreshSequentialQueue(preferredEntryId = null) {
  const existingActiveId = preferredEntryId || activeModalEntry?.id || null;
  sequentialQueue = buildSequentialQueue();

  if (!sequentialQueue.length) {
    sequentialCurrentIndex = -1;
    return;
  }

  const foundIndex = existingActiveId
    ? sequentialQueue.findIndex((entry) => entry.id === existingActiveId)
    : -1;
  sequentialCurrentIndex = foundIndex >= 0 ? foundIndex : 0;
}

function buildSequentialQueue() {
  const sorted = sortEntries([...entries], sortBy.value);
  const scope = sequenceScope?.value || "video";
  if (scope === "video") {
    return sorted.filter((entry) => entry.mediaType === "video");
  }
  if (scope === "audio") {
    return sorted.filter((entry) => entry.mediaType === "audio");
  }
  return sorted.filter((entry) => entry.mediaType === "video" || entry.mediaType === "audio");
}

function handleSortOrScopeChange() {
  if (!isSequentialMode) {
    return;
  }

  const activeId = activeModalEntry?.id || null;
  refreshSequentialQueue(activeId);

  if (!sequentialQueue.length) {
    stopSequentialPlayback({ keepStatus: true });
    closeMediaModal({ skipSequentialStop: true });
    setGalleryStatus("Sequence became empty for the selected filters.", true);
    return;
  }

  void openSequentialCurrentEntry(false);
}

function openMediaModal(entry, options = {}) {
  if (!entry) {
    return;
  }

  const isSequential = options.sequential === true;

  cleanupActiveModalMedia();
  activeModalEntry = entry;

  const media = entry.mediaType === "audio" ? document.createElement("audio") : document.createElement("video");
  media.controls = true;
  media.className = "modal-media";
  media.playsInline = entry.mediaType !== "audio";
  media.src = entry.downloadURL;
  media.addEventListener("loadedmetadata", () => fixInfiniteDuration(media));

  if (isSequential) {
    media.addEventListener("ended", () => {
      if (isSequentialMode && shouldAutoAdvance) {
        void goToNextSequentialEntry();
      }
    });
  }

  media.addEventListener("play", updatePauseButtonLabel);
  media.addEventListener("pause", updatePauseButtonLabel);

  modalMediaShell.innerHTML = "";
  modalMediaShell.appendChild(media);
  activeModalMedia = media;

  modalTitle.textContent = entry.guestName || "Anonymous";
  modalSubtitle.textContent = entry.guestMessage ? entry.guestMessage : "No note provided.";

  modalMetaText.innerHTML = `
    <div><strong>Recorded</strong> ${formatDate(entry.createdAtMs)}</div>
    <div><strong>Type</strong> ${entry.mediaType === "audio" ? "Audio" : "Video"}</div>
    <div><strong>Duration</strong> ${Math.max(1, Math.round(entry.durationSeconds || 0))}s</div>
  `;
  modalFullscreenBtn.textContent = "Close Preview";
  mediaModal.classList.remove("hidden");
  document.body.classList.add("modal-open");
  updateSequentialControls();
  hideAutoplayContinueButton();
  updatePauseButtonLabel();
}

function closeMediaModal(options = {}) {
  cleanupActiveModalMedia();
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

  if (!options.skipSequentialStop && isSequentialMode) {
    stopSequentialPlayback({ keepStatus: true });
  }
}

function cleanupActiveModalMedia() {
  if (!activeModalMedia) {
    modalMediaShell.innerHTML = "";
    return;
  }

  activeModalMedia.pause?.();
  activeModalMedia.removeAttribute("src");
  activeModalMedia.load?.();
  modalMediaShell.innerHTML = "";
  activeModalMedia = null;
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
      openMediaModal(entry);
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

function updateSequentialControls() {
  const hasQueue = isSequentialMode && sequentialQueue.length > 0;
  modalSequenceControls.classList.toggle("hidden", !hasQueue);

  if (!hasQueue) {
    modalSequenceProgress.textContent = "";
    return;
  }

  const current = sequentialCurrentIndex + 1;
  const total = sequentialQueue.length;
  const scopeText = getScopeLabel(sequenceScope?.value || "video");
  modalSequenceProgress.textContent = `Item ${current} of ${total} • ${scopeText}`;

  modalPrevBtn.disabled = sequentialCurrentIndex <= 0;
  modalNextBtn.disabled = sequentialCurrentIndex >= total - 1;
  updatePauseButtonLabel();
}

function updatePauseButtonLabel() {
  if (!modalPauseBtn) {
    return;
  }
  if (!isSequentialMode || !activeModalMedia) {
    modalPauseBtn.textContent = "Pause";
    modalPauseBtn.disabled = true;
    return;
  }

  modalPauseBtn.disabled = false;
  modalPauseBtn.textContent = activeModalMedia.paused ? "Resume" : "Pause";
}

async function toggleSequentialPause() {
  if (!isSequentialMode || !activeModalMedia) {
    return;
  }

  if (activeModalMedia.paused) {
    await tryPlayActiveMedia(false);
    return;
  }

  activeModalMedia.pause();
  updatePauseButtonLabel();
}

async function tryPlayActiveMedia(fromAutoplay) {
  if (!activeModalMedia) {
    return;
  }

  try {
    const maybePromise = activeModalMedia.play();
    if (maybePromise && typeof maybePromise.then === "function") {
      await maybePromise;
    }
    lastAutoplayBlocked = false;
    hideAutoplayContinueButton();
    updatePauseButtonLabel();
  } catch {
    if (!fromAutoplay) {
      return;
    }
    lastAutoplayBlocked = true;
    showAutoplayContinueButton();
    setGalleryStatus("Autoplay was blocked by your browser. Tap continue in the modal.", true);
  }
}

async function continueAfterAutoplayBlock() {
  if (!lastAutoplayBlocked || !activeModalMedia) {
    return;
  }
  await tryPlayActiveMedia(false);
}

function showAutoplayContinueButton() {
  modalAutoplayContinueBtn.classList.remove("hidden");
}

function hideAutoplayContinueButton() {
  modalAutoplayContinueBtn.classList.add("hidden");
}

function getAutoplayPreference() {
  const value = window.localStorage.getItem(AUTOPLAY_PREF_KEY);
  if (value === "always" || value === "manual") {
    return value;
  }
  return null;
}

function setAutoplayPreference(value) {
  if (value === "always" || value === "manual") {
    window.localStorage.setItem(AUTOPLAY_PREF_KEY, value);
  }
}

function getScopeLabel(scopeValue) {
  if (scopeValue === "audio") {
    return "Audio only";
  }
  if (scopeValue === "both") {
    return "Video and audio";
  }
  return "Video only";
}

function updatePlaySequenceButton() {
  if (!playAllVideosBtn) {
    return;
  }
  playAllVideosBtn.disabled = isSequentialMode;
  playAllVideosBtn.textContent = isSequentialMode ? "Playing Sequence" : "Play Sequence";
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
