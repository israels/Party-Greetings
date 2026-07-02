# Daniella's Bat Mitzvah Greetings 🎉

A mobile-friendly web app for guests to record and share video or audio blessings and greetings for Daniella's bat mitzvah.

## Getting Started

This project uses Firebase for storage and hosting. Follow the setup instructions below.

### Setup Instructions

1. **Create a Firebase Project**
   - Go to [firebase.google.com](https://firebase.google.com)
   - Click "Get Started" and create a new project

2. **Enable Firebase Services**
   - Enable **Firestore Database** (use test mode for initial setup)
   - Enable **Firebase Storage**
   - Enable **Firebase Hosting**

3. **Configure the App**
   - Copy your Firebase config from the project settings
   - Update `firebase-config.js` with your config values

4. **Deploy**
   - Install Firebase CLI: `npm install -g firebase-tools`
   - Run `firebase init` and `firebase deploy`

### Features

- **Guest Recording Page** (`index.html`) — Record video or audio blessings
- **Family Gallery** (`gallery.html`) — View all submissions (password protected)
- **Responsive Design** — Works on iPhone and Android
- **5-minute Recording Limit** — Automatic time enforcement
- **Firebase Integration** — Secure cloud storage and database

### Changing the Gallery Password

Edit `gallery.js` and update the `GALLERY_PASSWORD` constant.

### Browser Compatibility

- Works on modern browsers (Chrome, Firefox, Safari)
- Requires HTTPS for camera/mic access (Firebase Hosting provides this)
- iOS Safari requires `playsinline` attribute on video elements

Enjoy the celebration! 🎊
