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

function krSnapshotStyle(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'blocked')    return { fg: 'var(--accent-red)',    bg: 'rgba(239,68,68,0.08)' };
  if (s === 'degraded')   return { fg: 'var(--accent-yellow)', bg: 'rgba(245,158,11,0.08)' };
  if (s === 'rebuilding') return { fg: 'var(--accent-yellow)', bg: 'rgba(245,158,11,0.06)' };
  if (s === 'healthy')    return { fg: 'var(--accent-green)',  bg: 'rgba(52,211,153,0.08)' };
  return { fg: 'var(--text-dim)', bg: 'transparent' };
}

function fmtKRWFull(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  return '₩' + num.toLocaleString('ko-KR');
}

function fmtSignedKRW(n) {
  const num = Number(n) || 0;
  return (num > 0 ? '+' : '') + fmtKRWFull(num);
}

function krPnlColor(n) {
  const num = Number(n) || 0;
  if (num > 0) return 'var(--accent-green)';
  if (num < 0) return 'var(--accent-red)';
  return 'var(--text-dim)';
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

  const snapSt = krSnapshotStyle(snap.snapshot_status);
  const asOf   = snap.as_of_ts ? new Date(snap.as_of_ts).toLocaleString('ko-KR') : '—';

  // ── Status bar: snapshot health + mode + as-of ──
  let html = `
    <div class="val-overall-bar" style="background:${snapSt.bg}">
      <div style="display:flex;align-items:center;gap:8px">
        <span class="val-overall-badge" style="color:${snapSt.fg}">${escHtml(snap.snapshot_status || '상태 없음')}</span>
        <span class="val-mode-badge">${escHtml(ks.mode || 'paper')}</span>
        <span style="font-size:0.72rem;color:var(--text-muted)">${escHtml(snap.market_status || '—')}</span>
      </div>
      <span style="font-size:0.72rem;color:var(--text-muted)">기준: ${escHtml(asOf)}</span>
    </div>`;
  if (snap.status_reason && snap.snapshot_status !== 'healthy') {
    html += `<div style="font-size:0.72rem;color:${snapSt.fg};margin:4px 0">${escHtml(snap.status_reason)}</div>`;
  }

  // ── Portfolio + PnL summary cards ──
  html += `
    <div class="val-grid">
      <div class="val-card">
        <div class="val-card-title">포트폴리오</div>
        <div class="val-card-verdict">${fmtKRWFull(portfolio.total_value_krw)}</div>
        <div class="val-card-detail">주문가능 ${fmtKRWFull(cash.buying_power_krw)} · 포지션 ${portfolio.position_count ?? 0}종목</div>
      </div>
      <div class="val-card">
        <div class="val-card-title">현금</div>
        <div class="val-card-verdict">${fmtKRWFull(cash.deposit_cash_krw)}</div>
        <div class="val-card-detail">정산대기 ${fmtKRWFull(cash.settlement_pending_cash_krw)} · 출금가능 ${fmtKRWFull(cash.withdrawable_cash_krw)}</div>
      </div>
      <div class="val-card">
        <div class="val-card-title">당일 실현손익</div>
        <div class="val-card-verdict" style="color:${krPnlColor(pnl.realized_today_krw)}">${fmtSignedKRW(pnl.realized_today_krw)}</div>
        <div class="val-card-detail">누적 ${fmtSignedKRW(pnl.realized_cumulative_krw)} · 체결 ${pnl.trades_today ?? 0}건</div>
      </div>
      <div class="val-card">
        <div class="val-card-title">평가손익</div>
        <div class="val-card-verdict" style="color:${krPnlColor(pnl.unrealized_krw)}">${fmtSignedKRW(pnl.unrealized_krw)}</div>
        <div class="val-card-detail">종목 ${snap.total_symbols ?? 0} · 지연 ${snap.stale_symbols ?? 0}</div>
      </div>
    </div>`;

  // ── Positions ──
  if (positions.length) {
    html += `<div style="margin-top:8px">`;
    positions.forEach(p => {
      const pct = Number(p.pnl_pct) || 0;
      html += `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 2px;font-size:0.78rem;border-bottom:1px solid var(--border-subtle,rgba(128,128,128,0.15))">
          <span class="mono">${escHtml(p.symbol)} × ${p.quantity ?? 0}</span>
          <span style="color:var(--text-muted)">평단 ${fmtKRWFull(p.avg_cost)}</span>
          <span class="mono" style="color:${krPnlColor(p.unrealized_pnl_krw)}">${fmtSignedKRW(p.unrealized_pnl_krw)} (${pct > 0 ? '+' : ''}${pct.toFixed(2)}%)</span>
        </div>`;
    });
    html += `</div>`;
  } else {
    html += `<div style="font-size:0.75rem;color:var(--text-dim);margin-top:8px">보유 포지션 없음</div>`;
  }

  // ── Reconciliation ──
  const openIssues = recon.open_issues ?? 0;
  const reconColor = recon.critical ? 'var(--accent-red)'
    : (openIssues > 0 ? 'var(--accent-yellow)' : 'var(--accent-green)');
  html += `
    <div style="display:flex;gap:12px;font-size:0.72rem;margin-top:8px">
      <span style="color:${reconColor}">정산검증: ${recon.critical ? 'CRITICAL' : (openIssues > 0 ? `이슈 ${openIssues}건` : '정상')}</span>
      <span style="color:var(--text-muted)">파이프라인: ${escHtml(pipeline.last_status || '—')}${pipeline.last_run ? ' · ' + new Date(pipeline.last_run).toLocaleString('ko-KR') : ''}</span>
    </div>`;
  (recon.issues || []).slice(0, 3).forEach(issue => {
    html += `<div style="font-size:0.7rem;color:${issue.severity === 'critical' ? 'var(--accent-red)' : 'var(--accent-yellow)'}">· [${escHtml(issue.severity)}] ${escHtml(issue.description)}</div>`;
  });

  // ── Pipeline stages ──
  if (Array.isArray(pipeline.stages) && pipeline.stages.length) {
    html += `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">`;
    pipeline.stages.forEach(st => {
      const c = st.level === 'critical' ? 'var(--accent-red)'
        : (st.level === 'warn' ? 'var(--accent-yellow)' : 'var(--accent-green)');
      html += `<span style="font-size:0.68rem;color:${c}">${escHtml(st.topic)}: ${escHtml(st.event_type)}</span>`;
    });
    html += `</div>`;
  }

  // ── Strategies ──
  if (strategies.length) {
    html += `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">`;
    strategies.forEach(s => {
      html += `<span class="val-mode-badge">${escHtml(s.name || '—')} · ${escHtml(s.status || '—')}</span>`;
    });
    html += `</div>`;
  }

  // ── Safety footer ──
  html += `<div class="val-safety" style="font-size:0.68rem;color:var(--text-dim);margin-top:8px">live orders: 비활성 · paper/canary 전용</div>`;

  panel.innerHTML = html;

  if (statusEl) {
    statusEl.textContent = escHtml(snap.snapshot_status || '—');
    statusEl.style.color = snapSt.fg;
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
