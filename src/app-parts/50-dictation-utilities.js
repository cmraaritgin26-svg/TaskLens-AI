function startHealthDictation(options = {}) {
  if (!DICTATION_FEATURE_ENABLED) return;
  if (dictationActive) {
    stopHealthDictation();
    return;
  }

  if (isNativeDictationAvailable()) {
    startNativeDictationFlow("Dictation was canceled or unavailable.", options);
    return;
  }
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    startLegacyHealthDictation(options);
    return;
  }
  startKeyboardVoiceTextFlow(options);
}

function startKeyboardVoiceTextFlow(options = {}) {
  if (!options.appendToReview) {
    pendingDictationExtraction = null;
    pendingDictationTranscript = "";
  }
  const typed = window.prompt(options.appendToReview ? "Dictate or type more. I will add it to what is already in the review window." : "Use the keyboard microphone or type what you want to log. I will show a review before saving it.", "");
  if (typed && typed.trim()) handleDictationTranscript(typed.trim(), options);
}

function startLegacyHealthDictation(options = {}) {
  if (isNativeDictationAvailable()) {
    startNativeDictationFlow("Dictation was canceled or unavailable.", options);
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    const typed = window.prompt("Live dictation is not available on this device. Type or paste the transcript document instead.", "");
    if (typed && typed.trim()) handleDictationTranscript(typed.trim(), options);
    return;
  }
  const recognition = new SpeechRecognition();
  activeWebRecognition = recognition;
  webDictationBuffer = "";
  webDictationPartial = "";
  clearWebDictationCommitTimer();
  webDictationStopping = false;
  dictationActive = true;
  recognition.lang = "en-US";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  dictateButton.classList.add("is-listening");
  setDictateButtonLabel("Stop dictation");
  webDictationCommitTimer = window.setInterval(commitWebDictationPartial, 8000);
  recognition.onresult = (event) => {
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const transcript = event.results[index]?.[0]?.transcript || "";
      if (event.results[index].isFinal && transcript.trim()) {
        webDictationBuffer = `${webDictationBuffer} ${transcript.trim()}`.trim();
        webDictationPartial = "";
      } else if (transcript.trim()) {
        webDictationPartial = transcript.trim();
      }
    }
  };
  recognition.onerror = () => {
    if (!webDictationStopping && dictationActive) {
      restartWebDictation();
    }
  };
  recognition.onend = () => {
    if (!webDictationStopping && dictationActive) {
      restartWebDictation();
      return;
    }
    dictationActive = false;
    activeWebRecognition = null;
    dictateButton.classList.remove("is-listening");
    setDictateButtonLabel("Dictate");
    clearWebDictationCommitTimer();
    commitWebDictationPartial();
    handleDictationTranscript(`${webDictationBuffer} ${webDictationPartial}`.trim(), options);
    webDictationBuffer = "";
    webDictationPartial = "";
  };
  try {
    recognition.start();
  } catch {
    dictationActive = false;
    activeWebRecognition = null;
    dictateButton.classList.remove("is-listening");
    setDictateButtonLabel("Dictate");
    clearWebDictationCommitTimer();
    const typed = window.prompt("Dictation could not start. Type what you want to log.", "");
    if (typed && typed.trim()) handleDictationTranscript(typed.trim(), options);
  }
}

function startNativeDictationFlow(fallbackMessage, options = {}) {
  nativeDictationStopRequested = false;
  clearNativeDictationStopTimer();
  dictationActive = true;
  dictateButton.classList.add("is-listening");
  setDictateButtonLabel("Stop dictation");
  startNativeDictation()
    .then((transcript) => {
      if (nativeDictationStopRequested && !String(transcript || "").trim()) return;
      handleDictationTranscript(transcript, options);
    })
    .catch(() => {
      if (nativeDictationStopRequested) return;
      const typed = window.prompt(`${fallbackMessage || "Dictation was canceled or unavailable."} Type what you want to log.`, "");
      if (typed && typed.trim()) handleDictationTranscript(typed.trim(), options);
    })
    .finally(() => {
      resetNativeDictationButtonState();
    });
}

function stopHealthDictation() {
  if (isNativeDictationAvailable() && typeof window.HealthTaskDictation.stop === "function") {
    nativeDictationStopRequested = true;
    setDictateButtonLabel("Saving dictation");
    try {
      window.HealthTaskDictation.stop();
    } catch {
      // The forced reset below still clears the UI if the native bridge cannot stop.
    }
    clearNativeDictationStopTimer();
    nativeDictationStopTimer = window.setTimeout(() => {
      if (!dictationActive) return;
      resetNativeDictationButtonState();
    }, 1200);
    return;
  }

  webDictationStopping = true;
  setDictateButtonLabel("Saving dictation");
  if (activeWebRecognition) {
    activeWebRecognition.stop();
  }
}

function commitWebDictationPartial() {
  const partial = webDictationPartial.trim();
  if (!partial) return;
  if (!webDictationBuffer.endsWith(partial) && !webDictationBuffer.includes(partial)) {
    webDictationBuffer = `${webDictationBuffer} ${partial}`.trim();
  }
  webDictationPartial = "";
}

function clearWebDictationCommitTimer() {
  if (webDictationCommitTimer) {
    window.clearInterval(webDictationCommitTimer);
    webDictationCommitTimer = null;
  }
}

function resetNativeDictationButtonState() {
  dictationActive = false;
  dictateButton.classList.remove("is-listening");
  setDictateButtonLabel("Dictate");
  clearNativeDictationStopTimer();
}

function clearNativeDictationStopTimer() {
  if (nativeDictationStopTimer) {
    window.clearTimeout(nativeDictationStopTimer);
    nativeDictationStopTimer = null;
  }
}

function setDictateButtonLabel(label) {
  if (!dictateButton) return;
  dictateButton.setAttribute("aria-label", label);
  dictateButton.title = label;
  if (dictationStatus) {
    const visible = !/^Dictate$/i.test(label);
    dictationStatus.hidden = !visible;
    dictationStatus.textContent = label;
  }
}

function getDataQualityScore() {
  const recentDates = new Set(getRecentDateKeys(7, 0));
  const signals = [
    habits.some((habit) => (habit.completions || []).some((dateKey) => recentDates.has(dateKey))),
    nutritionEntries.some((entry) => recentDates.has(entry.date) && hasVitalsData(entry)),
    nutritionEntries.some((entry) => recentDates.has(entry.date) && Number.isFinite(entry.water) && entry.water > 0),
    moodEntries.some((entry) => recentDates.has(entry.date)),
    symptomEntries.some((entry) => recentDates.has(entry.date)),
    journalEntries.some((entry) => recentDates.has(entry.date)),
    Number(appSettings.heightInches) > 0
  ];
  return Math.round((signals.filter(Boolean).length / signals.length) * 100);
}

function maybePromptBackupReminder() {
  if (!habits.length && !nutritionEntries.length && !journalEntries.length && !moodEntries.length && !symptomEntries.length) return;
  const lastPrompt = localStorage.getItem(backupReminderStoreKey);
  if (!lastPrompt) {
    localStorage.setItem(backupReminderStoreKey, today);
    return;
  }
  if (daysBetween(lastPrompt, today) < 7) return;
  localStorage.setItem(backupReminderStoreKey, today);
  window.setTimeout(() => {
    if (window.confirm("Export a backup of your Health & Task Tracker data?")) {
      exportAppData();
    }
  }, 800);
}

function restartWebDictation() {
  if (!activeWebRecognition || !dictationActive) return;
  window.setTimeout(() => {
    if (!activeWebRecognition || !dictationActive || webDictationStopping) return;
    try {
      activeWebRecognition.start();
    } catch {
      webDictationStopping = true;
      activeWebRecognition.stop();
    }
  }, 350);
}

function isNativeDictationAvailable() {
  return Boolean(window.HealthTaskDictation && typeof window.HealthTaskDictation.start === "function");
}

function handleDictationTranscript(transcript, options = {}) {
  const text = String(transcript || "").trim();
  if (!text) return;
  if (!options.appendToReview && onboardingModal && !onboardingModal.hidden) {
    processOnboardingStepDictation(text);
    return;
  }
  if (options.appendToReview) {
    appendDictationToReview(text);
    return;
  }
  processReviewedHealthDictation(text);
}

function appendDictationToReview(text) {
  const existing = dictationReviewText.value.trim();
  const addition = String(text || "").trim();
  if (!addition) return;
  const combined = existing ? `${existing} ${addition}` : addition;
  pendingDictationExtraction = null;
  pendingDictationTranscript = combined;
  pendingParsedDictationResult = null;
  pendingParsedDictationDocument = null;
  dictationReviewStepIndex = 0;
  dictationReviewField.hidden = false;
  dictationFieldReview.hidden = true;
  dictationFieldReview.replaceChildren();
  dictationReviewManual.hidden = false;
  dictationReviewChange.hidden = true;
  dictationReviewSave.textContent = "Confirm & Save";
  dictationReviewSave.disabled = false;
  dictationReviewText.value = combined;
  dictationReviewMessage.textContent = "Added to the transcript. Review it, then Confirm & Save.";
  dictationReviewModal.hidden = false;
  focusDictationReviewText();
}

function startNativeDictation() {
  return new Promise((resolve, reject) => {
    const callbackId = createSecurityToken(12);
    const timeoutId = window.setTimeout(() => {
      const callback = window.__nativeDictationCallbacks?.[callbackId];
      if (!callback) return;
      delete window.__nativeDictationCallbacks[callbackId];
      try {
        window.HealthTaskDictation.stop();
      } catch {
        // Ignore native cleanup errors after a timeout.
      }
      callback.reject(new Error("Dictation timed out."));
    }, 1800000);
    window.__nativeDictationCallbacks = window.__nativeDictationCallbacks || {};
    window.__nativeDictationCallbacks[callbackId] = { resolve, reject, timeoutId };
    window.__nativeDictationResult = (id, success, transcript, message) => {
      const callback = window.__nativeDictationCallbacks?.[id];
      if (!callback) return;
      delete window.__nativeDictationCallbacks[id];
      window.clearTimeout(callback.timeoutId);
      if (success) callback.resolve(transcript || "");
      else callback.reject(new Error(message || "Dictation failed."));
    };
    window.HealthTaskDictation.start(callbackId);
  });
}

function processReviewedHealthDictation(transcript) {
  const heard = String(transcript || "").trim();
  if (!heard) {
    handleEmptyDictation();
    return;
  }

  processHealthDictation(heard);
}

function showDictationReview(text, message, extraction = null) {
  const title = document.querySelector("#dictationReviewTitle");
  if (title) title.textContent = "Review what I heard";
  pendingDictationExtraction = extraction;
  pendingDictationTranscript = String(text || "").trim();
  pendingParsedDictationResult = null;
  pendingParsedDictationDocument = null;
  dictationReviewField.hidden = false;
  dictationFieldReview.hidden = true;
  dictationFieldReview.replaceChildren();
  dictationReviewManual.hidden = false;
  dictationReviewChange.hidden = true;
  dictationReviewChange.textContent = "Change";
  dictationReviewSave.textContent = "Confirm & Save";
  dictationReviewSave.disabled = false;
  dictationReviewText.value = text || "";
  dictationReviewMessage.textContent = message || "";
  dictationReviewModal.hidden = false;
  focusDictationReviewText();
  window.setTimeout(() => {
    focusDictationReviewText();
  }, 50);
}

function focusDictationReviewText() {
  if (dictationReviewField.hidden) return;
  dictationReviewText.focus({ preventScroll: false });
  dictationReviewText.setSelectionRange(dictationReviewText.value.length, dictationReviewText.value.length);
  if (window.HealthTaskKeyboard && typeof window.HealthTaskKeyboard.show === "function") {
    window.HealthTaskKeyboard.show();
  }
}

function closeDictationReview() {
  const title = document.querySelector("#dictationReviewTitle");
  if (title) title.textContent = "Review what I heard";
  dictationReviewModal.hidden = true;
  dictationReviewMessage.textContent = "";
  dictationReviewText.value = "";
  pendingDictationExtraction = null;
  pendingDictationTranscript = "";
  pendingParsedDictationResult = null;
  pendingParsedDictationDocument = null;
  dictationReviewStepIndex = 0;
  dictationReviewSave.disabled = false;
  dictationReviewField.hidden = false;
  dictationFieldReview.hidden = true;
  dictationFieldReview.replaceChildren();
  dictationReviewManual.hidden = false;
  dictationReviewChange.hidden = true;
  dictationReviewChange.textContent = "Change";
  dictationReviewSave.textContent = "Confirm & Save";
}

async function saveReviewedDictation() {
  if (pendingParsedDictationResult) {
    applyDictationFullReview();
    commitParsedHealthDictation();
    return;
  }
  const reviewed = dictationReviewText.value.trim();
  if (!reviewed) {
    dictationReviewMessage.textContent = "Type or dictate something before saving.";
    dictationReviewText.focus();
    return;
  }
  dictationReviewMessage.textContent = isAiDictationEnabled() ? "AI is reading the dictation..." : "Reading the dictation...";
  dictationReviewSave.disabled = true;
  const savedExtraction = pendingDictationExtraction;
  const savedTranscript = pendingDictationTranscript;
  try {
    await processHealthDictation(reviewed, savedExtraction && reviewed === savedTranscript ? savedExtraction : null);
  } finally {
    dictationReviewSave.disabled = false;
  }
}

function changeReviewedDictation() {
  if (pendingParsedDictationResult && dictationReviewStepIndex > 0) {
    dictationReviewStepIndex -= 1;
    renderDictationReviewStep();
    return;
  }
  const text = pendingParsedDictationDocument?.text || dictationReviewText.value || pendingDictationTranscript;
  showDictationReview(text, "Change the transcript, then Save to analyze it again.");
}

function handleEmptyDictation() {
  showToast("I did not catch any words. Try Dictate again.");
}

function handleCanceledDictationReview() {
  showToast("Dictation was not saved.");
}

async function processHealthDictation(text, extraction = null) {
  const documentEntry = saveDictationDocument(text, "speaker", extraction);
  await processDictationDocument(documentEntry);
}

async function processDictationDocument(documentEntry) {
  const result = await parseHealthDictationDocument(documentEntry);
  await processParsedHealthDictation(result, documentEntry);
}

async function parseHealthDictationDocument(documentEntry) {
  const documentText = getDictationDocumentSearchText(documentEntry);
  if (documentEntry.extraction) {
    return normalizeAiDictationResult(documentEntry.extraction, documentText);
  }
  return parseHealthDictation(documentText);
}

function getDictationDocumentSearchText(documentEntry) {
  return String(documentEntry.text || "").trim();
}

async function processParsedHealthDictation(result, documentEntry) {
  const text = typeof documentEntry === "string" ? documentEntry : documentEntry.text || "";
  result = sanitizeDictationResultForTranscript(result, text);
  if (!hasDictationResult(result)) {
    handleUnclearDictation(text);
    return;
  }
  pendingParsedDictationResult = result;
  pendingParsedDictationDocument = typeof documentEntry === "string" ? { text: documentEntry } : documentEntry;
  showParsedDictationReview(result);
}

function commitParsedHealthDictation(resultToCommit = pendingParsedDictationResult) {
  const transcript = pendingParsedDictationDocument?.text || "";
  const result = sanitizeDictationResultForTranscript(resultToCommit, transcript);
  if (!result || !hasDictationResult(result)) {
    dictationReviewMessage.textContent = "There is no field data ready to save. Re-dictate or change the transcript.";
    showToast("No field data found. Try dictating again.");
    return;
  }
  populateFieldsFromDictationResult(result);
  if (result.nutrition) saveDictatedNutrition(result.nutrition);
  if (result.symptom) saveDictatedSymptom(result.symptom);
  if (Array.isArray(result.symptoms)) result.symptoms.forEach(saveDictatedSymptom);
  if (result.mood) saveDictatedMood(result.mood);
  if (result.journal) saveDictatedJournal(result.journal);
  if (result.task) saveDictatedTask(result.task);
  if (Array.isArray(result.tasks)) result.tasks.forEach(saveDictatedTask);
  render();
  renderNutrition();
  renderGraph();
  renderSymptoms();
  renderSymptomHistory();
  renderMoods();
  renderMoodHistory();
  renderJournal();
  scheduleSmartCoachRender();
  maybeSendWellbeingTrendNotification("dictation");
  closeDictationReview();
  showDictationLastSaved();
  showToast(getDictationSummary(result));
}

function showDictationLastSaved(date = new Date()) {
  if (!dictationStatus) return;
  dictationStatus.hidden = false;
  dictationStatus.textContent = `Last saved ${formatClockTime(date)}`;
}

function showParsedDictationReview(result) {
  dictationReviewStepIndex = 0;
  dictationReviewField.hidden = true;
  dictationFieldReview.hidden = false;
  dictationReviewManual.hidden = true;
  dictationReviewChange.hidden = false;
  dictationReviewModal.hidden = false;
  renderDictationFullReview();
}

function renderDictationFullReview() {
  const title = document.querySelector("#dictationReviewTitle");
  if (title) title.textContent = "Review Dictation";
  dictationFieldReview.replaceChildren(buildDictationFullReviewForm());
  dictationReviewChange.textContent = "Change transcript";
  dictationReviewSave.textContent = "Confirm & Save";
  dictationReviewMessage.textContent = "Review the AI-filled fields, then Confirm & Save.";
  dictationReviewSave.focus({ preventScroll: false });
}

function buildDictationFullReviewForm() {
  const form = document.createElement("form");
  form.className = "dictation-step-form dictation-full-review-form";
  form.innerHTML = getDictationReviewSteps().map((step) => `
    <div class="dictation-review-section">
      <h3>${escapeHtml(step.title.replace(/^Review\s+/i, ""))}</h3>
      ${step.fields}
    </div>
  `).join("");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    applyDictationFullReview();
    commitParsedHealthDictation();
  });
  return form;
}

function applyDictationFullReview() {
  const form = dictationFieldReview.querySelector("form");
  if (!form) return;
  const data = new FormData(form);
  getDictationReviewSteps().forEach((step) => step.apply(data));
}

function renderDictationReviewStep() {
  const steps = getDictationReviewSteps();
  const step = steps[dictationReviewStepIndex];
  if (!step) {
    commitParsedHealthDictation();
    return;
  }
  const title = document.querySelector("#dictationReviewTitle");
  if (title) title.textContent = step.title;
  dictationFieldReview.replaceChildren(buildDictationReviewStepForm(step));
  dictationReviewChange.textContent = dictationReviewStepIndex > 0 ? "Back" : "Change transcript";
  dictationReviewSave.textContent = dictationReviewStepIndex >= steps.length - 1 ? "Confirm & Save" : "Next";
  dictationReviewMessage.textContent = `Review ${dictationReviewStepIndex + 1} of ${steps.length}.`;
  dictationReviewSave.focus({ preventScroll: false });
}

function advanceDictationReviewStep() {
  const steps = getDictationReviewSteps();
  const step = steps[dictationReviewStepIndex];
  if (step) step.apply(new FormData(dictationFieldReview.querySelector("form")));
  if (dictationReviewStepIndex >= steps.length - 1) {
    commitParsedHealthDictation();
    return;
  }
  dictationReviewStepIndex += 1;
  renderDictationReviewStep();
}

function buildDictationReviewStepForm(step) {
  const form = document.createElement("form");
  form.className = "dictation-step-form";
  form.innerHTML = step.fields;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    advanceDictationReviewStep();
  });
  return form;
}

function getDictationReviewSteps() {
  const result = pendingParsedDictationResult || {};
  const nutrition = result.nutrition || {};
  const symptoms = getDictationSymptoms(result);
  const mood = result.mood || {};
  const tasks = getDictationTasks(result);
  const steps = [
    {
      title: "Review Nutrition",
      fields: `
        ${reviewInput("calories", "Calories", nutrition.calories, "number")}
        ${reviewInput("carbs", "Carbs", nutrition.carbs, "number")}
        ${reviewInput("weight", "Weight", nutrition.weight, "number")}
        ${reviewSelect("ketosisPhase", "Ketosis phase", nutrition.ketosisPhase, ["", "Entering", "Ketosis", "Deep ketosis", "Exiting"])}
        ${reviewInput("water", "Water oz", nutrition.water, "number")}
      `,
      apply: (data) => {
        result.nutrition = result.nutrition || {};
        ["calories", "carbs", "weight", "water"].forEach((key) => setOptionalNumber(result.nutrition, key, data.get(key)));
        result.nutrition.ketosisPhase = String(data.get("ketosisPhase") || "") || null;
        if (!Object.values(result.nutrition).some(hasDictationReviewValue)) result.nutrition = null;
      }
    },
    {
      title: "Review Vitals",
      fields: `
        ${reviewInput("glucose", "Glucose", nutrition.glucose, "number")}
        ${reviewInput("systolic", "Systolic BP", nutrition.systolic, "number")}
        ${reviewInput("diastolic", "Diastolic BP", nutrition.diastolic, "number")}
      `,
      apply: (data) => {
        result.nutrition = result.nutrition || {};
        ["glucose", "systolic", "diastolic"].forEach((key) => setOptionalNumber(result.nutrition, key, data.get(key)));
        if (!Object.values(result.nutrition).some(hasDictationReviewValue)) result.nutrition = null;
      }
    },
    {
      title: "Review Symptoms",
      fields: buildSymptomsReviewFields(symptoms),
      apply: (data) => setDictationSymptoms(result, readSymptomsReviewFields(data, symptoms.length || 1))
    },
    {
      title: "Review Mood",
      fields: `
        ${reviewSelect("moodName", "Mood", mood.name, ["", "Great", "Good", "Okay", "Low", "Stressed", "Anxious"])}
        ${reviewSelect("moodIntensity", "Intensity", mood.intensity, ["", "Mild", "Moderate", "Strong"])}
        ${reviewTextarea("moodNote", "Notes", mood.note)}
      `,
      apply: (data) => {
        const name = String(data.get("moodName") || "").trim();
        result.mood = name ? {
          name,
          intensity: String(data.get("moodIntensity") || "Moderate"),
          note: String(data.get("moodNote") || "").trim()
        } : null;
      }
    },
    {
      title: "Review Journal",
      fields: reviewTextarea("journalText", "Journal entry", result.journal?.text, 5),
      apply: (data) => {
        const text = String(data.get("journalText") || "").trim();
        result.journal = text ? { text } : null;
      }
    },
    {
      title: "Review Tasks",
      fields: buildTasksReviewFields(tasks),
      apply: (data) => setDictationTasks(result, readTasksReviewFields(data, tasks.length || 1))
    }
  ];
  if (!hasExplicitJournalIntent(pendingParsedDictationDocument?.text || "")) {
    return steps.filter((step) => step.title !== "Review Journal");
  }
  return steps;
}

function reviewInput(name, label, value, type = "text") {
  return `<label class="field"><span>${escapeHtml(label)}</span><input name="${escapeHtml(name)}" type="${type}" value="${escapeHtml(value ?? "")}"></label>`;
}

function reviewTextarea(name, label, value, rows = 3) {
  return `<label class="field onboarding-wide"><span>${escapeHtml(label)}</span><textarea name="${escapeHtml(name)}" rows="${rows}">${escapeHtml(value ?? "")}</textarea></label>`;
}

function reviewSelect(name, label, value, options) {
  return `<label class="field"><span>${escapeHtml(label)}</span><select name="${escapeHtml(name)}">${options.map((option) => `<option value="${escapeHtml(option)}"${String(value || "") === option ? " selected" : ""}>${escapeHtml(option)}</option>`).join("")}</select></label>`;
}

function buildSymptomsReviewFields(symptoms) {
  const entries = symptoms.length ? symptoms : [{}];
  return entries.map((symptom, index) => `
    <div class="dictation-review-section">
      <h3>Symptom ${index + 1}</h3>
      ${reviewInput(`symptomName${index}`, "Symptom", symptom.name)}
      ${reviewSelect(`symptomSeverity${index}`, "Severity", symptom.severity, ["", "Mild", "Moderate", "Severe"])}
      ${reviewTextarea(`symptomNote${index}`, "Notes", symptom.note)}
    </div>
  `).join("");
}

function buildTasksReviewFields(tasks) {
  const entries = tasks.length ? tasks : [{}];
  return entries.map((task, index) => `
    <div class="dictation-review-section">
      <h3>Task ${index + 1}</h3>
      ${reviewInput(`taskName${index}`, "Task", task.name)}
      ${reviewInput(`taskDate${index}`, "Date", task.date || today, "date")}
      ${reviewInput(`taskDeadline${index}`, "Deadline", task.deadline, "time")}
      ${reviewTextarea(`taskNote${index}`, "Notes", task.note)}
    </div>
  `).join("");
}

function getDictationSymptoms(result) {
  return [result.symptom, ...(Array.isArray(result.symptoms) ? result.symptoms : [])].filter(Boolean);
}

function setDictationSymptoms(result, symptoms) {
  result.symptom = symptoms[0] || null;
  result.symptoms = symptoms.slice(1);
}

function readSymptomsReviewFields(data, count) {
  return Array.from({ length: count }, (_, index) => {
    const name = String(data.get(`symptomName${index}`) || "").trim();
    return name ? {
      name,
      severity: String(data.get(`symptomSeverity${index}`) || "Mild"),
      note: String(data.get(`symptomNote${index}`) || "").trim()
    } : null;
  }).filter(Boolean);
}

function getDictationTasks(result) {
  return [result.task, ...(Array.isArray(result.tasks) ? result.tasks : [])].filter(Boolean);
}

function setDictationTasks(result, tasks) {
  result.task = tasks[0] || null;
  result.tasks = tasks.slice(1);
}

function readTasksReviewFields(data, count) {
  return Array.from({ length: count }, (_, index) => {
    const name = String(data.get(`taskName${index}`) || "").trim();
    const date = normalizeTaskDate(data.get(`taskDate${index}`)) || today;
    return name ? {
      name,
      date,
      day: weekDays[parseDateKey(date).getDay()],
      deadline: normalizeTaskTime(String(data.get(`taskDeadline${index}`) || "")),
      note: String(data.get(`taskNote${index}`) || "").trim()
    } : null;
  }).filter(Boolean);
}

function setOptionalNumber(target, key, value) {
  const parsed = Number.parseFloat(value);
  if (Number.isFinite(parsed)) target[key] = parsed;
  else delete target[key];
}

function buildDictationFieldReview(result) {
  const review = document.createElement("div");
  review.className = "dictation-review-sections";
  review.appendChild(buildDictationReviewSection("Symptoms", buildSymptomReviewRows(result)));
  review.appendChild(buildDictationReviewSection("Nutrition", buildNutritionReviewRows(result)));
  review.appendChild(buildDictationReviewSection("Vitals", buildVitalsReviewRows(result)));
  review.appendChild(buildDictationReviewSection("Mood", result.mood ? [
    ["Mood", result.mood.name],
    ["Intensity", result.mood.intensity],
    ["Note", result.mood.note]
  ] : []));
  review.appendChild(buildDictationReviewSection("Journal", result.journal ? [["Entry", result.journal.text]] : []));
  review.appendChild(buildDictationReviewSection("Tasks", buildTaskReviewRows(result)));
  return review;
}

function buildNutritionReviewRows(result) {
  const nutrition = result.nutrition || {};
  return [
    ["Calories", nutrition.calories],
    ["Carbs", nutrition.carbs],
    ["Weight", nutrition.weight],
    ["Ketosis", nutrition.ketosisPhase],
    ["Water", Number.isFinite(nutrition.water) ? `${nutrition.water} oz` : nutrition.water]
  ];
}

function buildVitalsReviewRows(result) {
  const nutrition = result.nutrition || {};
  return [
    ["Glucose", nutrition.glucose],
    ["Blood pressure", Number.isFinite(nutrition.systolic) && Number.isFinite(nutrition.diastolic) ? `${nutrition.systolic}/${nutrition.diastolic}` : ""]
  ];
}

function buildSymptomReviewRows(result) {
  const symptoms = [result.symptom, ...(Array.isArray(result.symptoms) ? result.symptoms : [])].filter(Boolean);
  return symptoms.flatMap((symptom, index) => [
    [`Symptom ${index + 1}`, symptom.name],
    [`Severity ${index + 1}`, symptom.severity],
    [`Note ${index + 1}`, symptom.note]
  ]);
}

function buildTaskReviewRows(result) {
  const tasks = [result.task, ...(Array.isArray(result.tasks) ? result.tasks : [])].filter(Boolean);
  return tasks.flatMap((task, index) => [
    [`Task ${index + 1}`, task.name],
    [`Day ${index + 1}`, task.day],
    [`Deadline ${index + 1}`, task.deadline],
    [`Note ${index + 1}`, task.note]
  ]);
}

function buildDictationReviewSection(title, rows) {
  const section = document.createElement("section");
  section.className = "dictation-review-section";
  const heading = document.createElement("h3");
  heading.textContent = title;
  section.appendChild(heading);
  const visibleRows = rows.filter(([, value]) => hasDictationReviewValue(value));
  if (!visibleRows.length) {
    const empty = document.createElement("p");
    empty.className = "dictation-review-empty";
    empty.textContent = "Nothing detected";
    section.appendChild(empty);
    return section;
  }
  visibleRows.forEach(([label, value]) => {
    const row = document.createElement("div");
    row.className = "dictation-review-row";
    const labelEl = document.createElement("span");
    labelEl.textContent = label;
    const valueEl = document.createElement("strong");
    valueEl.textContent = formatDictationReviewValue(value);
    row.append(labelEl, valueEl);
    section.appendChild(row);
  });
  return section;
}

function hasDictationReviewValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function formatDictationReviewValue(value) {
  return hasDictationReviewValue(value) ? String(value).trim() : "--";
}

function populateFieldsFromDictationResult(result) {
  if (result.nutrition) {
    nutritionDate.value = today;
    if (Number.isFinite(result.nutrition.calories)) calories.value = String(result.nutrition.calories);
    if (Number.isFinite(result.nutrition.carbs)) carbs.value = String(result.nutrition.carbs);
    if (Number.isFinite(result.nutrition.weight)) weight.value = String(result.nutrition.weight);
    if (result.nutrition.ketosisPhase) ketosisPhase.value = result.nutrition.ketosisPhase;
    if (Number.isFinite(result.nutrition.glucose)) glucose.value = String(result.nutrition.glucose);
    if (Number.isFinite(result.nutrition.systolic)) systolic.value = String(result.nutrition.systolic);
    if (Number.isFinite(result.nutrition.diastolic)) diastolic.value = String(result.nutrition.diastolic);
    if (Number.isFinite(result.nutrition.water)) water.value = String(result.nutrition.water);
  }

  const symptom = result.symptom || (Array.isArray(result.symptoms) ? result.symptoms[0] : null);
  if (symptom) {
    symptomDate.value = today;
    symptomName.value = symptom.name || "";
    symptomSeverity.value = symptom.severity || "Mild";
    symptomNote.value = symptom.note || "";
  }

  if (result.mood) {
    moodDate.value = today;
    moodName.value = result.mood.name || "Okay";
    moodIntensity.value = result.mood.intensity || "Moderate";
    moodNote.value = result.mood.note || "";
  }

  if (result.journal) {
    journalDate.value = today;
    journalEntry.value = result.journal.text || "";
    updateJournalEntryState();
  }

  const task = result.task || (Array.isArray(result.tasks) ? result.tasks[0] : null);
  if (task) {
    habitName.value = task.name || "";
    if (taskDate) taskDate.value = normalizeTaskDate(task.date) || today;
    habitDeadline.value = normalizeTaskTime(task.deadline);
    habitNote.value = task.note || "";
  }

  renderWaterControl();
}

function hasDictationResult(result) {
  return Boolean(
    result.nutrition ||
    result.symptom ||
    result.mood ||
    result.journal ||
    result.task ||
    (Array.isArray(result.symptoms) && result.symptoms.length) ||
    (Array.isArray(result.tasks) && result.tasks.length)
  );
}

function handleUnclearDictation(text = "") {
  showToast("I saved the transcript, but could not identify app fields.");
}

function promptForDictationSpecifics(result, text) {
  (result.missingDetails || []).forEach((detail) => {
    const answer = window.prompt(detail.question, "");
    if (!answer || !answer.trim()) return;
    applyDictationMissingDetail(result, detail, answer.trim(), text);
  });
}

async function parseHealthDictation(text) {
  const localResult = extractStructuredDictationData(text);
  if (isAiDictationEnabled()) {
    try {
      const aiResult = await extractAiDictationData(text);
      return mergeDictationResults(localResult, aiResult, text);
    } catch (error) {
      console.warn("AI dictation was too slow or unavailable; using local parser.", error);
    }
  }
  if (hasDictationResult(localResult)) {
    localResult.missingDetails = buildDictationMissingDetails(localResult, normalizeDictationText(text));
  }
  return localResult;
}

function mergeDictationResults(localResult, aiResult, text) {
  const explicitJournal = hasExplicitJournalIntent(text);
  const merged = {
    nutrition: { ...(localResult.nutrition || {}), ...(aiResult.nutrition || {}) },
    symptom: aiResult.symptom || localResult.symptom || null,
    symptoms: [
      ...(Array.isArray(localResult.symptoms) ? localResult.symptoms : []),
      ...(Array.isArray(aiResult.symptoms) ? aiResult.symptoms : [])
    ],
    mood: aiResult.mood || localResult.mood || null,
    journal: explicitJournal ? (aiResult.journal || localResult.journal || null) : null,
    task: aiResult.task || localResult.task || null,
    tasks: [
      ...(Array.isArray(localResult.tasks) ? localResult.tasks : []),
      ...(Array.isArray(aiResult.tasks) ? aiResult.tasks : [])
    ],
    missingDetails: aiResult.missingDetails || localResult.missingDetails || []
  };
  if (!Object.keys(merged.nutrition).length) merged.nutrition = null;
  merged.symptoms = dedupeDictationEntries(merged.symptoms, "name");
  merged.tasks = dedupeDictationEntries(merged.tasks, "name");
  merged.missingDetails = buildDictationMissingDetails(merged, normalizeDictationText(text));
  return merged;
}

function dedupeDictationEntries(entries, key) {
  const seen = new Set();
  return entries.filter((entry) => {
    const value = String(entry?.[key] || "").trim().toLowerCase();
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function isAiDictationEnabled() {
  return Boolean(canUseCloudAi());
}

function canUseCloudAi() {
  return Boolean(appSettings.hipaaCloudConfirmed && appSettings.aiExtractionEnabled && window.fetch && getConfiguredAiBackendUrl());
}

async function testAiTextToSpeech() {
  if (!canUseCloudAi()) {
    showToast("Enable cloud AI and save your AI backend URL first.");
    return;
  }
  try {
    showToast("Generating AI voice...");
    await playAiTextToSpeech("AI voice is ready for Health and Task Tracker.");
    showToast("Playing AI-generated voice.");
  } catch (error) {
    showToast(error.message || "AI text-to-speech failed.");
  }
}

async function playAiTextToSpeech(text, options = {}) {
  const backendUrl = getConfiguredAiBackendUrl();
  if (!backendUrl) throw new Error("Enter an HTTPS AI backend URL in Settings.");
  const headers = { "Content-Type": "application/json" };
  if (appSettings.aiBackendToken) headers["X-App-Token"] = appSettings.aiBackendToken;
  const response = await fetchWithTimeout(`${backendUrl}/api/tts/speech`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      text: truncateForAi(text, 1800),
      model: appSettings.aiTtsModel || "gpt-4o-mini-tts",
      voice: appSettings.aiTtsVoice || "coral",
      instructions: options.instructions || "Speak in a warm, calm, supportive health coach tone."
    })
  }, 12000);
  if (!response.ok) {
    throw new Error(await getFriendlyAiError(response, "AI text-to-speech"));
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  try {
    await new Audio(url).play();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
}

function installPhoneTextToSpeechVoiceData() {
  if (window.HealthTaskTextToSpeech && typeof window.HealthTaskTextToSpeech.installVoiceData === "function") {
    window.HealthTaskTextToSpeech.installVoiceData();
    return;
  }
  showToast("Phone voice install is available in the Android app build.");
}

async function extractAiDictationData(text) {
  if (!getConfiguredAiBackendUrl()) {
    throw new Error("Enter an HTTPS AI backend URL in Settings.");
  }
  return extractBackendAiDictationData(text);
}

async function extractBackendAiDictationData(text) {
  const headers = { "Content-Type": "application/json" };
  if (appSettings.aiBackendToken) headers["X-App-Token"] = appSettings.aiBackendToken;
  const backendUrl = getConfiguredAiBackendUrl();
  const response = await fetchWithTimeout(`${backendUrl}/api/dictation/extract`, {
    method: "POST",
    headers,
    body: JSON.stringify({ transcript: truncateForAi(text, 6000) })
  }, AI_DICTATION_TIMEOUT_MS);
  if (!response.ok) {
    throw new Error(await getFriendlyAiError(response, "AI backend"));
  }
  return normalizeAiDictationResult(await response.json(), text);
}

async function getFriendlyAiError(response, fallbackLabel) {
  const raw = await response.text();
  let message = raw;
  try {
    const outer = JSON.parse(raw);
    message = outer.error || outer.message || raw;
    if (typeof message === "string" && message.trim().startsWith("{")) {
      const inner = JSON.parse(message);
      message = inner.error?.message || inner.message || message;
    } else if (outer.error?.message) {
      message = outer.error.message;
    }
  } catch {
    // Keep the raw text.
  }
  if (/insufficient_quota|exceeded your current quota|billing/i.test(message)) {
    return "OpenAI quota is exhausted on the backend. Add billing or quota to the OpenAI account used by Render, then try dictation again.";
  }
  return message || `${fallbackLabel} failed with ${response.status}`;
}

function normalizeAiDictationResult(data, originalText) {
  const nutrition = normalizeAiNutrition(data.nutrition);
  const symptoms = Array.isArray(data.symptoms) ? data.symptoms.map((entry) => ({
    name: cleanDictatedPhrase(entry?.name),
    severity: normalizeAiChoice(entry?.severity, ["Mild", "Moderate", "Severe"], "Mild"),
    note: String(entry?.note || "")
  })).filter((entry) => entry.name) : [];
  const tasks = Array.isArray(data.tasks) ? data.tasks.map((entry) => ({
    name: cleanDictatedPhrase(entry?.name),
    day: weekDays.includes(entry?.day) ? entry.day : weekDays[new Date().getDay()],
    time: normalizeTaskTime(String(entry?.time || "")),
    deadline: normalizeTaskTime(String(entry?.deadline || "")),
    note: String(entry?.note || originalText)
  })).filter((entry) => entry.name) : [];
  const mood = data.mood && data.mood.name ? {
    name: normalizeAiChoice(data.mood.name, ["Great", "Good", "Okay", "Low", "Stressed", "Anxious"], "Okay"),
    intensity: normalizeAiChoice(data.mood.intensity, ["Mild", "Moderate", "Strong"], "Moderate"),
    note: String(data.mood.note || "")
  } : null;
  const journal = hasExplicitJournalIntent(originalText) && data.journal && data.journal.text ? { text: String(data.journal.text).trim() } : null;
  return {
    nutrition,
    symptom: symptoms[0] || null,
    symptoms: symptoms.slice(1),
    mood,
    journal,
    task: tasks[0] || null,
    tasks: tasks.slice(1),
    missingDetails: Array.isArray(data.missingDetails) ? data.missingDetails.map((detail) => ({
      section: String(detail?.section || ""),
      field: String(detail?.field || ""),
      question: String(detail?.question || "")
    })).filter((detail) => detail.section && detail.question) : []
  };
}

function normalizeAiNutrition(value) {
  if (!value || typeof value !== "object") return null;
  const nutrition = {};
  const aliases = {
    calories: ["calories", "calorie", "calorieIntake", "calorie_intake"],
    carbs: ["carbs", "carbohydrates", "netCarbs", "net_carbs"],
    weight: ["weight", "pounds", "lbs"],
    glucose: ["glucose", "bloodSugar", "blood_sugar"],
    systolic: ["systolic", "systolicBloodPressure", "systolic_blood_pressure"],
    diastolic: ["diastolic", "diastolicBloodPressure", "diastolic_blood_pressure"],
    water: ["water", "waterOz", "water_oz", "ounces"]
  };
  Object.entries(aliases).forEach(([key, names]) => {
    const rawValue = names.map((name) => value[name]).find((item) => item !== null && item !== undefined && item !== "");
    const number = Number.parseFloat(rawValue);
    if (Number.isFinite(number)) nutrition[key] = number;
  });
  if (["Entering", "Ketosis", "Deep ketosis", "Exiting"].includes(value.ketosisPhase)) nutrition.ketosisPhase = value.ketosisPhase;
  return Object.keys(nutrition).length ? nutrition : null;
}

function normalizeAiChoice(value, allowed, fallback) {
  const found = allowed.find((item) => item.toLowerCase() === String(value || "").toLowerCase());
  return found || fallback;
}

function sanitizeDictationResultForTranscript(result, transcript) {
  if (!result || typeof result !== "object") return result;
  if (!hasExplicitJournalIntent(transcript)) {
    return { ...result, journal: null };
  }
  return result;
}

function extractStructuredDictationData(text) {
  const normalized = normalizeDictationText(text);
  const nutrition = {};
  const caloriesValue = getDictatedNumberNear(normalized, ["calories", "calorie intake", "ate"]);
  const carbsValue = getDictatedNumberNear(normalized, ["carbs", "carbohydrates", "net carbs"]);
  const weightValue = getDictatedNumberNear(normalized, ["weight", "weigh", "weighed", "pounds", "lbs"]);
  const glucoseValue = getDictatedNumberNear(normalized, ["glucose", "blood sugar", "sugar"]);
  const waterValue = getDictatedWater(normalized);
  const bloodPressure = getDictatedBloodPressure(normalized);
  const symptoms = parseDictatedSymptoms(text, normalized);
  const tasks = parseDictatedTasks(text, normalized);
  const mood = parseDictatedMood(text, normalized);
  const journal = parseDictatedJournal(text, normalized);
  if (Number.isFinite(caloriesValue)) nutrition.calories = caloriesValue;
  if (Number.isFinite(carbsValue)) nutrition.carbs = carbsValue;
  if (Number.isFinite(weightValue)) nutrition.weight = weightValue;
  if (Number.isFinite(glucoseValue)) nutrition.glucose = glucoseValue;
  if (Number.isFinite(waterValue)) nutrition.water = waterValue;
  if (bloodPressure) {
    nutrition.systolic = bloodPressure.systolic;
    nutrition.diastolic = bloodPressure.diastolic;
  }
  if (/\b(ketosis|keto)\b/i.test(normalized)) {
    nutrition.ketosisPhase = normalized.includes("deep") ? "Deep ketosis" : normalized.includes("enter") ? "Entering" : normalized.includes("exit") ? "Exiting" : "Ketosis";
  }
  const structured = {
    nutrition: Object.keys(nutrition).length ? nutrition : null,
    symptom: symptoms[0] || null,
    symptoms: symptoms.slice(1),
    mood,
    journal,
    task: tasks[0] || null,
    tasks: tasks.slice(1),
    missingDetails: []
  };
  structured.missingDetails = buildDictationMissingDetails(structured, normalized);
  return structured;
}

function buildDictationMissingDetails(result, normalized) {
  const missing = [];
  if (/\b(?:blood pressure|bp)\b/i.test(normalized) && (!result.nutrition || !Number.isFinite(result.nutrition.systolic) || !Number.isFinite(result.nutrition.diastolic))) {
    missing.push({ section: "nutrition", field: "bloodPressure", question: "What is the blood pressure? Use a format like 120/80." });
  }
  if (/\b(?:glucose|blood sugar)\b/i.test(normalized) && (!result.nutrition || !Number.isFinite(result.nutrition.glucose))) {
    missing.push({ section: "nutrition", field: "glucose", question: "What is the glucose number?" });
  }
  if (/\b(?:water|hydration)\b/i.test(normalized) && (!result.nutrition || !Number.isFinite(result.nutrition.water))) {
    missing.push({ section: "nutrition", field: "water", question: "How many ounces of water?" });
  }
  if (/\b(?:symptom|symptoms|i have|i feel|feeling|felt)\b/i.test(normalized) && !result.symptom && !(result.symptoms || []).length) {
    missing.push({ section: "symptoms", field: "name", question: "What symptom should I log?" });
  }
  if (/\b(?:mood|emotion|mental)\b/i.test(normalized) && !result.mood) {
    missing.push({ section: "mood", field: "name", question: "What mood should I log? Good, Okay, Low, Stressed, or Anxious." });
  }
  if (/\b(?:journal|journal entry|note to self|write down|remember)\b/i.test(normalized) && !result.journal) {
    missing.push({ section: "journal", field: "text", question: "What should the journal entry say?" });
  }
  if (/\b(?:add task|task|todo|to do|remind me to|need to|have to)\b/i.test(normalized) && !result.task && !(result.tasks || []).length) {
    missing.push({ section: "tasks", field: "name", question: "What task should I add?" });
  }
  return missing;
}

function applyDictationMissingDetail(result, detail, answer, originalText) {
  if (detail.section === "nutrition") {
    result.nutrition = result.nutrition || {};
    if (detail.field === "bloodPressure") {
      const bp = getDictatedBloodPressure(answer);
      if (bp) {
        result.nutrition.systolic = bp.systolic;
        result.nutrition.diastolic = bp.diastolic;
      }
    } else {
      const value = Number.parseFloat(replaceSpokenNumbers(answer.toLowerCase()));
      if (Number.isFinite(value)) result.nutrition[detail.field] = value;
    }
  } else if (detail.section === "symptoms") {
    const name = cleanDictatedPhrase(answer);
    if (name) addDictationItem(result, "symptom", "symptoms", { name, severity: "Mild", note: "" });
  } else if (detail.section === "mood") {
    const name = normalizeDictatedMood(answer);
    result.mood = { name, intensity: "Moderate", note: "" };
  } else if (detail.section === "journal") {
    result.journal = { text: answer };
  } else if (detail.section === "tasks") {
    const task = buildDictatedTask(answer, normalizeDictationText(answer), originalText);
    if (task) addDictationItem(result, "task", "tasks", task);
  }
}

function addDictationItem(result, primaryKey, listKey, item) {
  if (!result[primaryKey]) {
    result[primaryKey] = item;
    return;
  }
  result[listKey] = Array.isArray(result[listKey]) ? result[listKey] : [];
  result[listKey].push(item);
}

function normalizeDictationText(text) {
  return applyDictationTextAliases(replaceSpokenNumbers(String(text || "").toLowerCase()))
    .toLowerCase()
    .replace(/\bb p\b/g, "bp")
    .replace(/\bbloodpressure\b/g, "blood pressure")
    .replace(/\bto do\b/g, "todo")
    .replace(/\s+/g, " ")
    .trim();
}

function applyDictationTextAliases(text) {
  const normalized = dictationNormalizationRules.reduce(
    (normalized, [pattern, replacement]) => normalized.replace(pattern, replacement),
    String(text || "")
  );
  return applyFuzzyHealthDictationAliases(normalized);
}

function applyFuzzyHealthDictationAliases(text) {
  const fuzzyAliases = {
    calories: ["calories", "calorie", "calories", "calery", "caleries", "callories", "valories", "valeries", "kcal"],
    carbs: ["carbs", "carbz", "carbohydrates", "carbohydrate", "carbos"],
    glucose: ["glucose", "glucoze", "glukose", "glucous", "sugar"],
    weight: ["weight", "weigh", "weighed", "waight", "pounds"],
    water: ["water", "hydration", "fluids"],
    ounces: ["ounces", "ounce", "ounzes"],
    ketosis: ["ketosis", "ketones", "keytones"],
    systolic: ["systolic", "sistolic"],
    diastolic: ["diastolic", "diastollic"],
    headache: ["headache", "headake"],
    nausea: ["nausea", "nausia", "nauzea"],
    dizziness: ["dizziness", "dizzyness"],
    fatigue: ["fatigue", "fatige", "tired"],
    anxiety: ["anxiety", "anxious"],
    stressed: ["stressed", "stress"]
  };
  return String(text || "").replace(/\b[a-z]{4,}\b/g, (word) => {
    for (const [replacement, aliases] of Object.entries(fuzzyAliases)) {
      if (aliases.some((alias) => isCloseDictationWord(word, alias))) return replacement;
    }
    return word;
  });
}

function isCloseDictationWord(word, alias) {
  if (!word || !alias) return false;
  if (word === alias) return true;
  if (Math.abs(word.length - alias.length) > 2) return false;
  const maxDistance = Math.min(word.length, alias.length) >= 7 ? 2 : 1;
  return getLimitedEditDistance(word, alias, maxDistance) <= maxDistance;
}

function getLimitedEditDistance(first, second, limit) {
  const previous = Array.from({ length: second.length + 1 }, (_, index) => index);
  for (let row = 1; row <= first.length; row += 1) {
    const current = [row];
    let rowMinimum = current[0];
    for (let column = 1; column <= second.length; column += 1) {
      const cost = first[row - 1] === second[column - 1] ? 0 : 1;
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + cost
      );
      rowMinimum = Math.min(rowMinimum, current[column]);
    }
    if (rowMinimum > limit) return limit + 1;
    previous.splice(0, previous.length, ...current);
  }
  return previous[second.length];
}

function replaceSpokenNumbers(text) {
  const numberWords = "(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)";
  return text.replace(new RegExp(`\\b${numberWords}(?:[\\s-]+${numberWords})*\\b`, "gi"), (phrase) => {
    const value = spokenNumberToValue(phrase);
    return Number.isFinite(value) ? String(value) : phrase;
  });
}

function spokenNumberToValue(phrase) {
  const values = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
    ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
    seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
    sixty: 60, seventy: 70, eighty: 80, ninety: 90
  };
  const tokens = phrase.toLowerCase().replace(/-/g, " ").split(/\s+/).filter(Boolean);
  if (!tokens.length || tokens.some((token) => token !== "hundred" && !Object.prototype.hasOwnProperty.call(values, token))) {
    return null;
  }
  if (tokens.length >= 2 && tokens.length <= 3 && values[tokens[0]] >= 1 && values[tokens[0]] <= 9 && values[tokens[1]] >= 20) {
    return (values[tokens[0]] * 100) + tokens.slice(1).reduce((sum, token) => sum + values[token], 0);
  }
  let total = 0;
  let current = 0;
  tokens.forEach((token) => {
    if (token === "hundred") {
      current = (current || 1) * 100;
    } else {
      current += values[token];
    }
  });
  total += current;
  return total;
}

function getDictatedNumber(text, pattern) {
  const match = String(text || "").match(pattern);
  if (!match) return null;
  const value = Number.parseFloat(match[1]);
  return Number.isFinite(value) ? value : null;
}

function getDictatedNumberNear(text, labels) {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const after = getDictatedNumber(text, new RegExp(`\\b${escaped}\\b\\s*(?:was|is|are|at|of|about|around|to|totaled|total|came to|were|for|equals?)?\\s*(\\d+(?:\\.\\d+)?)`, "i"));
    if (Number.isFinite(after)) return after;
    const before = getDictatedNumber(text, new RegExp(`\\b(\\d+(?:\\.\\d+)?)\\s*(?:${escaped})\\b`, "i"));
    if (Number.isFinite(before)) return before;
  }
  return null;
}

function getDictatedWater(text) {
  const value = getDictatedNumberNear(text, ["water", "hydration", "ounces", "oz", "cups"]);
  if (!Number.isFinite(value)) return null;
  if (/\b(cup|cups)\b/i.test(text) && !/\b(ounce|ounces|oz)\b/i.test(text)) return value * 8;
  return value;
}

function getDictatedBloodPressure(text) {
  const exact = text.match(/\b(?:blood pressure|bp)?\s*(\d{2,3})\s*(?:over|\/)\s*(\d{2,3})\b/i);
  if (exact && (/\b(?:blood pressure|bp)\b/i.test(text) || Number(exact[1]) >= 70)) {
    return { systolic: Number(exact[1]), diastolic: Number(exact[2]) };
  }
  const nearby = text.match(/\b(?:blood pressure|bp)\b(?:\s*(?:was|is|at|of))?\s*(\d{2,3})\s+(\d{2,3})\b/i);
  return nearby ? { systolic: Number(nearby[1]), diastolic: Number(nearby[2]) } : null;
}

function parseDictatedSymptoms(original, normalized) {
  const known = ["headache", "migraine", "fever", "chills", "cough", "congestion", "nausea", "dizzy", "dizziness", "fatigue", "tired", "pain", "sore throat", "chest pain", "shortness of breath", "vomiting", "diarrhea", "stomach ache", "back pain", "anxiety", "rash", "sweating", "weakness", "cramps"];
  const found = known.filter((item) => new RegExp(`\\b${item.replace(/\s+/g, "\\s+")}\\b`, "i").test(normalized));
  const phraseMatch = normalized.match(/\b(?:symptom|symptoms|i have|i've got|i am having|i'm having|i feel|feeling|felt)\s+(.*?)(?:\b(?:my blood pressure|blood pressure|bp|glucose|blood sugar|water|calories|carbs|weight|mood|journal|task|todo|remind me)\b|$)/i);
  if (!found.length && phraseMatch) {
    const phrase = cleanDictatedPhrase(phraseMatch[1]).replace(/\b(and|also)\b/ig, ",");
    found.push(...phrase.split(",").map(cleanDictatedPhrase).filter(Boolean).slice(0, 3));
  }
  return [...new Set(found)]
    .map((name) => ({ name: cleanDictatedPhrase(name), severity: getDictatedSeverity(normalized), note: "" }))
    .filter((entry) => entry.name);
}

function getDictatedSeverity(normalized) {
  if (/\b(severe|bad|terrible|awful|extreme|intense)\b/i.test(normalized)) return "Severe";
  if (/\b(moderate|medium|noticeable)\b/i.test(normalized)) return "Moderate";
  return "Mild";
}

function parseDictatedMood(original, normalized) {
  const moodMap = [
    ["Great", /\b(great|excellent|amazing|happy|energized)\b/i],
    ["Good", /\b(good|fine|solid|positive|calm)\b/i],
    ["Low", /\b(low|sad|down|depressed|hopeless|empty)\b/i],
    ["Stressed", /\b(stressed|overwhelmed|pressure|tense)\b/i],
    ["Anxious", /\b(anxious|anxiety|worried|panic|nervous)\b/i],
    ["Okay", /\b(okay|ok|alright|neutral)\b/i]
  ];
  const match = moodMap.find(([, pattern]) => pattern.test(normalized));
  if (!match && !/\b(mood|emotion|mental|feeling emotionally|felt emotionally)\b/i.test(normalized)) return null;
  const intensity = /\b(strong|intense|very|really|extremely)\b/i.test(normalized) ? "Strong" : /\b(mild|slight|little)\b/i.test(normalized) ? "Mild" : "Moderate";
  return { name: match ? match[0] : "Okay", intensity, note: "" };
}

function normalizeDictatedMood(value) {
  const lower = value.toLowerCase();
  if (lower.includes("great")) return "Great";
  if (lower.includes("good")) return "Good";
  if (lower.includes("low") || lower.includes("sad")) return "Low";
  if (lower.includes("stress")) return "Stressed";
  if (lower.includes("anx")) return "Anxious";
  return "Okay";
}

function parseDictatedJournal(original, normalized) {
  const match = original.match(/\b(?:journal|journal entry|make a journal entry|add a journal entry|new journal entry|note to self|write down in (?:my )?journal|put this in (?:my )?journal|remember this in (?:my )?journal)\s*[:,]?\s*(.*)$/i);
  if (match) {
    const text = cleanDictatedPhrase(match[1]);
    return text ? { text } : null;
  }
  return null;
}

function hasExplicitJournalIntent(text) {
  return /\b(?:journal|journal entry|make a journal entry|add a journal entry|new journal entry|note to self|write down in (?:my )?journal|put this in (?:my )?journal|remember this in (?:my )?journal)\b/i.test(String(text || ""));
}

function parseDictatedTask(original, normalized) {
  return parseDictatedTasks(original, normalized)[0] || null;
}

function parseDictatedTasks(original, normalized) {
  const pieces = original.split(/\b(?:also add|add another task|new task|next task|and remind me to|remind me to|add task|task is|task:|todo|to do|i need to|need to|i have to|have to)\b/i);
  const taskPhrases = pieces.length > 1 ? pieces.slice(1).map(cleanDictatedPhrase).filter(Boolean) : [];
  if (!taskPhrases.length && /\b(?:add task|task|todo|to do|remind me to|need to|i need to|i have to|have to)\b/i.test(original)) {
    const fallback = original.match(/\b(?:add task|task|todo|to do|remind me to|need to|i need to|i have to|have to)\s+(.*)$/i);
    if (fallback) taskPhrases.push(cleanDictatedPhrase(fallback[1]));
  }
  return taskPhrases.map((phrase) => buildDictatedTask(phrase, normalized, original)).filter(Boolean);
}

function buildDictatedTask(phrase, normalized, original) {
  let name = cleanDictatedPhrase(phrase)
    .replace(/\b(on )?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|today|tomorrow)\b/ig, "")
    .replace(/\b(?:by|due at|deadline|at)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/ig, "")
    .replace(/\b(?:with a deadline|deadline is|due)\b.*$/ig, "")
    .trim();
  if (!name || name.length < 2) return null;
  name = name.charAt(0).toUpperCase() + name.slice(1);
  return { name, day: getDictatedTaskDay(`${normalized} ${phrase.toLowerCase()}`), deadline: getDictatedTaskTime(`${normalized} ${phrase.toLowerCase()}`), note: original };
}

function getDictatedTaskDay(normalized) {
  return weekDays.find((day) => normalized.includes(day.toLowerCase())) || weekDays[new Date().getDay()];
}

function getDictatedTaskTime(normalized) {
  const match = normalized.match(/\b(?:by|due at|deadline|at)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (!match) return "";
  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const period = match[3];
  if (period === "pm" && hours < 12) hours += 12;
  if (period === "am" && hours === 12) hours = 0;
  if (hours > 23 || minutes > 59) return "";
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function cleanDictatedPhrase(value) {
  return String(value || "")
    .replace(/\b(?:is|are|at|of|today|please)\b/ig, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function saveDictatedNutrition(partial) {
  const existing = nutritionEntries.find((entry) => entry.date === today) || {};
  nutritionEntries = [{
    date: today,
    calories: null,
    carbs: null,
    weight: null,
    ketosisPhase: null,
    glucose: null,
    systolic: null,
    diastolic: null,
    water: null,
    ...existing,
    ...partial,
    recordedAt: new Date().toISOString()
  }, ...nutritionEntries.filter((entry) => entry.date !== today)].sort((first, second) => second.date.localeCompare(first.date));
  saveNutritionEntries();
}

function saveDictatedSymptom(symptom) {
  symptomEntries = [{ id: createHabitId(), date: today, recordedAt: new Date().toISOString(), ...symptom }, ...symptomEntries];
  saveSymptomEntries();
}

function saveDictatedMood(mood) {
  moodEntries = [{ id: createHabitId(), date: today, recordedAt: new Date().toISOString(), ...mood }, ...moodEntries];
  saveMoodEntries();
}

function saveDictatedJournal(journal) {
  journalEntries = [{ id: createHabitId(), date: today, text: journal.text }, ...journalEntries];
  saveJournalEntries();
}

function saveDictatedTask(task) {
  habits = [{
    id: createHabitId(),
    name: task.name,
    day: task.day,
    category: "General",
    time: "",
    deadline: normalizeTaskTime(task.deadline),
    priority: "Normal",
    color: "#1e40af",
    note: task.note,
    completions: []
  }, ...habits];
  saveHabits();
}

function getDictationSummary(result) {
  const taskCount = (result.task ? 1 : 0) + (Array.isArray(result.tasks) ? result.tasks.length : 0);
  const symptomCount = (result.symptom ? 1 : 0) + (Array.isArray(result.symptoms) ? result.symptoms.length : 0);
  const parts = [
    result.nutrition ? "vitals/nutrition" : "",
    symptomCount ? `${symptomCount} symptom${symptomCount === 1 ? "" : "s"}` : "",
    result.mood ? "mood" : "",
    result.journal ? "journal" : "",
    taskCount ? `${taskCount} task${taskCount === 1 ? "" : "s"}` : ""
  ].filter(Boolean);
  return parts.length ? `Dictation saved: ${parts.join(", ")}. AI Coach refreshed.` : "I heard the dictation, but could not identify health data or a task to save.";
}

function getWeeklyTotals() {
  return getWeeklyCompletionTotals();
}

async function importBloodPressureFromWatch() {
  let value = "";
  if (navigator.clipboard && window.isSecureContext) {
    try {
      value = await navigator.clipboard.readText();
    } catch {
      value = "";
    }
  }

  if (!value) {
    value = window.prompt("Paste blood pressure from Apple Health, Samsung Health, Fitbit, Garmin, Google Fit, or another watch app export.", "") || "";
  }

  const reading = getBloodPressureReading(value);
  if (!reading) {
    window.alert("Could not find a blood pressure reading. Paste a value like 120/80, labeled Systolic/Diastolic text, CSV rows, or an Apple Health export snippet.");
    return;
  }

  applyBloodPressureReading(reading);
  window.alert(`Imported blood pressure ${reading.systolic}/${reading.diastolic}${reading.dateKey ? ` for ${reading.dateKey}` : ""}.`);
}

function applyBloodPressureFromUrl() {
  const params = new URLSearchParams(location.search);
  const value = params.get("bp") || params.get("bloodPressure");
  const systolicValue = params.get("systolic") || params.get("sys");
  const diastolicValue = params.get("diastolic") || params.get("dia");

  if (value && setBloodPressureFromText(value)) return;
  if (systolicValue && diastolicValue) {
    setBloodPressureFromText(`${systolicValue}/${diastolicValue}`);
  }
}

function setBloodPressureFromText(value) {
  const reading = getBloodPressureReading(value);
  if (!reading) return false;

  applyBloodPressureReading(reading);
  return true;
}

function applyBloodPressureReading(reading) {
  systolic.value = String(reading.systolic);
  diastolic.value = String(reading.diastolic);
  if (reading.dateKey) {
    nutritionDate.value = reading.dateKey;
  }
}

function getBloodPressureReading(value) {
  const text = String(value || "").trim();
  if (!text) return null;

  const readings = [
    ...parseAppleHealthBloodPressure(text),
    ...parseDelimitedBloodPressure(text),
    ...parseLabeledBloodPressure(text),
    ...parseSlashBloodPressure(text)
  ].filter(isValidBloodPressureReading);

  if (!readings.length) return null;

  return readings.reduce((best, current) => {
    if (!best) return current;
    if (current.timestamp && !best.timestamp) return current;
    if (current.timestamp && best.timestamp && current.timestamp > best.timestamp) return current;
    if (!current.timestamp && !best.timestamp && current.sequence > best.sequence) return current;
    return best;
  }, null);
}

function parseAppleHealthBloodPressure(text) {
  const systolicRecords = getAppleHealthRecords(text, "Systolic");
  const diastolicRecords = getAppleHealthRecords(text, "Diastolic");

  return systolicRecords.flatMap((systolicRecord) => {
    const partner = diastolicRecords
      .filter((diastolicRecord) => Math.abs((diastolicRecord.timestamp || 0) - (systolicRecord.timestamp || 0)) < 5 * 60 * 1000)
      .sort((first, second) => Math.abs((first.timestamp || 0) - (systolicRecord.timestamp || 0)) - Math.abs((second.timestamp || 0) - (systolicRecord.timestamp || 0)))[0];

    return partner ? [{
      systolic: systolicRecord.value,
      diastolic: partner.value,
      dateKey: systolicRecord.dateKey || partner.dateKey,
      timestamp: systolicRecord.timestamp || partner.timestamp,
      sequence: systolicRecord.sequence
    }] : [];
  });
}

function getAppleHealthRecords(text, kind) {
  const records = [];
  const pattern = new RegExp(`<Record\\b[^>]*BloodPressure${kind}[^>]*>`, "gi");
  let match;
  let sequence = 0;

  while ((match = pattern.exec(text))) {
    const record = match[0];
    const value = Number((record.match(/\bvalue="([^"]+)"/i) || [])[1]);
    const dateText = (record.match(/\b(?:startDate|creationDate)="([^"]+)"/i) || [])[1] || "";
    const date = parseBloodPressureDate(dateText);
    records.push({
      value,
      dateKey: date.dateKey,
      timestamp: date.timestamp,
      sequence: sequence += 1
    });
  }

  return records;
}

function parseDelimitedBloodPressure(text) {
  const rows = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const readings = [];
  let sequence = 0;

  rows.forEach((line, index) => {
    const delimiter = line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",";
    const columns = splitDelimitedLine(line, delimiter);
    if (columns.length < 2) return;

    const header = columns.map(normalizeColumnName);
    const systolicIndex = header.findIndex((column) => column.includes("systolic") || column === "sys" || column.endsWith("sys"));
    const diastolicIndex = header.findIndex((column) => column.includes("diastolic") || column === "dia" || column.endsWith("dia"));
    if (systolicIndex === -1 || diastolicIndex === -1) return;

    rows.slice(index + 1).forEach((row) => {
      const values = splitDelimitedLine(row, delimiter);
      const systolicValue = Number(values[systolicIndex]);
      const diastolicValue = Number(values[diastolicIndex]);
      const date = parseBloodPressureDate(row);
      readings.push({
        systolic: systolicValue,
        diastolic: diastolicValue,
        dateKey: date.dateKey,
        timestamp: date.timestamp,
        sequence: sequence += 1
      });
    });
  });

  return readings;
}

function parseLabeledBloodPressure(text) {
  let sequence = 0;
  return text.split(/\r?\n/).flatMap((line) => {
    const systolicMatch = line.match(/\b(?:sys|systolic)\b[^\d]{0,24}(\d{2,3})/i);
    const diastolicMatch = line.match(/\b(?:dia|diastolic)\b[^\d]{0,24}(\d{2,3})/i);
    if (!systolicMatch || !diastolicMatch) return [];

    const date = parseBloodPressureDate(line);
    return [{
      systolic: Number(systolicMatch[1]),
      diastolic: Number(diastolicMatch[1]),
      dateKey: date.dateKey,
      timestamp: date.timestamp,
      sequence: sequence += 1
    }];
  });
}

function parseSlashBloodPressure(text) {
  const readings = [];
  const pattern = /(\d{2,3})\s*\/\s*(\d{2,3})/g;
  let match;
  let sequence = 0;

  while ((match = pattern.exec(text))) {
    const lineStart = text.lastIndexOf("\n", match.index) + 1;
    const lineEnd = text.indexOf("\n", match.index);
    const line = text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd);
    const date = parseBloodPressureDate(line || text);
    readings.push({
      systolic: Number(match[1]),
      diastolic: Number(match[2]),
      dateKey: date.dateKey,
      timestamp: date.timestamp,
      sequence: sequence += 1
    });
  }

  return readings;
}

function splitDelimitedLine(line, delimiter) {
  const values = [];
  let current = "";
  let quoted = false;

  for (const character of line) {
    if (character === "\"") {
      quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      values.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }

  values.push(current.trim());
  return values;
}

function normalizeColumnName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseBloodPressureDate(value) {
  const text = String(value || "");
  const isoMatch = text.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
  const usMatch = text.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})(?:[ T](\d{1,2}):(\d{2}))?/);
  const parts = isoMatch
    ? { year: isoMatch[1], month: isoMatch[2], day: isoMatch[3], hour: isoMatch[4] || "0", minute: isoMatch[5] || "0" }
    : usMatch
      ? { year: usMatch[3], month: usMatch[1], day: usMatch[2], hour: usMatch[4] || "0", minute: usMatch[5] || "0" }
      : null;

  if (!parts) return { dateKey: "", timestamp: 0 };

  const date = new Date(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
  if (Number.isNaN(date.getTime())) return { dateKey: "", timestamp: 0 };

  return {
    dateKey: toDateKey(date),
    timestamp: date.getTime()
  };
}

function isValidBloodPressureReading(reading) {
  return reading
    && Number.isFinite(reading.systolic)
    && Number.isFinite(reading.diastolic)
    && reading.systolic >= 50
    && reading.systolic <= 260
    && reading.diastolic >= 30
    && reading.diastolic <= 180;
}

function applyTaskFromUrl() {
  const params = new URLSearchParams(location.search);
  const name = (params.get("habit") || params.get("addHabit") || params.get("task") || params.get("addTask") || "").trim();
  if (!name) return;

  const day = params.get("day");
  const newHabit = {
    id: createHabitId(),
    name: name.slice(0, 32),
    day: weekDays.includes(day) ? day : weekDays[new Date().getDay()],
    category: (params.get("category") || "Health").slice(0, 24),
    time: ["Anytime", "Morning", "Afternoon", "Evening", "Night"].includes(params.get("time"))
      ? params.get("time")
      : "Anytime",
    priority: ["Normal", "High", "Low"].includes(params.get("priority"))
      ? params.get("priority")
      : "Normal",
    color: /^#[0-9a-f]{6}$/i.test(params.get("color") || "") ? params.get("color") : "#1e40af",
    note: (params.get("note") || "").slice(0, 72),
    completions: []
  };

  habits.unshift(newHabit);
  saveHabits();

  if (history.replaceState) {
    history.replaceState(null, "", `${location.pathname}${location.hash}`);
  }
}

function getKetosisPhaseLevel(phase) {
  const values = {
    Entering: 1,
    Ketosis: 2,
    "Deep ketosis": 3,
    Exiting: 1
  };
  return values[phase] ?? null;
}

function formatKetosisPhase(phase) {
  return phase ? phase : "--";
}

function formatBloodPressure(systolicValue, diastolicValue, includeUnits = false) {
  if (!Number.isFinite(systolicValue) && !Number.isFinite(diastolicValue)) return "--";
  const systolicText = Number.isFinite(systolicValue) ? formatWholeNumber(systolicValue) : "--";
  const diastolicText = Number.isFinite(diastolicValue) ? formatWholeNumber(diastolicValue) : "--";
  const value = `${systolicText}/${diastolicText}`;
  return includeUnits ? `${value} mmHg` : value;
}

applyBloodPressureFromUrl();
applyTaskFromUrl();
render();
scrollAppToTop();
if (isAppLockEnabled()) {
  showAppLock();
} else if (isGuestModeEnabled()) {
  finishUnlock();
} else {
  showSecuritySetup();
}
