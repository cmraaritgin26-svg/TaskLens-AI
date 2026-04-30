const storeKey = "habit-tracker:v1";
const today = toDateKey(new Date());
let deferredInstallPrompt = null;
let filter = "all";
let habits = loadHabits();

const habitForm = document.querySelector("#habitForm");
const habitName = document.querySelector("#habitName");
const habitColor = document.querySelector("#habitColor");
const habitList = document.querySelector("#habitList");
const habitTemplate = document.querySelector("#habitTemplate");
const emptyState = document.querySelector("#emptyState");
const todayLabel = document.querySelector("#todayLabel");
const completeCount = document.querySelector("#completeCount");
const activeCount = document.querySelector("#activeCount");
const bestStreak = document.querySelector("#bestStreak");
const clearDoneButton = document.querySelector("#clearDoneButton");
const installButton = document.querySelector("#installButton");
const barGraph = document.querySelector("#barGraph");
const graphAverage = document.querySelector("#graphAverage");
const trendArea = document.querySelector(".trend-area");
const trendLine = document.querySelector(".trend-line");
const trendPoints = document.querySelector(".trend-points");
const gridLines = document.querySelector(".grid-lines");

todayLabel.textContent = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "short",
  day: "numeric"
}).format(new Date());

habitForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = habitName.value.trim();

  if (!name) return;

  habits.unshift({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    name,
    color: habitColor.value,
    completions: []
  });

  habitName.value = "";
  saveHabits();
  render();
});

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

  const doneToday = habits.filter((habit) => habit.completions.includes(today)).length;
  completeCount.textContent = doneToday;
  activeCount.textContent = habits.length;
  bestStreak.textContent = habits.reduce((best, habit) => Math.max(best, getStreak(habit)), 0);
  emptyState.hidden = habits.length > 0;
  renderGraph();
}

function renderHabit(habit) {
  const fragment = habitTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".habit-card");
  const checkButton = fragment.querySelector(".check-button");
  const deleteButton = fragment.querySelector(".delete-button");
  const title = fragment.querySelector("h2");
  const streak = fragment.querySelector(".streak");
  const weekScore = fragment.querySelector(".week-score");
  const weekStrip = fragment.querySelector(".week-strip");
  const completedToday = habit.completions.includes(today);
  const recentDays = getRecentDays();
  const completedThisWeek = recentDays.filter((day) => habit.completions.includes(day.key)).length;

  card.style.setProperty("--habit-color", habit.color);
  card.classList.toggle("done", completedToday);
  title.textContent = habit.name;
  streak.textContent = `${getStreak(habit)} day streak`;
  weekScore.textContent = `${completedThisWeek}/7 this week`;

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
    const complete = habits.filter((habit) => habit.completions.includes(day.key)).length;
    const percent = habits.length ? Math.round((complete / habits.length) * 100) : 0;
    return { ...day, complete, percent };
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
  const points = movement.map((day, index) => {
    const x = padding + index * step;
    const y = padding + graphHeight - (day.percent / 100) * graphHeight;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const areaPoints = [
    `${padding},${height - padding}`,
    ...points,
    `${width - padding},${height - padding}`
  ].join(" ");

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

  trendArea.setAttribute("points", areaPoints);
  trendLine.setAttribute("points", points.join(" "));
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
    bar.title = `${day.complete} of ${habits.length} habits completed`;

    bar.append(fill, label, value);
    barGraph.appendChild(bar);
  });
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

render();
