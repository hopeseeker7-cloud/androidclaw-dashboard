/* ─────────────────────────────────────────────
   render-costs.js — 비용 탭 렌더러
   (LLM 사용량, 폰 리소스, 에이전트 통계)
───────────────────────────────────────────── */

function llmUsageCard(data, color, icon, defaultModel, defaultSub) {
  const model  = data?.model || defaultModel;
  const sub    = data?.subscription || defaultSub;
  const isReal = data?.source === 'openclaw_sessions'; /* GPT real data */

  /* (A) Session cumulative tokens */
  const sessTok = data?.total_tokens || 0;
  const ctxTok  = data?.context_tokens || 0;

  /* (B) Today's tokens (daily snapshot diff) */
  const todayTok = data?.today_tokens ?? null;

  /* (C) Window percentages (5h / weekly) + reset times */
  const win5h   = data?.window_5h_pct ?? null;
  const winWk   = data?.window_weekly_pct ?? null;
  const reset5h = data?.window_5h_reset ?? null;
  const resetWk = data?.window_weekly_reset ?? null;

  /* Fallback for Claude: estimated tokens */
  const estTok = data?.tokens_today_est || 0;
  const estCap = data?.daily_limit_est || CONFIG.CLAUDE_DAILY_LIMIT;

  /* Donut: prefer 5h window (C), then session/context ratio (A), then estimated */
  let donutPct, donutLabel;
  if (isReal && win5h != null) {
    donutPct   = Math.min(Math.round(win5h), 100);
    donutLabel = '5h 윈도우';
  } else if (isReal && ctxTok > 0) {
    donutPct   = Math.min(Math.round(sessTok / ctxTok * 100), 100);
    donutLabel = '세션';
  } else {
    donutPct   = estCap > 0 ? Math.min(Math.round(estTok / estCap * 100), 100) : 0;
    donutLabel = '추정';
  }

  /* Token bar */
  const barUsed = isReal ? sessTok : estTok;
  const barCap  = isReal ? (ctxTok || CONFIG.GPT_CONTEXT_DEFAULT) : estCap;
  const barPct  = barCap > 0 ? Math.min(Math.round(barUsed / barCap * 100), 100) : 0;
  const barCls  = barPct > CONFIG.RES_ALERT_PCT ? 'alert' : barPct > CONFIG.RES_WARN_PCT ? 'warn' : '';
  const barLeft = Math.max(0, barCap - barUsed);
  const barUsedLabel = isReal ? '세션' : '추정';
  const barCapLabel  = isReal ? '컨텍스트' : '일일용량';

  /* Last used */
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

  /* Bottom meta */
  let metaHtml;
  if (isReal) {
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
              <div class="llm-win-fill ${win5h > CONFIG.RES_ALERT_PCT ? 'alert' : win5h > CONFIG.RES_WARN_PCT ? 'warn' : ''}" style="width:${Math.min(win5h, 100)}%;background:${color}"></div>
            </div>
            <span class="llm-win-pct">${win5h}%</span>
            <span class="llm-win-reset">${reset5h ? fmtResetTime(reset5h) : ''}</span>
          </div>` : ''}
          ${winWk != null ? `
          <div class="llm-win-row">
            <span class="llm-win-label">Week</span>
            <div class="llm-win-bar">
              <div class="llm-win-fill ${winWk > CONFIG.RES_ALERT_PCT ? 'alert' : winWk > CONFIG.RES_WARN_PCT ? 'warn' : ''}" style="width:${Math.min(winWk, 100)}%;background:${color}"></div>
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

  const c   = state.costs;
  const mem = c?.phone_resources?.memory;
  const sto = c?.phone_resources?.storage;
  const bat = c?.phone_resources?.battery;
  const cpu = c?.phone_resources?.cpu;
  const gpt    = c?.llm_usage?.gpt;
  const claude = c?.llm_usage?.claude;
  const stats  = c?.agent_stats;

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
  const batKo = { CHARGING: '충전 중', DISCHARGING: '방전', FULL: '완충', NOT_CHARGING: '미충전' };
  const batIcon = !batOk ? '❓' : batLevel >= CONFIG.BATTERY_EMOJI_FULL ? '🔋' : batLevel >= CONFIG.BATTERY_EMOJI_LOW ? '🪫' : '❗';

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

function renderSyncTime() {
  const el = document.getElementById('lastSyncTime');
  if (!el) return;
  if (!state.lastSync) { el.textContent = '—'; return; }
  el.textContent = relativeTime(state.lastSync.toISOString());
}

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
