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
  const todayName = weekDays[now.getDay()];
  const todayTasks = habits.filter((habit) => getTaskDay(habit) === todayName);
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
  if (taskDay) taskDay.value = getTaskDay(habit);
  habitCategory.value = habit.category || "Health";
  habitDeadline.value = normalizeTaskTime(habit.deadline);
  habitPriority.value = habit.priority || "Normal";
  habitNote.value = habit.note || "";
  habitForm.querySelector(".primary-button").textContent = "Save";
  habitName.focus();
}

function openDayTaskDialog(dayName, dateKey) {
  const dayTasks = habits.filter((habit) => getTaskDay(habit) === dayName);
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
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const dayCodes = {
    Sunday: "SU",
    Monday: "MO",
    Tuesday: "TU",
    Wednesday: "WE",
    Thursday: "TH",
    Friday: "FR",
    Saturday: "SA"
  };
  const details = [
    habit.note,
    `Category: ${habit.category || "General"}`,
    `Priority: ${habit.priority || "Normal"}`,
    "Created from Health & Task Tracker."
  ].filter(Boolean).join("\n");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Task: ${habit.name}`,
    details,
    dates: `${toCalendarDateTime(start)}/${toCalendarDateTime(end)}`,
    recur: `RRULE:FREQ=WEEKLY;BYDAY=${dayCodes[getTaskDay(habit)] || "MO"}`
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
  return weekDays.includes(habit.day) ? habit.day : weekDays[new Date().getDay()];
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
