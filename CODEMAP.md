# Code Map

This app is a plain HTML/CSS/JavaScript Capacitor app. Most behavior lives in
`app.js`; the Android APK uses the copied files under `www/` and
`android/app/src/main/assets/public/`.

## Edit Locations

- `index.html`: app structure, dialogs, forms, and static controls.
- `styles.css`: visual styling and responsive layout.
- `app.js`: app state, rendering, storage, AI/dictation, notifications, dialogs.
- `iphone/`: mirrored iPhone source. Keep matching behavior changes in sync.
- `www/`: generated/copied web assets for Capacitor. Do not hand-edit unless
  debugging a packaged build.
- `android/app/src/main/assets/public/`: generated/copied Android web assets.
  Do not hand-edit unless debugging a packaged build.

## App.js Landmarks

1. Constants and localStorage keys at the top.
2. Pattern lists for safety scanning, mood/symptom trends, and dictation cleanup.
3. Mutable state and DOM references.
4. Event listeners.
5. Render functions and dialog builders.
6. Persistence helpers.
7. Settings, security, export/import.
8. Notifications, AI requests, dictation parsing, and utilities.

## Safe Build Workflow

Run these from the repository root:

```sh
npm run check
npm run sync:android-assets
cd android && ./gradlew assembleDebug
```

Or use the combined script:

```sh
npm run build:apk
```

On this Termux device, `npm run build:apk` uses an API 34/aapt2 fallback because
the local ARM aapt2 cannot link API 35 resources and Gradle's downloaded aapt2
is x86_64. The Play release bundle command remains configured for API 35.

For a Google Play release bundle:

```sh
npm run play:bundle
```

If upload signing is configured, this creates:

```text
dist/play/HealthTaskTracker-release.aab
```

The debug APK is created at:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## Maintenance Notes

- Keep user data behavior stable. Local storage keys are part of the app's data
  contract and should not be renamed without a migration.
- Avoid editing generated copies first. Make source edits in root files and
  mirror shared behavior into `iphone/`.
- After changing JavaScript, run `npm run check` before building.
- After changing root web files, sync assets before testing the APK.
