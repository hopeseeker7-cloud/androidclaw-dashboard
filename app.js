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

  /* (C) Window percentages (5h / weekly) */
  const win5h  = data?.window_5h_pct ?? null;
  const winWk  = data?.window_weekly_pct ?? null;

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
