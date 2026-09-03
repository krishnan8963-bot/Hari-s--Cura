/**
 * app.js — Hari's Cura application logic.
 * Organized into small modules by feature: Dates, State, Render, Tasks,
 * Shopping, Planner, Stats, Settings, Modals, Toasts, PWA install.
 */

/* ============================================================================
   DATE HELPERS
   All dates are stored as 'YYYY-MM-DD' local strings (never UTC-shifted).
   ============================================================================ */
const DateUtil = (() => {
  function pad(n) { return String(n).padStart(2, '0'); }

  function toKey(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function fromKey(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function todayKey() {
    return toKey(new Date());
  }

  function addDays(key, n) {
    const d = fromKey(key);
    d.setDate(d.getDate() + n);
    return toKey(d);
  }

  function addMonths(key, n) {
    const d = fromKey(key);
    d.setMonth(d.getMonth() + n);
    return toKey(d);
  }

  function addYears(key, n) {
    const d = fromKey(key);
    d.setFullYear(d.getFullYear() + n);
    return toKey(d);
  }

  function isPast(key) {
    return key < todayKey();
  }

  function isToday(key) {
    return key === todayKey();
  }

  function nextWeekday(key, targetDow) {
    // targetDow: 0=Sunday..6=Saturday. Returns the next date (strictly after key) with that weekday.
    let d = fromKey(key);
    do {
      d.setDate(d.getDate() + 1);
    } while (d.getDay() !== targetDow);
    return toKey(d);
  }

  function startOfWeek(key, firstDayOfWeek) {
    const d = fromKey(key);
    const dow = d.getDay(); // 0=Sun
    const firstIsMonday = firstDayOfWeek === 'monday';
    const diff = firstIsMonday ? (dow === 0 ? 6 : dow - 1) : dow;
    d.setDate(d.getDate() - diff);
    return toKey(d);
  }

  const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const WEEKDAY_SHORT_UPPER = WEEKDAY_SHORT.map((s) => s.toUpperCase());
  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function formatFriendly(key) {
    const d = fromKey(key);
    const dowName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()];
    return `${dowName}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
  }

  function formatShort(key) {
    const d = fromKey(key);
    return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
  }

  function formatTime12(timeStr) {
    if (!timeStr) return '';
    const [hh, mm] = timeStr.split(':').map(Number);
    const period = hh >= 12 ? 'PM' : 'AM';
    let h12 = hh % 12;
    if (h12 === 0) h12 = 12;
    return `${h12}:${pad(mm)} ${period}`;
  }

  function daysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
  }

  return {
    pad, toKey, fromKey, todayKey, addDays, addMonths, addYears, isPast, isToday,
    nextWeekday, startOfWeek, formatFriendly, formatShort, formatTime12, daysInMonth,
    WEEKDAY_SHORT, WEEKDAY_SHORT_UPPER, MONTH_NAMES, MONTH_SHORT,
  };
})();

/* ============================================================================
   GLOBAL STATE
   ============================================================================ */
const State = {
  tasks: [],
  shopping: [],
  settings: { ...DB.DEFAULT_SETTINGS },
  currentScreen: 'today',
  todayFilter: 'all',
  plannerView: 'day',
  plannerDayDate: DateUtil.todayKey(),
  plannerWeekDate: DateUtil.todayKey(),
  plannerMonthDate: DateUtil.todayKey(),
  plannerYearDate: DateUtil.todayKey(),
  selectedWeekDayDate: DateUtil.todayKey(),
  selectedMonthDayDate: null,
  shoppingTab: 'pending',
  customCategories: [],
  editingTaskId: null,
  editingShoppingId: null,
  deferredInstallPrompt: null,
};

const CATEGORY_LABELS = {
  work: 'Work', personal: 'Personal', family: 'Family', finance: 'Finance',
  shopping: 'Shopping', health: 'Health', car: 'Car', learning: 'Learning', other: 'Other',
};
const SHOP_CATEGORY_LABELS = {
  grocery: 'Grocery', household: 'Household', personal: 'Personal',
  electronics: 'Electronics', kids: 'Kids', car: 'Car', other: 'Other',
};
const REMINDER_LABELS = {
  none: 'None', 'at-time': 'At task time', '10-min': '10 min before',
  '30-min': '30 min before', '1-hour': '1 hour before', custom: 'Custom',
};

function categoryLabel(cat) {
  return CATEGORY_LABELS[cat] || (cat ? cat.charAt(0).toUpperCase() + cat.slice(1) : 'Other');
}

/* ============================================================================
   TOASTS
   ============================================================================ */
const Toast = {
  show(message, duration = 2600) {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.classList.add('is-leaving');
      setTimeout(() => el.remove(), 260);
    }, duration);
  },
};

/* ============================================================================
   CONFIRM DIALOG
   ============================================================================ */
const Confirm = {
  ask(title, message) {
    return new Promise((resolve) => {
      const overlay = document.getElementById('confirm-overlay');
      document.getElementById('confirm-title').textContent = title;
      document.getElementById('confirm-message').textContent = message;
      overlay.hidden = false;

      const okBtn = document.getElementById('confirm-ok-btn');
      const cancelBtn = document.getElementById('confirm-cancel-btn');

      const cleanup = (result) => {
        overlay.hidden = true;
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
        resolve(result);
      };
      const onOk = () => cleanup(true);
      const onCancel = () => cleanup(false);

      okBtn.addEventListener('click', onOk);
      cancelBtn.addEventListener('click', onCancel);
    });
  },
};

/* ============================================================================
   BUSINESS LOGIC: TASKS
   ============================================================================ */
const TaskLogic = {
  /** Tasks scheduled for a given date (their *current* date field). */
  forDate(dateKey) {
    return State.tasks.filter((t) => t.date === dateKey);
  },

  isOverdue(task) {
    return !task.completed && task.date && DateUtil.isPast(task.date);
  },

  completionForList(list) {
    if (list.length === 0) return null;
    const done = list.filter((t) => t.completed).length;
    return { done, total: list.length, pct: Math.round((done / list.length) * 100) };
  },

  /**
   * Automatic carry-forward: run once per session (and once per day change).
   * Moves any incomplete task whose date is in the past to today, provided
   * carryForward is enabled globally and on the task itself. Marks the task
   * carriedForward=true and preserves originalDate. Never touches completed tasks.
   */
  async runAutoCarryForward() {
    if (!State.settings.autoCarryForward) return 0;
    const todayKey = DateUtil.todayKey();
    let movedCount = 0;

    for (const task of State.tasks) {
      if (task.completed) continue;
      if (task.carryForwardEnabled === false) continue;
      if (!task.date || task.date >= todayKey) continue;

      if (!task.originalDate) task.originalDate = task.date;
      task.date = todayKey;
      task.carriedForward = true;
      task.updatedAt = new Date().toISOString();
      await DB.Tasks.save(task);
      movedCount += 1;
    }
    return movedCount;
  },

  /** Compute the next occurrence date for a recurring task. */
  nextOccurrenceDate(task) {
    switch (task.recurringType) {
      case 'daily':
        return DateUtil.addDays(task.date, 1);
      case 'weekdays': {
        let next = DateUtil.addDays(task.date, 1);
        let d = DateUtil.fromKey(next);
        while (d.getDay() === 0 || d.getDay() === 6) {
          next = DateUtil.addDays(next, 1);
          d = DateUtil.fromKey(next);
        }
        return next;
      }
      case 'weekly':
        return DateUtil.addDays(task.date, 7);
      case 'monthly':
        return DateUtil.addMonths(task.date, 1);
      case 'yearly':
        return DateUtil.addYears(task.date, 1);
      default:
        return null;
    }
  },

  /**
   * When a recurring task is completed, spawn the next occurrence as a NEW
   * task record (so the completed one remains untouched in history/stats).
   */
  async spawnNextOccurrenceIfNeeded(completedTask) {
    if (!completedTask.recurring || completedTask.recurringType === 'none') return;
    const nextDate = this.nextOccurrenceDate(completedTask);
    if (!nextDate) return;

    const next = {
      ...completedTask,
      id: DB.Tasks.newId(),
      date: nextDate,
      completed: false,
      completedAt: null,
      carriedForward: false,
      originalDate: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await DB.Tasks.save(next);
    State.tasks.push(next);
  },
};

/* ============================================================================
   RENDER HELPERS: task card / group building
   ============================================================================ */
function buildTaskCardHTML(task) {
  const priorityClass = `p-${task.priority || 'low'}`;
  const timeLabel = task.time ? DateUtil.formatTime12(task.time) : '';
  const catLabel = categoryLabel(task.category);
  const reminderIcon = task.reminder && task.reminder !== 'none' ? '<span class="reminder-dot" title="Reminder set">🔔</span>' : '';
  const carriedBadge = task.carriedForward && !task.completed
    ? '<span class="carried-badge">🔄 Carried forward</span>'
    : '';

  return `
    <div class="task-card ${task.completed ? 'is-completed' : ''}" data-task-id="${task.id}" role="button" tabindex="0" aria-label="${escapeAttr(task.title)}">
      <button class="task-checkbox" data-action="toggle-task" aria-label="${task.completed ? 'Mark incomplete' : 'Mark complete'}">${task.completed ? '✓' : ''}</button>
      <div class="task-body">
        <div class="task-title-row">
          <span class="task-title">${escapeHTML(task.title)}</span>
          ${carriedBadge}
        </div>
        <div class="task-meta">
          ${timeLabel ? `<span class="task-meta-item">${timeLabel}</span>` : ''}
          <span class="task-meta-item"><span class="priority-dot ${priorityClass}"></span></span>
          <span class="category-tag">${escapeHTML(catLabel)}</span>
          ${reminderIcon}
        </div>
      </div>
    </div>`;
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}
function escapeAttr(str) {
  return escapeHTML(str).replace(/"/g, '&quot;');
}

/** Groups a list of tasks into Overdue / Morning / Afternoon / Evening / No time. */
function groupTasksForDisplay(list) {
  const groups = { overdue: [], morning: [], afternoon: [], evening: [], noTime: [] };
  list.forEach((t) => {
    if (TaskLogic.isOverdue(t)) { groups.overdue.push(t); return; }
    if (!t.time) { groups.noTime.push(t); return; }
    const hour = parseInt(t.time.split(':')[0], 10);
    if (hour < 12) groups.morning.push(t);
    else if (hour < 17) groups.afternoon.push(t);
    else groups.evening.push(t);
  });
  const sortByTime = (a, b) => (a.time || '99:99').localeCompare(b.time || '99:99');
  Object.values(groups).forEach((g) => g.sort(sortByTime));
  return groups;
}

function renderTaskGroupsInto(containerEl, list, emptyEl) {
  const groups = groupTasksForDisplay(list);
  const sections = [
    ['overdue', 'Overdue', true],
    ['morning', 'Morning', false],
    ['afternoon', 'Afternoon', false],
    ['evening', 'Evening', false],
    ['noTime', 'Anytime', false],
  ];

  let html = '';
  sections.forEach(([key, label, isOverdue]) => {
    const items = groups[key];
    if (!items.length) return;
    html += `<div class="task-group">
      <p class="task-group-title ${isOverdue ? 'is-overdue' : ''}">${isOverdue ? '⚠️ ' : ''}${label}</p>
      <div class="task-list">${items.map(buildTaskCardHTML).join('')}</div>
    </div>`;
  });

  containerEl.innerHTML = html;
  const hasAny = list.length > 0;
  if (emptyEl) emptyEl.hidden = hasAny;
  containerEl.hidden = !hasAny;
}

/* ============================================================================
   TODAY SCREEN
   ============================================================================ */
function updateGreeting() {
  const hour = new Date().getHours();
  let greeting = 'Good Morning';
  if (hour >= 5 && hour < 12) greeting = 'Good Morning';
  else if (hour >= 12 && hour < 17) greeting = 'Good Afternoon';
  else if (hour >= 17 && hour < 21) greeting = 'Good Evening';
  else greeting = 'Good Night';
  document.getElementById('greeting-text').textContent = `${greeting} 👋`;
  document.getElementById('today-date-text').textContent = DateUtil.formatFriendly(DateUtil.todayKey());
}

function applyTodayFilter(list) {
  switch (State.todayFilter) {
    case 'pending': return list.filter((t) => !t.completed);
    case 'completed': return list.filter((t) => t.completed);
    case 'overdue': return list.filter((t) => TaskLogic.isOverdue(t));
    case 'carried': return list.filter((t) => t.carriedForward);
    case 'high': return list.filter((t) => t.priority === 'high');
    default: return list;
  }
}

function renderProgressRing(ringEl, labelEl, completion) {
  const circumference = 2 * Math.PI * 52;
  ringEl.style.strokeDasharray = `${circumference}`;
  if (!completion) {
    ringEl.style.strokeDashoffset = `${circumference}`;
    labelEl.textContent = '—';
    return;
  }
  const offset = circumference - (completion.pct / 100) * circumference;
  ringEl.style.strokeDashoffset = `${offset}`;
  labelEl.textContent = `${completion.pct}%`;
}

function renderTodayScreen() {
  updateGreeting();
  const todayKey = DateUtil.todayKey();
  const todayTasks = TaskLogic.forDate(todayKey);
  const completion = TaskLogic.completionForList(todayTasks);

  renderProgressRing(
    document.getElementById('progress-ring-fill'),
    document.getElementById('progress-percent-text'),
    completion
  );

  const countText = document.getElementById('progress-count-text');
  const captionText = document.getElementById('progress-caption-text');
  if (!completion) {
    countText.textContent = 'Nothing planned';
    captionText.textContent = "Add your first task to get started.";
  } else {
    countText.textContent = `${completion.done} of ${completion.total} tasks completed`;
    if (completion.pct === 100) captionText.textContent = "You're doing great! Everything's done. 🎉";
    else if (completion.pct >= 70) captionText.textContent = "Almost there — one more push!";
    else captionText.textContent = "Let's make today count.";
  }

  const filtered = applyTodayFilter(todayTasks);
  renderTaskGroupsInto(
    document.getElementById('today-task-groups'),
    filtered,
    document.getElementById('today-empty-state')
  );
}

/* ============================================================================
   PLANNER SCREEN
   ============================================================================ */
function renderDayView() {
  const dateKey = State.plannerDayDate;
  document.getElementById('day-view-date').textContent = DateUtil.formatFriendly(dateKey);
  const list = TaskLogic.forDate(dateKey);
  const completion = TaskLogic.completionForList(list);

  const strip = document.getElementById('day-progress-strip');
  if (!completion) {
    strip.innerHTML = `<p class="settings-note">Nothing planned for this day.</p>`;
  } else {
    strip.innerHTML = `
      <div class="card" style="margin-bottom:0; display:flex; align-items:center; justify-content:space-between;">
        <span style="font-weight:700;">${completion.pct}% complete</span>
        <span class="settings-note" style="padding:0;">${completion.done} of ${completion.total} tasks</span>
      </div>`;
  }

  renderTaskGroupsInto(
    document.getElementById('day-task-groups'),
    list,
    document.getElementById('day-empty-state')
  );
}

function renderWeekView() {
  const start = DateUtil.startOfWeek(State.plannerWeekDate, State.settings.firstDayOfWeek);
  const days = Array.from({ length: 7 }, (_, i) => DateUtil.addDays(start, i));
  document.getElementById('week-view-range').textContent =
    `${DateUtil.formatShort(days[0])} – ${DateUtil.formatShort(days[6])}`;

  const grid = document.getElementById('week-grid');
  grid.innerHTML = days.map((dayKey) => {
    const d = DateUtil.fromKey(dayKey);
    const list = TaskLogic.forDate(dayKey);
    const completion = TaskLogic.completionForList(list);
    const isSelected = dayKey === State.selectedWeekDayDate;
    const isToday = DateUtil.isToday(dayKey);
    return `
      <button class="week-day-cell ${isSelected ? 'is-selected' : ''} ${isToday ? 'is-today' : ''}" data-day="${dayKey}" type="button">
        <div class="week-day-label">${DateUtil.WEEKDAY_SHORT_UPPER[d.getDay()]}</div>
        <div class="week-day-num">${d.getDate()}</div>
        <div class="week-day-count">${list.length ? `${list.length} task${list.length > 1 ? 's' : ''}` : '—'}</div>
        ${completion ? `<div class="week-day-dot" style="opacity:${completion.pct === 100 ? 1 : 0.4}"></div>` : ''}
      </button>`;
  }).join('');

  const dayList = TaskLogic.forDate(State.selectedWeekDayDate);
  document.getElementById('week-day-tasks').innerHTML =
    `<p class="task-group-title">${DateUtil.formatFriendly(State.selectedWeekDayDate)}</p>`;
  const wrap = document.createElement('div');
  wrap.className = 'task-list';
  if (dayList.length === 0) {
    wrap.innerHTML = `<p class="settings-note">No tasks this day.</p>`;
  } else {
    const groups = groupTasksForDisplay(dayList);
    wrap.innerHTML = Object.values(groups).flat().map(buildTaskCardHTML).join('');
  }
  document.getElementById('week-day-tasks').appendChild(wrap);
}

function renderMonthView() {
  const anchor = DateUtil.fromKey(State.plannerMonthDate);
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  document.getElementById('month-view-label').textContent = `${DateUtil.MONTH_NAMES[month]} ${year}`;

  const weekdayRow = document.getElementById('month-weekday-row');
  const firstIsMonday = State.settings.firstDayOfWeek === 'monday';
  const labels = firstIsMonday
    ? ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
    : ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  weekdayRow.innerHTML = labels.map((l) => `<span>${l}</span>`).join('');

  const firstOfMonthKey = DateUtil.toKey(new Date(year, month, 1));
  const gridStart = DateUtil.startOfWeek(firstOfMonthKey, State.settings.firstDayOfWeek);

  const totalDays = DateUtil.daysInMonth(year, month);
  const lastOfMonthKey = DateUtil.toKey(new Date(year, month, totalDays));
  const gridEndBase = DateUtil.startOfWeek(lastOfMonthKey, State.settings.firstDayOfWeek);
  const gridEnd = DateUtil.addDays(gridEndBase, 6);

  const cells = [];
  let cursor = gridStart;
  while (cursor <= gridEnd) {
    cells.push(cursor);
    cursor = DateUtil.addDays(cursor, 1);
  }

  const grid = document.getElementById('month-grid');
  grid.innerHTML = cells.map((dayKey) => {
    const d = DateUtil.fromKey(dayKey);
    const isOutside = d.getMonth() !== month;
    const list = TaskLogic.forDate(dayKey);
    const completion = TaskLogic.completionForList(list);
    const isToday = DateUtil.isToday(dayKey);
    const isSelected = dayKey === State.selectedMonthDayDate;
    const allDone = completion && completion.pct === 100;
    return `
      <button class="month-day-cell ${isOutside ? 'is-outside' : ''} ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''} ${allDone ? 'has-all-done' : ''}" data-day="${dayKey}" type="button">
        <span>${d.getDate()}</span>
        ${list.length ? '<span class="month-day-dot"></span>' : ''}
      </button>`;
  }).join('');

  const dayTasksEl = document.getElementById('month-day-tasks');
  if (State.selectedMonthDayDate) {
    const list = TaskLogic.forDate(State.selectedMonthDayDate);
    dayTasksEl.innerHTML = `<p class="task-group-title">${DateUtil.formatFriendly(State.selectedMonthDayDate)}</p>`;
    const wrap = document.createElement('div');
    wrap.className = 'task-list';
    wrap.innerHTML = list.length
      ? Object.values(groupTasksForDisplay(list)).flat().map(buildTaskCardHTML).join('')
      : `<p class="settings-note">No tasks this day.</p>`;
    dayTasksEl.appendChild(wrap);
  } else {
    dayTasksEl.innerHTML = '';
  }
}

function renderYearView() {
  const year = DateUtil.fromKey(State.plannerYearDate).getFullYear();
  document.getElementById('year-view-label').textContent = String(year);

  const grid = document.getElementById('year-grid');
  grid.innerHTML = DateUtil.MONTH_NAMES.map((name, monthIdx) => {
    const daysCount = DateUtil.daysInMonth(year, monthIdx);
    let total = 0, done = 0;
    const heatCells = [];
    for (let day = 1; day <= daysCount; day++) {
      const key = DateUtil.toKey(new Date(year, monthIdx, day));
      const list = TaskLogic.forDate(key);
      total += list.length;
      done += list.filter((t) => t.completed).length;
      const c = TaskLogic.completionForList(list);
      const intensity = !c ? 0 : c.pct;
      heatCells.push(`<div class="year-heat-cell" style="background:${heatColor(intensity)}"></div>`);
    }
    const pct = total ? Math.round((done / total) * 100) : null;
    return `
      <div class="year-month-card" data-month="${monthIdx}" role="button" tabindex="0">
        <div class="year-month-head">
          <h3>${name}</h3>
          <span class="year-month-pct">${pct === null ? '—' : pct + '%'}</span>
        </div>
        <div class="year-heat-row">${heatCells.join('')}</div>
        <div class="year-month-meta">
          <span>${total} tasks</span>
          <span>${done} done</span>
          <span>${total - done} pending</span>
        </div>
      </div>`;
  }).join('');
}

function heatColor(intensity) {
  if (intensity === 0) return 'var(--neutral-priority-bg)';
  const alpha = 0.25 + (intensity / 100) * 0.75;
  return `rgba(91, 79, 233, ${alpha.toFixed(2)})`;
}

function renderPlannerScreen() {
  if (State.plannerView === 'day') renderDayView();
  else if (State.plannerView === 'week') renderWeekView();
  else if (State.plannerView === 'month') renderMonthView();
  else if (State.plannerView === 'year') renderYearView();
}

/* ============================================================================
   SHOPPING SCREEN
   ============================================================================ */
function isWithinDays(isoString, days) {
  if (!isoString) return false;
  const then = new Date(isoString).getTime();
  return Date.now() - then <= days * 24 * 60 * 60 * 1000;
}

function renderBuyScreen() {
  const pending = State.shopping.filter((s) => !s.purchased);
  const purchased = State.shopping.filter((s) => s.purchased).sort((a, b) => (b.purchasedAt || '').localeCompare(a.purchasedAt || ''));

  const boughtThisWeek = purchased.filter((s) => isWithinDays(s.purchasedAt, 7)).length;
  const boughtThisMonth = purchased.filter((s) => isWithinDays(s.purchasedAt, 30)).length;

  document.getElementById('shopping-stats-row').innerHTML = `
    <div class="shopping-stat-card"><div class="shopping-stat-num">🛒 ${pending.length}</div><div class="shopping-stat-label">Pending</div></div>
    <div class="shopping-stat-card"><div class="shopping-stat-num">${boughtThisWeek}</div><div class="shopping-stat-label">Bought This Week</div></div>
    <div class="shopping-stat-card"><div class="shopping-stat-num">${boughtThisMonth}</div><div class="shopping-stat-label">Bought This Month</div></div>
  `;

  const list = State.shoppingTab === 'pending' ? pending : purchased;
  const listEl = document.getElementById('shopping-list');
  const emptyEl = document.getElementById('shopping-empty-state');
  const clearBtn = document.getElementById('clear-purchased-btn');

  clearBtn.hidden = !(State.shoppingTab === 'purchased' && purchased.length > 0);

  if (list.length === 0) {
    listEl.innerHTML = '';
    listEl.hidden = true;
    emptyEl.hidden = false;
    if (State.shoppingTab === 'purchased') {
      emptyEl.querySelector('h3').textContent = 'Nothing purchased yet';
      emptyEl.querySelector('p').textContent = 'Items you mark as bought will show up here.';
      emptyEl.querySelector('button').hidden = true;
    } else {
      emptyEl.querySelector('h3').textContent = 'Your shopping list is empty';
      emptyEl.querySelector('p').textContent = 'Add something you need to pick up.';
      emptyEl.querySelector('button').hidden = false;
    }
  } else {
    emptyEl.hidden = true;
    listEl.hidden = false;
    listEl.innerHTML = list.map((item) => `
      <div class="shopping-item-card ${item.purchased ? 'is-purchased' : ''}" data-shop-id="${item.id}">
        <button class="task-checkbox" data-action="toggle-shopping" aria-label="${item.purchased ? 'Mark as not bought' : 'Mark as bought'}">${item.purchased ? '✓' : ''}</button>
        <div class="shopping-item-body">
          <div class="shopping-item-name">${escapeHTML(item.itemName)}${item.quantity ? ' — ' + escapeHTML(item.quantity) : ''}</div>
          <div class="shopping-item-meta">${SHOP_CATEGORY_LABELS[item.category] || 'Other'}${item.purchased && item.purchasedAt ? ' · Bought ' + new Date(item.purchasedAt).toLocaleDateString() : ''}</div>
        </div>
      </div>`).join('');
  }
}

/* ============================================================================
   STATS SCREEN
   ============================================================================ */
function pctOrNull(list) {
  const c = TaskLogic.completionForList(list);
  return c ? c.pct : null;
}

function renderStatsScreen() {
  const todayKey = DateUtil.todayKey();
  const weekStart = DateUtil.startOfWeek(todayKey, State.settings.firstDayOfWeek);
  const weekDays = Array.from({ length: 7 }, (_, i) => DateUtil.addDays(weekStart, i));
  const monthAnchor = DateUtil.fromKey(todayKey);
  const monthDays = Array.from(
    { length: DateUtil.daysInMonth(monthAnchor.getFullYear(), monthAnchor.getMonth()) },
    (_, i) => DateUtil.toKey(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), i + 1))
  );

  const todayTasks = TaskLogic.forDate(todayKey);
  const weekTasks = weekDays.flatMap((d) => TaskLogic.forDate(d));
  const monthTasks = monthDays.flatMap((d) => TaskLogic.forDate(d));

  const todayPct = pctOrNull(todayTasks);
  const weekPct = pctOrNull(weekTasks);
  const monthPct = pctOrNull(monthTasks);

  document.getElementById('stats-summary-grid').innerHTML = `
    <div class="stats-summary-card"><div class="stats-summary-pct">${todayPct === null ? '—' : todayPct + '%'}</div><div class="stats-summary-label">Today</div></div>
    <div class="stats-summary-card"><div class="stats-summary-pct">${weekPct === null ? '—' : weekPct + '%'}</div><div class="stats-summary-label">This Week</div></div>
    <div class="stats-summary-card"><div class="stats-summary-pct">${monthPct === null ? '—' : monthPct + '%'}</div><div class="stats-summary-label">This Month</div></div>
  `;

  // Weekly bar chart
  const barChart = document.getElementById('weekly-bar-chart');
  barChart.innerHTML = weekDays.map((dayKey) => {
    const d = DateUtil.fromKey(dayKey);
    const list = TaskLogic.forDate(dayKey);
    const c = TaskLogic.completionForList(list);
    const pct = c ? c.pct : 0;
    return `
      <div class="bar-col">
        <span class="bar-value">${c ? pct + '%' : ''}</span>
        <div class="bar-track"><div class="bar-fill" style="height:${pct}%"></div></div>
        <span class="bar-label">${DateUtil.WEEKDAY_SHORT[d.getDay()][0]}</span>
      </div>`;
  }).join('');

  // Metrics: streak + best day
  const streak = computeStreak();
  const bestDay = computeBestDay();

  const completedTotal = State.tasks.filter((t) => t.completed).length;
  const pendingTotal = State.tasks.filter((t) => !t.completed).length;
  const carriedTotal = State.tasks.filter((t) => t.carriedForward && !t.completed).length;
  const overdueTotal = State.tasks.filter((t) => TaskLogic.isOverdue(t)).length;
  const shoppingPurchased = State.shopping.filter((s) => s.purchased).length;

  document.getElementById('stats-metrics-row').innerHTML = `
    <div class="metric-card"><div class="metric-emoji">🔥</div><div class="metric-value">${streak} Day${streak === 1 ? '' : 's'}</div><div class="metric-label">Current Streak</div></div>
    <div class="metric-card"><div class="metric-emoji">🏆</div><div class="metric-value">${bestDay ? bestDay.label : '—'}</div><div class="metric-label">Best Day</div></div>
    <div class="metric-card"><div class="metric-emoji">✅</div><div class="metric-value">${completedTotal}</div><div class="metric-label">Tasks Completed</div></div>
    <div class="metric-card"><div class="metric-emoji">⏳</div><div class="metric-value">${pendingTotal}</div><div class="metric-label">Tasks Pending</div></div>
    <div class="metric-card"><div class="metric-emoji">🔄</div><div class="metric-value">${carriedTotal}</div><div class="metric-label">Carried Forward</div></div>
    <div class="metric-card"><div class="metric-emoji">⚠️</div><div class="metric-value">${overdueTotal}</div><div class="metric-label">Overdue</div></div>
    <div class="metric-card"><div class="metric-emoji">🛍️</div><div class="metric-value">${shoppingPurchased}</div><div class="metric-label">Items Purchased</div></div>
  `;

  renderInsights({ todayTasks, weekPct, todayPct, overdueTotal, bestDay });
}

function computeStreak() {
  // Count consecutive days ending yesterday/today where all tasks for that day were completed.
  let streak = 0;
  let cursor = DateUtil.todayKey();
  // If today has tasks and isn't fully done yet, start checking from yesterday instead,
  // but still count today if it's already 100%.
  const todayList = TaskLogic.forDate(cursor);
  const todayComplete = todayList.length > 0 && todayList.every((t) => t.completed);
  if (!todayComplete) cursor = DateUtil.addDays(cursor, -1);

  for (let i = 0; i < 365; i++) {
    const list = TaskLogic.forDate(cursor);
    if (list.length === 0) break; // no data = streak boundary
    const allDone = list.every((t) => t.completed);
    if (!allDone) break;
    streak += 1;
    cursor = DateUtil.addDays(cursor, -1);
  }
  return streak;
}

function computeBestDay() {
  // Best weekday by average completion % across all historical data.
  const buckets = Array.from({ length: 7 }, () => ({ sum: 0, count: 0 }));
  const byDate = {};
  State.tasks.forEach((t) => {
    if (!t.date) return;
    (byDate[t.date] = byDate[t.date] || []).push(t);
  });
  Object.entries(byDate).forEach(([dateKey, list]) => {
    const c = TaskLogic.completionForList(list);
    if (!c) return;
    const dow = DateUtil.fromKey(dateKey).getDay();
    buckets[dow].sum += c.pct;
    buckets[dow].count += 1;
  });
  let best = null;
  buckets.forEach((b, dow) => {
    if (b.count === 0) return;
    const avg = b.sum / b.count;
    if (!best || avg > best.avg) best = { dow, avg };
  });
  if (!best) return null;
  const dowName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][best.dow];
  return { label: `${dowName} — ${Math.round(best.avg)}%`, dow: best.dow };
}

function renderInsights({ weekPct, todayTasks, overdueTotal, bestDay }) {
  const list = document.getElementById('insights-list');
  const insights = [];

  const completedToday = todayTasks.filter((t) => t.completed).length;
  if (todayTasks.length > 0) {
    insights.push(`You completed ${completedToday} task${completedToday === 1 ? '' : 's'} today.`);
  }
  if (overdueTotal > 0) {
    insights.push(`You have ${overdueTotal} overdue task${overdueTotal === 1 ? '' : 's'}.`);
  }
  if (bestDay) {
    insights.push(`Your most productive day is ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][bestDay.dow]}.`);
  }

  // Week-over-week comparison, only if we have enough data for both weeks.
  const thisWeekStart = DateUtil.startOfWeek(DateUtil.todayKey(), State.settings.firstDayOfWeek);
  const lastWeekStart = DateUtil.addDays(thisWeekStart, -7);
  const lastWeekDays = Array.from({ length: 7 }, (_, i) => DateUtil.addDays(lastWeekStart, i));
  const lastWeekTasks = lastWeekDays.flatMap((d) => TaskLogic.forDate(d));
  const lastWeekPct = pctOrNull(lastWeekTasks);
  if (weekPct !== null && lastWeekPct !== null) {
    const diff = weekPct - lastWeekPct;
    if (Math.abs(diff) >= 3) {
      insights.push(`You're ${Math.abs(diff)}% ${diff > 0 ? 'more' : 'less'} productive than last week.`);
    }
  }

  if (insights.length === 0) {
    insights.push("Add and complete a few tasks to start seeing insights here.");
  }

  list.innerHTML = insights.map((i) => `<li>${escapeHTML(i)}</li>`).join('');
}

/* ============================================================================
   NAVIGATION
   ============================================================================ */
function switchScreen(screenName) {
  State.currentScreen = screenName;
  document.querySelectorAll('.screen').forEach((el) => {
    el.hidden = el.dataset.screen !== screenName;
  });
  document.querySelectorAll('.nav-item[data-screen]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.screen === screenName);
  });
  renderCurrentScreen();
  const mainEl = document.getElementById('main-content');
  if (typeof mainEl.scrollTo === 'function') {
    mainEl.scrollTo({ top: 0, behavior: 'auto' });
  } else {
    mainEl.scrollTop = 0;
  }
}

function renderCurrentScreen() {
  switch (State.currentScreen) {
    case 'today': renderTodayScreen(); break;
    case 'planner': renderPlannerScreen(); break;
    case 'buy': renderBuyScreen(); break;
    case 'stats': renderStatsScreen(); break;
    case 'more': renderMoreScreenState(); break;
  }
}

function renderMoreScreenState() {
  document.querySelectorAll('#theme-segmented button').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.theme === State.settings.theme);
  });
  document.getElementById('animations-toggle').checked = State.settings.animationsEnabled;
  document.getElementById('notifications-toggle').checked = State.settings.notificationsEnabled;
  document.getElementById('carry-forward-toggle').checked = State.settings.autoCarryForward;
  document.getElementById('default-reminder-select').value = State.settings.defaultReminder;
  document.getElementById('first-day-select').value = State.settings.firstDayOfWeek;

  const note = document.getElementById('notifications-support-note');
  if (!Notifications.isSupported()) {
    note.textContent = 'This browser does not support notifications.';
  } else if (Notifications.permission() === 'denied') {
    note.textContent = 'Notifications are blocked in your browser settings.';
  } else {
    note.textContent = 'Reminders only fire while Hari\'s Cura is open in a tab or running as an installed app — there is no background push in this offline-first version.';
  }
}

/* ============================================================================
   INIT & DATA LOAD
   ============================================================================ */
async function loadAllData() {
  State.tasks = await DB.Tasks.getAll();
  State.shopping = await DB.Shopping.getAll();
  State.settings = await DB.Settings.getAll();
}

async function init() 

/**
 * Asks the browser to flag this site's storage as "persistent," which
 * protects IndexedDB from automatic eviction under low-disk-space pressure
 * (this is the main way phones silently clear web app data). This is a
 * request, not a guarantee — browsers decide based on factors like how
 * often you use the site (installed PWAs and frequently visited sites are
 * far more likely to be granted persistence). Regular backups (More > Data)
 * remain the only fully reliable protection.
 */
async function setupPersistentStorage() {
  const note = document.getElementById('storage-persist-note');
  if (!(navigator.storage && navigator.storage.persist)) {
    if (note) note.textContent = "Persistent storage isn't supported in this browser — regular backups are recommended.";
    return;
  }
  try {
    let granted = await navigator.storage.persisted();
    if (!granted) {
      granted = await navigator.storage.persist();
    }
    if (note) {
      note.textContent = granted
        ? '✅ Persistent storage is enabled — your browser will avoid automatically clearing this data under low storage.'
        : "Persistent storage wasn't granted by your browser. Your data could still be cleared automatically under low storage — regular backups are recommended.";
    }
  } catch (e) {
    console.warn('Persistent storage request failed', e);
    if (note) note.textContent = 'Could not determine storage protection status.';
  }
}
{
  await loadAllData();
  applyTheme();
  applyAnimationSetting();

  if (!State.settings.onboarded) {
    await seedSampleData();
    await loadAllData();
    showWelcomeScreen();
  } else {
    showAppShell();
  }

  const movedCount = await TaskLogic.runAutoCarryForward();
  if (movedCount > 0) await loadAllData();

  Notifications.scheduleAll(State.tasks, State.settings);

  setupEventListeners();
  renderCurrentScreen();
  setupPersistentStorage();
  setInterval(() => {
    // Re-check carry-forward and refresh greeting when the date rolls over.
    if (State.currentScreen === 'today') updateGreeting();
  }, 60000);
}

async function seedSampleData() {
  const existing = await DB.Tasks.getAll();
  if (existing.length > 0) return; // never overwrite real data
  const todayKey = DateUtil.todayKey();
  const now = new Date().toISOString();
  const sample = [
    { title: 'Morning walk', time: '07:00', category: 'health', priority: 'low' },
    { title: 'Pay electricity bill', time: '10:00', category: 'finance', priority: 'high' },
    { title: 'Call insurance company', time: '14:30', category: 'personal', priority: 'medium' },
    { title: 'Buy groceries', time: '18:00', category: 'shopping', priority: 'medium' },
    { title: 'Review investments', time: '20:00', category: 'finance', priority: 'low' },
  ];
  for (const s of sample) {
    await DB.Tasks.save({
      id: DB.Tasks.newId(),
      title: s.title,
      description: '',
      date: todayKey,
      time: s.time,
      completed: false,
      completedAt: null,
      priority: s.priority,
      category: s.category,
      reminder: 'none',
      reminderCustomMinutes: null,
      recurring: false,
      recurringType: 'none',
      notes: '',
      createdAt: now,
      updatedAt: now,
      carriedForward: false,
      originalDate: null,
      carryForwardEnabled: true,
      isSample: true,
    });
  }
}

function showWelcomeScreen() {
  document.getElementById('welcome-screen').hidden = false;
  document.getElementById('app-shell').hidden = true;
}

function showAppShell() {
  document.getElementById('welcome-screen').hidden = true;
  document.getElementById('app-shell').hidden = false;
}

document.addEventListener('DOMContentLoaded', init);

/* ============================================================================
   THEME & ANIMATIONS
   ============================================================================ */
function applyTheme() {
  const theme = State.settings.theme;
  let resolved = theme;
  if (theme === 'system') {
    resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', resolved);
  const themeColorMeta = document.querySelector('meta[name="theme-color"]:not([media])');
  const color = resolved === 'dark' ? '#14151C' : '#4F46E5';
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => { if (!m.media) m.setAttribute('content', color); });
}

function applyAnimationSetting() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.body.classList.toggle('no-animations', !State.settings.animationsEnabled || reduceMotion);
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (State.settings.theme === 'system') applyTheme();
});

/* ============================================================================
   TASK MODAL (Add / Edit)
   ============================================================================ */
const TaskModal = {
  overlay: null,
  init() {
    this.overlay = document.getElementById('task-modal-overlay');
  },
  openForCreate(prefillDate) {
    State.editingTaskId = null;
    document.getElementById('task-modal-title').textContent = 'Add Task';
    document.getElementById('task-edit-only-actions').hidden = true;
    document.getElementById('task-delete-btn').hidden = false;
    this.resetForm();
    document.getElementById('task-date-field').value = prefillDate || DateUtil.todayKey();
    document.getElementById('task-reminder-field').value = State.settings.defaultReminder;
    this.setPriority('medium');
    this.show();
  },
  openForEdit(task) {
    State.editingTaskId = task.id;
    document.getElementById('task-modal-title').textContent = 'Edit Task';
    document.getElementById('task-edit-only-actions').hidden = false;
    this.resetForm();

    document.getElementById('task-id-field').value = task.id;
    document.getElementById('task-title-field').value = task.title || '';
    document.getElementById('task-desc-field').value = task.description || '';
    document.getElementById('task-date-field').value = task.date || DateUtil.todayKey();
    document.getElementById('task-time-field').value = task.time || '';
    this.setPriority(task.priority || 'medium');

    const catSelect = document.getElementById('task-category-field');
    if ([...catSelect.options].some((o) => o.value === task.category)) {
      catSelect.value = task.category;
    } else if (task.category) {
      addCustomCategoryOption(task.category);
      catSelect.value = task.category;
    }

    document.getElementById('task-reminder-field').value = task.reminder || 'none';
    toggleCustomReminderField();
    document.getElementById('task-reminder-custom-field').value = task.reminderCustomMinutes || '';

    document.getElementById('task-repeat-field').value = task.recurringType || 'none';
    document.getElementById('task-carry-forward-field').checked = task.carryForwardEnabled !== false;
    document.getElementById('task-notes-field').value = task.notes || '';

    this.show();
  },
  resetForm() {
    const form = document.getElementById('task-form');
    form.reset();
    document.getElementById('task-id-field').value = '';
    document.getElementById('task-title-error').hidden = true;
    document.getElementById('task-custom-category-field').hidden = true;
    document.getElementById('task-reminder-custom-field').hidden = true;
    document.getElementById('task-carry-forward-field').checked = true;
  },
  setPriority(value) {
    document.querySelectorAll('#task-priority-field button').forEach((b) => {
      b.classList.toggle('is-active', b.dataset.value === value);
    });
  },
  getPriority() {
    const active = document.querySelector('#task-priority-field button.is-active');
    return active ? active.dataset.value : 'medium';
  },
  show() {
    this.overlay.hidden = false;
    setTimeout(() => document.getElementById('task-title-field').focus(), 50);
  },
  hide() {
    this.overlay.hidden = true;
  },
};

function addCustomCategoryOption(catValue) {
  const select = document.getElementById('task-category-field');
  if ([...select.options].some((o) => o.value === catValue)) return;
  const opt = document.createElement('option');
  opt.value = catValue;
  opt.textContent = categoryLabel(catValue);
  select.insertBefore(opt, select.querySelector('option[value="__custom__"]'));
  if (!State.customCategories.includes(catValue)) State.customCategories.push(catValue);
}

function toggleCustomReminderField() {
  const val = document.getElementById('task-reminder-field').value;
  document.getElementById('task-reminder-custom-field').hidden = val !== 'custom';
}

async function handleTaskFormSubmit(e) {
  e.preventDefault();
  const titleField = document.getElementById('task-title-field');
  const title = titleField.value.trim();
  if (!title) {
    document.getElementById('task-title-error').hidden = false;
    titleField.focus();
    return;
  }
  document.getElementById('task-title-error').hidden = true;

  let category = document.getElementById('task-category-field').value;
  if (category === '__custom__') {
    const custom = document.getElementById('task-custom-category-field').value.trim();
    if (custom) {
      category = custom.toLowerCase().replace(/\s+/g, '-');
      addCustomCategoryOption(category);
    } else {
      category = 'other';
    }
  }

  const reminder = document.getElementById('task-reminder-field').value;
  const reminderCustomMinutes = reminder === 'custom'
    ? parseInt(document.getElementById('task-reminder-custom-field').value, 10) || 30
    : null;

  const repeat = document.getElementById('task-repeat-field').value;
  const now = new Date().toISOString();
  const editingId = document.getElementById('task-id-field').value;

  const existing = editingId ? State.tasks.find((t) => t.id === editingId) : null;

  const task = {
    id: editingId || DB.Tasks.newId(),
    title,
    description: document.getElementById('task-desc-field').value.trim(),
    date: document.getElementById('task-date-field').value || DateUtil.todayKey(),
    time: document.getElementById('task-time-field').value || '',
    completed: existing ? existing.completed : false,
    completedAt: existing ? existing.completedAt : null,
    priority: TaskModal.getPriority(),
    category,
    reminder,
    reminderCustomMinutes,
    recurring: repeat !== 'none',
    recurringType: repeat,
    notes: document.getElementById('task-notes-field').value.trim(),
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now,
    carriedForward: existing ? existing.carriedForward : false,
    originalDate: existing ? existing.originalDate : null,
    carryForwardEnabled: document.getElementById('task-carry-forward-field').checked,
    isSample: existing ? existing.isSample : false,
  };

  await DB.Tasks.save(task);
  await DB.Settings.set('onboarded', true);

  const idx = State.tasks.findIndex((t) => t.id === task.id);
  if (idx >= 0) State.tasks[idx] = task; else State.tasks.push(task);

  Notifications.schedule(task, State.settings);
  TaskModal.hide();
  Toast.show(editingId ? 'Changes saved' : 'Task added successfully');
  renderCurrentScreen();
}

async function handleToggleTaskComplete(taskId, cardEl) {
  const task = State.tasks.find((t) => t.id === taskId);
  if (!task) return;
  task.completed = !task.completed;
  task.completedAt = task.completed ? new Date().toISOString() : null;
  task.updatedAt = new Date().toISOString();
  if (task.completed) task.carriedForward = false; // completed tasks never carry forward again

  await DB.Tasks.save(task);
  Notifications.cancel(task.id);

  if (task.completed) {
    await TaskLogic.spawnNextOccurrenceIfNeeded(task);
    if (cardEl) cardEl.classList.add('is-completed');
    Toast.show('Task completed 🎉');
  } else {
    Toast.show('Task marked pending');
  }
  renderCurrentScreen();
}

async function handleDeleteTask(taskId) {
  const confirmed = await Confirm.ask('Delete this task?', 'This will permanently remove the task. This action cannot be undone.');
  if (!confirmed) return;
  await DB.Tasks.remove(taskId);
  Notifications.cancel(taskId);
  State.tasks = State.tasks.filter((t) => t.id !== taskId);
  TaskModal.hide();
  Toast.show('Task deleted');
  renderCurrentScreen();
}

/* ---------------------------- Move task modal ---------------------------- */
const MoveModal = {
  overlay: null,
  taskId: null,
  init() { this.overlay = document.getElementById('move-modal-overlay'); },
  open(taskId) {
    this.taskId = taskId;
    document.getElementById('move-custom-date-field').value = '';
    this.overlay.hidden = false;
  },
  hide() { this.overlay.hidden = true; },
  async moveTo(dateKey) {
    const task = State.tasks.find((t) => t.id === this.taskId);
    if (!task || !dateKey) return;
    task.date = dateKey;
    task.updatedAt = new Date().toISOString();
    // A manual move clears the "carried forward" badge since the user has now taken control of it.
    task.carriedForward = false;
    await DB.Tasks.save(task);
    Notifications.schedule(task, State.settings);
    this.hide();
    TaskModal.hide();
    Toast.show(`Task moved to ${DateUtil.formatShort(dateKey)}`);
    renderCurrentScreen();
  },
};

/* ============================================================================
   SHOPPING MODAL
   ============================================================================ */
const ShoppingModal = {
  overlay: null,
  init() { this.overlay = document.getElementById('shopping-modal-overlay'); },
  openForCreate() {
    State.editingShoppingId = null;
    document.getElementById('shopping-modal-title').textContent = 'Add Item';
    document.getElementById('shopping-edit-only-actions').hidden = true;
    document.getElementById('shopping-form').reset();
    document.getElementById('shopping-id-field').value = '';
    document.getElementById('shopping-item-error').hidden = true;
    this.show();
  },
  openForEdit(item) {
    State.editingShoppingId = item.id;
    document.getElementById('shopping-modal-title').textContent = 'Edit Item';
    document.getElementById('shopping-edit-only-actions').hidden = false;
    document.getElementById('shopping-id-field').value = item.id;
    document.getElementById('shopping-item-field').value = item.itemName || '';
    document.getElementById('shopping-qty-field').value = item.quantity || '';
    document.getElementById('shopping-category-field').value = item.category || 'grocery';
    document.getElementById('shopping-notes-field').value = item.notes || '';
    document.getElementById('shopping-item-error').hidden = true;
    this.show();
  },
  show() { this.overlay.hidden = false; setTimeout(() => document.getElementById('shopping-item-field').focus(), 50); },
  hide() { this.overlay.hidden = true; },
};

async function handleShoppingFormSubmit(e) {
  e.preventDefault();
  const nameField = document.getElementById('shopping-item-field');
  const itemName = nameField.value.trim();
  if (!itemName) {
    document.getElementById('shopping-item-error').hidden = false;
    nameField.focus();
    return;
  }
  document.getElementById('shopping-item-error').hidden = true;

  const editingId = document.getElementById('shopping-id-field').value;
  const existing = editingId ? State.shopping.find((s) => s.id === editingId) : null;
  const now = new Date().toISOString();

  const item = {
    id: editingId || DB.Shopping.newId(),
    itemName,
    quantity: document.getElementById('shopping-qty-field').value.trim(),
    category: document.getElementById('shopping-category-field').value,
    purchased: existing ? existing.purchased : false,
    purchasedAt: existing ? existing.purchasedAt : null,
    createdAt: existing ? existing.createdAt : now,
    notes: document.getElementById('shopping-notes-field').value.trim(),
  };

  await DB.Shopping.save(item);
  const idx = State.shopping.findIndex((s) => s.id === item.id);
  if (idx >= 0) State.shopping[idx] = item; else State.shopping.push(item);

  ShoppingModal.hide();
  Toast.show(editingId ? 'Changes saved' : 'Item added to your list');
  renderCurrentScreen();
}

async function handleToggleShoppingItem(itemId) {
  const item = State.shopping.find((s) => s.id === itemId);
  if (!item) return;
  item.purchased = !item.purchased;
  item.purchasedAt = item.purchased ? new Date().toISOString() : null;
  await DB.Shopping.save(item);
  Toast.show(item.purchased ? 'Item marked as bought' : 'Moved back to pending');
  renderCurrentScreen();
}

async function handleDeleteShoppingItem(itemId) {
  const confirmed = await Confirm.ask('Delete this item?', 'This will remove it from your shopping list.');
  if (!confirmed) return;
  await DB.Shopping.remove(itemId);
  State.shopping = State.shopping.filter((s) => s.id !== itemId);
  ShoppingModal.hide();
  Toast.show('Item deleted');
  renderCurrentScreen();
}

async function handleClearPurchased() {
  const confirmed = await Confirm.ask('Clear purchased items?', 'All purchased items will be permanently removed from your list.');
  if (!confirmed) return;
  const purchasedItems = State.shopping.filter((s) => s.purchased);
  for (const item of purchasedItems) {
    await DB.Shopping.remove(item.id);
  }
  State.shopping = State.shopping.filter((s) => !s.purchased);
  Toast.show('Purchased items cleared');
  renderCurrentScreen();
}

/* ============================================================================
   SEARCH
   ============================================================================ */
function performSearch(query) {
  const q = query.trim().toLowerCase();
  const resultsEl = document.getElementById('search-results');
  const emptyEl = document.getElementById('search-empty');
  if (!q) {
    resultsEl.innerHTML = '';
    resultsEl.hidden = true;
    emptyEl.hidden = true;
    return;
  }
  const matches = State.tasks.filter((t) =>
    (t.title || '').toLowerCase().includes(q) ||
    (t.notes || '').toLowerCase().includes(q) ||
    (t.description || '').toLowerCase().includes(q) ||
    categoryLabel(t.category).toLowerCase().includes(q)
  ).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  if (matches.length === 0) {
    resultsEl.innerHTML = '';
    resultsEl.hidden = true;
    emptyEl.hidden = false;
  } else {
    emptyEl.hidden = true;
    resultsEl.hidden = false;
    const wrap = document.createElement('div');
    wrap.className = 'task-list';
    wrap.innerHTML = matches.map(buildTaskCardHTML).join('');
    resultsEl.innerHTML = '';
    resultsEl.appendChild(wrap);
  }
}

/* ============================================================================
   DATA EXPORT / IMPORT / CLEAR
   ============================================================================ */
function downloadJSON(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function handleExportOrBackup() {
  const payload = await DB.exportAllData();
  const stamp = DateUtil.todayKey();
  downloadJSON(payload, `haris-cura-backup-${stamp}.json`);
  Toast.show('Backup downloaded');
}

function handleImportOrRestoreClick() {
  document.getElementById('import-file-input').click();
}

async function handleImportFileChosen(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    const confirmed = await Confirm.ask('Restore this backup?', 'This will replace your current tasks and shopping list with the contents of this file.');
    if (!confirmed) return;
    await DB.importAllData(payload);
    await loadAllData();
    applyTheme();
    applyAnimationSetting();
    Notifications.scheduleAll(State.tasks, State.settings);
    Toast.show('Data restored successfully');
    renderCurrentScreen();
  } catch (err) {
    console.error('Import failed', err);
    Toast.show('Could not read that backup file');
  }
}

async function handleClearAllData() {
  const confirmed = await Confirm.ask('Clear all data?', 'This will permanently delete every task and shopping item on this device. This cannot be undone.');
  if (!confirmed) return;
  await DB.clearAllData();
  State.tasks = [];
  State.shopping = [];
  Notifications.scheduleAll([], State.settings);
  Toast.show('All data cleared');
  renderCurrentScreen();
}

/* ============================================================================
   PWA INSTALL PROMPT
   ============================================================================ */
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  State.deferredInstallPrompt = e;
  if (!State.settings.installPromptDismissed) {
    document.getElementById('install-banner').hidden = false;
  }
});

window.addEventListener('appinstalled', () => {
  document.getElementById('install-banner').hidden = true;
  Toast.show("Hari's Cura installed");
});

function setupInstallBannerHandlers() {
  document.getElementById('install-accept-btn').addEventListener('click', async () => {
    const promptEvent = State.deferredInstallPrompt;
    document.getElementById('install-banner').hidden = true;
    if (!promptEvent) ret
       
     
     
     
     urn;
    promptEvent.prompt();
    await promptEvent.userChoice;
    State.deferredInstallPrompt = null;
  });
  document.getElementById('install-dismiss-btn').addEventListener('click', async () => {
    document.getElementById('install-banner').hidden = true;
    await DB.Settings.set('installPromptDismissed', true);
    State.settings.installPromptDismissed = true;
  });
}

/* ============================================================================
   EVENT WIRING
   ============================================================================ */
function setupEventListeners() {
  TaskModal.init();
  MoveModal.init();
  ShoppingModal.init();
  setupInstallBannerHandlers();

  // Welcome screen
  document.getElementById('welcome-start-btn').addEventListener('click', async () => {
    await DB.Settings.set('onboarded', true);
    State.settings.onboarded = true;
    showAppShell();
    renderCurrentScreen();
  });

  // Navigation (both sidebar and bottom nav share [data-screen] buttons)
  document.querySelectorAll('[data-screen]').forEach((btn) => {
    btn.addEventListener('click', () => switchScreen(btn.dataset.screen));
  });

  // Add-task entry points
  ['fab-add-btn', 'sidebar-add-btn'].forEach((id) => {
    document.getElementById(id).addEventListener('click', () => TaskModal.openForCreate(defaultAddDate()));
  });
  document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="open-add-task"]');
    if (btn) TaskModal.openForCreate(defaultAddDate());
    const shopBtn = e.target.closest('[data-action="open-add-shopping"]');
    if (shopBtn) ShoppingModal.openForCreate();
  });

  // Today filter chips
  document.getElementById('today-filter-bar').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    document.querySelectorAll('#today-filter-bar .chip').forEach((c) => c.classList.remove('is-active'));
    chip.classList.add('is-active');
    State.todayFilter = chip.dataset.filter;
    renderTodayScreen();
  });

  // Task card interactions (today, day view, week view, month view, search — all delegate)
  document.addEventListener('click', (e) => {
    const checkbox = e.target.closest('[data-action="toggle-task"]');
    if (checkbox) {
      e.stopPropagation();
      const card = checkbox.closest('.task-card');
      handleToggleTaskComplete(card.dataset.taskId, card);
      return;
    }
    const shopCheckbox = e.target.closest('[data-action="toggle-shopping"]');
    if (shopCheckbox) {
      e.stopPropagation();
      const card = shopCheckbox.closest('.shopping-item-card');
      handleToggleShoppingItem(card.dataset.shopId);
      return;
    }
    const taskCard = e.target.closest('.task-card');
    if (taskCard && taskCard.dataset.taskId) {
      const task = State.tasks.find((t) => t.id === taskCard.dataset.taskId);
      if (task) TaskModal.openForEdit(task);
      return;
    }
    const shopCard = e.target.closest('.shopping-item-card');
    if (shopCard && shopCard.dataset.shopId) {
      const item = State.shopping.find((s) => s.id === shopCard.dataset.shopId);
      if (item) ShoppingModal.openForEdit(item);
    }
  });

  // Task modal form
  document.getElementById('task-form').addEventListener('submit', handleTaskFormSubmit);
  document.getElementById('task-cancel-btn').addEventListener('click', () => TaskModal.hide());
  document.getElementById('task-modal-close-btn').addEventListener('click', () => TaskModal.hide());
  document.getElementById('task-modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'task-modal-overlay') TaskModal.hide();
  });
  document.getElementById('task-delete-btn').addEventListener('click', () => {
    handleDeleteTask(document.getElementById('task-id-field').value);
  });
  document.querySelectorAll('#task-priority-field button').forEach((b) => {
    b.addEventListener('click', () => TaskModal.setPriority(b.dataset.value));
  });
  document.getElementById('task-category-field').addEventListener('change', (e) => {
    document.getElementById('task-custom-category-field').hidden = e.target.value !== '__custom__';
    if (e.target.value === '__custom__') document.getElementById('task-custom-category-field').focus();
  });
  document.getElementById('task-reminder-field').addEventListener('change', toggleCustomReminderField);
  document.getElementById('task-move-btn').addEventListener('click', () => {
    MoveModal.open(document.getElementById('task-id-field').value);
  });

  // Move modal
  document.getElementById('move-modal-close-btn').addEventListener('click', () => MoveModal.hide());
  document.getElementById('move-modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'move-modal-overlay') MoveModal.hide();
  });
  document.getElementById('move-tomorrow-btn').addEventListener('click', () => {
    MoveModal.moveTo(DateUtil.addDays(DateUtil.todayKey(), 1));
  });
  document.getElementById('move-next-monday-btn').addEventListener('click', () => {
    MoveModal.moveTo(DateUtil.nextWeekday(DateUtil.todayKey(), 1));
  });
  document.getElementById('move-confirm-btn').addEventListener('click', () => {
    const val = document.getElementById('move-custom-date-field').value;
    if (!val) { Toast.show('Pick a date first'); return; }
    MoveModal.moveTo(val);
  });

  // Shopping modal
  document.getElementById('shopping-form').addEventListener('submit', handleShoppingFormSubmit);
  document.getElementById('shopping-cancel-btn').addEventListener('click', () => ShoppingModal.hide());
  document.getElementById('shopping-modal-close-btn').addEventListener('click', () => ShoppingModal.hide());
  document.getElementById('shopping-modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'shopping-modal-overlay') ShoppingModal.hide();
  });
  document.getElementById('shopping-delete-btn').addEventListener('click', () => {
    handleDeleteShoppingItem(document.getElementById('shopping-id-field').value);
  });

  // Shopping tabs + clear purchased
  document.querySelectorAll('[data-shop-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('[data-shop-tab]').forEach((t) => t.classList.remove('is-active'));
      tab.classList.add('is-active');
      State.shoppingTab = tab.dataset.shopTab;
      renderBuyScreen();
    });
  });
  document.getElementById('clear-purchased-btn').addEventListener('click', handleClearPurchased);

  // Planner tabs
  document.querySelectorAll('.tabs [role="tab"][data-view]').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tabs [role="tab"][data-view]').forEach((t) => t.classList.remove('is-active'));
      tab.classList.add('is-active');
      State.plannerView = tab.dataset.view;
      document.querySelectorAll('.planner-view').forEach((v) => { v.hidden = v.id !== `view-${State.plannerView}`; });
      renderPlannerScreen();
    });
  });

  // Day view nav
  document.getElementById('day-prev-btn').addEventListener('click', () => { State.plannerDayDate = DateUtil.addDays(State.plannerDayDate, -1); renderDayView(); });
  document.getElementById('day-next-btn').addEventListener('click', () => { State.plannerDayDate = DateUtil.addDays(State.plannerDayDate, 1); renderDayView(); });
  document.getElementById('day-today-btn').addEventListener('click', () => { State.plannerDayDate = DateUtil.todayKey(); renderDayView(); });

  // Week view nav
  document.getElementById('week-prev-btn').addEventListener('click', () => { State.plannerWeekDate = DateUtil.addDays(State.plannerWeekDate, -7); renderWeekView(); });
  document.getElementById('week-next-btn').addEventListener('click', () => { State.plannerWeekDate = DateUtil.addDays(State.plannerWeekDate, 7); renderWeekView(); });
  document.getElementById('week-today-btn').addEventListener('click', () => {
    State.plannerWeekDate = DateUtil.todayKey();
    State.selectedWeekDayDate = DateUtil.todayKey();
    renderWeekView();
  });
  document.getElementById('week-grid').addEventListener('click', (e) => {
    const cell = e.target.closest('.week-day-cell');
    if (!cell) return;
    State.selectedWeekDayDate = cell.dataset.day;
    renderWeekView();
  });

  // Month view nav
  document.getElementById('month-prev-btn').addEventListener('click', () => { State.plannerMonthDate = DateUtil.addMonths(State.plannerMonthDate, -1); renderMonthView(); });
  document.getElementById('month-next-btn').addEventListener('click', () => { State.plannerMonthDate = DateUtil.addMonths(State.plannerMonthDate, 1); renderMonthView(); });
  document.getElementById('month-today-btn').addEventListener('click', () => {
    State.plannerMonthDate = DateUtil.todayKey();
    State.selectedMonthDayDate = DateUtil.todayKey();
    renderMonthView();
  });
  document.getElementById('month-grid').addEventListener('click', (e) => {
    const cell = e.target.closest('.month-day-cell');
    if (!cell) return;
    State.selectedMonthDayDate = cell.dataset.day;
    renderMonthView();
  });

  // Year view nav
  document.getElementById('year-prev-btn').addEventListener('click', () => { State.plannerYearDate = DateUtil.addYears(State.plannerYearDate, -1); renderYearView(); });
  document.getElementById('year-next-btn').addEventListener('click', () => { State.plannerYearDate = DateUtil.addYears(State.plannerYearDate, 1); renderYearView(); });
  document.getElementById('year-grid').addEventListener('click', (e) => {
    const monthCard = e.target.closest('.year-month-card');
    if (!monthCard) return;
    const year = DateUtil.fromKey(State.plannerYearDate).getFullYear();
    const monthIdx = parseInt(monthCard.dataset.month, 10);
    State.plannerMonthDate = DateUtil.toKey(new Date(year, monthIdx, 1));
    State.plannerView = 'month';
    document.querySelectorAll('.tabs [role="tab"][data-view]').forEach((t) => t.classList.toggle('is-active', t.dataset.view === 'month'));
    document.querySelectorAll('.planner-view').forEach((v) => { v.hidden = v.id !== 'view-month'; });
    renderMonthView();
  });

  // Search
  document.getElementById('open-search-btn').addEventListener('click', () => {
    document.getElementById('search-overlay').hidden = false;
    document.getElementById('search-input').value = '';
    document.getElementById('search-results').innerHTML = '';
    document.getElementById('search-empty').hidden = true;
    setTimeout(() => document.getElementById('search-input').focus(), 50);
  });
  document.getElementById('search-close-btn').addEventListener('click', () => { document.getElementById('search-overlay').hidden = true; });
  document.getElementById('search-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'search-overlay') document.getElementById('search-overlay').hidden = true;
  });
  document.getElementById('search-input').addEventListener('input', (e) => performSearch(e.target.value));

  // Settings: theme
  document.getElementById('theme-segmented').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-theme]');
    if (!btn) return;
    State.settings.theme = btn.dataset.theme;
    await DB.Settings.set('theme', btn.dataset.theme);
    applyTheme();
    renderMoreScreenState();
  });

  // Settings: animations
  document.getElementById('animations-toggle').addEventListener('change', async (e) => {
    State.settings.animationsEnabled = e.target.checked;
    await DB.Settings.set('animationsEnabled', e.target.checked);
    applyAnimationSetting();
  });

  // Settings: notifications
  document.getElementById('notifications-toggle').addEventListener('change', async (e) => {
    const wantsOn = e.target.checked;
    if (wantsOn) {
      const result = await Notifications.requestPermission();
      if (result !== 'granted') {
        e.target.checked = false;
        Toast.show(result === 'unsupported' ? "Notifications aren't supported in this browser" : 'Notification permission was not granted');
        renderMoreScreenState();
        return;
      }
    }
    State.settings.notificationsEnabled = wantsOn;
    await DB.Settings.set('notificationsEnabled', wantsOn);
    Notifications.scheduleAll(State.tasks, State.settings);
    renderMoreScreenState();
    Toast.show('Changes saved');
  });

  // Settings: carry forward
  document.getElementById('carry-forward-toggle').addEventListener('change', async (e) => {
    State.settings.autoCarryForward = e.target.checked;
    await DB.Settings.set('autoCarryForward', e.target.checked);
    Toast.show('Changes saved');
  });

  // Settings: default reminder / first day
  document.getElementById('default-reminder-select').addEventListener('change', async (e) => {
    State.settings.defaultReminder = e.target.value;
    await DB.Settings.set('defaultReminder', e.target.value);
    Toast.show('Changes saved');
  });
  document.getElementById('first-day-select').addEventListener('change', async (e) => {
    State.settings.firstDayOfWeek = e.target.value;
    await DB.Settings.set('firstDayOfWeek', e.target.value);
    Toast.show('Changes saved');
    renderPlannerScreen();
  });

  // Data actions
  document.getElementById('export-data-btn').addEventListener('click', handleExportOrBackup);
  document.getElementById('backup-data-btn').addEventListener('click', handleExportOrBackup);
  document.getElementById('import-data-btn').addEventListener('click', handleImportOrRestoreClick);
  document.getElementById('restore-data-btn').addEventListener('click', handleImportOrRestoreClick);
  document.getElementById('import-file-input').addEventListener('change', handleImportFileChosen);
  document.getElementById('clear-all-data-btn').addEventListener('click', handleClearAllData);

  // Keyboard: close sheets with Escape
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!TaskModal.overlay.hidden) TaskModal.hide();
    if (!MoveModal.overlay.hidden) MoveModal.hide();
    if (!ShoppingModal.overlay.hidden) ShoppingModal.hide();
    const searchOverlay = document.getElementById('search-overlay');
    if (!searchOverlay.hidden) searchOverlay.hidden = true;
  });
}

function defaultAddDate() {
  if (State.currentScreen === 'planner') {
    if (State.plannerView === 'day') return State.plannerDayDate;
    if (State.plannerView === 'week') return State.selectedWeekDayDate;
    if (State.plannerView === 'month') return State.selectedMonthDayDate || DateUtil.todayKey();
  }
  return DateUtil.todayKey();
}

/* ============================================================================
   SERVICE WORKER REGISTRATION
   ============================================================================ */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch((err) => {
      console.warn('Service worker registration failed', err);
    });
  });
}

/* Expose select internals on window for debugging/support purposes only.
   The app itself never relies on these globals — everything above uses
   normal lexical scope. */
window.State = State;
window.DateUtil = DateUtil;
window.TaskLogic = TaskLogic;
window.TaskModal = TaskModal;
window.ShoppingModal = ShoppingModal;
window.MoveModal = MoveModal;
window.switchScreen = switchScreen;
window.renderPlannerScreen = renderPlannerScreen;
window.renderCurrentScreen = renderCurrentScreen;
window.handleToggleTaskComplete = handleToggleTaskComplete;
window.handleToggleShoppingItem = handleToggleShoppingItem;
window.performSearch = performSearch;
