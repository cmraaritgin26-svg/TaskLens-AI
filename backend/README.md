# Health & Task Tracker AI Backend

This backend keeps your OpenAI API key out of the APK.

## Local Run

1. Copy `.env.example` to `.env`.
2. Fill in `OPENAI_API_KEY`.
3. Optional: set `APP_CLIENT_TOKEN` to a random secret and put the same token in the app Settings.
4. Start:

```sh
set -a
. ./.env
set +a
npm start
```

Health check:

```sh
curl http://localhost:8787/health
```

Text extraction endpoint retained for future use:

```sh
curl -X POST http://localhost:8787/api/dictation/extract \
  -H "Content-Type: application/json" \
  -H "X-App-Token: change-this-random-token" \
  -d '{"transcript":"my blood pressure is 120 over 80 and add task walk at 6 pm"}'
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
4. The expected public URL is:

```text
https://habit-tracker-1-lp0z.onrender.com
```

That URL is hardcoded as the app's default AI backend URL. If Render gives the service a different URL, update `DEFAULT_AI_BACKEND_URL` in `app.js` and `iphone/app.js`, then rebuild the APK.

If you create the Render web service manually instead of using the Blueprint, use these settings:

```text
Root Directory: backend
Build Command: npm install
Start Command: npm start
Health Check Path: /health
```

If Render does not let you set a root directory, use this from the repo root instead:

```text
Build Command: npm install
Start Command: npm start
```
