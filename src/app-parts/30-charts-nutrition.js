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
    const dayHabits = habits.filter((habit) => getTaskDay(habit) === dayName);
    const dateKey = getWeekdayDateKey(index);
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
  const totalTasks = habits.length;
  const totalComplete = habits.filter((habit) => (habit.completions || []).some((dateKey) => weekDateKeys.has(getCompletionDateKey(dateKey)))).length;
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
