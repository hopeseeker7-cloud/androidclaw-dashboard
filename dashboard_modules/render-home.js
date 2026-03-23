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

/* ── Validation & Operator Integration (Phase 48) ── */

function verdictStyle(verdict) {
  if (!verdict) return { fg: 'var(--text-dim)', bg: 'transparent' };
  const v = verdict.toLowerCase();
  if (v.includes('blocked'))      return { fg: 'var(--accent-red)',    bg: 'rgba(239,68,68,0.08)' };
  if (v.includes('insufficient')) return { fg: 'var(--accent-yellow)', bg: 'rgba(245,158,11,0.08)' };
  if (v.includes('deferred'))     return { fg: 'var(--accent-yellow)', bg: 'rgba(245,158,11,0.06)' };
  if (v.includes('degrading'))    return { fg: 'var(--accent-yellow)', bg: 'rgba(245,158,11,0.06)' };
  if (v.includes('mixed'))        return { fg: 'var(--accent-yellow)', bg: 'rgba(245,158,11,0.06)' };
  if (v.includes('stable'))       return { fg: 'var(--accent-green)',  bg: 'rgba(52,211,153,0.08)' };
  if (v.includes('aligned') || v.includes('pending')) return { fg: 'var(--accent-green)', bg: 'rgba(52,211,153,0.06)' };
  return { fg: 'var(--text-dim)', bg: 'transparent' };
}

function urgencyColor(urgency) {
  if (urgency === 'immediate')  return 'var(--accent-red)';
  if (urgency === 'accelerated') return 'var(--accent-yellow)';
  return 'var(--accent-green)';
}

function renderValidation() {
  const panel = document.getElementById('validationPanel');
  if (!panel) return;

  const val = state.validation;
  if (!val) {
    panel.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">📊</span>
        검증 데이터 없음
      </div>`;
    const statusEl = document.getElementById('validationStatus');
    if (statusEl) statusEl.textContent = '—';
    return;
  }

  // ── P25-28 Validation Cards ──
  const overall   = val.overall_status || 'no data';
  const overallSt = verdictStyle(overall);
  const mode      = val.mode_display || val.mode || 'paper';
  const nextAct   = val.next_action || '—';

  const mv  = val.mock_validation || {};
  const lv  = val.longitudinal || {};
  const cv  = val.campaign || {};
  const cal = val.calendar || {};

  let html = `
    <div class="val-overall-bar" style="background:${overallSt.bg}">
      <div style="display:flex;align-items:center;gap:8px">
        <span class="val-overall-badge" style="color:${overallSt.fg}">${escHtml(val.overall_display || overall)}</span>
        <span class="val-mode-badge">${escHtml(mode)}</span>
      </div>
      <span style="font-size:0.75rem;color:var(--text-muted)">${escHtml(nextAct)}</span>
    </div>
    <div class="val-grid">
      <div class="val-card">
        <div class="val-card-title">Mock 검증</div>
        <div class="val-card-verdict" style="color:${verdictStyle(mv.verdict).fg}">${escHtml(mv.verdict_display || mv.verdict || '—')}</div>
        <div class="val-card-detail">통과율: ${escHtml(mv.pass_rate_pct || '—')}</div>
      </div>
      <div class="val-card">
        <div class="val-card-title">종단 검증</div>
        <div class="val-card-verdict" style="color:${verdictStyle(lv.verdict).fg}">${escHtml(lv.verdict_display || lv.verdict || '—')}</div>
        <div class="val-card-detail">추세: ${escHtml(lv.trend || '—')}</div>
      </div>
      <div class="val-card">
        <div class="val-card-title">캠페인 리뷰</div>
        <div class="val-card-verdict" style="color:${verdictStyle(cv.verdict).fg}">${escHtml(cv.verdict_display || cv.verdict || '—')}</div>
        <div class="val-card-detail">차단: ${cv.blocked_count ?? 0} · 경고: ${cv.warning_count ?? 0}</div>
      </div>
      <div class="val-card">
        <div class="val-card-title">검토 일정</div>
        <div class="val-card-verdict" style="color:${urgencyColor(cal.urgency)}">${escHtml(cal.urgency_display || cal.urgency || '—')}</div>
        <div class="val-card-detail">연속 안정: ${cal.stable_streak ?? 0}회</div>
      </div>
    </div>`;

  // ── Blockers / Warnings ──
  const blockers = val.blockers || [];
  const warnings = val.warnings || [];
  if (blockers.length) {
    html += `<div class="val-blockers"><strong style="color:var(--accent-red)">차단 사유 (${blockers.length})</strong>`;
    blockers.forEach(b => { html += `<div style="font-size:0.75rem;color:var(--accent-red)">· ${escHtml(b)}</div>`; });
    html += `</div>`;
  }
  if (warnings.length) {
    html += `<div class="val-warnings"><strong style="color:var(--accent-yellow)">경고 (${warnings.length})</strong>`;
    warnings.forEach(w => { html += `<div style="font-size:0.75rem;color:var(--accent-yellow)">· ${escHtml(w)}</div>`; });
    html += `</div>`;
  }

  // ── P48 Operator Integration Block ──
  const oi = val.operator_integration;
  if (oi) {
    const worstSt = verdictStyle(oi.worst_contract_verdict);
    html += `
    <div class="val-operator-integration" style="margin-top:12px;padding:12px;border:1px solid var(--border);border-radius:8px;background:var(--card-bg)">
      <div style="font-weight:600;font-size:0.85rem;margin-bottom:8px;color:var(--text-primary)">Contract Status (P36–P47)</div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-size:0.8rem;font-weight:600;color:${worstSt.fg}">${escHtml(oi.worst_contract_verdict || '—')}</span>
        <span style="font-size:0.72rem;color:var(--text-muted)">${oi.evaluated_count || 0}/${oi.total_hooks || 12} layers</span>
      </div>
      <div style="font-size:0.75rem;color:var(--text-primary);margin-bottom:4px">${escHtml(oi.operator_headline || '—')}</div>
      <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:8px">${escHtml(oi.operator_action || '—')}</div>`;

    // Governance / signoff snapshot
    const gs = oi.governance_signoff_status;
    if (gs) {
      html += `
      <div style="display:flex;gap:16px;margin-bottom:8px;font-size:0.72rem">
        <div><span style="color:var(--text-muted)">Governance:</span> <span style="color:${verdictStyle(gs.governance_display).fg}">${escHtml(gs.governance_display || '—')}</span></div>
        <div><span style="color:var(--text-muted)">Signoff:</span> <span style="color:${verdictStyle(gs.signoff_display).fg}">${escHtml(gs.signoff_display || '—')}</span></div>
      </div>`;
    }

    // Next design step
    if (oi.next_design_step) {
      html += `<div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:8px">다음: ${escHtml(oi.next_design_step)}</div>`;
    }

    // Prohibited actions
    const prohibitions = oi.prohibition_strip || [];
    if (prohibitions.length) {
      html += `<div style="font-size:0.68rem;color:var(--text-dim);border-top:1px solid var(--border);padding-top:6px;margin-top:4px">`;
      prohibitions.forEach(p => { html += `<div>· ${escHtml(p)}</div>`; });
      html += `</div>`;
    }

    // Safety strip
    const safety = oi.safety_strip;
    if (safety) {
      const modeDisp = safety.mode_display || safety.mode || 'paper';
      html += `<div style="font-size:0.68rem;color:var(--text-dim);margin-top:4px">모드: ${escHtml(modeDisp)} · live: 비활성</div>`;
    }

    html += `</div>`;
  }

  // ── Safety footer ──
  html += `<div class="val-safety" style="font-size:0.68rem;color:var(--text-dim);margin-top:8px">live orders: 비활성 · human approval: 필수</div>`;

  panel.innerHTML = html;

  // Update status badge
  const statusEl = document.getElementById('validationStatus');
  if (statusEl) {
    statusEl.textContent = escHtml(val.overall_display || overall);
    statusEl.style.color = overallSt.fg;
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
