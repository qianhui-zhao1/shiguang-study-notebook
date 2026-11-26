(function () {
  "use strict";

  const {
    SCHEMA_VERSION,
    store,
    uid,
    addDays,
    today,
    humanDate,
    fullHumanDate,
    escapeHTML,
    clamp,
    createEmptyState,
    createDemoPayload,
    normalizeState,
  } = window.ShiguangCore;

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const priorityWeight = { high: 0, medium: 1, low: 2 };
  const priorityLabel = { high: "高优先", medium: "中优先", low: "低优先" };
  const viewMeta = {
    today: ["FOCUS DESK", "今日桌面"],
    plan: ["ACTION PLANNER", "计划编排"],
    progress: ["LEARNING FOOTPRINT", "学习轨迹"],
    review: ["TODAY IN VIEW", "复盘手记"],
    settings: ["WORKBENCH SETUP", "工作台设置"],
  };

  let state = store.state;
  let activeView = "today";
  let selectedTraceDate = today();
  let pendingConfirmation = null;
  let toastTimer = null;

  function saveState() {
    state = store.save(state);
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
  }

  function showView(name) {
    activeView = viewMeta[name] ? name : "today";
    $$('[data-view-panel]').forEach((panel) => {
      const active = panel.dataset.viewPanel === activeView;
      panel.hidden = !active;
      panel.classList.toggle("active", active);
    });
    $$('[data-view]').forEach((button) => button.classList.toggle("active", button.dataset.view === activeView));
    $("#page-eyebrow").textContent = viewMeta[activeView][0];
    $("#page-title").textContent = viewMeta[activeView][1];
    if (activeView === "progress") renderProgress();
    if (activeView === "review") renderReview();
    if (activeView === "settings") renderSettings();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function taskSort(a, b) {
    if (a.status !== b.status) return a.status === "done" ? 1 : -1;
    if (a.due !== b.due) return String(a.due).localeCompare(String(b.due));
    return (priorityWeight[a.priority] ?? 9) - (priorityWeight[b.priority] ?? 9);
  }

  function getCheckin(date) {
    return state.checkins.find((entry) => entry.date === date);
  }

  function getTodayStats() {
    const key = today();
    const todaysTasks = state.tasks.filter((task) => task.due === key);
    const completed = todaysTasks.filter((task) => task.status === "done");
    const minutes = Number(getCheckin(key)?.minutes) || 0;
    return {
      tasks: todaysTasks,
      completed,
      pending: todaysTasks.filter((task) => task.status !== "done"),
      minutes,
      completion: todaysTasks.length ? Math.round((completed.length / todaysTasks.length) * 100) : 0,
    };
  }

  function calculateStreak() {
    let streak = 0;
    let cursor = today();
    if (!getCheckin(cursor)?.minutes) cursor = addDays(cursor, -1);
    while (Number(getCheckin(cursor)?.minutes) > 0) {
      streak += 1;
      cursor = addDays(cursor, -1);
    }
    return streak;
  }

  function taskRow(task, mode = "focus") {
    if (mode === "focus") {
      return `<article class="focus-task ${task.status === "done" ? "done" : ""}" data-task-id="${escapeHTML(task.id)}">
        <button class="check-button" data-action="toggle" type="button" aria-label="${task.status === "done" ? "恢复未完成" : "完成任务"}">${task.status === "done" ? "✓" : ""}</button>
        <div class="task-copy"><strong>${escapeHTML(task.title)}</strong><small>${escapeHTML(task.note || `${task.minutes} 分钟的专注安排`)}</small></div>
        <span class="course-tag">${escapeHTML(task.course)}</span>
      </article>`;
    }
    return `<article class="plan-task action-card ${task.status === "done" ? "done" : ""}" data-task-id="${escapeHTML(task.id)}">
      <div class="action-check"><button class="check-button" data-action="toggle" type="button" aria-label="${task.status === "done" ? "恢复未完成" : "完成任务"}">${task.status === "done" ? "✓" : ""}</button></div>
      <div class="task-main"><strong>${escapeHTML(task.title)}</strong><p>${escapeHTML(task.note || "尚未填写行动提示")}</p>
        <div class="task-meta"><span>${escapeHTML(task.course)}</span><span>${task.minutes} 分钟</span><span class="priority-pill ${escapeHTML(task.priority)}">${priorityLabel[task.priority] || "普通"}</span></div>
      </div>
      <div class="task-actions">
        <button data-action="toggle" type="button">${task.status === "done" ? "恢复" : "完成"}</button>
        <button data-action="edit" type="button">编辑</button>
        <button data-action="delete" type="button">删除</button>
      </div>
    </article>`;
  }

  function renderToday() {
    const stats = getTodayStats();
    const t = today();
    const name = state.settings.name || "同学";
    $("#today-date").textContent = fullHumanDate(t);
    $("#today-greeting").textContent = stats.pending.length
      ? `${name}，先把最关键的一页学明白。`
      : `${name}，今天的任务已经合上书页。`;
    $("#today-subtitle").textContent = "围绕统计学、商务英语3与中级财务会计Ⅱ，把每一次学习变成看得见的推进。";
    $("#avatar-letter").textContent = name.trim().charAt(0) || "光";
    $("#stat-completion").textContent = `${stats.completion}%`;
    $("#completion-orbit").style.setProperty("--progress", stats.completion);
    $("#stat-completion-note").textContent = stats.tasks.length
      ? `已完成 ${stats.completed.length} / ${stats.tasks.length} 项`
      : "今天还没有安排任务";
    $("#stat-minutes").textContent = stats.minutes;
    $("#stat-minutes-note").textContent = stats.minutes >= state.settings.dailyGoal ? "今日目标已达成" : `距离目标还差 ${Math.max(state.settings.dailyGoal - stats.minutes, 0)} 分钟`;
    $("#stat-streak").textContent = calculateStreak();
    $("#stat-pending").textContent = stats.pending.length;
    $("#stat-pending-note").textContent = stats.pending.length ? "先完成高优先级，再处理其余安排" : "今日清单已完成，可以写复盘了";
    $("#today-task-count").textContent = `${stats.tasks.length} 项`;
    $("#goal-progress-text").textContent = `${stats.minutes} / ${state.settings.dailyGoal} 分钟`;
    $("#goal-progress-bar").style.width = `${clamp((stats.minutes / state.settings.dailyGoal) * 100, 0, 100)}%`;

    const todayTasks = [...stats.tasks].sort(taskSort);
    $("#focus-task-list").innerHTML = todayTasks.length
      ? todayTasks.map((task) => taskRow(task)).join("")
      : `<div class="empty-state">今天还没有任务。写下一项小而明确的行动吧。</div>`;

    const yesterday = addDays(t, -1);
    const previousReview = state.reviews.find((review) => review.date === yesterday) || [...state.reviews].sort((a, b) => b.date.localeCompare(a.date))[0];
    $("#quick-next").textContent = previousReview?.next || "从统计学、商务英语3或中级财务会计Ⅱ中，选一个知识点继续推进。";
    $("#quick-done").textContent = previousReview?.done || "暂无复盘记录";

    const weekdays = Array.from({ length: 7 }, (_, index) => addDays(t, index - 6));
    $("#today-week-strip").innerHTML = weekdays.map((day) => {
      const minutes = Number(getCheckin(day)?.minutes) || 0;
      const weekday = new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(new Date(`${day}T12:00:00`));
      return `<div class="week-day ${day === t ? "active" : ""}"><span>${weekday}</span><i style="--level:${Math.min(minutes / state.settings.dailyGoal, 1)}"></i><strong>${minutes}<small>m</small></strong></div>`;
    }).join("");
  }

  function renderCourseOptions() {
    const courseOptions = state.settings.courses.map((course) => `<option value="${escapeHTML(course)}">${escapeHTML(course)}</option>`).join("");
    const currentTaskCourse = $("#task-course").value;
    const currentFilter = $("#filter-course").value;
    $("#task-course").innerHTML = courseOptions || '<option value="综合学习">综合学习</option>';
    $("#filter-course").innerHTML = `<option value="">全部课程</option>${courseOptions}`;
    if (state.settings.courses.includes(currentTaskCourse)) $("#task-course").value = currentTaskCourse;
    if (state.settings.courses.includes(currentFilter)) $("#filter-course").value = currentFilter;
  }

  function renderPlan() {
    renderCourseOptions();
    const query = $("#task-search").value.trim().toLowerCase();
    const course = $("#filter-course").value;
    const status = $("#filter-status").value;
    const tasks = [...state.tasks].filter((task) => {
      const haystack = `${task.title} ${task.course} ${task.note || ""}`.toLowerCase();
      return (!query || haystack.includes(query)) && (!course || task.course === course) && (!status || task.status === status);
    }).sort((a, b) => String(a.due).localeCompare(String(b.due)) || (priorityWeight[a.priority] ?? 9) - (priorityWeight[b.priority] ?? 9) || (a.status === "done" ? 1 : -1));
    $("#task-count-summary").textContent = `${tasks.length} 项`;
    if (!tasks.length) {
      $("#plan-task-list").innerHTML = `<div class="empty-state">没有符合条件的行动。调整筛选，或写入一项新行动。</div>`;
      return;
    }
    const groups = tasks.reduce((result, task) => {
      (result[task.due] ||= []).push(task);
      return result;
    }, {});
    $("#plan-task-list").innerHTML = Object.entries(groups).map(([date, dayTasks]) => {
      const relation = date === today() ? "今天" : date === addDays(today(), 1) ? "明天" : date < today() ? "已过日期" : "接下来";
      const weekday = new Intl.DateTimeFormat("zh-CN", { weekday: "long" }).format(new Date(`${date}T12:00:00`));
      return `<section class="plan-day-group">
        <header><div><span>${relation}</span><strong>${humanDate(date)}</strong><small>${weekday}</small></div><em>${dayTasks.filter((task) => task.status === "done").length}/${dayTasks.length} 完成</em></header>
        <div class="day-action-list">${dayTasks.map((task) => taskRow(task, "plan")).join("")}</div>
      </section>`;
    }).join("");
  }

  function renderProgress() {
    const tasks = state.tasks.filter((task) => task.due === selectedTraceDate);
    const done = tasks.filter((task) => task.status === "done");
    const rate = tasks.length ? Math.round((done.length / tasks.length) * 100) : 0;
    const minutes = Number(getCheckin(selectedTraceDate)?.minutes) || 0;
    const selectedDate = new Date(`${selectedTraceDate}T12:00:00`);
    $("#trace-selected-date").textContent = humanDate(selectedTraceDate);
    $("#trace-selected-weekday").textContent = new Intl.DateTimeFormat("zh-CN", { year: "numeric", weekday: "long" }).format(selectedDate);
    $("#overall-rate").textContent = `${rate}%`;
    $("#overall-insight").textContent = tasks.length ? `${done.length} / ${tasks.length} 项完成` : "当天没有安排任务";
    $("#period-total").innerHTML = `${minutes}<small>min</small>`;

    $("#course-progress-list").innerHTML = state.settings.courses.map((course) => {
      const courseTasks = tasks.filter((task) => task.course === course);
      const courseDone = courseTasks.filter((task) => task.status === "done").length;
      const courseRate = courseTasks.length ? Math.round((courseDone / courseTasks.length) * 100) : 0;
      return `<div class="course-progress-item"><header><strong>${escapeHTML(course)}</strong><span>${courseDone}/${courseTasks.length} · ${courseRate}%</span></header><div><i style="width:${courseRate}%"></i></div></div>`;
    }).join("") || `<div class="empty-state">尚未设置课程</div>`;

    $("#heatmap-streak").textContent = calculateStreak();
    const heatDays = Array.from({ length: 60 }, (_, index) => addDays(today(), index - 59));
    $("#checkin-heatmap").innerHTML = heatDays.map((day) => {
      const dayMinutes = Number(getCheckin(day)?.minutes) || 0;
      const level = dayMinutes === 0 ? 0 : dayMinutes < 30 ? 1 : dayMinutes < 60 ? 2 : dayMinutes < 100 ? 3 : 4;
      const date = new Date(`${day}T12:00:00`);
      const month = `${date.getMonth() + 1}月`;
      const dayNumber = date.getDate();
      const weekday = new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(date);
      return `<button class="heat-cell footprint-cell ${day === selectedTraceDate ? "selected" : ""}" data-level="${level}" data-trace-date="${day}" aria-pressed="${day === selectedTraceDate}" type="button" title="${humanDate(day)}：${dayMinutes} 分钟"><span>${month}</span><strong>${dayNumber}</strong><small>${weekday}</small></button>`;
    }).join("");
  }

  function renderReview() {
    const date = $("#review-date").value || today();
    $("#review-date").value = date;
    const review = state.reviews.find((item) => item.date === date);
    $("#review-done").value = review?.done || "";
    $("#review-blocker").value = review?.blocker || "";
    $("#review-next").value = review?.next || "";
    $("#review-learning").value = review?.learning || "";
    $("#review-summary-date").textContent = `${humanDate(date)} · ${review ? "已收录" : "等待书写"}`;
    const rows = [
      ["FOCUS / 投入瞬间", review?.done],
      ["CLEAR / 理解变化", review?.blocker],
      ["CURIOUS / 继续追踪", review?.next],
      ["MARGIN / 页边批注", review?.learning],
    ];
    $("#review-summary-content").innerHTML = rows.map(([label, value]) => `<div class="review-summary-item"><small>${label}</small><p>${escapeHTML(value || "尚未填写")}</p></div>`).join("");
    $("#create-next-task").disabled = !review?.next;
    const history = [...state.reviews].sort((a, b) => b.date.localeCompare(a.date));
    $("#review-history").innerHTML = history.length
      ? history.map((item) => `<button class="history-item" data-review-date="${item.date}" type="button"><strong>${humanDate(item.date)}</strong><span>${escapeHTML((item.done || "无摘要").slice(0, 18))}${(item.done || "").length > 18 ? "…" : ""}</span></button>`).join("")
      : `<div class="empty-state">还没有复盘手记</div>`;
  }

  function renderSettings() {
    $("#setting-name").value = state.settings.name || "";
    $("#setting-major").value = state.settings.major || "财务管理";
    $("#setting-semester").value = state.settings.semester || "";
    $("#setting-goal").value = state.settings.dailyGoal;
    $("#course-chip-list").innerHTML = state.settings.courses.map((course) => `<span class="course-chip">${escapeHTML(course)}<button data-remove-course="${escapeHTML(course)}" type="button" aria-label="删除 ${escapeHTML(course)}">×</button></span>`).join("");
  }

  function renderAll() {
    renderToday();
    renderPlan();
    renderProgress();
    renderReview();
    renderSettings();
  }

  function openTaskDialog(task = null) {
    renderCourseOptions();
    $("#task-dialog-title").textContent = task ? "编辑学习任务" : "新增学习任务";
    $("#task-id").value = task?.id || "";
    $("#task-title").value = task?.title || "";
    $("#task-due").value = task?.due || today();
    $("#task-minutes").value = task?.minutes || 30;
    $("#task-priority").value = task?.priority || "medium";
    $("#task-note").value = task?.note || "";
    if (task?.course && !state.settings.courses.includes(task.course)) {
      $("#task-course").insertAdjacentHTML("beforeend", `<option value="${escapeHTML(task.course)}">${escapeHTML(task.course)}</option>`);
    }
    $("#task-course").value = task?.course || state.settings.courses[0] || "综合学习";
    $("#task-dialog").showModal();
  }

  function openCompleteDialog(task) {
    $("#complete-task-id").value = task.id;
    $("#complete-task-name").textContent = task.title;
    $("#complete-minutes").value = task.minutes || 30;
    $("#complete-dialog").showModal();
  }

  function askConfirmation(title, message, callback) {
    pendingConfirmation = callback;
    $("#confirm-title").textContent = title;
    $("#confirm-message").textContent = message;
    $("#confirm-dialog").showModal();
  }

  function updateTaskStatus(task, completed, minutes = null) {
    task.status = completed ? "done" : "todo";
    if (completed) task.completedAt = today(); else delete task.completedAt;
    const checkin = getCheckin(today());
    if (completed) {
      const actual = clamp(minutes ?? task.minutes, 1, 720);
      if (checkin) {
        checkin.minutes = Number(checkin.minutes || 0) + actual;
        checkin.taskIds = [...new Set([...(checkin.taskIds || []), task.id])];
      } else {
        state.checkins.push({ id: uid("check"), date: today(), minutes: actual, taskIds: [task.id] });
      }
    } else if (checkin) {
      checkin.taskIds = (checkin.taskIds || []).filter((id) => id !== task.id);
    }
    saveState();
    renderAll();
  }

  function handleTaskAction(event) {
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;
    const row = actionButton.closest("[data-task-id]");
    const task = state.tasks.find((item) => item.id === row?.dataset.taskId);
    if (!task) return;
    const action = actionButton.dataset.action;
    if (action === "toggle") {
      if (task.status === "done") updateTaskStatus(task, false);
      else openCompleteDialog(task);
    }
    if (action === "edit") openTaskDialog(task);
    if (action === "delete") askConfirmation("删除这项任务？", `“${task.title}”将从计划中移除。`, () => {
      state.tasks = state.tasks.filter((item) => item.id !== task.id);
      saveState();
      renderAll();
      showToast("任务已删除");
    });
  }

  function bindEvents() {
    document.addEventListener("click", (event) => {
      const viewButton = event.target.closest("[data-view]");
      if (viewButton) showView(viewButton.dataset.view);
    });
    ["#focus-add", "#today-add-task", "#plan-add-task"].forEach((selector) => $(selector).addEventListener("click", () => openTaskDialog()));
    $("#open-settings").addEventListener("click", () => showView("settings"));
    $("#go-review").addEventListener("click", () => showView("review"));
    $("#focus-task-list").addEventListener("click", handleTaskAction);
    $("#plan-task-list").addEventListener("click", handleTaskAction);

    $("#task-form").addEventListener("submit", (event) => {
      if (event.submitter?.value === "cancel") return;
      event.preventDefault();
      if (!event.currentTarget.reportValidity()) return;
      const id = $("#task-id").value;
      const existing = state.tasks.find((task) => task.id === id);
      const data = {
        title: $("#task-title").value.trim(),
        course: $("#task-course").value,
        due: $("#task-due").value,
        minutes: clamp($("#task-minutes").value, 5, 720),
        priority: $("#task-priority").value,
        note: $("#task-note").value.trim(),
      };
      if (existing) Object.assign(existing, data);
      else state.tasks.push({ id: uid("task"), status: "todo", createdAt: today(), ...data });
      saveState();
      renderAll();
      $("#task-dialog").close();
      showToast(existing ? "任务已更新" : "任务已加入计划");
    });

    $("#complete-form").addEventListener("submit", (event) => {
      if (event.submitter?.value === "cancel") return;
      event.preventDefault();
      if (!event.currentTarget.reportValidity()) return;
      const task = state.tasks.find((item) => item.id === $("#complete-task-id").value);
      if (task) updateTaskStatus(task, true, Number($("#complete-minutes").value));
      $("#complete-dialog").close();
      showToast("已完成并计入今日专注时间");
    });

    ["#task-search", "#filter-course", "#filter-status"].forEach((selector) => $(selector).addEventListener("input", renderPlan));
    $("#clear-filters").addEventListener("click", () => {
      $("#task-search").value = "";
      $("#filter-course").value = "";
      $("#filter-status").value = "";
      renderPlan();
    });
    $("#checkin-heatmap").addEventListener("click", (event) => {
      const cell = event.target.closest("[data-trace-date]");
      if (!cell) return;
      selectedTraceDate = cell.dataset.traceDate;
      renderProgress();
    });

    $("#review-date").addEventListener("change", renderReview);
    $("#review-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const date = $("#review-date").value;
      let review = state.reviews.find((item) => item.date === date);
      const values = {
        done: $("#review-done").value.trim(),
        blocker: $("#review-blocker").value.trim(),
        next: $("#review-next").value.trim(),
        learning: $("#review-learning").value.trim(),
      };
      if (review) Object.assign(review, values);
      else state.reviews.push({ id: uid("review"), date, ...values });
      saveState();
      renderAll();
      showToast("复盘手记已保存");
    });
    $("#review-history").addEventListener("click", (event) => {
      const button = event.target.closest("[data-review-date]");
      if (!button) return;
      $("#review-date").value = button.dataset.reviewDate;
      renderReview();
    });
    $("#create-next-task").addEventListener("click", () => {
      const review = state.reviews.find((item) => item.date === $("#review-date").value);
      if (!review?.next) return;
      openTaskDialog();
      $("#task-title").value = review.next.slice(0, 80);
      $("#task-note").value = `来自 ${humanDate(review.date)} 的复盘手记`;
      $("#task-due").value = addDays(review.date, 1) < today() ? today() : addDays(review.date, 1);
    });

    $("#profile-form").addEventListener("submit", (event) => {
      event.preventDefault();
      state.settings.name = $("#setting-name").value.trim() || "同学";
      state.settings.major = $("#setting-major").value.trim() || "财务管理";
      state.settings.semester = $("#setting-semester").value.trim();
      state.settings.dailyGoal = clamp($("#setting-goal").value, 10, 720);
      saveState();
      renderAll();
      showToast("工作台设置已保存");
    });
    $("#course-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const course = $("#new-course").value.trim();
      if (!course || state.settings.courses.includes(course)) return;
      state.settings.courses.push(course);
      $("#new-course").value = "";
      saveState();
      renderAll();
      showToast("课程已添加");
    });
    $("#course-chip-list").addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove-course]");
      if (!button) return;
      if (state.settings.courses.length <= 1) return showToast("至少保留一门课程");
      state.settings.courses = state.settings.courses.filter((course) => course !== button.dataset.removeCourse);
      saveState();
      renderAll();
    });

    $("#export-data").addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `拾光学习本备份-${today()}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 500);
      showToast("备份已导出");
    });
    $("#import-data").addEventListener("click", () => $("#import-file").click());
    $("#import-file").addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        state = normalizeState(JSON.parse(await file.text()));
        state.version = SCHEMA_VERSION;
        saveState();
        renderAll();
        showToast("备份已导入");
      } catch (error) {
        showToast("导入失败：请选择有效的 JSON 备份");
      }
      event.target.value = "";
    });
    $("#load-demo").addEventListener("click", () => askConfirmation("恢复专业示例？", "当前记录会被财务管理专业示例替换。", () => {
      state = createDemoPayload();
      saveState();
      renderAll();
      showView("today");
      showToast("已恢复专业示例");
    }));
    $("#reset-data").addEventListener("click", () => askConfirmation("清空全部数据？", "任务、打卡与复盘都会被清除，此操作无法撤销。", () => {
      state = createEmptyState();
      saveState();
      renderAll();
      showView("today");
      showToast("数据已清空");
    }));
    $("#confirm-dialog").addEventListener("close", () => {
      if ($("#confirm-dialog").returnValue === "default" && pendingConfirmation) pendingConfirmation();
      pendingConfirmation = null;
    });
  }

  function init() {
    $("#review-date").value = today();
    bindEvents();
    renderAll();
    const entryUrl = new URL(window.location.href);
    if (entryUrl.searchParams.has("view")) {
      entryUrl.searchParams.delete("view");
      window.history.replaceState(null, "", `${entryUrl.pathname}${entryUrl.search}${entryUrl.hash}`);
    }
    showView("today");
  }

  init();
})();
