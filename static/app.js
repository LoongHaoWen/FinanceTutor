const state = {
  data: null,
  progress: { completed: [], quiz: {}, notes: {}, visuals: {}, cases: {} },
  activeLesson: 0,
  activeTab: "definition",
  activeDifficulty: "easy",
  cardIndex: 0,
  teacherReady: false,
  visualReady: false,
  revealedCases: {},
  choiceOrders: {},
};

const tabAdvice = {
  definition: "先展开定义卷轴：把术语改写成自己的话，再给它配一个生活里的画面。",
  relations: "进入关系地图时，别只看单点。画出“谁影响谁、谁限制谁”，知识会立刻有方向。",
  model: "模型工坊不靠硬背。先找输入、输出和假设，再看它帮你解决哪类问题。",
  example: "案例是补给包。读完后换成自己的例子，才算真正把装备放进背包。",
  boundary: "边界陷阱最能训练判断力。说得出何时不适用，你就已经越过了死记硬背。",
  exercise: "挑战题不是审判，而是侦察。答错只是在告诉你：下一处需要点亮哪盏灯。",
};

const stageMonsters = [
  "概念迷雾",
  "复利回音",
  "风险暗流",
  "现金流迷宫",
  "股债双门",
  "市场传送阵",
  "组合风暴",
  "净现值试炼",
  "对冲幻影",
  "综合首领",
  "利率山脊",
  "通胀沙海",
  "估值镜厅",
  "现金流熔炉",
  "资本成本钟塔",
  "杠杆断桥",
  "融资双岔路",
  "营运水渠",
  "信用雾港",
  "指数森林",
  "情绪回廊",
  "信息风暴",
  "风险护盾阵",
  "保险契约门",
  "房贷长坡",
  "汇率潮汐",
  "数据星盘",
  "监管灯塔",
  "个人规划圣殿",
  "精通终章",
];

const difficultyMeta = {
  easy: { label: "容易", xp: 20, tone: "热身一击" },
  normal: { label: "普通", xp: 35, tone: "稳步推进" },
  hard: { label: "困难", xp: 55, tone: "认真破局" },
  extreme: { label: "极难", xp: 90, tone: "勇者试炼" },
};

const visualPalettes = [
  ["#2457c5", "#12b76a", "#f4c430"],
  ["#6c47ff", "#19a7ce", "#ffb020"],
  ["#0f766e", "#84cc16", "#f97316"],
  ["#334155", "#2563eb", "#10b981"],
];

const $ = (id) => document.getElementById(id);

async function load() {
  const [curriculum, progress] = await Promise.all([
    fetch("/api/curriculum").then((r) => r.json()),
    fetch("/api/progress").then((r) => r.json()),
  ]);
  state.data = curriculum;
  state.progress = normalizeProgress(progress);
  renderShell();
  renderLesson();
  calculateFV();
  checkTeacherStatus();
  checkVisualStatus();
}

function normalizeProgress(progress) {
  const normalized = {
    completed: Array.isArray(progress.completed) ? progress.completed : [],
    quiz: progress.quiz || {},
    notes: progress.notes || {},
    visuals: progress.visuals || {},
    cases: progress.cases || {},
  };

  state.data.lessons.forEach((lesson) => {
    const saved = normalized.quiz[lesson.id];
    if (typeof saved === "string") {
      const easy = getChallenges(lesson)[0];
      normalized.quiz[lesson.id] = {
        easy: {
          choice: saved,
          correct: easy ? saved === easy.answer : false,
          xp: easy && saved === easy.answer ? easy.xp : 0,
        },
      };
    }
  });
  return normalized;
}

function currentLesson() {
  return state.data.lessons[state.activeLesson];
}

function isDone(id) {
  return state.progress.completed.includes(id);
}

function shortTitle(lesson) {
  return lesson.title.replace(/^第 \d+ 课：/, "");
}

function getChallenges(lesson) {
  if (Array.isArray(lesson.challenges) && lesson.challenges.length) return lesson.challenges;
  if (!lesson.exercise) return [];
  return [
    {
      ...lesson.exercise,
      difficulty: "easy",
      label: "容易",
      xp: difficultyMeta.easy.xp,
    },
  ];
}

function getChallenge(lesson) {
  const challenges = getChallenges(lesson);
  return challenges.find((item) => item.difficulty === state.activeDifficulty) || challenges[0];
}

function getChallengeRecord(lesson, difficulty = state.activeDifficulty) {
  const record = state.progress.quiz?.[lesson.id];
  if (!record || typeof record === "string") return null;
  return record[difficulty] || null;
}

function challengeKey(lesson, challenge) {
  return `${lesson.id}:${challenge.difficulty}`;
}

function shuffleChoices(choices) {
  const shuffled = [...choices];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  if (choices.length > 1 && shuffled.every((choice, index) => choice === choices[index])) {
    shuffled.push(shuffled.shift());
  }
  return shuffled;
}

function getDisplayChoices(lesson, challenge) {
  const key = challengeKey(lesson, challenge);
  if (!state.choiceOrders[key]) {
    state.choiceOrders[key] = [...challenge.choices];
  }
  return state.choiceOrders[key];
}

function cleanTeacherText(text) {
  return String(text || "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function compactText(value, limit = 78) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function gameStats() {
  const completed = state.progress.completed.length;
  const challengeRecords = Object.values(state.progress.quiz || {}).flatMap((record) => {
    if (!record) return [];
    if (typeof record === "string") return [{ correct: true, xp: 25 }];
    return Object.values(record);
  });
  const answered = challengeRecords.length;
  const challengeXp = challengeRecords.reduce((sum, record) => sum + (record.correct ? Number(record.xp || 0) : 0), 0);
  const notes = Object.values(state.progress.notes || {}).filter((value) => value.trim()).length;
  const cases = Object.values(state.progress.cases || {}).filter(Boolean).length;
  const xp = completed * 100 + challengeXp + notes * 15 + cases * 40;
  const level = Math.max(1, Math.floor(xp / 120) + 1);
  const levelNames = ["概念新手", "现金流学徒", "风险侦察者", "模型锻造师", "资本策士", "金融勇者"];
  const rank = levelNames[Math.min(level - 1, levelNames.length - 1)];
  return { completed, answered, notes, cases, challengeXp, xp, level, rank };
}

function progressSummary() {
  const lesson = currentLesson();
  const stats = gameStats();
  return {
    currentLesson: lesson.title,
    currentStageMonster: stageMonsters[state.activeLesson] || "概念迷雾",
    currentTab: state.activeTab,
    completedLessons: state.progress.completed.length,
    totalLessons: state.data.lessons.length,
    currentLessonDone: isDone(lesson.id),
    currentQuizAnswer: getChallengeRecord(lesson)?.choice || "",
    activeDifficulty: state.activeDifficulty,
    hasNote: Boolean((state.progress.notes[lesson.id] || "").trim()),
    xp: stats.xp,
    level: stats.level,
    rank: stats.rank,
  };
}

async function saveProgress() {
  await fetch("/api/progress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state.progress),
  });
}

function renderShell() {
  $("courseTitle").textContent = "金融冒险：从入门村走向精通塔";
  $("courseSubtitle").textContent = "30 个关卡、四档挑战、案例试炼和小精灵陪伴，把金融学练成能用的判断力。";
  $("teacherName").textContent = "小精灵灵光";

  $("roadmap").innerHTML = state.data.roadmap.map((item) => `<li>${item}</li>`).join("");
  $("sources").innerHTML = state.data.meta.sources
    .map(
      (source) => `
        <div>
          <a href="${source.url}" target="_blank" rel="noreferrer">${source.name}</a>
          <p>${source.note}</p>
        </div>`
    )
    .join("");

  renderNav();
  renderProgress();
  renderFlashcard();
}

function renderNav() {
  $("lessonNav").innerHTML = state.data.lessons
    .map((lesson, index) => {
      const active = index === state.activeLesson ? "active" : "";
      const done = isDone(lesson.id) ? "done" : "";
      const monster = stageMonsters[index] || "守关难题";
      return `<button class="lesson-link ${active} ${done}" data-index="${index}"><span>第 ${index + 1} 关</span>${shortTitle(lesson)}<small>守关难题：${monster}</small></button>`;
    })
    .join("");

  document.querySelectorAll(".lesson-link").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.activeLesson = Number(btn.dataset.index);
      state.activeTab = "definition";
      state.activeDifficulty = "easy";
      renderNav();
      renderLesson();
    });
  });
}

function renderProgress() {
  const total = state.data.lessons.length;
  const done = state.progress.completed.length;
  const percent = Math.round((done / total) * 100);
  const stats = gameStats();
  const xpInLevel = stats.xp % 120;
  const xpPercent = (xpInLevel / 120) * 100;
  $("progressText").textContent = `${percent}%`;
  $("progressBar").style.width = `${percent}%`;
  $("playerLevel").textContent = `Lv.${stats.level} ${stats.rank}`;
  $("xpText").textContent = `${stats.xp} XP · 挑战获得 ${stats.challengeXp} XP · 距离下一次成长还需 ${120 - xpInLevel} XP`;
  $("xpBar").style.width = `${xpPercent}%`;
  $("stageRank").textContent = `已击破 ${done} / ${total} 个守关难题`;
  $("activeQuest").textContent = stageMonsters[state.activeLesson] || "概念迷雾";
}

function renderLesson() {
  const lesson = currentLesson();
  const monster = stageMonsters[state.activeLesson] || "守关难题";
  renderProgress();
  $("lessonMeta").textContent = `${lesson.duration} · 本关目标：${lesson.objective}`;
  $("lessonTitle").textContent = `第 ${state.activeLesson + 1} 关：${shortTitle(lesson)}`;
  $("teacherTalk").textContent = `灵光提示：这一关的守关难题是「${monster}」。不用硬闯，我们先抓住一个核心目标：${lesson.objective}`;
  $("lessonStatus").textContent = isDone(lesson.id) ? "已通关" : "挑战中";
  $("lessonStatus").className = `status ${isDone(lesson.id) ? "done" : ""}`;
  $("noteBox").value = state.progress.notes[lesson.id] || "";
  renderCompanionTip();
  renderConceptVisual();
  renderGeneratedVisual();

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === state.activeTab);
  });
  renderTab();
}

function renderConceptVisual() {
  const lesson = currentLesson();
  const colors = visualPalettes[state.activeLesson % visualPalettes.length];
  const relationItems = (lesson.relations || [])
    .slice(0, 3)
    .map((item) => `<li>${escapeHtml(compactText(item, 46))}</li>`)
    .join("");
  $("conceptVisual").innerHTML = `
    <div class="concept-map" style="--accent:${colors[0]}; --accent-2:${colors[1]}; --accent-3:${colors[2]};">
      <div class="map-header">
        <span>本关知识图谱</span>
        <strong>${escapeHtml(shortTitle(lesson))}</strong>
        <p>${escapeHtml(compactText(lesson.objective, 92))}</p>
      </div>
      <div class="map-flow">
        <article class="map-node main-node">
          <span>核心议题</span>
          <strong>${escapeHtml(shortTitle(lesson))}</strong>
          <p>${escapeHtml(compactText(lesson.definition, 92))}</p>
        </article>
        <div class="map-connector" aria-hidden="true"></div>
        <article class="map-node variable-node">
          <span>关键变量</span>
          <ul>${relationItems}</ul>
        </article>
        <div class="map-connector" aria-hidden="true"></div>
        <article class="map-node outcome-node">
          <span>判断产出</span>
          <strong>能解释一个真实决策</strong>
          <p>${escapeHtml(compactText(lesson.reflection, 76))}</p>
        </article>
      </div>
      <div class="map-layers">
        <div>
          <span>分析工具</span>
          <p>${escapeHtml(compactText(lesson.model, 120))}</p>
        </div>
        <div>
          <span>现实场景</span>
          <p>${escapeHtml(compactText(lesson.example, 120))}</p>
        </div>
        <div>
          <span>风险边界</span>
          <p>${escapeHtml(compactText(lesson.boundary, 120))}</p>
        </div>
      </div>
    </div>
  `;
}

function renderGeneratedVisual() {
  const lesson = currentLesson();
  const imageUrl = state.progress.visuals?.[lesson.id] || lesson.defaultVisual;
  $("generatedVisual").innerHTML = imageUrl
    ? `<img src="${imageUrl}" alt="${shortTitle(lesson)}关卡插画" /><p>${state.progress.visuals?.[lesson.id] ? "小精灵已为本关生成解释插画。再次点击可生成新的版本。" : "已整合你之前生成的相关插画，作为本关的视觉线索。"}</p>`
    : `<p>想把这一关变成一张图？点击“生成本关插画”，小精灵会调用 nano banana 生成解释图片。</p>`;
}

function renderCompanionTip() {
  const lesson = currentLesson();
  const doneCount = state.progress.completed.length;
  const quizAnswer = getChallengeRecord(lesson);
  const note = state.progress.notes[lesson.id] || "";
  const monster = stageMonsters[state.activeLesson] || "概念迷雾";
  let opening = `勇者，你正在挑战「${monster}」，本关主题是「${shortTitle(lesson)}」。`;
  if (doneCount === 0) {
    opening += "刚进地图时觉得概念有点散很正常，先点亮路线，不必一开始就全记住。";
  } else {
    opening += `你已经通关 ${doneCount} / ${state.data.lessons.length} 关，判断力正在变得更稳。`;
  }
  if (state.activeTab === "exercise" && quizAnswer) {
    opening += "你已经出手挑战过了，现在最适合看解析并补一句自己的解释。";
  } else if (note.trim()) {
    opening += "你已经收集了一条笔记线索，下一步可以把它压缩成一句判断标准。";
  }
  $("companionTip").textContent = `${opening} ${tabAdvice[state.activeTab]}`;
}

function renderTab() {
  const lesson = currentLesson();
  const content = $("tabContent");
  const views = {
    definition: `<h4>定义卷轴</h4><p>${lesson.definition}</p>`,
    relations: `<h4>关系地图</h4><ul>${lesson.relations.map((item) => `<li>${item}</li>`).join("")}</ul>`,
    model: `<h4>模型工坊</h4><p>${lesson.model}</p>`,
    example: `<h4>案例补给</h4><p>${lesson.example}</p>`,
    boundary: `<h4>边界陷阱</h4><p>${lesson.boundary}</p><div class="explain"><strong>复盘提示：</strong>${lesson.reflection}</div>`,
    exercise: renderExercise(lesson),
  };
  content.innerHTML = views[state.activeTab];
  bindQuiz();
}

function renderExercise(lesson) {
  const challenges = getChallenges(lesson);
  const challenge = getChallenge(lesson);
  if (!challenge) {
    return "<h4>挑战题</h4><p>这一关暂时没有挑战题。</p>";
  }
  const saved = getChallengeRecord(lesson, challenge.difficulty);
  const difficultyButtons = challenges
    .map((item) => {
      const meta = difficultyMeta[item.difficulty] || { label: item.label, tone: "挑战", xp: item.xp };
      const record = getChallengeRecord(lesson, item.difficulty);
      const active = item.difficulty === challenge.difficulty ? "active" : "";
      const done = record ? (record.correct ? "done" : "tried") : "";
      return `<button class="difficulty-btn ${active} ${done}" data-difficulty="${item.difficulty}">
        <strong>${item.label || meta.label}</strong>
        <span>${meta.tone} · ${item.xp} XP</span>
      </button>`;
    })
    .join("");
  const answerClass = (choice) => {
    if (!saved) return "";
    if (choice === challenge.answer) return "correct";
    if (choice === saved.choice && saved.choice !== challenge.answer) return "wrong";
    return "";
  };
  const choices = getDisplayChoices(lesson, challenge)
    .map((choice) => `<button class="quiz-choice ${answerClass(choice)}" data-choice="${choice}">${choice}</button>`)
    .join("");
  const isCorrect = saved?.choice === challenge.answer;
  const explain = saved
    ? `<div class="explain"><strong>${isCorrect ? `答对了，获得 ${challenge.xp} XP。` : "再想一步，小精灵把线索递给你。"}</strong>${challenge.explain}${!isCorrect ? `<button class="retry-quiz-btn secondary" data-difficulty="${challenge.difficulty}">重新回答</button>` : ""}</div>`
    : "";
  const caseStudy = renderCaseStudy(lesson);
  return `
    <h4>挑战题</h4>
    <div class="difficulty-grid">${difficultyButtons}</div>
    <div class="challenge-card">
      <div class="challenge-head">
        <span>${challenge.label || difficultyMeta[challenge.difficulty]?.label || "挑战"}</span>
        <strong>答对 +${challenge.xp} XP</strong>
      </div>
      <p>${challenge.question}</p>
      ${choices}
      ${explain}
    </div>
    ${caseStudy}`;
}

function renderCaseStudy(lesson) {
  const caseStudy = lesson.caseStudy;
  if (!caseStudy) return "";
  const revealed = Boolean(state.revealedCases[lesson.id]);
  const completed = Boolean(state.progress.cases?.[lesson.id]);
  return `
    <div class="case-card">
      <div class="challenge-head">
        <span>本关案例分析 · 可选完成</span>
        <strong>${completed ? "已完成 +40 XP" : "完成后 +40 XP"}</strong>
      </div>
      <h4>${caseStudy.title || "案例分析题"}</h4>
      <p>${caseStudy.prompt}</p>
      <div class="button-row">
        <button class="secondary reveal-case-btn" data-lesson-id="${lesson.id}">${revealed ? "收起标准答案" : "显示标准答案"}</button>
        <button class="ghost complete-case-btn" data-lesson-id="${lesson.id}" ${completed ? "disabled" : ""}>${completed ? "案例已完成" : "标记案例完成"}</button>
      </div>
      ${revealed ? `<div class="explain"><strong>标准答案：</strong>${caseStudy.answer}</div>` : ""}
    </div>`;
}

function bindQuiz() {
  document.querySelectorAll(".difficulty-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.activeDifficulty = btn.dataset.difficulty;
      renderTab();
      renderCompanionTip();
    });
  });

  document.querySelectorAll(".retry-quiz-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const lesson = currentLesson();
      const challenge = getChallenge(lesson);
      state.choiceOrders[challengeKey(lesson, challenge)] = shuffleChoices(challenge.choices);
      if (state.progress.quiz?.[lesson.id]?.[challenge.difficulty]) {
        delete state.progress.quiz[lesson.id][challenge.difficulty];
        await saveProgress();
      }
      renderTab();
      renderCompanionTip();
      renderProgress();
    });
  });

  document.querySelectorAll(".quiz-choice").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const lesson = currentLesson();
      const challenge = getChallenge(lesson);
      const correct = btn.dataset.choice === challenge.answer;
      state.progress.quiz[lesson.id] = state.progress.quiz[lesson.id] || {};
      state.progress.quiz[lesson.id][challenge.difficulty] = {
        choice: btn.dataset.choice,
        correct,
        xp: correct ? challenge.xp : 0,
      };
      await saveProgress();
      renderTab();
      renderCompanionTip();
      renderProgress();
    });
  });

  document.querySelectorAll(".reveal-case-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.revealedCases[btn.dataset.lessonId] = !state.revealedCases[btn.dataset.lessonId];
      renderTab();
    });
  });

  document.querySelectorAll(".complete-case-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      state.progress.cases = state.progress.cases || {};
      state.progress.cases[btn.dataset.lessonId] = true;
      await saveProgress();
      renderTab();
      renderProgress();
    });
  });
}

function renderFlashcard() {
  const cards = state.data.glossary;
  const card = cards[state.cardIndex % cards.length];
  $("flashcard").innerHTML = `<strong>${card.term}</strong><span>${card.definition}</span>`;
}

function calculateFV() {
  const pv = Number($("pv").value || 0);
  const rate = Number($("rate").value || 0) / 100;
  const years = Number($("years").value || 0);
  const fv = pv * Math.pow(1 + rate, years);
  $("calcResult").textContent = `终值：${fv.toFixed(2)}`;
}

async function checkTeacherStatus() {
  try {
    const status = await fetch("/api/teacher/status").then((r) => r.json());
    state.teacherReady = status.configured;
    $("teacherStatus").textContent = status.configured ? `已连接：${status.model}` : "未配置";
    $("teacherStatus").className = `pill ${status.configured ? "ready" : ""}`;
    $("modelInput").value = status.model || "deepseek-v4-flash";
  } catch {
    $("teacherStatus").textContent = "检测失败";
  }
}

async function checkVisualStatus() {
  try {
    const status = await fetch("/api/visual/status").then((r) => r.json());
    state.visualReady = status.configured;
    $("visualStatus").textContent = status.configured ? `已连接：${status.model}` : "未配置";
    $("visualStatus").className = `pill ${status.configured ? "ready" : ""}`;
    $("visualModelInput").value = status.model || "Nano_Banana_Pro_2K_0";
    $("visualAspectInput").value = status.aspectRatio || "16:9";
  } catch {
    $("visualStatus").textContent = "检测失败";
  }
}

async function saveVisualSettings() {
  const apiKey = $("visualApiKeyInput").value.trim();
  const model = $("visualModelInput").value.trim();
  const aspectRatio = $("visualAspectInput").value.trim();
  $("generatedVisual").innerHTML = "<p>正在保存图解配置...</p>";
  try {
    const response = await fetch("/api/visual/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey, model, aspectRatio }),
    });
    const payload = await response.json();
    if (!response.ok || payload.error) {
      throw new Error(payload.error || "保存失败");
    }
    $("visualApiKeyInput").value = "";
    $("generatedVisual").innerHTML = payload.configured
      ? `<p>图解引擎已点亮。当前模型：${payload.model}</p>`
      : "<p>还没有填写 nano banana API key。</p>";
    checkVisualStatus();
  } catch (error) {
    $("generatedVisual").innerHTML = `<p>保存失败：${error.message}</p>`;
  }
}

async function generateVisual() {
  const lesson = currentLesson();
  const monster = stageMonsters[state.activeLesson] || "金融概念守关难题";
  $("generateVisualBtn").disabled = true;
  $("generatedVisual").innerHTML = "<p>小精灵正在绘制本关图解，这可能需要几十秒。先喝口水，别急。</p>";
  try {
    const response = await fetch("/api/visual/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId: lesson.id, monster }),
    });
    const payload = await response.json();
    if (!response.ok || payload.error) {
      throw new Error(payload.error || "生成失败");
    }
    state.progress.visuals = state.progress.visuals || {};
    state.progress.visuals[lesson.id] = payload.imageUrl;
    await saveProgress();
    renderGeneratedVisual();
  } catch (error) {
    $("generatedVisual").innerHTML = `<p>生成失败：${error.message}</p>`;
  } finally {
    $("generateVisualBtn").disabled = false;
    checkVisualStatus();
  }
}

async function saveTeacherSettings() {
  const apiKey = $("apiKeyInput").value.trim();
  const model = $("modelInput").value.trim();
  $("teacherAnswer").textContent = "正在保存配置...";
  try {
    const response = await fetch("/api/teacher/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey, model }),
    });
    const payload = await response.json();
    if (!response.ok || payload.error) {
      throw new Error(payload.error || "保存失败");
    }
    $("apiKeyInput").value = "";
    $("teacherAnswer").textContent = payload.configured
      ? `配置已保存。当前模型：${payload.model}`
      : "还没有填写 API key。";
    checkTeacherStatus();
  } catch (error) {
    $("teacherAnswer").textContent = `保存失败：${error.message}`;
  }
}

async function askTeacher(mode) {
  const lesson = currentLesson();
  const question = $("teacherQuestion").value.trim();
  $("teacherAnswer").textContent =
    mode === "quiz" ? "小精灵正在生成挑战..." : mode === "coach" ? "小精灵正在观察你的通关节奏..." : "小精灵正在思考...";
  $("askTeacherBtn").disabled = true;
  $("makeQuizBtn").disabled = true;
  $("coachTeacherBtn").disabled = true;
  try {
    const response = await fetch("/api/teacher", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, question, lessonId: lesson.id, progressSummary: progressSummary() }),
    });
    const payload = await response.json();
    if (!response.ok || payload.error) {
      throw new Error(payload.error || "请求失败");
    }
    const answer = cleanTeacherText(payload.answer);
    $("teacherAnswer").textContent = answer || "小精灵这次没有带回清晰内容，请稍后再试。";
    if (mode === "coach") {
      $("companionTip").textContent = answer || $("companionTip").textContent;
    }
  } catch (error) {
    $("teacherAnswer").textContent = `调用失败：${error.message}`;
  } finally {
    $("askTeacherBtn").disabled = false;
    $("makeQuizBtn").disabled = false;
    $("coachTeacherBtn").disabled = false;
    checkTeacherStatus();
  }
}

document.addEventListener("click", async (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const clickedButton = target?.closest("button");

  if (clickedButton?.matches(".tab")) {
    state.activeTab = clickedButton.dataset.tab;
    renderLesson();
  }

  if (clickedButton?.id === "markDoneBtn") {
    const lesson = currentLesson();
    if (!isDone(lesson.id)) {
      state.progress.completed.push(lesson.id);
      await saveProgress();
      renderShell();
      renderLesson();
      $("teacherAnswer").textContent = "本关已通关。小精灵建议你现在用 2 分钟复述：这一关击破了什么难题，最容易误解的陷阱是什么。";
    }
  }

  if (clickedButton?.id === "resetBtn") {
    if (confirm("确定要重置全部通关进度、笔记和生成图解吗？")) {
      state.progress = { completed: [], quiz: {}, notes: {}, visuals: {}, cases: {} };
      await saveProgress();
      renderShell();
      renderLesson();
    }
  }

  if (clickedButton?.id === "saveNoteBtn") {
    const lesson = currentLesson();
    state.progress.notes[lesson.id] = $("noteBox").value;
    await saveProgress();
    renderCompanionTip();
    clickedButton.textContent = "线索已收录";
    setTimeout(() => (clickedButton.textContent = "收录线索"), 900);
  }

  if (clickedButton?.id === "nextCardBtn") {
    state.cardIndex += 1;
    renderFlashcard();
  }

  if (clickedButton?.id === "calcBtn") {
    calculateFV();
  }

  if (clickedButton?.id === "askTeacherBtn") {
    askTeacher("ask");
  }

  if (clickedButton?.id === "makeQuizBtn") {
    askTeacher("quiz");
  }

  if (clickedButton?.id === "coachTeacherBtn") {
    askTeacher("coach");
  }

  if (clickedButton?.id === "saveApiKeyBtn") {
    saveTeacherSettings();
  }

  if (clickedButton?.id === "saveVisualKeyBtn") {
    saveVisualSettings();
  }

  if (clickedButton?.id === "generateVisualBtn") {
    generateVisual();
  }
});

["pv", "rate", "years"].forEach((id) => {
  document.addEventListener("input", (event) => {
    if (event.target.id === id) calculateFV();
  });
});

load().catch((error) => {
  document.body.innerHTML = `<main class="app"><h1>加载失败</h1><p>${error.message}</p></main>`;
});
