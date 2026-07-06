/**
 * Config Loader
 * 
 * This script dynamically loads config.js (which is gitignored) and makes
 * the configuration available globally so app.js and gallery.js can access it.
 */

// Try to load config.js, with helpful error message if it's missing
let globalConfig = null;

try {
  const configModule = await import("./config.js");
  globalConfig = configModule.config;
} catch (error) {
  console.error("⚠️  config.js not found!");
  console.error("Setup instructions:");
  console.error("1. Copy config.example.js to create config.js");
  console.error("2. Edit config.js with your event details and gallery password");
  console.error("3. config.js is gitignored - never commit it to version control");
  console.error("");
  throw new Error(
    "config.js is missing. Create it by copying config.example.js and filling in your event details."
  );
}

// Make config available globally for other scripts
window.appConfig = globalConfig;

// Update page titles and labels with config values
function applyConfigToDom() {
  const titleEl = document.getElementById("mainTitle");
  const descEl = document.getElementById("mainDescription");
  const promptPanelEl = document.querySelector(".prompt-panel");
  const promptListEl = document.getElementById("promptList");
  const guestPhotoCaptionEl = document.getElementById("guestPhotoCaption");
  const galleryTitleEl = document.getElementById("galleryTitle");
  const guestMessageLabelEl = document.getElementById("guestMessageLabel");

  if (titleEl) {
    titleEl.textContent = `Leave a Message for ${globalConfig.guestName} 🎉`;
  }

  if (descEl && globalConfig.eventDescription) {
    descEl.textContent = globalConfig.eventDescription;
  }

  const prompts = Array.isArray(globalConfig.messagePrompts)
    ? globalConfig.messagePrompts.filter((prompt) => typeof prompt === "string" && prompt.trim())
    : [];

  if (promptListEl && prompts.length > 0) {
    promptListEl.innerHTML = prompts
      .map((prompt) => `<li>${escapeHtml(prompt)}</li>`)
      .join("");
  } else if (promptPanelEl) {
    promptPanelEl.classList.add("hidden");
  }

  if (guestPhotoCaptionEl) {
    guestPhotoCaptionEl.textContent = globalConfig.guestName || "Guest of Honor";
  }

  if (galleryTitleEl) {
    galleryTitleEl.textContent = `${globalConfig.guestName}'s Greetings Gallery`;
  }

  if (guestMessageLabelEl) {
    guestMessageLabelEl.textContent = `A note for ${globalConfig.guestName} (optional)`;
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", applyConfigToDom, { once: true });
} else {
  applyConfigToDom();
}

function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return String(text).replace(/[&<>"']/g, (char) => map[char]);
}
