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
  health: 'data/health.json',
  tradebot: 'data/tradebot.json',
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
  health: null,
  tradebot: null,
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
    fetchJSON(DATA.health),
    fetchJSON(DATA.tradebot),
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
    state.costs = null;
  }

  /* health */
  if (results[4].status === 'fulfilled') {
    state.health = results[4].value;
  } else {
    state.health = null;
  }

  /* tradebot */
  if (results[5].status === 'fulfilled') {
    state.tradebot = results[5].value;
  } else {
    state.tradebot = null;
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

  const batteryRaw   = sys.phone?.battery ?? -1;
  const batteryOk    = batteryRaw >= 0;
  const storageUsed  = sys.phone?.storage?.used ?? '—';
  const storageTotal = sys.phone?.storage?.total ?? '—';
  const storagePct   = sys.phone?.storage?.percent ?? '—';
  const uptime       = sys.phone?.uptime ?? '—';
  const network      = sys.phone?.network ?? '—';
  const gateway      = sys.openclaw?.gateway ?? '—';

  const batteryClass = !batteryOk ? '' : batteryRaw >= 50 ? 'good' : batteryRaw >= 20 ? 'warn' : 'error';
  const gatewayClass = gateway === 'reachable' ? 'good' : 'error';
  const gatewayText  = gateway === 'reachable' ? '연결됨' : '오프라인';
  const batteryEmoji = !batteryOk ? '❓' : batteryRaw >= 80 ? '🔋' : batteryRaw >= 40 ? '🪫' : '❗';
  const batteryText  = batteryOk ? `${batteryRaw}%` : '—';

  bar.innerHTML = `
    <div class="sys-item">
      <span class="sys-label">Gateway</span>
      <span class="sys-value ${gatewayClass}">${gatewayText}</span>
    </div>
    <div class="sys-item">
      <span class="sys-label">배터리</span>
      <span class="battery-icon">${batteryEmoji}</span>
      <span class="sys-value ${batteryClass}">${batteryText}</span>
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
   RENDER — SERVER HEALTH MONITORING
───────────────────────────────────────────── */

function serverStatusInfo(srv) {
  const fails = srv.consecutiveFailures || 0;
  if (srv.status === 'healthy' && fails === 0)
    return { cls: 'healthy', label: '정상', color: 'var(--accent-green)' };
  if (srv.status === 'warning' || (fails > 0 && fails < 3))
    return { cls: 'warning', label: '주의', color: 'var(--accent-yellow)' };
  return { cls: 'down', label: '장애', color: 'var(--accent-red)' };
}

function renderServerCard(srv) {
  const si = serverStatusInfo(srv);
  const lastCheck = srv.lastCheck ? relativeTime(srv.lastCheck) : '—';
  const checks = srv.checks || {};
  const metrics = srv.metrics || {};

  /* Build check pills */
  const pills = [];
  if (checks.ssh != null)
    pills.push(`<span class="srv-pill ${checks.ssh ? 'ok' : 'fail'}">SSH ${checks.ssh ? '✓' : '✗'}</span>`);
  if (checks.gateway != null)
    pills.push(`<span class="srv-pill ${checks.gateway ? 'ok' : 'fail'}">Gateway ${checks.gateway ? '✓' : '✗'}</span>`);
  if (checks.brain_py != null)
    pills.push(`<span class="srv-pill ${checks.brain_py ? 'ok' : 'fail'}">brain.py ${checks.brain_py ? '✓' : '✗'}</span>`);
  if (checks.timers != null)
    pills.push(`<span class="srv-pill ok">Timers ${checks.timers}</span>`);

  /* Build metric items */
  const metricItems = [];
  if (metrics.pnl_today != null)
    metricItems.push(`<div class="srv-metric"><span class="srv-metric-k">PnL</span><span class="srv-metric-v ${metrics.pnl_today.startsWith('+') ? 'positive' : metrics.pnl_today.startsWith('-') ? 'negative' : ''}">${escHtml(metrics.pnl_today)}</span></div>`);
  if (metrics.positions != null)
    metricItems.push(`<div class="srv-metric"><span class="srv-metric-k">포지션</span><span class="srv-metric-v">${metrics.positions}</span></div>`);
  if (metrics.strategies_active != null)
    metricItems.push(`<div class="srv-metric"><span class="srv-metric-k">전략</span><span class="srv-metric-v">${metrics.strategies_active}</span></div>`);
  if (metrics.strategies_generated != null)
    metricItems.push(`<div class="srv-metric"><span class="srv-metric-k">생성 전략</span><span class="srv-metric-v">${metrics.strategies_generated}</span></div>`);
  if (metrics.reflections_today != null)
    metricItems.push(`<div class="srv-metric"><span class="srv-metric-k">성찰</span><span class="srv-metric-v">${metrics.reflections_today}</span></div>`);
  if (checks.last_sync)
    metricItems.push(`<div class="srv-metric"><span class="srv-metric-k">동기화</span><span class="srv-metric-v">${relativeTime(checks.last_sync)}</span></div>`);

  return `
    <div class="server-card srv-${si.cls}" style="--srv-color:${si.color}">
      <div class="server-card-accent"></div>
      <div class="server-card-body">
        <div class="srv-header">
          <span class="srv-emoji">${srv.emoji || '🖥️'}</span>
          <div class="srv-title-block">
            <div class="srv-name">${escHtml(srv.name)}</div>
            <div class="srv-host">${escHtml(srv.host)} · ${escHtml(srv.role || srv.zone)}</div>
          </div>
          <div class="srv-status-badge">
            <span class="srv-status-dot"></span>
            <span class="srv-status-label">${si.label}</span>
          </div>
        </div>
        <div class="srv-checks">${pills.join('')}</div>
        ${metricItems.length ? `<div class="srv-metrics">${metricItems.join('')}</div>` : ''}
        <div class="srv-footer">점검: ${lastCheck}</div>
      </div>
    </div>`;
}

function renderServerGrid() {
  const grid = document.getElementById('serverGrid');
  if (!grid) return;

  const servers = state.health?.servers;
  if (!servers || !servers.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <span class="empty-state-icon">🖥️</span>
        서버 헬스 데이터 없음
      </div>`;
    const countEl = document.getElementById('serverCount');
    if (countEl) countEl.textContent = '—';
    return;
  }

  grid.innerHTML = servers.map(renderServerCard).join('');

  const healthyCount = servers.filter(s => s.status === 'healthy').length;
  const countEl = document.getElementById('serverCount');
  if (countEl) countEl.textContent = `${healthyCount}/${servers.length} 정상`;
}

/* ─────────────────────────────────────────────
   RENDER — AGENT CARDS
───────────────────────────────────────────── */

function statusKorean(status) {
  const map = {
    WORKING:      '가동 중',
    IDLE:         '대기',
    SLEEPING:     '수면',
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

  const workingCount  = state.agents.filter(a => a.status === 'WORKING').length;
  const sleepingCount = state.agents.filter(a => a.status === 'SLEEPING').length;
  const errorCount    = state.agents.filter(a => a.status === 'ERROR').length;
  const total         = state.agents.length;
  const countEl       = document.getElementById('agentCount');
  if (countEl) {
    let text = `${workingCount}/${total} 가동`;
    if (sleepingCount > 0) text += ` · ${sleepingCount} 수면`;
    if (errorCount > 0)    text += ` · ${errorCount} 오류`;
    countEl.textContent = text;
  }
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

/* ── Token formatter ── */
function fmtTokens(n) {
  if (n == null || isNaN(n)) return '—';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return Math.round(n / 1000) + 'K';
  return String(n);
}

/* ── Format reset time from epoch ms ── */
function fmtResetTime(epochMs) {
  if (!epochMs) return '';
  const diff = epochMs - Date.now();
  if (diff <= 0) return '리셋됨';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}분 후`;
  const hrs = Math.floor(mins / 60);
  const remMin = mins % 60;
  if (hrs < 24) return remMin > 0 ? `${hrs}h ${remMin}m` : `${hrs}h`;
  const days = Math.floor(hrs / 24);
  const remHr = hrs % 24;
  return `${days}d ${remHr}h`;
}

/* ── SVG donut chart ── */
function svgDonut(pct, color, size, label) {
  const r = (size / 2) - 8;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(pct, 100) / 100);
  const gradId = 'g' + Math.random().toString(36).slice(2, 8);
  const labelText = label || '사용';
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="donut-svg">
      <defs>
        <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${color}" />
          <stop offset="100%" stop-color="${color}99" />
        </linearGradient>
      </defs>
      <circle cx="${size/2}" cy="${size/2}" r="${r}"
        stroke="var(--border)" stroke-width="6" fill="none" opacity="0.5" />
      <circle cx="${size/2}" cy="${size/2}" r="${r}"
        stroke="url(#${gradId})" stroke-width="6" fill="none"
        stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"
        stroke-linecap="round" transform="rotate(-90 ${size/2} ${size/2})"
        class="donut-fill" />
      <text x="${size/2}" y="${size/2 - 4}" text-anchor="middle"
        fill="var(--text-primary)" font-family="var(--font-mono)"
        font-size="${size * 0.22}" font-weight="700">${pct}%</text>
      <text x="${size/2}" y="${size/2 + 10}" text-anchor="middle"
        fill="var(--text-dim)" font-family="var(--font-mono)"
        font-size="${size * 0.1}">${labelText}</text>
    </svg>`;
}

/* ── Resource meter (phone resources) ── */
function resourceMeter(label, icon, usedLabel, totalLabel, pct, color) {
  const cls = pct > 85 ? 'alert' : pct > 65 ? 'warn' : '';
  return `
    <div class="res-meter">
      <div class="res-meter-icon">${icon}</div>
      <div class="res-meter-body">
        <div class="res-meter-top">
          <span class="res-meter-label">${label}</span>
          <span class="res-meter-nums">${escHtml(usedLabel)} / ${escHtml(totalLabel)}</span>
        </div>
        <div class="res-meter-bar">
          <div class="res-meter-fill ${cls}" style="width:${Math.min(pct,100)}%;background:${color}"></div>
        </div>
      </div>
      <div class="res-meter-pct ${cls}">${pct}%</div>
    </div>`;
}

/* ── LLM usage card with donut ── */
/* Handles TWO data formats:
   - Claude (turn-based): tokens_today_est, daily_limit_est, sessions_today, turns_today
   - GPT (openclaw sessions): total_tokens, context_tokens, input_tokens, output_tokens
     + window_5h_pct, window_weekly_pct, today_tokens */
function llmUsageCard(data, color, icon, defaultModel, defaultSub) {
  const model   = data?.model || defaultModel;
  const sub     = data?.subscription || defaultSub;
  const isReal  = data?.source === 'openclaw_sessions'; /* GPT real data */

  /* (A) Session cumulative tokens */
  const sessTok = data?.total_tokens || 0;
  const ctxTok  = data?.context_tokens || 0;

  /* (B) Today's tokens (daily snapshot diff) */
  const todayTok = data?.today_tokens ?? null;

  /* (C) Window percentages (5h / weekly) + reset times */
  const win5h  = data?.window_5h_pct ?? null;
  const winWk  = data?.window_weekly_pct ?? null;
  const reset5h  = data?.window_5h_reset ?? null;
  const resetWk  = data?.window_weekly_reset ?? null;

  /* Fallback for Claude: estimated tokens */
  const estTok  = data?.tokens_today_est || 0;
  const estCap  = data?.daily_limit_est || 1800000;

  /* Donut: prefer 5h window (C), then session/context ratio (A), then estimated */
  let donutPct, donutLabel;
  if (isReal && win5h != null) {
    donutPct = Math.min(Math.round(win5h), 100);
    donutLabel = '5h 윈도우';
  } else if (isReal && ctxTok > 0) {
    donutPct = Math.min(Math.round(sessTok / ctxTok * 100), 100);
    donutLabel = '세션';
  } else {
    donutPct = estCap > 0 ? Math.min(Math.round(estTok / estCap * 100), 100) : 0;
    donutLabel = '추정';
  }

  /* Token bar: session/context (A) for real, estimated for Claude */
  const barUsed = isReal ? sessTok : estTok;
  const barCap  = isReal ? (ctxTok || 272000) : estCap;
  const barPct  = barCap > 0 ? Math.min(Math.round(barUsed / barCap * 100), 100) : 0;
  const barCls  = barPct > 80 ? 'alert' : barPct > 60 ? 'warn' : '';
  const barLeft = Math.max(0, barCap - barUsed);
  const barUsedLabel = isReal ? '세션' : '추정';
  const barCapLabel  = isReal ? '컨텍스트' : '일일용량';

  /* Last used — handle both ISO string and ms epoch */
  let lastStr = '—';
  if (data?.last_used) {
    const ts = data.last_used;
    lastStr = relativeTime(typeof ts === 'number' ? new Date(ts).toISOString() : ts);
  }

  /* No-data diagnostic */
  const noData = barUsed === 0 && !data?.last_used;
  let noDataHint = '';
  if (noData && data?.binary_found === false) {
    noDataHint = '<div class="llm-no-data">CLI 미설치</div>';
  } else if (noData && data?.source === 'unknown') {
    noDataHint = '<div class="llm-no-data">세션 데이터 없음</div>';
  } else if (noData) {
    noDataHint = '<div class="llm-no-data">오늘 사용 기록 없음</div>';
  }

  /* Bottom meta — 3 items, adapted to data format */
  let metaHtml;
  if (isReal) {
    /* GPT: 오늘(B) | 주간%(C) or 입출력 | 마지막 */
    const col1Val = todayTok != null ? fmtTokens(todayTok) : fmtTokens(data?.input_tokens ?? 0);
    const col1Key = todayTok != null ? '오늘' : '입력';
    const col2Val = winWk != null ? winWk + '%' : fmtTokens(data?.output_tokens ?? 0);
    const col2Key = winWk != null ? '주간' : '출력';
    metaHtml = `
      <div class="llm-meta-item">
        <span class="llm-meta-val">${col1Val}</span>
        <span class="llm-meta-key">${col1Key}</span>
      </div>
      <div class="llm-meta-divider"></div>
      <div class="llm-meta-item">
        <span class="llm-meta-val">${col2Val}</span>
        <span class="llm-meta-key">${col2Key}</span>
      </div>
      <div class="llm-meta-divider"></div>
      <div class="llm-meta-item">
        <span class="llm-meta-val llm-meta-time">${lastStr}</span>
        <span class="llm-meta-key">마지막</span>
      </div>`;
  } else {
    /* Claude: 턴 | 세션 | 마지막 */
    metaHtml = `
      <div class="llm-meta-item">
        <span class="llm-meta-val">${data?.turns_today ?? 0}</span>
        <span class="llm-meta-key">오늘 턴</span>
      </div>
      <div class="llm-meta-divider"></div>
      <div class="llm-meta-item">
        <span class="llm-meta-val">${data?.sessions_today ?? 0}</span>
        <span class="llm-meta-key">오늘 세션</span>
      </div>
      <div class="llm-meta-divider"></div>
      <div class="llm-meta-item">
        <span class="llm-meta-val llm-meta-time">${lastStr}</span>
        <span class="llm-meta-key">마지막</span>
      </div>`;
  }

  return `
    <div class="llm-card" style="--llm-color:${color}">
      <div class="llm-card-glow"></div>
      <div class="llm-card-inner">
        <div class="llm-header">
          <div class="llm-donut">${svgDonut(donutPct, color, 90, donutLabel)}</div>
          <div class="llm-title-block">
            <div class="llm-icon">${icon}</div>
            <div class="llm-model">${escHtml(model)}</div>
            <div class="llm-sub">${escHtml(sub)}</div>
          </div>
        </div>
        ${noDataHint}

        <div class="llm-token-section">
          <div class="llm-token-bar-wrap">
            <div class="llm-token-bar">
              <div class="llm-token-fill ${barCls}" style="width:${barPct}%;background:${color}"></div>
            </div>
            <div class="llm-token-labels">
              <span>${fmtTokens(barUsed)} ${barUsedLabel}</span>
              <span>${fmtTokens(barCap)} ${barCapLabel}</span>
            </div>
          </div>
          <div class="llm-remaining">
            <span class="llm-remaining-icon">💎</span>
            <span>잔여 용량</span>
            <span class="llm-remaining-value">~${fmtTokens(barLeft)}</span>
          </div>
        </div>
        ${(win5h != null || winWk != null) ? `
        <div class="llm-windows-section">
          ${win5h != null ? `
          <div class="llm-win-row">
            <span class="llm-win-label">5h</span>
            <div class="llm-win-bar">
              <div class="llm-win-fill ${win5h > 80 ? 'alert' : win5h > 60 ? 'warn' : ''}" style="width:${Math.min(win5h, 100)}%;background:${color}"></div>
            </div>
            <span class="llm-win-pct">${win5h}%</span>
            <span class="llm-win-reset">${reset5h ? fmtResetTime(reset5h) : ''}</span>
          </div>` : ''}
          ${winWk != null ? `
          <div class="llm-win-row">
            <span class="llm-win-label">Week</span>
            <div class="llm-win-bar">
              <div class="llm-win-fill ${winWk > 80 ? 'alert' : winWk > 60 ? 'warn' : ''}" style="width:${Math.min(winWk, 100)}%;background:${color}"></div>
            </div>
            <span class="llm-win-pct">${winWk}%</span>
            <span class="llm-win-reset">${resetWk ? fmtResetTime(resetWk) : ''}</span>
          </div>` : ''}
        </div>` : ''}

        <div class="llm-meta">${metaHtml}</div>
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

  /* fallback from runs state */
  const totalRuns   = stats?.runs_today ?? state.runs.length;
  const successRuns = stats?.success_today ?? state.runs.filter(r => r.status === 'success').length;
  const errorRuns   = stats?.errors_today ?? (totalRuns - successRuns);
  const successRate = totalRuns > 0 ? Math.round(successRuns / totalRuns * 100) : 0;
  const cronJobs    = stats?.cron_jobs_active ?? '—';

  /* memory */
  const memUsed  = mem ? `${(mem.used_mb / 1024).toFixed(1)}G` : '—';
  const memTotal = mem ? `${(mem.total_mb / 1024).toFixed(1)}G` : '—';
  const memPct   = mem?.percent ?? 0;

  /* storage */
  const stoUsed  = sto?.used ?? '—';
  const stoTotal = sto?.total ?? '—';
  const stoPct   = sto?.percent ?? 0;

  /* battery */
  const batLevel  = bat?.level ?? (state.system?.phone?.battery ?? -1);
  const batOk     = batLevel >= 0;
  const batStatus = bat?.status ?? 'unknown';
  const batTemp   = bat?.temperature ?? '—';
  const batKo = { CHARGING:'충전 중', DISCHARGING:'방전', FULL:'완충', NOT_CHARGING:'미충전' };
  const batIcon = !batOk ? '❓' : batLevel >= 80 ? '🔋' : batLevel >= 40 ? '🪫' : '❗';

  /* cpu */
  const cpuLoad = cpu ? cpu.load_1m.toFixed(2) : '—';

  panel.innerHTML = `
    <!-- ── LLM Usage (hero section) ── -->
    <div class="costs-section costs-section-hero">
      <div class="costs-section-header">
        <span class="costs-section-icon">🤖</span>
        <span class="costs-section-title">LLM 사용량</span>
        <span class="costs-section-badge">실시간 + 추정</span>
      </div>
      <div class="llm-grid">
        ${llmUsageCard(gpt, '#10B981', '🟢', 'GPT-5.2 (Codex)', 'ChatGPT Plus OAuth')}
        ${llmUsageCard(claude, '#A78BFA', '🟣', 'Opus 4.6', 'Claude Max 5x')}
      </div>
    </div>

    <!-- ── Phone Resources ── -->
    <div class="costs-section">
      <div class="costs-section-header">
        <span class="costs-section-icon">📱</span>
        <span class="costs-section-title">폰 리소스</span>
      </div>
      <div class="res-meters">
        ${resourceMeter('메모리 (RAM)', '🧠', memUsed, memTotal, memPct, 'var(--accent-purple)')}
        ${resourceMeter('저장공간', '💾', stoUsed, stoTotal, stoPct, 'var(--accent-blue)')}
        ${resourceMeter('배터리', batIcon, batOk ? batLevel + '%' : '—', batOk ? (batKo[batStatus] || batStatus) : 'API 없음', Math.max(batLevel, 0), 'var(--accent-green)')}
      </div>
      <div class="res-extras">
        <div class="res-extra"><span class="res-extra-k">CPU</span><span class="res-extra-v">${cpuLoad}</span></div>
        <div class="res-extra"><span class="res-extra-k">온도</span><span class="res-extra-v">${batTemp !== '—' ? batTemp + '°C' : '—'}</span></div>
        <div class="res-extra"><span class="res-extra-k">Cron</span><span class="res-extra-v">${cronJobs}개</span></div>
      </div>
    </div>

    <!-- ── Agent Stats ── -->
    <div class="costs-section">
      <div class="costs-section-header">
        <span class="costs-section-icon">📊</span>
        <span class="costs-section-title">에이전트 통계</span>
      </div>
      <div class="agent-stats-row">
        <div class="astat"><span class="astat-v">${totalRuns}</span><span class="astat-k">실행</span></div>
        <div class="astat astat-ok"><span class="astat-v">${successRuns}</span><span class="astat-k">성공</span></div>
        <div class="astat astat-err"><span class="astat-v">${errorRuns}</span><span class="astat-k">실패</span></div>
        <div class="astat astat-rate">
          <span class="astat-v">${successRate}%</span>
          <span class="astat-k">성공률</span>
          <div class="astat-bar"><div class="astat-bar-fill" style="width:${successRate}%"></div></div>
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
   RENDER — TRADING PANEL (v2 enriched)
───────────────────────────────────────────── */

function fmtKRW(n) {
  if (n == null || isNaN(n)) return '\u20a90';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1000000) return sign + '\u20a9' + (abs / 1000000).toFixed(1) + 'M';
  if (abs >= 1000) return sign + '\u20a9' + Math.round(abs / 1000).toLocaleString() + 'K';
  return sign + '\u20a9' + Math.round(abs).toLocaleString();
}

function confidenceBadge(c) {
  if (c == null) return '';
  const pct = Math.round(c * 100);
  const cls = pct >= 60 ? 'high' : pct >= 40 ? 'mid' : 'low';
  return `<span class="conf-badge conf-${cls}">${pct}%</span>`;
}


/* ── Donut Chart Colors ── */
const DONUT_COLORS = [
  '#F59E0B','#60A5FA','#34D399','#F472B6','#A78BFA',
  '#FB923C','#2DD4BF','#E879F9','#FCD34D','#6EE7B7',
];

function svgDonutChart(allocation, size) {
  if (!allocation || !allocation.length) return '';
  const cx = size / 2, cy = size / 2, r = size / 2 - 12, r2 = r - 16;
  let cumAngle = -90;
  const paths = [];
  const legends = [];

  allocation.forEach((item, i) => {
    const angle = (item.pct / 100) * 360;
    const startRad = (cumAngle * Math.PI) / 180;
    const endRad = ((cumAngle + angle) * Math.PI) / 180;
    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);
    const x1i = cx + r2 * Math.cos(startRad);
    const y1i = cy + r2 * Math.sin(startRad);
    const x2i = cx + r2 * Math.cos(endRad);
    const y2i = cy + r2 * Math.sin(endRad);
    const largeArc = angle > 180 ? 1 : 0;
    const color = DONUT_COLORS[i % DONUT_COLORS.length];

    if (item.pct >= 100) {
      // Full circle
      paths.push(`<circle cx="${cx}" cy="${cy}" r="${(r+r2)/2}" fill="none" stroke="${color}" stroke-width="${r-r2}" />`);
    } else if (item.pct > 0.5) {
      paths.push(`<path d="M${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} L${x2i},${y2i} A${r2},${r2} 0 ${largeArc},0 ${x1i},${y1i} Z" fill="${color}" opacity="0.85"><title>${item.name}: ${item.pct}%</title></path>`);
    }

    legends.push(`<span class="donut-legend-item"><span class="donut-dot" style="background:${color}"></span>${item.name} <b>${item.pct}%</b></span>`);
    cumAngle += angle;
  });

  return `
    <div class="donut-container">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        ${paths.join('')}
        <text x="${cx}" y="${cy - 6}" text-anchor="middle" fill="var(--text-primary)" font-size="12" font-weight="700" font-family="var(--font-mono)">\ubcf4\uc720\ube44\uc911</text>
        <text x="${cx}" y="${cy + 10}" text-anchor="middle" fill="var(--text-dim)" font-size="10" font-family="var(--font-mono)">(%)</text>
      </svg>
      <div class="donut-legend">${legends.join('')}</div>
    </div>`;
}

function svgLineChart(history, exchangeName, width, height) {
  if (!history || !history.length) return '<div class="chart-empty">\ub370\uc774\ud130 \uc218\uc9d1 \uc911...</div>';

  const exHistory = history.filter(h => h.exchange === exchangeName);
  if (!exHistory.length) return '<div class="chart-empty">\ud788\uc2a4\ud1a0\ub9ac \uc5c6\uc74c</div>';

  const values = exHistory.map(h => h.portfolio_value);
  const dates = exHistory.map(h => h.date);
  const cashValues = exHistory.map(h => h.cash_krw);

  const minVal = Math.min(...values) * 0.995;
  const maxVal = Math.max(...values) * 1.005;
  const range = maxVal - minVal || 1;

  const pad = { top: 25, right: 10, bottom: 30, left: 10 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;

  const points = values.map((v, i) => {
    const x = pad.left + (i / Math.max(values.length - 1, 1)) * w;
    const y = pad.top + h - ((v - minVal) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const cashPoints = cashValues.map((v, i) => {
    const x = pad.left + (i / Math.max(cashValues.length - 1, 1)) * w;
    const y = pad.top + h - ((v - minVal) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  // X-axis labels (show max 8)
  const step = Math.max(1, Math.floor(dates.length / 8));
  const xLabels = dates.map((d, i) => {
    if (i % step !== 0 && i !== dates.length - 1) return '';
    const x = pad.left + (i / Math.max(dates.length - 1, 1)) * w;
    return `<text x="${x.toFixed(1)}" y="${height - 5}" text-anchor="middle" fill="var(--text-dim)" font-size="9" font-family="var(--font-mono)">${d.slice(5)}</text>`;
  }).filter(Boolean).join('');

  // Max/min annotations
  const maxIdx = values.indexOf(Math.max(...values));
  const minIdx = values.indexOf(Math.min(...values));
  const maxX = pad.left + (maxIdx / Math.max(values.length - 1, 1)) * w;
  const maxY = pad.top + h - ((values[maxIdx] - minVal) / range) * h;
  const minX = pad.left + (minIdx / Math.max(values.length - 1, 1)) * w;
  const minY = pad.top + h - ((values[minIdx] - minVal) / range) * h;

  return `
    <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#A78BFA" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="#A78BFA" stop-opacity="0.02"/>
        </linearGradient>
      </defs>
      <!-- Grid lines -->
      ${[0,0.25,0.5,0.75,1].map(f => {
        const y = pad.top + h * (1-f);
        return `<line x1="${pad.left}" y1="${y}" x2="${width-pad.right}" y2="${y}" stroke="var(--border)" stroke-width="0.5" stroke-dasharray="3,3"/>`;
      }).join('')}
      <!-- Area fill -->
      <polygon points="${points.join(' ')} ${(pad.left + w).toFixed(1)},${(pad.top + h).toFixed(1)} ${pad.left},${(pad.top + h).toFixed(1)}" fill="url(#lineGrad)" />
      <!-- Portfolio line -->
      <polyline points="${points.join(' ')}" fill="none" stroke="#A78BFA" stroke-width="2" stroke-linejoin="round" />
      <!-- Cash line (dashed) -->
      <polyline points="${cashPoints.join(' ')}" fill="none" stroke="#F59E0B" stroke-width="1.5" stroke-dasharray="4,3" stroke-linejoin="round" opacity="0.7" />
      <!-- Dots on last point -->
      ${values.length > 0 ? `<circle cx="${points[points.length-1].split(',')[0]}" cy="${points[points.length-1].split(',')[1]}" r="3.5" fill="#A78BFA" />` : ''}
      <!-- Max/Min labels -->
      <text x="${maxX}" y="${maxY - 8}" text-anchor="middle" fill="#34D399" font-size="9" font-weight="600" font-family="var(--font-mono)">max ${Math.round(values[maxIdx]).toLocaleString()}</text>
      ${minIdx !== maxIdx ? `<text x="${minX}" y="${minY + 14}" text-anchor="middle" fill="#F472B6" font-size="9" font-weight="600" font-family="var(--font-mono)">min ${Math.round(values[minIdx]).toLocaleString()}</text>` : ''}
      <!-- X labels -->
      ${xLabels}
      <!-- Legend -->
      <circle cx="${pad.left + 5}" cy="10" r="4" fill="#A78BFA"/>
      <text x="${pad.left + 14}" y="13" fill="var(--text-dim)" font-size="9" font-family="var(--font-mono)">\ucd1d\uc790\uc0b0</text>
      <circle cx="${pad.left + 65}" cy="10" r="4" fill="#F59E0B"/>
      <text x="${pad.left + 74}" y="13" fill="var(--text-dim)" font-size="9" font-family="var(--font-mono)">\ud604\uae08</text>
    </svg>`;
}

function renderPortfolioSection(ex, history) {
  const pf = ex.portfolio || {};
  const capital = pf.capital_krw || 0;
  const portfolioVal = pf.portfolio_value || capital;
  const cash = pf.cash_krw || capital;
  const totalPnl = pf.total_pnl_krw || 0;
  const totalPnlPct = pf.total_pnl_pct || 0;
  const pnlClass = totalPnl > 0 ? 'positive' : totalPnl < 0 ? 'negative' : '';
  const pnlSign = totalPnl > 0 ? '+' : '';

  /* Holdings table */
  const holdings = pf.holdings || [];
  let holdingsHtml = '';
  if (holdings.length > 0) {
    // Total row
    const totalInvested = holdings.reduce((s, h) => s + h.buy_krw, 0);
    const totalValuation = holdings.reduce((s, h) => s + h.val_krw, 0);
    const totalHoldingPnl = holdings.reduce((s, h) => s + h.pnl_krw, 0);
    const totalHoldingPnlPct = totalInvested > 0 ? (totalHoldingPnl / totalInvested * 100) : 0;
    const thpCls = totalHoldingPnl > 0 ? 'positive' : totalHoldingPnl < 0 ? 'negative' : '';

    const rows = holdings.map(h => {
      const pCls = h.pnl_krw > 0 ? 'positive' : h.pnl_krw < 0 ? 'negative' : '';
      return `
        <tr>
          <td class="mono" style="font-weight:600">${escHtml(h.symbol)}</td>
          <td class="mono ${pCls}">${h.pnl_krw > 0 ? '+' : ''}${fmtKRW(h.pnl_krw)}</td>
          <td class="mono ${pCls}">${h.pnl_pct > 0 ? '+' : ''}${h.pnl_pct}%</td>
          <td class="mono">${h.qty}</td>
          <td class="mono">${h.avg_price?.toLocaleString() || '\u2014'}</td>
          <td class="mono">${fmtKRW(h.buy_krw)}</td>
          <td class="mono" style="font-weight:600">${fmtKRW(h.val_krw)}</td>
        </tr>`;
    }).join('');

    holdingsHtml = `
      <div class="trading-subsection">
        <div class="trading-sub-title">\ubcf4\uc720 \uc790\uc0b0 \ud14c\uc774\ube14 (\ucd1d\ubcf4\uc720\uc790\uc0b0 \uc544\ub798 = \ub9e4\uc218 \ucf54\uc778 \uc0c1\uc138)</div>
        <div class="trading-table-wrap">
          <table class="trading-table holdings-table">
            <thead>
              <tr><th>\uc790\uc0b0</th><th>\ud3c9\uac00\uc190\uc775</th><th>\uc218\uc775\ub960</th><th>\ubcf4\uc720\uc218\ub7c9</th><th>\ud3c9\uade0\ub9e4\uc218\uac00</th><th>\ub9e4\uc218\uae08\uc561</th><th>\ud3c9\uac00\uae08\uc561</th></tr>
            </thead>
            <tbody>
              <tr class="holdings-total-row">
                <td style="font-weight:700">\ucd1d\ubcf4\uc720\uc790\uc0b0</td>
                <td class="mono ${thpCls}" style="font-weight:700">${totalHoldingPnl > 0 ? '+' : ''}${fmtKRW(totalHoldingPnl)}</td>
                <td class="mono ${thpCls}" style="font-weight:700">${totalHoldingPnlPct > 0 ? '+' : ''}${totalHoldingPnlPct.toFixed(2)}%</td>
                <td>-</td><td>-</td>
                <td class="mono">${fmtKRW(totalInvested)}</td>
                <td class="mono" style="font-weight:700">${fmtKRW(totalValuation)}</td>
              </tr>
              ${rows}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  return `
    <div class="portfolio-section">
      <!-- Summary header -->
      <div class="pf-summary-header">
        <div class="pf-summary-left">
          <div class="pf-label">\ud604\uc7ac \uc218\uc775\ub960 \xb7 \uc790\ubcf8 ${fmtKRW(capital)}</div>
          <div class="pf-return ${pnlClass}">${pnlSign}${totalPnlPct.toFixed(2)}%</div>
          <div class="pf-value">${portfolioVal.toLocaleString()} KRW</div>
          <div class="pf-detail">\uc6d0\uae08 ${capital.toLocaleString()} KRW \xb7 \ud604\uae08 ${cash.toLocaleString()} KRW</div>
        </div>
      </div>

      <!-- Donut + Chart row -->
      <div class="pf-charts-row">
        <div class="pf-chart-card">
          <div class="pf-chart-title">\uc790\uc0b0 \ubd84\ud3ec (\uc6d0\ud615)</div>
          ${svgDonutChart(pf.allocation || [], 180)}
        </div>
        <div class="pf-chart-card pf-chart-wide">
          <div class="pf-chart-title">\uc790\uc0b0 \ucd94\uc774 (\uc77c\uc790\ubcc4)</div>
          ${svgLineChart(history, ex.exchange, 480, 180)}
        </div>
      </div>

      ${holdingsHtml}
    </div>`;
}

function renderExchangeCard(ex) {
  const statusColor = ex.status === 'NORMAL' ? 'var(--accent-green)'
                    : ex.status === 'HALTED' ? 'var(--accent-red)'
                    : 'var(--accent-yellow)';
  const statusKo = ex.status === 'NORMAL' ? '\uc815\uc0c1' : ex.status === 'HALTED' ? '\uc911\uc9c0' : ex.status;
  const exchangeEmoji = ex.exchange === 'BITGET' ? '\U0001f7e1' : ex.exchange === 'BITHUMB' ? '\U0001f7e0' : '\u26aa';
  const exchangeType = ex.exchange === 'BITGET' ? '\uc120\ubb3c (Futures)' : '\ud604\ubb3c (Spot)';
  const modeLabel = ex.mode === 'demo' ? 'Paper Trading' : 'Live';
  const posCount = ex.positions?.length || 0;
  const pnlToday = ex.pnl_today?.realized_krw ?? 0;
  const tradesToday = ex.pnl_today?.trades ?? 0;
  const pnlClass = pnlToday > 0 ? 'positive' : pnlToday < 0 ? 'negative' : '';
  const lastCycle = ex.last_cycle ? relativeTime(ex.last_cycle) : '\u2014';
  const cfg = ex.config || {};
  const reg = ex.strategy_registry || {};
  const sigs = ex.signals || {};
  const scout = ex.scout || {};
  const health = ex.cycle_health || {};

  /* ── Config summary ── */
  const configHtml = `
    <div class="trading-config-grid">
      <div class="tcfg"><span class="tcfg-k">\uc790\ubcf8\uae08</span><span class="tcfg-v">${fmtKRW(cfg.capital_krw || 0)}</span></div>
      <div class="tcfg"><span class="tcfg-k">\uac74\ub2f9 \ud22c\uc790</span><span class="tcfg-v">${fmtKRW(cfg.per_trade_krw || 0)}</span></div>
      <div class="tcfg"><span class="tcfg-k">\ucd5c\ub300 \ud3ec\uc9c0\uc158</span><span class="tcfg-v">${cfg.max_positions || 0}</span></div>
      <div class="tcfg"><span class="tcfg-k">\uc77c\uc190\uc808 \ud55c\ub3c4</span><span class="tcfg-v negative">${fmtKRW(cfg.daily_loss_limit_krw || 0)}</span></div>
      <div class="tcfg"><span class="tcfg-k">\ub808\ubc84\ub9ac\uc9c0</span><span class="tcfg-v">${cfg.leverage || 1}x</span></div>
      <div class="tcfg"><span class="tcfg-k">\ud0c0\uc784\ud504\ub808\uc784</span><span class="tcfg-v">${escHtml(cfg.timeframe || '?')}</span></div>
    </div>`;

  /* ── Strategy table ── */
  const strats = ex.strategies_flat || [];
  let stratHtml = '';
  if (strats.length > 0) {
    const stratRows = strats.map(s => {
      const total = s.win_count + s.loss_count;
      const winRate = total > 0 ? Math.round(s.win_count / total * 100) + '%' : '\u2014';
      const pnlCls = s.total_pnl_krw > 0 ? 'positive' : s.total_pnl_krw < 0 ? 'negative' : '';
      const coins = s.coins?.length ? s.coins.join(', ') : '';
      const extra = [];
      if (s.timeframe) extra.push(s.timeframe);
      if (s.position_scale && s.position_scale !== 1.0) extra.push('scale:' + s.position_scale);
      const extraStr = extra.length ? `<span class="strat-extra">${escHtml(extra.join(' · '))}</span>` : '';
      return `
        <tr>
          <td>
            <div class="strat-name">${escHtml(s.name)}</div>
            ${coins ? `<div class="strat-coins">${escHtml(coins)}</div>` : ''}
            ${extraStr}
          </td>
          <td><span class="strat-status-badge strat-${s.status}">${escHtml(s.status)}</span></td>
          <td class="mono">${s.total_signals}</td>
          <td class="mono">${s.total_fills}</td>
          <td class="mono ${pnlCls}">${fmtKRW(s.total_pnl_krw)}</td>
          <td class="mono">${winRate}</td>
        </tr>`;
    }).join('');

    stratHtml = `
      <div class="trading-subsection">
        <div class="trading-sub-title">\uc804\ub7b5 (${strats.length}\uac1c)</div>
        <div class="trading-table-wrap">
          <table class="trading-table">
            <thead><tr><th>\uc804\ub7b5\uba85</th><th>\uc0c1\ud0dc</th><th>\uc2dc\uadf8\ub110</th><th>\uccb4\uacb0</th><th>PnL</th><th>\uc2b9\ub960</th></tr></thead>
            <tbody>${stratRows}</tbody>
          </table>
        </div>
      </div>`;
  }

  /* ── Live signals ── */
  let sigHtml = '';
  const paperSigs = sigs.paper_signals || [];
  if (paperSigs.length > 0) {
    const sigRows = paperSigs.map(s => {
      const sideClass = s.side === 'buy' ? 'positive' : 'negative';
      const sideKo = s.side === 'buy' ? 'BUY' : 'SELL';
      return `
        <tr>
          <td class="mono">${escHtml(s.symbol || '')}</td>
          <td class="${sideClass}" style="font-weight:700">${sideKo}</td>
          <td>${confidenceBadge(s.confidence)}</td>
          <td class="sig-reason">${escHtml((s.reason || '').slice(0, 60))}</td>
          <td class="mono">${fmtKRW(s.krw || 0)}</td>
        </tr>`;
    }).join('');

    sigHtml = `
      <div class="trading-subsection">
        <div class="trading-sub-title">\ucd5c\uadfc \uc2dc\uadf8\ub110 (paper: ${sigs.paper_count || 0})</div>
        <div class="trading-table-wrap">
          <table class="trading-table">
            <thead><tr><th>\uc2ec\ubcfc</th><th>\ubc29\ud5a5</th><th>\uc2e0\ub8b0\ub3c4</th><th>\uc774\uc720</th><th>\uae08\uc561</th></tr></thead>
            <tbody>${sigRows}</tbody>
          </table>
        </div>
      </div>`;
  }

  /* ── Recent trades ── */
  let tradesHtml = '';
  const trades = ex.recent_trades || [];
  if (trades.length > 0) {
    const tradeRows = trades.slice(-5).reverse().map(t => {
      const winCls = t.win ? 'positive' : 'negative';
      const winIcon = t.win ? '\u2705' : '\u274c';
      return `
        <tr>
          <td class="mono">${escHtml(t.symbol)}</td>
          <td>${escHtml(t.algo)}</td>
          <td>${escHtml(t.type)}</td>
          <td class="mono ${t.pnl_pct >= 0 ? 'positive' : 'negative'}">${t.pnl_pct > 0 ? '+' : ''}${t.pnl_pct}%</td>
          <td>${winIcon}</td>
        </tr>`;
    }).join('');

    tradesHtml = `
      <div class="trading-subsection">
        <div class="trading-sub-title">\ucd5c\uadfc \uac70\ub798 (\ucd5c\uadfc 5\uac74)</div>
        <div class="trading-table-wrap">
          <table class="trading-table">
            <thead><tr><th>\uc2ec\ubcfc</th><th>\uc54c\uace0\ub9ac\uc998</th><th>\uc720\ud615</th><th>PnL%</th><th>\uc2b9\ud328</th></tr></thead>
            <tbody>${tradeRows}</tbody>
          </table>
        </div>
      </div>`;
  }

  /* ── Positions ── */
  let posHtml = '';
  if (posCount > 0) {
    const posRows = ex.positions.map(p => {
      const side = p.side || p.direction || '\u2014';
      const sideClass = side.toLowerCase().includes('long') ? 'positive' : side.toLowerCase().includes('short') ? 'negative' : '';
      return `
        <tr>
          <td class="mono">${escHtml(p.symbol || '\u2014')}</td>
          <td class="${sideClass}" style="font-weight:700">${escHtml(side)}</td>
          <td class="mono">${fmtKRW(p.entry_krw || p.size_krw || 0)}</td>
          <td class="mono ${(p.pnl_krw || 0) >= 0 ? 'positive' : 'negative'}">${fmtKRW(p.pnl_krw || 0)}</td>
          <td class="mono">${p.entry_time ? relativeTime(p.entry_time) : '\u2014'}</td>
        </tr>`;
    }).join('');

    posHtml = `
      <div class="trading-subsection">
        <div class="trading-sub-title">\ud3ec\uc9c0\uc158 (${posCount}\uac1c)</div>
        <div class="trading-table-wrap">
          <table class="trading-table">
            <thead><tr><th>\uc2ec\ubcfc</th><th>\ubc29\ud5a5</th><th>\ud06c\uae30</th><th>PnL</th><th>\uc9c4\uc785</th></tr></thead>
            <tbody>${posRows}</tbody>
          </table>
        </div>
      </div>`;
  } else {
    posHtml = `
      <div class="trading-subsection">
        <div class="trading-empty-pos">\ud3ec\uc9c0\uc158 \uc5c6\uc74c \u2014 \ub300\uae30 \uc911</div>
      </div>`;
  }

  /* ── Scout ── */
  let scoutHtml = '';
  if (scout.universe_count > 0) {
    scoutHtml = `
      <div class="trading-scout">
        <span class="trading-scout-label">\ud0d0\uc0c9 \uc720\ub2c8\ubc84\uc2a4:</span>
        ${scout.top_symbols.map(s => `<span class="scout-chip">${escHtml(s)}</span>`).join('')}
        ${scout.universe_count > 8 ? `<span class="scout-more">+${scout.universe_count - 8}</span>` : ''}
      </div>`;
  }

  /* ── Cycle health ── */
  let healthHtml = '';
  if (health.cycles_in_log) {
    const errRate = health.cycles_in_log > 0 ? Math.round(health.errors / health.cycles_in_log * 100) : 0;
    healthHtml = `
      <div class="trading-health">
        <span>\uc0ac\uc774\ud074: ${health.completed}/${health.cycles_in_log}</span>
        <span>\uc5d0\ub7ec: <span class="${health.errors > 0 ? 'negative' : ''}">${health.errors}</span></span>
        <span>\ub9c8\uc9c0\ub9c9: ${lastCycle}</span>
      </div>`;
  }

  return `
    <div class="trading-exchange-card">
      <div class="trading-ex-header">
        <div class="trading-ex-title">
          <span class="trading-ex-emoji">${exchangeEmoji}</span>
          <div>
            <div class="trading-ex-name">${escHtml(ex.exchange)} <span class="trading-mode-badge">${modeLabel}</span></div>
            <div class="trading-ex-type">${exchangeType} \xb7 ${escHtml(cfg.market || '')}</div>
          </div>
        </div>
        <div class="trading-ex-status" style="color:${statusColor}">
          <span class="trading-status-dot" style="background:${statusColor}"></span>
          ${statusKo}
        </div>
      </div>

      ${renderPortfolioSection(ex, state.tradebot?.history || [])}

      <div class="trading-metrics">
        <div class="trading-metric">
          <span class="trading-metric-v">${posCount}</span>
          <span class="trading-metric-k">\ud3ec\uc9c0\uc158</span>
        </div>
        <div class="trading-metric">
          <span class="trading-metric-v ${pnlClass}">${fmtKRW(pnlToday)}</span>
          <span class="trading-metric-k">\uc624\ub298 PnL</span>
        </div>
        <div class="trading-metric">
          <span class="trading-metric-v">${tradesToday}</span>
          <span class="trading-metric-k">\uc624\ub298 \uac70\ub798</span>
        </div>
        <div class="trading-metric">
          <span class="trading-metric-v">${reg.total_signals || 0}</span>
          <span class="trading-metric-k">\ub204\uc801 \uc2dc\uadf8\ub110</span>
        </div>
        <div class="trading-metric">
          <span class="trading-metric-v">${reg.active || 0}/${reg.total || 0}</span>
          <span class="trading-metric-k">\ud65c\uc131 \uc804\ub7b5</span>
        </div>
        <div class="trading-metric">
          <span class="trading-metric-v">${lastCycle}</span>
          <span class="trading-metric-k">\ub9c8\uc9c0\ub9c9 \uc0ac\uc774\ud074</span>
        </div>
      </div>

      ${configHtml}
      ${posHtml}
      ${sigHtml}
      ${stratHtml}
      ${tradesHtml}
      ${scoutHtml}
      ${healthHtml}

      ${ex.error ? `<div class="trading-error">\u26a0 ${escHtml(ex.error)}</div>` : ''}
    </div>`;
}

function renderTrading() {
  const panel = document.getElementById('tradingPanel');
  if (!panel) return;

  const tb = state.tradebot;
  if (!tb || !tb.exchanges || !tb.exchanges.length) {
    panel.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">\U0001f4c8</span>
        \ud2b8\ub808\uc774\ub529 \ub370\uc774\ud130 \uc5c6\uc74c
      </div>`;
    const statusEl = document.getElementById('tradingStatus');
    if (statusEl) statusEl.textContent = '\u2014';
    return;
  }

  const sm = tb.summary || {};
  const summaryHtml = `
    <div class="trading-summary-bar">
      <div class="tsb-item"><span class="tsb-v">${sm.total_exchanges || 0}</span><span class="tsb-k">\uac70\ub798\uc18c</span></div>
      <div class="tsb-item"><span class="tsb-v">${sm.total_positions || 0}</span><span class="tsb-k">\ud3ec\uc9c0\uc158</span></div>
      <div class="tsb-item"><span class="tsb-v">${sm.total_signals || 0}</span><span class="tsb-k">\ub300\uae30 \uc2dc\uadf8\ub110</span></div>
      <div class="tsb-item"><span class="tsb-v">${sm.total_strategies || 0}</span><span class="tsb-k">\uc804\ub7b5</span></div>
      <div class="tsb-item"><span class="tsb-v">${tb.host || '\u2014'}</span><span class="tsb-k">\ud638\uc2a4\ud2b8</span></div>
      <div class="tsb-item"><span class="tsb-v">${tb.ts ? relativeTime(tb.ts) : '\u2014'}</span><span class="tsb-k">\ub370\uc774\ud130 \uae30\uc900</span></div>
    </div>`;

  panel.innerHTML = summaryHtml + tb.exchanges.map(renderExchangeCard).join('');

  const statusEl = document.getElementById('tradingStatus');
  if (statusEl) {
    statusEl.textContent = `${sm.total_exchanges || 0}\uac1c \uac70\ub798\uc18c \xb7 ${sm.total_positions || 0} \ud3ec\uc9c0\uc158 \xb7 ${sm.total_signals || 0} \uc2dc\uadf8\ub110`;
  }
}

/* ─────────────────────────────────────────────
   MASTER RENDER
───────────────────────────────────────────── */

function render() {
  renderErrors();
  renderSystemBar();
  renderServerGrid();
  renderAgentGrid();
  renderTimeline();
  renderRunsTable();
  renderCosts();
  renderTrading();
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
