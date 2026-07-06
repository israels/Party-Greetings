/**
 * Configuration template for the Greetings App
 * 
 * SETUP INSTRUCTIONS:
 * 1. Copy this file to create `config.js` (which is gitignored)
 * 2. Fill in all the values below with your event details
 * 3. The app will automatically load these values
 * 
 * DO NOT commit config.js to version control - it contains secrets!
 */

export const config = {
  // ============================================================================
  // EVENT DETAILS
  // ============================================================================
  
  // Name of the person being celebrated (used in page titles, prompts, gallery)
  guestName: "Guest of Honor",
  
  // Short description of the event (optional, displayed on landing page)
  eventDescription: "Record a short encouragement or memory for our guest of honor.",
  
  // Message prompts shown to guests
  messagePrompts: [
    "Share a favorite memory or special moment with Daniella",
    "Offer a blessing or short prayer for her life and faith journey",
    "Share a meaningful Bible verse and why it fits her or this milestone",
    "Tell her one thing you admire about her or how proud you are of the young woman she is becoming"
  ],

  // Event timezone used for local timestamp formatting in upload filenames
  // Use IANA names like "America/Los_Angeles", "America/New_York", "Europe/London"
  eventTimeZone: "America/Los_Angeles",
  
  // ============================================================================
  // SECURITY - FAMILY GALLERY ACCESS
  // ============================================================================
  
  // Password to access the family gallery (must enter on gallery.html)
  // Use a strong password! Example: "MyEvent2026SecurePass"
  galleryPassword: "CHANGE_ME_TO_A_STRONG_PASSWORD",
  
  // ============================================================================
  // FIRESTORE COLLECTION NAME
  // ============================================================================
  
  // Name of the Firestore collection where uploads are stored
  // (most users should leave this as "greetings")
  firestoreCollection: "greetings",
};
