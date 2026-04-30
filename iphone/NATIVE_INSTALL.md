# No-Hosting iPhone Install Setup

This folder is configured for a native iOS wrapper with Capacitor. The app files are bundled into the iOS project, so the app does not need to be hosted after it is built and signed.

## Build iPhone App

Run these commands on a Mac with Node.js and Xcode installed:

```sh
npm install
npm run native:add:ios
npm run native:sync
npm run native:open:ios
```

In Xcode, choose a signing team and install to your device, upload to TestFlight, or distribute through the App Store.

Apple does not allow a normal downloaded website archive to install directly as an iPhone app without signing.
