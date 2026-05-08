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
3. Go to Release > Testing or Production.
4. Create a new release.
5. Upload `HealthTaskTracker-release.aab`.
6. Complete app signing, privacy, data safety, content rating, target audience, and store listing sections.
7. Submit for review.

Current Android package:
`com.habithealth.tracker.android`

Current version:
`1.0` / version code `1`

Current SDK target:
Android 15 / API 35

I could not post directly to Google Play from this device because publishing requires your Google Play Console account access and app signing setup.
