(function () {
  "use strict";

  const STORAGE_KEY = "shiguang-finance-workbench-v2";
  const SCHEMA_VERSION = 2;
  const COURSES = ["统计学", "商务英语3", "中级财务会计Ⅱ"];

  const pad = (value) => String(value).padStart(2, "0");
  const dateKey = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const fromDateKey = (value) => new Date(`${value}T12:00:00`);
  const addDays = (value, amount) => {
    const date = typeof value === "string" ? fromDateKey(value) : new Date(value);
    date.setDate(date.getDate() + amount);
    return dateKey(date);
  };
  const uid = (prefix = "item") => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const clamp = (value, min, max) => Math.min(Math.max(Number(value) || 0, min), max);
  const today = () => dateKey(new Date());
  const escapeHTML = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[char]);
  const humanDate = (value) => new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric" }).format(fromDateKey(value));
  const fullHumanDate = (value) => new Intl.DateTimeFormat("zh-CN", {
    year: "numeric", month: "long", day: "numeric", weekday: "long",
  }).format(fromDateKey(value));

  function createEmptyState() {
    return {
      version: SCHEMA_VERSION,
      settings: {
        name: "同学",
        major: "财务管理",
        semester: "专业核心课学习阶段",
        dailyGoal: 100,
        courses: [...COURSES],
      },
      tasks: [],
      checkins: [],
      reviews: [],
    };
  }

  function createDemoPayload() {
    const t = today();
    return {
      version: SCHEMA_VERSION,
      settings: {
        name: "同学",
        major: "财务管理",
        semester: "专业核心课学习阶段",
        dailyGoal: 100,
        courses: [...COURSES],
      },
      tasks: [
        {
          id: "task-stat-sampling",
          title: "整理抽样分布的三类题型",
          course: "统计学",
          due: t,
          minutes: 35,
          priority: "high",
          status: "todo",
          note: "先写判断路径，再各做一道例题。",
          createdAt: addDays(t, -2),
        },
        {
          id: "task-accounting-longterm",
          title: "完成长期股权投资分录对照表",
          course: "中级财务会计Ⅱ",
          due: t,
          minutes: 45,
          priority: "high",
          status: "todo",
          note: "区分成本法与权益法，标出易混节点。",
          createdAt: addDays(t, -3),
        },
        {
          id: "task-english-presentation",
          title: "润色财务报告口头展示开场",
          course: "商务英语3",
          due: t,
          minutes: 20,
          priority: "medium",
          status: "todo",
          note: "录音一遍，检查数字与百分比的表达。",
          createdAt: addDays(t, -1),
        },
        {
          id: "task-stat-interval",
          title: "订正区间估计练习",
          course: "统计学",
          due: addDays(t, -1),
          minutes: 30,
          priority: "medium",
          status: "done",
          note: "复核置信水平与临界值。",
          createdAt: addDays(t, -4),
          completedAt: addDays(t, -1),
        },
        {
          id: "task-accounting-cashflow",
          title: "预习合并现金流量表抵销逻辑",
          course: "中级财务会计Ⅱ",
          due: addDays(t, 1),
          minutes: 40,
          priority: "medium",
          status: "todo",
          note: "只梳理框架，不追求一次记全。",
          createdAt: t,
        },
        {
          id: "task-english-vocab",
          title: "复习并购主题词汇卡",
          course: "商务英语3",
          due: addDays(t, 2),
          minutes: 25,
          priority: "low",
          status: "todo",
          note: "用 acquisition、merger 各造两个句子。",
          createdAt: t,
        },
      ],
      checkins: [
        { id: "check-6", date: addDays(t, -6), minutes: 45, taskIds: [] },
        { id: "check-5", date: addDays(t, -5), minutes: 70, taskIds: [] },
        { id: "check-4", date: addDays(t, -4), minutes: 55, taskIds: [] },
        { id: "check-3", date: addDays(t, -3), minutes: 100, taskIds: [] },
        { id: "check-2", date: addDays(t, -2), minutes: 80, taskIds: [] },
        { id: "check-1", date: addDays(t, -1), minutes: 95, taskIds: ["task-stat-interval"] },
      ],
      reviews: [
        {
          id: "review-yesterday",
          date: addDays(t, -1),
          done: "订正了统计学区间估计练习，并把错误按公式选择、条件判断和计算步骤重新分类。",
          blocker: "中级财务会计Ⅱ的长期股权投资分录容易把初始计量与后续计量混在一起。",
          next: "先做分录对照表，再完成两道综合题；商务英语3录一遍展示开场。",
          learning: "先判断业务场景，再选择会计处理，比直接背分录更稳。",
        },
      ],
    };
  }

  function normalizeState(input) {
    const fallback = createEmptyState();
    const source = input && typeof input === "object" ? input : {};
    const settings = source.settings && typeof source.settings === "object" ? source.settings : {};
    const courses = Array.isArray(settings.courses) && settings.courses.length
      ? [...new Set(settings.courses.map(String).map((item) => item.trim()).filter(Boolean))]
      : [...COURSES];
    return {
      version: SCHEMA_VERSION,
      settings: {
        ...fallback.settings,
        ...settings,
        dailyGoal: clamp(settings.dailyGoal || fallback.settings.dailyGoal, 10, 720),
        courses,
      },
      tasks: Array.isArray(source.tasks) ? source.tasks.filter(Boolean) : [],
      checkins: Array.isArray(source.checkins) ? source.checkins.filter(Boolean) : [],
      reviews: Array.isArray(source.reviews) ? source.reviews.filter(Boolean) : [],
    };
  }

  class LocalStudyStore {
    constructor() {
      this.state = this.load();
    }

    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return normalizeState(JSON.parse(raw));
      } catch (error) {
        console.warn("读取学习数据失败，已载入默认内容。", error);
      }
      const seeded = createDemoPayload();
      this.save(seeded);
      return seeded;
    }

    save(nextState) {
      const normalized = normalizeState(nextState);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      this.state = normalized;
      return normalized;
    }

    reset(withDemo = false) {
      return this.save(withDemo ? createDemoPayload() : createEmptyState());
    }
  }

  window.ShiguangCore = {
    STORAGE_KEY,
    SCHEMA_VERSION,
    COURSES,
    store: new LocalStudyStore(),
    uid,
    dateKey,
    addDays,
    today,
    humanDate,
    fullHumanDate,
    escapeHTML,
    clamp,
    createEmptyState,
    createDemoPayload,
    normalizeState,
  };
})();
