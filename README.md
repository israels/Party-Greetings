# Greetings App 🎉

A mobile-friendly web app for guests to record and upload video/audio greetings for an event, plus a family gallery to view, sort, download, and remove uploads.

## Features

- Creative landing prompt cards above the guest photo, powered by configurable message prompts
- Video-first recording with audio-only option
- Front camera default + flip camera button
- Retake + preview before upload
- Optional guest name + optional note
- Live countdown and near-limit warning
- Strict 90-second auto-stop (cost-aware default)
- Realtime upload progress + completion message
- "Record another message" flow for multiple submissions
- Family gallery with password protection
- Sort gallery by name or upload date
- Automatic background WebM -> MP4 conversion for mobile-friendly downloads
- Download MP4 only when conversion is complete
- Delete upload from gallery (Firestore record + Storage file)

## Before You Start

You'll need:
- A Firebase project (free tier works)
- Firebase CLI installed (`npm install -g firebase-tools`)
- Configuration files (which you'll create from templates)

## Setup

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://firebase.google.com)
2. Click **Create a project** or select existing one
3. In **Project Settings**, enable:
   - **Firestore Database** (start in test mode if testing locally)
   - **Storage** (for media uploads)
   - **Hosting** (to deploy the web app)

### 2. Set Up Configuration Files

#### Firebase Configuration (`firebase-config.js`)

1. In Firebase Console, go to **Project Settings** (⚙️ icon)
2. Scroll to **Your apps** and select your web app (or create one)
3. Copy your Firebase config object
4. Create `firebase-config.js` in the project root:
   ```javascript
   import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
   import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
   import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js";

   const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
     projectId: "YOUR_PROJECT_ID",
     storageBucket: "YOUR_PROJECT_ID.appspot.com",
     messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
     appId: "YOUR_APP_ID"
   };

   const app = initializeApp(firebaseConfig);
   const db = getFirestore(app);
   const storage = getStorage(app);

   export { app, db, storage };
   ```
5. Replace `YOUR_*` placeholders with actual values from your Firebase project
6. Also create `public/firebase-config.js` with the same content

#### Event Configuration (`config.js`)

1. Copy `config.example.js` to create `config.js`
2. Edit the values:
   ```javascript
   export const config = {
     guestName: "Guest of Honor",  // Change to guest name
     eventDescription: "Record a short encouragement or memory for our guest of honor.",
     messagePrompts: [
       "Share a favorite memory or special moment with Daniella",
       "Offer a blessing or short prayer for her life and faith journey",
       "Share a meaningful Bible verse and why it fits her or this milestone",
       "Tell her one thing you admire about her or how proud you are of the young woman she is becoming"
     ],
     eventTimeZone: "America/Los_Angeles",  // Used for filename local timestamps
     galleryPassword: "MySecurePassword123",  // Change to strong password!
     firestoreCollection: "greetings"
   };
   ```
3. Also create `public/config.js` with the same content

**⚠️ IMPORTANT:** Both `firebase-config.js` and `config.js` are in `.gitignore` — never commit them to version control!

### 3. Initialize Firebase in Your Project

```bash
firebase login
firebase init
```

When prompted by `firebase init`, select:

- **Which Firebase features do you want to set up for this directory?**
  - ✅ Firestore Database
  - ✅ Storage (emulator optional)
  - ✅ Hosting
  - ✅ Functions

- **What file should be used as your Firestore indexes?**
  - Accept default: `firestore.indexes.json`

- **What file should be used as your Firestore rules?**
  - Accept default: `firestore.rules`

- **What file should be used as your Cloud Storage rules?**
  - Accept default: `storage.rules`

- **What do you want to use as your public directory?**
  - Enter: `public`

- **Configure as a single-page app (rewrite all URLs to index.html)?**
  - Select: `Yes`

- **Set up automatic builds and deploys with GitHub?**
  - Select: `No` (unless you want CI/CD)

### 4. Enable MP4 Conversion (Manual Firebase Console Steps)

The gallery keeps playback on original WebM, but download buttons appear only after MP4 conversion completes.

1. Confirm the default storage bucket name from your web config (`storageBucket`) in `public/firebase-config.js`.
2. In Firebase Console, enable:
  - **Cloud Functions**
  - **Cloud Build**
  - **Artifact Registry**
  - **Eventarc**
3. In Google Cloud Console, open **IAM & Admin** -> **IAM**.
4. Grant this principal bucket read permissions (replace project number):
  - `service-PROJECT_NUMBER@gcp-sa-eventarc.iam.gserviceaccount.com`
5. Grant role:
  - **Cloud Storage -> Storage Legacy Bucket Reader**
6. In Cloud Storage -> Buckets -> `<your storage bucket>` -> **Permissions**, grant the same role to the same principal at bucket level.

Without this IAM step, function deploy may fail with `storage.buckets.get denied` during trigger validation.

### 5. Firestore Collection Setup (One-Time)

The app writes to a `greetings` Firestore collection with fields:
- `guestName`
- `guestMessage`
- `mediaType` (`video` or `audio`)
- `fileName`
- `storagePath`
- `downloadURL`
- `conversionStatus` (`queued`, `processing`, `completed`, `failed`)
- `mp4StoragePath`
- `mp4FileName`
- `mp4DownloadURL`
- `durationSeconds`
- `createdAtMs`
- `createdAt` (server timestamp)

Upload filenames now use a sortable local datetime format based on `eventTimeZone`:
- `YYYYMMDD_HHmmss_guest_name_random.ext`
- Example upload: `20260706_184512_jane_smith_k9x3v2.webm`
- MP4 conversion keeps the same base name and swaps extension to `.mp4`

The collection is auto-created on first upload, but you can pre-create it in Firebase Console if preferred.

### 6. Deploy to Firebase Hosting

```bash
firebase deploy
```

Your app will be live at: `https://YOUR_PROJECT_ID.web.app`

---

## Security Notes

### Test vs. Production

**For testing/events:**
- Firestore: Start in **test mode** (anyone can read/write) for initial testing
- After event: Lock down rules if you want to prevent new uploads

**For production:**
- Consider time-limited test mode or more restrictive security rules
- Password gate on gallery is client-side only — add Firebase Auth if you need stronger security

### Password Protection

The gallery uses a **client-side password gate** (not secure authentication). It's sufficient for family/friends but not for sensitive data. For stronger security, integrate Firebase Authentication.

---

## File Structure

```
public/
  ├── index.html              # Guest recording page
  ├── gallery.html            # Family gallery page
  ├── app.js                  # Recording logic
  ├── gallery.js              # Gallery management
  ├── firebase-config.js      # (GITIGNORED) Firebase credentials
  ├── config.js               # (GITIGNORED) Event config
  ├── config-loader.js        # Loads config dynamically
  └── style.css               # Styling
config.example.js             # Template for config.js
firebase-config.example.js    # Template for firebase-config.js
firebase.json                 # Firebase project config
firestore.rules               # Firestore security rules
firestore.indexes.json        # Firestore indexes
storage.rules                 # Cloud Storage rules
README.md                      # This file
```

---

## Cost Control Tips

- Keep the 90-second recording cap
- Prefer Wi-Fi for large upload/download activity
- Archive/download files after the event, then optionally delete cloud copies
- Use Firebase's free tier pricing calculator to estimate costs

---

## Post-Event: Archive & Cleanup

### ⚠️ Storage Access Note

**Firebase Storage buckets don't appear by default in Google Cloud Console.** To access your bucket in Cloud Storage, you must search by name (`YOUR_PROJECT_ID.appspot.com`) rather than browsing the list. This is expected behavior.

### Download All Files

Use the family gallery to download individual media files via the modal download button. Download controls are hidden until MP4 conversion is complete.

### Optional: Export from Cloud Storage

If you want a complete backup:

```bash
# Install Google Cloud tools
npm install -g @google-cloud/storage

# Download all files
gsutil -m cp -r gs://YOUR_STORAGE_BUCKET/greetings ./local-backup
```

Find `YOUR_STORAGE_BUCKET` in `firebase-config.js` (`storageBucket` field).

### Delete Cloud Files (Optional)

After backing up, delete from Firebase Console:
1. Go to **Storage** in Firebase Console
2. Select files in `greetings/` folder
3. Delete them to reduce storage costs

---

## Customization

### Change Guest Name

Edit `config.js`:
```javascript
guestName: "Your Guest Name",
```

This automatically updates page titles, prompts, and gallery headings.

### Change Gallery Password

Edit `config.js`:
```javascript
galleryPassword: "YourStrongPassword",
```

### Change Message Prompts

Edit `config.js`:
```javascript
messagePrompts: [
  "Share a favorite memory or special moment",
  "Offer a blessing or short prayer",
  "Share a meaningful Bible verse and why it fits",
  "Tell one thing you admire"
],
```

These prompts render as inspiration cards near the top of the landing page, before the guest photo.

### Change Recording Limit

Edit `public/app.js`:
```javascript
const MAX_SECONDS = 90;  // Change to desired limit
```

### Guest Photo Without Committing to Git

The landing page photo uses:

```html
./local-media/guest-of-honor.jpg
```

To keep this image out of source control while still deploying from GitHub Actions:

1. Upload the photo to Firebase Storage (example path: `images/guest-of-honor.jpg`).
2. Copy its download URL.
3. Save that URL as repository secret `GUEST_OF_HONOR_PHOTO_URL`.

The deploy workflow in `.github/workflows/firebase-hosting-merge.yml` downloads the image during CI into `public/local-media/guest-of-honor.jpg`.

Fallback option:

- You can use `GUEST_OF_HONOR_PHOTO_B64`, but URL mode is preferred because large images can exceed GitHub secret size limits.

---

## Browser Support

- Modern Chrome, Safari, Firefox (mobile + desktop)
- HTTPS required for camera/mic access
- iOS Safari supported (`playsinline` used on video elements)

---

## Troubleshooting

**"config.js not found"**
- Create `config.js` from `config.example.js` and fill in values

**"firebase-config.js not found"**
- Create `firebase-config.js` from `firebase-config.example.js` with your Firebase credentials

**Camera/microphone not working**
- Check that app is served over HTTPS (Firebase Hosting does this automatically)
- Verify browser permissions for camera/mic
- Some browsers require user gesture to start recording

**Upload fails**
- Check Firebase Storage is enabled in your project
- Verify Firestore rules allow writes (test mode allows all)
- Check Storage rules (`storage.rules`) permit uploads

**Function deploy fails with `storage.buckets.get denied`**
- Grant Eventarc service account bucket metadata read access (see Setup step 4)
- Retry deploy: `firebase deploy --only functions`

**No MP4 generated after upload**
- Check function `convertWebmToMp4` has invocations in Firebase Console
- In Firestore, confirm `conversionStatus` transitions to `completed`
- Confirm MP4 object exists next to the original in Storage

**MP4 download button never appears**
- Ensure Firestore doc includes `mp4DownloadURL` and `conversionStatus: completed`
- Upload a new file after latest function deploy (older converted files may need backfill)

---

## Questions?

See the Firebase documentation:
- [Firestore Setup](https://firebase.google.com/docs/firestore/start)
- [Cloud Storage Setup](https://firebase.google.com/docs/storage/web/start)
- [Firebase Hosting](https://firebase.google.com/docs/hosting)
