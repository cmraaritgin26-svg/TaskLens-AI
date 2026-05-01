const storeKey = "habit-tracker:v1";
const nutritionStoreKey = "habit-tracker:nutrition:v1";
const today = toDateKey(new Date());
let deferredInstallPrompt = null;
let filter = "all";
let habits = loadHabits();
let nutritionEntries = loadNutritionEntries();

const habitForm = document.querySelector("#habitForm");
const habitName = document.querySelector("#habitName");
const habitCategory = document.querySelector("#habitCategory");
const habitTime = document.querySelector("#habitTime");
const habitPriority = document.querySelector("#habitPriority");
const habitColor = document.querySelector("#habitColor");
const habitNote = document.querySelector("#habitNote");
const nutritionForm = document.querySelector("#nutritionForm");
const nutritionDate = document.querySelector("#nutritionDate");
const calories = document.querySelector("#calories");
const carbs = document.querySelector("#carbs");
const weight = document.querySelector("#weight");
const ketosisPhase = document.querySelector("#ketosisPhase");
const glucose = document.querySelector("#glucose");
const systolic = document.querySelector("#systolic");
const diastolic = document.querySelector("#diastolic");
const water = document.querySelector("#water");
const waterControl = document.querySelector(".water-control");
const waterGlasses = document.querySelector("#waterGlasses");
const waterCount = document.querySelector("#waterCount");
const waterToggle = document.querySelector("#waterToggle");
const waterClear = document.querySelector("#waterClear");
const WATER_GLASS_OZ = 8;
const WATER_GLASS_COUNT = 8;
const WATER_GLASS_COLLAPSED_COUNT = 2;
let waterExpanded = false;
const avgCalories = document.querySelector("#avgCalories");
const avgCarbs = document.querySelector("#avgCarbs");
const latestWeight = document.querySelector("#latestWeight");
const latestKetosis = document.querySelector("#latestKetosis");
const latestGlucose = document.querySelector("#latestGlucose");
const latestBloodPressure = document.querySelector("#latestBloodPressure");
const latestWater = document.querySelector("#latestWater");
const nutritionRows = document.querySelector("#nutritionRows");
const nutritionEmpty = document.querySelector("#nutritionEmpty");
const habitList = document.querySelector("#habitList");
const habitTemplate = document.querySelector("#habitTemplate");
const emptyState = document.querySelector("#emptyState");
const todayLabel = document.querySelector("#todayLabel");
const clearDoneButton = document.querySelector("#clearDoneButton");
const installButton = document.querySelector("#installButton");
const barGraph = document.querySelector("#barGraph");
const graphAverage = document.querySelector("#graphAverage");
const trendArea = document.querySelector(".trend-area");
const trendLine = document.querySelector(".trend-line");
const caloriesLine = document.querySelector(".calories-line");
const carbsLine = document.querySelector(".carbs-line");
const weightLine = document.querySelector(".weight-line");
const ketosisLine = document.querySelector(".ketosis-line");
const glucoseLine = document.querySelector(".glucose-line");
const systolicLine = document.querySelector(".systolic-line");
const diastolicLine = document.querySelector(".diastolic-line");
const waterLine = document.querySelector(".water-line");
const trendPoints = document.querySelector(".trend-points");
const gridLines = document.querySelector(".grid-lines");

todayLabel.textContent = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "short",
  day: "numeric"
}).format(new Date());
nutritionDate.value = today;

habitForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = habitName.value.trim();

  if (!name) return;

  habits.unshift({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    name,
    category: habitCategory.value,
    time: habitTime.value,
    priority: habitPriority.value,
    color: habitColor.value,
    note: habitNote.value.trim(),
    completions: []
  });

  habitName.value = "";
  habitNote.value = "";
  saveHabits();
  render();
});

nutritionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const date = nutritionDate.value || today;
  const entry = {
    date,
    calories: parseNutritionNumber(calories.value),
    carbs: parseNutritionNumber(carbs.value),
    weight: parseNutritionNumber(weight.value),
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

clearDoneButton.addEventListener("click", () => {
  habits = habits.map((habit) => ({
    ...habit,
    completions: habit.completions.filter((date) => date !== today)
  }));
  saveHabits();
  render();
});

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    filter = button.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach((item) => {
      item.classList.toggle("active", item === button);
    });
    render();
  });
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton.hidden = false;
});

installButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installButton.hidden = true;
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js");
  });
}

function render() {
  habitList.textContent = "";
  const visibleHabits = habits.filter((habit) => {
    const done = habit.completions.includes(today);
    if (filter === "today") return done;
    if (filter === "missed") return !done;
    return true;
  });

  visibleHabits.forEach((habit) => habitList.appendChild(renderHabit(habit)));

  emptyState.hidden = habits.length > 0;
  renderGraph();
  renderNutrition();
  renderWaterControl();
}

function renderHabit(habit) {
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
  const weekStrip = fragment.querySelector(".week-strip");
  const completedToday = habit.completions.includes(today);
  const recentDays = getRecentDays();
  const completedThisWeek = recentDays.filter((day) => habit.completions.includes(day.key)).length;
  const detailItems = [
    habit.category || "General",
    habit.time || "Anytime",
    habit.priority || "Normal"
  ];

  card.style.setProperty("--habit-color", habit.color);
  card.classList.toggle("done", completedToday);
  title.textContent = habit.name;
  streak.textContent = `${getStreak(habit)} day streak`;
  weekScore.textContent = `${completedThisWeek}/7 this week`;
  note.textContent = habit.note || "";
  note.hidden = !habit.note;
  calendarLink.href = getGoogleCalendarUrl(habit);

  detailItems.forEach((item) => {
    const chip = document.createElement("span");
    chip.textContent = item;
    attributes.appendChild(chip);
  });

  recentDays.forEach((day) => {
    const item = document.createElement("span");
    item.className = "day";
    item.textContent = day.label;
    item.classList.toggle("complete", habit.completions.includes(day.key));
    weekStrip.appendChild(item);
  });

  checkButton.addEventListener("click", () => toggleHabit(habit.id));
  deleteButton.addEventListener("click", () => deleteHabit(habit.id));

  return fragment;
}

function getGoogleCalendarUrl(habit) {
  const start = getCalendarStart(habit.time || "Anytime");
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const details = [
    habit.note,
    `Category: ${habit.category || "General"}`,
    `Priority: ${habit.priority || "Normal"}`,
    "Created from Health & Habit Tracker."
  ].filter(Boolean).join("\n");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Habit: ${habit.name}`,
    details,
    dates: `${toCalendarDateTime(start)}/${toCalendarDateTime(end)}`,
    recur: "RRULE:FREQ=DAILY"
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function getCalendarStart(time) {
  const start = new Date();
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

function toggleHabit(id) {
  habits = habits.map((habit) => {
    if (habit.id !== id) return habit;
    const completions = habit.completions.includes(today)
      ? habit.completions.filter((date) => date !== today)
      : [...habit.completions, today];
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
  const days = getRecentDays(14);
  const movement = days.map((day) => {
    const nutrition = nutritionEntries.find((entry) => entry.date === day.key) || {};
    const complete = habits.filter((habit) => habit.completions.includes(day.key)).length;
    const percent = habits.length ? Math.round((complete / habits.length) * 100) : 0;
    return {
      ...day,
      complete,
      percent,
      calories: nutrition.calories,
      carbs: nutrition.carbs,
      weight: nutrition.weight,
      ketosisPhase: nutrition.ketosisPhase,
      ketosisLevel: getKetosisPhaseLevel(nutrition.ketosisPhase),
      glucose: nutrition.glucose,
      systolic: nutrition.systolic,
      diastolic: nutrition.diastolic,
      water: nutrition.water
    };
  });
  const average = movement.length
    ? Math.round(movement.reduce((total, day) => total + day.percent, 0) / movement.length)
    : 0;

  graphAverage.textContent = `${average}%`;
  renderTrendGraph(movement);
  renderBarGraph(movement);
}

function renderTrendGraph(movement) {
  const width = 640;
  const height = 220;
  const padding = 26;
  const graphHeight = height - padding * 2;
  const step = (width - padding * 2) / Math.max(movement.length - 1, 1);
  const points = getLinePoints(movement, step, padding, graphHeight, height, (day) => day.percent, 0, 100);
  const caloriePoints = getMetricPoints(movement, step, padding, graphHeight, height, "calories");
  const carbPoints = getMetricPoints(movement, step, padding, graphHeight, height, "carbs");
  const weightPoints = getMetricPoints(movement, step, padding, graphHeight, height, "weight");
  const ketosisPoints = getMetricPoints(movement, step, padding, graphHeight, height, "ketosisLevel");
  const glucosePoints = getMetricPoints(movement, step, padding, graphHeight, height, "glucose");
  const systolicPoints = getMetricPoints(movement, step, padding, graphHeight, height, "systolic");
  const diastolicPoints = getMetricPoints(movement, step, padding, graphHeight, height, "diastolic");
  const waterPoints = getMetricPoints(movement, step, padding, graphHeight, height, "water");
  const areaPath = buildAreaPath(points, width, height, padding);

  gridLines.textContent = "";
  [0, 25, 50, 75, 100].forEach((value) => {
    const y = padding + graphHeight - (value / 100) * graphHeight;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", padding);
    line.setAttribute("x2", width - padding);
    line.setAttribute("y1", y);
    line.setAttribute("y2", y);
    gridLines.appendChild(line);
  });

  trendArea.setAttribute("d", areaPath);
  trendLine.setAttribute("d", smoothPath(points));
  caloriesLine.setAttribute("d", smoothPath(caloriePoints));
  carbsLine.setAttribute("d", smoothPath(carbPoints));
  weightLine.setAttribute("d", smoothPath(weightPoints));
  ketosisLine.setAttribute("d", smoothPath(ketosisPoints));
  glucoseLine.setAttribute("d", smoothPath(glucosePoints));
  systolicLine.setAttribute("d", smoothPath(systolicPoints));
  diastolicLine.setAttribute("d", smoothPath(diastolicPoints));
  waterLine.setAttribute("d", smoothPath(waterPoints));
  trendPoints.textContent = "";

  movement.forEach((day, index) => {
    const [x, y] = points[index].split(",");
    const point = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    point.setAttribute("cx", x);
    point.setAttribute("cy", y);
    point.setAttribute("r", day.percent > 0 ? 6 : 4);
    trendPoints.appendChild(point);
  });
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

function getMetricPoints(movement, step, padding, graphHeight, height, key) {
  const values = movement.map((day) => day[key]).filter(Number.isFinite);
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);

  return getLinePoints(movement, step, padding, graphHeight, height, (day) => day[key], min, max);
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

function renderBarGraph(movement) {
  barGraph.textContent = "";

  movement.forEach((day) => {
    const bar = document.createElement("div");
    const fill = document.createElement("span");
    const label = document.createElement("strong");
    const value = document.createElement("small");

    bar.className = "bar";
    fill.className = "bar-fill";
    fill.style.height = `${Math.max(day.percent, habits.length ? 6 : 0)}%`;
    label.textContent = day.label;
    value.textContent = `${day.percent}%`;
    bar.title = [
      `${day.complete} of ${habits.length} habits completed`,
      Number.isFinite(day.calories) ? `${formatWholeNumber(day.calories)} calories` : null,
      Number.isFinite(day.carbs) ? `${formatWholeNumber(day.carbs)}g carbs` : null,
      Number.isFinite(day.weight) ? `${formatDecimal(day.weight)} lb` : null,
      day.ketosisPhase ? `Ketosis: ${formatKetosisPhase(day.ketosisPhase)}` : null,
      Number.isFinite(day.glucose) ? `${formatWholeNumber(day.glucose)} glucose` : null,
      formatBloodPressure(day.systolic, day.diastolic),
      Number.isFinite(day.water) ? `${formatWholeNumber(day.water)} oz water` : null
    ].filter(Boolean).join(" | ");

    bar.append(fill, label, value);
    barGraph.appendChild(bar);
  });
}

function renderNutrition() {
  const recentEntries = [...nutritionEntries]
    .sort((first, second) => second.date.localeCompare(first.date))
    .slice(0, 14);
  const sevenDayEntries = nutritionEntries.filter((entry) => {
    const entryDate = new Date(`${entry.date}T00:00:00`);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6);
    return entryDate >= start && entryDate <= new Date();
  });
  const calorieValues = sevenDayEntries.map((entry) => entry.calories).filter(Number.isFinite);
  const carbValues = sevenDayEntries.map((entry) => entry.carbs).filter(Number.isFinite);
  const latestWeightEntry = nutritionEntries.find((entry) => Number.isFinite(entry.weight));
  const latestKetosisEntry = nutritionEntries.find((entry) => entry.ketosisPhase);
  const latestGlucoseEntry = nutritionEntries.find((entry) => Number.isFinite(entry.glucose));
  const latestBloodPressureEntry = nutritionEntries.find(
    (entry) => Number.isFinite(entry.systolic) && Number.isFinite(entry.diastolic)
  );
  const latestWaterEntry = nutritionEntries.find((entry) => Number.isFinite(entry.water));

  avgCalories.textContent = calorieValues.length ? formatWholeNumber(getAverage(calorieValues)) : "0";
  avgCarbs.textContent = carbValues.length ? `${formatWholeNumber(getAverage(carbValues))}g` : "0g";
  latestWeight.textContent = latestWeightEntry ? `${formatDecimal(latestWeightEntry.weight)} lb` : "--";
  latestKetosis.textContent = latestKetosisEntry ? formatKetosisPhase(latestKetosisEntry.ketosisPhase) : "--";
  latestGlucose.textContent = latestGlucoseEntry ? `${formatWholeNumber(latestGlucoseEntry.glucose)} mg/dL` : "--";
  latestBloodPressure.textContent = latestBloodPressureEntry
    ? formatBloodPressure(latestBloodPressureEntry.systolic, latestBloodPressureEntry.diastolic, true)
    : "--";
  latestWater.textContent = latestWaterEntry ? `${formatWholeNumber(latestWaterEntry.water)} oz` : "--";
  nutritionRows.textContent = "";
  nutritionEmpty.hidden = recentEntries.length > 0;

  recentEntries.forEach((entry, index) => {
    const row = document.createElement("tr");
    const previousWeight = findPreviousWeight(recentEntries, index);
    const delta = Number.isFinite(entry.weight) && Number.isFinite(previousWeight)
      ? entry.weight - previousWeight
      : null;
    const cells = [
      formatEntryDate(entry.date),
      Number.isFinite(entry.calories) ? formatWholeNumber(entry.calories) : "--",
      Number.isFinite(entry.carbs) ? `${formatWholeNumber(entry.carbs)}g` : "--",
      Number.isFinite(entry.weight) ? `${formatDecimal(entry.weight)} lb` : "--",
      formatKetosisPhase(entry.ketosisPhase),
      Number.isFinite(entry.glucose) ? `${formatWholeNumber(entry.glucose)} mg/dL` : "--",
      formatBloodPressure(entry.systolic, entry.diastolic),
      Number.isFinite(entry.water) ? `${formatWholeNumber(entry.water)} oz` : "--",
      formatWeightDelta(delta)
    ];

    cells.forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    });

    nutritionRows.appendChild(row);
  });
}

function renderWaterControl() {
  if (!waterGlasses.children.length) {
    for (let index = 1; index <= WATER_GLASS_COUNT; index += 1) {
      const button = document.createElement("button");
      const label = document.createElement("span");

      button.type = "button";
      button.className = "water-glass";
      button.dataset.glassIndex = String(index);
      button.setAttribute("aria-label", `${index} glass${index === 1 ? "" : "es"}, ${index * WATER_GLASS_OZ} ounces`);
      label.textContent = String(index);
      button.appendChild(label);
      waterGlasses.appendChild(button);
    }
  }

  const ounces = parseNutritionNumber(water.value);
  const selectedGlasses = Number.isFinite(ounces) ? Math.max(0, Math.min(WATER_GLASS_COUNT, Math.round(ounces / WATER_GLASS_OZ))) : 0;
  const visibleGlasses = waterExpanded ? WATER_GLASS_COUNT : WATER_GLASS_COLLAPSED_COUNT;

  waterCount.textContent = Number.isFinite(ounces) ? formatWholeNumber(ounces) : "0";
  waterToggle.setAttribute("aria-expanded", String(waterExpanded));
  waterGlasses.classList.toggle("expanded", waterExpanded);
  waterGlasses.classList.toggle("collapsed", !waterExpanded);
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

function formatWholeNumber(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

function formatDecimal(value) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(value);
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

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function loadHabits() {
  try {
    const saved = JSON.parse(localStorage.getItem(storeKey));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveHabits() {
  localStorage.setItem(storeKey, JSON.stringify(habits));
}

function loadNutritionEntries() {
  try {
    const saved = JSON.parse(localStorage.getItem(nutritionStoreKey));
    return Array.isArray(saved)
      ? saved
        .filter((entry) => entry && entry.date)
        .map((entry) => ({
          date: entry.date,
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

render();
