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
document.addEventListener("DOMContentLoaded", () => {
  const titleEl = document.getElementById("mainTitle");
  const descEl = document.getElementById("mainDescription");
  const promptListEl = document.getElementById("promptList");
  const galleryTitleEl = document.getElementById("galleryTitle");
  const guestMessageLabelEl = document.getElementById("guestMessageLabel");

  if (titleEl) {
    titleEl.textContent = `Leave a Blessing for ${globalConfig.guestName} 🎉`;
  }

  if (descEl && globalConfig.eventDescription) {
    descEl.textContent = globalConfig.eventDescription;
  }

  if (promptListEl && globalConfig.blessingPrompts) {
    promptListEl.innerHTML = globalConfig.blessingPrompts
      .map((prompt) => `<li>${escapeHtml(prompt)}</li>`)
      .join("");
  }

  if (galleryTitleEl) {
    galleryTitleEl.textContent = `${globalConfig.guestName}'s Blessings Gallery`;
  }

  if (guestMessageLabelEl) {
    guestMessageLabelEl.textContent = `A note for ${globalConfig.guestName} (optional)`;
  }
});

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
