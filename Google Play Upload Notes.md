# Google Play Upload Notes

Release bundle:
`dist/play/HealthTaskTracker-release.aab`

Build it with:

```sh
npm run play:bundle
```

If this phone cannot build the release bundle because of ARM Android build
tools, use the GitHub Actions workflow:

```text
.github/workflows/play-release.yml
```

Use this file in Google Play Console:
1. Open Play Console.
2. Create or select the Health and Task Tracker app.
3. Go to Release > Testing.
4. Create an Internal testing release first.
5. Upload `HealthTaskTracker-release.aab`.
6. Complete app signing, privacy, data safety, content rating, target audience, and store listing sections.
7. Install the internal test build from Play and verify setup, app lock, journal, charts, tasks, AI settings, crisis alerts, export/import, and offline local-only use.
8. Promote to Closed testing, then Production after testing passes.

Current Android package:
`com.habithealth.tracker.android`

Current version:
`1.0.1` / version code `2`

Current SDK target:
Android 15 / API 35

I could not post directly to Google Play from this device because publishing requires your Google Play Console account access and app signing setup.
