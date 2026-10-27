/*
 * 密切关系威胁识别网站 —— 交互逻辑
 * 纯前端实现，数据本地处理，不上传任何服务器。
 */

(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const STORE_KEY = "familiar-threat:v1";

  /* ---------- 状态 ---------- */
  const state = {
    answers: {}, // qid -> "yes" | "no" | "unsure"
    scenarioResults: {}, // sid -> true/false
    safeguards: {}, // gid -> bool
  };

  function loadState() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        state.answers = parsed.answers || {};
        state.scenarioResults = parsed.scenarioResults || {};
        state.safeguards = parsed.safeguards || {};
      }
    } catch (e) {
      /* ignore corrupted storage */
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (e) {
      /* storage may be unavailable */
    }
  }

  /* ---------- 工具 ---------- */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function scrollToId(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ---------- 渲染：威胁情形知识库 ---------- */
  function renderThreatTypes() {
    const wrap = $("#threat-types");
    if (!wrap) return;
    wrap.innerHTML = THREAT_TYPES.map(
      (t) => `
      <article class="card threat-card" id="threat-${t.id}">
        <div class="threat-card__head">
          <span class="threat-card__icon">${t.icon}</span>
          <div>
            <h3>${esc(t.title)}</h3>
            <p class="muted">${esc(t.subtitle)}</p>
          </div>
          <span class="badge badge--${t.id}">${esc(t.level)}</span>
        </div>
        <p class="threat-card__def">${esc(t.definition)}</p>
        <div class="keypoint"><strong>判定要点：</strong>${esc(t.keyPoint)}</div>
        <div class="safeguard-list">
          <h4>防范措施</h4>
          <ul>${t.safeguards.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
        </div>
      </article>`
    ).join("");
  }

  /* ---------- 渲染：测评问卷 ---------- */
  function renderQuestions() {
    const wrap = $("#questions-wrap");
    if (!wrap) return;
    wrap.innerHTML = QUESTIONS.map((q) => {
      const val = state.answers[q.id] || "";
      return `
      <div class="question" data-qid="${q.id}">
        <div class="question__meta">
          <span class="chip">${esc(q.category)}</span>
          <span class="weight">权重 ${q.weight}</span>
        </div>
        <p class="question__text">${esc(q.text)}</p>
        <div class="options" role="radiogroup" aria-label="${esc(q.text)}">
          ${["yes", "no", "unsure"]
            .map(
              (k) => `
            <label class="option ${val === k ? "is-selected" : ""}">
              <input type="radio" name="${q.id}" value="${k}" ${val === k ? "checked" : ""} />
              <span>${k === "yes" ? "是" : k === "no" ? "否" : "不确定"}</span>
            </label>`
            )
            .join("")}
        </div>
        <p class="tip">💡 ${esc(q.tip)}</p>
      </div>`;
    }).join("");

    wrap.addEventListener("change", (e) => {
      const input = e.target;
      if (input.type !== "radio") return;
      const qid = input.name;
      state.answers[qid] = input.value;
      saveState();
      updateProgress();
    });
    updateProgress();
  }

  function updateProgress() {
    const answered = Object.keys(state.answers).length;
    const total = QUESTIONS.length;
    const bar = $("#progress-bar");
    const label = $("#progress-label");
    if (bar) bar.style.width = `${(answered / total) * 100}%`;
    if (label) label.textContent = `已答 ${answered} / ${total}`;
  }

  function computeRisk() {
    let totalWeight = 0;
    let score = 0;
    const findings = [];
    QUESTIONS.forEach((q) => {
      totalWeight += q.weight;
      const ans = state.answers[q.id];
      if (ans === "yes") {
        score += q.reversed ? 0 : q.weight;
        if (!q.reversed) findings.push({ q, hit: true });
      } else if (ans === "unsure") {
        score += q.reversed ? 0 : q.weight * 0.5;
        if (!q.reversed) findings.push({ q, hit: "unsure" });
      } else if (ans === "no") {
        if (q.reversed) {
          score += q.weight; // 未落实防范措施，视为风险
          findings.push({ q, hit: true });
        }
      }
    });

    const pct = totalWeight > 0 ? Math.round((score / totalWeight) * 100) : 0;

    let grade, color, advice;
    if (pct <= 20) {
      grade = "低威胁";
      color = "good";
      advice = "独立性保持良好。建议持续执行申报、回避与复核制度，防范于未然。";
    } else if (pct <= 45) {
      grade = "中低威胁";
      color = "mild";
      advice = "存在一定风险信号，需保持职业怀疑，落实复核与轮换等防范措施。";
    } else if (pct <= 70) {
      grade = "中高威胁";
      color = "warn";
      advice = "风险明显，应立即采取防范措施：调离相关人员、安排独立复核、设置冷却期。";
    } else {
      grade = "高威胁";
      color = "danger";
      advice = "独立性已受到严重损害。相关存在亲密关系的人员不得进入项目团队，须及时上报并主动回避。";
    }

    return { pct, score, totalWeight, grade, color, advice, findings };
  }

  function renderResult() {
    const wrap = $("#result-wrap");
    if (!wrap) return;
    const answered = Object.keys(state.answers).length;
    if (answered < QUESTIONS.length) {
      wrap.innerHTML = `<p class="empty">请先完成全部 ${QUESTIONS.length} 道题目，再查看识别结果。</p>`;
      return;
    }
    const r = computeRisk();
    const categoryCount = {};
    QUESTIONS.forEach((q) => {
      const a = state.answers[q.id];
      const isHit = q.reversed ? a === "no" : a === "yes" || a === "unsure";
      if (isHit) categoryCount[q.category] = (categoryCount[q.category] || 0) + 1;
    });

    const findingsHtml = r.findings.length
      ? `<h4>风险信号清单</h4>
        <ul class="findings">
        ${r.findings
          .map(
            (f) =>
              `<li><strong>${f.hit === "unsure" ? "⚠️ 需核实" : "🚩 风险点"}</strong> [${esc(
                f.q.category
              )}] ${esc(f.q.text)}</li>`
          )
          .join("")}
        </ul>`
      : `<p class="empty">未发现明显的风险信号，独立性良好。</p>`;

    wrap.innerHTML = `
      <div class="result result--${r.color}">
        <div class="result__head">
          <div class="score-ring" style="--pct:${r.pct}">
            <span class="score-ring__num">${r.pct}%</span>
          </div>
          <div class="result__summary">
            <h3>综合风险等级：<span class="grade grade--${r.color}">${r.grade}</span></h3>
            <p>风险得分 ${r.score} / ${r.totalWeight}</p>
            <p class="muted">${esc(r.advice)}</p>
          </div>
        </div>
        <div class="result__categories">
          ${Object.keys(categoryCount)
            .map(
              (c) => `<span class="chip chip--warn">${esc(c)}：${categoryCount[c]} 项</span>`
            )
            .join("")}
        </div>
        ${findingsHtml}
        <div class="result__actions">
          <button class="btn" id="btn-export">导出报告</button>
          <button class="btn btn--ghost" id="btn-reset">重新测评</button>
        </div>
      </div>`;

    $("#btn-export").addEventListener("click", exportReport);
    $("#btn-reset").addEventListener("click", () => {
      state.answers = {};
      saveState();
      renderQuestions();
      renderResult();
    });
  }

  /* ---------- 渲染：情景决策演练 ---------- */
  function renderScenarios() {
    const wrap = $("#scenarios-wrap");
    if (!wrap) return;
    wrap.innerHTML = SCENARIOS.map((s) => {
      const chosen = state.scenarioResults[s.id];
      const solved = chosen !== undefined;
      const isCorrect = chosen === s.correctKey;
      const feedback = solved
        ? `
        <div class="feedback ${isCorrect ? "feedback--good" : "feedback--bad"}">
          <strong>${isCorrect ? "✅ 正确" : "❌ 需改进"}</strong>
          <p>${esc(isCorrect ? s.resultGood : s.resultBad)}</p>
          <p class="muted">${esc(s.analysis)}</p>
        </div>`
        : "";
      return `
      <div class="card scenario" data-sid="${s.id}">
        <span class="chip chip--scenario">${esc(s.tag)}</span>
        <p class="scenario__q">${esc(s.question)}</p>
        <div class="options options--block">
          ${s.options
            .map((o) => {
              let cls = "option";
              if (solved) {
                if (o.correct) cls += " is-correct";
                else if (o.key === chosen) cls += " is-wrong";
              }
              return `<button class="${cls}" data-key="${o.key}" ${solved ? "disabled" : ""}>
                <span class="opt-key">${o.key}</span> ${esc(o.text)}
              </button>`;
            })
            .join("")}
        </div>
        ${feedback}
      </div>`;
    }).join("");

    wrap.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-key]");
      if (!btn) return;
      const card = btn.closest(".scenario");
      const sid = card.dataset.sid;
      const key = btn.dataset.key;
      state.scenarioResults[sid] = key;
      saveState();
      renderScenarios();
    });
  }

  /* ---------- 渲染：案例库 ---------- */
  function renderCases() {
    const wrap = $("#cases-wrap");
    if (!wrap) return;
    wrap.innerHTML = CASES.map(
      (c) => `
      <article class="card case">
        <h3>${esc(c.name)}</h3>
        <span class="chip chip--scenario">${esc(c.threatType)}</span>
        <p><strong>案情：</strong>${esc(c.summary)}</p>
        <p><strong>后果：</strong>${esc(c.consequence)}</p>
        <div class="keypoint"><strong>启示：</strong>${esc(c.lesson)}</div>
      </article>`
    ).join("");
  }

  /* ---------- 渲染：防范清单 ---------- */
  function renderSafeguards() {
    const wrap = $("#safeguards-wrap");
    if (!wrap) return;
    wrap.innerHTML = SAFEGUARDS.map(
      (g) => `
      <label class="check-item">
        <input type="checkbox" data-gid="${g.id}" ${state.safeguards[g.id] ? "checked" : ""} />
        <span class="check-box"></span>
        <span class="check-text">${esc(g.text)}</span>
        <span class="chip chip--small">${esc(g.category)}</span>
      </label>`
    ).join("");

    wrap.addEventListener("change", (e) => {
      const cb = e.target;
      if (cb.type !== "checkbox") return;
      state.safeguards[cb.dataset.gid] = cb.checked;
      saveState();
      updateSafeguardSummary();
    });
    updateSafeguardSummary();
  }

  function updateSafeguardSummary() {
    const checked = Object.values(state.safeguards).filter(Boolean).length;
    const el = $("#safeguard-summary");
    if (el) el.textContent = `已落实 ${checked} / ${SAFEGUARDS.length} 项防范措施`;
  }

  /* ---------- 导出报告 ---------- */
  function exportReport() {
    const r = computeRisk();
    const lines = [];
    lines.push("# 密切关系威胁识别报告");
    lines.push("");
    lines.push(`- 生成时间：${new Date().toLocaleString("zh-CN")}`);
    lines.push(`- 综合风险等级：${r.grade}`);
    lines.push(`- 风险得分：${r.score} / ${r.totalWeight}（${r.pct}%）`);
    lines.push("");
    lines.push("## 结论与建议");
    lines.push(r.advice);
    lines.push("");
    lines.push("## 作答明细");
    QUESTIONS.forEach((q) => {
      const a = state.answers[q.id];
      const label = a === "yes" ? "是" : a === "no" ? "否" : a === "unsure" ? "不确定" : "未作答";
      lines.push(`- [${q.category}] ${q.text} —— ${label}`);
    });
    lines.push("");
    lines.push("## 风险信号");
    if (r.findings.length) {
      r.findings.forEach((f) =>
        lines.push(`- [${f.q.category}] ${f.q.text}`)
      );
    } else {
      lines.push("- 未发现明显风险信号");
    }
    lines.push("");
    lines.push("> 本报告由浏览器本地生成，数据未上传任何服务器，仅用于教学与自我评估，不构成法律或审计意见。");

    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `密切关系威胁识别报告-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /* ---------- AI 辅助问答 ---------- */
  const AI_HISTORY_KEY = "familiar-threat:ai-history:v1";
  let aiMessages = []; // [{ role, content }]

  function loadAiHistory() {
    try {
      const raw = localStorage.getItem(AI_HISTORY_KEY);
      if (raw) aiMessages = JSON.parse(raw);
    } catch (e) {
      aiMessages = [];
    }
  }

  function saveAiHistory() {
    try {
      localStorage.setItem(AI_HISTORY_KEY, JSON.stringify(aiMessages));
    } catch (e) {
      /* storage may be unavailable */
    }
  }

  function inlineMd(s) {
    let t = esc(s);
    t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
    return t;
  }

  // 安全的简易 Markdown 渲染（先转义，再转换，避免 XSS）
  function renderMarkdown(src) {
    const lines = String(src == null ? "" : src).split(/\r?\n/);
    let html = "";
    let inCode = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^\s*```/.test(line)) {
        inCode = !inCode;
        html += inCode ? '<pre class="md-code">' : "</pre>";
        continue;
      }
      if (inCode) {
        html += esc(line) + "\n";
        continue;
      }
      if (/^\s*$/.test(line)) continue;
      if (/^\s*###\s+/.test(line)) html += `<h4>${inlineMd(line.replace(/^\s*###\s+/, ""))}</h4>`;
      else if (/^\s*##\s+/.test(line)) html += `<h3>${inlineMd(line.replace(/^\s*##\s+/, ""))}</h3>`;
      else if (/^\s*#\s+/.test(line)) html += `<h2>${inlineMd(line.replace(/^\s*#\s+/, ""))}</h2>`;
      else if (/^\s*[-*]\s+/.test(line)) html += `<div class="md-li">${inlineMd(line.replace(/^\s*[-*]\s+/, ""))}</div>`;
      else if (/^\s*\d+[.、)]\s+/.test(line)) html += `<div class="md-li">${inlineMd(line.replace(/^\s*\d+[.、)]\s+/, ""))}</div>`;
      else html += `<p>${inlineMd(line)}</p>`;
    }
    if (inCode) html += "</pre>";
    return html;
  }

  function appendChatMessage(role, content) {
    const list = $("#chat-list");
    if (!list) return;
    const div = document.createElement("div");
    div.className = `chat-msg chat-msg--${role}`;
    if (role === "assistant") {
      div.innerHTML = renderMarkdown(content);
    } else {
      div.textContent = content;
    }
    list.appendChild(div);
    list.scrollTop = list.scrollHeight;
  }

  async function askAI(question) {
    appendChatMessage("user", question);
    aiMessages.push({ role: "user", content: question });

    const list = $("#chat-list");
    const loading = document.createElement("div");
    loading.className = "chat-msg chat-msg--assistant chat-loading";
    loading.textContent = "思考中…";
    list.appendChild(loading);
    list.scrollTop = list.scrollHeight;

    const btn = $("#btn-send");
    if (btn) btn.disabled = true;

    try {
      const messages = [
        { role: "system", content: AI_CONFIG.systemPrompt },
        ...aiMessages.slice(-10), // 保留最近 10 条作为上下文
      ];
      const resp = await fetch(AI_CONFIG.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + AI_CONFIG.apiKey,
        },
        body: JSON.stringify({
          model: AI_CONFIG.model,
          messages: messages,
          temperature: AI_CONFIG.temperature,
          stream: false,
        }),
      });

      let reply;
      if (resp.ok) {
        const data = await resp.json();
        reply =
          data.choices && data.choices[0] && data.choices[0].message
            ? data.choices[0].message.content
            : "（未获取到有效回答）";
      } else {
        const errText = await resp.text();
        reply = `调用失败（HTTP ${resp.status}）：${errText.slice(0, 300)}`;
      }

      loading.classList.remove("chat-loading");
      loading.innerHTML = renderMarkdown(reply);
      if (!resp.ok) loading.classList.add("chat-error");

      aiMessages.push({ role: "assistant", content: reply });
      saveAiHistory();
    } catch (err) {
      loading.classList.remove("chat-loading");
      loading.classList.add("chat-error");
      loading.textContent = "调用失败：" + (err && err.message ? err.message : err);
    } finally {
      if (btn) btn.disabled = false;
      list.scrollTop = list.scrollHeight;
    }
  }

  function initAI() {
    const input = $("#ai-input");
    const btn = $("#btn-send");
    if (!input || !btn) return;

    loadAiHistory();
    const list = $("#chat-list");
    list.innerHTML = "";
    aiMessages.forEach((m) => {
      if (m.role === "user" || m.role === "assistant") appendChatMessage(m.role, m.content);
    });
    if (!aiMessages.length) {
      appendChatMessage(
        "assistant",
        "你好，我是密切关系威胁识别助手。请描述你的具体情境（例如：是否与被审计单位人员存在亲密、前同事、长期交往或礼品款待关系），我来帮你判断是否存在密切关系威胁并给出建议。"
      );
    }

    const examples = $("#ai-examples");
    if (examples) {
      examples.innerHTML = AI_CONFIG.examples
        .map((e) => `<button class="chip chip--ai" data-q="${esc(e)}">${esc(e)}</button>`)
        .join("");
      examples.addEventListener("click", (ev) => {
        const b = ev.target.closest("button[data-q]");
        if (b) {
          input.value = b.dataset.q;
          input.focus();
        }
      });
    }

    function send() {
      const q = input.value.trim();
      if (!q) return;
      input.value = "";
      askAI(q);
    }

    btn.addEventListener("click", send);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });

    const clearBtn = $("#btn-clear-chat");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        aiMessages = [];
        saveAiHistory();
        list.innerHTML = "";
        appendChatMessage("assistant", "对话已清空。请继续输入你的情境，我来帮你判断是否存在密切关系威胁。");
      });
    }
  }

  /* ---------- 导航与响应式 ---------- */
  function initNav() {
    const burger = $("#nav-toggle");
    const menu = $("#nav-menu");
    if (burger && menu) {
      burger.addEventListener("click", () => {
        const open = menu.classList.toggle("is-open");
        burger.setAttribute("aria-expanded", String(open));
      });
      menu.addEventListener("click", (e) => {
        const a = e.target.closest("a[data-scroll]");
        if (a) {
          e.preventDefault();
          menu.classList.remove("is-open");
          burger.setAttribute("aria-expanded", "false");
          scrollToId(a.dataset.scroll);
        }
      });
    }
  }

  /* ---------- 初始化 ---------- */
  function init() {
    loadState();
    renderThreatTypes();
    renderQuestions();
    renderResult();
    renderScenarios();
    renderCases();
    renderSafeguards();
    initNav();
    initAI();

    $("#year").textContent = new Date().getFullYear();
    $("#btn-start").addEventListener("click", () => scrollToId("self-test"));
  }

  document.addEventListener("DOMContentLoaded", init);
})();
