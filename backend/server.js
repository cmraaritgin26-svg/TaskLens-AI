import http from "node:http";

const PORT = Number(process.env.PORT || 8787);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const OPENAI_TTS_MODEL = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
const OPENAI_TTS_VOICE = process.env.OPENAI_TTS_VOICE || "coral";
const APP_CLIENT_TOKEN = process.env.APP_CLIENT_TOKEN || "";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const MAX_BODY_BYTES = 250_000;
const MAX_TTS_INPUT_CHARS = 1800;
const OPENAI_TTS_VOICES = new Set([
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "nova",
  "onyx",
  "sage",
  "shimmer",
  "verse",
  "marin",
  "cedar"
]);

const extractionSchemaPrompt = `Search the saved speaker transcript document for Health & Task Tracker data.
Return only valid JSON with these keys:
{
  "nutrition": {"calories": number|null, "carbs": number|null, "weight": number|null, "ketosisPhase": "Entering|Ketosis|Deep ketosis|Exiting|null", "glucose": number|null, "systolic": number|null, "diastolic": number|null, "water": number|null},
  "symptoms": [{"name": string, "severity": "Mild|Moderate|Severe", "note": string}],
  "mood": {"name": "Great|Good|Okay|Low|Stressed|Anxious", "intensity": "Mild|Moderate|Strong", "note": string} | null,
  "journal": {"text": string} | null,
  "tasks": [{"name": string, "day": "Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday", "time": "HH:MM|string", "deadline": "HH:MM|string", "note": string}],
  "missingDetails": [{"section": "nutrition|symptoms|mood|journal|tasks", "field": string, "question": string}]
}
Interpret common misspellings, speech-to-text mistakes, abbreviations, and slang, such as bp=blood pressure, sugar=glucose, cals=calories, carbs/carbz=carbs, lbs/pounds=weight, h2o=water, meh=Okay mood, wiped/exhausted=fatigue, panicky=Anxious, and to-do/remind me=task.
Use only information present in the transcript document. Do not invent numbers, symptoms, tasks, diagnoses, or journal text. Put values only in the fields they belong in: weight to weight, calories to calories, carbs to carbs, water to water, blood pressure to systolic/diastolic, symptoms to symptoms, mood to mood, and tasks to tasks.
Do not create a journal entry from general dictation. Set journal to null unless the speaker explicitly says this is a journal entry, says "note to self", or says to put/write/remember something in the journal.
Preserve original user wording only for explicit notes and explicit journal text. If a category is mentioned without enough detail, add a missingDetails question.`;

const coachSchemaPrompt = `You are the Health & Task Tracker AI Coach.
Analyze the user's app data for practical patterns across tasks, deadlines, nutrition, water, weight, blood pressure, glucose, ketosis, symptoms, mood, and journal entries.
Use full task details including names, notes, categories, priority, scheduled times, deadlines, completion history, missed deadlines, daily dashboard progress, and weekly progress. Cross-check task patterns against vitals, symptoms, mood, water, nutrition, ketosis, and journal text.
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

const safetySchemaPrompt = `You are a safety scanner for a private health journal app.
Scan journal entries, mood notes, symptoms, and local trend flags for self-harm, suicide risk, severe hopelessness, plans, means, goodbye/final-note language, or escalating distress.
Interpret misspellings, slang, euphemisms, and indirect wording.
Do not diagnose.
Return only valid JSON:
{"level":"none|concern|crisis","matchedText":"short excerpt or empty","reason":"brief reason","action":"brief next step"}
Use crisis for direct self-harm/suicide intent, plan, means, or imminent danger.
Use concern for severe hopelessness, burden language, not wanting to exist, or repeated escalating distress.`;

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
    sendJson(response, 410, { error: "Raw audio upload is disabled. Send transcript text to /api/dictation/extract instead." });
    return;
  }

  if (request.url === "/api/coach/analyze" && request.method === "POST") {
    await handleCoachAnalyze(request, response);
    return;
  }

  if (request.url === "/api/safety/scan" && request.method === "POST") {
    await handleSafetyScan(request, response);
    return;
  }

  if (request.url === "/api/tts/speech" && request.method === "POST") {
    await handleTextToSpeech(request, response);
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

  if (!isAuthorized(request)) {
    sendJson(response, 401, { error: "Unauthorized" });
    return;
  }

  try {
    const body = await readJsonBody(request);
    const transcript = limitText(body.transcript, 6000);
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

async function handleSafetyScan(request, response) {
  if (!OPENAI_API_KEY) {
    sendJson(response, 500, { error: "OPENAI_API_KEY is not configured." });
    return;
  }

  if (!isAuthorized(request)) {
    sendJson(response, 401, { error: "Unauthorized" });
    return;
  }

  try {
    const body = await readJsonBody(request);
    const snapshot = sanitizeSafetySnapshot(body.snapshot || body);
    if (!snapshot) {
      sendJson(response, 400, { error: "Missing safety snapshot." });
      return;
    }
    const result = await scanSafetySnapshot(snapshot);
    sendJson(response, 200, result);
  } catch (error) {
    sendJson(response, error.statusCode || 500, { error: error.message || "Server error" });
  }
}

async function handleCoachAnalyze(request, response) {
  if (!OPENAI_API_KEY) {
    sendJson(response, 500, { error: "OPENAI_API_KEY is not configured." });
    return;
  }

  if (!isAuthorized(request)) {
    sendJson(response, 401, { error: "Unauthorized" });
    return;
  }

  try {
    const body = await readJsonBody(request);
    const snapshot = sanitizeCoachSnapshot(body.snapshot || body);
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

async function handleTextToSpeech(request, response) {
  if (!OPENAI_API_KEY) {
    sendJson(response, 500, { error: "OPENAI_API_KEY is not configured." });
    return;
  }

  if (!isAuthorized(request)) {
    sendJson(response, 401, { error: "Unauthorized" });
    return;
  }

  try {
    const body = await readJsonBody(request);
    const text = limitText(body.text, MAX_TTS_INPUT_CHARS);
    if (!text) {
      sendJson(response, 400, { error: "Missing text." });
      return;
    }
    const audio = await synthesizeSpeech({
      text,
      model: limitText(body.model, 80) || OPENAI_TTS_MODEL,
      voice: normalizeTtsVoice(body.voice),
      instructions: limitText(body.instructions, 500) || "Speak in a warm, calm, supportive health coach tone."
    });
    response.writeHead(200, {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
      "Pragma": "no-cache"
    });
    response.end(Buffer.from(audio));
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
  response.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Pragma": "no-cache"
  });
  response.end(JSON.stringify(payload));
}

function isAuthorized(request) {
  return !APP_CLIENT_TOKEN || request.headers["x-app-token"] === APP_CLIENT_TOKEN;
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
        { role: "user", content: limitText(transcript, 6000) }
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
        { role: "user", content: JSON.stringify(sanitizeCoachSnapshot(snapshot)) }
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

async function scanSafetySnapshot(snapshot) {
  const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0,
      max_tokens: 260,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: safetySchemaPrompt },
        { role: "user", content: JSON.stringify(sanitizeSafetySnapshot(snapshot)) }
      ]
    })
  });

  if (!openAiResponse.ok) {
    const details = await openAiResponse.text();
    throw new Error(details || `OpenAI safety scan failed with ${openAiResponse.status}`);
  }

  const data = await openAiResponse.json();
  const content = data.choices?.[0]?.message?.content || "";
  if (!content) throw new Error("OpenAI returned no safety scan.");
  return JSON.parse(content);
}

async function synthesizeSpeech({ text, model, voice, instructions }) {
  const openAiResponse = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      voice,
      input: text,
      instructions,
      response_format: "mp3"
    })
  });

  if (!openAiResponse.ok) {
    const details = await openAiResponse.text();
    throw new Error(details || `OpenAI speech request failed with ${openAiResponse.status}`);
  }

  return openAiResponse.arrayBuffer();
}

function normalizeTtsVoice(value) {
  const voice = String(value || OPENAI_TTS_VOICE).trim().toLowerCase();
  return OPENAI_TTS_VOICES.has(voice) ? voice : OPENAI_TTS_VOICE;
}

function sanitizeCoachSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return null;
  return {
    today: snapshot.today,
    heightInches: snapshot.heightInches,
    waterGoal: snapshot.waterGoal,
    weeklyTaskProgress: snapshot.weeklyTaskProgress,
    todayDashboard: snapshot.todayDashboard,
    localInsights: Array.isArray(snapshot.localInsights) ? snapshot.localInsights.slice(0, 6) : [],
    tasks: Array.isArray(snapshot.tasks) ? snapshot.tasks.slice(0, 80).map((task) => ({
      ...task,
      note: limitText(task?.note, 180),
      completions: Array.isArray(task?.completions) ? task.completions.slice(-30) : [],
      completedRecently: Array.isArray(task?.completedRecently) ? task.completedRecently.slice(-30) : []
    })) : [],
    missedDeadlines: Array.isArray(snapshot.missedDeadlines) ? snapshot.missedDeadlines.slice(0, 30) : [],
    nutritionAndVitals: Array.isArray(snapshot.nutritionAndVitals) ? snapshot.nutritionAndVitals.slice(0, 30) : [],
    symptoms: Array.isArray(snapshot.symptoms) ? snapshot.symptoms.slice(0, 30).map((entry) => ({ ...entry, note: limitText(entry?.note, 180) })) : [],
    moods: Array.isArray(snapshot.moods) ? snapshot.moods.slice(0, 30).map((entry) => ({ ...entry, note: limitText(entry?.note, 180) })) : [],
    journal: Array.isArray(snapshot.journal) ? snapshot.journal.slice(0, 12).map((entry) => ({ ...entry, text: limitText(entry?.text, 500) })) : [],
    wholeAppTrendScan: Array.isArray(snapshot.wholeAppTrendScan) ? snapshot.wholeAppTrendScan.slice(0, 30) : []
  };
}

function sanitizeSafetySnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return null;
  return {
    scanReason: limitText(snapshot.scanReason, 80),
    latestJournalText: limitText(snapshot.latestJournalText, 1200),
    journalEntries: Array.isArray(snapshot.journalEntries) ? snapshot.journalEntries.slice(0, 40).map((entry) => ({
      date: entry?.date,
      text: limitText(entry?.text, 700)
    })) : [],
    moodEntries: Array.isArray(snapshot.moodEntries) ? snapshot.moodEntries.slice(0, 60).map((entry) => ({
      date: entry?.date,
      mood: entry?.mood,
      intensity: entry?.intensity,
      note: limitText(entry?.note, 300)
    })) : [],
    symptomEntries: Array.isArray(snapshot.symptomEntries) ? snapshot.symptomEntries.slice(0, 60).map((entry) => ({
      date: entry?.date,
      symptom: entry?.symptom,
      severity: entry?.severity,
      note: limitText(entry?.note, 300)
    })) : [],
    localTrendFlags: Array.isArray(snapshot.localTrendFlags) ? snapshot.localTrendFlags.slice(0, 30) : []
  };
}

function limitText(value, maxLength) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, Math.max(0, maxLength - 1))}...` : text;
}
