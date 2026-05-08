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
const DEFAULT_AI_BACKEND_URL = "";
const FACEBOOK_APP_ID = "2422428068229609";
const FACEBOOK_REDIRECT_URI = "fb2422428068229609://authorize";
const DICTATION_FEATURE_ENABLED = false;
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
const biometricToggle = document.querySelector("#biometricToggle");
const aiExtractionToggle = document.querySelector("#aiExtractionToggle");
const hipaaCloudToggle = document.querySelector("#hipaaCloudToggle");
const aiApiKey = document.querySelector("#aiApiKey");
const aiBackendUrl = document.querySelector("#aiBackendUrl");
const aiBackendToken = document.querySelector("#aiBackendToken");
const aiModel = document.querySelector("#aiModel");
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
const facebookLoginButton = document.querySelector("#facebookLoginButton");
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
facebookLoginButton?.addEventListener("click", () => startFacebookLogin());
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
