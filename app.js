/* ═══════════════════════════════════════════════
   AndroidClaw Dashboard — app.js
   Pure JS, no frameworks. Fetches JSON/JSONL.
═══════════════════════════════════════════════ */

'use strict';

/* ── Constants ── */
const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_RUNS_DISPLAY    = 20;
const DATA = {
  agents: 'data/agents.json',
  system: 'data/system.json',
  runs:   'data/runs.jsonl',
  costs:  'data/costs.json',
};

/* ── Agent emoji map (fallback if not in JSON) ── */
const AGENT_EMOJI_MAP = {
  'jjanga-note20':  '🐱',
  'health-watcher': '🛡️',
  'web-crawler':    '🦅',
  'vibe-coder':     '🦉',
  'virtuals-agent': '🤖',
};

/* ── State ── */
let state = {
  agents: [],
  system: null,
  runs:   [],
  costs:  null,
  lastSync: null,
  loading: false,
  errors: [],
};

let refreshTimer = null;

/* ─────────────────────────────────────────────
   FETCH UTILITIES
───────────────────────────────────────────── */

async function fetchJSON(url) {
  const resp = await fetch(url + '?_=' + Date.now()); // cache-bust
  if (!resp.ok) throw new Error(`HTTP ${resp.status} — ${url}`);
  return resp.json();
}

async function fetchJSONL(url) {
  const resp = await fetch(url + '?_=' + Date.now());
  if (!resp.ok) throw new Error(`HTTP ${resp.status} — ${url}`);
  const text = await resp.text();
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      try { return JSON.parse(line); }
      catch { return null; }
    })
    .filter(Boolean);
}

/* ─────────────────────────────────────────────
   LOAD ALL DATA
───────────────────────────────────────────── */

async function loadData() {
  if (state.loading) return;
  state.loading = true;
  state.errors  = [];

  setRefreshButtonLoading(true);

  const results = await Promise.allSettled([
    fetchJSON(DATA.agents),
    fetchJSON(DATA.system),
    fetchJSONL(DATA.runs),
    fetchJSON(DATA.costs),
  ]);

  /* agents */
  if (results[0].status === 'fulfilled') {
    state.agents = results[0].value;
  } else {
    state.errors.push('에이전트 데이터 로딩 실패: ' + results[0].reason.message);
  }

  /* system */
  if (results[1].status === 'fulfilled') {
    state.system = results[1].value;
  } else {
    state.errors.push('시스템 데이터 로딩 실패: ' + results[1].reason.message);
  }

  /* runs */
  if (results[2].status === 'fulfilled') {
    state.runs = results[2].value;
    /* sort newest first */
    state.runs.sort((a, b) => {
      return new Date(b.startedAt || 0) - new Date(a.startedAt || 0);
    });
  } else {
    state.errors.push('실행 기록 로딩 실패: ' + results[2].reason.message);
  }

  /* costs */
  if (results[3].status === 'fulfilled') {
    state.costs = results[3].value;
  } else {
    /* costs.json is optional — no error shown */
    state.costs = null;
  }

  state.lastSync = new Date();
  state.loading  = false;

  render();
  setRefreshButtonLoading(false);
}

/* ─────────────────────────────────────────────
   TIME UTILITIES
───────────────────────────────────────────── */

function relativeTime(isoString) {
  if (!isoString) return '—';
  const diff = Date.now() - new Date(isoString).getTime();
  if (isNaN(diff)) return '—';

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60)  return seconds + '초 전';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60)  return minutes + '분 전';
  const hours = Math.floor(minutes / 60);
  if (hours < 24)    return hours + '시간 전';
  const days = Math.floor(hours / 24);
  return days + '일 전';
}

function formatTimestamp(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('ko-KR', {
    month:  '2-digit',
    day:    '2-digit',
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/* ─────────────────────────────────────────────
   RENDER — SYSTEM BAR
───────────────────────────────────────────── */

function renderSystemBar() {
  const bar = document.getElementById('systemBar');
  if (!bar) return;

  const sys = state.system;

  if (!sys) {
    bar.innerHTML = `<span class="sys-label" style="color:var(--accent-red)">시스템 데이터 없음</span>`;
    return;
  }

  const battery      = sys.phone?.battery ?? '—';
  const storageUsed  = sys.phone?.storage?.used ?? '—';
  const storageTotal = sys.phone?.storage?.total ?? '—';
  const storagePct   = sys.phone?.storage?.percent ?? '—';
  const uptime       = sys.phone?.uptime ?? '—';
  const network      = sys.phone?.network ?? '—';
  const gateway      = sys.openclaw?.gateway ?? '—';

  const batteryClass = battery >= 50 ? 'good' : battery >= 20 ? 'warn' : 'error';
  const gatewayClass = gateway === 'reachable' ? 'good' : 'error';
  const gatewayText  = gateway === 'reachable' ? '연결됨' : '오프라인';
  const batteryEmoji = battery >= 80 ? '🔋' : battery >= 40 ? '🪫' : '❗';

  bar.innerHTML = `
    <div class="sys-item">
      <span class="sys-label">Gateway</span>
      <span class="sys-value ${gatewayClass}">${gatewayText}</span>
    </div>
    <div class="sys-item">
      <span class="sys-label">배터리</span>
      <span class="battery-icon">${batteryEmoji}</span>
      <span class="sys-value ${batteryClass}">${battery}%</span>
    </div>
    <div class="sys-item">
      <span class="sys-label">저장공간</span>
      <span class="sys-value">${storageUsed} / ${storageTotal}</span>
      <span class="sys-value ${storagePct > 80 ? 'warn' : 'good'}" style="font-size:0.7rem">(${storagePct}%)</span>
    </div>
    <div class="sys-item">
      <span class="sys-label">업타임</span>
      <span class="sys-value">${uptime}</span>
    </div>
    <div class="sys-item">
      <span class="sys-label">네트워크</span>
      <span class="sys-value good">${network}</span>
    </div>
  `;
}

/* ─────────────────────────────────────────────
   RENDER — AGENT CARDS
───────────────────────────────────────────── */

function statusKorean(status) {
  const map = {
    WORKING:      '가동 중',
    IDLE:         '대기',
    DISCONNECTED: '오프라인',
    PLANNED:      '예정',
    ERROR:        '오류',
  };
  return map[status] || status;
}

function renderAgentCard(agent) {
  const emoji   = agent.character?.emoji || AGENT_EMOJI_MAP[agent.agentId] || '🤖';
  const color   = agent.character?.color || '#64748b';
  const status  = agent.status || 'DISCONNECTED';
  const lastRun = agent.lastRun ? relativeTime(agent.lastRun) : '—';

  return `
    <div class="agent-card status-${status}" style="--card-color:${color}">
      <div class="agent-card-accent"></div>
      <div class="agent-card-body">
        <div class="agent-card-top">
          <span class="agent-emoji">${emoji}</span>
          <div class="agent-status-dot-wrap">
            <span class="status-dot"></span>
            <span class="status-label">${statusKorean(status)}</span>
          </div>
        </div>
        <div class="agent-name">${escHtml(agent.displayName)}</div>
        <div class="agent-id">${escHtml(agent.agentId)}</div>
        <div class="agent-summary">${escHtml(agent.summary || '—')}</div>
        <div class="agent-last-run">${lastRun}</div>
      </div>
    </div>
  `;
}

function renderAgentGrid() {
  const grid = document.getElementById('agentGrid');
  if (!grid) return;

  if (!state.agents.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <span class="empty-state-icon">🤖</span>
        에이전트 데이터 없음
      </div>`;
    return;
  }

  grid.innerHTML = state.agents.map(renderAgentCard).join('');

  const workingCount = state.agents.filter(a => a.status === 'WORKING').length;
  const total        = state.agents.length;
  const countEl      = document.getElementById('agentCount');
  if (countEl) countEl.textContent = `${workingCount}/${total} 가동`;
}

/* ─────────────────────────────────────────────
   RENDER — ACTIVITY TIMELINE (home tab)
───────────────────────────────────────────── */

function getAgentEmoji(agentId) {
  const agent = state.agents.find(a => a.agentId === agentId);
  return agent?.character?.emoji || AGENT_EMOJI_MAP[agentId] || '🤖';
}

function getAgentName(agentId) {
  const agent = state.agents.find(a => a.agentId === agentId);
  return agent?.displayName || agentId;
}

function renderTimelineItem(run) {
  const nodeClass = run.status === 'success' ? 'success'
                  : run.status === 'error'   ? 'error'
                  : 'warning';

  const tagClass  = run.status === 'success' ? 'success' : 'error';
  const tagText   = run.status === 'success' ? '성공' : '실패';

  return `
    <div class="timeline-item">
      <div class="timeline-left">
        <div class="timeline-node ${nodeClass}"></div>
        <div class="timeline-line"></div>
      </div>
      <div class="timeline-content">
        <div class="timeline-content-top">
          <div class="timeline-agent">
            <span class="timeline-agent-emoji">${getAgentEmoji(run.agentId)}</span>
            ${escHtml(getAgentName(run.agentId))}
          </div>
          <div class="timeline-meta">
            <span class="timeline-type">${escHtml(run.type || 'cron')}</span>
            <span class="timeline-status-tag ${tagClass}">${tagText}</span>
            <span class="timeline-time">${relativeTime(run.startedAt)}</span>
          </div>
        </div>
        <div class="timeline-summary">${escHtml(run.summary || '—')}</div>
      </div>
    </div>
  `;
}

function renderTimeline() {
  const timeline = document.getElementById('timeline');
  if (!timeline) return;

  const recentRuns = state.runs.slice(0, MAX_RUNS_DISPLAY);

  if (!recentRuns.length) {
    timeline.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">📋</span>
        실행 기록 없음
      </div>`;
    return;
  }

  timeline.innerHTML = recentRuns.map(renderTimelineItem).join('');

  const countEl = document.getElementById('activityCount');
  if (countEl) countEl.textContent = recentRuns.length + '개';
}

/* ─────────────────────────────────────────────
   RENDER — RUNS TABLE (runs tab)
───────────────────────────────────────────── */

function renderRunsTable() {
  const wrap = document.getElementById('runsTableWrap');
  if (!wrap) return;

  if (!state.runs.length) {
    wrap.innerHTML = `<div class="empty-state"><span class="empty-state-icon">📋</span>실행 기록 없음</div>`;
    return;
  }

  const rows = state.runs.map(run => `
    <tr>
      <td class="run-id-cell">${escHtml(run.runId || '—')}</td>
      <td>
        <span style="margin-right:6px">${getAgentEmoji(run.agentId)}</span>
        ${escHtml(getAgentName(run.agentId))}
      </td>
      <td><span class="timeline-type">${escHtml(run.type || '—')}</span></td>
      <td class="mono">${formatTimestamp(run.startedAt)}</td>
      <td><span class="timeline-status-tag ${run.status === 'success' ? 'success' : 'error'}">${run.status === 'success' ? '성공' : '실패'}</span></td>
      <td style="color:var(--text-muted);font-size:0.73rem">${escHtml(run.summary || '—')}</td>
    </tr>
  `).join('');

  wrap.innerHTML = `
    <div class="runs-table-wrap">
      <table class="runs-table">
        <thead>
          <tr>
            <th>실행 ID</th>
            <th>에이전트</th>
            <th>유형</th>
            <th>시작 시간</th>
            <th>결과</th>
            <th>요약</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

/* ─────────────────────────────────────────────
   RENDER — COSTS PANEL (costs tab)
───────────────────────────────────────────── */

/* ── Helper: resource bar HTML ── */
function resourceBar(label, icon, usedLabel, totalLabel, percent, colorVar) {
  const cls = percent > 85 ? 'alert' : percent > 65 ? 'warn' : '';
  return `
    <div class="resource-row">
      <div class="resource-row-header">
        <span class="resource-icon">${icon}</span>
        <span class="resource-label">${label}</span>
        <span class="resource-nums">${escHtml(usedLabel)} / ${escHtml(totalLabel)}</span>
      </div>
      <div class="resource-bar">
        <div class="resource-bar-fill ${cls}" style="width:${Math.min(percent,100)}%;--bar-color:var(${colorVar})"></div>
      </div>
      <span class="resource-pct">${percent}%</span>
    </div>`;
}

/* ── Helper: LLM card HTML ── */
function llmCard(data, accentColor, defaultModel, defaultSub) {
  const model = data?.model || defaultModel;
  const sub   = data?.subscription || defaultSub;
  const today = data?.sessions_today ?? '—';
  const total = data?.sessions_total ?? '—';
  const last  = data?.last_used ? relativeTime(data.last_used) : '사용 기록 없음';

  return `
    <div class="llm-card" style="--llm-accent:${accentColor}">
      <div class="llm-card-accent"></div>
      <div class="llm-card-body">
        <div class="llm-model">${escHtml(model)}</div>
        <div class="llm-sub">${escHtml(sub)}</div>
        <div class="llm-stats">
          <div class="llm-stat">
            <span class="llm-stat-value">${today}</span>
            <span class="llm-stat-label">오늘 세션</span>
          </div>
          <div class="llm-stat">
            <span class="llm-stat-value">${total}</span>
            <span class="llm-stat-label">전체 세션</span>
          </div>
        </div>
        <div class="llm-last-used">마지막: ${last}</div>
      </div>
    </div>`;
}

function renderCosts() {
  const panel = document.getElementById('costsPanel');
  if (!panel) return;

  const c = state.costs;
  const mem = c?.phone_resources?.memory;
  const sto = c?.phone_resources?.storage;
  const bat = c?.phone_resources?.battery;
  const cpu = c?.phone_resources?.cpu;
  const gpt = c?.llm_usage?.gpt;
  const claude = c?.llm_usage?.claude;
  const stats = c?.agent_stats;

  /* fallback from runs state if no costs.json */
  const totalRuns   = stats?.runs_today ?? state.runs.length;
  const successRuns = stats?.success_today ?? state.runs.filter(r => r.status === 'success').length;
  const errorRuns   = stats?.errors_today ?? (totalRuns - successRuns);
  const successRate = totalRuns > 0 ? Math.round(successRuns / totalRuns * 100) : 0;
  const cronJobs    = stats?.cron_jobs_active ?? '—';

  /* memory display */
  const memUsed    = mem ? `${(mem.used_mb / 1024).toFixed(1)}G` : '—';
  const memTotal   = mem ? `${(mem.total_mb / 1024).toFixed(1)}G` : '—';
  const memPct     = mem?.percent ?? 0;

  /* storage display */
  const stoUsed  = sto?.used ?? '—';
  const stoTotal = sto?.total ?? '—';
  const stoPct   = sto?.percent ?? 0;

  /* battery display */
  const batLevel  = bat?.level ?? (state.system?.phone?.battery ?? -1);
  const batStatus = bat?.status ?? 'unknown';
  const batTemp   = bat?.temperature ?? '—';
  const batStatusKo = { CHARGING: '충전 중', DISCHARGING: '방전', FULL: '완충', NOT_CHARGING: '미충전' };

  /* cpu display */
  const cpuLoad = cpu ? cpu.load_1m.toFixed(2) : '—';

  panel.innerHTML = `
    <!-- ── Phone Resources ── -->
    <div class="costs-section">
      <div class="costs-section-header">
        <span class="costs-section-icon">📱</span>
        <span class="costs-section-title">폰 리소스</span>
      </div>
      <div class="resources-grid">
        ${resourceBar('메모리 (RAM)', '🧠', memUsed, memTotal, memPct, '--accent-purple')}
        ${resourceBar('저장공간', '💾', stoUsed, stoTotal, stoPct, '--accent-blue')}
        ${resourceBar('배터리', batLevel >= 80 ? '🔋' : batLevel >= 40 ? '🪫' : '❗', batLevel + '%', batStatusKo[batStatus] || batStatus, Math.max(batLevel, 0), '--accent-green')}
      </div>
      <div class="resource-extra">
        <div class="resource-extra-item">
          <span class="resource-extra-label">CPU 부하 (1m)</span>
          <span class="resource-extra-value">${cpuLoad}</span>
        </div>
        <div class="resource-extra-item">
          <span class="resource-extra-label">배터리 온도</span>
          <span class="resource-extra-value">${batTemp !== '—' ? batTemp + '°C' : '—'}</span>
        </div>
        <div class="resource-extra-item">
          <span class="resource-extra-label">활성 Cron</span>
          <span class="resource-extra-value">${cronJobs}개</span>
        </div>
      </div>
    </div>

    <!-- ── LLM Usage ── -->
    <div class="costs-section">
      <div class="costs-section-header">
        <span class="costs-section-icon">🤖</span>
        <span class="costs-section-title">LLM 사용량</span>
      </div>
      <div class="llm-grid">
        ${llmCard(gpt, '#10B981', 'GPT-5.2 (Codex)', 'ChatGPT Plus OAuth')}
        ${llmCard(claude, '#7C3AED', 'Opus 4.6', 'Claude Max 5x')}
      </div>
    </div>

    <!-- ── Agent Stats ── -->
    <div class="costs-section">
      <div class="costs-section-header">
        <span class="costs-section-icon">📊</span>
        <span class="costs-section-title">에이전트 실행 통계</span>
      </div>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${totalRuns}</div>
          <div class="stat-label">오늘 실행</div>
        </div>
        <div class="stat-card stat-success">
          <div class="stat-value">${successRuns}</div>
          <div class="stat-label">성공</div>
        </div>
        <div class="stat-card stat-error">
          <div class="stat-value">${errorRuns}</div>
          <div class="stat-label">실패</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${successRate}%</div>
          <div class="stat-label">성공률</div>
          <div class="stat-bar">
            <div class="stat-bar-fill" style="width:${successRate}%"></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/* ─────────────────────────────────────────────
   RENDER — HEADER SYNC TIME
───────────────────────────────────────────── */

function renderSyncTime() {
  const el = document.getElementById('lastSyncTime');
  if (!el) return;
  if (!state.lastSync) { el.textContent = '—'; return; }
  el.textContent = relativeTime(state.lastSync.toISOString());
}

/* ─────────────────────────────────────────────
   RENDER — ERROR BANNER
───────────────────────────────────────────── */

function renderErrors() {
  const banner = document.getElementById('errorBanner');
  if (!banner) return;
  if (state.errors.length === 0) {
    banner.classList.remove('visible');
    banner.textContent = '';
  } else {
    banner.classList.add('visible');
    banner.textContent = '⚠ ' + state.errors.join(' | ');
  }
}

/* ─────────────────────────────────────────────
   MASTER RENDER
───────────────────────────────────────────── */

function render() {
  renderErrors();
  renderSystemBar();
  renderAgentGrid();
  renderTimeline();
  renderRunsTable();
  renderCosts();
  renderSyncTime();
}

/* ─────────────────────────────────────────────
   TAB SWITCHING
───────────────────────────────────────────── */

function initTabs() {
  const buttons = document.querySelectorAll('.tab-btn');
  const panels  = document.querySelectorAll('.tab-panel');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;

      buttons.forEach(b => b.classList.remove('active'));
      panels.forEach(p  => p.classList.remove('active'));

      btn.classList.add('active');
      const panel = document.getElementById('tab-' + target);
      if (panel) panel.classList.add('active');
    });
  });
}

/* ─────────────────────────────────────────────
   REFRESH BUTTON
───────────────────────────────────────────── */

function setRefreshButtonLoading(loading) {
  const btn  = document.getElementById('refreshBtn');
  const icon = document.getElementById('refreshIcon');
  if (!btn) return;

  if (loading) {
    btn.classList.add('loading');
    btn.disabled = true;
    if (icon) icon.style.display = 'inline-block';
  } else {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

function initRefreshButton() {
  const btn = document.getElementById('refreshBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    clearInterval(refreshTimer);
    loadData();
    refreshTimer = setInterval(loadData, REFRESH_INTERVAL_MS);
  });
}

/* ─────────────────────────────────────────────
   RELATIVE TIME TICKER — updates every 30s
───────────────────────────────────────────── */

function tickRelativeTimes() {
  renderSyncTime();
  if (state.agents.length) renderAgentGrid();
  if (state.runs.length)   renderTimeline();
}

/* ─────────────────────────────────────────────
   HTML ESCAPE UTILITY
───────────────────────────────────────────── */

function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initRefreshButton();

  loadData();

  refreshTimer = setInterval(loadData, REFRESH_INTERVAL_MS);
  setInterval(tickRelativeTimes, 30 * 1000);
});
