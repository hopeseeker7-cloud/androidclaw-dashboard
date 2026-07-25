/* ─────────────────────────────────────────────
   render-home.js — 홈 탭 렌더러
   (시스템 바, 서버 그리드, 에이전트 그리드, 타임라인)
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
  const storageUsed  = sys.phone?.storage?.used  ?? '—';
  const storageTotal = sys.phone?.storage?.total ?? '—';
  const storagePct   = sys.phone?.storage?.percent ?? '—';
  const uptime       = sys.phone?.uptime  ?? '—';
  const network      = sys.phone?.network ?? '—';
  const gateway      = sys.openclaw?.gateway ?? '—';

  const batteryClass = !batteryOk ? '' : batteryRaw >= CONFIG.BATTERY_GOOD ? 'good' : batteryRaw >= CONFIG.BATTERY_WARN ? 'warn' : 'error';
  const gatewayClass = gateway === 'reachable' ? 'good' : 'error';
  const gatewayText  = gateway === 'reachable' ? '연결됨' : '오프라인';
  const batteryEmoji = !batteryOk ? '❓' : batteryRaw >= CONFIG.BATTERY_EMOJI_FULL ? '🔋' : batteryRaw >= CONFIG.BATTERY_EMOJI_LOW ? '🪫' : '❗';
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
      <span class="sys-value ${storagePct > CONFIG.RES_ALERT_PCT ? 'warn' : 'good'}" style="font-size:0.7rem">(${storagePct}%)</span>
    </div>
    <div class="sys-item">
      <span class="sys-label">업타임</span>
      <span class="sys-value">${escHtml(uptime)}</span>
    </div>
    <div class="sys-item">
      <span class="sys-label">네트워크</span>
      <span class="sys-value">${escHtml(network)}</span>
    </div>`;
}

function serverStatusInfo(srv) {
  const fails = srv.consecutiveFailures || 0;
  if (srv.status === 'healthy' && fails === 0)
    return { cls: 'healthy', label: '정상', color: 'var(--accent-green)' };
  if (srv.status === 'warning' || (fails > 0 && fails < 3))
    return { cls: 'warning', label: '주의', color: 'var(--accent-yellow)' };
  return { cls: 'down', label: '장애', color: 'var(--accent-red)' };
}

function renderServerCard(srv) {
  const si        = serverStatusInfo(srv);
  const lastCheck = srv.lastCheck ? relativeTime(srv.lastCheck) : '—';
  const checks    = srv.checks  || {};
  const metrics   = srv.metrics || {};

  const pills = [];
  if (checks.ssh      != null) pills.push(`<span class="srv-pill ${checks.ssh      ? 'ok' : 'fail'}">SSH ${checks.ssh ? '✓' : '✗'}</span>`);
  if (checks.gateway  != null) pills.push(`<span class="srv-pill ${checks.gateway  ? 'ok' : 'fail'}">Gateway ${checks.gateway ? '✓' : '✗'}</span>`);
  if (checks.brain_py != null) pills.push(`<span class="srv-pill ${checks.brain_py ? 'ok' : 'fail'}">brain.py ${checks.brain_py ? '✓' : '✗'}</span>`);
  if (checks.timers   != null) pills.push(`<span class="srv-pill ok">Timers ${checks.timers}</span>`);

  const metricItems = [];
  if (metrics.pnl_today           != null) metricItems.push(`<div class="srv-metric"><span class="srv-metric-k">PnL</span><span class="srv-metric-v ${metrics.pnl_today.startsWith('+') ? 'positive' : metrics.pnl_today.startsWith('-') ? 'negative' : ''}">${escHtml(metrics.pnl_today)}</span></div>`);
  if (metrics.positions           != null) metricItems.push(`<div class="srv-metric"><span class="srv-metric-k">포지션</span><span class="srv-metric-v">${metrics.positions}</span></div>`);
  if (metrics.strategies_active   != null) metricItems.push(`<div class="srv-metric"><span class="srv-metric-k">전략</span><span class="srv-metric-v">${metrics.strategies_active}</span></div>`);
  if (metrics.strategies_generated!= null) metricItems.push(`<div class="srv-metric"><span class="srv-metric-k">생성 전략</span><span class="srv-metric-v">${metrics.strategies_generated}</span></div>`);
  if (metrics.reflections_today   != null) metricItems.push(`<div class="srv-metric"><span class="srv-metric-k">성찰</span><span class="srv-metric-v">${metrics.reflections_today}</span></div>`);
  if (checks.last_sync)                    metricItems.push(`<div class="srv-metric"><span class="srv-metric-k">동기화</span><span class="srv-metric-v">${relativeTime(checks.last_sync)}</span></div>`);

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
  const countEl      = document.getElementById('serverCount');
  if (countEl) countEl.textContent = `${healthyCount}/${servers.length} 정상`;
}

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

/* ── KR Stock 실거래 데이터 (P5 plumbing — data/kr_stock.json) ──
   Replaces the former governance-verdict block (validation.json
   mock/longitudinal/campaign/calendar cards). Functional wiring only;
   visual polish is deferred to P6. Entry point name renderValidation()
   and #validationPanel / #validationStatus element ids are kept so
   app.js and index.html stay untouched. */

// Snapshot / reconciliation state → icon + status color + Korean label.
// dataviz rule: status color is never used alone — always paired with an
// icon (non-chromatic) and a label so state survives color-blindness / print.
function krStatusView(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'healthy')    return { icon: '●', fg: 'var(--accent-green)',  label: '정상' };
  if (s === 'rebuilding') return { icon: '◐', fg: 'var(--accent-yellow)', label: '재생성 중' };
  if (s === 'degraded')   return { icon: '▲', fg: 'var(--accent-yellow)', label: '주의' };
  if (s === 'stale')      return { icon: '▲', fg: 'var(--accent-yellow)', label: '데이터 지연' };
  if (s === 'blocked')    return { icon: '✕', fg: 'var(--accent-red)',    label: '차단' };
  return { icon: '○', fg: 'var(--text-dim)', label: status || '상태 없음' };
}

function fmtKRWFull(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  return '₩' + num.toLocaleString('ko-KR');
}

// P&L → sign + directional arrow (secondary, non-chromatic encoding) + diverging color.
// Returns {text, arrow, color} so callers never rely on hue alone.
function krPnl(n) {
  const num = Number(n) || 0;
  if (num > 0) return { text: '+' + fmtKRWFull(num), arrow: '▲', color: 'var(--accent-green)' };
  if (num < 0) return { text: fmtKRWFull(num),       arrow: '▼', color: 'var(--accent-red)' };
  return { text: fmtKRWFull(0), arrow: '·', color: 'var(--text-dim)' };
}

function renderValidation() {
  // Entry point kept (called from app.js render()) — now renders kr_stock.json.
  const panel = document.getElementById('validationPanel');
  if (!panel) return;

  fetchJSON(CONFIG.DATA.krStock)
    .then(data => { state.krStock = data; renderKrStockPanel(panel, data); })
    .catch(()   => { state.krStock = null; renderKrStockPanel(panel, null); });
}

function renderKrStockPanel(panel, ks) {
  const statusEl = document.getElementById('validationStatus');

  if (!ks) {
    panel.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">📊</span>
        실거래 데이터 없음 (kr_stock.json 로딩 실패)
      </div>`;
    if (statusEl) { statusEl.textContent = '—'; statusEl.style.color = 'var(--text-dim)'; }
    return;
  }

  if (ks.data_available === false) {
    panel.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">⏳</span>
        ${escHtml(ks.message || '데이터 수집 대기')}
      </div>`;
    if (statusEl) { statusEl.textContent = '대기'; statusEl.style.color = 'var(--text-dim)'; }
    return;
  }

  const snap      = ks.snapshot || {};
  const portfolio = ks.portfolio || {};
  const cash      = portfolio.cash || {};
  const positions = Array.isArray(ks.positions) ? ks.positions : [];
  const pnl       = ks.pnl || {};
  const recon     = ks.reconciliation || {};
  const pipeline  = ks.pipeline || {};
  const strategies = Array.isArray(ks.strategies) ? ks.strategies : [];

  const snapView = krStatusView(snap.snapshot_status);
  const asOf     = snap.as_of_ts ? new Date(snap.as_of_ts).toLocaleString('ko-KR') : '—';

  // ── Status bar: snapshot health (icon+label) + mode + market + as-of ──
  let html = `
    <div class="kr-statusbar">
      <div style="display:flex;align-items:center;gap:10px">
        <span class="kr-badge" style="color:${snapView.fg}"><span class="kr-ic">${snapView.icon}</span>${escHtml(snapView.label)}</span>
        <span class="kr-chip">${escHtml(ks.mode || 'paper')}</span>
        <span style="font-size:0.72rem;color:var(--text-muted)">${escHtml(snap.market_status || '—')}</span>
      </div>
      <span style="font-size:0.72rem;color:var(--text-muted)">기준 ${escHtml(asOf)}</span>
    </div>`;
  if (snap.status_reason && String(snap.snapshot_status).toLowerCase() !== 'healthy') {
    html += `<div style="font-size:0.72rem;color:${snapView.fg};margin:-4px 0 8px">${escHtml(snap.status_reason)}</div>`;
  }

  // ── KPI stat tiles (P&L carries sign + arrow, never hue alone) ──
  const realized   = krPnl(pnl.realized_today_krw);
  const cumulative = krPnl(pnl.realized_cumulative_krw);
  const unrealized = krPnl(pnl.unrealized_krw);
  html += `
    <div class="kr-stats">
      <div class="kr-stat">
        <div class="kr-stat-label">포트폴리오 총액</div>
        <div class="kr-stat-value">${fmtKRWFull(portfolio.total_value_krw)}</div>
        <div class="kr-stat-sub">주문가능 ${fmtKRWFull(cash.buying_power_krw)} · ${portfolio.position_count ?? 0}종목</div>
      </div>
      <div class="kr-stat">
        <div class="kr-stat-label">당일 실현손익</div>
        <div class="kr-stat-value" style="color:${realized.color}"><span class="kr-arrow">${realized.arrow}</span>${realized.text}</div>
        <div class="kr-stat-sub">누적 ${cumulative.text} · 체결 ${pnl.trades_today ?? 0}건</div>
      </div>
      <div class="kr-stat">
        <div class="kr-stat-label">평가손익</div>
        <div class="kr-stat-value" style="color:${unrealized.color}"><span class="kr-arrow">${unrealized.arrow}</span>${unrealized.text}</div>
        <div class="kr-stat-sub">종목 ${snap.total_symbols ?? 0} · 지연 ${snap.stale_symbols ?? 0}</div>
      </div>
      <div class="kr-stat">
        <div class="kr-stat-label">현금</div>
        <div class="kr-stat-value">${fmtKRWFull(cash.deposit_cash_krw)}</div>
        <div class="kr-stat-sub">정산대기 ${fmtKRWFull(cash.settlement_pending_cash_krw)}</div>
      </div>
    </div>`;

  // ── Positions table ──
  if (positions.length) {
    html += `
      <table class="kr-postable">
        <thead><tr><th>종목</th><th>수량</th><th>평단</th><th>평가손익</th></tr></thead>
        <tbody>`;
    positions.forEach(p => {
      const rowPnl = krPnl(p.unrealized_pnl_krw);
      const pct    = Number(p.pnl_pct) || 0;
      html += `
        <tr>
          <td>${escHtml(p.symbol)}</td>
          <td>${p.quantity ?? 0}</td>
          <td>${fmtKRWFull(p.avg_cost)}</td>
          <td style="color:${rowPnl.color}">${rowPnl.arrow} ${rowPnl.text} <span style="color:var(--text-dim)">(${pct > 0 ? '+' : ''}${pct.toFixed(2)}%)</span></td>
        </tr>`;
    });
    html += `</tbody></table>`;
  } else {
    html += `<div style="font-size:0.75rem;color:var(--text-dim);margin-top:10px">보유 포지션 없음</div>`;
  }

  // ── Reconciliation + pipeline (icon+label status, not color alone) ──
  const openIssues = recon.open_issues ?? 0;
  const reconView = recon.critical
    ? { icon: '✕', fg: 'var(--accent-red)',    label: '정합성 CRITICAL' }
    : (openIssues > 0
        ? { icon: '▲', fg: 'var(--accent-yellow)', label: `정합성 이슈 ${openIssues}건` }
        : { icon: '●', fg: 'var(--accent-green)',  label: '정합성 정상' });
  const pipeStatus = String(pipeline.last_status || '—');
  const pipeView   = krStatusView(pipeStatus);
  html += `
    <div class="kr-meta-row">
      <span class="kr-badge" style="color:${reconView.fg}"><span class="kr-ic">${reconView.icon}</span>${escHtml(reconView.label)}</span>
      <span style="color:var(--text-muted)"><span class="kr-ic" style="color:${pipeView.fg}">${pipeView.icon}</span> 파이프라인 ${escHtml(pipeStatus)}${pipeline.last_run ? ' · ' + new Date(pipeline.last_run).toLocaleString('ko-KR') : ''}</span>
    </div>`;
  (recon.issues || []).slice(0, 3).forEach(issue => {
    const iv = issue.severity === 'critical'
      ? { icon: '✕', fg: 'var(--accent-red)' }
      : { icon: '▲', fg: 'var(--accent-yellow)' };
    html += `<div style="font-size:0.7rem;color:${iv.fg};margin-top:2px"><span class="kr-ic">${iv.icon}</span> [${escHtml(issue.severity)}] ${escHtml(issue.description)}</div>`;
  });

  // ── Strategies ──
  if (strategies.length) {
    html += `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">`;
    strategies.forEach(s => {
      html += `<span class="kr-chip">${escHtml(s.name || '—')} · ${escHtml(s.status || '—')}</span>`;
    });
    html += `</div>`;
  }

  // ── Safety footer ──
  html += `<div class="kr-safety">🔒 live 발주 비활성 · paper/canary 전용</div>`;

  panel.innerHTML = html;

  if (statusEl) {
    statusEl.textContent = escHtml(snapView.label);
    statusEl.style.color = snapView.fg;
  }
}

function renderTimeline() {
  const timeline  = document.getElementById('timeline');
  if (!timeline) return;

  const recentRuns = state.runs.slice(0, CONFIG.MAX_RUNS);
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
