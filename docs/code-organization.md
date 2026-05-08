# Code Organization

The browser and native shells still load `app.js` as one classic script. To keep
runtime behavior stable, human-edited source now lives in smaller files under
`src/app-parts/`, then `scripts/build-app.js` concatenates those files into
`app.js`.

Edit these files by feature area:

- `00-bootstrap-dom-events.js`: constants, shared state, DOM references, startup, and event wiring.
- `10-tasks-coach.js`: task rendering, review cards, AI Coach, trend and safety scanning.
- `20-review-wellbeing-journal.js`: Review Today, symptoms, mood, journal, reminders, and app navigation.
- `30-charts-nutrition.js`: progress graph, nutrition/vitals, water cups, master chart, and history chart.
- `40-storage-settings-onboarding.js`: storage, settings, security, import/export, setup, and onboarding.
- `50-dictation-utilities.js`: disabled dictation feature code, parsers, AI extraction, and shared utilities.

Run `npm run build:app` after editing source parts, or run `npm run check` /
`npm run build:apk` and it will happen automatically.
