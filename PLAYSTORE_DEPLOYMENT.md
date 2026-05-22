# Play Store Deployment Checklist

This project is prepared to build an Android App Bundle for Google Play.

## Current App Identity

- Package name: `com.tasklensai.app`
- App name: `TaskLens AI`
- Version name: `1.0.24`
- Version code: `25`
- Target SDK: Android 15 / API 35
- Minimum SDK: API 23

## Build Commands

Check JavaScript and sync packaged assets:

```sh
npm run check
npm run sync:android-assets
```

Build the signed release AAB with the Craig Williams Play upload key already configured on this device:

```sh
npm run build:aab:play
```

Current signed AAB path:

```text
/sdcard/Download/TaskLensAI-v1.0.24-code25-craig-williams-play.aab
```

Verified signing certificate SHA1:

```text
78:13:14:0D:2E:1C:8D:82:39:AC:37:83:F2:5F:F8:FB:D3:1C:F7:31
```

## Play Console Sections To Complete

- App signing: enable Play App Signing and upload the signed AAB.
- Store listing: screenshots, icon, short description, full description.
- Privacy policy URL: `https://www.tasklensai.com/privacy-policy.html`.
- Data deletion URL: `https://www.tasklensai.com/data-deletion.html`.
- Data safety form: disclose task data, checklist data, selected user photos, app activity, optional AI processing, and local storage.
- Permissions declaration: internet, notifications if enabled, vibration, and camera/photo access used for user-selected checklist photos.
- Content rating.
- Target audience and ads: configure as not directed to children unless the product decision changes. Current recommendation is no ads.
- App access instructions: explain first-run setup and optional cloud AI.
- Brand launch steps: use `BRAND_LAUNCH_STEPS.md` to complete the Play Store work in order.

## Store Listing Draft

See `STORE_LISTING_DRAFT.md` for the current listing copy.

Short description:

```text
Turn photos and scattered thoughts into clear checklists.
```

Full description summary:

```text
TaskLens AI helps turn overwhelming tasks, messy spaces, and scattered thoughts into clear checklists. Start with a photo or brain dump, get practical next steps, organize them into Now, Next, and Later, and check items off as you go.
```

## Data Safety Notes

See `DATA_SAFETY_DRAFT.md` for a fuller working draft.

Use the actual release configuration when filling Play Console forms:

- Data is stored locally on the device by default.
- Optional cloud AI can send task names, notes, checklist context, selected photos, and on-device photo labels over the internet after the user allows it.
- Exported backups may contain task and checklist data. Users control when exports are created.
- The app should be submitted as an organization and productivity tool for tasks, photos, checklists, focus timers, and AI planning help.

## Pre-Submission Checks

- Install the release candidate on a test device.
- Verify first-run setup, settings, task creation, photo checklist creation, AI help, focus timer, reminders, and offline local-only use.
- Upload to internal testing first, install from Play on a real device, then promote to closed testing after the internal build passes.
- Verify all screenshots match the current UI.
- Verify the privacy policy matches the Data safety form and in-app AI wording.
