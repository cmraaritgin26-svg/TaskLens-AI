# Play Store Deployment Checklist

This project is prepared to build an Android App Bundle for Google Play.

## Current App Identity

- Package name: `com.habithealth.tracker.android`
- App name: `Health & Task Tracker`
- Version name: `1.0.1`
- Version code: `2`
- Target SDK: Android 15 / API 35
- Minimum SDK: API 23

## Build Commands

Check JavaScript and sync packaged assets:

```sh
npm run check
npm run sync:android-assets
```

Build a debug APK:

```sh
npm run build:apk
```

Note: on this Termux device, the debug APK script uses a local API 34 fallback
because the installed ARM `aapt2` cannot link API 35 resources. This is only for
local testing. The Play release bundle command is configured for API 35.

Build the Play release bundle:

```sh
npm run play:bundle
```

The Play bundle path is:

```text
dist/play/HealthTaskTracker-release.aab
```

## Easiest Play Build Option

This repo includes a GitHub Actions workflow:

```text
.github/workflows/play-release.yml
```

Use it when building on this phone is blocked by ARM Android build tools:

1. Push this project to GitHub.
2. In the GitHub repo, open Settings > Secrets and variables > Actions.
3. Add the signing secrets listed below.
4. Open Actions > Build Play Release Bundle.
5. Click Run workflow.
6. Download the `health-task-tracker-play-bundle` artifact.

If signing secrets are missing, the workflow creates an unsigned verification
bundle only. Google Play requires the signed bundle.

## Upload Signing

Google Play requires a signed Android App Bundle. Configure an upload key before
building the Play bundle:

```sh
export ANDROID_UPLOAD_KEYSTORE=/absolute/path/upload-keystore.jks
export ANDROID_UPLOAD_KEYSTORE_PASSWORD=your-keystore-password
export ANDROID_UPLOAD_KEY_ALIAS=your-key-alias
export ANDROID_UPLOAD_KEY_PASSWORD=your-key-password
npm run play:bundle
```

For GitHub Actions, store the keystore as base64:

```sh
base64 -w 0 upload-keystore.jks
```

Then add these Actions secrets:

```text
ANDROID_UPLOAD_KEYSTORE_BASE64
ANDROID_UPLOAD_KEYSTORE_PASSWORD
ANDROID_UPLOAD_KEY_ALIAS
ANDROID_UPLOAD_KEY_PASSWORD
```

If those variables are not set, Gradle can build a release artifact for local
checking, but it is not ready to upload to Play.

## Play Console Sections To Complete

- App signing: enable Play App Signing and upload the signed AAB.
- Store listing: screenshots, icon, short description, full description.
- Privacy policy URL: required because the app handles health information and
  optional AI/cloud processing.
- Data safety form: disclose health and fitness data, journal text, app
  activity/tasks, diagnostics if any are added later, and whether data is shared
  with configured AI services.
- Health apps declaration: complete any health/medical related Play Console
  declarations that apply to tracking vitals, symptoms, mood, journal entries,
  nutrition, and wellness guidance.
- Permissions declaration: notifications, biometric/device unlock, vibration,
  internet, and full-screen/crisis alert behavior.
- Content rating.
- Target audience and ads: this app should be configured as not directed to
  children unless the product decision changes.
- App access instructions: explain any app lock/setup flow if reviewers need it.

## Store Listing Draft

See `STORE_LISTING_DRAFT.md` for a fuller draft.

Short description:

```text
Track tasks, nutrition, vitals, symptoms, mood, journal entries, and wellness trends.
```

Full description draft:

```text
Health & Task Tracker helps you keep daily tasks, nutrition, water, vitals, symptoms, mood, and journal entries in one private tracker. The app includes weekly task progress, history charting, journal logs, reminders, and optional AI-assisted summaries when you configure cloud AI.

The app is for personal tracking and wellness support. It does not diagnose, treat, or replace professional medical advice. If you may hurt yourself or are in immediate danger, call or text emergency services where available.
```

## Data Safety Notes

See `DATA_SAFETY_DRAFT.md` for a fuller working draft.

Use the actual release configuration when filling Play Console forms:

- Data is stored locally on the device by default.
- Optional cloud AI can send health information, journal text, mood/symptom
  notes, nutrition/vitals, and tasks over the internet
  after the user allows it in setup/settings and configures an AI service.
- Exported backups intentionally omit API keys, backend tokens, password hashes,
  salts, and biometric credential IDs.

## Pre-Submission Checks

- Install the release candidate on a test device.
- Verify first-run setup, AI internet-sharing acknowledgement, app lock,
  journal delete/delete all, crisis alert behavior, charting, and export/import.
- Upload to internal testing first, install from Play on a real device, then
  promote to closed testing after the internal build passes.
- Verify all screenshots match the current UI.
- Verify the privacy policy matches the Data safety form and in-app AI wording.
