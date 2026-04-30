# No-Hosting Native Install Setup

This app can be packaged as a native Android app with Capacitor. The web files are bundled into the app, so users do not need to visit a hosted website to install it.

## Android APK

Run these commands on a computer or Android build environment with Node.js, Java, and Android Studio/SDK installed:

```sh
npm install
npm run native:add:android
npm run native:sync
npm run native:open:android
```

In Android Studio, build an APK from the generated `android` project. That APK can be shared directly and installed on Android devices.

## iPhone

iPhone does not allow direct installation from a random downloaded web package. No-host iPhone installation requires a native iOS app signed through Apple tooling:

- Xcode direct install to your own device
- TestFlight
- App Store
- Apple-approved enterprise or developer distribution

Use the separate `iphone/` folder for the iPhone native wrapper setup.
