/*
 * Health & Task Tracker main client script.
 *
 * Editing map:
 * 1. Constants and safety/dictation patterns
 * 2. Mutable app state and DOM references
 * 3. Event wiring
 * 4. Feature renderers and dialogs
 * 5. Persistence, settings, security, import/export
 * 6. Notifications, AI, dictation parsing, and utility helpers
 *
 * Keep iphone/app.js mirrored when changing shared web behavior, then sync
 * root assets into www/ and android/app/src/main/assets/public before building.
 */

const storeKey = "habit-tracker:v1";
const nutritionStoreKey = "habit-tracker:nutrition:v1";
const symptomStoreKey = "health-task-tracker:symptoms:v1";
const moodStoreKey = "health-task-tracker:moods:v1";
const journalStoreKey = "health-task-tracker:journal:v1";
const deletedJournalEntriesStoreKey = "health-task-tracker:journal-deleted:v1";
const dictationDocumentStoreKey = "health-task-tracker:dictation-documents:v1";
const settingsStoreKey = "health-task-tracker:settings:v1";
const aiDefaultEnabledStoreKey = "health-task-tracker:ai-default-enabled:v1";
const backupReminderStoreKey = "health-task-tracker:last-backup-reminder:v1";
const affirmationShownStoreKey = "health-task-tracker:last-affirmation:v1";
const affirmationDepressionShownStoreKey = "health-task-tracker:last-depression-affirmation:v1";
const DEFAULT_AI_BACKEND_URL = "https://habit-tracker-1-lp0z.onrender.com";
const DICTATION_FEATURE_ENABLED = true;
const AI_DICTATION_TIMEOUT_MS = 1800;
const AI_COACH_TIMEOUT_MS = 2500;
const AI_SAFETY_SCAN_TIMEOUT_MS = 6000;
const HISTORY_RETENTION_DAYS = 3650;
const deadlineAlertStoreKey = "health-task-tracker:deadline-alerts:v1";
const deadlineEventStoreKey = "health-task-tracker:deadline-events:v1";
const wellbeingTrendAlertStoreKey = "health-task-tracker:wellbeing-trend-alerts:v1";
const hasSavedSettings = localStorage.getItem(settingsStoreKey) !== null;
const dailyAffirmations = [
  "I can meet this day with patience and steady effort.",
  "My choices today can support the person I am becoming.",
  "I am allowed to begin again with a clear mind.",
  "Small steps still count, and I can take the next one.",
  "I can care for my body without being hard on myself.",
  "I have handled difficult days before, and I can handle this one.",
  "I can focus on what is useful, kind, and true.",
  "My progress does not have to be perfect to be real.",
  "I can pause, breathe, and choose my next action.",
  "I am worthy of care, rest, and respect.",
  "I can trust myself to keep showing up.",
  "Today, I choose one good thing and give it my attention.",
  "I can be honest with myself and still be gentle.",
  "My effort matters, even when results take time.",
  "I can make room for calm in the middle of a busy day.",
  "I am building a life that supports my health.",
  "I can let go of what I do not need to carry.",
  "The next right step is enough for now.",
  "I can treat myself like someone worth helping.",
  "I am learning, adjusting, and moving forward.",
  "My body deserves care and my mind deserves peace.",
  "I can choose consistency over pressure.",
  "I am capable of doing hard things with patience.",
  "Today can be simple, grounded, and enough.",
  "I can notice what is good without ignoring what is hard.",
  "I can return to my goals without shame.",
  "Each checked task is proof that I showed up.",
  "I can protect my energy and honor my limits.",
  "I am not behind; I am here, and I can begin.",
  "I can make today healthier one choice at a time.",
  "I deserve encouragement from my own thoughts."
];
const weekDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const crisisMoodPatterns = [
  /\b(kill myself|kill my self|kill me|end my life|take my life|take myself out|off myself|delete myself|unalive myself|unalive me|suicide|suicidal)\b/i,
  /\b(i want to die|want to die|wanna die|wanting to die|wish i was dead|wish i were dead|rather be dead|better off dead|should be dead)\b/i,
  /\b(hurt myself|hurt my self|harm myself|harm my self|self harm|self-harm|cut myself|cut my self|overdose|od on|take all my pills)\b/i,
  /\b(no reason to live|nothing to live for|can't go on|cannot go on|can't keep going|cannot keep going|done living|tired of living)\b/i,
  /\b(planning to die|plan to die|goodbye forever|this is goodbye|last note|final note|won't be here tomorrow|not going to be here tomorrow)\b/i,
  /\b(drive off (a )?(bridge|cliff|road)|jump off (a )?(bridge|building)|hang myself|shoot myself|stab myself|drown myself)\b/i
];
const depressionMoodPatterns = [
  /\b(depressed|depression|hopeless|worthless|empty|numb|trapped|burden|unbearable|pointless|meaningless)\b/i,
  /\b(no energy|can't get out of bed|cannot get out of bed|nothing matters|lost interest|don't care anymore|cant care anymore)\b/i,
  /\b(alone|isolated|withdrawn|ashamed|guilt|crying|despair)\b/i
];
const unhealthyThoughtPatterns = [
  /\b(always|never|everything|nothing|everyone|no one)\b.*\b(fails?|wrong|bad|hates?|hopeless|ruined)\b/i,
  /\b(i am|i'm)\s+(a failure|worthless|useless|broken|a burden|not enough)\b/i,
  /\b(what if|worst case|can't handle|cannot handle|going to fall apart|spiral)\b/i,
  /\b(my fault|blame myself|should have|i ruin|i ruined|i mess everything up)\b/i
];
const journalStressPatterns = [
  /\b(stress|stressed|overwhelmed|over loaded|overloaded|panic|panicky|anxious|anxiety|pressure|can't cope|cannot cope|too much|burned out|burnt out|falling apart)\b/i
];
const journalConcernPatterns = [
  /\b(hate myself|i hate me|feel like a failure|i'?m failing|not worth it|can't do this|cannot do this|done with this|giving up|gave up|shutting down|spiraling|dark thoughts)\b/i,
  /\b(i'?m tired of|tired of everything|nothing is working|everything is too much|i feel broken|i feel useless|i feel worthless)\b/i,
  /\b(no one would miss me|everyone would be better without me|better without me|i am a burden|i'm a burden|burden to everyone)\b/i,
  /\b(i disappear|just disappear|wish i could disappear|don't want to exist|do not want to exist|stop existing)\b/i
];
const dictationNormalizationRules = [
  [/\bb\s*p\b|\bbp\b|\bbloodpressure\b|\bblood presure\b|\bblood preasure\b/g, "blood pressure"],
  [/\bblood suger\b|\bblood sug(?:er|ar)\b|\bsuger\b|\bsugar lvl\b|\bsugar level\b/g, "glucose"],
  [/\bgluco(?:s|se|ze)\b|\bglucous\b|\bglukose\b|\bglocos\b/g, "glucose"],
  [/\bcal(?:s|z)?\b|\bcals\b|\bcalorie(?:s|z)?\b|\bcalery\b|\bcaleries\b|\bcallories\b/g, "calories"],
  [/\bcarb(?:s|z)?\b|\bcarbo(?:s|z)?\b|\bcarbo hydrate(?:s|z)?\b|\bcarbohydrates?\b/g, "carbs"],
  [/\bweigh(?:t|ed)?\b|\bwait\b|\bwaight\b|\bwate\b|\blbs?\b|\bpound(?:s|z)?\b/g, "weight"],
  [/\boz\b|\bozs\b|\bounce(?:s|z)?\b|\bounzes\b/g, "ounces"],
  [/\bh20\b|\bh2o\b|\bhydrat(?:e|ion)\b|\bwat(?:er|r)\b/g, "water"],
  [/\bkeytone(?:s)?\b|\bketone(?:s)?\b|\bketo(?:sis)?\b|\bkeeto\b/g, "ketosis"],
  [/\bhead ache\b|\bhedache\b|\bheadake\b|\bmigrane\b/g, "headache"],
  [/\bnause(?:a|ous)\b|\bnauzea\b|\bnausia\b|\bneausea\b/g, "nausea"],
  [/\bdizzy\b|\bdizzyness\b|\bdiz(?:i|y)ness\b/g, "dizziness"],
  [/\bfatique\b|\bfatige\b|\btierd\b|\btired af\b|\bwiped\b|\bexhausted\b/g, "fatigue"],
  [/\bsore thr(?:o|oa)t\b|\bthrought hurts\b|\bthroat hurt(?:s)?\b/g, "sore throat"],
  [/\bstomache ache\b|\bstomachake\b|\btummy ache\b|\bbelly ache\b/g, "stomach ache"],
  [/\bshort of breath\b|\bsob\b|\bcant breathe\b|\bcan't breathe\b/g, "shortness of breath"],
  [/\banx(?:y|ie|ious)?\b|\banxiet(?:y|ie)\b|\bfreaked out\b|\bpanicky\b/g, "anxious"],
  [/\bstressd\b|\bstrest\b|\bstressed out\b|\boverwhelmed\b|\bfrazzled\b/g, "stressed"],
  [/\bmeh\b|\bblah\b|\bmid\b|\bso so\b|\bjust ok\b|\bokayish\b/g, "okay"],
  [/\bdown bad\b|\bbum(?:m)?ed\b|\bsad af\b|\blow mood\b|\bdeprest\b|\bdepressed\b/g, "low"],
  [/\bgr8\b|\bgud\b|\bdoing good\b|\bfeelin good\b/g, "good"],
  [/\bjournal(?:ing)?\b|\bjournel\b|\bjurnal\b|\bnote 2 self\b|\bnote to-self\b/g, "journal"],
  [/\bto[- ]?do\b|\btodo\b|\btudu\b|\bt2do\b|\bremind me 2\b|\bneed 2\b|\bhave 2\b/g, "task"]
];
const today = toDateKey(new Date());
const wholeNumberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const decimalFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
});
let filter = "all";
let habits = loadHabits();
let nutritionEntries = loadNutritionEntries();
let symptomEntries = loadSymptomEntries();
let moodEntries = loadMoodEntries();
let journalEntries = loadJournalEntries();
let dictationDocuments = loadDictationDocuments();
let appSettings = loadAppSettings();
let taskDeadlineEvents = loadTaskDeadlineEvents();
let editingHabitId = null;
let lastReminderKey = "";
let deadlineAlertKeys = loadDeadlineAlertKeys();
let appUnlocked = false;
let hiddenAt = 0;
let onboardingStepIndex = 0;
let dictationActive = false;
let activeWebRecognition = null;
let webDictationBuffer = "";
let webDictationPartial = "";
let webDictationCommitTimer = null;
let webDictationStopping = false;
let nativeDictationStopRequested = false;
let nativeDictationStopTimer = null;
let pendingDictationExtraction = null;
let pendingDictationTranscript = "";
let pendingParsedDictationResult = null;
let pendingParsedDictationDocument = null;
let dictationReviewStepIndex = 0;
let biometricPromptAttempted = false;
let confirmPasswordResolver = null;
let aiCoachCacheKey = "";
let aiCoachInsight = null;
let aiCoachRequestId = 0;
let aiCoachFailedKey = "";
let aiSafetyScanRequestId = 0;
let masterChartRangeDays = HISTORY_RETENTION_DAYS;
let smartCoachRenderTimer = null;
let activeOnboardingDictationButton = null;

function updateDialogScrollLock() {
  const hasOpenDialog = Boolean(document.querySelector(".history-modal:not([hidden]), .affirmation-modal:not([hidden])"));
  document.body.classList.toggle("dialog-open", hasOpenDialog);
}

if ("MutationObserver" in window) {
  const dialogScrollLockObserver = new MutationObserver(updateDialogScrollLock);
  dialogScrollLockObserver.observe(document.body, {
    attributes: true,
    childList: true,
    subtree: true,
    attributeFilter: ["hidden"]
  });
}

updateDialogScrollLock();

const habitForm = document.querySelector("#habitForm");
const habitName = document.querySelector("#habitName");
const taskDate = document.querySelector("#taskDate");
const habitCategory = document.querySelector("#habitCategory");
const habitDeadline = document.querySelector("#habitDeadline");
const habitPriority = document.querySelector("#habitPriority");
const habitColor = document.querySelector("#habitColor");
const habitNote = document.querySelector("#habitNote");
const nutritionForm = document.querySelector("#nutritionForm");
const nutritionDate = document.querySelector("#nutritionDate");
const calories = document.querySelector("#calories");
const carbs = document.querySelector("#carbs");
const weight = document.querySelector("#weight");
const weightUnitLabel = document.querySelector("#weightUnitLabel");
const convertWeight = document.querySelector("#convertWeight");
const ketosisPhase = document.querySelector("#ketosisPhase");
const glucose = document.querySelector("#glucose");
const systolic = document.querySelector("#systolic");
const diastolic = document.querySelector("#diastolic");
const importBloodPressure = document.querySelector("#importBloodPressure");
const water = document.querySelector("#water");
const waterControl = document.querySelector(".water-control");
const waterGlasses = document.querySelector("#waterGlasses");
const waterCount = document.querySelector("#waterCount");
const waterToggle = document.querySelector("#waterToggle");
const waterClear = document.querySelector("#waterClear");
const WATER_GLASS_OZ = 8;
const WATER_GLASS_COUNT = 10;
const DEFAULT_WATER_GOAL_OZ = 80;
const MIN_WATER_GOAL_OZ = 64;
const MAX_WATER_GOAL_OZ = WATER_GLASS_OZ * WATER_GLASS_COUNT;
let waterExpanded = false;
let weightUnit = "lb";
let historyZoomDays = HISTORY_RETENTION_DAYS;
let historyFocusDateKey = today;
const avgCalories = document.querySelector("#avgCalories");
const avgCarbs = document.querySelector("#avgCarbs");
const latestWeight = document.querySelector("#latestWeight");
const latestKetosis = document.querySelector("#latestKetosis");
const latestGlucose = document.querySelector("#latestGlucose");
const latestBloodPressure = document.querySelector("#latestBloodPressure");
const latestWater = document.querySelector("#latestWater");
const nutritionRows = document.querySelector("#nutritionRows");
const nutritionEmpty = document.querySelector("#nutritionEmpty");
const historyButton = document.querySelector("#historyButton");
const vitalsHistoryDropdown = document.querySelector("#vitalsHistoryDropdown");
const vitalsHistoryMount = document.querySelector("#vitalsHistoryMount");
const historyModal = document.querySelector("#historyModal");
const historyClose = document.querySelector("#historyClose");
const historyRows = document.querySelector("#historyRows");
const historyEmpty = document.querySelector("#historyEmpty");
const masterChartButton = document.querySelector("#masterChartButton");
const masterChartModal = document.querySelector("#masterChartModal");
const masterChartClose = document.querySelector("#masterChartClose");
const masterChartRows = document.querySelector("#masterChartRows");
const masterChartEmpty = document.querySelector("#masterChartEmpty");
const masterChartRangeButtons = document.querySelectorAll("[data-master-chart-days]");
const historyChartEmpty = document.querySelector("#historyChartEmpty");
const historyMetricFilter = document.querySelector("#historyMetricFilter");
const historyFocusDate = document.querySelector("#historyFocusDate");
const historyZoomRange = document.querySelector("#historyZoomRange");
const historyZoomLabel = document.querySelector("#historyZoomLabel");
const historyRangeButtons = document.querySelectorAll("[data-history-days]");
const historyLegendButtons = document.querySelectorAll("[data-history-metric]");
const historyGrid = document.querySelector("#historyGrid");
const historyWeightLine = document.querySelector(".history-weight-line");
const historyCaloriesLine = document.querySelector(".history-calories-line");
const historyCarbsLine = document.querySelector(".history-carbs-line");
const historyGlucoseLine = document.querySelector(".history-glucose-line");
const historyPressureLine = document.querySelector(".history-pressure-line");
const historyWaterLine = document.querySelector(".history-water-line");
const habitList = document.querySelector("#habitList");
const habitTemplate = document.querySelector("#habitTemplate");
const emptyState = document.querySelector("#emptyState");
const todayLabel = document.querySelector("#todayLabel");
const weeklyTaskPercentBar = document.querySelector("#weeklyTaskPercentBar");
const weeklyTaskPercentFill = document.querySelector("#weeklyTaskPercentFill");
const weeklyTaskPercentMeta = document.querySelector("#weeklyTaskPercentMeta");
const graphAverage = document.querySelector("#graphAverage");
const affirmationModal = document.querySelector("#affirmationModal");
const affirmationText = document.querySelector("#affirmationText");
const dictationReviewModal = document.querySelector("#dictationReviewModal");
const dictationReviewClose = document.querySelector("#dictationReviewClose");
const dictationReviewText = document.querySelector("#dictationReviewText");
const dictationReviewField = document.querySelector(".dictation-review-field");
const dictationFieldReview = document.querySelector("#dictationFieldReview");
const dictationReviewMessage = document.querySelector("#dictationReviewMessage");
const dictationReviewSave = document.querySelector("#dictationReviewSave");
const dictationReviewRetry = document.querySelector("#dictationReviewRetry");
const dictationReviewManual = document.querySelector("#dictationReviewManual");
const dictationReviewChange = document.querySelector("#dictationReviewChange");
const dictationStatus = document.querySelector("#dictationStatus");
const todayTaskCount = document.querySelector("#todayTaskCount");
const todayCompletedCount = document.querySelector("#todayCompletedCount");
const todayWaterTotal = document.querySelector("#todayWaterTotal");
const todayVitalsSummary = document.querySelector("#todayVitalsSummary");
const todayMoodSummary = document.querySelector("#todayMoodSummary");
const todaySymptomSummary = document.querySelector("#todaySymptomSummary");
const todayWeeklySummary = document.querySelector("#todayWeeklySummary");
const todayWeeklyProgressFill = document.querySelector("#todayWeeklyProgressFill");
const todayTaskList = document.querySelector("#todayTaskList");
const dashboardJumpButtons = document.querySelectorAll("[data-dashboard-jump]");
const aiRefreshButton = document.querySelector("#aiRefreshButton");
const reviewTodayButton = document.querySelector("#reviewTodayButton");
const aiInsightList = document.querySelector("#aiInsightList");
const dictateButton = document.querySelector("#dictateButton");
const getStartedButton = document.querySelector("#getStartedButton");
const settingsButton = document.querySelector("#settingsButton");
const settingsModal = document.querySelector("#settingsModal");
const settingsPanel = document.querySelector(".settings-panel");
const settingsClose = document.querySelector("#settingsClose");
const settingsSearch = document.querySelector("#settingsSearch");
const themeToggle = document.querySelector("#themeToggle");
const reminderToggle = document.querySelector("#reminderToggle");
const reminderTime = document.querySelector("#reminderTime");
const heightFeet = document.querySelector("#heightFeet");
const heightInches = document.querySelector("#heightInches");
const guestModeToggle = document.querySelector("#guestModeToggle");
const biometricToggle = document.querySelector("#biometricToggle");
const aiExtractionToggle = document.querySelector("#aiExtractionToggle");
const hipaaCloudToggle = document.querySelector("#hipaaCloudToggle");
const aiApiKey = document.querySelector("#aiApiKey");
const aiBackendUrl = document.querySelector("#aiBackendUrl");
const aiBackendToken = document.querySelector("#aiBackendToken");
const aiModel = document.querySelector("#aiModel");
const aiTtsModel = document.querySelector("#aiTtsModel");
const aiTtsVoice = document.querySelector("#aiTtsVoice");
const testAiTtsButton = document.querySelector("#testAiTtsButton");
const installTtsVoiceButton = document.querySelector("#installTtsVoiceButton");
const securityPasswordCurrent = document.querySelector("#securityPasswordCurrent");
const securityPasswordNew = document.querySelector("#securityPasswordNew");
const setPasswordButton = document.querySelector("#setPasswordButton");
const clearPasswordButton = document.querySelector("#clearPasswordButton");
const exportDataButton = document.querySelector("#exportDataButton");
const importDataButton = document.querySelector("#importDataButton");
const importDataFile = document.querySelector("#importDataFile");
const masterResetButton = document.querySelector("#masterResetButton");
const lockModal = document.querySelector("#lockModal");
const lockPasswordField = document.querySelector("#lockPasswordField");
const lockPassword = document.querySelector("#lockPassword");
const lockError = document.querySelector("#lockError");
const unlockButton = document.querySelector("#unlockButton");
const biometricUnlockButton = document.querySelector("#biometricUnlockButton");
const resetPasswordButton = document.querySelector("#resetPasswordButton");
const setupPasswordButton = document.querySelector("#setupPasswordButton");
const setupBiometricButton = document.querySelector("#setupBiometricButton");
const guestModeButton = document.querySelector("#guestModeButton");
const confirmPasswordModal = document.querySelector("#confirmPasswordModal");
const confirmPasswordMessage = document.querySelector("#confirmPasswordMessage");
const confirmPasswordInput = document.querySelector("#confirmPasswordInput");
const confirmPasswordError = document.querySelector("#confirmPasswordError");
const confirmPasswordCancel = document.querySelector("#confirmPasswordCancel");
const confirmPasswordSubmit = document.querySelector("#confirmPasswordSubmit");
const onboardingModal = document.querySelector("#onboardingModal");
const onboardingStepLabel = document.querySelector("#onboardingStepLabel");
const onboardingTitle = document.querySelector("#onboardingTitle");
const onboardingClose = document.querySelector("#onboardingClose");
const onboardingCopy = document.querySelector("#onboardingCopy");
const onboardingForm = document.querySelector("#onboardingForm");
const onboardingActions = document.querySelector("#onboardingActions");
const reviewTodayModal = document.querySelector("#reviewTodayModal");
const reviewTodayClose = document.querySelector("#reviewTodayClose");
const reviewTodayList = document.querySelector("#reviewTodayList");
const quickActionButtons = document.querySelectorAll("[data-quick-action]");
const reminderCenterModal = document.querySelector("#reminderCenterModal");
const reminderCenterClose = document.querySelector("#reminderCenterClose");
const reminderCenterList = document.querySelector("#reminderCenterList");
const floatingAddMenu = document.querySelector("#floatingAddMenu");
const floatingAddButton = document.querySelector("#floatingAddButton");
const symptomPresetButtons = document.querySelectorAll("[data-symptom-preset]");
const moodPresetButtons = document.querySelectorAll("[data-mood-preset]");
const taskPresetButtons = document.querySelectorAll("[data-task-preset]");
const appToast = document.querySelector("#appToast");
const overviewModuleMenu = document.querySelector("#overviewModuleMenu");
const overviewTabs = document.querySelectorAll("[data-overview-module]");
const overviewPanels = document.querySelectorAll("[data-overview-panel]");
const wellbeingSection = document.querySelector("#wellbeingSection");
const wellbeingModuleMenu = document.querySelector("#wellbeingModuleMenu");
const wellbeingTabs = document.querySelectorAll("[data-wellbeing-module]");
const nutritionPanel = document.querySelector("#nutritionPanel");
const vitals24Button = document.querySelector("#vitals24Button");
const vitals24Modal = document.querySelector("#vitals24Modal");
const vitals24Close = document.querySelector("#vitals24Close");
const symptomPanel = document.querySelector("#symptomPanel");
const symptomForm = document.querySelector("#symptomForm");
const symptomDate = document.querySelector("#symptomDate");
const symptomName = document.querySelector("#symptomName");
const symptomSeverity = document.querySelector("#symptomSeverity");
const symptomNote = document.querySelector("#symptomNote");
const symptomList = document.querySelector("#symptomList");
const symptomEmpty = document.querySelector("#symptomEmpty");
const symptomHistoryButton = document.querySelector("#symptomHistoryButton");
const symptomHistoryModal = document.querySelector("#symptomHistoryModal");
const symptomHistoryClose = document.querySelector("#symptomHistoryClose");
const symptomHistoryRows = document.querySelector("#symptomHistoryRows");
const symptomHistoryEmpty = document.querySelector("#symptomHistoryEmpty");
const moodPanel = document.querySelector("#moodPanel");
const moodForm = document.querySelector("#moodForm");
const moodDate = document.querySelector("#moodDate");
const moodName = document.querySelector("#moodName");
const moodIntensity = document.querySelector("#moodIntensity");
const moodNote = document.querySelector("#moodNote");
const moodList = document.querySelector("#moodList");
const moodEmpty = document.querySelector("#moodEmpty");
const moodHistoryButton = document.querySelector("#moodHistoryButton");
const moodHistoryModal = document.querySelector("#moodHistoryModal");
const moodHistoryClose = document.querySelector("#moodHistoryClose");
const moodHistoryRows = document.querySelector("#moodHistoryRows");
const moodHistoryEmpty = document.querySelector("#moodHistoryEmpty");
const journalPanel = document.querySelector("#journalPanel");
const journalForm = document.querySelector("#journalForm");
const journalDate = document.querySelector("#journalDate");
const journalEntry = document.querySelector("#journalEntry");
const journalPaperDate = document.querySelector("#journalPaperDate");
const journalLogLink = document.querySelector("#journalLogLink");
const chartsPanel = document.querySelector("#chartsPanel");
const wellbeingModules = ["vitals", "symptoms", "mood", "charts"];
const overviewModules = ["coach"];
let overviewSwipeStartX = 0;
let wellbeingSwipeStartX = 0;
let wellbeingSwipeStartY = 0;
let lastHapticAt = 0;

todayLabel.textContent = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "short",
  day: "numeric"
}).format(new Date());
journalDate.value = today;
journalPaperDate.textContent = formatShortSlashDate(today);
updateJournalEntryState();
clearMoodAndSymptomForms();
installHapticFeedback();

dashboardJumpButtons.forEach((button) => {
  button.addEventListener("click", () => jumpFromDashboard(button.dataset.dashboardJump));
});
aiRefreshButton.addEventListener("click", renderSmartCoach);
reviewTodayButton.addEventListener("click", reviewToday);
if (DICTATION_FEATURE_ENABLED) {
  dictateButton.hidden = false;
  dictateButton.addEventListener("click", startHealthDictation);
} else {
  dictateButton.hidden = true;
  dictationStatus.hidden = true;
}
getStartedButton.addEventListener("click", startGuidedDataEntry);
quickActionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    floatingAddMenu?.classList.remove("open");
    jumpFromDashboard(button.dataset.quickAction);
  });
});
floatingAddButton?.addEventListener("click", () => {
  floatingAddMenu?.classList.toggle("open");
});
reminderCenterClose?.addEventListener("click", () => {
  reminderCenterModal.hidden = true;
});
reminderCenterModal?.addEventListener("click", (event) => {
  if (event.target === reminderCenterModal) {
    reminderCenterModal.hidden = true;
  }
});
symptomPresetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    symptomName.value = button.dataset.symptomPreset || "";
    setWellbeingModule("symptoms");
    symptomName.focus();
  });
});
moodPresetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    moodName.value = button.dataset.moodPreset || "Okay";
    setWellbeingModule("mood");
    moodNote.focus();
  });
});
taskPresetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    habitName.value = button.dataset.taskPreset || "";
    habitName.focus();
  });
});
applySettings();
setOverviewModule("coach");
setWellbeingModule("vitals");
mountVitalsHistoryChart();

journalEntry.addEventListener("input", updateJournalEntryState);
journalDate.addEventListener("change", () => {
  journalPaperDate.textContent = journalDate.value ? formatShortSlashDate(journalDate.value) : "";
});
journalLogLink?.addEventListener("click", openJournalLogList);
onboardingClose?.addEventListener("click", closeInitialDataOnboarding);
overviewTabs.forEach((tab) => {
  tab.addEventListener("click", () => setOverviewModule(tab.dataset.overviewModule));
});
overviewModuleMenu?.addEventListener("touchstart", (event) => {
  overviewSwipeStartX = event.touches[0]?.clientX || 0;
}, { passive: true });
overviewModuleMenu?.addEventListener("touchend", (event) => {
  const endX = event.changedTouches[0]?.clientX || overviewSwipeStartX;
  handleOverviewSwipe(endX - overviewSwipeStartX);
});
wellbeingTabs.forEach((tab) => {
  tab.addEventListener("click", () => setWellbeingModule(tab.dataset.wellbeingModule));
});
[wellbeingSection, nutritionPanel, symptomPanel, moodPanel, chartsPanel].forEach(bindWellbeingSwipeTarget);

habitForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = habitName.value.trim();
  const wasEditing = Boolean(editingHabitId);
  const date = normalizeTaskDate(taskDate?.value) || today;

  if (!name) return;

  const task = {
    id: editingHabitId || createHabitId(),
    name,
    date,
    day: weekDays[parseDateKey(date).getDay()],
    category: habitCategory.value || "General",
    time: "",
    deadline: normalizeTaskTime(habitDeadline.value),
    priority: habitPriority.value || "Normal",
    color: habitColor ? habitColor.value : "#1e40af",
    note: habitNote.value.trim(),
    completions: editingHabitId
      ? habits.find((habit) => habit.id === editingHabitId)?.completions || []
      : []
  };

  habits = editingHabitId
    ? habits.map((habit) => habit.id === editingHabitId ? { ...habit, ...task } : habit)
    : [task, ...habits];

  habitName.value = "";
  habitNote.value = "";
  habitDeadline.value = "";
  if (taskDate) taskDate.value = "";
  habitCategory.value = "";
  habitPriority.value = "";
  habitForm.querySelector(".primary-button").textContent = "Add";
  editingHabitId = null;
  saveHabits();
  if (task.deadline) {
    requestNotificationPermission();
  }
  render();
  showToast(wasEditing ? "Task saved." : "Task added.");
});

nutritionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const date = nutritionDate.value || today;
  const entry = {
    date,
    recordedAt: new Date().toISOString(),
    calories: parseNutritionNumber(calories.value),
    carbs: parseNutritionNumber(carbs.value),
    weight: getWeightInPoundsForSave(),
    ketosisPhase: ketosisPhase.value || null,
    glucose: parseNutritionNumber(glucose.value),
    systolic: parseNutritionNumber(systolic.value),
    diastolic: parseNutritionNumber(diastolic.value),
    water: parseNutritionNumber(water.value)
  };

  nutritionEntries = [
    entry,
    ...nutritionEntries.filter((item) => item.date !== date)
  ].sort((first, second) => second.date.localeCompare(first.date));

  saveNutritionEntries();
  renderNutrition();
  renderGraph();
  showToast("Nutrition and vitals saved.");
});

symptomForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = symptomName.value.trim();
  if (!name) return;
  symptomEntries = [{
    id: createHabitId(),
    date: symptomDate.value || today,
    recordedAt: new Date().toISOString(),
    name,
    severity: symptomSeverity.value || "Mild",
    note: symptomNote.value.trim()
  }, ...symptomEntries];
  symptomDate.value = "";
  symptomName.value = "";
  symptomSeverity.value = "";
  symptomNote.value = "";
  saveSymptomEntries();
  renderSymptoms();
  renderSymptomHistory();
  maybeSendWellbeingTrendNotification("symptoms");
  showToast("Symptom logged.");
});

moodForm.addEventListener("submit", (event) => {
  event.preventDefault();
  moodEntries = [{
    id: createHabitId(),
    date: moodDate.value || today,
    recordedAt: new Date().toISOString(),
    name: moodName.value || "Okay",
    intensity: moodIntensity.value || "Moderate",
    note: moodNote.value.trim()
  }, ...moodEntries];
  moodDate.value = "";
  moodName.value = "";
  moodIntensity.value = "";
  moodNote.value = "";
  saveMoodEntries();
  renderMoods();
  renderMoodHistory();
  maybeSendWellbeingTrendNotification("mood");
  showToast("Mood logged.");
});

journalForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = journalEntry.value.trim();
  if (!text) return;
  journalEntries = [{
    id: createHabitId(),
    date: journalDate.value || today,
    text
  }, ...journalEntries];
  journalEntry.value = "";
  updateJournalEntryState();
  saveJournalEntries();
  handleImmediateJournalSafetySignal(text);
  renderJournal();
  scheduleSmartCoachRender();
  maybeSendWellbeingTrendNotification("journal");
  scanJournalAndAppWithAiForSafety(text);
  showToast("Journal entry saved.");
});

waterGlasses.addEventListener("click", (event) => {
  const button = event.target.closest(".water-glass");
  if (!button) return;
  const selectedGlasses = Number(button.dataset.glassIndex);
  if (!Number.isFinite(selectedGlasses)) return;
  setWaterExpanded(true);
  setWaterAmount(selectedGlasses * WATER_GLASS_OZ);
});

waterToggle.addEventListener("click", () => {
  setWaterExpanded(true);
});

waterClear.addEventListener("click", () => {
  setWaterAmount(null);
});

vitals24Button?.addEventListener("click", () => {
  renderNutrition();
  vitals24Modal.hidden = false;
});

vitals24Close?.addEventListener("click", () => {
  vitals24Modal.hidden = true;
});

vitals24Modal?.addEventListener("click", (event) => {
  if (event.target === vitals24Modal) {
    vitals24Modal.hidden = true;
  }
});

importBloodPressure.addEventListener("click", () => {
  importBloodPressureFromWatch();
});

convertWeight.addEventListener("click", () => {
  toggleWeightUnit();
});

weight.addEventListener("input", () => {
  weightUnit = "lb";
  updateWeightConvertButton();
});

historyButton?.addEventListener("click", () => {
  if (vitalsHistoryDropdown) {
    setWellbeingModule("charts");
    vitalsHistoryDropdown.open = true;
    syncHistoryControls();
    renderHistory();
    vitalsHistoryDropdown.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  syncHistoryControls();
  renderHistory();
  historyModal.hidden = false;
});

historyFocusDate.addEventListener("change", () => {
  historyFocusDateKey = historyFocusDate.value || today;
  renderHistory();
});

historyZoomRange.addEventListener("input", () => {
  historyZoomDays = Number(historyZoomRange.value) || HISTORY_RETENTION_DAYS;
  renderHistory();
});

historyRangeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    historyZoomDays = Number(button.dataset.historyDays) || HISTORY_RETENTION_DAYS;
    historyZoomRange.value = String(historyZoomDays);
    updateHistoryZoomLabel();
    renderHistory();
  });
});

historyLegendButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const metric = button.dataset.historyMetric || "all";
    historyMetricFilter.value = metric;
    renderHistory();
  });
});

historyMetricFilter.addEventListener("change", () => {
  renderHistory();
});

historyClose.addEventListener("click", () => {
  historyModal.hidden = true;
});

historyModal.addEventListener("click", (event) => {
  if (event.target === historyModal) {
    historyModal.hidden = true;
  }
});
masterChartRangeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    masterChartRangeDays = Number(button.dataset.masterChartDays) || HISTORY_RETENTION_DAYS;
    renderMasterChart();
  });
});
masterChartButton?.addEventListener("click", openMasterChart);
masterChartClose?.addEventListener("click", () => {
  masterChartModal.hidden = true;
});
masterChartModal?.addEventListener("click", (event) => {
  if (event.target === masterChartModal) {
    masterChartModal.hidden = true;
  }
});

symptomHistoryButton.addEventListener("click", () => {
  renderSymptomHistory();
  symptomHistoryModal.hidden = false;
});

symptomHistoryClose.addEventListener("click", () => {
  symptomHistoryModal.hidden = true;
});

symptomHistoryModal.addEventListener("click", (event) => {
  if (event.target === symptomHistoryModal) {
    symptomHistoryModal.hidden = true;
  }
});

moodHistoryButton.addEventListener("click", () => {
  renderMoodHistory();
  moodHistoryModal.hidden = false;
});

moodHistoryClose.addEventListener("click", () => {
  moodHistoryModal.hidden = true;
});

moodHistoryModal.addEventListener("click", (event) => {
  if (event.target === moodHistoryModal) {
    moodHistoryModal.hidden = true;
  }
});

affirmationModal.addEventListener("click", (event) => {
  if (event.target === affirmationModal) {
    closeAffirmationModal();
  }
});

dictationReviewClose.addEventListener("click", closeDictationReview);
dictationReviewModal.addEventListener("click", (event) => {
  if (event.target === dictationReviewModal) {
    closeDictationReview();
  }
});
dictationReviewSave.addEventListener("click", saveReviewedDictation);
dictationReviewRetry.addEventListener("click", () => {
  if (!DICTATION_FEATURE_ENABLED) return;
  startHealthDictation({ appendToReview: true });
});
dictationReviewManual.addEventListener("click", () => {
  pendingDictationExtraction = null;
  pendingDictationTranscript = "";
  pendingParsedDictationResult = null;
  pendingParsedDictationDocument = null;
  dictationReviewField.hidden = false;
  dictationFieldReview.hidden = true;
  dictationFieldReview.replaceChildren();
  dictationReviewManual.hidden = false;
  dictationReviewChange.hidden = true;
  dictationReviewSave.textContent = "Confirm & Save";
  dictationReviewText.value = "";
  dictationReviewText.focus();
});
dictationReviewChange.addEventListener("click", changeReviewedDictation);
reviewTodayClose.addEventListener("click", () => {
  reviewTodayModal.hidden = true;
});
reviewTodayModal.addEventListener("click", (event) => {
  if (event.target === reviewTodayModal) {
    reviewTodayModal.hidden = true;
  }
});

settingsButton.addEventListener("click", () => {
  renderSettings();
  setSettingsPasswordFieldTypes("password");
  settingsModal.hidden = false;
  settingsModal.scrollTop = 0;
  settingsPanel.scrollTop = 0;
});

settingsClose.addEventListener("click", () => {
  settingsModal.hidden = true;
  setSettingsPasswordFieldTypes("text");
});

settingsModal.addEventListener("click", (event) => {
  if (event.target === settingsModal) {
    settingsModal.hidden = true;
    setSettingsPasswordFieldTypes("text");
  }
});
settingsSearch?.addEventListener("input", filterSettings);

themeToggle.addEventListener("change", () => updateSetting("theme", themeToggle.checked ? "dark" : "light"));
reminderToggle.addEventListener("change", () => updateSetting("remindersEnabled", reminderToggle.checked));
reminderTime.addEventListener("change", () => updateSetting("reminderTime", reminderTime.value));
heightFeet.addEventListener("change", () => updateHeightSetting());
heightInches.addEventListener("change", () => updateHeightSetting());
aiExtractionToggle.addEventListener("change", () => updateSetting("aiExtractionEnabled", aiExtractionToggle.checked));
hipaaCloudToggle?.addEventListener("change", () => updateCloudAiSharing(hipaaCloudToggle.checked));
aiApiKey.addEventListener("change", () => {
  aiApiKey.value = "";
  updateSetting("aiApiKey", "");
  showToast("OpenAI keys belong on the secure backend, not inside the app.");
});
aiBackendUrl.addEventListener("change", () => updateSetting("aiBackendUrl", normalizeAiBackendUrlInput(aiBackendUrl.value)));
aiBackendToken.addEventListener("change", () => updateSetting("aiBackendToken", aiBackendToken.value.trim()));
aiModel.addEventListener("change", () => updateSetting("aiModel", aiModel.value.trim()));
aiTtsModel?.addEventListener("change", () => updateSetting("aiTtsModel", aiTtsModel.value.trim()));
aiTtsVoice?.addEventListener("change", () => updateSetting("aiTtsVoice", aiTtsVoice.value));
testAiTtsButton?.addEventListener("click", testAiTextToSpeech);
installTtsVoiceButton?.addEventListener("click", installPhoneTextToSpeechVoiceData);
guestModeToggle.addEventListener("change", () => updateGuestModeSetting(guestModeToggle.checked));
setPasswordButton.addEventListener("click", () => setAppPassword());
clearPasswordButton.addEventListener("click", () => clearAppPassword());
biometricToggle.addEventListener("change", () => updateBiometricSetting());
unlockButton.addEventListener("click", () => unlockWithPassword());
lockPassword.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  if (setupPasswordButton.hidden) unlockWithPassword();
  else completeSecuritySetup();
});
biometricUnlockButton.addEventListener("click", () => unlockWithBiometric());
resetPasswordButton.addEventListener("click", () => resetAppSecurityFromLock());
setupPasswordButton.addEventListener("click", () => completeSecuritySetup());
setupBiometricButton.addEventListener("click", () => completeBiometricSecuritySetup());
guestModeButton.addEventListener("click", () => continueAsGuest());
confirmPasswordCancel.addEventListener("click", () => closeConfirmPasswordDialog(false));
confirmPasswordSubmit.addEventListener("click", () => submitConfirmPasswordDialog());
confirmPasswordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") submitConfirmPasswordDialog();
});
confirmPasswordModal.addEventListener("click", (event) => {
  if (event.target === confirmPasswordModal) closeConfirmPasswordDialog(false);
});
exportDataButton.addEventListener("click", exportAppData);
importDataButton.addEventListener("click", () => importDataFile.click());
importDataFile.addEventListener("change", importAppData);
masterResetButton.addEventListener("click", masterResetAppData);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !affirmationModal.hidden) {
    closeAffirmationModal();
    return;
  }
  if (event.key === "Escape" && !historyModal.hidden) {
    historyModal.hidden = true;
  }
  if (event.key === "Escape" && !symptomHistoryModal.hidden) {
    symptomHistoryModal.hidden = true;
  }
  if (event.key === "Escape" && !moodHistoryModal.hidden) {
    moodHistoryModal.hidden = true;
  }
  if (event.key === "Escape" && !settingsModal.hidden) {
    settingsModal.hidden = true;
  }
});

document.addEventListener("click", (event) => {
  if (waterExpanded && !waterControl.contains(event.target)) {
    setWaterExpanded(false);
  }
});

window.addEventListener("scroll", () => {
  if (waterExpanded) {
    setWaterExpanded(false);
  }
}, { passive: true });

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    if (!appUnlocked && isAppLockEnabled() && !dictationActive) {
      hiddenAt = 0;
      showAppLock();
      return;
    }
    if (appUnlocked && hiddenAt && Date.now() - hiddenAt >= 5 * 60 * 1000) {
      showDailyAffirmation();
    }
    hiddenAt = 0;
  } else {
    hiddenAt = Date.now();
    if (appUnlocked && isAppLockEnabled() && !dictationActive) {
      lockAppAfterBackground();
    }
  }
});

window.addEventListener("pageshow", (event) => {
  scrollAppToTop();
  if (!appUnlocked && isAppLockEnabled() && !dictationActive) {
    showAppLock();
    return;
  }
  if (appUnlocked && event.persisted) {
    showDailyAffirmation();
  }
});

function scrollAppToTop() {
  window.requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.scrollingElement?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  });
}

window.setInterval(() => {
  checkTaskReminder();
  checkTaskDeadlineReminders();
  checkUpcomingTaskReminders();
}, 30000);

if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js");
  });
}

function render() {
  habitList.textContent = "";
  const tasksByDay = groupTasksByDay();
  const fragment = document.createDocumentFragment();
  [...tasksByDay.entries()].forEach(([dateKey, dayHabits]) => {
    const dayName = weekDays[parseDateKey(dateKey).getDay()];
    fragment.appendChild(renderDaySection(dayName, dateKey, dayHabits));
  });
  habitList.appendChild(fragment);

  emptyState.hidden = habits.length > 0;
  renderTodayDashboard();
  scheduleSmartCoachRender();
  renderGraph();
  renderNutrition();
  renderSymptoms();
  renderMoods();
  renderJournal();
  renderWaterControl();
  maybePromptBackupReminder();
}

function clearMoodAndSymptomForms() {
  symptomDate.value = "";
  symptomName.value = "";
  symptomSeverity.value = "";
  symptomNote.value = "";
  moodDate.value = "";
  moodName.value = "";
  moodIntensity.value = "";
  moodNote.value = "";
}

function groupTasksByDay() {
  const tasksByDay = new Map();
  habits.forEach((habit) => {
    const dateKey = getTaskDateKey(habit);
    if (!tasksByDay.has(dateKey)) tasksByDay.set(dateKey, []);
    tasksByDay.get(dateKey).push(habit);
  });
  return new Map([...tasksByDay.entries()].sort(([firstDate], [secondDate]) => firstDate.localeCompare(secondDate)));
}

function renderDaySection(dayName, dateKey, dayHabits) {
  const section = document.createElement("section");
  section.className = "day-section";
  section.dataset.day = dayName;
  section.dataset.date = dateKey;
  section.classList.toggle("today", dateKey === today);
  if (dateKey === today) {
    section.id = "todayTasksSection";
  }

  const total = dayHabits.length;
  const complete = dayHabits.filter((habit) => habit.completions.includes(dateKey)).length;
  const percentComplete = total ? Math.round((complete / total) * 100) : 0;

  const header = document.createElement("div");
  header.className = "day-section-header";
  header.tabIndex = 0;
  header.setAttribute("role", "button");
  header.setAttribute("aria-label", `Open ${dayName} to-do list`);

  const titleWrap = document.createElement("div");
  titleWrap.className = "day-section-title";
  const title = document.createElement("h2");
  title.textContent = dayName;
  const subtitle = document.createElement("p");
  subtitle.textContent = `${formatSymptomHistoryDate(dateKey)} - ${total} task${total === 1 ? "" : "s"}`;
  titleWrap.append(title, subtitle);

  const percent = document.createElement("span");
  percent.className = "day-section-percent";
  percent.textContent = `${percentComplete}%`;
  percent.title = total
    ? `${complete} of ${total} tasks completed for ${formatSymptomHistoryDate(dateKey)}`
    : `No tasks scheduled for ${formatSymptomHistoryDate(dateKey)}`;

  header.append(titleWrap, percent);
  header.addEventListener("click", () => openDayTaskDialog(dayName, dateKey));
  header.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openDayTaskDialog(dayName, dateKey);
    }
  });

  const list = document.createElement("div");
  list.className = "day-task-list";

  if (dayHabits.length === 0) {
    const empty = document.createElement("p");
    empty.className = "day-empty";
    empty.textContent = "No tasks for this day yet.";
    list.appendChild(empty);
  } else {
    const fragment = document.createDocumentFragment();
    const recentDays = getRecentDays();
    dayHabits.forEach((habit) => {
      fragment.appendChild(renderTaskCard(habit, dateKey, dayName, recentDays));
    });
    list.appendChild(fragment);
  }

  section.append(header, list);
  return section;
}

function renderTaskCard(habit, dateKey, dayName, recentDays = getRecentDays()) {
  const fragment = habitTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".habit-card");
  const checkButton = fragment.querySelector(".check-button");
  const deleteButton = fragment.querySelector(".delete-button");
  const title = fragment.querySelector("h2");
  const streak = fragment.querySelector(".streak");
  const weekScore = fragment.querySelector(".week-score");
  const attributes = fragment.querySelector(".habit-attributes");
  const note = fragment.querySelector(".habit-note");
  const calendarLink = fragment.querySelector(".calendar-link");
  const completedToday = habit.completions.includes(dateKey);
  const completedThisWeek = recentDays.filter((day) => habit.completions.includes(day.key)).length;
  const detailItems = [
    dayName,
    formatTaskDeadline(habit.deadline),
    habit.category || "General",
    habit.priority || "Normal"
  ].filter(Boolean);

  card.style.setProperty("--habit-color", habit.color);
  card.classList.toggle("done", completedToday);
  title.textContent = habit.name;
  streak.textContent = `${getTaskStreak(habit, dateKey)} week streak`;
  weekScore.textContent = `${completedThisWeek}/7 this week`;
  note.textContent = habit.note || "";
  note.hidden = !habit.note;
  calendarLink.href = getGoogleCalendarUrl(habit);
  calendarLink.textContent = "Add to Google Calendar";
  const editButton = document.createElement("button");
  editButton.className = "calendar-link task-edit-button";
  editButton.type = "button";
  editButton.textContent = "Edit";
  calendarLink.after(editButton);

  detailItems.forEach((item) => {
    const chip = document.createElement("span");
    chip.textContent = item;
    attributes.appendChild(chip);
  });

  checkButton.addEventListener("click", () => toggleHabit(habit.id, dateKey));
  deleteButton.addEventListener("click", () => deleteHabit(habit.id));
  editButton.addEventListener("click", () => editHabit(habit.id));

  return fragment;
}

function renderTodayDashboard() {
  const summary = getTodaySummary();
  const todayTasks = summary.tasks;
  const complete = summary.completedTasks.length;
  const latestEntry = summary.latestEntry;
  const todayMood = summary.mood;
  const todaySymptoms = summary.symptoms;
  const weeklyTotals = getWeeklyTotals();
  if (todayTaskCount) {
    todayTaskCount.textContent = `${todayTasks.length} task${todayTasks.length === 1 ? "" : "s"}`;
  }
  todayCompletedCount.textContent = `${complete}/${todayTasks.length}`;
  const waterGoal = getDailyWaterGoal();
  todayWaterTotal.textContent = latestEntry && Number.isFinite(latestEntry.water)
    ? `${formatWholeNumber(latestEntry.water)}/${formatWholeNumber(waterGoal)} oz`
    : `0/${formatWholeNumber(waterGoal)} oz`;
  todayVitalsSummary.textContent = latestEntry
    ? [formatBloodPressure(latestEntry.systolic, latestEntry.diastolic), Number.isFinite(latestEntry.glucose) ? `${formatWholeNumber(latestEntry.glucose)} glucose` : ""].filter((value) => value && value !== "--").join(" / ") || "--"
    : "--";
  if (todayMoodSummary) todayMoodSummary.textContent = todayMood ? todayMood.name : "--";
  if (todaySymptomSummary) todaySymptomSummary.textContent = todaySymptoms.length ? String(todaySymptoms.length) : "0";
  if (todayWeeklySummary) todayWeeklySummary.textContent = `${weeklyTotals.average}%`;
  if (todayWeeklyProgressFill) {
    todayWeeklyProgressFill.style.width = `${Math.max(0, Math.min(100, weeklyTotals.average))}%`;
    todayWeeklyProgressFill.textContent = `${weeklyTotals.average}%`;
    todayWeeklyProgressFill.parentElement.setAttribute("aria-label", `Weekly task progress ${weeklyTotals.average}%, ${weeklyTotals.totalComplete} of ${weeklyTotals.totalTasks} tasks completed`);
  }
  renderWeeklyTaskPercentBar(weeklyTotals.totalComplete, weeklyTotals.totalTasks, weeklyTotals.average);
  todayTaskList.textContent = "";
  if (!todayTasks.length) {
    const empty = document.createElement("p");
    empty.className = "day-empty";
    empty.textContent = "No tasks scheduled for today.";
    todayTaskList.appendChild(empty);
    return;
  }
  const fragment = document.createDocumentFragment();
  todayTasks.forEach((task) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "today-task-row";
    row.classList.toggle("done", task.completions.includes(today));
    row.textContent = task.name;
    row.addEventListener("click", () => toggleHabit(task.id, today));
    fragment.appendChild(row);
  });
  todayTaskList.appendChild(fragment);
}

function getTodaySummary() {
  const todayName = weekDays[new Date().getDay()];
  const tasks = habits.filter((habit) => isTaskScheduledForDate(habit, today));
  const completedTasks = tasks.filter((habit) => habit.completions.includes(today));
  const incompleteTasks = tasks.filter((habit) => !habit.completions.includes(today));
  return {
    todayName,
    tasks,
    completedTasks,
    incompleteTasks,
    entry: nutritionEntries.find((entry) => entry.date === today) || null,
    latestEntry: nutritionEntries[0] || null,
    mood: moodEntries.find((entry) => entry.date === today) || null,
    symptoms: symptomEntries.filter((entry) => entry.date === today),
    journal: journalEntries.find((entry) => entry.date === today) || null
  };
}

function scheduleSmartCoachRender(delay = 120) {
  window.clearTimeout(smartCoachRenderTimer);
  smartCoachRenderTimer = window.setTimeout(() => {
    smartCoachRenderTimer = null;
    renderSmartCoach();
  }, delay);
}

function renderSmartCoach() {
  const insights = getSmartCoachInsights();
  const coachCacheKey = getAiCoachSnapshotKey();
  const visibleInsights = aiCoachInsight && aiCoachCacheKey === coachCacheKey
    ? [aiCoachInsight, ...insights]
    : insights;
  aiInsightList.textContent = "";
  visibleInsights.slice(0, 5).forEach((insight) => {
    aiInsightList.appendChild(renderSmartCoachCard(insight));
  });
  loadAiCoachInsight(coachCacheKey, insights);
}

function renderSmartCoachCard(insight) {
  const card = document.createElement("article");
  const badge = document.createElement("span");
  card.className = "ai-insight-card";
  card.dataset.tone = insight.tone || "neutral";
  if (insight.destination) {
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `${insight.title}, ${insight.actionLabel || "open section"}`);
    card.addEventListener("click", () => jumpFromDashboard(insight.destination));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        jumpFromDashboard(insight.destination);
      }
    });
  }
  badge.className = "trend-badge";
  badge.textContent = getInsightLabel(insight);
  const title = document.createElement("strong");
  const body = document.createElement("p");
  title.textContent = insight.title;
  body.textContent = insight.body;
  card.append(badge, title, body, renderMiniSparkline(insight));

  if (!insight.destination && insight.suggestedTask) {
    const nextStep = document.createElement("p");
    nextStep.className = "coach-next-step";
    nextStep.textContent = insight.suggestedTask || "Review this today";
    card.appendChild(nextStep);
  }

  if (insight.destination) {
    const button = document.createElement("button");
    button.className = "text-button ai-add-task";
    button.type = "button";
    button.textContent = insight.actionLabel || "Go";
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      jumpFromDashboard(insight.destination);
    });
    card.appendChild(button);
  } else if (insight.suggestedTask) {
    const button = document.createElement("button");
    button.className = "text-button ai-add-task";
    button.type = "button";
    button.textContent = "Add task";
    button.addEventListener("click", () => addSuggestedTask(insight.suggestedTask));
    card.appendChild(button);
  }

  return card;
}

function getInsightLabel(insight) {
  if (insight.aiGenerated) return "AI";
  if (/improving|better|easing|down/i.test(insight.title)) return "Improving";
  if (/slipping|attention|up|declining|increasing/i.test(insight.title)) return "Needs attention";
  if (insight.tone === "health") return "Health";
  if (insight.tone === "care") return "Care";
  if (insight.tone === "action") return "Action";
  return "Stable";
}

function renderMiniSparkline(insight) {
  const sparkline = document.createElement("div");
  const values = getSparklineValues(insight);
  const fragment = document.createDocumentFragment();
  sparkline.className = "mini-sparkline";
  values.forEach((value) => {
    const bar = document.createElement("span");
    bar.style.height = `${Math.max(18, Math.min(100, value))}%`;
    fragment.appendChild(bar);
  });
  sparkline.appendChild(fragment);
  return sparkline;
}

function getSparklineValues(insight) {
  const title = insight.title.toLowerCase();
  if (title.includes("water")) {
    const waterGoal = getDailyWaterGoal();
    return nutritionEntries.slice(0, 7).reverse().map((entry) => Number.isFinite(entry.water) ? Math.min(100, (entry.water / waterGoal) * 100) : 18);
  }
  if (title.includes("weight")) return getScaledValues(nutritionEntries.slice(0, 7).reverse().map((entry) => entry.weight));
  if (title.includes("glucose")) return getScaledValues(nutritionEntries.slice(0, 7).reverse().map((entry) => entry.glucose));
  if (title.includes("pressure")) return getScaledValues(nutritionEntries.slice(0, 7).reverse().map((entry) => entry.systolic));
  if (title.includes("mood")) return moodEntries.slice(0, 7).reverse().map((entry) => (getMoodScore(entry.name) || 1) * 20);
  if (title.includes("symptom")) return getRecentDateKeys(7, 0).map((dateKey) => symptomEntries.filter((entry) => entry.date === dateKey).length * 28 + 18);
  return getWeekStats().map((day) => day.percent || 18);
}

function getScaledValues(values) {
  const valid = values.filter(Number.isFinite);
  if (!valid.length) return [24, 38, 34, 46, 44, 58, 54];
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min || 1;
  return values.map((value) => Number.isFinite(value) ? 18 + ((value - min) / range) * 82 : 18);
}

function getSmartCoachInsights() {
  const todayName = weekDays[new Date().getDay()];
  const todayTasks = habits.filter((habit) => isTaskScheduledForDate(habit, today));
  const completedTasks = todayTasks.filter((habit) => habit.completions.includes(today)).length;
  const completionPercent = todayTasks.length ? Math.round((completedTasks / todayTasks.length) * 100) : 0;
  const latestEntry = nutritionEntries[0];
  const latestMood = moodEntries[0];
  const latestSymptom = symptomEntries[0];
  const waterGoal = getDailyWaterGoal();
  const waterAmount = latestEntry && latestEntry.date === today && Number.isFinite(latestEntry.water) ? latestEntry.water : 0;
  const medicalPatternInsight = getMedicalPatternInsight();
  const latestJournalInsight = getLatestJournalEntryInsight();
  const journalPatternInsight = getJournalPatternInsight();
  const insights = [];

  if (latestJournalInsight) {
    insights.push(latestJournalInsight);
  }

  if (journalPatternInsight) {
    insights.push(journalPatternInsight);
  }

  if (!todayTasks.length) {
    insights.push({
      title: "Plan the day",
      body: "No tasks are scheduled for today. Add one simple task so the weekly progress bar has something real to track.",
      tone: "action",
      destination: "tasks",
      actionLabel: "Create a task"
    });
  } else if (completionPercent < 50) {
    insights.push({
      title: "Pick the next small win",
      body: `${completedTasks} of ${todayTasks.length} tasks are done. Knock out one short task before adding more work.`,
      tone: "action",
      destination: "tasks",
      actionLabel: "Go to tasks"
    });
  } else {
    insights.push({
      title: "Momentum check",
      body: `${completionPercent}% of today's tasks are complete. Keep the list steady and avoid loading the day with extra tasks.`,
      tone: "steady"
    });
  }

  const upcomingTaskInsight = getUpcomingTaskReminderInsight();
  if (upcomingTaskInsight) {
    insights.push(upcomingTaskInsight);
  }

  if (waterAmount < waterGoal) {
    insights.push({
      title: "Hydration nudge",
      body: `${formatWholeNumber(waterAmount)} of ${formatWholeNumber(waterGoal)} oz logged today. A water break is the cleanest next move.`,
      tone: "health",
      destination: "water",
      actionLabel: "Go to water"
    });
  }

  if (latestMood && ["Low", "Stressed", "Anxious"].includes(latestMood.name)) {
    insights.push({
      title: "Mood support",
      body: `${latestMood.name} was your latest mood log. Keep the next task light and give yourself a reset window.`,
      tone: "care",
      destination: "mood",
      actionLabel: "Go to mood"
    });
  }

  if (latestSymptom && ["Moderate", "Severe"].includes(latestSymptom.severity)) {
    insights.push({
      title: "Symptom-aware pacing",
      body: `${latestSymptom.severity} ${latestSymptom.name.toLowerCase()} is in your recent symptom log. Lower intensity tasks make more sense right now.`,
      tone: "care",
      destination: "symptoms",
      actionLabel: "Go to symptoms"
    });
  }

  if (latestEntry && (latestEntry.systolic >= 130 || latestEntry.diastolic >= 80)) {
    insights.push({
      title: "Vitals watch",
      body: `Latest blood pressure is ${formatBloodPressure(latestEntry.systolic, latestEntry.diastolic)}. Keep tracking it consistently and avoid treating one reading like the whole story.`,
      tone: "health"
    });
  }

  if (medicalPatternInsight) {
    insights.push(medicalPatternInsight);
  }

  insights.push(...getLimitInsights(latestEntry, latestMood));
  insights.push(...getDataTrendInsights());

  if (insights.length < 3) {
    insights.push({
      title: "Pattern builder",
      body: "Logging your information today gives the coach better patterns to work with tomorrow.",
      tone: "steady",
      destination: "vitals",
      actionLabel: "Go to vitals"
    });
  }

  return insights.slice(0, 4);
}

function getUpcomingTaskReminderInsight() {
  const upcoming = getUpcomingTaskReminderCandidates();
  if (!upcoming.length) return null;
  const next = upcoming[0];
  const when = next.offset === 1 ? "tomorrow" : `${next.dayName}, ${formatSymptomHistoryDate(next.dateKey)}`;
  return {
    title: next.missedBefore ? "Remember this task" : "Task coming up soon",
    body: next.missedBefore
      ? `${next.habit.name} is coming up ${when}. This task has gone past deadline before, so set it up early instead of waiting.`
      : `${next.habit.name} is coming up ${when}. Put it on your radar now so it does not sneak up on you.`,
    tone: next.missedBefore ? "action" : "steady",
    destination: "tasks",
    actionLabel: "Go to tasks"
  };
}

function getUpcomingTaskReminderCandidates(now = new Date(), horizonDays = 5) {
  const upcoming = [];
  for (let offset = 1; offset <= horizonDays; offset += 1) {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + offset);
    const dateKey = toDateKey(date);
    const dayName = weekDays[date.getDay()];
    habits
      .filter((habit) => isTaskScheduledForDate(habit, dateKey) && !habit.completions.includes(dateKey))
      .forEach((habit) => {
        const missedBefore = taskDeadlineEvents.some((event) => event.taskId === habit.id);
        upcoming.push({ habit, dateKey, dayName, offset, missedBefore });
      });
  }

  return upcoming.sort((first, second) => {
    if (first.missedBefore !== second.missedBefore) return first.missedBefore ? -1 : 1;
    return first.offset - second.offset;
  });
}

async function loadAiCoachInsight(cacheKey, localInsights) {
  if (!isAiDictationEnabled()) return;
  if (aiCoachInsight && aiCoachCacheKey === cacheKey) return;
  if (aiCoachFailedKey === cacheKey) return;
  const requestId = aiCoachRequestId + 1;
  aiCoachRequestId = requestId;
  try {
    const insight = await fetchAiCoachInsight(localInsights);
    if (requestId !== aiCoachRequestId || !insight) return;
    aiCoachCacheKey = cacheKey;
    aiCoachInsight = insight;
    renderSmartCoach();
  } catch {
    if (requestId === aiCoachRequestId) {
      aiCoachCacheKey = cacheKey;
      aiCoachInsight = null;
      aiCoachFailedKey = cacheKey;
    }
  }
}

async function fetchAiCoachInsight(localInsights) {
  const snapshot = buildAiCoachSnapshot(localInsights);
  if (!canUseCloudAi()) return null;
  return normalizeAiCoachInsight(await fetchBackendAiCoachInsight(snapshot));
}

async function fetchBackendAiCoachInsight(snapshot) {
  const headers = { "Content-Type": "application/json" };
  if (appSettings.aiBackendToken) headers["X-App-Token"] = appSettings.aiBackendToken;
  const backendUrl = getConfiguredAiBackendUrl();
  if (!backendUrl) throw new Error("Enter an HTTPS AI backend URL in Settings.");
  const response = await fetchWithTimeout(`${backendUrl}/api/coach/analyze`, {
    method: "POST",
    headers,
    body: JSON.stringify({ snapshot })
  }, AI_COACH_TIMEOUT_MS);
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 2500) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function normalizeAiCoachInsight(data) {
  const title = cleanAiCoachText(data?.title).slice(0, 70);
  const body = cleanAiCoachText(data?.body).slice(0, 260);
  if (!title || !body) return null;
  const allowedDestinations = ["tasks", "water", "vitals", "mood", "symptoms", "journal", "settings"];
  const destination = allowedDestinations.includes(data?.destination) ? data.destination : null;
  return {
    title,
    body,
    tone: ["steady", "action", "health", "care", "neutral"].includes(data?.tone) ? data.tone : "health",
    destination,
    actionLabel: destination ? cleanAiCoachText(data?.actionLabel || getAiCoachActionLabel(destination)) : null,
    suggestedTask: cleanAiCoachText(data?.suggestedTask || ""),
    aiGenerated: true
  };
}

function cleanAiCoachText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function truncateForAi(value, maxLength = 300) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, Math.max(0, maxLength - 1))}...` : text;
}

function getAiCoachActionLabel(destination) {
  return {
    tasks: "Go to tasks",
    water: "Go to water",
    vitals: "Go to vitals",
    mood: "Go to mood",
    symptoms: "Go to symptoms",
    journal: "Go to journal",
    settings: "Go to settings"
  }[destination] || "Open";
}

function getAiCoachSnapshotKey() {
  return JSON.stringify({
    tasks: habits.map((habit) => [habit.id, habit.name, getTaskDateKey(habit), getTaskDay(habit), habit.category, habit.time, habit.deadline, habit.priority, truncateForAi(habit.note, 160), habit.completions?.slice(-21)]),
    nutrition: nutritionEntries.slice(0, 21),
    symptoms: symptomEntries.slice(0, 21).map((entry) => ({ ...entry, note: truncateForAi(entry.note, 160) })),
    moods: moodEntries.slice(0, 21).map((entry) => ({ ...entry, note: truncateForAi(entry.note, 160) })),
    journal: journalEntries.slice(0, 12).map((entry) => [entry.date, truncateForAi(entry.text, 360)]),
    deadlines: taskDeadlineEvents.slice(0, 21),
    settings: [appSettings.heightInches]
  });
}

function buildAiCoachSnapshot(localInsights) {
  const weekStats = getWeekStats();
  const weeklyTotals = getWeeklyCompletionTotals();
  const todayTasks = habits.filter((habit) => isTaskScheduledForDate(habit, today));
  const completedToday = todayTasks.filter((habit) => habit.completions.includes(today)).length;
  return {
    today,
    heightInches: Number(appSettings.heightInches) || null,
    waterGoal: getDailyWaterGoal(),
    weeklyTaskProgress: {
      average: weeklyTotals.average,
      completedTasks: weeklyTotals.totalComplete,
      totalTasks: weeklyTotals.totalTasks,
      days: weekStats.map((day) => ({ day: day.dayName, date: day.dateKey, percent: day.percent, done: day.complete, total: day.total }))
    },
    todayDashboard: {
      taskCount: todayTasks.length,
      completedTasks: completedToday,
      completionPercent: todayTasks.length ? Math.round((completedToday / todayTasks.length) * 100) : 0,
      latestVitals: nutritionEntries[0] || null,
      latestMood: moodEntries[0] || null,
      symptomsToday: symptomEntries.filter((entry) => entry.date === today),
      journalEntriesToday: journalEntries.filter((entry) => entry.date === today).map((entry) => ({ date: entry.date, text: String(entry.text || "").slice(0, 700) }))
    },
    localInsights: localInsights.slice(0, 6).map(({ title, body, tone }) => ({ title, body, tone })),
    tasks: habits.map((habit) => ({
      id: habit.id,
      name: habit.name,
      date: getTaskDateKey(habit),
      day: getTaskDay(habit),
      category: habit.category || "",
      time: normalizeTaskTime(habit.time || ""),
      deadline: normalizeTaskTime(habit.deadline || ""),
      priority: habit.priority || "Normal",
      note: truncateForAi(habit.note, 180),
      completions: (habit.completions || []).slice(-30),
      completedRecently: (habit.completions || []).filter((dateKey) => daysBetween(dateKey, today) <= 30)
    })),
    missedDeadlines: taskDeadlineEvents.slice(0, 30),
    nutritionAndVitals: nutritionEntries.slice(0, 30).map((entry) => ({
      date: entry.date,
      calories: entry.calories,
      carbs: entry.carbs,
      weight: entry.weight,
      ketosisPhase: entry.ketosisPhase,
      glucose: entry.glucose,
      systolic: entry.systolic,
      diastolic: entry.diastolic,
      water: entry.water
    })),
    symptoms: symptomEntries.slice(0, 30).map((entry) => ({
      date: entry.date,
      name: entry.name,
      severity: entry.severity,
      note: truncateForAi(entry.note, 180)
    })),
    moods: moodEntries.slice(0, 30).map((entry) => ({
      date: entry.date,
      name: entry.name,
      intensity: entry.intensity,
      note: truncateForAi(entry.note, 180)
    })),
    journal: journalEntries.slice(0, 12).map((entry) => ({
      date: entry.date,
      text: truncateForAi(entry.text, 500)
    })),
    wholeAppTrendScan: buildWholeAppTrendScan()
  };
}

function getDataTrendInsights() {
  return [
    getWholeAppTrendInsight(),
    getTaskTrendInsight(),
    getDeadlineTrendInsight(),
    getNumericTrendInsight("Water trend", nutritionEntries, "water", "oz", 12, true),
    getNumericTrendInsight("Weight trend", nutritionEntries, "weight", "lb", 10, false),
    getNumericTrendInsight("Glucose trend", nutritionEntries, "glucose", "mg/dL", 8, false),
    getGlucosePatternInsight(),
    getBloodPressureTrendInsight(),
    getMoodTrendInsight(),
    getSymptomTrendInsight(),
    getJournalPatternInsight()
  ].filter(Boolean);
}

function buildWholeAppTrendScan() {
  const dateKeys = getRecentDateKeys(30, 0);
  return dateKeys.map((dateKey) => {
    const tasksForDay = habits.filter((habit) => isTaskScheduledForDate(habit, dateKey));
    const completeTasks = tasksForDay.filter((habit) => habit.completions.includes(dateKey)).length;
    const nutrition = nutritionEntries.find((entry) => entry.date === dateKey) || null;
    const symptoms = symptomEntries.filter((entry) => entry.date === dateKey);
    const moods = moodEntries.filter((entry) => entry.date === dateKey);
    const journals = journalEntries.filter((entry) => entry.date === dateKey);
    const missedDeadlines = taskDeadlineEvents.filter((event) => event.date === dateKey);
    return {
      date: dateKey,
      taskPercent: tasksForDay.length ? Math.round((completeTasks / tasksForDay.length) * 100) : null,
      missedDeadlines: missedDeadlines.length,
      water: nutrition && Number.isFinite(nutrition.water) ? nutrition.water : null,
      glucose: nutrition && Number.isFinite(nutrition.glucose) ? nutrition.glucose : null,
      bloodPressure: nutrition && Number.isFinite(nutrition.systolic) && Number.isFinite(nutrition.diastolic) ? `${nutrition.systolic}/${nutrition.diastolic}` : null,
      symptoms: symptoms.map((entry) => `${entry.severity} ${entry.name}`),
      moods: moods.map((entry) => `${entry.intensity} ${entry.name}`),
      journalFlags: journals.map((entry) => getJournalTrendFlags(entry.text)).flat()
    };
  }).filter((day) => day.taskPercent !== null || day.missedDeadlines || day.water !== null || day.glucose !== null || day.bloodPressure || day.symptoms.length || day.moods.length || day.journalFlags.length);
}

function getJournalTrendFlags(text) {
  const normalized = normalizeJournalConcernText(text);
  const flags = [];
  if (matchesAnyPattern(normalized, crisisMoodPatterns)) flags.push("crisis-language");
  if (matchesAnyPattern(normalized, depressionMoodPatterns)) flags.push("depression-language");
  if (matchesAnyPattern(normalized, unhealthyThoughtPatterns) || matchesAnyPattern(normalized, journalConcernPatterns)) flags.push("negative-thought-pattern");
  if (matchesAnyPattern(normalized, journalStressPatterns)) flags.push("stress-language");
  return flags;
}

function getWholeAppTrendInsight() {
  const scan = buildWholeAppTrendScan();
  if (scan.length < 3) return null;
  const lowTaskStressDays = scan.filter((day) => Number.isFinite(day.taskPercent) && day.taskPercent < 50 && day.journalFlags.includes("stress-language"));
  if (lowTaskStressDays.length >= 2) {
    return {
      title: "Stress and task trend",
      body: `${lowTaskStressDays.length} recent days show stress language in journal entries alongside low task completion. Reduce today's list, choose one must-do task, and move the rest instead of carrying the full load.`,
      tone: "care",
      destination: "journal",
      actionLabel: "Go to journal"
    };
  }
  const lowWaterSymptomDays = scan.filter((day) => Number.isFinite(day.water) && day.water < getDailyWaterGoal() && day.symptoms.length);
  if (lowWaterSymptomDays.length >= 2) {
    return {
      title: "Hydration and symptom link",
      body: `${lowWaterSymptomDays.length} recent days had low water plus symptoms. Log water earlier today and compare whether headache, fatigue, dizziness, or nausea ease when hydration is steadier.`,
      tone: "health",
      destination: "water",
      actionLabel: "Go to water"
    };
  }
  const moodJournalDays = scan.filter((day) => day.moods.some((mood) => /\b(Low|Stressed|Anxious)\b/.test(mood)) && day.journalFlags.length);
  if (moodJournalDays.length >= 2) {
    return {
      title: "Mood and journal trend",
      body: `${moodJournalDays.length} recent days link low mood with journal warning language. Use smaller tasks, add one support contact, and watch whether the same theme repeats this week.`,
      tone: "care",
      destination: "mood",
      actionLabel: "Go to mood"
    };
  }
  return null;
}

function getLimitInsights(latestEntry, latestMood) {
  if (!latestEntry && !latestMood) return [];
  return [
    getBloodPressureLimitInsight(latestEntry),
    getGlucoseLimitInsight(latestEntry),
    getCalorieLimitInsight(latestEntry),
    getCarbLimitInsight(latestEntry),
    getWeightLimitInsight(latestEntry),
    getMentalHealthSafetyInsight(),
    getMoodSupportInsight(latestMood)
  ].filter(Boolean);
}

function getBloodPressureLimitInsight(entry) {
  if (!entry || !Number.isFinite(entry.systolic) || !Number.isFinite(entry.diastolic)) return null;
  const category = getBloodPressureCategory(entry.systolic, entry.diastolic);
  if (category.level === "normal") return null;
  if (category.level === "low") {
    return {
      title: "Low blood pressure",
      body: `${formatBloodPressure(entry.systolic, entry.diastolic)} is at or below the common low blood pressure threshold of 90/60. Hydrate, rise slowly, note symptoms like dizziness, and ask a clinician if it repeats or you feel faint.`,
      tone: "care",
      destination: "vitals",
      actionLabel: "Go to vitals"
    };
  }
  return {
    title: `${category.label} blood pressure`,
    body: `${formatBloodPressure(entry.systolic, entry.diastolic)} is ${category.label.toLowerCase()} by American Heart Association categories. Consider a lower-sodium meal, hydration, a calm recheck, and sharing repeated high readings with a clinician.`,
    tone: category.level === "severe" ? "care" : "health",
    destination: "vitals",
    actionLabel: "Go to vitals"
  };
}

function getGlucoseLimitInsight(entry) {
  if (!entry || !Number.isFinite(entry.glucose)) return null;
  if (entry.glucose < 70) {
    const severe = entry.glucose < 54;
    return {
      title: severe ? "Severely low glucose" : "Low glucose",
      body: `${formatWholeNumber(entry.glucose)} mg/dL is below the CDC low blood sugar level of 70 mg/dL. Use your care plan, treat lows quickly, recheck, and get medical help if symptoms are severe or it keeps happening.`,
      tone: "care",
      destination: "vitals",
      actionLabel: "Go to vitals"
    };
  }
  if (entry.glucose <= 180) return null;
  return {
    title: "High glucose",
    body: `${formatWholeNumber(entry.glucose)} mg/dL is above the CDC's common two-hour after-meal target of under 180 mg/dL. Note meal timing, hydration, stress, and repeated highs so you can discuss patterns with a clinician.`,
    tone: "health",
    destination: "vitals",
    actionLabel: "Go to vitals"
  };
}

function getCalorieLimitInsight(entry) {
  if (!entry || !Number.isFinite(entry.calories) || entry.calories <= 2000) return null;
  return {
    title: "Calories above general guide",
    body: `${formatWholeNumber(entry.calories)} calories is above the FDA's 2,000-calorie general nutrition guide. Try planning one lighter, protein-forward meal or trimming sugary drinks/snacks tomorrow.`,
    tone: "health",
    destination: "vitals",
    actionLabel: "Go to nutrition"
  };
}

function getCarbLimitInsight(entry) {
  if (!entry || !Number.isFinite(entry.carbs)) return null;
  if (entry.carbs < 130) {
    return {
      title: "Carbs below RDA",
      body: `${formatWholeNumber(entry.carbs)}g carbs is below the 130g adult RDA from the National Academies. If this was not intentional, add nutrient-dense carbs like fruit, beans, vegetables, or whole grains.`,
      tone: "health",
      destination: "vitals",
      actionLabel: "Go to nutrition"
    };
  }
  if (entry.carbs <= 275) return null;
  return {
    title: "Carbs above daily value",
    body: `${formatWholeNumber(entry.carbs)}g carbs is above the FDA daily value of 275g. Swap one refined-carb item for vegetables, beans, or a smaller whole-grain portion.`,
    tone: "health",
    destination: "vitals",
    actionLabel: "Go to nutrition"
  };
}

function getWeightLimitInsight(entry) {
  if (!entry || !Number.isFinite(entry.weight)) return null;
  const bmi = getLatestBmi(entry.weight);
  if (!Number.isFinite(bmi)) {
    return {
      title: "Add height for weight AI",
      body: "Weight needs height to be interpreted. Add your height in Settings so the coach can compare weight to CDC BMI categories instead of guessing.",
      tone: "action",
      destination: "settings",
      actionLabel: "Go to settings"
    };
  }
  const category = getBmiCategory(bmi);
  if (category.level === "healthy") return null;
  return {
    title: `${category.label} BMI range`,
    body: `Your latest weight calculates to BMI ${bmi.toFixed(1)}, in the CDC ${category.label.toLowerCase()} range. Use this as a screening signal and focus on steady food, water, sleep, and movement patterns.`,
    tone: "health",
    destination: "vitals",
    actionLabel: "Go to weight"
  };
}

function getMoodSupportInsight(latestMood) {
  if (!latestMood || !["Low", "Stressed", "Anxious"].includes(latestMood.name)) return null;
  const suggestion = getMoodSuggestion(latestMood.name);
  return {
    title: `${latestMood.name} mood support`,
    body: suggestion.body,
    tone: "care",
    destination: "mood",
    actionLabel: "Go to mood"
  };
}

function getMentalHealthSafetyInsight() {
  const analysis = analyzeMoodSafety();
  if (!analysis) return null;
  if (analysis.level === "crisis") {
    return {
      title: "Immediate mental health support",
      body: "Your mood notes include language that can match suicide or self-harm warning signs. If you might act on those thoughts or are in immediate danger, call 911 now or text 911 if available. For suicide prevention support in the U.S., call or text 988.",
      tone: "care",
      destination: "mood",
      actionLabel: "Go to mood"
    };
  }
  if (analysis.level === "depression-pattern") {
    return {
      title: "Depression pattern watch",
      body: `${analysis.count} recent mood note${analysis.count === 1 ? "" : "s"} include depression warning words, and your logs are trending low. Consider contacting a mental health professional or primary care clinician. If it feels urgent or hard to stay safe, call 911 now or text 911 if available. For suicide prevention support in the U.S., call or text 988.`,
      tone: "care",
      destination: "mood",
      actionLabel: "Go to mood"
    };
  }
  return {
    title: "Mood support plan",
    body: "Recent mood logs are stacking up on the low side. Set one small support task, tell one trusted person how you are doing, and consider professional help if this keeps repeating.",
    tone: "care",
    destination: "mood",
    actionLabel: "Go to mood"
  };
}

function analyzeMoodSafety() {
  const recent = moodEntries
    .filter((entry) => entry.date)
    .sort((first, second) => second.date.localeCompare(first.date))
    .slice(0, 14);
  if (!recent.length) return null;
  const notes = recent.map((entry) => normalizeJournalConcernText(entry.note || "")).filter(Boolean);
  if (notes.some((note) => matchesAnyPattern(note, crisisMoodPatterns))) {
    return { level: "crisis", count: 1 };
  }
  const depressionHits = notes.filter((note) => matchesAnyPattern(note, depressionMoodPatterns)).length;
  const lowStrongCount = recent.filter((entry) => ["Low", "Anxious", "Stressed"].includes(entry.name) && entry.intensity === "Strong").length;
  const lowMoodCount = recent.filter((entry) => ["Low", "Anxious", "Stressed"].includes(entry.name)).length;
  if (depressionHits >= 1 && (lowMoodCount >= 2 || lowStrongCount >= 1)) {
    return { level: "depression-pattern", count: depressionHits };
  }
  if (lowStrongCount >= 3 || lowMoodCount >= 5) {
    return { level: "low-trend", count: lowMoodCount };
  }
  return null;
}

function matchesAnyPattern(value, patterns) {
  return patterns.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(value);
  });
}

function getMedicalPatternInsight() {
  const recentText = getRecentHealthText(14);
  const latestVitals = nutritionEntries[0];
  const recentVitals = nutritionEntries.slice(0, 7);
  if (!recentText && !recentVitals.length) return null;

  if (matchesAnyPattern(recentText, [
    /\b(chest pain|chest pressure|tight chest|shortness of breath|trouble breathing|cold sweat|jaw pain|left arm pain|faint|fainting)\b/i
  ])) {
    return {
      title: "Emergency symptom pattern",
      body: "Recent notes include symptoms that overlap with CDC/AHA heart attack warning signs. This app cannot diagnose it. If these symptoms are happening now, call 911.",
      tone: "care",
      destination: "symptoms",
      actionLabel: "Go to symptoms"
    };
  }

  if (matchesAnyPattern(recentText, [
    /\b(face droop|facial droop|one side weak|arm weakness|slurred speech|trouble speaking|sudden confusion|sudden severe headache|loss of balance|sudden vision)\b/i
  ])) {
    return {
      title: "Stroke warning pattern",
      body: "Recent notes include symptoms that overlap with CDC stroke warning signs. If face drooping, arm weakness, speech trouble, sudden confusion, severe headache, or vision trouble is happening now, call 911.",
      tone: "care",
      destination: "symptoms",
      actionLabel: "Go to symptoms"
    };
  }

  const highPressureCount = recentVitals.filter((entry) => getBloodPressureCategory(entry.systolic, entry.diastolic).level !== "normal" && getBloodPressureCategory(entry.systolic, entry.diastolic).level !== "low").length;
  if (latestVitals && getBloodPressureCategory(latestVitals.systolic, latestVitals.diastolic).level === "severe") {
    return {
      title: "Severe blood pressure pattern",
      body: `${formatBloodPressure(latestVitals.systolic, latestVitals.diastolic)} is in the severe range. High blood pressure often has no symptoms, but severe readings with chest pain, shortness of breath, weakness, vision change, confusion, or severe headache need urgent medical help.`,
      tone: "care",
      destination: "vitals",
      actionLabel: "Go to vitals"
    };
  }
  if (highPressureCount >= 3) {
    return {
      title: "Hypertension pattern",
      body: `${highPressureCount} recent blood pressure readings were above normal. MedlinePlus notes high blood pressure often has no symptoms, so repeated readings are worth sharing with a clinician.`,
      tone: "health",
      destination: "vitals",
      actionLabel: "Go to history"
    };
  }

  const respiratoryHits = countMedicalMatches(recentText, [
    /\b(fever|chills)\b/i,
    /\b(cough|sore throat|runny nose|congestion)\b/i,
    /\b(body aches|muscle aches|headache|fatigue|tired)\b/i,
    /\b(loss of taste|loss of smell)\b/i,
    /\b(shortness of breath|trouble breathing)\b/i
  ]);
  if (respiratoryHits >= 3) {
    return {
      title: "Respiratory illness pattern",
      body: "Recent symptoms overlap with CDC flu/COVID symptom lists. Consider rest, hydration, limiting exposure to others, testing when appropriate, and medical care for trouble breathing, chest pain, confusion, worsening symptoms, or high-risk conditions.",
      tone: "care",
      destination: "symptoms",
      actionLabel: "Go to symptoms"
    };
  }

  const utiHits = countMedicalMatches(recentText, [
    /\b(burning pee|burning urination|painful urination|pain when urinating)\b/i,
    /\b(frequent urination|urgent urination|pee often|urinate often)\b/i,
    /\b(lower belly pain|pelvic pressure|cloudy urine|bloody urine|bad smelling urine)\b/i,
    /\b(back pain|side pain|flank pain|fever|shaky|shakiness)\b/i
  ]);
  if (utiHits >= 2) {
    return {
      title: "UTI symptom pattern",
      body: "Recent notes overlap with MedlinePlus urinary tract infection symptoms. A clinician can confirm this with urine testing; seek prompt care for fever, back or side pain, vomiting, pregnancy, or worsening symptoms.",
      tone: "care",
      destination: "symptoms",
      actionLabel: "Go to symptoms"
    };
  }

  const dehydrationHits = countMedicalMatches(recentText, [
    /\b(extreme thirst|very thirsty|dark urine|not peeing|less urination)\b/i,
    /\b(dizzy|dizziness|lightheaded|fatigue|confusion)\b/i,
    /\b(vomiting|diarrhea|fever|sweating|heat)\b/i
  ]);
  const lowWaterCount = recentVitals.filter((entry) => Number.isFinite(entry.water) && entry.water < getDailyWaterGoal()).length;
  if (dehydrationHits >= 2 || (dehydrationHits >= 1 && lowWaterCount >= 2)) {
    return {
      title: "Dehydration pattern",
      body: "Recent water logs and notes overlap with Mayo Clinic dehydration symptoms. Increase fluids if safe for you, and get medical help for confusion, fainting, inability to keep fluids down, bloody or black stool, or diarrhea lasting 24 hours or more.",
      tone: "care",
      destination: "water",
      actionLabel: "Go to water"
    };
  }

  const highGlucoseCount = recentVitals.filter((entry) => Number.isFinite(entry.glucose) && entry.glucose > 180).length;
  if (highGlucoseCount >= 2 && matchesAnyPattern(recentText, [/\b(very thirsty|extreme thirst|frequent urination|pee often|blurred vision|fatigue|tired)\b/i])) {
    return {
      title: "High glucose symptom pattern",
      body: "Repeated high glucose with thirst, frequent urination, fatigue, or blurred vision can fit diabetes-related warning patterns described by MedlinePlus. Track timing and discuss repeated highs with a clinician.",
      tone: "health",
      destination: "vitals",
      actionLabel: "Go to history"
    };
  }

  return null;
}

function getRecentHealthText(days) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const parts = [];
  symptomEntries.forEach((entry) => {
    if (parseDateKey(entry.date) >= cutoff) parts.push(entry.name, entry.severity, entry.note);
  });
  moodEntries.forEach((entry) => {
    if (parseDateKey(entry.date) >= cutoff) parts.push(entry.name, entry.intensity, entry.note);
  });
  journalEntries.forEach((entry) => {
    if (parseDateKey(entry.date) >= cutoff) parts.push(entry.text);
  });
  return parts.filter(Boolean).join(" ");
}

function countMedicalMatches(value, patterns) {
  return patterns.reduce((count, pattern) => count + (pattern.test(value) ? 1 : 0), 0);
}

function getTaskTrendInsight() {
  const recentDays = getRecentDateKeys(7, 0);
  const previousDays = getRecentDateKeys(7, 7);
  const recent = getAverageTaskCompletionForDates(recentDays);
  const previous = getAverageTaskCompletionForDates(previousDays);
  if (!Number.isFinite(recent) || !Number.isFinite(previous)) return null;
  const change = Math.round(recent - previous);
  if (Math.abs(change) < 10) return null;
  return {
    title: change > 0 ? "Task trend improving" : "Task trend slipping",
    body: `Task completion is ${Math.abs(change)} points ${change > 0 ? "higher" : "lower"} than the prior week based on scheduled tasks.`,
    tone: change > 0 ? "steady" : "action",
    destination: change < 0 ? "tasks" : null,
    actionLabel: change < 0 ? "Go to tasks" : null
  };
}

function getDeadlineTrendInsight() {
  const recentEvents = taskDeadlineEvents.filter((event) => event.date >= getRecentCutoffKey(30));
  const now = new Date();
  const overdueNow = getCurrentOverdueTasks(now);
  if (overdueNow.length) {
    return {
      title: "Task deadlines slipping",
      body: `${overdueNow.length} task${overdueNow.length === 1 ? "" : "s"} are past deadline and still open. Clear or reschedule those before adding more tasks.`,
      tone: "action",
      destination: "tasks",
      actionLabel: "Go to tasks"
    };
  }
  const comingDue = getUpcomingDeadlineTasks(now);
  if (comingDue.length) {
    const next = comingDue[0];
    const hours = Math.max(1, Math.ceil((next.dueAt.getTime() - now.getTime()) / (60 * 60 * 1000)));
    return {
      title: "Task coming due",
      body: `${next.habit.name} is due in about ${hours} hour${hours === 1 ? "" : "s"}. Finish it now or move the deadline before it becomes overdue.`,
      tone: "action",
      destination: "tasks",
      actionLabel: "Go to tasks"
    };
  }
  if (recentEvents.length < 2) return null;
  return {
    title: "Deadline pattern watch",
    body: `${recentEvents.length} task deadline${recentEvents.length === 1 ? "" : "s"} went past due in the last 30 days. Shorten the task list or move deadlines earlier in the day so misses show up before night.`,
    tone: "action",
    destination: "tasks",
    actionLabel: "Go to tasks"
  };
}

function getNumericTrendInsight(title, entries, key, unit, minimumCount, higherIsBetter) {
  const values = entries
    .filter((entry) => Number.isFinite(entry[key]))
    .sort((first, second) => first.date.localeCompare(second.date));
  if (values.length < minimumCount) return null;
  const recent = getAverage(values.slice(-Math.ceil(minimumCount / 2)).map((entry) => entry[key]));
  const previous = getAverage(values.slice(-minimumCount, -Math.ceil(minimumCount / 2)).map((entry) => entry[key]));
  if (!Number.isFinite(recent) || !Number.isFinite(previous)) return null;
  const change = recent - previous;
  const threshold = key === "weight" ? 1 : key === "water" ? 8 : key === "glucose" ? 5 : 1;
  if (Math.abs(change) < threshold) return null;
  const improved = higherIsBetter ? change > 0 : change < 0;
  return {
    title: improved ? `${title} looks better` : `${title} needs attention`,
    body: `${title.replace(" trend", "")} moved ${formatTrendAmount(change, unit)} compared with the previous logged stretch.`,
    tone: improved ? "steady" : "health",
    destination: improved ? null : key === "water" ? "water" : "vitals",
    actionLabel: improved ? null : key === "water" ? "Go to water" : "Go to history"
  };
}

function getGlucosePatternInsight() {
  const readings = nutritionEntries
    .filter((entry) => Number.isFinite(entry.glucose))
    .sort((first, second) => first.date.localeCompare(second.date))
    .slice(-7);
  if (readings.length < 3) return null;
  const lowCount = readings.filter((entry) => entry.glucose < 70).length;
  const highCount = readings.filter((entry) => entry.glucose > 180).length;
  if (lowCount >= 2) {
    return {
      title: "Low glucose pattern",
      body: `${lowCount} of your last ${readings.length} glucose readings were below 70 mg/dL. Look for timing patterns around meals, activity, medication, sleep, or alcohol, and bring repeated lows to your care team.`,
      tone: "care",
      destination: "vitals",
      actionLabel: "Go to history"
    };
  }
  if (highCount >= 3) {
    return {
      title: "High glucose pattern",
      body: `${highCount} of your last ${readings.length} glucose readings were above 180 mg/dL. Check whether they cluster after specific meals, stress, missed sleep, or lower activity days.`,
      tone: "health",
      destination: "vitals",
      actionLabel: "Go to history"
    };
  }
  return null;
}

function getBloodPressureTrendInsight() {
  const values = nutritionEntries
    .filter((entry) => Number.isFinite(entry.systolic) && Number.isFinite(entry.diastolic))
    .sort((first, second) => first.date.localeCompare(second.date));
  if (values.length < 8) return null;
  const recent = values.slice(-4);
  const previous = values.slice(-8, -4);
  const recentSys = getAverage(recent.map((entry) => entry.systolic));
  const previousSys = getAverage(previous.map((entry) => entry.systolic));
  const recentDia = getAverage(recent.map((entry) => entry.diastolic));
  const previousDia = getAverage(previous.map((entry) => entry.diastolic));
  const sysChange = recentSys - previousSys;
  const diaChange = recentDia - previousDia;
  if (Math.abs(sysChange) < 5 && Math.abs(diaChange) < 3) return null;
  const improved = sysChange < 0 && diaChange <= 1;
  return {
    title: improved ? "Blood pressure trending down" : "Blood pressure trending up",
    body: `Recent average moved ${formatTrendAmount(sysChange, "systolic")} and ${formatTrendAmount(diaChange, "diastolic")} compared with the prior readings.`,
    tone: improved ? "steady" : "health"
  };
}

function getMoodTrendInsight() {
  const scores = moodEntries
    .map((entry) => ({ date: entry.date, score: getMoodScore(entry.name) }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((first, second) => first.date.localeCompare(second.date));
  if (scores.length < 6) return null;
  const recent = getAverage(scores.slice(-3).map((entry) => entry.score));
  const previous = getAverage(scores.slice(-6, -3).map((entry) => entry.score));
  const change = recent - previous;
  if (Math.abs(change) < 0.75) return null;
  return {
    title: change > 0 ? "Mood trend improving" : "Mood trend declining",
    body: `Recent mood logs are averaging ${change > 0 ? "better" : "lower"} than the previous few entries.`,
    tone: change > 0 ? "steady" : "care",
    destination: change < 0 ? "mood" : null,
    actionLabel: change < 0 ? "Go to mood" : null
  };
}

function getSymptomTrendInsight() {
  const recentCount = getEntryCountInLastDays(symptomEntries, 7, 0);
  const previousCount = getEntryCountInLastDays(symptomEntries, 7, 7);
  if (recentCount + previousCount < 3 || recentCount === previousCount) return null;
  return {
    title: recentCount < previousCount ? "Symptoms easing" : "Symptoms increasing",
    body: `You logged ${recentCount} symptoms this week versus ${previousCount} the week before.`,
    tone: recentCount < previousCount ? "steady" : "care",
    destination: recentCount > previousCount ? "symptoms" : null,
    actionLabel: recentCount > previousCount ? "Go to symptoms" : null
  };
}

function getJournalPatternInsight() {
  const recent = journalEntries
    .filter((entry) => entry.date >= getRecentCutoffKey(30))
    .sort((first, second) => second.date.localeCompare(first.date));
  if (!recent.length) return null;
  const crisisEntry = recent.find((entry) => hasCrisisLanguage(entry.text));
  if (crisisEntry) {
    return {
      title: "Journal safety concern",
      body: "A journal entry includes language that can match suicide or self-harm warning signs. If there is immediate danger, call 911 now or text 911 if available. For suicide prevention support in the U.S., call or text 988.",
      tone: "care",
      destination: "journal",
      actionLabel: "Go to journal"
    };
  }
  const depressionHits = recent.filter((entry) => matchesAnyPattern(normalizeJournalConcernText(entry.text), depressionMoodPatterns));
  if (depressionHits.length >= 1) {
    return {
      title: "Journal mood pattern",
      body: `${depressionHits.length} recent journal entr${depressionHits.length === 1 ? "y uses" : "ies use"} depression warning language. Do one immediate support step: lower today's task load, tell one trusted person, and consider professional support if this keeps showing up.`,
      tone: "care",
      destination: "journal",
      actionLabel: "Go to journal"
    };
  }
  const thoughtHits = recent.filter((entry) => {
    const normalized = normalizeJournalConcernText(entry.text);
    return matchesAnyPattern(normalized, unhealthyThoughtPatterns) || matchesAnyPattern(normalized, journalConcernPatterns);
  });
  if (thoughtHits.length >= 1) {
    return {
      title: "Thought pattern watch",
      body: `${thoughtHits.length} recent journal entries show repeated negative thought patterns like all-or-nothing thinking, self-blame, or worst-case spiraling. Write one balanced counterpoint, then choose one small action you can control today.`,
      tone: "care",
      destination: "journal",
      actionLabel: "Go to journal"
    };
  }
  const linkedPattern = getJournalLinkedPattern(recent);
  if (linkedPattern) return linkedPattern;
  const stressHits = recent.filter((entry) => matchesAnyPattern(normalizeJournalConcernText(entry.text), journalStressPatterns));
  if (stressHits.length >= 1) {
    return {
      title: "Journal stress pattern",
      body: `${stressHits.length} recent journal entries mention stress or anxiety. Reduce the next task list, add a short reset task, and check whether water, glucose, blood pressure, or symptoms changed on the same dates.`,
      tone: "care",
      destination: "journal",
      actionLabel: "Go to journal"
    };
  }
  return null;
}

function getLatestJournalEntryInsight() {
  const todayEntries = journalEntries.filter((entry) => entry.date === today && entry.text);
  if (!todayEntries.length) return null;
  const crisisEntry = todayEntries.find((entry) => hasCrisisLanguage(entry.text));
  if (crisisEntry) {
    return {
      title: "Journal safety concern",
      body: "Today's journal entry includes language that can match suicide or self-harm warning signs. If you might act on those thoughts or are in immediate danger, call 911 now or text 911 if available. For suicide prevention support in the U.S., call or text 988.",
      tone: "care",
      destination: "journal",
      actionLabel: "Go to journal"
    };
  }
  const depressionEntry = todayEntries.find((entry) => matchesAnyPattern(normalizeJournalConcernText(entry.text), depressionMoodPatterns));
  if (depressionEntry) {
    return {
      title: "Support from today's journal",
      body: "Today's journal entry sounds heavy. Keep the next task small, drink water, pause before adding more obligations, and reach out to a trusted person or clinician if this feeling is sticking around.",
      tone: "care",
      destination: "journal",
      actionLabel: "Go to journal"
    };
  }
  const thoughtEntry = todayEntries.find((entry) => {
    const normalized = normalizeJournalConcernText(entry.text);
    return matchesAnyPattern(normalized, unhealthyThoughtPatterns) || matchesAnyPattern(normalized, journalConcernPatterns);
  });
  if (thoughtEntry) {
    return {
      title: "Thought pattern in journal",
      body: "Today's journal entry has signs of self-blame, worst-case thinking, or all-or-nothing language. Write one balanced counterpoint, then choose one small action you can control in the next 10 minutes.",
      tone: "care",
      destination: "journal",
      actionLabel: "Go to journal"
    };
  }
  const stressEntry = todayEntries.find((entry) => matchesAnyPattern(normalizeJournalConcernText(entry.text), journalStressPatterns));
  if (stressEntry) {
    return {
      title: "Stress signal in journal",
      body: "Today's journal entry points to stress. Make the app work for that: reduce the task list, log mood and symptoms, and use the next task as a reset instead of another demand.",
      tone: "care",
      destination: "journal",
      actionLabel: "Go to journal"
    };
  }
  return null;
}

function hasCrisisLanguage(text) {
  const normalized = normalizeJournalConcernText(text);
  return matchesAnyPattern(normalized, crisisMoodPatterns) || (
    /\b(i'?m|i am|im|feel|feeling)\b/.test(normalized) &&
    matchesAnyPattern(normalized, journalConcernPatterns) &&
    matchesAnyPattern(normalized, depressionMoodPatterns)
  );
}

function handleImmediateJournalSafetySignal(text) {
  if (!hasCrisisLanguage(text)) return;
  const body = "AI Coach noticed a serious journal safety warning. If you might hurt yourself or are in danger, call 911 now, text 911 if available, call or text 988 for suicide prevention support, or call a trusted friend.";
  sendAppNotification("AI Coach safety alert", body, `wellbeing:journal-crisis:${Date.now()}`);
  window.alert(body);
}

async function scanJournalAndAppWithAiForSafety(latestJournalText = "") {
  if (!canUseCloudAi()) return;
  const requestId = aiSafetyScanRequestId + 1;
  aiSafetyScanRequestId = requestId;
  try {
    const result = await fetchAiSafetyScan(buildAiSafetyScanSnapshot(latestJournalText));
    if (requestId !== aiSafetyScanRequestId || !result) return;
    handleAiSafetyScanResult(result);
  } catch (error) {
    console.warn("AI safety scan failed.", error);
  }
}

function buildAiSafetyScanSnapshot(latestJournalText = "") {
  return {
    scanReason: "journal_saved",
    latestJournalText: truncateForAi(latestJournalText, 1200),
    journalEntries: journalEntries.map((entry) => ({
      date: entry.date,
      text: truncateForAi(entry.text, 700)
    })).slice(0, 40),
    moodEntries: moodEntries.map((entry) => ({
      date: entry.date,
      mood: entry.name,
      intensity: entry.intensity,
      note: truncateForAi(entry.note, 300)
    })).slice(0, 60),
    symptomEntries: symptomEntries.map((entry) => ({
      date: entry.date,
      symptom: entry.name,
      severity: entry.severity,
      note: truncateForAi(entry.note, 300)
    })).slice(0, 60),
    localTrendFlags: buildWholeAppTrendScan()
  };
}

async function fetchAiSafetyScan(snapshot) {
  if (!canUseCloudAi()) return null;
  const headers = { "Content-Type": "application/json" };
  if (appSettings.aiBackendToken) headers["X-App-Token"] = appSettings.aiBackendToken;
  const backendUrl = getConfiguredAiBackendUrl();
  if (!backendUrl) return null;
  const response = await fetchWithTimeout(`${backendUrl}/api/safety/scan`, {
    method: "POST",
    headers,
    body: JSON.stringify({ snapshot })
  }, AI_SAFETY_SCAN_TIMEOUT_MS);
  if (!response.ok) throw new Error(await getFriendlyAiError(response, "AI safety scan"));
  return normalizeAiSafetyScanResult(await response.json());
}

function normalizeAiSafetyScanResult(data) {
  const level = ["none", "concern", "crisis"].includes(data?.level) ? data.level : "none";
  return {
    level,
    matchedText: cleanAiCoachText(data?.matchedText || "").slice(0, 180),
    reason: cleanAiCoachText(data?.reason || "").slice(0, 220),
    action: cleanAiCoachText(data?.action || "").slice(0, 180)
  };
}

function handleAiSafetyScanResult(result) {
  if (result.level === "crisis") {
    const body = `OpenAI safety scan flagged a serious journal warning${result.reason ? `: ${result.reason}` : "."} If you might hurt yourself or are in danger, call 911 now, text 911 if available, call or text 988 for suicide prevention support, or call a trusted friend.`;
    sendAppNotification("AI Coach safety alert", body, `wellbeing:journal-ai-crisis:${Date.now()}`);
    window.alert(body);
    scheduleSmartCoachRender();
    return;
  }
  if (result.level === "concern") {
    sendAppNotification(
      "AI Coach check-in",
      `OpenAI safety scan noticed concerning journal or mood language${result.reason ? `: ${result.reason}` : "."} Is there anything that can be done to help right now?`,
      `wellbeing:journal-ai-concern:${Date.now()}`
    );
    scheduleSmartCoachRender();
  }
}

function normalizeJournalConcernText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/\bmy\s+self\b/g, "myself")
    .replace(/\bmy(?:s[e3]l[fv]|s[e3]kf|slef|sefl|selfe|selff|sekf|slekf|slefk)\b/g, "myself")
    .replace(/\bkil+\b|\bkilll\b/g, "kill")
    .replace(/\bk1ll\b|\bk!ll\b/g, "kill")
    .replace(/\bki[l1]l\s+myself\b/g, "kill myself")
    .replace(/\bkms\b/g, "kill myself")
    .replace(/\bkys\b/g, "kill yourself")
    .replace(/\bsui(?:cide|cidal|side|c1de|c!de)?\b/g, "suicide")
    .replace(/\bunaliv(?:e|ing)?\s*(?:myself|me)?\b/g, "kill myself")
    .replace(/\bun alive\s+(?:myself|me)\b/g, "kill myself")
    .replace(/\boff\s+myself\b/g, "kill myself")
    .replace(/\bdelete\s+(?:myself|me)\b/g, "kill myself")
    .replace(/\bself\s+delete\b/g, "kill myself")
    .replace(/\bnot\s+wake\s+up\b/g, "not wake up")
    .replace(/\bselfharm\b/g, "self harm")
    .replace(/\bdeprest\b|\bdepresed\b|\bdeppressed\b|\bdepresd\b/g, "depressed")
    .replace(/\bhopless\b|\bhope less\b|\bhoepeless\b/g, "hopeless")
    .replace(/\bworthles\b|\bworthlesss\b/g, "worthless")
    .replace(/\bbeter\b/g, "better")
    .replace(/\boverwhelmd\b|\boverwhealmed\b|\boverwhelmedd\b/g, "overwhelmed")
    .replace(/\banx(?:y|ie|ious)?\b/g, "anxious")
    .replace(/\bpanicing\b|\bpanick(?:ing|ed)?\b/g, "panic")
    .replace(/\bcant\b/g, "can't")
    .replace(/\bdont\b/g, "don't")
    .replace(/\bim\b/g, "i'm")
    .replace(/\s+/g, " ")
    .trim();
}

function getJournalLinkedPattern(entries) {
  const linked = entries.map((entry) => {
    const symptomCount = symptomEntries.filter((symptom) => symptom.date === entry.date).length;
    const mood = moodEntries.find((item) => item.date === entry.date);
    const vitals = nutritionEntries.find((item) => item.date === entry.date);
    const hasVitalsFlag = Boolean(vitals && (
      getBloodPressureCategory(vitals.systolic, vitals.diastolic).level !== "normal" ||
      (Number.isFinite(vitals.glucose) && (vitals.glucose < 70 || vitals.glucose > 180)) ||
      (Number.isFinite(vitals.water) && vitals.water < getDailyWaterGoal())
    ));
    const hasLowMood = mood && ["Low", "Stressed", "Anxious"].includes(mood.name);
    return { entry, symptomCount, hasVitalsFlag, hasLowMood };
  });
  const issueDays = linked.filter((item) => item.symptomCount || item.hasVitalsFlag || item.hasLowMood);
  if (issueDays.length < 2) return null;
  const symptomDays = issueDays.filter((item) => item.symptomCount).length;
  const vitalsDays = issueDays.filter((item) => item.hasVitalsFlag).length;
  const moodDays = issueDays.filter((item) => item.hasLowMood).length;
  const parts = [
    symptomDays ? `${symptomDays} symptom day${symptomDays === 1 ? "" : "s"}` : "",
    vitalsDays ? `${vitalsDays} vitals flag${vitalsDays === 1 ? "" : "s"}` : "",
    moodDays ? `${moodDays} low mood day${moodDays === 1 ? "" : "s"}` : ""
  ].filter(Boolean).join(", ");
  return {
    title: "Journal-health link",
    body: `Recent journal dates overlap with ${parts}. Look at what you wrote on those days, then adjust one controllable factor: hydration, food timing, task load, sleep, or stress recovery.`,
    tone: "health",
    destination: "journal",
    actionLabel: "Go to journal"
  };
}

function getRecentDateKeys(count, offsetDays) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - offsetDays - (count - 1 - index));
    return toDateKey(date);
  });
}

function getAverageTaskCompletionForDates(dateKeys) {
  const percentages = dateKeys.map(getTaskCompletionPercent).filter(Number.isFinite);
  return percentages.length ? getAverage(percentages) : null;
}

function formatTrendAmount(value, unit) {
  const amount = Math.abs(value) >= 10 ? Math.round(Math.abs(value)) : Math.abs(value).toFixed(1);
  return `${value >= 0 ? "up" : "down"} ${amount} ${unit}`;
}

function getMoodScore(mood) {
  return {
    Great: 5,
    Good: 4,
    Okay: 3,
    Low: 2,
    Stressed: 2,
    Anxious: 2
  }[mood] || null;
}

function getMoodSuggestion(mood) {
  const suggestions = {
    Low: {
      body: "CDC and NIMH guidance points toward small physical activity, social connection, hydration, sleep priority, and naming feelings. Start with a 10-minute walk or a check-in text.",
      task: "Take a 10 minute walk"
    },
    Stressed: {
      body: "Stress support guidance emphasizes relaxation, journaling, movement, sleep, and setting priorities. Try a short breathing reset, then write down the next one thing.",
      task: "Two minute breathing reset"
    },
    Anxious: {
      body: "For anxious mood, use a grounding routine: slow breathing, light movement, less caffeine, and one supportive contact. Keep the next task small and specific.",
      task: "Ground and breathe"
    }
  };
  return suggestions[mood] || {
    body: "Mood support works best with small basics: move a little, drink water, protect sleep, write what you feel, and connect with someone supportive.",
    task: "Mood reset"
  };
}

function getBloodPressureCategory(systolic, diastolic) {
  if (systolic <= 90 || diastolic <= 60) return { label: "Low", level: "low" };
  if (systolic > 180 || diastolic > 120) return { label: "Severe", level: "severe" };
  if (systolic >= 140 || diastolic >= 90) return { label: "Stage 2", level: "stage2" };
  if ((systolic >= 130 && systolic <= 139) || (diastolic >= 80 && diastolic <= 89)) return { label: "Stage 1", level: "stage1" };
  if (systolic >= 120 && systolic <= 129 && diastolic < 80) return { label: "Elevated", level: "elevated" };
  return { label: "Normal", level: "normal" };
}

function getLatestBmi(weightPounds) {
  const inches = Number(appSettings.heightInches) || 0;
  if (!Number.isFinite(weightPounds) || inches <= 0) return null;
  return (weightPounds / (inches * inches)) * 703;
}

function getDailyWaterGoal() {
  const latestWeightEntry = nutritionEntries.find((entry) => Number.isFinite(entry.weight));
  const latestWeightPounds = latestWeightEntry ? latestWeightEntry.weight : null;
  const bmi = Number.isFinite(latestWeightPounds) ? getLatestBmi(latestWeightPounds) : null;
  let goal = DEFAULT_WATER_GOAL_OZ;

  if (Number.isFinite(latestWeightPounds)) {
    if (latestWeightPounds < 105) goal = 64;
    else if (latestWeightPounds < 130) goal = 72;
    else goal = Math.min(MAX_WATER_GOAL_OZ, Math.max(goal, Math.round((latestWeightPounds * 0.5) / WATER_GLASS_OZ) * WATER_GLASS_OZ));
  }

  if (Number.isFinite(bmi) && bmi < 18.5) {
    goal = Math.min(goal, 72);
  }

  const recentSymptoms = symptomEntries
    .filter((entry) => daysBetween(entry.date, today) <= 3)
    .map((entry) => `${entry.name || ""} ${entry.note || ""}`)
    .join(" ");
  if (/\b(fever|diarrhea|vomit|vomiting|sweat|sweating|heat|dehydrated|dehydration)\b/i.test(recentSymptoms)) {
    goal += WATER_GLASS_OZ;
  }

  return Math.max(MIN_WATER_GOAL_OZ, Math.min(MAX_WATER_GOAL_OZ, Math.round(goal / WATER_GLASS_OZ) * WATER_GLASS_OZ));
}

function getBmiCategory(bmi) {
  if (bmi < 18.5) return { label: "Underweight", level: "underweight" };
  if (bmi < 25) return { label: "Healthy weight", level: "healthy" };
  if (bmi < 30) return { label: "Overweight", level: "overweight" };
  return { label: "Obesity", level: "obesity" };
}

function getEntryCountInLastDays(entries, days, offsetDays) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - offsetDays - days + 1);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  end.setDate(end.getDate() - offsetDays);
  return entries.filter((entry) => {
    const date = parseDateKey(entry.date);
    return date >= start && date <= end;
  }).length;
}

function addSuggestedTask(name) {
  const dayName = weekDays[new Date().getDay()];
  const duplicate = habits.some((habit) => habit.name.toLowerCase() === name.toLowerCase() && isTaskScheduledForDate(habit, today));
  if (duplicate) return;
  habits = [{
    id: createHabitId(),
    name,
    date: today,
    day: dayName,
    category: "Health",
    time: "",
    deadline: "",
    priority: "Normal",
    color: "#1e40af",
    note: "Suggested by AI Coach",
    completions: []
  }, ...habits];
  saveHabits();
  render();
}

function toggleWeightUnit() {
  const currentWeight = parseNutritionNumber(weight.value);
  if (!Number.isFinite(currentWeight)) {
    weight.focus();
    return;
  }

  if (weightUnit === "lb") {
    weight.value = formatInputDecimal(currentWeight / 2.2046226218);
    weightUnit = "kg";
  } else {
    weight.value = formatInputDecimal(currentWeight * 2.2046226218);
    weightUnit = "lb";
  }

  updateWeightConvertButton();
  weight.focus();
  weight.select();
}

function updateWeightConvertButton() {
  convertWeight.textContent = weightUnit === "lb" ? "lbs to kgs" : "kgs to lbs";
  if (weightUnitLabel) {
    weightUnitLabel.textContent = weightUnit === "lb" ? "Weight (lbs)" : "Weight (kgs)";
  }
}

function getWeightInPoundsForSave() {
  const currentWeight = parseNutritionNumber(weight.value);
  if (!Number.isFinite(currentWeight)) return null;
  return weightUnit === "kg" ? currentWeight * 2.2046226218 : currentWeight;
}

function jumpFromDashboard(target) {
  if (["vitals", "water", "mood", "symptoms"].includes(target)) {
    setWellbeingModule(target);
  }
  if (target === "water") {
    setWaterExpanded(true);
  }
  const targets = {
    ai: document.querySelector("#smartCoachSection"),
    dashboard: document.querySelector(".today-dashboard"),
    tasks: document.querySelector("#todayTasksSection") || habitForm,
    weekly: weeklyTaskPercentBar,
    water: document.querySelector("#waterControl"),
    vitals: nutritionPanel,
    mood: moodPanel,
    symptoms: symptomPanel,
    journal: journalPanel,
    settings: document.querySelector("#settingsButton")
  };
  const destination = targets[target];
  if (!destination) return;
  destination.scrollIntoView({ behavior: "smooth", block: "start" });

  const focusTarget = destination.matches(".day-section")
    ? destination.querySelector(".day-section-header")
    : destination.querySelector("input, select, button, textarea") || destination;
  if (focusTarget && typeof focusTarget.focus === "function") {
    window.setTimeout(() => focusTarget.focus({ preventScroll: true }), 250);
  }
}

function reviewToday() {
  const reviewItems = getReviewTodayItems();
  reviewTodayList.textContent = "";
  reviewItems.forEach((item) => {
    const row = document.createElement("button");
    const status = document.createElement("span");
    const text = document.createElement("strong");
    const detail = document.createElement("small");
    row.type = "button";
    row.className = "review-today-row";
    row.classList.toggle("complete", item.complete);
    row.setAttribute("aria-label", `${item.title}: ${item.detail}`);
    status.textContent = item.complete ? "✓" : "!";
    text.textContent = item.title;
    detail.textContent = item.detail;
    row.append(status, text, detail);
    row.addEventListener("click", () => {
      reviewTodayModal.hidden = true;
      jumpFromDashboard(item.destination);
    });
    reviewTodayList.appendChild(row);
  });
  reviewTodayModal.hidden = false;
}

function openReminderCenter() {
  const items = getReminderCenterItems();
  reminderCenterList.textContent = "";
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "nutrition-empty";
    empty.textContent = "No open reminders right now.";
    reminderCenterList.appendChild(empty);
  }
  items.forEach((item) => {
    const row = document.createElement("button");
    const status = document.createElement("span");
    const text = document.createElement("strong");
    const detail = document.createElement("small");
    row.type = "button";
    row.className = "review-today-row reminder-center-row";
    row.classList.toggle("complete", item.tone === "steady");
    status.textContent = item.marker;
    text.textContent = item.title;
    detail.textContent = item.detail;
    row.append(status, text, detail);
    row.addEventListener("click", () => {
      reminderCenterModal.hidden = true;
      jumpFromDashboard(item.destination || "tasks");
    });
    reminderCenterList.appendChild(row);
  });
  reminderCenterModal.hidden = false;
}

function getReminderCenterItems() {
  const now = new Date();
  const todayTasks = habits.filter((habit) => isTaskScheduledForDate(habit, today));
  const openTodayTasks = todayTasks.filter((habit) => !habit.completions.includes(today));
  const overdue = getCurrentOverdueTasks(now);
  const upcomingDeadlines = getUpcomingDeadlineTasks(now);
  const upcomingTasks = getUpcomingTaskReminderCandidates(now, 5).slice(0, 4);
  const items = [];

  overdue.slice(0, 4).forEach((occurrence) => {
    items.push({
      marker: "!",
      title: occurrence.habit.name,
      detail: `Past its ${formatTaskTime(occurrence.habit.deadline)} deadline`,
      destination: "tasks"
    });
  });

  upcomingDeadlines.slice(0, 4).forEach((occurrence) => {
    const dueDate = occurrence.dateKey === today ? "today" : formatSymptomHistoryDate(occurrence.dateKey);
    items.push({
      marker: "24",
      title: occurrence.habit.name,
      detail: `Due ${formatTaskTime(occurrence.habit.deadline)} ${dueDate}`,
      destination: "tasks",
      tone: "steady"
    });
  });

  if (openTodayTasks.length) {
    items.push({
      marker: String(openTodayTasks.length),
      title: "Open today",
      detail: `${openTodayTasks.length} task${openTodayTasks.length === 1 ? "" : "s"} left today`,
      destination: "tasks"
    });
  }

  upcomingTasks.forEach((item) => {
    const when = item.offset === 1 ? "tomorrow" : `${item.dayName}, ${formatSymptomHistoryDate(item.dateKey)}`;
    items.push({
      marker: item.missedBefore ? "!" : "-",
      title: item.habit.name,
      detail: item.missedBefore ? `Coming ${when}, missed before` : `Coming ${when}`,
      destination: "tasks",
      tone: item.missedBefore ? "warn" : "steady"
    });
  });

  return items.slice(0, 10);
}

function triggerHapticFeedback(strength = "light") {
  const now = Date.now();
  if (now - lastHapticAt < 55) return;
  lastHapticAt = now;
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  const pattern = strength === "medium" ? 14 : strength === "success" ? [8, 32, 12] : 8;
  navigator.vibrate(pattern);
}

function getHapticElement(target) {
  if (!target || typeof target.closest !== "function") return null;
  return target.closest("button, [role='button'], [role='tab'], summary, select, input[type='checkbox'], input[type='radio'], input[type='range'], .day-section-header");
}

function installHapticFeedback() {
  document.addEventListener("pointerup", (event) => {
    if (event.pointerType === "mouse") return;
    const element = getHapticElement(event.target);
    if (!element || element.disabled || element.getAttribute("aria-disabled") === "true") return;
    const strength = element.matches(".primary-button, .check-button, input[type='range']") ? "medium" : "light";
    triggerHapticFeedback(strength);
  }, { capture: true, passive: true });

  document.addEventListener("change", (event) => {
    const element = getHapticElement(event.target);
    if (!element) return;
    triggerHapticFeedback("light");
  }, { capture: true });

  document.addEventListener("submit", () => {
    triggerHapticFeedback("success");
  }, { capture: true });
}

function showToast(message) {
  if (!appToast) return;
  appToast.textContent = message;
  appToast.hidden = false;
  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => {
    appToast.hidden = true;
  }, 1800);
}

function getReviewTodayItems() {
  const summary = getTodaySummary();
  const todayTasks = summary.tasks;
  const incompleteTasks = summary.incompleteTasks;
  const todayEntry = summary.entry;
  const todayMood = summary.mood;
  const todaySymptoms = summary.symptoms;
  const todayJournal = summary.journal;
  return [
    {
      title: "Tasks",
      detail: todayTasks.length ? (incompleteTasks.length ? `${incompleteTasks.length} still open` : "Complete") : "Not logged",
      complete: !incompleteTasks.length && todayTasks.length > 0,
      destination: "tasks"
    },
    {
      title: "Water",
      detail: todayEntry && Number.isFinite(todayEntry.water) && todayEntry.water > 0 ? `${formatWholeNumber(todayEntry.water)} oz logged` : "Not logged",
      complete: Boolean(todayEntry && Number.isFinite(todayEntry.water) && todayEntry.water > 0),
      destination: "water"
    },
    {
      title: "Nutrition & Vitals",
      detail: todayEntry && hasVitalsData(todayEntry) ? "Logged" : "Not logged",
      complete: Boolean(todayEntry && hasVitalsData(todayEntry)),
      destination: "vitals"
    },
    {
      title: "Mood",
      detail: todayMood ? todayMood.name : "Not logged",
      complete: Boolean(todayMood),
      destination: "mood"
    },
    {
      title: "Symptoms",
      detail: todaySymptoms.length ? `${todaySymptoms.length} logged` : "Not logged",
      complete: todaySymptoms.length > 0,
      destination: "symptoms"
    },
    {
      title: "Journal",
      detail: todayJournal ? "Private entry saved" : "Not logged",
      complete: Boolean(todayJournal),
      destination: "journal"
    }
  ];
}

function hasVitalsData(entry) {
  return Boolean(entry) && [
    entry.calories,
    entry.carbs,
    entry.weight,
    entry.glucose,
    entry.systolic,
    entry.diastolic
  ].some(Number.isFinite);
}

function setOverviewModule(moduleName) {
  const selectedModule = overviewModules.includes(moduleName) ? moduleName : "coach";
  overviewPanels.forEach((panel) => {
    panel.hidden = panel.dataset.overviewPanel !== selectedModule;
  });
  overviewTabs.forEach((tab) => {
    const isSelected = tab.dataset.overviewModule === selectedModule;
    tab.setAttribute("aria-selected", String(isSelected));
    if (isSelected) tab.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  });
}

function handleOverviewSwipe(deltaX) {
  if (Math.abs(deltaX) < 48) return;
  const currentModule = Array.from(overviewTabs).find((tab) => tab.getAttribute("aria-selected") === "true")?.dataset.overviewModule || "coach";
  const currentIndex = overviewModules.indexOf(currentModule);
  const direction = deltaX < 0 ? 1 : -1;
  const nextIndex = Math.max(0, Math.min(overviewModules.length - 1, currentIndex + direction));
  if (nextIndex !== currentIndex) {
    setOverviewModule(overviewModules[nextIndex]);
  }
}

function setWellbeingModule(moduleName) {
  const selectedModule = wellbeingModules.includes(moduleName) ? moduleName : "vitals";
  const panels = {
    vitals: nutritionPanel,
    charts: chartsPanel,
    symptoms: symptomPanel,
    mood: moodPanel
  };
  Object.entries(panels).forEach(([name, panel]) => {
    if (!panel) return;
    panel.hidden = name !== selectedModule;
  });
  wellbeingTabs.forEach((tab) => {
    const isSelected = tab.dataset.wellbeingModule === selectedModule;
    tab.setAttribute("aria-selected", String(isSelected));
    if (isSelected) tab.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  });
  if (selectedModule === "charts") {
    vitalsHistoryDropdown.open = true;
    syncHistoryControls();
    renderHistory();
  }
}

function handleWellbeingSwipe(deltaX) {
  if (Math.abs(deltaX) < 48) return;
  const currentModule = Array.from(wellbeingTabs).find((tab) => tab.getAttribute("aria-selected") === "true")?.dataset.wellbeingModule || "vitals";
  const currentIndex = wellbeingModules.indexOf(currentModule);
  const direction = deltaX < 0 ? 1 : -1;
  const nextIndex = Math.max(0, Math.min(wellbeingModules.length - 1, currentIndex + direction));
  if (nextIndex !== currentIndex) {
    setWellbeingModule(wellbeingModules[nextIndex]);
  }
}

function bindWellbeingSwipeTarget(target) {
  target?.addEventListener("touchstart", (event) => {
    wellbeingSwipeStartX = event.touches[0]?.clientX || 0;
    wellbeingSwipeStartY = event.touches[0]?.clientY || 0;
  }, { passive: true });
  target?.addEventListener("touchend", (event) => {
    const touch = event.changedTouches[0];
    const deltaX = (touch?.clientX || wellbeingSwipeStartX) - wellbeingSwipeStartX;
    const deltaY = (touch?.clientY || wellbeingSwipeStartY) - wellbeingSwipeStartY;
    if (Math.abs(deltaY) > Math.abs(deltaX)) return;
    handleWellbeingSwipe(deltaX);
  });
}

function renderSymptoms() {
  if (!symptomList || !symptomEmpty) return;
  symptomList.textContent = "";
  symptomEmpty.hidden = symptomEntries.length > 0;
  symptomEntries.slice(0, 8).forEach((entry) => {
    const item = document.createElement("article");
    const text = document.createElement("div");
    const title = document.createElement("strong");
    const meta = document.createElement("span");
    const close = document.createElement("button");
    item.className = "symptom-item";
    item.dataset.level = entry.severity;
    title.textContent = entry.name;
    meta.textContent = [formatEntryDate(entry.date), entry.severity, entry.note].filter(Boolean).join(" / ");
    close.className = "delete-button";
    close.type = "button";
    close.setAttribute("aria-label", `Delete ${entry.name}`);
    close.textContent = "x";
    close.addEventListener("click", () => deleteSymptom(entry.id));
    text.append(title, meta);
    item.append(text, close);
    symptomList.appendChild(item);
  });
}

function renderSymptomHistory() {
  const historyEntries = getSymptomHistoryEntries();
  symptomHistoryRows.textContent = "";
  symptomHistoryEmpty.hidden = historyEntries.length > 0;

  historyEntries.forEach((entry) => {
    const row = document.createElement("tr");
    [formatSymptomHistoryDate(entry.date), entry.name, entry.severity, entry.note || "--"].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    });
    symptomHistoryRows.appendChild(row);
  });
}

function deleteSymptom(id) {
  symptomEntries = symptomEntries.filter((entry) => entry.id !== id);
  saveSymptomEntries();
  renderSymptoms();
  renderSymptomHistory();
}

function renderMoods() {
  if (!moodList || !moodEmpty) return;
  moodList.textContent = "";
  moodEmpty.hidden = moodEntries.length > 0;
  moodEntries.slice(0, 8).forEach((entry) => {
    const item = document.createElement("article");
    const text = document.createElement("div");
    const title = document.createElement("strong");
    const meta = document.createElement("span");
    const close = document.createElement("button");
    item.className = "symptom-item mood-item";
    item.dataset.level = entry.intensity;
    title.textContent = entry.name;
    meta.textContent = [formatEntryDate(entry.date), entry.intensity, entry.note].filter(Boolean).join(" / ");
    close.className = "delete-button";
    close.type = "button";
    close.setAttribute("aria-label", `Delete ${entry.name}`);
    close.textContent = "x";
    close.addEventListener("click", () => deleteMood(entry.id));
    text.append(title, meta);
    item.append(text, close);
    moodList.appendChild(item);
  });
}

function renderMoodHistory() {
  const historyEntries = getMoodHistoryEntries();
  moodHistoryRows.textContent = "";
  moodHistoryEmpty.hidden = historyEntries.length > 0;

  historyEntries.forEach((entry) => {
    const row = document.createElement("tr");
    [formatSymptomHistoryDate(entry.date), entry.name, entry.intensity, entry.note || "--"].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    });
    moodHistoryRows.appendChild(row);
  });
}

function deleteMood(id) {
  moodEntries = moodEntries.filter((entry) => entry.id !== id);
  saveMoodEntries();
  renderMoods();
  renderMoodHistory();
}

function renderJournal() {
  journalEntries = loadJournalEntries();
  updateJournalLogButton();
}

function updateJournalLogButton() {
  if (!journalLogLink) return;
  journalLogLink.textContent = `Journal Log (${journalEntries.length})`;
}

function openJournalLogList() {
  journalEntries = loadJournalEntries();
  const modal = document.createElement("section");
  const panel = document.createElement("div");
  const heading = document.createElement("div");
  const titleWrap = document.createElement("div");
  const title = document.createElement("h2");
  const actions = document.createElement("div");
  const deleteAllButton = document.createElement("button");
  const closeButton = document.createElement("button");
  const logControls = document.createElement("div");
  const list = document.createElement("div");

  modal.className = "history-modal journal-log-modal";
  modal.setAttribute("aria-labelledby", "journalLogDialogTitle");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("role", "dialog");
  panel.className = "history-panel journal-log-panel";
  heading.className = "section-heading";
  title.id = "journalLogDialogTitle";
  title.textContent = "Journal Log";
  actions.className = "journal-log-actions";
  deleteAllButton.className = "text-button danger-action journal-delete-all-button";
  deleteAllButton.type = "button";
  deleteAllButton.textContent = "Delete all";
  deleteAllButton.disabled = journalEntries.length === 0;
  closeButton.className = "delete-button";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Close journal log");
  closeButton.textContent = "x";
  logControls.className = "journal-log-controls";
  list.className = "symptom-list journal-log-list";

  buildJournalLogList(list, (entry, label) => openJournalEntryDialog(entry, label, modal));
  titleWrap.append(title);
  actions.append(closeButton);
  heading.append(titleWrap, actions);
  logControls.append(deleteAllButton);
  panel.append(heading, logControls, list);
  modal.appendChild(panel);
  document.body.appendChild(modal);

  const close = () => modal.remove();
  deleteAllButton.addEventListener("click", () => {
    if (!window.confirm("Are you sure you want to delete all journal entries? This cannot be undone.")) return;
    if (!window.confirm("Are you absolutely sure? This permanently deletes every journal entry.")) return;
    deleteAllJournalEntries();
    list.textContent = "";
    buildJournalLogList(list, (entry, label) => openJournalEntryDialog(entry, label, modal));
    deleteAllButton.disabled = true;
  });
  closeButton.addEventListener("click", close);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });
  window.addEventListener("keydown", function onKeydown(event) {
    if (event.key !== "Escape") return;
    close();
    window.removeEventListener("keydown", onKeydown);
  });
  window.setTimeout(() => {
    const firstEntry = list.querySelector(".journal-item:not(.journal-empty-log)");
    (firstEntry || closeButton).focus({ preventScroll: true });
  }, 30);
}

function buildJournalLogList(container, onEntryClick) {
  const groupedEntries = journalEntries.reduce((groups, entry) => {
    if (!groups.has(entry.date)) groups.set(entry.date, []);
    groups.get(entry.date).push(entry);
    return groups;
  }, new Map());
  const dateKeys = [...new Set(journalEntries.map((entry) => entry.date))]
    .sort((first, second) => second.localeCompare(first));

  dateKeys.forEach((dateKey) => {
    const entries = groupedEntries.get(dateKey) || [];
    if (!entries.length) return;
    const group = document.createElement("section");
    const heading = document.createElement("h3");
    const dateLabel = formatEntryDate(dateKey);
    group.className = "journal-date-group";
    heading.className = "journal-date-heading";
    heading.textContent = `${dateLabel} - ${entries.length} entr${entries.length === 1 ? "y" : "ies"}`;
    group.appendChild(heading);
    entries.forEach((entry, index) => {
      const item = document.createElement("button");
      const text = document.createElement("span");
      const title = document.createElement("strong");
      const meta = document.createElement("span");
      const label = getJournalEntryPreview(entry, index);
      item.className = "symptom-item journal-item";
      item.type = "button";
      item.setAttribute("aria-label", `${label}, ${dateLabel}`);
      title.textContent = label;
      meta.textContent = dateLabel;
      item.addEventListener("click", () => onEntryClick(entry, label));
      text.append(title, meta);
      item.appendChild(text);
      group.appendChild(item);
    });
    container.appendChild(group);
  });
  if (!container.children.length) {
    const emptyItem = document.createElement("div");
    emptyItem.className = "nutrition-empty";
    emptyItem.textContent = "No journal entries logged.";
    container.appendChild(emptyItem);
  }
}

function getJournalEntryPreview(entry, index) {
  const preview = String(entry.text || "").replace(/\s+/g, " ").trim();
  if (preview) return preview.length > 72 ? `${preview.slice(0, 72)}...` : preview;
  return `Journal entry ${index + 1}`;
}

function buildJournalEmptyLogItem(dateKey) {
  const emptyItem = document.createElement("div");
  const text = document.createElement("span");
  const title = document.createElement("strong");
  const meta = document.createElement("span");
  emptyItem.className = "symptom-item journal-item journal-empty-log";
  title.textContent = "No entry logged";
  meta.textContent = formatEntryDate(dateKey);
  text.append(title, meta);
  emptyItem.appendChild(text);
  return emptyItem;
}

function openJournalEntryDialog(entry, label, returnModal = null) {
  if (returnModal) returnModal.hidden = true;
  const modal = document.createElement("section");
  const panel = document.createElement("div");
  const heading = document.createElement("div");
  const titleWrap = document.createElement("div");
  const eyebrow = document.createElement("p");
  const title = document.createElement("h2");
  const actions = document.createElement("div");
  const backButton = document.createElement("button");
  const deleteButton = document.createElement("button");
  const closeButton = document.createElement("button");
  const body = document.createElement("p");

  modal.className = "history-modal journal-entry-modal";
  modal.setAttribute("aria-labelledby", "journalEntryTitle");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("role", "dialog");
  panel.className = "history-panel journal-entry-panel";
  heading.className = "section-heading";
  eyebrow.className = "eyebrow";
  eyebrow.textContent = label;
  title.id = "journalEntryTitle";
  title.textContent = formatEntryDate(entry.date);
  actions.className = "journal-entry-actions";
  backButton.className = "text-button journal-back-button";
  backButton.type = "button";
  backButton.textContent = "Back";
  backButton.hidden = !returnModal;
  deleteButton.className = "text-button journal-delete-button danger-action";
  deleteButton.type = "button";
  deleteButton.textContent = "Delete";
  closeButton.className = "delete-button";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Close journal entry");
  closeButton.textContent = "x";
  body.className = "journal-entry-text";
  body.textContent = entry.text;

  actions.append(backButton, deleteButton, closeButton);
  titleWrap.append(eyebrow, title);
  heading.append(titleWrap, actions);
  panel.append(heading, body);
  modal.appendChild(panel);
  document.body.appendChild(modal);

  const close = () => {
    modal.remove();
    if (returnModal) returnModal.hidden = false;
  };
  backButton.addEventListener("click", close);
  deleteButton.addEventListener("click", () => {
    if (!window.confirm("Are you sure you want to delete this journal entry? This cannot be undone.")) return;
    deleteJournalEntry(entry.id);
    modal.remove();
    if (returnModal) {
      returnModal.remove();
      openJournalLogList();
    }
  });
  closeButton.addEventListener("click", close);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });
  window.addEventListener("keydown", function onKeydown(event) {
    if (event.key !== "Escape") return;
    close();
    window.removeEventListener("keydown", onKeydown);
  });
}

function deleteJournalEntry(id) {
  const entry = journalEntries.find((item) => item.id === id);
  if (entry?.date && entry?.text) {
    const deletedKeys = loadDeletedJournalEntryKeys();
    deletedKeys.add(`${entry.date}:${entry.text}`);
    saveDeletedJournalEntryKeys(deletedKeys);
  }
  journalEntries = journalEntries.filter((entry) => entry.id !== id);
  saveJournalEntries();
  renderJournal();
  scheduleSmartCoachRender();
  showToast("Journal entry deleted.");
}

function deleteAllJournalEntries() {
  const deletedKeys = loadDeletedJournalEntryKeys();
  journalEntries.forEach((entry) => {
    if (entry?.date && entry?.text) deletedKeys.add(`${entry.date}:${entry.text}`);
  });
  saveDeletedJournalEntryKeys(deletedKeys);
  journalEntries = [];
  localStorage.setItem(journalStoreKey, JSON.stringify([]));
  ["habit-tracker:journal:v1", "habit-tracker:journal", "journalEntries"].forEach((key) => {
    localStorage.removeItem(key);
  });
  renderJournal();
  scheduleSmartCoachRender();
  showToast("All journal entries deleted.");
}

function editHabit(id) {
  const habit = habits.find((item) => item.id === id);
  if (!habit) return;
  editingHabitId = id;
  habitName.value = habit.name;
  if (taskDate) taskDate.value = getTaskDateKey(habit);
  habitCategory.value = habit.category || "Health";
  habitDeadline.value = normalizeTaskTime(habit.deadline);
  habitPriority.value = habit.priority || "Normal";
  habitNote.value = habit.note || "";
  habitForm.querySelector(".primary-button").textContent = "Save";
  habitName.focus();
}

function openDayTaskDialog(dayName, dateKey) {
  const dayTasks = habits.filter((habit) => isTaskScheduledForDate(habit, dateKey));
  const modal = document.createElement("section");
  const panel = document.createElement("div");
  const heading = document.createElement("div");
  const titleWrap = document.createElement("div");
  const actions = document.createElement("div");
  const label = document.createElement("p");
  const title = document.createElement("h2");
  const printButton = document.createElement("button");
  const closeButton = document.createElement("button");
  const list = document.createElement("div");
  const footer = document.createElement("div");

  modal.className = "history-modal task-dialog";
  modal.setAttribute("aria-labelledby", "taskDialogTitle");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("role", "dialog");
  panel.className = "history-panel task-dialog-panel";
  heading.className = "section-heading";
  label.className = "eyebrow";
  label.textContent = "To-do list";
  title.id = "taskDialogTitle";
  title.textContent = dayName;
  actions.className = "task-dialog-actions";
  printButton.className = "text-button task-dialog-print";
  printButton.type = "button";
  printButton.textContent = "Print";
  closeButton.className = "delete-button";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Close to-do list");
  closeButton.textContent = "x";
  list.className = "task-dialog-list";
  footer.className = "task-dialog-footer";

  titleWrap.append(label, title);
  actions.append(closeButton);
  heading.append(titleWrap, actions);
  footer.appendChild(printButton);

  if (dayTasks.length === 0) {
    const empty = document.createElement("p");
    empty.className = "day-empty";
    empty.textContent = "No tasks for this day yet.";
    list.appendChild(empty);
  } else {
    dayTasks.forEach((task) => {
      const item = document.createElement("article");
      const itemText = document.createElement("div");
      const itemTitle = document.createElement("h3");
      const meta = document.createElement("p");
      const toggle = document.createElement("button");
      const done = task.completions.includes(dateKey);

      item.className = "task-dialog-item";
      item.classList.toggle("done", done);
      itemTitle.textContent = task.name;
      meta.textContent = [task.category || "General", task.priority || "Normal"].join(" / ");
      toggle.className = "text-button task-dialog-toggle";
      toggle.type = "button";
      toggle.textContent = done ? "Done" : "Mark done";
      toggle.addEventListener("click", () => {
        modal.remove();
        toggleHabit(task.id, dateKey);
      });

      itemText.append(itemTitle, meta);
      item.append(itemText, toggle);
      list.appendChild(item);
    });
  }

  const close = () => modal.remove();
  printButton.addEventListener("click", () => printTaskDialog(dayName, dateKey, dayTasks));
  closeButton.addEventListener("click", close);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });

  panel.append(heading, list, footer);
  modal.appendChild(panel);
  document.body.appendChild(modal);
  closeButton.focus();
}

function showDailyAffirmation() {
  if (!appUnlocked) return;
  const lastShownDate = localStorage.getItem(affirmationShownStoreKey);
  const depressionOverride = shouldShowDepressionAffirmation();
  if (lastShownDate === today && !depressionOverride) return;
  const index = getAffirmationIndex(today);
  affirmationText.textContent = dailyAffirmations[index];
  affirmationModal.hidden = false;
  affirmationModal.focus();
  localStorage.setItem(affirmationShownStoreKey, today);
  if (depressionOverride) {
    localStorage.setItem(affirmationDepressionShownStoreKey, new Date().toISOString());
  }
}

function closeAffirmationModal() {
  affirmationModal.hidden = true;
}

function shouldShowDepressionAffirmation() {
  if (!hasRecentDepressionSignal()) return false;
  const lastShownAt = new Date(localStorage.getItem(affirmationDepressionShownStoreKey) || 0).getTime();
  return !Number.isFinite(lastShownAt) || Date.now() - lastShownAt >= 4 * 60 * 60 * 1000;
}

function hasRecentDepressionSignal() {
  const recentCutoff = getRecentCutoffKey(7);
  const recentMoodNotes = moodEntries
    .filter((entry) => entry.date >= recentCutoff)
    .map((entry) => `${entry.name || ""} ${entry.note || ""}`);
  const recentJournal = journalEntries
    .filter((entry) => entry.date >= recentCutoff)
    .map((entry) => entry.text || "");
  return [...recentMoodNotes, ...recentJournal].some((text) => matchesAnyPattern(text, depressionMoodPatterns));
}

function getAffirmationIndex(dateKey) {
  const dayNumber = Math.floor(parseDateKey(dateKey).getTime() / 86400000);
  return dayNumber % dailyAffirmations.length;
}

function getGoogleCalendarUrl(habit) {
  const start = getCalendarStart(habit.time || "Anytime");
  const taskDate = parseDateKey(getTaskDateKey(habit));
  start.setFullYear(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const details = [
    habit.note,
    `Date: ${formatSymptomHistoryDate(getTaskDateKey(habit))}`,
    `Category: ${habit.category || "General"}`,
    `Priority: ${habit.priority || "Normal"}`,
    "Created from Health & Task Tracker."
  ].filter(Boolean).join("\n");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Task: ${habit.name}`,
    details,
    dates: `${toCalendarDateTime(start)}/${toCalendarDateTime(end)}`
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

async function copyText(value) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Use the textarea fallback below when clipboard permissions are blocked.
    }
  }

  const field = document.createElement("textarea");
  field.value = value;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();
  const copied = document.execCommand("copy");
  field.remove();
  return copied;
}

function printTaskDialog(dayName, dateKey, dayTasks) {
  const html = getTaskPrintHtml(dayName, dateKey, dayTasks);
  if (window.HealthTaskPrint && typeof window.HealthTaskPrint.printHtml === "function") {
    window.HealthTaskPrint.printHtml(html, `${dayName} To-do list`);
    return;
  }

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.setTimeout(() => {
      printWindow.print();
    }, 250);
    return;
  }

  window.print();
}

function getTaskPrintHtml(dayName, dateKey, dayTasks) {
  const rows = dayTasks.length
    ? dayTasks.map((task) => {
      const done = task.completions.includes(dateKey);
      const meta = [
        task.category || "General",
        formatTaskDeadline(task.deadline),
        task.priority || "Normal"
      ].filter(Boolean).join(" / ");
      return `<li><span>${escapeHtml(task.name)}</span><small>${escapeHtml(meta)}</small><strong>${done ? "Done" : "Open"}</strong></li>`;
    }).join("")
    : "<li><span>No tasks for this day yet.</span></li>";

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(dayName)} To-do list</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111827; margin: 24px; }
    h1 { margin: 0 0 6px; font-size: 24px; }
    p { margin: 0 0 20px; color: #4b5563; }
    ul { list-style: none; margin: 0; padding: 0; }
    li { display: grid; grid-template-columns: 1fr auto; gap: 4px 16px; padding: 12px 0; border-bottom: 1px solid #d1d5db; }
    span { font-weight: 700; }
    small { color: #4b5563; }
    strong { grid-row: 1 / span 2; grid-column: 2; align-self: center; }
  </style>
</head>
<body>
  <h1>${escapeHtml(dayName)} To-do list</h1>
  <p>${escapeHtml(dateKey)}</p>
  <ul>${rows}</ul>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getCalendarStart(time) {
  const start = new Date();
  const clockTime = normalizeTaskTime(time);
  if (clockTime) {
    const [hours, minutes] = clockTime.split(":").map(Number);
    start.setHours(hours, minutes, 0, 0);
    return start;
  }

  const hourByTime = {
    Morning: 8,
    Afternoon: 13,
    Evening: 18,
    Night: 21,
    Anytime: 9
  };
  start.setHours(hourByTime[time] || 9, 0, 0, 0);
  return start;
}

function toCalendarDateTime(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}T${hours}${minutes}${seconds}`;
}

function isClockTime(value) {
  return /^\d{2}:\d{2}$/.test(String(value || ""));
}

function normalizeTaskTime(value) {
  const time = String(value || "").trim();
  if (isClockTime(time)) return time;
  const legacyTimes = {
    Morning: "08:00",
    Afternoon: "13:00",
    Evening: "18:00",
    Night: "21:00",
    Anytime: ""
  };
  return legacyTimes[time] || "";
}

function formatTaskDeadline(value) {
  const time = formatTaskTime(value);
  return time ? `Due ${time}` : "";
}

function formatTaskTime(value) {
  const time = normalizeTaskTime(value);
  if (!time) return "";
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function getTaskDay(habit) {
  return weekDays[parseDateKey(getTaskDateKey(habit)).getDay()];
}

function normalizeTaskDate(value) {
  const text = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function getTaskDateKey(habit) {
  if (normalizeTaskDate(habit?.date)) return habit.date;
  if (weekDays.includes(habit?.day)) return getWeekdayDateKey(weekDays.indexOf(habit.day));
  return today;
}

function isTaskScheduledForDate(habit, dateKey) {
  return getTaskDateKey(habit) === dateKey;
}

function getWeekdayDateKey(dayIndex, referenceDate = new Date()) {
  const date = new Date(referenceDate);
  const offset = dayIndex - date.getDay();
  date.setDate(date.getDate() + offset);
  return toDateKey(date);
}

function getRecentCutoffKey(days) {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - days + 1);
  return toDateKey(cutoff);
}

function getDayCompletionPercent(dayHabits, dateKey) {
  if (!dayHabits.length) return 0;
  const complete = dayHabits.filter((habit) => habit.completions.includes(dateKey)).length;
  return Math.round((complete / dayHabits.length) * 100);
}

function getTaskStreak(habit, dateKey) {
  const completions = new Set(habit.completions);
  let streak = 0;
  const cursor = new Date(`${dateKey}T00:00:00`);

  while (completions.has(toDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 7);
  }

  return streak;
}

function toggleHabit(id, dateKey) {
  habits = habits.map((habit) => {
    if (habit.id !== id) return habit;
    const completions = habit.completions.includes(dateKey)
      ? habit.completions.filter((date) => date !== dateKey)
      : [...habit.completions, dateKey];
    return { ...habit, completions };
  });

  saveHabits();
  render();
}

function deleteHabit(id) {
  habits = habits.filter((habit) => habit.id !== id);
  saveHabits();
  render();
}

function getStreak(habit) {
  const completions = new Set(habit.completions);
  let streak = 0;
  const cursor = new Date();

  while (completions.has(toDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function getRecentDays(count = 7) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (count - 1 - index));
    return {
      key: toDateKey(date),
      label: new Intl.DateTimeFormat(undefined, { weekday: "narrow" }).format(date)
    };
  });
}

function renderGraph() {
  const { totalTasks, totalComplete, average } = getWeeklyTotals();

  graphAverage.textContent = `${average}%`;
  renderWeeklyTaskPercentBar(totalComplete, totalTasks, average);
}

function renderWeeklyTaskPercentBar(totalComplete, totalTasks, average) {
  if (!weeklyTaskPercentBar || !weeklyTaskPercentFill) return;
  const clampedAverage = Math.max(0, Math.min(100, average));
  weeklyTaskPercentFill.style.width = `${clampedAverage}%`;
  weeklyTaskPercentFill.textContent = `${average}%`;
  if (weeklyTaskPercentMeta) {
    weeklyTaskPercentMeta.textContent = `${totalComplete} of ${totalTasks} tasks completed`;
  }
  weeklyTaskPercentBar.setAttribute(
    "aria-label",
    totalTasks
      ? `Weekly task progress ${average}%, ${totalComplete} of ${totalTasks} tasks completed`
      : "Weekly task progress 0%, no weekly tasks scheduled"
  );
}

function getWeekStats() {
  return weekDays.map((dayName, index) => {
    const dateKey = getWeekdayDateKey(index);
    const dayHabits = habits.filter((habit) => isTaskScheduledForDate(habit, dateKey));
    const complete = dayHabits.filter((habit) => habit.completions.includes(dateKey)).length;
    const percent = dayHabits.length ? Math.round((complete / dayHabits.length) * 100) : 0;
    return {
      dayName,
      dayIndex: index,
      dateKey,
      complete,
      total: dayHabits.length,
      percent
    };
  });
}

function getCurrentWeekDateKeys() {
  return new Set(weekDays.map((_, index) => getWeekdayDateKey(index)));
}

function getCompletionDateKey(value) {
  const text = String(value || "").trim();
  const match = text.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : "";
}

function getWeeklyCompletionTotals() {
  const weekDateKeys = getCurrentWeekDateKeys();
  const weeklyTasks = habits.filter((habit) => weekDateKeys.has(getTaskDateKey(habit)));
  const totalTasks = weeklyTasks.length;
  const totalComplete = weeklyTasks.filter((habit) => (habit.completions || []).some((dateKey) => getCompletionDateKey(dateKey) === getTaskDateKey(habit))).length;
  const average = totalTasks ? Math.round((totalComplete / totalTasks) * 100) : 0;
  return { totalTasks, totalComplete, average };
}

function smoothPath(points) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].replace(",", " ")}`;

  const coordinates = points.map((point) => {
    const [x, y] = point.split(",").map(Number);
    return { x, y };
  });
  let path = `M ${coordinates[0].x.toFixed(1)} ${coordinates[0].y.toFixed(1)}`;

  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const current = coordinates[index];
    const next = coordinates[index + 1];
    const previous = coordinates[index - 1] || current;
    const after = coordinates[index + 2] || next;
    const control1X = current.x + (next.x - previous.x) / 6;
    const control1Y = current.y + (next.y - previous.y) / 6;
    const control2X = next.x - (after.x - current.x) / 6;
    const control2Y = next.y - (after.y - current.y) / 6;
    path += ` C ${control1X.toFixed(1)} ${control1Y.toFixed(1)}, ${control2X.toFixed(1)} ${control2Y.toFixed(1)}, ${next.x.toFixed(1)} ${next.y.toFixed(1)}`;
  }

  return path;
}

function buildAreaPath(points, width, height, padding) {
  if (!points.length) return "";
  const linePath = smoothPath(points);
  return `${linePath} L ${width - padding} ${height - padding} L ${padding} ${height - padding} Z`;
}

function getLinePoints(movement, step, padding, graphHeight, height, getValue, min, max) {
  const range = max - min || 1;
  return movement.map((day, index) => {
    const rawValue = getValue(day);
    const normalized = Number.isFinite(rawValue) ? (rawValue - min) / range : 0;
    const x = padding + index * step;
    const y = padding + graphHeight - normalized * graphHeight;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
}

function createTableRow(cells) {
  const row = document.createElement("tr");
  cells.forEach((value) => {
    const cell = document.createElement("td");
    cell.textContent = value;
    row.appendChild(cell);
  });
  return row;
}

function getLast24NutritionEntries() {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return [...nutritionEntries]
    .map((entry) => ({ ...entry, dateTime: getEntryDateTime(entry, 12) }))
    .filter((entry) => entry.dateTime.getTime() >= cutoff)
    .sort((first, second) => second.dateTime - first.dateTime);
}

function renderNutrition() {
  const last24Entries = getLast24NutritionEntries();
  const calorieValues = last24Entries.map((entry) => entry.calories).filter(Number.isFinite);
  const carbValues = last24Entries.map((entry) => entry.carbs).filter(Number.isFinite);
  const waterValues = last24Entries.map((entry) => entry.water).filter(Number.isFinite);
  const latestWeightEntry = last24Entries.find((entry) => Number.isFinite(entry.weight));
  const latestKetosisEntry = last24Entries.find((entry) => entry.ketosisPhase);
  const latestGlucoseEntry = last24Entries.find((entry) => Number.isFinite(entry.glucose));
  const latestBloodPressureEntry = last24Entries.find(
    (entry) => Number.isFinite(entry.systolic) && Number.isFinite(entry.diastolic)
  );

  avgCalories.textContent = calorieValues.length ? formatWholeNumber(getSum(calorieValues)) : "0";
  avgCarbs.textContent = carbValues.length ? `${formatWholeNumber(getSum(carbValues))}g` : "0g";
  latestWeight.textContent = latestWeightEntry ? `${formatDecimal(latestWeightEntry.weight)} lb` : "--";
  latestKetosis.textContent = latestKetosisEntry ? formatKetosisPhase(latestKetosisEntry.ketosisPhase) : "--";
  latestGlucose.textContent = latestGlucoseEntry ? `${formatWholeNumber(latestGlucoseEntry.glucose)} mg/dL` : "--";
  latestBloodPressure.textContent = latestBloodPressureEntry
    ? formatBloodPressure(latestBloodPressureEntry.systolic, latestBloodPressureEntry.diastolic, true)
    : "--";
  latestWater.textContent = waterValues.length ? `${formatWholeNumber(getSum(waterValues))} oz` : "0 oz";
  if (nutritionRows && nutritionEmpty) {
    nutritionRows.textContent = "";
    nutritionEmpty.hidden = last24Entries.length > 0;
    const fragment = document.createDocumentFragment();

    last24Entries.forEach((entry, index) => {
      const previousWeight = findPreviousWeight(last24Entries, index);
      const delta = Number.isFinite(entry.weight) && Number.isFinite(previousWeight)
        ? entry.weight - previousWeight
        : null;
      fragment.appendChild(createTableRow([
        formatEntryDateTime(entry.dateTime),
        Number.isFinite(entry.calories) ? formatWholeNumber(entry.calories) : "--",
        Number.isFinite(entry.carbs) ? `${formatWholeNumber(entry.carbs)}g` : "--",
        Number.isFinite(entry.weight) ? `${formatDecimal(entry.weight)} lb` : "--",
        formatKetosisPhase(entry.ketosisPhase),
        Number.isFinite(entry.glucose) ? `${formatWholeNumber(entry.glucose)} mg/dL` : "--",
        formatBloodPressure(entry.systolic, entry.diastolic),
        Number.isFinite(entry.water) ? `${formatWholeNumber(entry.water)} oz` : "--",
        formatWeightDelta(delta)
      ]));
    });
    nutritionRows.appendChild(fragment);
  }

  if (!historyModal.hidden || vitalsHistoryDropdown?.open) {
    renderHistory();
  }
}

function renderHistory() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (HISTORY_RETENTION_DAYS - 1));
  const historyEntries = nutritionEntries
    .filter((entry) => new Date(`${entry.date}T00:00:00`) >= start)
    .filter((entry) => (
      Number.isFinite(entry.weight) ||
      Number.isFinite(entry.calories) ||
      Number.isFinite(entry.carbs) ||
      entry.ketosisPhase ||
      Number.isFinite(entry.glucose) ||
      Number.isFinite(entry.systolic) ||
      Number.isFinite(entry.diastolic) ||
      Number.isFinite(entry.water)
    ))
    .sort((first, second) => second.date.localeCompare(first.date));

  if (historyRows) historyRows.textContent = "";
  if (historyEmpty) historyEmpty.hidden = historyEntries.length > 0;
  updateHistoryLegendButtons();
  renderHistoryChart(historyEntries);
  if (!historyRows) return;
  const fragment = document.createDocumentFragment();

  historyEntries.forEach((entry, index) => {
    const previousWeight = findPreviousWeight(historyEntries, index);
    const delta = Number.isFinite(entry.weight) && Number.isFinite(previousWeight)
      ? entry.weight - previousWeight
      : null;
    const row = createTableRow([
      formatEntryDate(entry.date),
      Number.isFinite(entry.calories) ? formatWholeNumber(entry.calories) : "--",
      Number.isFinite(entry.carbs) ? `${formatWholeNumber(entry.carbs)}g` : "--",
      Number.isFinite(entry.weight) ? `${formatDecimal(entry.weight)} lb` : "--",
      formatKetosisPhase(entry.ketosisPhase),
      Number.isFinite(entry.glucose) ? `${formatWholeNumber(entry.glucose)} mg/dL` : "--",
      formatBloodPressure(entry.systolic, entry.diastolic),
      Number.isFinite(entry.water) ? `${formatWholeNumber(entry.water)} oz` : "--",
      formatWeightDelta(delta)
    ]);
    row.dataset.historyDate = entry.date;
    if (entry.date === historyFocusDateKey) row.classList.add("history-row-focused");
    fragment.appendChild(row);
  });
  historyRows.appendChild(fragment);
}

function openMasterChart() {
  renderMasterChart();
  masterChartModal.hidden = false;
}

function renderMasterChart() {
  const rows = getMasterChartRows();
  masterChartRows.textContent = "";
  masterChartEmpty.hidden = rows.length > 0;
  masterChartRangeButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String((Number(button.dataset.masterChartDays) || HISTORY_RETENTION_DAYS) === masterChartRangeDays));
  });
  const fragment = document.createDocumentFragment();

  rows.forEach((entry) => {
    const row = createTableRow([
      formatEntryDateTime(entry.dateTime),
      Number.isFinite(entry.calories) ? formatWholeNumber(entry.calories) : "--",
      Number.isFinite(entry.carbs) ? `${formatWholeNumber(entry.carbs)}g` : "--",
      Number.isFinite(entry.weight) ? `${formatDecimal(entry.weight)} lb` : "--",
      formatKetosisPhase(entry.ketosisPhase),
      Number.isFinite(entry.glucose) ? `${formatWholeNumber(entry.glucose)} mg/dL` : "--",
      formatBloodPressure(entry.systolic, entry.diastolic),
      Number.isFinite(entry.water) ? `${formatWholeNumber(entry.water)} oz` : "--",
      entry.symptom || "--",
      entry.severity || "--",
      entry.mood || "--",
      entry.intensity || "--"
    ]);
    row.dataset.weekday = String(entry.dateTime.getDay());
    fragment.appendChild(row);
  });
  masterChartRows.appendChild(fragment);
}

function getMasterChartRows() {
  const cutoff = getRecentCutoffKey(masterChartRangeDays);
  const nutritionRows = nutritionEntries
    .filter((entry) => entry.date >= cutoff)
    .map((entry) => ({ ...entry, dateTime: getEntryDateTime(entry, 12) }));
  const symptomRows = symptomEntries
    .filter((entry) => entry.date >= cutoff)
    .map((entry) => ({
      date: entry.date,
      dateTime: getEntryDateTime(entry, 15),
      symptom: entry.name,
      severity: entry.severity
    }));
  const moodRows = moodEntries
    .filter((entry) => entry.date >= cutoff)
    .map((entry) => ({
      date: entry.date,
      dateTime: getEntryDateTime(entry, 18),
      mood: entry.name,
      intensity: entry.intensity
    }));

  return [...nutritionRows, ...symptomRows, ...moodRows]
    .sort((first, second) => second.dateTime - first.dateTime);
}

function mountVitalsHistoryChart() {
  if (!vitalsHistoryMount) {
    return;
  }

  const chartWrap = document.querySelector("#historyModal .history-chart-wrap");
  const tableWrap = document.querySelector("#historyModal .history-table-wrap");

  if (chartWrap && !vitalsHistoryMount.contains(chartWrap)) {
    vitalsHistoryMount.appendChild(chartWrap);
  }

  if (tableWrap && !vitalsHistoryMount.contains(tableWrap)) {
    vitalsHistoryMount.appendChild(tableWrap);
  }

  syncHistoryControls();
  renderHistory();
}

function renderHistoryChart(historyEntries) {
  const focusDate = parseDateKey(historyFocusDateKey);
  const todayEnd = parseDateKey(today);
  todayEnd.setHours(23, 59, 59, 999);
  const chartEnd = focusDate > todayEnd ? todayEnd : focusDate;
  chartEnd.setHours(23, 59, 59, 999);
  const chartStart = new Date(chartEnd);
  chartStart.setDate(chartStart.getDate() - Math.max(historyZoomDays - 1, 0));
  chartStart.setHours(0, 0, 0, 0);
  const chartItems = getHistoryChartItems(historyEntries)
    .filter((item) => item.dateTime >= chartStart && item.dateTime <= chartEnd)
    .sort((first, second) => first.dateTime - second.dateTime);
  const enabledKeys = getEnabledHistoryKeys();
  const hasChartData = chartItems.some((item) => (
    enabledKeys.some((key) => Number.isFinite(item[key]))
  ));

  historyChartEmpty.hidden = hasChartData;
  historyGrid.textContent = "";
  [0, 25, 50, 75, 100].forEach((value) => {
    const y = 20 + (1 - value / 100) * 170;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", "40");
    line.setAttribute("x2", "616");
    line.setAttribute("y1", y.toFixed(1));
    line.setAttribute("y2", y.toFixed(1));
    historyGrid.appendChild(line);
  });

  renderHistoryAxis(chartStart, chartEnd);
  renderHistoryPoints(chartItems, chartStart, chartEnd, enabledKeys);
  updateHistoryZoomLabel();
  setHistoryLine(historyWeightLine, chartItems, "weight", chartStart, chartEnd, enabledKeys);
  setHistoryLine(historyCaloriesLine, chartItems, "calories", chartStart, chartEnd, enabledKeys);
  setHistoryLine(historyCarbsLine, chartItems, "carbs", chartStart, chartEnd, enabledKeys);
  setHistoryLine(historyGlucoseLine, chartItems, "glucose", chartStart, chartEnd, enabledKeys);
  setHistoryLine(historyPressureLine, chartItems, "pressure", chartStart, chartEnd, enabledKeys);
  setHistoryLine(historyWaterLine, chartItems, "water", chartStart, chartEnd, enabledKeys);
}

function getHistoryChartItems(historyEntries) {
  return historyEntries.map((entry) => ({
    date: entry.date,
    dateTime: getEntryDateTime(entry, 12),
    weight: entry.weight,
    calories: entry.calories,
    carbs: entry.carbs,
    glucose: entry.glucose,
    systolic: entry.systolic,
    diastolic: entry.diastolic,
    pressure: Number.isFinite(entry.systolic) ? entry.systolic : entry.diastolic,
    water: entry.water
  }));
}

function setHistoryLine(line, items, key, startDate, endDate, enabledKeys) {
  if (!line) return;
  line.setAttribute("d", enabledKeys.includes(key) ? getHistoryPath(items, key, startDate, endDate) : "");
}

function renderHistoryAxis(startDate, endDate) {
  getHistoryAxisTicks(startDate, endDate).forEach((tick) => {
    const x = getHistoryX(tick.date, startDate, endDate);
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "line");
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    marker.setAttribute("x1", x.toFixed(1));
    marker.setAttribute("x2", x.toFixed(1));
    marker.setAttribute("y1", "190");
    marker.setAttribute("y2", "198");
    label.setAttribute("x", x.toFixed(1));
    label.setAttribute("y", "218");
    label.setAttribute("text-anchor", tick.anchor || "middle");
    label.textContent = tick.label;
    historyGrid.append(marker, label);
  });
}

function getHistoryAxisTicks(startDate, endDate) {
  const visibleDays = Math.max(Math.ceil((endDate - startDate) / 86400000), 1);
  if (visibleDays <= 2) {
    const ticks = [];
    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      ticks.push({ date: new Date(cursor), label: formatHistoryAxisDateTime(cursor) });
      cursor.setHours(cursor.getHours() + 6);
    }
    ticks.push({ date: new Date(endDate), label: formatHistoryAxisDateTime(endDate), anchor: "end" });
    return ticks;
  }
  if (visibleDays <= 45) {
    const step = visibleDays <= 8 ? 1 : 7;
    const ticks = [];
    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      ticks.push({ date: new Date(cursor), label: formatHistoryAxisDate(cursor) });
      cursor.setDate(cursor.getDate() + step);
    }
    if (ticks.length === 0 || toDateKey(ticks[ticks.length - 1].date) !== toDateKey(endDate)) {
      ticks.push({ date: new Date(endDate), label: formatHistoryAxisDate(endDate), anchor: "end" });
    }
    return ticks;
  }

  const ticks = [];
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  if (cursor < startDate) {
    cursor.setMonth(cursor.getMonth() + 1);
  }
  while (cursor <= endDate) {
    ticks.push({ date: new Date(cursor), label: new Intl.DateTimeFormat(undefined, { month: "short" }).format(cursor) });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  if (!ticks.length) {
    ticks.push({ date: new Date(startDate), label: formatHistoryAxisDate(startDate) });
  }
  return ticks;
}

function formatHistoryAxisDate(date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric"
  }).format(date);
}

function formatHistoryAxisDateTime(date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function formatClockTime(date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function formatEntryDateTime(date) {
  const datePart = new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "2-digit"
  }).format(date);
  const timePart = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
  return `${datePart} ${timePart}`;
}

function updateHistoryZoomLabel() {
  if (historyZoomLabel) {
    historyZoomLabel.textContent = historyZoomDays >= HISTORY_RETENTION_DAYS
      ? "10 years"
      : historyZoomDays === 365
        ? "1 year"
        : historyZoomDays === 1
          ? "1 day"
          : `${historyZoomDays} days`;
  }
}

function syncHistoryControls() {
  historyFocusDateKey = historyFocusDate.value || historyFocusDateKey || today;
  historyZoomDays = Number(historyZoomRange.value) || historyZoomDays || HISTORY_RETENTION_DAYS;
  historyFocusDate.value = historyFocusDateKey;
  historyFocusDate.max = today;
  historyZoomRange.value = String(historyZoomDays);
  updateHistoryZoomLabel();
}

function getHistoryPath(items, key, startDate, endDate) {
  const values = items.map((item) => item[key]).filter(Number.isFinite);
  if (!values.length) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const usableItems = items.map((item) => ({ value: item[key], date: item.dateTime || parseDateKey(item.date) })).filter((item) => Number.isFinite(item.value));

  return usableItems.map((item, pathIndex) => {
    const x = getHistoryX(item.date, startDate, endDate);
    const y = 20 + (1 - (item.value - min) / range) * 170;
    return `${pathIndex === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
}

function renderHistoryPoints(items, startDate, endDate, enabledKeys) {
  const fragment = document.createDocumentFragment();
  enabledKeys.forEach((key) => {
    const values = items.map((item) => item[key]).filter(Number.isFinite);
    if (!values.length) return;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    items.forEach((item) => {
      if (!Number.isFinite(item[key])) return;
      const point = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      const itemDateKey = item.date || toDateKey(item.dateTime || new Date());
      point.setAttribute("class", `history-point history-${key}-point${itemDateKey === historyFocusDateKey ? " is-selected" : ""}`);
      point.setAttribute("cx", getHistoryX(item.dateTime || parseDateKey(item.date), startDate, endDate).toFixed(1));
      point.setAttribute("cy", (20 + (1 - (item[key] - min) / range) * 170).toFixed(1));
      point.setAttribute("r", "4");
      point.setAttribute("role", "link");
      point.setAttribute("tabindex", "0");
      point.setAttribute("aria-label", getHistoryPointLabel(item, key));
      point.addEventListener("click", () => selectHistoryPoint(item, key));
      point.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectHistoryPoint(item, key);
        }
      });
      fragment.appendChild(point);
    });
  });
  historyGrid.appendChild(fragment);
}

function selectHistoryPoint(item, key) {
  const dateKey = item.date || toDateKey(item.dateTime || new Date());
  historyFocusDateKey = dateKey;
  historyFocusDate.value = dateKey;
  const filterValue = getHistoryFilterForKey(key);
  if (filterValue && historyMetricFilter) historyMetricFilter.value = filterValue;
  renderHistory();
  window.requestAnimationFrame(() => {
    if (!historyRows) return;
    const row = Array.from(historyRows.querySelectorAll("[data-history-date]"))
      .find((item) => item.dataset.historyDate === dateKey);
    row?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  });
}

function getHistoryFilterForKey(key) {
  if (["calories", "carbs", "weight", "glucose", "pressure", "water"].includes(key)) return key;
  if (key === "water") return "water";
  return "all";
}

function getHistoryPointLabel(item, key) {
  const labels = {
    weight: "Weight",
    calories: "Calories",
    carbs: "Carbs",
    glucose: "Glucose",
    pressure: "Blood pressure",
    water: "Water"
  };
  const value = key === "pressure"
    ? formatBloodPressure(item.systolic, item.diastolic)
    : formatHistoryPointValue(key, item[key]);
  return `${labels[key] || key}: ${value} on ${formatEntryDate(item.date)}`;
}

function formatHistoryPointValue(key, value) {
  if (!Number.isFinite(value)) return "--";
  if (key === "weight") return `${formatDecimal(value)} lb`;
  if (key === "carbs") return `${formatWholeNumber(value)}g`;
  if (key === "glucose") return `${formatWholeNumber(value)} mg/dL`;
  if (key === "water") return `${formatWholeNumber(value)} oz`;
  return formatWholeNumber(value);
}

function getEnabledHistoryKeys() {
  const filterValue = historyMetricFilter.value || "all";
  if (filterValue === "nutrition") return ["calories", "carbs", "weight"];
  if (filterValue === "vitals") return ["glucose", "pressure", "weight"];
  if (["calories", "carbs", "weight", "glucose", "pressure", "water"].includes(filterValue)) return [filterValue];
  if (filterValue === "water") return ["water"];
  return ["weight", "calories", "carbs", "glucose", "pressure", "water"];
}

function updateHistoryLegendButtons() {
  const filterValue = historyMetricFilter.value || "all";
  const enabledKeys = getEnabledHistoryKeys();
  historyLegendButtons.forEach((button) => {
    const metric = button.dataset.historyMetric || "";
    const isActive = filterValue === "all" || enabledKeys.includes(metric);
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function getHistoryX(date, startDate, endDate) {
  const range = Math.max(endDate - startDate, 1);
  return 40 + ((date - startDate) / range) * 576;
}

function getEntryDateTime(entry, fallbackHour = 12) {
  const recorded = entry?.recordedAt ? new Date(entry.recordedAt) : null;
  const date = parseDateKey(entry?.date || today);
  if (recorded && !Number.isNaN(recorded.getTime())) {
    date.setHours(recorded.getHours(), recorded.getMinutes(), recorded.getSeconds(), recorded.getMilliseconds());
    return date;
  }
  date.setHours(fallbackHour, 0, 0, 0);
  return date;
}

function getSymptomSeverityScore(severity) {
  if (severity === "Severe") return 3;
  if (severity === "Moderate") return 2;
  return 1;
}


function renderWaterControl() {
  if (!waterGlasses.children.length) {
    const fragment = document.createDocumentFragment();
    for (let index = 1; index <= WATER_GLASS_COUNT; index += 1) {
      const button = document.createElement("button");
      const label = document.createElement("span");

      button.type = "button";
      button.className = "water-glass";
      button.dataset.glassIndex = String(index);
      button.setAttribute("aria-label", `${index} glass${index === 1 ? "" : "es"}, ${index * WATER_GLASS_OZ} ounces`);
      label.textContent = String(index);
      button.appendChild(label);
      fragment.appendChild(button);
    }
    waterGlasses.appendChild(fragment);
  }

  const ounces = parseNutritionNumber(water.value);
  const selectedGlasses = Number.isFinite(ounces) ? Math.max(0, Math.min(WATER_GLASS_COUNT, Math.round(ounces / WATER_GLASS_OZ))) : 0;
  const visibleGlasses = WATER_GLASS_COUNT;

  waterCount.textContent = Number.isFinite(ounces) ? formatWholeNumber(ounces) : "0";
  waterToggle.setAttribute("aria-expanded", "true");
  waterGlasses.classList.add("expanded");
  waterGlasses.classList.remove("collapsed");
  waterGlasses.querySelectorAll(".water-glass").forEach((button, index) => {
    button.hidden = index >= visibleGlasses;
    const active = index < selectedGlasses;
    button.classList.toggle("active", active);
    button.style.setProperty("--fill", active ? "100%" : "0%");
  });
}

function setWaterExpanded(expanded) {
  waterExpanded = Boolean(expanded);
  renderWaterControl();
}

function setWaterAmount(ounces) {
  water.value = Number.isFinite(ounces) && ounces > 0 ? String(ounces) : "";
  renderWaterControl();
}

function findPreviousWeight(entries, currentIndex) {
  const olderEntries = entries.slice(currentIndex + 1);
  const previous = olderEntries.find((entry) => Number.isFinite(entry.weight));
  return previous ? previous.weight : null;
}

function parseNutritionNumber(value) {
  if (value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getAverage(values) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function getSum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function formatWholeNumber(value) {
  return wholeNumberFormatter.format(value);
}

function formatDecimal(value) {
  return decimalFormatter.format(value);
}

function formatInputDecimal(value) {
  return Number.isFinite(value) ? value.toFixed(1) : "";
}

function formatWeightDelta(value) {
  if (!Number.isFinite(value)) return "--";
  if (Math.abs(value) < 0.05) return "0.0 lb";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatDecimal(value)} lb`;
}

function formatEntryDate(dateKey) {
  const date = new Date(`${dateKey}T00:00:00`);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric"
  }).format(date);
}

function formatShortSlashDate(dateKey) {
  const date = parseDateKey(dateKey);
  return [
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    String(date.getFullYear()).slice(-2)
  ].join("/");
}

function updateJournalEntryState() {
  journalEntry.closest(".journal-entry-field")?.classList.toggle("has-entry", Boolean(journalEntry.value.trim()));
}

function parseDateKey(dateKey) {
  return new Date(`${dateKey}T00:00:00`);
}

function daysBetween(dateKey, compareDateKey) {
  return Math.abs(Math.round((parseDateKey(compareDateKey) - parseDateKey(dateKey)) / 86400000));
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createHabitId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function loadHabits() {
  try {
    const saved = JSON.parse(localStorage.getItem(storeKey));
    return Array.isArray(saved)
      ? saved
        .filter((habit) => habit && habit.name)
        .filter((habit) => !isLegacyStarterWalkTask(habit))
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

function isLegacyStarterWalkTask(habit) {
  const name = String(habit?.name || "").trim().toLowerCase();
  return name === "walk for 10 minutes"
    && !normalizeTaskTime(habit?.deadline)
    && !normalizeTaskTime(habit?.time)
    && !String(habit?.note || "").trim()
    && (!Array.isArray(habit?.completions) || habit.completions.length === 0);
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
      guestModeEnabled: false,
      biometricEnabled: false,
      biometricCredentialId: "",
      initialDataComplete: hasSavedSettings,
      aiExtractionEnabled: true,
      hipaaCloudConfirmed: true,
      aiApiKey: "",
      aiBackendUrl: DEFAULT_AI_BACKEND_URL,
      aiBackendToken: "",
      aiModel: "gpt-4o-mini",
      aiTtsModel: "gpt-4o-mini-tts",
      aiTtsVoice: "coral",
      ...savedSettings
    };
    settings.aiApiKey = "";
    settings.aiBackendUrl = normalizeAiBackendUrlInput(settings.aiBackendUrl || "", { silent: true });
    migrateAiDictationDefaults(settings);
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
      guestModeEnabled: false,
      biometricEnabled: false,
      biometricCredentialId: "",
      initialDataComplete: hasSavedSettings,
      aiExtractionEnabled: true,
      hipaaCloudConfirmed: true,
      aiApiKey: "",
      aiBackendUrl: DEFAULT_AI_BACKEND_URL,
      aiBackendToken: "",
      aiModel: "gpt-4o-mini",
      aiTtsModel: "gpt-4o-mini-tts",
      aiTtsVoice: "coral"
    };
  }
}

function migrateAiDictationDefaults(settings) {
  const migrationVersion = "ai-dictation-default-on:v2";
  if (localStorage.getItem(aiDefaultEnabledStoreKey) === migrationVersion) return;
  if (!DEFAULT_AI_BACKEND_URL) return;
  settings.aiBackendUrl = normalizeAiBackendUrlInput(settings.aiBackendUrl || DEFAULT_AI_BACKEND_URL, { silent: true });
  settings.hipaaCloudConfirmed = true;
  settings.aiExtractionEnabled = true;
  localStorage.setItem(aiDefaultEnabledStoreKey, migrationVersion);
  localStorage.setItem(settingsStoreKey, JSON.stringify(settings));
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
  guestModeToggle.checked = Boolean(appSettings.guestModeEnabled && !isAppLockEnabled());
  biometricToggle.checked = Boolean(appSettings.biometricEnabled && appSettings.biometricCredentialId);
  if (hipaaCloudToggle) hipaaCloudToggle.checked = Boolean(appSettings.hipaaCloudConfirmed);
  aiExtractionToggle.disabled = !appSettings.hipaaCloudConfirmed;
  aiExtractionToggle.checked = Boolean(appSettings.aiExtractionEnabled);
  aiApiKey.value = "";
  aiApiKey.disabled = true;
  aiBackendUrl.value = hasOwnSetting("aiBackendUrl") ? appSettings.aiBackendUrl || "" : "";
  aiBackendToken.value = appSettings.aiBackendToken || "";
  aiModel.value = hasOwnSetting("aiModel") ? appSettings.aiModel || "" : "";
  if (aiTtsModel) aiTtsModel.value = hasOwnSetting("aiTtsModel") ? appSettings.aiTtsModel || "" : "";
  if (aiTtsVoice) aiTtsVoice.value = appSettings.aiTtsVoice || "coral";
  biometricToggle.disabled = !isAppLockEnabled();
  setPasswordButton.textContent = isAppLockEnabled() ? "Change password" : "Set password";
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
  ));
}

function isGuestModeEnabled() {
  return Boolean(appSettings?.guestModeEnabled && !isAppLockEnabled());
}

function updateGuestModeSetting(enabled) {
  appSettings = {
    ...appSettings,
    guestModeEnabled: Boolean(enabled),
    ...(enabled ? {
      securitySalt: "",
      securityHash: "",
      biometricEnabled: false,
      biometricCredentialId: ""
    } : {})
  };
  saveAppSettings();
  renderSettings();
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
    guestModeEnabled: false,
    biometricEnabled: false,
    biometricCredentialId: ""
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
    guestModeEnabled: false,
    biometricEnabled: false,
    biometricCredentialId: ""
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
  guestModeButton.hidden = true;
  resetPasswordButton.hidden = false;
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
  if (isGuestModeEnabled()) return;
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
    ? "Use your phone biometric/device unlock, or continue as guest."
    : "Create one app password, or continue as guest.";
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
  guestModeButton.hidden = false;
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
    guestModeEnabled: false,
    biometricEnabled: false,
    biometricCredentialId: "",
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
      guestModeEnabled: false,
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
    guestModeEnabled: false,
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

function continueAsGuest() {
  appSettings = {
    ...appSettings,
    guestModeEnabled: true,
    securitySalt: "",
    securityHash: "",
    biometricEnabled: false,
    biometricCredentialId: "",
    initialDataComplete: true
  };
  saveAppSettings();
  finishUnlock();
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
        <p class="settings-note onboarding-wide">AI dictation uses your configured secure backend. OpenAI API keys should stay on the backend.</p>
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
        <label class="field onboarding-wide"><span>Notes</span><textarea name="note" rows="3"></textarea></label>
      `,
      save: (formData) => {
        const name = String(formData.get("mood") || "").trim();
        const intensity = String(formData.get("intensity") || "").trim();
        const note = String(formData.get("note") || "").trim();
        if (name) {
          moodEntries = [{
            id: createHabitId(),
            date: today,
            recordedAt: new Date().toISOString(),
            name,
            intensity: intensity || "Mild",
            note
          }, ...moodEntries];
          saveMoodEntries();
          renderMoods();
        }
        goToNextInitialDataStep();
      }
    },
    {
      title: "Symptoms",
      copy: "Add one symptom if anything is going on today.",
      fields: `
        <label class="field"><span>Symptom</span><input name="symptom" type="text"></label>
        <label class="field"><span>Severity</span><select name="severity"><option value=""></option><option>Mild</option><option>Moderate</option><option>Severe</option></select></label>
        <label class="field onboarding-wide"><span>Notes</span><textarea name="note" rows="3"></textarea></label>
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
        <label class="field onboarding-wide"><span>Task</span><input name="task" type="text"></label>
        <label class="field"><span>Day</span><select name="day">${dayOptions}</select></label>
        <label class="field"><span>Deadline</span><input name="deadline" type="time"></label>
        <label class="field onboarding-wide"><span>Notes</span><textarea name="note" rows="3"></textarea></label>
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
  const hasEntryValue = Object.values(partial).some((value) => value !== null && value !== "");
  if (!hasEntryValue) return;

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
    }, 45000);
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
    advanceDictationReviewStep();
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
  if (!hasDictationResult(result)) {
    handleUnclearDictation(text);
    return;
  }
  pendingParsedDictationResult = result;
  pendingParsedDictationDocument = typeof documentEntry === "string" ? { text: documentEntry } : documentEntry;
  showParsedDictationReview(result);
}

function commitParsedHealthDictation(resultToCommit = pendingParsedDictationResult) {
  const result = resultToCommit;
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
  renderDictationReviewStep();
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
  return [
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
  if (hasDictationResult(localResult)) {
    localResult.missingDetails = buildDictationMissingDetails(localResult, normalizeDictationText(text));
    return localResult;
  }
  if (isAiDictationEnabled()) {
    try {
      const aiResult = await extractAiDictationData(text);
      return mergeDictationResults(localResult, aiResult, text);
    } catch (error) {
      console.warn("AI dictation was too slow or unavailable; using local parser.", error);
    }
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
  ["calories", "carbs", "weight", "glucose", "systolic", "diastolic", "water"].forEach((key) => {
    const number = Number.parseFloat(value[key]);
    if (Number.isFinite(number)) nutrition[key] = number;
  });
  if (["Entering", "Ketosis", "Deep ketosis", "Exiting"].includes(value.ketosisPhase)) nutrition.ketosisPhase = value.ketosisPhase;
  return Object.keys(nutrition).length ? nutrition : null;
}

function normalizeAiChoice(value, allowed, fallback) {
  const found = allowed.find((item) => item.toLowerCase() === String(value || "").toLowerCase());
  return found || fallback;
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
  return dictationNormalizationRules.reduce(
    (normalized, [pattern, replacement]) => normalized.replace(pattern, replacement),
    String(text || "")
  );
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
