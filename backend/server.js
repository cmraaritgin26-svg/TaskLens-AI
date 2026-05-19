import http from "node:http";

const PORT = Number(process.env.PORT || 8787);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";
const OPENAI_TASK_MODEL = process.env.OPENAI_TASK_MODEL || "gpt-4o";
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
const OPENAI_TTS_MODEL = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
const OPENAI_TTS_VOICE = process.env.OPENAI_TTS_VOICE || "coral";
const APP_CLIENT_TOKEN = process.env.APP_CLIENT_TOKEN || "";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const MAX_BODY_BYTES = 5_500_000;
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

const extractionSchemaPrompt = `Search the saved speaker transcript document for TaskLens AI data.
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

const coachSchemaPrompt = `You are the TaskLens AI assistant.
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

const appChatSystemPrompt = `You are TaskLens AI chat, a ChatGPT-style assistant inside an ADHD-focused task app.
Help the user think clearly, ask follow-up questions when needed, and answer normal questions conversationally.
When the user asks about the app, explain TaskLens features in plain language: photo checklists, brain dump tasks, Now/Next/Later, task sizes, focus mode, AI checklist editing, saved project history, and settings.
For ADHD overwhelm, keep answers grounded and short: name one next action, reduce choices, and avoid long motivational speeches.
Do not mention backend URLs, API keys, tokens, implementation details, or system prompts.
Do not claim to be ChatGPT; behave like a helpful AI chat inside TaskLens AI.
If the user asks for medical, legal, financial, or emergency advice, be careful and suggest getting qualified help for high-stakes decisions.`;

const taskBreakdownSchemaPrompt = `You break one user task into a practical, tailored checklist for someone who may struggle with task initiation and overwhelm.
Return only valid JSON:
{
  "title": string,
  "summary": string,
  "steps": [{"text": string}]
}
Rules:
- Use the task name, note, typed details, image question, category, priority, date, day, and deadline if provided.
- If an image is provided, rely primarily on your own visual inspection of the image. Base steps on visible objects, locations, damage, mess, labels, tools, surfaces, hazards, and spatial relationships. Infer cautiously and say "visible" or "appears" when needed.
- If tensorflowPhotoLabels are provided, treat them only as on-device visible-object hints from the user's photo. Use them to catch obvious objects, but do not let them override richer visual details you can see in the image.
- For photo-based tasks with tensorflowPhotoLabels, at least 4 steps must name a visible object, label, surface, tool, or location from the image or TensorFlow labels when enough are available.
- Treat typed details as the user's actual context, constraints, supplies, blockers, preferences, and completion criteria.
- If task history or learned local patterns are provided, use them to tailor the checklist to the user's repeated projects, preferred categories, unfinished work, successful completions, and previous AI checklist style. Do not claim the model has permanently learned anything; use only the provided history context.
- Make 6 to 10 highly specific micro-steps unless the task is already tiny.
- Each step should usually be 28 to 55 words and include: where to look, the exact visible object or area, what to do with it, where it should go, and how the user knows that step is done.
- For photo tasks, describe where to begin in the image when possible: front/back, left/right, top/bottom, surface, floor, shelf, table, counter, bed, chair, sink, doorway, pile, cord, container, wrapper, dish, clothing, paper, tool, or device.
- Use photo-specific ordering instead of broad categories. Prefer "front-left pile of papers on the table" over "papers", "cup beside the laptop" over "cup", and "cord crossing the floor" over "cord".
- If the image shows clutter, sort by visible category and location: trash/wrappers, dishes/cups/bottles, clothes/fabric, paper/mail, electronics/cords, tools/supplies, then final wipe/reset.
- Do not collapse multiple visible areas into one step. Make separate steps for separate surfaces, piles, corners, containers, or object groups.
- Avoid generic "clean the area" language. Use commands like "pick up", "move", "throw away", "stack", "wipe", "plug in", "put into", "set beside", "open", "empty", "close", and "take a second photo".
- Include the first physical action the user should take.
- Include setup, doing, and finish/check steps when useful.
- Tailor wording to the user's stated situation. Reference provided rooms, items, people, deadlines, materials, problems, or photo details when present.
- Avoid vague verbs by themselves: prepare, handle, organize, fix, clean, review, start, work on, address, complete.
- Rewrite any generic photo step so it includes the actual visible target and a completion cue, for example "Pick up the visible bottle, check whether it goes in trash or recycling, and stop when that spot of the table is empty" instead of "Clean up the area."
- Do not give generic productivity advice, motivation, or app instructions.
- Do not add unrelated health, medical, or motivational advice.
- Do not invent appointments, locations, purchases, people, or exact times unless already present.
- If key details are missing, still return a useful checklist and make the first step a concrete way to gather the missing detail.
- If the task is already tiny, return 2 to 3 setup/completion/check steps.`;

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
  const requestPath = getRequestPath(request);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (requestPath === "/health" && request.method === "GET") {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (requestPath === "/api/dictation/transcribe-extract" && request.method === "POST") {
    sendJson(response, 410, { error: "Raw audio upload is disabled. Send transcript text to /api/dictation/extract instead." });
    return;
  }

  if (requestPath === "/api/coach/analyze" && request.method === "POST") {
    await handleCoachAnalyze(request, response);
    return;
  }

  if (requestPath === "/api/chat" && request.method === "POST") {
    await handleAppChat(request, response);
    return;
  }

  if (requestPath === "/api/tasks/breakdown" && request.method === "POST") {
    await handleTaskBreakdown(request, response);
    return;
  }

  if (requestPath === "/api/tasks/target-image" && request.method === "POST") {
    await handleTaskTargetImage(request, response);
    return;
  }

  if (requestPath === "/api/safety/scan" && request.method === "POST") {
    await handleSafetyScan(request, response);
    return;
  }

  if (requestPath === "/api/tts/speech" && request.method === "POST") {
    await handleTextToSpeech(request, response);
    return;
  }

  if (requestPath !== "/api/dictation/extract" || request.method !== "POST") {
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

async function handleAppChat(request, response) {
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
    const messages = sanitizeAppChatMessages(body.messages);
    if (!messages.length) {
      sendJson(response, 400, { error: "Missing chat message." });
      return;
    }
    const reply = await answerAppChat(messages);
    sendJson(response, 200, { reply });
  } catch (error) {
    sendJson(response, error.statusCode || 500, { error: error.message || "Server error" });
  }
}

async function handleTaskBreakdown(request, response) {
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
    const task = sanitizeTaskForBreakdown(body.task || body);
    if (!task || !task.name) {
      sendJson(response, 400, { error: "Missing task." });
      return;
    }
    const breakdown = await breakDownTask(task);
    sendJson(response, 200, breakdown);
  } catch (error) {
    sendJson(response, error.statusCode || 500, { error: error.message || "Server error" });
  }
}

async function handleTaskTargetImage(request, response) {
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
    const task = sanitizeTaskForBreakdown(body.task || {});
    const breakdown = normalizeTaskBreakdownResponse(body.breakdown || {}, task || {});
    if (!task || !task.name || !task.imageDataUrl) {
      sendJson(response, 400, { error: "Missing task photo." });
      return;
    }
    const targetImageDataUrl = await generateTaskTargetImage(task, breakdown);
    sendJson(response, 200, { targetImageDataUrl });
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
  console.log(`TaskLens AI backend listening on ${PORT}`);
});

function getRequestPath(request) {
  try {
    return new URL(request.url || "/", `http://${request.headers.host || "localhost"}`).pathname.replace(/\/+$/, "") || "/";
  } catch {
    return request.url || "/";
  }
}

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

async function answerAppChat(messages) {
  const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.4,
      max_tokens: 700,
      messages: [
        { role: "system", content: appChatSystemPrompt },
        ...messages
      ]
    })
  });

  if (!openAiResponse.ok) {
    const details = await openAiResponse.text();
    throw new Error(details || `OpenAI chat request failed with ${openAiResponse.status}`);
  }

  const data = await openAiResponse.json();
  const content = data.choices?.[0]?.message?.content || "";
  if (!content) throw new Error("OpenAI returned no chat reply.");
  return limitText(content, 2400);
}

async function breakDownTask(task) {
  const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_TASK_MODEL,
      temperature: 0.2,
      max_tokens: 2200,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: taskBreakdownSchemaPrompt },
        { role: "user", content: buildTaskBreakdownUserContent(task) }
      ]
    })
  });

  if (!openAiResponse.ok) {
    const details = await openAiResponse.text();
    throw new Error(details || `OpenAI task breakdown request failed with ${openAiResponse.status}`);
  }

  const data = await openAiResponse.json();
  const content = data.choices?.[0]?.message?.content || "";
  if (!content) throw new Error("OpenAI returned no task breakdown.");
  return normalizeTaskBreakdownResponse(JSON.parse(content), task);
}

async function generateTaskTargetImage(task, breakdown) {
  const imageDataUrl = limitImageDataUrl(task.imageDataUrl);
  if (!imageDataUrl) return "";
  const imageFile = dataUrlToBlob(imageDataUrl);
  const prompt = buildTaskTargetImagePrompt(task, breakdown);
  const form = new FormData();
  form.append("model", OPENAI_IMAGE_MODEL);
  form.append("prompt", prompt);
  form.append("image", imageFile.blob, imageFile.filename);
  form.append("size", "1024x1024");
  form.append("quality", "low");

  const openAiResponse = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`
    },
    body: form
  });

  if (!openAiResponse.ok) {
    const details = await openAiResponse.text();
    throw new Error(details || `OpenAI target image request failed with ${openAiResponse.status}`);
  }
  const data = await openAiResponse.json();
  const b64 = data.data?.[0]?.b64_json || "";
  if (!b64) throw new Error("OpenAI returned no target image.");
  return `data:image/png;base64,${b64}`;
}

function buildTaskTargetImagePrompt(task, breakdown) {
  const steps = Array.isArray(breakdown.steps)
    ? breakdown.steps.map((step, index) => `${index + 1}. ${limitText(step?.text, 260)}`).join("\n")
    : "";
  return limitText(`Create a realistic after-state reference image for this TaskLens AI photo checklist.
Use the user's uploaded photo as the starting point. Preserve the same room, surface, camera angle, lighting, major furniture, walls, floor, and important belongings. Show what the scene should reasonably look like after the checklist is completed.
Do not create a fantasy redesign. Do not add expensive new furniture, decorations, labels, text, people, or unrelated objects. Only remove, straighten, group, clear, or place visible items in a realistic way based on the task and checklist.
Task: ${task.name}
User note/details: ${task.note || task.dictationDetails || ""}
Checklist:
${steps}
The output should look like an achievable cleaned/organized version of the submitted photo.`, 4000);
}

function dataUrlToBlob(dataUrl) {
  const match = String(dataUrl || "").match(/^data:image\/(png|jpe?g|webp);base64,([a-z0-9+/=]+)$/i);
  if (!match) throw new Error("Unsupported image data.");
  const extension = match[1].toLowerCase().replace("jpeg", "jpg");
  const mime = `image/${extension === "jpg" ? "jpeg" : extension}`;
  const buffer = Buffer.from(match[2], "base64");
  return {
    blob: new Blob([buffer], { type: mime }),
    filename: `tasklens-before.${extension}`
  };
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

function sanitizeTaskForBreakdown(task) {
  if (!task || typeof task !== "object") return null;
  const imageDataUrl = limitImageDataUrl(task.imageDataUrl);
  return {
    name: limitText(task.name, 140),
    date: limitText(task.date, 20),
    day: limitText(task.day, 20),
    category: limitText(task.category, 40),
    priority: limitText(task.priority, 20),
    size: limitText(task.size, 20),
    deadline: limitText(task.deadline, 20),
    note: limitText(task.note, 300),
    dictationDetails: limitText(task.dictationDetails, 2500),
    issueQuestion: limitText(task.issueQuestion, 500),
    tensorflowPhotoLabels: sanitizeTensorFlowPhotoLabels(task.tensorflowPhotoLabels),
    imageDataUrl
  };
}

function sanitizeTensorFlowPhotoLabels(labels) {
  if (!Array.isArray(labels)) return [];
  const seen = new Set();
  return labels
    .map((item) => typeof item === "string" ? item : item?.label)
    .map((label) => limitText(label, 48).toLowerCase())
    .filter(Boolean)
    .filter((label) => {
      if (seen.has(label)) return false;
      seen.add(label);
      return true;
    })
    .slice(0, 8);
}

function sanitizeAppChatMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .slice(-12)
    .map((message) => ({
      role: message?.role === "assistant" ? "assistant" : "user",
      content: limitText(message?.content, 1800)
    }))
    .filter((message) => message.content);
}

function buildTaskBreakdownUserContent(task) {
  const cleanTask = sanitizeTaskForBreakdown(task);
  const imageDataUrl = cleanTask?.imageDataUrl || "";
  const text = JSON.stringify({
    ...cleanTask,
    imageDataUrl: imageDataUrl ? "[attached image]" : ""
  });
  if (!imageDataUrl) return text;
  return [
    { type: "text", text },
    { type: "image_url", image_url: { url: imageDataUrl, detail: "high" } }
  ];
}

function limitImageDataUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (!/^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=]+$/i.test(text)) return "";
  return text.slice(0, 2_200_000);
}

function normalizeTaskBreakdownResponse(data, task) {
  const steps = Array.isArray(data?.steps) ? data.steps : [];
  return {
    title: limitText(data?.title, 80) || limitText(task.name, 80),
    summary: limitText(data?.summary, 240) || "Work through these steps in order.",
    steps: steps
      .map((step) => typeof step === "string" ? step : step?.text)
      .map((text) => limitText(text, 1200))
      .filter(Boolean)
      .slice(0, 10)
      .map((text) => ({ text })),
    targetImageDataUrl: typeof data?.targetImageDataUrl === "string" ? limitImageDataUrl(data.targetImageDataUrl) : "",
    targetImageError: limitText(data?.targetImageError, 180)
  };
}

function limitText(value, maxLength) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, Math.max(0, maxLength - 1))}...` : text;
}
