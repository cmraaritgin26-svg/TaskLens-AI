# TaskLens AI Backend

This backend keeps your OpenAI API key out of the APK.

## Local Run

1. Copy `.env.example` to `.env`.
2. Fill in `OPENAI_API_KEY`.
3. Optional: set `GOOGLE_CLOUD_VISION_API_KEY` to add OCR, object locations, and image labels before the checklist is created.
4. Optional: set `APP_CLIENT_TOKEN` to a random secret and put the same token in the app Settings.
5. Start:

```sh
set -a
. ./.env
set +a
npm start
```

Status check:

```sh
curl http://localhost:8787/status
```

Text extraction endpoint retained for future use:

```sh
curl -X POST http://localhost:8787/api/dictation/extract \
  -H "Content-Type: application/json" \
  -H "X-App-Token: change-this-random-token" \
  -d '{"transcript":"add task clear the desk at 6 pm"}'
```

Raw audio upload is disabled:

```sh
POST /api/dictation/transcribe-extract
```

That endpoint returns `410 Gone`. Do not send voice recordings to the backend.

## App Settings

In the app, set:

- `Cloud AI features`: on
- `AI backend URL`: your deployed backend URL, for example `https://your-domain.com`
- `AI backend token`: same value as `APP_CLIENT_TOKEN`, if you use one

OpenAI API keys stay on the backend. Do not put an OpenAI API key in the app.

## Public Deploy

This repo includes `render.yaml` for Render Blueprint deployment.

1. Push the repo to GitHub.
2. In Render, create a new Blueprint from the repo.
3. Set `OPENAI_API_KEY` when Render asks for environment variables.
4. Optional but recommended: set `GOOGLE_CLOUD_VISION_API_KEY` for OCR and object-location enrichment on photo checklists.
5. The expected public URL is:

```text
https://habit-tracker-1-lp0z.onrender.com
```

That URL is hardcoded as the app's default AI backend URL. If Render gives the service a different URL, update `DEFAULT_AI_BACKEND_URL` in `app.js` and `iphone/app.js`, then rebuild the APK.

If you create the Render web service manually instead of using the Blueprint, use these settings:

```text
Root Directory: backend
Build Command: npm install
Start Command: npm start
Status Check Path: /status
```

## Optional Google Vision Enrichment

When `GOOGLE_CLOUD_VISION_API_KEY` is configured, `/api/tasks/breakdown` runs a short Google Vision pass before OpenAI:

- OCR text from papers, boxes, labels, forms, mail, and notes
- localized objects with rough zones like top-left or bottom-right
- general image labels

The backend adds that context to the checklist prompt. If Google Vision is not configured, times out, or fails, the checklist still works with the normal OpenAI vision flow.

If Render does not let you set a root directory, use this from the repo root instead:

```text
Build Command: npm install
Start Command: npm start
```
