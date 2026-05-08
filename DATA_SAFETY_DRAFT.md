# Google Play Data Safety Draft

Use this as a working draft only. Match the final answers to the exact release
configuration you submit.

## Data Collected Or Stored By The App

- Health and fitness: nutrition, water, weight, glucose, blood pressure,
  symptoms, mood, notes, journal entries.
- App activity: tasks, task completion history, reminders, settings.
- Personal info: optional Facebook user ID used only for app unlock when the
  user chooses Facebook login.
- User files: optional exported backup files created only when the user chooses
  export.

## Data Sharing

Default local-only use:

- Data is stored on device.
- No cloud AI data sharing occurs unless enabled by the user.

Optional cloud AI use:

- If the user allows internet sharing, enables Cloud AI features, and configures an
  AI service, the app may send health logs, journal text, mood/symptom notes,
  nutrition/vitals, and tasks to that configured service.

## Security Practices

- Data is encrypted in transit when sent to HTTPS AI services.
- Android screenshots and recent-app previews are blocked.
- Local app lock can use password and biometric/device authentication.
- Exported backups omit API keys, backend tokens, password hashes, salts, and
  biometric credential IDs.

## User Controls

- Users can disable cloud AI internet sharing in Settings.
- Users can delete individual journal entries.
- Users can delete all journal entries.
- Users can clear app lock settings, including Facebook login linkage.
- Users can request deletion of account linkage and associated data at
  `https://cmraaritgin26-svg.github.io/Habit-Tracker/data-deletion.html`.
- Users can export/import data.
