import http from "node:http";

const PORT = Number(process.env.PORT || 8787);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const APP_CLIENT_TOKEN = process.env.APP_CLIENT_TOKEN || "";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const MAX_BODY_BYTES = 35_000_000;

const extractionSchemaPrompt = `Extract Health & Task Tracker data from user dictation.
Return only valid JSON with these keys:
{
  "nutrition": {"calories": number|null, "carbs": number|null, "weight": number|null, "ketosisPhase": "Entering|Ketosis|Deep ketosis|Exiting|null", "glucose": number|null, "systolic": number|null, "diastolic": number|null, "water": number|null},
  "symptoms": [{"name": string, "severity": "Mild|Moderate|Severe", "note": string}],
  "mood": {"name": "Great|Good|Okay|Low|Stressed|Anxious", "intensity": "Mild|Moderate|Strong", "note": string} | null,
  "journal": {"text": string} | null,
  "tasks": [{"name": string, "day": "Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday", "time": "HH:MM|string", "deadline": "HH:MM|string", "note": string}],
  "missingDetails": [{"section": "nutrition|symptoms|mood|journal|tasks", "field": string, "question": string}]
}
Do not invent numbers, symptoms, tasks, diagnoses, or journal text. If a category is mentioned without enough detail, add a missingDetails question.`;

const coachSchemaPrompt = `You are the Health & Task Tracker AI Coach.
Analyze the user's app data for practical patterns across tasks, deadlines, nutrition, water, weight, blood pressure, glucose, ketosis, symptoms, mood, and journal entries.
Return only valid JSON with these keys:
{
  "title": string,
  "body": string,
  "tone": "steady|action|health|care|neutral",
  "destination": "tasks|water|vitals|mood|symptoms|journal|settings|null",
  "actionLabel": string|null,
  "suggestedTask": string|null
}
Rules:
- Do not diagnose disease.
- Do not claim certainty.
- Mention urgent care only for emergency warning patterns.
- If journal or mood text suggests suicide or self-harm risk, tell the user to call/text 988 in the U.S. and call emergency services for immediate danger.
- Prefer one specific, useful next step.
- Keep body under 45 words.`;

const server = http.createServer(async (request, response) => {
  setCorsHeaders(response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.url === "/health" && request.method === "GET") {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.url === "/api/dictation/transcribe-extract" && request.method === "POST") {
    await handleTranscribeExtract(request, response);
    return;
  }

  if (request.url === "/api/coach/analyze" && request.method === "POST") {
    await handleCoachAnalyze(request, response);
    return;
  }

  if (request.url !== "/api/dictation/extract" || request.method !== "POST") {
    sendJson(response, 404, { error: "Not found" });
    return;
  }

  if (!OPENAI_API_KEY) {
    sendJson(response, 500, { error: "OPENAI_API_KEY is not configured." });
    return;
  }

  if (APP_CLIENT_TOKEN && request.headers["x-app-token"] !== APP_CLIENT_TOKEN) {
    sendJson(response, 401, { error: "Unauthorized" });
    return;
  }

  try {
    const body = await readJsonBody(request);
    const transcript = String(body.transcript || "").trim();
    if (!transcript) {
      sendJson(response, 400, { error: "Missing transcript." });
      return;
    }

    const extraction = await extractDictation(transcript);
    sendJson(response, 200, extraction);
  } catch (error) {
    sendJson(response, error.statusCode || 500, { error: error.message || "Server error" });
  }
});

async function handleTranscribeExtract(request, response) {
  if (!OPENAI_API_KEY) {
    sendJson(response, 500, { error: "OPENAI_API_KEY is not configured." });
    return;
  }

  if (APP_CLIENT_TOKEN && request.headers["x-app-token"] !== APP_CLIENT_TOKEN) {
    sendJson(response, 401, { error: "Unauthorized" });
    return;
  }

  try {
    const body = await readJsonBody(request);
    const audioBase64 = String(body.audioBase64 || "");
    const mimeType = String(body.mimeType || "audio/webm");
    if (!audioBase64) {
      sendJson(response, 400, { error: "Missing audioBase64." });
      return;
    }
    const transcript = await transcribeAudio(audioBase64, mimeType);
    const extraction = await extractDictation(transcript);
    sendJson(response, 200, { transcript, extraction });
  } catch (error) {
    sendJson(response, error.statusCode || 500, { error: error.message || "Server error" });
  }
}

async function handleCoachAnalyze(request, response) {
  if (!OPENAI_API_KEY) {
    sendJson(response, 500, { error: "OPENAI_API_KEY is not configured." });
    return;
  }

  if (APP_CLIENT_TOKEN && request.headers["x-app-token"] !== APP_CLIENT_TOKEN) {
    sendJson(response, 401, { error: "Unauthorized" });
    return;
  }

  try {
    const body = await readJsonBody(request);
    const snapshot = body.snapshot || body;
    if (!snapshot || typeof snapshot !== "object") {
      sendJson(response, 400, { error: "Missing snapshot." });
      return;
    }
    const insight = await analyzeCoachSnapshot(snapshot);
    sendJson(response, 200, insight);
  } catch (error) {
    sendJson(response, error.statusCode || 500, { error: error.message || "Server error" });
  }
}

server.listen(PORT, () => {
  console.log(`Health & Task Tracker AI backend listening on ${PORT}`);
});

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type,X-App-Token");
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json" });
  response.end(JSON.stringify(payload));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
        const error = new Error("Request body too large.");
        error.statusCode = 413;
        reject(error);
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        const error = new Error("Invalid JSON body.");
        error.statusCode = 400;
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

async function extractDictation(transcript) {
  const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: extractionSchemaPrompt },
        { role: "user", content: transcript }
      ]
    })
  });

  if (!openAiResponse.ok) {
    const details = await openAiResponse.text();
    throw new Error(details || `OpenAI request failed with ${openAiResponse.status}`);
  }

  const data = await openAiResponse.json();
  const content = data.choices?.[0]?.message?.content || "";
  if (!content) throw new Error("OpenAI returned no extraction.");
  return JSON.parse(content);
}

async function transcribeAudio(audioBase64, mimeType) {
  const buffer = Buffer.from(audioBase64, "base64");
  const extension = mimeType.includes("mp4") ? "mp4" : mimeType.includes("ogg") ? "ogg" : "webm";
  const form = new FormData();
  form.append("model", "gpt-4o-mini-transcribe");
  form.append("file", new Blob([buffer], { type: mimeType }), `dictation.${extension}`);

  const openAiResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`
    },
    body: form
  });

  if (!openAiResponse.ok) {
    const details = await openAiResponse.text();
    throw new Error(details || `OpenAI transcription failed with ${openAiResponse.status}`);
  }

  const data = await openAiResponse.json();
  const transcript = String(data.text || "").trim();
  if (!transcript) throw new Error("OpenAI returned no transcript.");
  return transcript;
}

async function analyzeCoachSnapshot(snapshot) {
  const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: coachSchemaPrompt },
        { role: "user", content: JSON.stringify(snapshot) }
      ]
    })
  });

  if (!openAiResponse.ok) {
    const details = await openAiResponse.text();
    throw new Error(details || `OpenAI coach request failed with ${openAiResponse.status}`);
  }

  const data = await openAiResponse.json();
  const content = data.choices?.[0]?.message?.content || "";
  if (!content) throw new Error("OpenAI returned no coach insight.");
  return JSON.parse(content);
}
