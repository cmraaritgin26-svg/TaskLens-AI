# Google Play Data Safety Draft

Use this as a working draft only. Match the final answers to the exact release configuration you submit.

## Data Collected Or Stored By The App

- Task data: task names, notes, checklist items, completion state, dates, priority, size, and local task history.
- User photos: optional photos selected by the user for AI checklist generation and progress comparison.
- App activity: task creation, checklist progress, reminders, settings, and usage needed to enforce the free photo checklist limit.
- User files: optional exported backup files created only when the user chooses export.

## Data Sharing

Default local-only use:

- Data is stored on device.
- No cloud AI data sharing occurs unless enabled by the user.

Optional cloud AI use:

- If the user allows internet sharing and enables AI checklist features, the app may send task names, notes, checklist context, selected photos, and on-device photo labels to the TaskLens AI service to generate checklist suggestions.

## Security Practices

- Data is encrypted in transit when sent to HTTPS AI services.
- Screenshots are allowed by the Android app.
- Exported backups may contain task and checklist data, so users should store them carefully.

## User Controls

- Users can disable AI checklist features in Settings.
- Users can delete tasks and checklist items in the app.
- Users can clear local app data through the in-app reset flow, Android app storage clearing, or uninstalling the app.
- Users can request deletion of account linkage and associated service-accessible data at `https://www.tasklensai.com/data-deletion.html`.

## Policy Positioning

TaskLens AI should be submitted as an organization and productivity app for tasks, photos, checklists, focus timers, and AI planning help.
