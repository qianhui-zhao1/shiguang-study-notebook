(() => {
  "use strict";

  const STORAGE_KEY = "shiguang-study-notebook-v1";
  const SCHEMA_VERSION = 1;
  const priorityWeight = { high: 3, medium: 2, low: 1 };
  const priorityLabel = { high: "高优先", medium: "中优先", low: "低优先" };
  const viewMeta = {
    today: ["拾起今天的好时光", "今日学习"],
    plan: ["把想做的事轻轻写下", "学习计划"],
    progress: ["看见每一份安静的积累", "学习进度"],
    review: ["为今天留下一页", "学习复盘"],
    settings: ["调成适合自己的节奏", "个人设置"],
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const uid = () => {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    return `xj-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const dateKey = (value = new Date()) => {
    const d = value instanceof Date ? value : new Date(value);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  };

  const addDays = (key, amount) => {
    const d = new Date(`${key}T12:00:00`);
    d.setDate(d.getDate() + amount);
    return dateKey(d);
  };

  const humanDate = (key, options = {}) => {
    if (!key) return "未设置";
    return new Intl.DateTimeFormat("zh-CN", {
      month: "long",
      day: "numeric",
      weekday: options.weekday ? "short" : undefined,
    }).format(new Date(`${key}T12:00:00`));
  };

  const fullHumanDate = (key) => new Intl.DateTimeFormat("zh-CN", {
    year: "numeric", month: "long", day: "numeric", weekday: "long",
  }).format(new Date(`${key}T12:00:00`));

  const escapeHTML = (value = "") => String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const today = () => dateKey(new Date());

  function blankState() {
    return {
      version: SCHEMA_VERSION,
      settings: {
        name: "同学",
        semester: "2026—2027 第一学期",
        dailyGoal: 90,
        onboardingComplete: false,
      },
      courses: ["高等数学", "大学英语", "专业基础课"],
      tasks: [],
      checkins: [],
      reviews: [],
    };
  }

  function demoPayload() {
    const t = today();
    const taskRows = [
      ["整理高数第二章错题", "高等数学", -3, -2, "high", 45, true, 50],
      ["完成英语精读笔记", "大学英语", -2, -1, "medium", 35, true, 40],
      ["复习数据结构线性表", "专业基础课", -1, -1, "high", 60, true, 55],
      ["重做高数易错题 2 道", "高等数学", 0, 0, "high", 40, false, 0],
      ["背诵英语学术词汇 20 个", "大学英语", 0, 0, "medium", 25, false, 0],
      ["整理专业课课堂框架", "专业基础课", 0, 1, "medium", 45, false, 0],
      ["预习高数第三章例题", "高等数学", 1, 2, "low", 30, false, 0],
      ["完成英语听力跟读", "大学英语", 2, 2, "low", 20, false, 0],
    ];
    const tasks = taskRows.map(([title, course, planOffset, dueOffset, priority, estimate, completed, actual]) => {
      const id = uid();
      return {
        id,
        title,
        course,
        planDate: addDays(t, planOffset),
        dueDate: addDays(t, dueOffset),
        priority,
        estimate,
        notes: title.includes("错题") ? "先遮住答案，写出已知条件和第一步。" : "",
        completed,
        actualMinutes: actual,
        completedDate: completed ? addDays(t, planOffset) : null,
        createdAt: new Date().toISOString(),
        isDemo: true,
      };
    });
    const checkins = tasks.filter((task) => task.completed).reduce((records, task) => {
      let row = records.find((item) => item.date === task.completedDate);
      if (!row) {
        row = { date: task.completedDate, minutes: 0, taskIds: [] };
        records.push(row);
      }
      row.minutes += task.actualMinutes;
      row.taskIds.push(task.id);
      return records;
    }, []);
    checkins.push({ date: addDays(t, -5), minutes: 25, taskIds: [] });
    checkins.push({ date: addDays(t, -4), minutes: 70, taskIds: [] });
    return {
      courses: ["高等数学", "大学英语", "专业基础课"],
      tasks,
      checkins,
      reviews: [{
        id: uid(),
        date: addDays(t, -1),
        done: "完成了数据结构线性表复习，并把概念整理成一页框架。",
        blocker: "遇到复杂例题时直接看答案，没有先独立拆解。",
        next: "先用 15 分钟独立完成一道链表基础题。",
        learning: "先写出已知条件，比盯着答案更容易找到入口。",
        createdAt: new Date().toISOString(),
        isDemo: true,
      }],
    };
  }

  function normalizeState(input) {
    const base = blankState();
    if (!input || typeof input !== "object") return base;
    return {
      version: SCHEMA_VERSION,
      settings: {
        ...base.settings,
        ...(input.settings && typeof input.settings === "object" ? input.settings : {}),
        dailyGoal: clamp(Number(input.settings?.dailyGoal) || 90, 10, 720),
      },
      courses: Array.isArray(input.courses) && input.courses.length
        ? [...new Set(input.courses.filter((course) => typeof course === "string" && course.trim()).map((course) => course.trim()))]
        : base.courses,
      tasks: Array.isArray(input.tasks) ? input.tasks.filter((task) => task && task.id && task.title) : [],
      checkins: Array.isArray(input.checkins) ? input.checkins.filter((item) => item && item.date) : [],
      reviews: Array.isArray(input.reviews) ? input.reviews.filter((item) => item && item.id && item.date) : [],
    };
  }

  function loadState() {
    try {
      return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY)));
    } catch (error) {
      console.warn("无法读取本地数据，已使用空白状态。", error);
      return blankState();
    }
  }

  let state = loadState();
  let activeView = "today";
  let progressPeriod = 7;
  let pendingConfirm = null;

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, version: SCHEMA_VERSION }));
  }

  function toast(message, type = "success") {
    const node = document.createElement("div");
    node.className = `toast${type === "error" ? " error" : ""}`;
    node.textContent = message;
    $("#toast-region").append(node);
    setTimeout(() => node.remove(), 3200);
  }

  function openConfirm(title, message, confirmLabel = "确认") {
    const dialog = $("#confirm-dialog");
    $("#confirm-title").textContent = title;
    $("#confirm-message").textContent = message;
    $("#confirm-ok").textContent = confirmLabel;
    dialog.showModal();
    return new Promise((resolve) => {
      pendingConfirm = resolve;
      dialog.addEventListener("close", () => {
        if (pendingConfirm) pendingConfirm(dialog.returnValue === "confirm");
        pendingConfirm = null;
      }, { once: true });
    });
  }

  function showView(view) {
    activeView = view;
    $$("[data-view-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.viewPanel === view));
    $$("[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
    const [eyebrow, title] = viewMeta[view];
    $("#page-eyebrow").textContent = eyebrow;
    $("#page-title").textContent = title;
    if (view === "progress") renderProgress();
    if (view === "review") renderReview();
    if (view === "settings") renderSettings();
    $("#main-content").focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function sortTasks(tasks) {
    const now = today();
    return [...tasks].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const aOverdue = !a.completed && a.dueDate < now;
      const bOverdue = !b.completed && b.dueDate < now;
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
      if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      return (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
    });
  }

  function todayTasks() {
    const t = today();
    const relevant = state.tasks.filter((task) =>
      (!task.completed && (task.planDate <= t || task.dueDate <= t)) || task.completedDate === t
    );
    if (relevant.length) return sortTasks(relevant);
    return sortTasks(state.tasks.filter((task) => !task.completed)).slice(0, 3);
  }

  function getCheckin(key) {
    return state.checkins.find((item) => item.date === key);
  }

  function calculateStreak() {
    const activeDates = new Set(state.checkins.filter((item) => Number(item.minutes) > 0).map((item) => item.date));
    let cursor = today();
    if (!activeDates.has(cursor)) cursor = addDays(cursor, -1);
    let streak = 0;
    while (activeDates.has(cursor)) {
      streak += 1;
      cursor = addDays(cursor, -1);
    }
    return streak;
  }

  function courseOptions(selected = "") {
    const courses = state.courses.length ? state.courses : ["未分类"];
    return courses.map((course) => `<option value="${escapeHTML(course)}"${course === selected ? " selected" : ""}>${escapeHTML(course)}</option>`).join("");
  }

  function taskTemplate(task, expanded = false) {
    const overdue = !task.completed && task.dueDate < today();
    const statusText = task.completed ? "已完成" : overdue ? "已逾期" : task.dueDate === today() ? "今天截止" : `${humanDate(task.dueDate)}截止`;
    return `
      <article class="task-item${task.completed ? " completed" : ""}${overdue ? " overdue" : ""}" data-task-id="${escapeHTML(task.id)}">
        <button class="task-check" data-action="toggle" type="button" aria-label="${task.completed ? "撤销完成" : "完成任务"}">${task.completed ? "✓" : ""}</button>
        <div class="task-main">
          <div class="task-title-row">
            <p class="task-title">${escapeHTML(task.title)}</p>
            <span class="priority-badge priority-${escapeHTML(task.priority)}">${priorityLabel[task.priority] || "中优先"}</span>
          </div>
          <div class="task-meta">
            <span>${escapeHTML(task.course)}</span>
            <span>${statusText}</span>
            <span>预计 ${Number(task.estimate) || 0} 分钟</span>
            ${task.completed && task.actualMinutes ? `<span>实际 ${Number(task.actualMinutes)} 分钟</span>` : ""}
          </div>
          ${expanded && task.notes ? `<p class="task-notes">${escapeHTML(task.notes)}</p>` : ""}
        </div>
        <div class="task-actions">
          ${task.completed ? `<button class="mini-button" data-action="toggle" type="button">撤销</button>` : `<button class="mini-button" data-action="toggle" type="button">完成</button>`}
          ${expanded ? `<button class="mini-button" data-action="edit" type="button">编辑</button><button class="mini-button danger" data-action="delete" type="button">删除</button>` : ""}
        </div>
      </article>`;
  }

  function renderToday() {
    const t = today();
    const tasks = todayTasks();
    const todaySet = state.tasks.filter((task) => task.planDate <= t && (!task.completed || task.completedDate === t));
    const completedToday = todaySet.filter((task) => task.completed && task.completedDate === t).length;
    const completionRate = todaySet.length ? Math.round((completedToday / todaySet.length) * 100) : 0;
    const minutes = Number(getCheckin(t)?.minutes) || 0;
    const goal = Number(state.settings.dailyGoal) || 90;
    const pending = state.tasks.filter((task) => !task.completed && task.planDate <= t).length;
    const hour = new Date().getHours();
    const greeting = hour < 11 ? "早上好" : hour < 18 ? "下午好" : "晚上好";
    const name = state.settings.name || "同学";

    $("#today-date").textContent = fullHumanDate(t);
    $("#today-greeting").textContent = `${greeting}，${name}。今天先完成最重要的一步。`;
    $("#today-subtitle").textContent = state.settings.semester || "把目标拆小，行动就会开始。";
    $("#goal-progress-text").textContent = `${minutes} / ${goal} 分钟`;
    $("#goal-progress-bar").style.width = `${clamp((minutes / goal) * 100, 0, 100)}%`;
    $("#stat-completion").textContent = `${completionRate}%`;
    $("#stat-completion-note").textContent = todaySet.length ? `已完成 ${completedToday} / ${todaySet.length} 项` : "还没有今日任务";
    $("#stat-minutes").innerHTML = `${minutes}<small> 分钟</small>`;
    $("#stat-minutes-note").textContent = minutes >= goal ? "今日目标已经达成" : `还差 ${Math.max(goal - minutes, 0)} 分钟达成目标`;
    $("#stat-streak").innerHTML = `${calculateStreak()}<small> 天</small>`;
    $("#stat-pending").innerHTML = `${pending}<small> 项</small>`;
    $("#stat-pending-note").textContent = pending ? "先完成截止日期最近的一项" : "今天安排得很轻松";
    $("#avatar-letter").textContent = name.trim().slice(0, 1) || "循";

    const list = $("#focus-task-list");
    list.innerHTML = tasks.length
      ? tasks.slice(0, 3).map((task) => taskTemplate(task)).join("")
      : `<div class="empty-state"><strong>今天还没有任务</strong><p>新增一项真实任务，让今天的重点更清楚。</p><button class="button button-primary" type="button" data-empty-add>新增第一项任务</button></div>`;

    const latest = [...state.reviews].sort((a, b) => b.date.localeCompare(a.date))[0];
    $("#quick-done").textContent = latest?.done || "还没有完成记录";
    $("#quick-next").textContent = latest?.next || "等待你的复盘";
  }

  function renderPlan() {
    const course = $("#filter-course").value || "all";
    const status = $("#filter-status").value || "all";
    const search = $("#task-search").value.trim().toLowerCase();
    const currentCourse = $("#filter-course").value;
    $("#filter-course").innerHTML = `<option value="all">全部课程</option>${courseOptions(currentCourse)}`;
    if (state.courses.includes(currentCourse)) $("#filter-course").value = currentCourse;

    let tasks = state.tasks.filter((task) => {
      if (course !== "all" && task.course !== course) return false;
      if (status === "pending" && task.completed) return false;
      if (status === "completed" && !task.completed) return false;
      if (status === "overdue" && (task.completed || task.dueDate >= today())) return false;
      if (search && !`${task.title} ${task.notes || ""}`.toLowerCase().includes(search)) return false;
      return true;
    });
    tasks = sortTasks(tasks);
    $("#task-count-summary").textContent = `共 ${tasks.length} 项任务`;
    $("#plan-task-list").innerHTML = tasks.length
      ? tasks.map((task) => taskTemplate(task, true)).join("")
      : `<div class="empty-state"><strong>没有符合条件的任务</strong><p>清除筛选，或新增一项具体行动。</p></div>`;
  }

  function renderProgress() {
    const total = state.tasks.length;
    const complete = state.tasks.filter((task) => task.completed).length;
    const rate = total ? Math.round((complete / total) * 100) : 0;
    $("#overall-rate").textContent = `${rate}%`;
    $("#overall-ring").style.setProperty("--rate", `${rate * 3.6}deg`);
    $("#overall-ring").setAttribute("aria-label", `总体任务完成率 ${rate}%`);
    $("#overall-insight").textContent = total
      ? rate >= 80 ? "大部分计划已经落实，下一步关注复盘质量。" : rate >= 40 ? "进度正在积累，优先完成临近截止的任务。" : "先缩小任务范围，让每项行动更容易开始。"
      : "先新增一项真实任务，进度会从这里开始。";

    $$("[data-period]").forEach((button) => button.classList.toggle("active", Number(button.dataset.period) === progressPeriod));
    const days = Array.from({ length: progressPeriod }, (_, index) => addDays(today(), index - progressPeriod + 1));
    const values = days.map((day) => Number(getCheckin(day)?.minutes) || 0);
    const max = Math.max(...values, 1);
    const totalMinutes = values.reduce((sum, value) => sum + value, 0);
    $("#period-total").textContent = `${totalMinutes} 分钟`;
    $("#time-chart").setAttribute("aria-label", `近 ${progressPeriod} 天共学习 ${totalMinutes} 分钟`);
    $("#time-chart").innerHTML = days.map((day, index) => {
      const showLabel = progressPeriod === 7 || index % 4 === 0 || index === days.length - 1;
      return `<div class="bar-column" title="${humanDate(day)} ${values[index]} 分钟">
        <div class="bar-value">${values[index] ? values[index] : ""}</div>
        <div class="bar-track"><span class="bar-fill" style="height:${Math.max((values[index] / max) * 100, values[index] ? 5 : 2)}%"></span></div>
        <div class="bar-label">${showLabel ? new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(new Date(`${day}T12:00:00`)) : ""}</div>
      </div>`;
    }).join("");

    const courseRows = state.courses.map((course) => {
      const tasks = state.tasks.filter((task) => task.course === course);
      const done = tasks.filter((task) => task.completed).length;
      const courseRate = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
      return { course, total: tasks.length, done, rate: courseRate };
    }).sort((a, b) => b.rate - a.rate);
    $("#course-progress-list").innerHTML = courseRows.length
      ? courseRows.map((row) => `<div class="course-row"><header><span title="${escapeHTML(row.course)}">${escapeHTML(row.course)}</span><span>${row.done}/${row.total} · ${row.rate}%</span></header><div class="progress-track"><span style="width:${row.rate}%"></span></div></div>`).join("")
      : `<div class="empty-state compact-empty"><strong>还没有课程</strong><p>在设置中添加课程后即可查看。</p></div>`;

    const heatDays = Array.from({ length: 28 }, (_, index) => addDays(today(), index - 27));
    $("#checkin-heatmap").innerHTML = heatDays.map((day) => {
      const minutes = Number(getCheckin(day)?.minutes) || 0;
      const level = minutes === 0 ? 0 : minutes < 30 ? 1 : minutes < 60 ? 2 : minutes < 100 ? 3 : 4;
      return `<span class="heat-cell${day === today() ? " today" : ""}" data-level="${level}" title="${humanDate(day)} ${minutes} 分钟"></span>`;
    }).join("");
    $("#heatmap-streak").textContent = `连续 ${calculateStreak()} 天`;
  }

  function summaryHTML(review) {
    return `<div class="summary-line"><span>继续做</span><p>${escapeHTML(review.learning || review.done)}</p></div>
      <div class="summary-line stop"><span>停止做</span><p>${escapeHTML(review.blocker)}</p></div>
      <div class="summary-line next"><span>下一步</span><p>${escapeHTML(review.next)}</p></div>`;
  }

  function renderReview() {
    const t = today();
    $("#review-date").textContent = fullHumanDate(t);
    const todayReview = state.reviews.find((review) => review.date === t);
    if (todayReview) {
      $("#review-done").value = todayReview.done;
      $("#review-blocker").value = todayReview.blocker;
      $("#review-next").value = todayReview.next;
      $("#review-learning").value = todayReview.learning || "";
      $("#review-summary-content").classList.remove("empty-state", "compact-empty");
      $("#review-summary-content").innerHTML = summaryHTML(todayReview);
      const alreadyCreated = state.tasks.some((task) => task.sourceReviewId === todayReview.id);
      $("#create-next-task").disabled = alreadyCreated;
      $("#create-next-task").textContent = alreadyCreated ? "已加入明日计划" : "加入明日计划";
    } else {
      $("#review-done").value = "";
      $("#review-blocker").value = "";
      $("#review-next").value = "";
      $("#review-learning").value = "";
      $("#review-summary-content").className = "summary-content empty-state compact-empty";
      $("#review-summary-content").innerHTML = `<strong>写完三问后，这里会生成行动摘要</strong><p>复盘的价值不在记录，而在于改变下一次行动。</p>`;
      $("#create-next-task").disabled = true;
      $("#create-next-task").textContent = "加入明日计划";
    }

    const history = [...state.reviews].sort((a, b) => b.date.localeCompare(a.date));
    $("#review-history").innerHTML = history.length
      ? history.map((review, index) => `<details class="review-entry"${index === 0 ? " open" : ""}><summary>${humanDate(review.date, { weekday: true })}<span>${escapeHTML(review.next)}</span></summary><div class="review-entry-body"><div><b>完成</b><p>${escapeHTML(review.done)}</p></div><div><b>阻碍</b><p>${escapeHTML(review.blocker)}</p></div><div><b>下一步</b><p>${escapeHTML(review.next)}</p></div>${review.learning ? `<div><b>收获</b><p>${escapeHTML(review.learning)}</p></div>` : ""}</div></details>`).join("")
      : `<div class="empty-state"><strong>还没有复盘记录</strong><p>完成今天的三问后，它会留在这里。</p></div>`;
  }

  function renderSettings() {
    $("#setting-name").value = state.settings.name || "";
    $("#setting-semester").value = state.settings.semester || "";
    $("#setting-goal").value = state.settings.dailyGoal || 90;
    $("#course-chip-list").innerHTML = state.courses.map((course) => `<span class="course-chip">${escapeHTML(course)}<button type="button" data-remove-course="${escapeHTML(course)}" aria-label="删除课程 ${escapeHTML(course)}">×</button></span>`).join("");
  }

  function renderAll() {
    renderToday();
    renderPlan();
    renderProgress();
    renderReview();
    renderSettings();
  }

  function populateTaskCourses(selected = "") {
    $("#task-course").innerHTML = courseOptions(selected);
    if (selected && state.courses.includes(selected)) $("#task-course").value = selected;
  }

  function openTaskDialog(task = null, prefill = {}) {
    const dialog = $("#task-dialog");
    dialog.returnValue = "";
    const t = today();
    $("#task-dialog-title").textContent = task ? "编辑任务" : "新增任务";
    $("#task-id").value = task?.id || "";
    $("#task-title").value = task?.title || prefill.title || "";
    populateTaskCourses(task?.course || prefill.course || state.courses[0]);
    $("#task-priority").value = task?.priority || prefill.priority || "medium";
    $("#task-plan-date").value = task?.planDate || prefill.planDate || t;
    $("#task-due-date").value = task?.dueDate || prefill.dueDate || t;
    $("#task-estimate").value = task?.estimate || prefill.estimate || 30;
    $("#task-notes").value = task?.notes || prefill.notes || "";
    $("#task-form-error").textContent = "";
    dialog.showModal();
    setTimeout(() => $("#task-title").focus(), 20);
  }

  function removeTaskFromCheckin(task) {
    if (!task.completedDate) return;
    const row = getCheckin(task.completedDate);
    if (!row) return;
    row.minutes = Math.max(0, Number(row.minutes || 0) - Number(task.actualMinutes || 0));
    row.taskIds = (row.taskIds || []).filter((id) => id !== task.id);
    if (!row.minutes && !row.taskIds.length) state.checkins = state.checkins.filter((item) => item !== row);
  }

  function completeTask(task, minutes) {
    const t = today();
    task.completed = true;
    task.completedDate = t;
    task.actualMinutes = Number(minutes);
    let row = getCheckin(t);
    if (!row) {
      row = { date: t, minutes: 0, taskIds: [] };
      state.checkins.push(row);
    }
    if (!row.taskIds.includes(task.id)) {
      row.taskIds.push(task.id);
      row.minutes = Number(row.minutes || 0) + Number(minutes);
    }
  }

  function undoTask(task) {
    removeTaskFromCheckin(task);
    task.completed = false;
    task.completedDate = null;
    task.actualMinutes = 0;
  }

  async function handleTaskAction(event) {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    const item = event.target.closest("[data-task-id]");
    const task = state.tasks.find((row) => row.id === item?.dataset.taskId);
    if (!task) return;
    if (action === "edit") openTaskDialog(task);
    if (action === "toggle") {
      if (task.completed) {
        undoTask(task);
        saveState();
        renderAll();
        toast("已撤销完成状态");
      } else {
        $("#complete-task-id").value = task.id;
        $("#complete-task-name").textContent = task.title;
        $("#actual-minutes").value = task.estimate || 30;
        $("#complete-dialog").showModal();
      }
    }
    if (action === "delete") {
      const confirmed = await openConfirm("删除任务", `确定删除“${task.title}”吗？这项操作无法撤销。`, "确认删除");
      if (!confirmed) return;
      removeTaskFromCheckin(task);
      state.tasks = state.tasks.filter((row) => row.id !== task.id);
      saveState();
      renderAll();
      toast("任务已删除");
    }
  }

  function validateImport(data) {
    if (!data || typeof data !== "object") throw new Error("文件内容不是有效的数据对象");
    if (!data.settings || !Array.isArray(data.courses) || !Array.isArray(data.tasks) || !Array.isArray(data.reviews)) {
      throw new Error("文件缺少设置、课程、任务或复盘字段");
    }
    if (data.tasks.some((task) => !task.id || !task.title || !task.course)) throw new Error("任务记录格式不完整");
    return normalizeState(data);
  }

  function mergeDemo() {
    const demo = demoPayload();
    const existingDemo = state.tasks.some((task) => task.isDemo) || state.reviews.some((review) => review.isDemo);
    if (existingDemo) {
      toast("示例数据已经加载过", "error");
      return false;
    }
    state.courses = [...new Set([...state.courses, ...demo.courses])];
    state.tasks.push(...demo.tasks);
    state.reviews.push(...demo.reviews);
    demo.checkins.forEach((record) => {
      const existing = getCheckin(record.date);
      if (existing) {
        existing.minutes = Number(existing.minutes || 0) + Number(record.minutes || 0);
        existing.taskIds = [...new Set([...(existing.taskIds || []), ...(record.taskIds || [])])];
      } else state.checkins.push(record);
    });
    return true;
  }

  function bindEvents() {
    $$("[data-view]").forEach((button) => button.addEventListener("click", () => showView(button.dataset.view)));
    $("#open-settings").addEventListener("click", () => showView("settings"));
    $("#go-review").addEventListener("click", () => showView("review"));
    ["#focus-add", "#today-add-task", "#plan-add-task"].forEach((selector) => $(selector).addEventListener("click", () => openTaskDialog()));
    $("#focus-task-list").addEventListener("click", (event) => {
      if (event.target.closest("[data-empty-add]")) openTaskDialog();
      else handleTaskAction(event);
    });
    $("#plan-task-list").addEventListener("click", handleTaskAction);
    $$("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close("cancel")));

    $("#task-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const id = $("#task-id").value;
      const title = $("#task-title").value.trim();
      const planDate = $("#task-plan-date").value;
      const dueDate = $("#task-due-date").value;
      const estimate = Number($("#task-estimate").value);
      if (!title) return void ($("#task-form-error").textContent = "请填写任务标题。");
      if (!planDate || !dueDate) return void ($("#task-form-error").textContent = "请设置计划日期和截止日期。");
      if (dueDate < planDate) return void ($("#task-form-error").textContent = "截止日期不能早于计划日期。");
      if (!Number.isFinite(estimate) || estimate <= 0) return void ($("#task-form-error").textContent = "预计时长必须大于 0。");
      const values = {
        title,
        course: $("#task-course").value,
        priority: $("#task-priority").value,
        planDate,
        dueDate,
        estimate,
        notes: $("#task-notes").value.trim(),
      };
      if (id) Object.assign(state.tasks.find((task) => task.id === id), values);
      else state.tasks.push({ id: uid(), ...values, completed: false, actualMinutes: 0, completedDate: null, createdAt: new Date().toISOString() });
      saveState();
      $("#task-dialog").close("saved");
      renderAll();
      toast(id ? "任务已更新" : "任务已创建");
    });

    $("#complete-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const task = state.tasks.find((row) => row.id === $("#complete-task-id").value);
      const minutes = Number($("#actual-minutes").value);
      if (!task || !Number.isFinite(minutes) || minutes <= 0) return toast("请填写有效的学习时长", "error");
      completeTask(task, minutes);
      saveState();
      $("#complete-dialog").close();
      renderAll();
      toast("完成已记录，继续保持");
    });

    ["#task-search", "#filter-course", "#filter-status"].forEach((selector) => $(selector).addEventListener("input", renderPlan));
    $("#clear-filters").addEventListener("click", () => {
      $("#task-search").value = "";
      $("#filter-course").value = "all";
      $("#filter-status").value = "all";
      renderPlan();
    });

    $$("[data-period]").forEach((button) => button.addEventListener("click", () => {
      progressPeriod = Number(button.dataset.period);
      renderProgress();
    }));

    $("#review-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const done = $("#review-done").value.trim();
      const blocker = $("#review-blocker").value.trim();
      const next = $("#review-next").value.trim();
      const learning = $("#review-learning").value.trim();
      if (!done || !blocker || !next) return toast("请完成三问后再保存", "error");
      const existing = state.reviews.find((review) => review.date === today());
      if (existing) {
        const confirmed = await openConfirm("更新今日复盘", "今天已有复盘记录，是否用当前内容覆盖？", "确认更新");
        if (!confirmed) return;
        Object.assign(existing, { done, blocker, next, learning, updatedAt: new Date().toISOString() });
      } else {
        state.reviews.push({ id: uid(), date: today(), done, blocker, next, learning, createdAt: new Date().toISOString() });
      }
      saveState();
      renderAll();
      toast("今日复盘已保存");
    });

    $("#create-next-task").addEventListener("click", () => {
      const review = state.reviews.find((item) => item.date === today());
      if (!review || state.tasks.some((task) => task.sourceReviewId === review.id)) return;
      openTaskDialog(null, {
        title: review.next,
        planDate: addDays(today(), 1),
        dueDate: addDays(today(), 1),
        priority: "high",
        estimate: 30,
        notes: "由今日复盘生成的最小行动",
      });
      $("#task-form").dataset.sourceReviewId = review.id;
    });

    $("#task-dialog").addEventListener("close", () => {
      const sourceReviewId = $("#task-form").dataset.sourceReviewId;
      if (sourceReviewId && $("#task-dialog").returnValue !== "cancel") {
        const latest = [...state.tasks].reverse().find((task) => task.notes === "由今日复盘生成的最小行动" && !task.sourceReviewId);
        if (latest) {
          latest.sourceReviewId = sourceReviewId;
          saveState();
          renderAll();
        }
      }
      delete $("#task-form").dataset.sourceReviewId;
    });

    $("#profile-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const name = $("#setting-name").value.trim();
      const semester = $("#setting-semester").value.trim();
      const goal = Number($("#setting-goal").value);
      if (!name || !semester || !Number.isFinite(goal) || goal < 10 || goal > 720) return toast("请填写有效的设置", "error");
      Object.assign(state.settings, { name, semester, dailyGoal: goal });
      saveState();
      renderAll();
      toast("设置已保存");
    });

    $("#course-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const input = $("#new-course");
      const name = input.value.trim();
      if (!name) return toast("请输入课程名称", "error");
      if (state.courses.includes(name)) return toast("这门课程已经存在", "error");
      state.courses.push(name);
      input.value = "";
      saveState();
      renderAll();
      toast("课程已添加");
    });

    $("#course-chip-list").addEventListener("click", async (event) => {
      const course = event.target.closest("[data-remove-course]")?.dataset.removeCourse;
      if (!course) return;
      if (state.tasks.some((task) => task.course === course)) return toast("该课程仍有任务，暂时不能删除", "error");
      const confirmed = await openConfirm("删除课程", `确定删除“${course}”吗？`, "确认删除");
      if (!confirmed) return;
      state.courses = state.courses.filter((item) => item !== course);
      saveState();
      renderAll();
      toast("课程已删除");
    });

    $("#export-data").addEventListener("click", () => {
      const exportData = { ...state, version: SCHEMA_VERSION, exportedAt: new Date().toISOString() };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `拾光学习本数据_${today()}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast("数据文件已导出");
    });

    $("#import-data").addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      try {
        const imported = validateImport(JSON.parse(await file.text()));
        const confirmed = await openConfirm("导入学习数据", `将导入 ${imported.tasks.length} 项任务和 ${imported.reviews.length} 条复盘，并替换当前数据。是否继续？`, "确认导入");
        if (!confirmed) return;
        state = imported;
        state.settings.onboardingComplete = true;
        saveState();
        renderAll();
        toast("数据导入完成");
      } catch (error) {
        toast(`导入失败：${error.message}`, "error");
      }
    });

    $("#load-demo").addEventListener("click", () => {
      if (!mergeDemo()) return;
      saveState();
      renderAll();
      toast("示例数据已加入，可随时删除");
    });

    $("#reset-data").addEventListener("click", async () => {
      const confirmed = await openConfirm("清空全部数据", "任务、学习记录、复盘和设置都会被清空，且无法撤销。", "确认清空");
      if (!confirmed) return;
      state = blankState();
      state.settings.onboardingComplete = true;
      saveState();
      renderAll();
      toast("全部学习数据已清空");
    });

    $("#start-demo").addEventListener("click", () => {
      state.settings.name = $("#onboarding-name").value.trim() || "同学";
      state.settings.dailyGoal = clamp(Number($("#onboarding-goal").value) || 90, 10, 720);
      state.settings.onboardingComplete = true;
      const demo = demoPayload();
      state.courses = demo.courses;
      state.tasks = demo.tasks;
      state.checkins = demo.checkins;
      state.reviews = demo.reviews;
      saveState();
      $("#onboarding-dialog").close();
      renderAll();
      toast("示例工作台已准备好");
    });

    $("#start-empty").addEventListener("click", () => {
      state.settings.name = $("#onboarding-name").value.trim() || "同学";
      state.settings.dailyGoal = clamp(Number($("#onboarding-goal").value) || 90, 10, 720);
      state.settings.onboardingComplete = true;
      saveState();
      $("#onboarding-dialog").close();
      renderAll();
      setTimeout(() => openTaskDialog(), 150);
    });
  }

  function init() {
    bindEvents();
    renderAll();
    showView("today");
    if (!state.settings.onboardingComplete) setTimeout(() => $("#onboarding-dialog").showModal(), 180);
  }

  init();
})();
