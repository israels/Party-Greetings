# Quick Setup Guide

Follow these steps to deploy the Greetings App to Firebase Hosting.

## 1. Prerequisites

- Node.js and npm installed
- A Firebase project (create free at https://firebase.google.com)
- Firebase CLI: `npm install -g firebase-tools`

## 2. Enable Firebase Services

In your Firebase Console:
1. Go to **Firestore Database** → Create Database (start in test mode)
2. Go to **Storage** → Create Bucket
3. Go to **Hosting** → Enable Hosting

## 3. Create Configuration Files

### Firebase Configuration (`public/firebase-config.js`)

1. In Firebase Console → Project Settings (⚙️)
2. Copy your web app config
3. Create `public/firebase-config.js`:
   ```javascript
   import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
   import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
   import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js";

   const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_PROJECT.firebaseapp.com",
     projectId: "YOUR_PROJECT",
     storageBucket: "YOUR_PROJECT.appspot.com",
     messagingSenderId: "YOUR_SENDER_ID",
     appId: "YOUR_APP_ID"
   };

   const app = initializeApp(firebaseConfig);
   const db = getFirestore(app);
   const storage = getStorage(app);

   export { app, db, storage };
   ```

### Event Configuration (`public/config.js`)

1. Copy `config.example.js` → `public/config.js`
2. Edit with your event details:
   ```javascript
   export const config = {
     guestName: "Guest's Name",
     eventDescription: "Custom event description",
     blessingPrompts: [
       "Prompt 1",
       "Prompt 2",
       "Prompt 3"
     ],
     galleryPassword: "StrongPassword123",
     firestoreCollection: "greetings"
   };
   ```

## 4. Initialize Firebase

```bash
firebase login
firebase init
```

When prompted:
- ✅ Select: **Firestore Database**
- ✅ Select: **Storage**
- ✅ Select: **Hosting**
- Public directory: `public`
- Single-page app: `Yes`
- GitHub CI/CD: `No`

## 5. Deploy

```bash
firebase deploy
```

Your app is now live at: `https://YOUR_PROJECT.web.app`

## ⚠️ Important Notes

- **Never commit** `public/firebase-config.js` or `public/config.js`
- These files are in `.gitignore` to protect secrets
- Each developer/deployment needs their own config files
- The gallery password (in `config.js`) is client-side only—not secure for sensitive data

## File Locations Summary

```
public/
  ├── firebase-config.js          ← Create from firebase-config.example.js
  ├── config.js                   ← Create from config.example.js (copy to public/)
  ├── config-loader.js            ← Already in repo
  ├── index.html                  ← Guest recording page
  ├── gallery.html                ← Family gallery page
  ├── app.js                       ← Recording logic
  ├── gallery.js                   ← Gallery logic
  └── style.css                    ← Styling
```

## Troubleshooting

**"config.js not found"** → Create `public/config.js` from `config.example.js`

**"firebase-config.js not found"** → Create `public/firebase-config.js` with your Firebase credentials

**Camera/mic not working** → HTTPS required (Firebase Hosting provides this)

**Upload fails** → Check Firestore/Storage rules allow writes (test mode = all writes allowed)

## See Also

- [Full README](README.md) for feature details and customization
- [Firebase Docs](https://firebase.google.com/docs)
