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
- ✅ Select: **Functions**
- Public directory: `public`
- Single-page app: `Yes`
- GitHub CI/CD: `No`

## 5. Configure Storage CORS

To allow the gallery to download media files from Firebase Storage, configure CORS on the underlying Cloud Storage bucket:

1. Use the project root `cors.json` file already added to this repo:
   ```json
   [
     {
       "origin": ["*"],
       "method": ["GET", "HEAD"],
       "maxAgeSeconds": 3600
     }
   ]
   ```
2. In Google Cloud Console, open **Cloud Storage** → **Buckets**
3. **⚠️ Note:** Firebase Storage buckets don't appear by default in the bucket list. To find yours, manually enter the bucket name in the search field: `YOUR_PROJECT_ID.appspot.com`
4. Click on your bucket, then go to the **Configuration** tab
5. Scroll down to **CORS configuration** and add the rule from step 1
6. Save the change and wait a minute for the policy to propagate

If you prefer the CLI later, the same change can be applied from Google Cloud Shell with `gsutil`, but the browser flow works without installing that tool locally.

## 6. Enable MP4 Conversion Trigger Permissions (Console UI)

Cloud Functions v2 storage triggers require Eventarc to validate bucket metadata.

1. In Firebase Console, ensure these services are enabled:
  - **Cloud Functions**
  - **Cloud Build**
  - **Artifact Registry**
  - **Eventarc**
2. Find your project number in Firebase Project Settings.
3. In Google Cloud Console -> **IAM & Admin** -> **IAM**, grant this principal:
  - `service-PROJECT_NUMBER@gcp-sa-eventarc.iam.gserviceaccount.com`
4. Role to grant:
  - **Cloud Storage -> Storage Legacy Bucket Reader**
5. In Cloud Storage -> Buckets -> your default bucket -> **Permissions**, grant the same principal and role at bucket level.

If missing, function deploy may fail with `storage.buckets.get denied` while creating the trigger.

## 7. Deploy

```bash
firebase deploy
```

Your app is now live at: `https://YOUR_PROJECT.web.app`

## CI Deploy Without Committing Guest Photo

To keep the landing guest photo out of source control while still deploying it from GitHub Actions:

1. Keep the app image path in [public/index.html](public/index.html#L52) as:
  - `./local-media/guest-of-honor.jpg`
2. Choose one of these GitHub repository secrets:
  - `GUEST_OF_HONOR_PHOTO_URL` (recommended, usually from Firebase Storage)
  - `GUEST_OF_HONOR_PHOTO_B64` (fallback only for small files)
3. Provide the selected secret value.

For URL mode (`GUEST_OF_HONOR_PHOTO_URL`):

- Use a direct-download URL reachable by GitHub Actions.
- This avoids GitHub secret size limits for large images.
- Firebase Storage download URLs work well for this.

Recommended flow:

1. Upload `guest-of-honor.jpg` to Firebase Storage (for example `images/guest-of-honor.jpg`).
2. Copy the file's download URL from Firebase Console.
3. Save that URL into GitHub Actions secret `GUEST_OF_HONOR_PHOTO_URL`.
4. Keep `GUEST_OF_HONOR_PHOTO_B64` empty unless you need fallback behavior.

PowerShell example to generate base64 from a local photo:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\guest-of-honor.jpg")) | Set-Clipboard
```

Then paste clipboard contents into the `GUEST_OF_HONOR_PHOTO_B64` secret value.

During pipeline deploy, workflow [firebase-hosting-merge.yml](.github/workflows/firebase-hosting-merge.yml) writes this secret into:

- `public/local-media/guest-of-honor.jpg`

This guarantees each CI deploy includes the photo even though it is not in git.

## ⚠️ Important Notes

- **Never commit** `public/firebase-config.js` or `public/config.js`
- These files are in `.gitignore` to protect secrets
- Each developer/deployment needs their own config files
- The gallery password (in `config.js`) is client-side only—not secure for sensitive data
- You can add a local landing photo at `public/local-media/guest-of-honor.jpg` (portrait/vertical works best); it is ignored by git

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

**Function deploy fails with `storage.buckets.get denied`** → Complete section 6 IAM steps, then run `firebase deploy --only functions`

**No MP4 output appears** → Check function `convertWebmToMp4` invocation logs and Firestore fields (`conversionStatus`, `mp4DownloadURL`)

## See Also

- [Full README](README.md) for feature details and customization
- [Firebase Docs](https://firebase.google.com/docs)
