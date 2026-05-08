function render() {
  habitList.textContent = "";
  const tasksByDay = groupTasksByDay();
  const todayIndex = new Date().getDay();
  const fragment = document.createDocumentFragment();
  weekDays.forEach((dayName, index) => {
    const dayHabits = tasksByDay.get(dayName);
    if (!dayHabits?.length) return;
    fragment.appendChild(renderDaySection(dayName, index, dayHabits, todayIndex));
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
  const tasksByDay = new Map(weekDays.map((dayName) => [dayName, []]));
  habits.forEach((habit) => {
    const dayName = getTaskDay(habit);
    if (!tasksByDay.has(dayName)) tasksByDay.set(dayName, []);
    tasksByDay.get(dayName).push(habit);
  });
  return tasksByDay;
}

function renderDaySection(dayName, dayIndex, dayHabits, todayIndex) {
  const section = document.createElement("section");
  section.className = "day-section";
  section.dataset.day = dayName;
  section.classList.toggle("today", dayIndex === todayIndex);
  if (dayIndex === todayIndex) {
    section.id = "todayTasksSection";
  }

  const currentDateKey = getWeekdayDateKey(dayIndex);
  const total = dayHabits.length;
  const complete = dayHabits.filter((habit) => habit.completions.includes(currentDateKey)).length;
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
  subtitle.textContent = total ? `${total} task${total === 1 ? "" : "s"}` : "No tasks yet";
  titleWrap.append(title, subtitle);

  const percent = document.createElement("span");
  percent.className = "day-section-percent";
  percent.textContent = `${percentComplete}%`;
  percent.title = total
    ? `${complete} of ${total} tasks completed for ${dayName}`
    : `No tasks scheduled for ${dayName}`;

  header.append(titleWrap, percent);
  header.addEventListener("click", () => openDayTaskDialog(dayName, currentDateKey));
  header.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openDayTaskDialog(dayName, currentDateKey);
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
      fragment.appendChild(renderTaskCard(habit, currentDateKey, dayName, recentDays));
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
  const tasks = habits.filter((habit) => getTaskDay(habit) === todayName);
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
  const todayTasks = habits.filter((habit) => getTaskDay(habit) === todayName);
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
      .filter((habit) => getTaskDay(habit) === dayName && !habit.completions.includes(dateKey))
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
    tasks: habits.map((habit) => [habit.id, habit.name, getTaskDay(habit), habit.category, habit.time, habit.deadline, habit.priority, truncateForAi(habit.note, 160), habit.completions?.slice(-21)]),
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
  const todayName = weekDays[new Date().getDay()];
  const todayTasks = habits.filter((habit) => getTaskDay(habit) === todayName);
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
    const tasksForDay = habits.filter((habit) => getTaskDay(habit) === weekDays[parseDateKey(dateKey).getDay()]);
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
  const duplicate = habits.some((habit) => habit.name.toLowerCase() === name.toLowerCase() && getTaskDay(habit) === dayName);
  if (duplicate) return;
  habits = [{
    id: createHabitId(),
    name,
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

