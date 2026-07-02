/**
 * Firebase Configuration Template
 * 
 * SETUP INSTRUCTIONS:
 * 1. Create a Firebase project at https://firebase.google.com
 * 2. In Firebase Console > Project Settings, copy your config object
 * 3. Create `public/firebase-config.js` with the code below,
 *    replacing YOUR_* placeholders with your actual project values
 * 
 * Example of what your config should look like:
 * 
 * import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
 * import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
 * import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js";
 *
 * const firebaseConfig = {
 *   apiKey: "AIzaSyC_YOUR_API_KEY_HERE",
 *   authDomain: "your-project-id.firebaseapp.com",
 *   projectId: "your-project-id",
 *   storageBucket: "your-project-id.appspot.com",
 *   messagingSenderId: "123456789000",
 *   appId: "1:123456789000:web:abc123def456ghi789"
 * };
 *
 * const app = initializeApp(firebaseConfig);
 * const db = getFirestore(app);
 * const storage = getStorage(app);
 *
 * export { app, db, storage };
 * 
 * IMPORTANT: Create this file as `public/firebase-config.js` (not in root)
 * This file is gitignored - you must create it before deploying.
 * The public/ directory is what gets deployed to Firebase Hosting.
 */

throw new Error(
  "firebase-config.js is missing!\n\n" +
  "Setup steps:\n" +
  "1. Create a Firebase project at https://firebase.google.com\n" +
  "2. In Firebase Console > Project Settings, copy your config values\n" +
  "3. Create public/firebase-config.js with your actual Firebase project config\n" +
  "4. Also create public/config.js from config.example.js with your event details\n" +
  "5. See README.md for detailed setup instructions\n\n" +
  "Both files are in .gitignore - NEVER commit them to version control!"
);

