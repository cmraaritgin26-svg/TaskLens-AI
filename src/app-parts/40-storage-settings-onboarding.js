function loadHabits() {
  try {
    const saved = JSON.parse(localStorage.getItem(storeKey));
    return Array.isArray(saved)
      ? saved
        .filter((habit) => habit && habit.name)
        .map((habit) => ({
          id: habit.id || String(Date.now()),
          name: habit.name,
          date: normalizeTaskDate(habit.date)
            || (weekDays.includes(habit.day) ? getWeekdayDateKey(weekDays.indexOf(habit.day)) : today),
          day: weekDays.includes(habit.day)
            ? habit.day
            : weekDays[new Date().getDay()],
          category: habit.category || "General",
          time: normalizeTaskTime(habit.time),
          deadline: normalizeTaskTime(habit.deadline),
          priority: habit.priority || "Normal",
          color: habit.color || "#f97316",
          note: habit.note || "",
          completions: Array.isArray(habit.completions)
            ? habit.completions.filter((date) => typeof date === "string")
            : []
        }))
      : [];
  } catch {
    return [];
  }
}

function saveHabits() {
  localStorage.setItem(storeKey, JSON.stringify(habits));
}

function loadDeadlineAlertKeys() {
  try {
    const saved = JSON.parse(localStorage.getItem(deadlineAlertStoreKey));
    return new Set(Array.isArray(saved) ? saved.filter((key) => typeof key === "string") : []);
  } catch {
    return new Set();
  }
}

function saveDeadlineAlertKeys() {
  localStorage.setItem(deadlineAlertStoreKey, JSON.stringify([...deadlineAlertKeys].slice(-500)));
}

function loadTaskDeadlineEvents() {
  try {
    const saved = JSON.parse(localStorage.getItem(deadlineEventStoreKey));
    return Array.isArray(saved)
      ? saved
        .filter((event) => event && event.taskId && event.date && event.deadline)
        .map((event) => ({
          taskId: event.taskId,
          taskName: event.taskName || "Task",
          date: event.date,
          deadline: normalizeTaskTime(event.deadline),
          recordedAt: event.recordedAt || new Date().toISOString()
        }))
        .filter((event) => event.date >= getRecentCutoffKey(HISTORY_RETENTION_DAYS))
      : [];
  } catch {
    return [];
  }
}

function saveTaskDeadlineEvents() {
  taskDeadlineEvents = taskDeadlineEvents
    .filter((event) => event.date >= getRecentCutoffKey(HISTORY_RETENTION_DAYS))
    .sort((first, second) => second.date.localeCompare(first.date));
  localStorage.setItem(deadlineEventStoreKey, JSON.stringify(taskDeadlineEvents));
}

function loadNutritionEntries() {
  try {
    const saved = JSON.parse(localStorage.getItem(nutritionStoreKey));
    return Array.isArray(saved)
      ? saved
        .filter((entry) => entry && entry.date)
        .map((entry) => ({
          date: entry.date,
          recordedAt: entry.recordedAt || `${entry.date}T12:00:00`,
          calories: Number.isFinite(entry.calories) ? entry.calories : null,
          carbs: Number.isFinite(entry.carbs) ? entry.carbs : null,
          weight: Number.isFinite(entry.weight) ? entry.weight : null,
          ketosisPhase: typeof entry.ketosisPhase === "string" && entry.ketosisPhase ? entry.ketosisPhase : null,
          glucose: Number.isFinite(entry.glucose) ? entry.glucose : null,
          systolic: Number.isFinite(entry.systolic) ? entry.systolic : null,
          diastolic: Number.isFinite(entry.diastolic) ? entry.diastolic : null,
          water: Number.isFinite(entry.water) ? entry.water : null
        }))
        .sort((first, second) => second.date.localeCompare(first.date))
      : [];
  } catch {
    return [];
  }
}

function saveNutritionEntries() {
  localStorage.setItem(nutritionStoreKey, JSON.stringify(nutritionEntries));
}

function loadSymptomEntries() {
  try {
    const saved = JSON.parse(localStorage.getItem(symptomStoreKey));
    return Array.isArray(saved)
      ? saved.filter((entry) => entry && entry.name && entry.date).map((entry) => ({
        id: entry.id || createHabitId(),
        date: entry.date,
        recordedAt: entry.recordedAt || `${entry.date}T15:00:00`,
        name: entry.name,
        severity: entry.severity || "Mild",
        note: entry.note || ""
      })).filter((entry) => entry.date >= getSymptomHistoryCutoffKey()).sort((first, second) => second.date.localeCompare(first.date))
      : [];
  } catch {
    return [];
  }
}

function saveSymptomEntries() {
  symptomEntries = symptomEntries
    .filter((entry) => entry && entry.name && entry.date && entry.date >= getSymptomHistoryCutoffKey())
    .sort((first, second) => second.date.localeCompare(first.date));
  localStorage.setItem(symptomStoreKey, JSON.stringify(symptomEntries));
}

function loadMoodEntries() {
  try {
    const saved = JSON.parse(localStorage.getItem(moodStoreKey));
    return Array.isArray(saved)
      ? saved.filter((entry) => entry && entry.name && entry.date).map((entry) => ({
        id: entry.id || createHabitId(),
        date: entry.date,
        recordedAt: entry.recordedAt || `${entry.date}T18:00:00`,
        name: entry.name,
        intensity: entry.intensity || "Moderate",
        note: entry.note || ""
      })).filter((entry) => entry.date >= getSymptomHistoryCutoffKey()).sort((first, second) => second.date.localeCompare(first.date))
      : [];
  } catch {
    return [];
  }
}

function saveMoodEntries() {
  moodEntries = moodEntries
    .filter((entry) => entry && entry.name && entry.date && entry.date >= getSymptomHistoryCutoffKey())
    .sort((first, second) => second.date.localeCompare(first.date));
  localStorage.setItem(moodStoreKey, JSON.stringify(moodEntries));
}

function loadJournalEntries() {
  const entries = [];
  const seen = new Set();
  const deletedKeys = loadDeletedJournalEntryKeys();
  const addEntries = (saved) => {
    if (!Array.isArray(saved)) return;
    saved.forEach((entry) => {
      const normalized = normalizeStoredJournalEntry(entry);
      if (!normalized) return;
      const key = `${normalized.date}:${normalized.text}`;
      if (deletedKeys.has(key)) return;
      if (seen.has(key)) return;
      seen.add(key);
      entries.push(normalized);
    });
  };
  [
    journalStoreKey,
    "habit-tracker:journal:v1",
    "habit-tracker:journal",
    "journalEntries"
  ].forEach((key) => addEntries(readStoredArray(key)));

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index) || "";
    const saved = readStoredValue(key);
    if (/journal/i.test(key)) {
      addEntries(Array.isArray(saved) ? saved : extractJournalEntriesFromStoredValue(saved));
    } else if (/dictation|backup|export|habit-tracker|health-task-tracker/i.test(key)) {
      addEntries(extractJournalEntriesFromStoredValue(saved));
    }
  }
  const sorted = entries
    .filter((entry) => entry.date >= getSymptomHistoryCutoffKey())
    .sort((first, second) => second.date.localeCompare(first.date));
  if (sorted.length) localStorage.setItem(journalStoreKey, JSON.stringify(sorted));
  return sorted;
}

function readStoredArray(key) {
  const saved = readStoredValue(key);
  return Array.isArray(saved) ? saved : [];
}

function readStoredValue(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function extractJournalEntriesFromStoredValue(value) {
  const found = [];
  const visit = (node, fallbackDate = "") => {
    if (!node) return;
    if (typeof node === "string") {
      const entry = normalizeStoredJournalEntry({ date: fallbackDate, text: node }, fallbackDate);
      if (entry) found.push(entry);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((child) => visit(child, fallbackDate));
      return;
    }
    if (typeof node !== "object") return;
    const entry = normalizeStoredJournalEntry(node, fallbackDate);
    if (entry && (node.text || node.entry || node.body || /journal/i.test(String(node.section || node.type || node.source || "")))) {
      found.push(entry);
    }
    Object.entries(node).forEach(([key, child]) => {
      const dateKey = getStoredJournalDateKey(key) || fallbackDate;
      if (/journal/i.test(key) || key === "journalEntries" || dateKey) visit(child, dateKey);
    });
  };
  visit(value);
  return found;
}

function normalizeStoredJournalEntry(entry, fallbackDate = "") {
  if (!entry) return null;
  if (typeof entry === "string") {
    entry = { date: fallbackDate, text: entry };
  }
  const date = getStoredJournalDateKey(
    entry.date ||
    entry.dateKey ||
    entry.createdAt ||
    entry.recordedAt ||
    entry.timestamp ||
    fallbackDate
  );
  if (!date) return null;
  const text = String(
    (entry.journal && typeof entry.journal === "object" ? entry.journal.text : "") ||
    entry.text ||
    entry.entry ||
    (typeof entry.journal === "string" ? entry.journal : "") ||
    entry.body ||
    entry.note ||
    ""
  ).trim();
  if (!text) return null;
  return {
    id: entry.id || createHabitId(),
    date,
    text
  };
}

function getStoredJournalDateKey(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const dateKey = raw.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (dateKey) return dateKey;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? "" : toDateKey(date);
}

function saveJournalEntries() {
  journalEntries = journalEntries
    .filter((entry) => entry && entry.date && entry.text && entry.date >= getSymptomHistoryCutoffKey())
    .sort((first, second) => second.date.localeCompare(first.date));
  localStorage.setItem(journalStoreKey, JSON.stringify(journalEntries));
}

function loadDeletedJournalEntryKeys() {
  try {
    const saved = JSON.parse(localStorage.getItem(deletedJournalEntriesStoreKey) || "[]");
    return new Set(Array.isArray(saved) ? saved.filter((key) => typeof key === "string") : []);
  } catch {
    return new Set();
  }
}

function saveDeletedJournalEntryKeys(keys) {
  localStorage.setItem(deletedJournalEntriesStoreKey, JSON.stringify([...keys].slice(-2000)));
}

function loadDictationDocuments() {
  try {
    const saved = JSON.parse(localStorage.getItem(dictationDocumentStoreKey));
    const documents = Array.isArray(saved)
      ? saved
        .filter((entry) => entry && typeof entry.text === "string" && entry.text.trim())
        .map((entry) => ({
          id: entry.id || createHabitId(),
          date: entry.date || today,
          recordedAt: entry.recordedAt || new Date().toISOString(),
          source: entry.source || "dictation",
          text: entry.text.trim(),
          extraction: entry.extraction || null
        }))
        .filter((entry) => entry.date === today)
      : [];
    localStorage.setItem(dictationDocumentStoreKey, JSON.stringify(documents));
    return documents;
  } catch {
    return [];
  }
}

function saveDictationDocuments() {
  dictationDocuments = dictationDocuments
    .filter((entry) => entry && entry.text && entry.date === today)
    .sort((first, second) => String(second.recordedAt).localeCompare(String(first.recordedAt)));
  localStorage.setItem(dictationDocumentStoreKey, JSON.stringify(dictationDocuments));
}

function saveDictationDocument(text, source = "dictation", extraction = null) {
  const documentEntry = {
    id: createHabitId(),
    date: today,
    recordedAt: new Date().toISOString(),
    source,
    text: String(text || "").trim(),
    extraction: extraction || null
  };
  dictationDocuments = [documentEntry, ...dictationDocuments];
  saveDictationDocuments();
  return documentEntry;
}

function getSymptomHistoryEntries() {
  return symptomEntries
    .filter((entry) => entry.date >= getSymptomHistoryCutoffKey())
    .sort((first, second) => second.date.localeCompare(first.date));
}

function getMoodHistoryEntries() {
  return moodEntries
    .filter((entry) => entry.date >= getSymptomHistoryCutoffKey())
    .sort((first, second) => second.date.localeCompare(first.date));
}

function getSymptomHistoryCutoffKey() {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - HISTORY_RETENTION_DAYS);
  return toDateKey(cutoff);
}

function formatSymptomHistoryDate(dateKey) {
  const date = new Date(`${dateKey}T00:00:00`);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function loadAppSettings() {
  try {
    const savedSettings = JSON.parse(localStorage.getItem(settingsStoreKey) || "{}");
    const settings = {
      theme: "dark",
      remindersEnabled: false,
      reminderTime: "09:00",
      heightInches: 0,
      securitySalt: "",
      securityHash: "",
      biometricEnabled: false,
      biometricCredentialId: "",
      facebookUserId: "",
      initialDataComplete: hasSavedSettings,
      aiExtractionEnabled: false,
      hipaaCloudConfirmed: false,
      aiApiKey: "",
      aiBackendUrl: DEFAULT_AI_BACKEND_URL,
      aiBackendToken: "",
      aiModel: "gpt-4o-mini",
      ...savedSettings
    };
    settings.aiApiKey = "";
    settings.aiBackendUrl = normalizeAiBackendUrlInput(settings.aiBackendUrl || "", { silent: true });
    localStorage.setItem(aiDefaultEnabledStoreKey, "done");
    if (!settings.hipaaCloudConfirmed) settings.aiExtractionEnabled = false;
    if (!settings.aiBackendUrl) settings.aiExtractionEnabled = false;
    return settings;
  } catch {
    return {
      theme: "dark",
      remindersEnabled: false,
      reminderTime: "09:00",
      heightInches: 0,
      securitySalt: "",
      securityHash: "",
      biometricEnabled: false,
      biometricCredentialId: "",
      facebookUserId: "",
      initialDataComplete: hasSavedSettings,
      aiExtractionEnabled: false,
      hipaaCloudConfirmed: false,
      aiApiKey: "",
      aiBackendUrl: DEFAULT_AI_BACKEND_URL,
      aiBackendToken: "",
      aiModel: "gpt-4o-mini"
    };
  }
}

function saveAppSettings() {
  localStorage.setItem(settingsStoreKey, JSON.stringify(appSettings));
}

function applySettings() {
  document.body.dataset.theme = appSettings.theme === "light" ? "light" : "dark";
  renderSettings();
}

function renderSettings() {
  themeToggle.checked = appSettings.theme === "dark";
  reminderToggle.checked = Boolean(appSettings.remindersEnabled);
  reminderTime.value = hasOwnSetting("reminderTime") ? appSettings.reminderTime : "";
  const totalHeight = Number(appSettings.heightInches) || 0;
  heightFeet.value = totalHeight ? String(Math.floor(totalHeight / 12)) : "";
  heightInches.value = totalHeight ? String(totalHeight % 12) : "";
  biometricToggle.checked = Boolean(appSettings.biometricEnabled && appSettings.biometricCredentialId);
  if (hipaaCloudToggle) hipaaCloudToggle.checked = Boolean(appSettings.hipaaCloudConfirmed);
  aiExtractionToggle.disabled = !appSettings.hipaaCloudConfirmed;
  aiExtractionToggle.checked = Boolean(appSettings.aiExtractionEnabled);
  aiApiKey.value = "";
  aiApiKey.disabled = true;
  aiBackendUrl.value = hasOwnSetting("aiBackendUrl") ? appSettings.aiBackendUrl || "" : "";
  aiBackendToken.value = appSettings.aiBackendToken || "";
  aiModel.value = hasOwnSetting("aiModel") ? appSettings.aiModel || "" : "";
  biometricToggle.disabled = !isAppLockEnabled();
  clearPasswordButton.disabled = !isAppLockEnabled();
  clearPasswordButton.textContent = appSettings.biometricCredentialId && !appSettings.securityHash ? "Clear app lock" : "Clear password";
  securityPasswordCurrent.value = "";
  securityPasswordNew.value = "";
  filterSettings();
}

function hasOwnSetting(key) {
  try {
    const savedSettings = JSON.parse(localStorage.getItem(settingsStoreKey) || "{}");
    return Object.prototype.hasOwnProperty.call(savedSettings, key);
  } catch {
    return false;
  }
}

function filterSettings() {
  const query = (settingsSearch?.value || "").trim().toLowerCase();
  document.querySelectorAll(".settings-grid > *").forEach((item) => {
    item.hidden = Boolean(query) && !item.textContent.toLowerCase().includes(query);
  });
}

function setSettingsPasswordFieldTypes(type) {
  securityPasswordCurrent.type = type;
  securityPasswordNew.type = type;
}

function updateSetting(key, value) {
  if (key === "aiApiKey") value = "";
  if (key === "aiBackendUrl") value = normalizeAiBackendUrlInput(value);
  appSettings = { ...appSettings, [key]: value };
  if (key === "hipaaCloudConfirmed" && !value) {
    appSettings.aiExtractionEnabled = false;
  }
  if ((key === "aiExtractionEnabled" && value && !appSettings.hipaaCloudConfirmed) || (key === "aiBackendUrl" && !value)) {
    appSettings.aiExtractionEnabled = false;
  }
  appSettings.aiApiKey = "";
  saveAppSettings();
  applySettings();
  if (key === "remindersEnabled" && value) {
    requestNotificationPermission();
    checkTaskReminder();
  }
}

function updateCloudAiSharing(allowed) {
  appSettings = {
    ...appSettings,
    hipaaCloudConfirmed: allowed,
    aiExtractionEnabled: allowed && getConfiguredAiBackendUrl() ? appSettings.aiExtractionEnabled : false,
    aiApiKey: ""
  };
  saveAppSettings();
  applySettings();
}

function normalizeAiBackendUrlInput(value, options = {}) {
  const trimmed = String(value || "").trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") {
      if (!options.silent) showToast("AI backend URL must start with https://");
      return "";
    }
    return url.toString().replace(/\/+$/, "");
  } catch {
    if (!options.silent) showToast("Enter a valid HTTPS AI backend URL.");
    return "";
  }
}

function getConfiguredAiBackendUrl() {
  return normalizeAiBackendUrlInput(appSettings.aiBackendUrl || "", { silent: true });
}

function updateHeightSetting() {
  const feet = Number(heightFeet.value) || 0;
  const inches = Number(heightInches.value) || 0;
  updateSetting("heightInches", feet * 12 + inches);
}

function isAppLockEnabled() {
  return Boolean(appSettings && (
    (appSettings.securityHash && appSettings.securitySalt)
    || appSettings.biometricCredentialId
    || appSettings.facebookUserId
  ));
}

async function setAppPassword() {
  const currentPassword = securityPasswordCurrent.value;
  const newPassword = securityPasswordNew.value;
  if (newPassword.length < 4) {
    window.alert("Use at least 4 characters for the app password.");
    return;
  }
  if (isAppLockEnabled() && !(await verifyAppPassword(currentPassword))) {
    window.alert("Current password is incorrect.");
    return;
  }
  const salt = createSecurityToken(18);
  const hash = await hashSecurityPassword(newPassword, salt);
  appSettings = {
    ...appSettings,
    securitySalt: salt,
    securityHash: hash,
    biometricEnabled: false,
    biometricCredentialId: "",
    facebookUserId: ""
  };
  saveAppSettings();
  appUnlocked = true;
  lockModal.hidden = true;
  renderSettings();
  window.alert("App password is set. Turn on biometric unlock if you want to use the phone's face or fingerprint unlock.");
}

async function clearAppPassword() {
  if (!isAppLockEnabled()) return;
  if (appSettings.securityHash) {
    if (!(await verifyAppPassword(securityPasswordCurrent.value))) {
      window.alert("Enter the current password to clear app security.");
      return;
    }
  } else if (appSettings.biometricCredentialId) {
    try {
      await verifyBiometricCredential();
    } catch {
      window.alert("Biometric unlock was canceled or unavailable.");
      return;
    }
  }
  appSettings = {
    ...appSettings,
    securitySalt: "",
    securityHash: "",
    biometricEnabled: false,
    biometricCredentialId: "",
    facebookUserId: ""
  };
  saveAppSettings();
  appUnlocked = true;
  lockModal.hidden = true;
  renderSettings();
}

async function updateBiometricSetting() {
  if (!biometricToggle.checked) {
    appSettings = { ...appSettings, biometricEnabled: false, biometricCredentialId: "" };
    saveAppSettings();
    renderSettings();
    return;
  }
  if (!isAppLockEnabled()) {
    window.alert("Set an app password before enabling biometric unlock.");
    renderSettings();
    return;
  }
  const confirmedPassword = await promptForPasswordConfirmation("Enter your app password to enable biometric unlock.");
  if (!confirmedPassword) {
    renderSettings();
    return;
  }
  try {
    const credentialId = await registerBiometricCredential();
    appSettings = { ...appSettings, biometricEnabled: true, biometricCredentialId: credentialId };
    saveAppSettings();
    renderSettings();
  } catch {
    appSettings = { ...appSettings, biometricEnabled: false, biometricCredentialId: "" };
    saveAppSettings();
    renderSettings();
    window.alert("Biometric unlock is not available on this device or was canceled.");
  }
}

async function promptForPasswordConfirmation(message) {
  confirmPasswordMessage.textContent = message;
  confirmPasswordError.textContent = "";
  confirmPasswordInput.value = "";
  confirmPasswordModal.hidden = false;
  window.setTimeout(() => confirmPasswordInput.focus(), 80);
  return new Promise((resolve) => {
    confirmPasswordResolver = resolve;
  });
}

async function submitConfirmPasswordDialog() {
  if (!confirmPasswordResolver) return;
  if (await verifyAppPassword(confirmPasswordInput.value)) {
    closeConfirmPasswordDialog(true);
    return;
  }
  confirmPasswordError.textContent = "Password is incorrect.";
  confirmPasswordInput.select();
}

function closeConfirmPasswordDialog(confirmed) {
  if (!confirmPasswordResolver) return;
  const resolve = confirmPasswordResolver;
  confirmPasswordResolver = null;
  confirmPasswordInput.value = "";
  confirmPasswordError.textContent = "";
  confirmPasswordModal.hidden = true;
  resolve(confirmed);
}

function showAppLock() {
  appUnlocked = false;
  lockError.textContent = "";
  lockPassword.value = "";
  document.querySelector("#lockTitle").textContent = "Unlock app";
  lockPasswordField.querySelector("span").textContent = "Password";
  lockPassword.autocomplete = "current-password";
  lockPassword.placeholder = "Password";
  lockPasswordField.hidden = !appSettings.securityHash;
  unlockButton.hidden = !appSettings.securityHash;
  setupPasswordButton.hidden = true;
  setupBiometricButton.hidden = true;
  resetPasswordButton.hidden = false;
  facebookLoginButton.hidden = !appSettings.facebookUserId;
  biometricUnlockButton.hidden = !appSettings.biometricCredentialId;
  lockModal.hidden = false;
  if (appSettings.biometricCredentialId && !biometricPromptAttempted) {
    biometricPromptAttempted = true;
    window.setTimeout(() => unlockWithBiometric(), 120);
  } else if (appSettings.securityHash) {
    window.setTimeout(() => lockPassword.focus(), 100);
  }
}

function lockAppAfterBackground() {
  appUnlocked = false;
  biometricPromptAttempted = false;
  lockPassword.value = "";
  lockError.textContent = "";
  lockModal.hidden = false;
  affirmationModal.hidden = true;
}

function showSecuritySetup() {
  appUnlocked = false;
  const canUseBiometric = isNativeBiometricAvailable();
  lockError.textContent = canUseBiometric
    ? "Use Facebook login or your phone biometric/device unlock."
    : "Use Facebook login, or create one app password if biometric unlock is not available.";
  lockPassword.value = "";
  lockPasswordField.querySelector("span").textContent = "Create password";
  lockPassword.autocomplete = "new-password";
  lockPassword.placeholder = "4+ characters";
  lockPasswordField.hidden = canUseBiometric;
  unlockButton.hidden = true;
  biometricUnlockButton.hidden = true;
  resetPasswordButton.hidden = true;
  setupPasswordButton.hidden = canUseBiometric;
  setupBiometricButton.hidden = !canUseBiometric;
  facebookLoginButton.hidden = false;
  document.querySelector("#lockTitle").textContent = "Set up app security";
  lockModal.hidden = false;
  if (!canUseBiometric) window.setTimeout(() => lockPassword.focus(), 100);
}

function resetAppSecurityFromLock() {
  const firstConfirm = window.confirm("Reset app security? This will remove the local app password and biometric lock. Your logged health data stays on this device.");
  if (!firstConfirm) return;
  const secondConfirm = window.confirm("Are you sure? You will create a new app password next.");
  if (!secondConfirm) return;
  appSettings = {
    ...appSettings,
    securitySalt: "",
    securityHash: "",
    biometricEnabled: false,
    biometricCredentialId: "",
    facebookUserId: "",
    initialDataComplete: true
  };
  saveAppSettings();
  showSecuritySetup();
  lockError.textContent = "Security was reset. Create a new app password.";
}

async function completeBiometricSecuritySetup() {
  try {
    const credentialId = await registerBiometricCredential();
    appSettings = {
      ...appSettings,
      securitySalt: "",
      securityHash: "",
      biometricEnabled: true,
      biometricCredentialId: credentialId
    };
    saveAppSettings();
    finishUnlock();
  } catch {
    lockError.textContent = "Biometric unlock was canceled or unavailable.";
  }
}

async function completeSecuritySetup() {
  const password = lockPassword.value.trim();
  if (password.length < 4) {
    lockError.textContent = "Use at least 4 characters.";
    lockPassword.focus();
    return;
  }
  const salt = createSecurityToken(18);
  const hash = await hashSecurityPassword(password, salt);
  appSettings = {
    ...appSettings,
    securitySalt: salt,
    securityHash: hash,
    biometricEnabled: false,
    biometricCredentialId: ""
  };
  saveAppSettings();
  lockPassword.value = "";
  finishUnlock();
}

async function unlockWithPassword() {
  if (await verifyAppPassword(lockPassword.value)) {
    finishUnlock();
    return;
  }
  lockError.textContent = "Incorrect password.";
  lockPassword.select();
}

async function unlockWithBiometric() {
  try {
    await verifyBiometricCredential();
    finishUnlock();
  } catch {
    lockError.textContent = "Biometric unlock was canceled or unavailable.";
  }
}

function startFacebookLogin() {
  const state = createSecurityToken(12);
  sessionStorage.setItem("health-task-tracker:facebook-state", state);
  const params = new URLSearchParams({
    client_id: FACEBOOK_APP_ID,
    redirect_uri: FACEBOOK_REDIRECT_URI,
    response_type: "token",
    scope: "public_profile",
    state
  });
  location.href = `https://www.facebook.com/v20.0/dialog/oauth?${params.toString()}`;
}

async function handleFacebookLoginRedirect() {
  const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
  const accessToken = hash.get("access_token");
  if (!accessToken) return false;

  const expectedState = sessionStorage.getItem("health-task-tracker:facebook-state") || "";
  sessionStorage.removeItem("health-task-tracker:facebook-state");
  if (expectedState && hash.get("state") !== expectedState) {
    lockError.textContent = "Facebook login could not be verified.";
    return true;
  }

  try {
    const response = await fetch(`https://graph.facebook.com/me?fields=id&access_token=${encodeURIComponent(accessToken)}`);
    if (!response.ok) throw new Error("Facebook profile check failed.");
    const profile = await response.json();
    const facebookUserId = String(profile.id || "");
    if (!facebookUserId) throw new Error("Facebook did not return a user ID.");
    if (appSettings.facebookUserId && appSettings.facebookUserId !== facebookUserId) {
      lockError.textContent = "That Facebook account is not linked to this app lock.";
      return true;
    }
    appSettings = { ...appSettings, facebookUserId };
    saveAppSettings();
    if (history.replaceState) history.replaceState(null, "", location.pathname + location.search);
    finishUnlock();
  } catch {
    lockError.textContent = "Facebook login was canceled or unavailable.";
  }
  return true;
}

function finishUnlock() {
  appUnlocked = true;
  biometricPromptAttempted = false;
  lockModal.hidden = true;
  lockPassword.value = "";
  scrollAppToTop();
  if (shouldShowInitialDataOnboarding()) {
    startInitialDataOnboarding();
  } else {
    showDailyAffirmation();
  }
}

function shouldShowInitialDataOnboarding() {
  return appUnlocked && appSettings.initialDataComplete === false;
}

function startInitialDataOnboarding() {
  onboardingStepIndex = 0;
  onboardingModal.hidden = false;
  renderInitialDataOnboarding();
}

function startGuidedDataEntry() {
  onboardingStepIndex = 0;
  onboardingModal.hidden = false;
  renderInitialDataOnboarding();
}

function renderInitialDataOnboarding() {
  const steps = getInitialDataSteps();
  const step = steps[onboardingStepIndex];
  onboardingStepLabel.textContent = `${onboardingStepIndex + 1} of ${steps.length}`;
  onboardingTitle.textContent = step.title;
  onboardingCopy.textContent = step.copy;
  onboardingForm.innerHTML = step.fields;
  onboardingActions.innerHTML = "";

  if (DICTATION_FEATURE_ENABLED && step.fields && /<(input|textarea|select)\b/i.test(step.fields) && !/type="checkbox"/i.test(step.fields)) {
    const dictateStepButton = document.createElement("button");
    dictateStepButton.className = "text-button onboarding-dictate-button";
    dictateStepButton.type = "button";
    dictateStepButton.setAttribute("aria-label", "Dictate into setup field");
    dictateStepButton.title = "Dictate";
    dictateStepButton.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Z"></path>
        <path d="M19 11a7 7 0 0 1-14 0"></path>
        <path d="M12 18v4"></path>
        <path d="M8 22h8"></path>
      </svg>
    `;
    dictateStepButton.addEventListener("click", dictateIntoOnboardingField);
    onboardingActions.appendChild(dictateStepButton);
  }

  const skipButton = document.createElement("button");
  skipButton.className = "text-button";
  skipButton.type = "button";
  skipButton.textContent = step.skipText || "Skip";
  skipButton.addEventListener("click", () => goToNextInitialDataStep());

  const nextButton = document.createElement("button");
  nextButton.className = "text-button";
  nextButton.type = "button";
  nextButton.textContent = step.primaryText || "Save and continue";
  nextButton.addEventListener("click", () => {
    if (typeof onboardingForm.requestSubmit === "function") {
      onboardingForm.requestSubmit();
    } else {
      step.save(new FormData(onboardingForm));
    }
  });

  onboardingActions.append(skipButton, nextButton);
  onboardingForm.onsubmit = (event) => {
    event.preventDefault();
    step.save(new FormData(onboardingForm));
  };
}

function dictateIntoOnboardingField(event) {
  const button = event?.currentTarget;
  if (activeOnboardingDictationButton && isNativeDictationAvailable() && typeof window.HealthTaskDictation.stop === "function") {
    window.HealthTaskDictation.stop();
    activeOnboardingDictationButton.classList.remove("is-listening");
    activeOnboardingDictationButton = null;
    return;
  }
  const field = getActiveOnboardingField();
  if (!field) {
    showToast("Tap a setup field first.");
    return;
  }
  if (button) button.classList.add("is-listening");
  activeOnboardingDictationButton = button || null;
  startSimpleDictation()
    .then((text) => applyDictatedTextToOnboardingField(field, text))
    .catch(() => {
      const typed = window.prompt("Dictation was unavailable. Type what to add to this field.", "");
      if (typed && typed.trim()) applyDictatedTextToOnboardingField(field, typed.trim());
    })
    .finally(() => {
      if (activeOnboardingDictationButton) activeOnboardingDictationButton.classList.remove("is-listening");
      activeOnboardingDictationButton = null;
    });
}

function getActiveOnboardingField() {
  const active = document.activeElement;
  if (active && onboardingForm.contains(active) && isOnboardingDictationField(active)) return active;
  return onboardingForm.querySelector("textarea, input:not([type='checkbox']):not([type='hidden']), select");
}

function isOnboardingDictationField(field) {
  return field && ["INPUT", "TEXTAREA", "SELECT"].includes(field.tagName) && field.type !== "checkbox" && field.type !== "hidden";
}

function startSimpleDictation() {
  if (isNativeDictationAvailable()) return startNativeDictation();
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return Promise.reject(new Error("Dictation unavailable"));
  return new Promise((resolve, reject) => {
    const recognition = new SpeechRecognition();
    let transcript = "";
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      transcript = Array.from(event.results || [])
        .map((result) => result?.[0]?.transcript || "")
        .join(" ")
        .trim();
    };
    recognition.onerror = () => reject(new Error("Dictation failed"));
    recognition.onend = () => transcript ? resolve(transcript) : reject(new Error("No speech"));
    try {
      recognition.start();
    } catch (error) {
      reject(error);
    }
  });
}

function applyDictatedTextToOnboardingField(field, text) {
  const dictated = String(text || "").trim();
  if (!dictated || !field) return;
  if (field.tagName === "SELECT") {
    const options = Array.from(field.options).filter((item) => item.textContent.trim());
    const option = options.find((item) => item.textContent.toLowerCase() === dictated.toLowerCase())
      || options.find((item) => dictated.toLowerCase().includes(item.textContent.toLowerCase()));
    if (option) {
      field.value = option.value;
      field.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
  }
  if (field.type === "number" || field.inputMode === "numeric" || field.inputMode === "decimal") {
    const number = Number.parseFloat(replaceSpokenNumbers(dictated.toLowerCase()).match(/\d+(?:\.\d+)?/)?.[0] || "");
    if (Number.isFinite(number)) {
      field.value = String(number);
      field.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
  }
  const separator = field.value && field.tagName === "TEXTAREA" ? " " : "";
  field.value = `${field.value || ""}${separator}${dictated}`.trim();
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

function getInitialDataSteps() {
  const dayOptions = ["<option value=\"\"></option>", ...weekDays.map((day) => `<option value="${day}">${day}</option>`)].join("");
  return [
    {
      title: "AI & Privacy",
      copy: "Cloud AI can help with safety scanning, but it may send your health information over the internet to the AI service you configure.",
      primaryText: "Save and continue",
      skipText: "Not now",
      fields: `
        <label class="setting-row onboarding-wide">
          <span>I understand cloud AI can send my health info over the internet</span>
          <input name="cloudAiAcknowledgement" type="checkbox" ${appSettings.hipaaCloudConfirmed ? "checked" : ""}>
        </label>
        <p class="settings-note onboarding-wide">AI features will not work unless this is checked, Cloud AI features are enabled in Settings, and an HTTPS AI backend URL is saved. OpenAI API keys should stay on the backend.</p>
      `,
      save: (formData) => {
        const acknowledged = formData.get("cloudAiAcknowledgement") === "on";
        updateCloudAiSharing(acknowledged);
        goToNextInitialDataStep();
      }
    },
    {
      title: "Nutrition",
      copy: "Enter what you know for today. Blank fields are fine.",
      fields: `
        <label class="field"><span>Calories (cal)</span><input name="calories" type="number" min="0" step="1" inputmode="numeric"></label>
        <label class="field"><span>Carbs (g)</span><input name="carbs" type="number" min="0" step="1" inputmode="numeric"></label>
        <label class="field"><span>Weight (lbs)</span><input name="weight" type="number" min="0" step="0.1" inputmode="decimal"></label>
        <label class="field"><span>Ketosis phase</span><select name="ketosisPhase"><option value=""></option><option>Entering</option><option>Ketosis</option><option>Deep ketosis</option><option>Exiting</option></select></label>
      `,
      save: (formData) => {
        saveInitialNutrition({
          calories: parseOnboardingNumber(formData.get("calories")),
          carbs: parseOnboardingNumber(formData.get("carbs")),
          weight: parseOnboardingNumber(formData.get("weight")),
          ketosisPhase: String(formData.get("ketosisPhase") || "") || null
        });
        goToNextInitialDataStep();
      }
    },
    {
      title: "Vitals",
      copy: "Add glucose and blood pressure if you have them.",
      fields: `
        <label class="field"><span>Glucose (mg/dL)</span><input name="glucose" type="number" min="0" step="1" inputmode="numeric"></label>
        <label class="field"><span>Systolic blood pressure (mmHg)</span><input name="systolic" type="number" min="0" step="1" inputmode="numeric"></label>
        <label class="field"><span>Diastolic blood pressure (mmHg)</span><input name="diastolic" type="number" min="0" step="1" inputmode="numeric"></label>
      `,
      save: (formData) => {
        saveInitialNutrition({
          glucose: parseOnboardingNumber(formData.get("glucose")),
          systolic: parseOnboardingNumber(formData.get("systolic")),
          diastolic: parseOnboardingNumber(formData.get("diastolic"))
        });
        goToNextInitialDataStep();
      }
    },
    {
      title: "Water",
      copy: `Record today's water. Your current goal is ${formatWholeNumber(getDailyWaterGoal())} oz.`,
      fields: `<label class="field"><span>Water (oz)</span><input name="water" type="number" min="0" step="1" inputmode="numeric"></label>`,
      save: (formData) => {
        saveInitialNutrition({ water: parseOnboardingNumber(formData.get("water")) });
        goToNextInitialDataStep();
      }
    },
    {
      title: "Mood",
      copy: "Log how you feel right now.",
      fields: `
        <label class="field"><span>Mood</span><select name="mood"><option value=""></option><option>Good</option><option>Okay</option><option>Low</option><option>Stressed</option><option>Anxious</option></select></label>
        <label class="field"><span>Intensity</span><select name="intensity"><option value=""></option><option>Mild</option><option>Moderate</option><option>Strong</option></select></label>
        <label class="field onboarding-wide"><span>Notes</span><textarea name="note" rows="3" placeholder="Anything affecting your mood?"></textarea></label>
      `,
      save: (formData) => {
        moodEntries = [{
          id: createHabitId(),
          date: today,
          recordedAt: new Date().toISOString(),
          name: String(formData.get("mood") || "Okay"),
          intensity: String(formData.get("intensity") || "Moderate"),
          note: String(formData.get("note") || "").trim()
        }, ...moodEntries];
        saveMoodEntries();
        renderMoods();
        goToNextInitialDataStep();
      }
    },
    {
      title: "Symptoms",
      copy: "Add one symptom if anything is going on today.",
      fields: `
        <label class="field"><span>Symptom</span><input name="symptom" type="text" placeholder="Headache"></label>
        <label class="field"><span>Severity</span><select name="severity"><option value=""></option><option>Mild</option><option>Moderate</option><option>Severe</option></select></label>
        <label class="field onboarding-wide"><span>Notes</span><textarea name="note" rows="3" placeholder="When it started, triggers, or details"></textarea></label>
      `,
      save: (formData) => {
        const name = String(formData.get("symptom") || "").trim();
        if (name) {
          symptomEntries = [{
            id: createHabitId(),
            date: today,
            recordedAt: new Date().toISOString(),
            name,
            severity: String(formData.get("severity") || "Mild"),
            note: String(formData.get("note") || "").trim()
          }, ...symptomEntries];
          saveSymptomEntries();
          renderSymptoms();
          renderSymptomHistory();
        }
        goToNextInitialDataStep();
      }
    },
    {
      title: "Journal",
      copy: "Make a private starting journal entry if you want one.",
      fields: `<label class="field onboarding-wide"><span>Journal entry</span><textarea name="journal" rows="5"></textarea></label>`,
      save: (formData) => {
        const text = String(formData.get("journal") || "").trim();
        if (text) {
          journalEntries = [{ id: createHabitId(), date: today, text }, ...journalEntries];
          saveJournalEntries();
          renderJournal();
        }
        goToNextInitialDataStep();
      }
    },
    {
      title: "Tasks",
      copy: "Enter a starting task, or finish setup without one.",
      primaryText: "Add task",
      skipText: "Finish setup",
      fields: `
        <label class="field onboarding-wide"><span>Task</span><input name="task" type="text" placeholder="Walk for 10 minutes"></label>
        <label class="field"><span>Day</span><select name="day">${dayOptions}</select></label>
        <label class="field"><span>Deadline</span><input name="deadline" type="time"></label>
        <label class="field onboarding-wide"><span>Notes</span><textarea name="note" rows="3" placeholder="Anything important about this task?"></textarea></label>
      `,
      save: (formData) => {
        const name = String(formData.get("task") || "").trim();
        if (!name) {
          finishInitialDataOnboarding();
          return;
        }
        habits = [{
          id: createHabitId(),
          name,
          day: String(formData.get("day") || weekDays[new Date().getDay()]),
          category: "General",
          time: "",
          deadline: normalizeTaskTime(String(formData.get("deadline") || "")),
          priority: "Normal",
          color: "#1e40af",
          note: String(formData.get("note") || "").trim(),
          completions: []
        }, ...habits];
        saveHabits();
        render();
        onboardingForm.reset();
        onboardingCopy.textContent = "Task added. Add another task, or finish setup.";
      }
    }
  ];
}

function parseOnboardingNumber(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function saveInitialNutrition(partial) {
  const existing = nutritionEntries.find((entry) => entry.date === today) || {};
  const entry = {
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
  };
  nutritionEntries = [
    entry,
    ...nutritionEntries.filter((item) => item.date !== today)
  ].sort((first, second) => second.date.localeCompare(first.date));
  saveNutritionEntries();
  renderNutrition();
  renderGraph();
  renderTodayDashboard();
  scheduleSmartCoachRender();
}

function goToNextInitialDataStep() {
  onboardingStepIndex += 1;
  if (onboardingStepIndex >= getInitialDataSteps().length) {
    finishInitialDataOnboarding();
    return;
  }
  renderInitialDataOnboarding();
}

function finishInitialDataOnboarding() {
  appSettings = { ...appSettings, initialDataComplete: true };
  saveAppSettings();
  onboardingModal.hidden = true;
  render();
  showDailyAffirmation();
}

function closeInitialDataOnboarding() {
  appSettings = { ...appSettings, initialDataComplete: true };
  saveAppSettings();
  onboardingModal.hidden = true;
  render();
}

async function verifyAppPassword(password) {
  if (!isAppLockEnabled()) return true;
  const exactHash = await hashSecurityPassword(password, appSettings.securitySalt);
  if (exactHash === appSettings.securityHash) return true;
  const trimmed = String(password || "").trim();
  if (trimmed === password) return false;
  const trimmedHash = await hashSecurityPassword(trimmed, appSettings.securitySalt);
  return trimmedHash === appSettings.securityHash;
}

async function hashSecurityPassword(password, salt) {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bytesToBase64Url(new Uint8Array(digest));
}

async function registerBiometricCredential() {
  if (isNativeBiometricAvailable()) {
    await authenticateWithNativeBiometric();
    return "native";
  }
  if (!window.PublicKeyCredential || !navigator.credentials) throw new Error("No biometric API");
  const userId = crypto.getRandomValues(new Uint8Array(16));
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "Health & Task Tracker" },
      user: { id: userId, name: "local-user", displayName: "Health & Task Tracker" },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { userVerification: "required" },
      timeout: 60000
    }
  });
  if (!credential || !credential.rawId) throw new Error("No credential");
  return bytesToBase64Url(new Uint8Array(credential.rawId));
}

async function verifyBiometricCredential() {
  if (appSettings.biometricCredentialId === "native" && isNativeBiometricAvailable()) {
    return authenticateWithNativeBiometric();
  }
  if (!window.PublicKeyCredential || !navigator.credentials || !appSettings.biometricCredentialId) throw new Error("No biometric API");
  return navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{
        type: "public-key",
        id: base64UrlToBytes(appSettings.biometricCredentialId)
      }],
      userVerification: "required",
      timeout: 60000
    }
  });
}

function isNativeBiometricAvailable() {
  return Boolean(window.HealthTaskSecurity && typeof window.HealthTaskSecurity.authenticate === "function" && window.HealthTaskSecurity.isAvailable());
}

function authenticateWithNativeBiometric() {
  return new Promise((resolve, reject) => {
    if (!isNativeBiometricAvailable()) {
      reject(new Error("Native biometric unavailable"));
      return;
    }
    const callbackId = createSecurityToken(12);
    window.__nativeBiometricCallbacks = window.__nativeBiometricCallbacks || {};
    window.__nativeBiometricCallbacks[callbackId] = { resolve, reject };
    window.__nativeBiometricResult = (id, success, message) => {
      const callback = window.__nativeBiometricCallbacks && window.__nativeBiometricCallbacks[id];
      if (!callback) return;
      delete window.__nativeBiometricCallbacks[id];
      if (success) {
        callback.resolve(true);
      } else {
        callback.reject(new Error(message || "Native biometric canceled"));
      }
    };
    window.HealthTaskSecurity.authenticate(callbackId);
  });
}

function createSecurityToken(byteLength) {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

function bytesToBase64Url(bytes) {
  let value = "";
  bytes.forEach((byte) => {
    value += String.fromCharCode(byte);
  });
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

function exportAppData() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    tasks: habits,
    nutritionEntries,
    symptomEntries,
    moodEntries,
    journalEntries,
    dictationDocuments,
    taskDeadlineEvents,
    settings: getExportSafeSettings()
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `health-task-tracker-${today}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  localStorage.setItem(backupReminderStoreKey, today);
  showToast("Backup exported.");
}

function getExportSafeSettings() {
  const {
    aiApiKey,
    aiBackendToken,
    securityHash,
    securitySalt,
    biometricCredentialId,
    ...safeSettings
  } = appSettings;
  return {
    ...safeSettings,
    aiApiKey: "",
    aiBackendToken: "",
    securityHash: "",
    securitySalt: "",
    biometricCredentialId: ""
  };
}

function importAppData(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const data = JSON.parse(String(reader.result || "{}"));
      if (!window.confirm("Import this backup and replace current app data?")) return;
      habits = Array.isArray(data.tasks) ? data.tasks : Array.isArray(data.habits) ? data.habits : habits;
      nutritionEntries = Array.isArray(data.nutritionEntries) ? data.nutritionEntries : nutritionEntries;
      symptomEntries = Array.isArray(data.symptomEntries) ? data.symptomEntries : symptomEntries;
      moodEntries = Array.isArray(data.moodEntries) ? data.moodEntries : moodEntries;
      journalEntries = Array.isArray(data.journalEntries) ? data.journalEntries : journalEntries;
      dictationDocuments = Array.isArray(data.dictationDocuments) ? data.dictationDocuments : dictationDocuments;
      taskDeadlineEvents = Array.isArray(data.taskDeadlineEvents) ? data.taskDeadlineEvents : taskDeadlineEvents;
      appSettings = { ...appSettings, ...(data.settings || {}) };
      saveHabits();
      saveNutritionEntries();
      saveSymptomEntries();
      saveMoodEntries();
      saveJournalEntries();
      saveDictationDocuments();
      saveTaskDeadlineEvents();
      saveAppSettings();
      applySettings();
      render();
      settingsModal.hidden = true;
    } catch {
      window.alert("That backup file could not be imported.");
    } finally {
      importDataFile.value = "";
    }
  });
  reader.readAsText(file);
}

function masterResetAppData() {
  if (!window.confirm("Master reset will permanently clear all tasks, nutrition, vitals, water, symptoms, moods, journal entries, settings, password, and AI settings from this device. Continue?")) {
    return;
  }
  const confirmation = window.prompt("Type RESET to confirm master reset.", "");
  if (confirmation !== "RESET") {
    window.alert("Master reset canceled.");
    return;
  }
  localStorage.clear();
  window.alert("Master reset complete. The app will restart.");
  window.location.reload();
}

function requestNotificationPermission() {
  if (isNativeNotificationAvailable()) {
    window.HealthTaskNotifications.requestPermission();
    return;
  }
  if (!("Notification" in window) || Notification.permission !== "default") return;
  Notification.requestPermission();
}

function isNativeNotificationAvailable() {
  return Boolean(window.HealthTaskNotifications && typeof window.HealthTaskNotifications.notify === "function");
}

function checkTaskReminder() {
  if (!appSettings.remindersEnabled) return;
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const reminderKey = `${today}-${appSettings.reminderTime}`;
  if (currentTime !== (appSettings.reminderTime || "09:00") || lastReminderKey === reminderKey) return;
  const remaining = habits.filter((habit) => isTaskScheduledForDate(habit, today) && !habit.completions.includes(today));
  if (!remaining.length) return;
  lastReminderKey = reminderKey;
  sendAppNotification(
    "Health & Task Tracker",
    `${remaining.length} task${remaining.length === 1 ? "" : "s"} left today.`,
    `daily:${reminderKey}`
  );
}

function checkTaskDeadlineReminders() {
  const now = new Date();
  const upcoming = getDeadlineOccurrences(now);
  upcoming.forEach((occurrence) => {
    const remaining = occurrence.dueAt.getTime() - now.getTime();
    if (remaining > 24 * 60 * 60 * 1000 && remaining <= 48 * 60 * 60 * 1000) {
      sendDeadlineNotification(occurrence, "48h");
    } else if (remaining > 0 && remaining <= 24 * 60 * 60 * 1000) {
      sendDeadlineNotification(occurrence, "24h");
    } else if (remaining <= 0) {
      sendDeadlineNotification(occurrence, "overdue");
      recordDeadlineMiss(occurrence);
    }
  });
}

function getDeadlineOccurrences(now) {
  const occurrences = [];
  for (let offset = 0; offset <= 2; offset += 1) {
    const date = new Date(now);
    date.setDate(date.getDate() + offset);
    const dateKey = toDateKey(date);
    habits
      .filter((habit) => isTaskScheduledForDate(habit, dateKey) && normalizeTaskTime(habit.deadline) && !habit.completions.includes(dateKey))
      .forEach((habit) => {
        occurrences.push({
          habit,
          dateKey,
          dueAt: getTaskDeadlineDate(dateKey, habit.deadline)
        });
      });
  }
  return occurrences.filter((occurrence) => occurrence.dueAt);
}

function getCurrentOverdueTasks(now) {
  return getDeadlineOccurrences(now).filter((occurrence) => occurrence.dueAt <= now);
}

function getUpcomingDeadlineTasks(now) {
  return getDeadlineOccurrences(now)
    .filter((occurrence) => occurrence.dueAt > now && occurrence.dueAt.getTime() - now.getTime() <= 48 * 60 * 60 * 1000)
    .sort((first, second) => first.dueAt - second.dueAt);
}

function getTaskDeadlineDate(dateKey, deadline) {
  const time = normalizeTaskTime(deadline);
  if (!time) return null;
  const [hours, minutes] = time.split(":").map(Number);
  const date = parseDateKey(dateKey);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function sendDeadlineNotification(occurrence, type) {
  const key = `${occurrence.dateKey}:${occurrence.habit.id}:${type}`;
  if (deadlineAlertKeys.has(key)) return;
  deadlineAlertKeys.add(key);
  saveDeadlineAlertKeys();
  const titleByType = {
    "48h": "Task deadline in 48 hours",
    "24h": "Task deadline in 24 hours",
    overdue: "Task deadline passed"
  };
  const body = type === "overdue"
    ? `${occurrence.habit.name} is still open after its ${formatTaskTime(occurrence.habit.deadline)} deadline.`
    : `${occurrence.habit.name} is due ${formatTaskTime(occurrence.habit.deadline)} on ${formatSymptomHistoryDate(occurrence.dateKey)}.`;
  sendAppNotification(titleByType[type], body, key);
}

function checkUpcomingTaskReminders() {
  if (!appSettings.remindersEnabled) return;
  const next = getUpcomingTaskReminderCandidates(new Date(), 5)[0];
  if (!next) return;
  const key = `${next.dateKey}:${next.habit.id}:soon`;
  if (deadlineAlertKeys.has(key)) return;
  deadlineAlertKeys.add(key);
  saveDeadlineAlertKeys();
  const when = next.offset === 1 ? "tomorrow" : `${next.dayName} (${formatSymptomHistoryDate(next.dateKey)})`;
  sendAppNotification(
    next.missedBefore ? "Remember this task" : "Upcoming task",
    next.missedBefore
      ? `${next.habit.name} is coming up ${when}. You missed it before, so set it up early.`
      : `${next.habit.name} is coming up ${when}.`,
    key
  );
}

function recordDeadlineMiss(occurrence) {
  const exists = taskDeadlineEvents.some((event) => event.taskId === occurrence.habit.id && event.date === occurrence.dateKey);
  if (exists) return;
  taskDeadlineEvents = [{
    taskId: occurrence.habit.id,
    taskName: occurrence.habit.name,
    date: occurrence.dateKey,
    deadline: normalizeTaskTime(occurrence.habit.deadline),
    recordedAt: new Date().toISOString()
  }, ...taskDeadlineEvents];
  saveTaskDeadlineEvents();
}

function getWellbeingTrendAlertKeys() {
  try {
    const saved = JSON.parse(localStorage.getItem(wellbeingTrendAlertStoreKey) || "[]");
    return new Set(Array.isArray(saved) ? saved.filter((key) => typeof key === "string") : []);
  } catch {
    return new Set();
  }
}

function saveWellbeingTrendAlertKeys(keys) {
  localStorage.setItem(wellbeingTrendAlertStoreKey, JSON.stringify([...keys].slice(-80)));
}

function getWellbeingTrendNotificationInsight(source = "wellbeing") {
  const insightCandidates = [
    getLatestJournalEntryInsight(),
    getJournalPatternInsight(),
    getMentalHealthSafetyInsight(),
    getMoodTrendInsight(),
    getSymptomTrendInsight(),
    getWholeAppTrendInsight()
  ].filter(Boolean);

  return insightCandidates.find((insight) =>
    insight.tone === "care" ||
    /journal|mood|symptom|stress|safety|support|depression|declining|increasing|pattern|thought|crisis|self-harm|suicide/i.test(`${insight.title} ${insight.body} ${source}`)
  ) || null;
}

function getWellbeingTrendNotificationBody(insight) {
  const text = `${insight.title} ${insight.body}`;
  if (/\b(suicide|self-harm|self harm|crisis|immediate danger|988|call 911|text 911)\b/i.test(text)) {
    return "AI Coach noticed a serious safety warning. If you might hurt yourself or are in danger, call 911 now, text 911 if available, call or text 988 for suicide prevention support, or call a trusted friend.";
  }
  if (/\b(depression|depressed|low mood|mood trend declining|heavy|worthless|hopeless|trusted person)\b/i.test(text)) {
    return "AI Coach noticed a worrying mood trend. Is there anything that can be done to help? If it feels urgent, call 911 now or text 911 if available. For suicide prevention support in the U.S., call or text 988.";
  }
  return `${insight.title}. Is there anything that can be done to help right now? Open AI Coach for the next step.`;
}

function maybeSendWellbeingTrendNotification(source = "wellbeing") {
  const insight = getWellbeingTrendNotificationInsight(source);
  if (!insight) return;
  const key = `${today}:${source}:${insight.title}`;
  const isCrisisInsight = /\b(suicide|self-harm|self harm|crisis|immediate danger|call 911|text 911)\b/i.test(`${insight.title} ${insight.body}`);
  const sent = getWellbeingTrendAlertKeys();
  if (sent.has(key) && !isCrisisInsight) return;
  sent.add(key);
  saveWellbeingTrendAlertKeys(sent);
  requestNotificationPermission();
  sendAppNotification("AI Coach check-in", getWellbeingTrendNotificationBody(insight), `wellbeing:${key}`);
}

function sendAppNotification(title, body, tag = "") {
  if (isNativeNotificationAvailable()) {
    window.HealthTaskNotifications.notify(title, body, tag || `${title}:${body}`);
    return;
  }
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body });
  } else if (!("Notification" in window) || Notification.permission === "denied") {
    window.alert(`${title}\n${body}`);
  } else {
    requestNotificationPermission();
  }
}
