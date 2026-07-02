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
  
  // Name of the person receiving blessings (used in page titles, prompts, gallery)
  guestName: "Guest of Honor",
  
  // Short description of the event (optional, displayed on landing page)
  eventDescription: "Record a short encouragement or memory for our guest of honor.",
  
  // Blessing prompts shown to guests
  blessingPrompts: [
    "Share your favorite memory with our guest of honor.",
    "Offer one blessing or encouraging word for their future.",
    "Say one thing you admire about who they are becoming."
  ],
  
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
