/* ─────────────────────────────────────────────
   render-trading.js — 트레이딩 탭 렌더러
───────────────────────────────────────────── */

/* 반응형 차트: DOM 삽입 후 실제 너비 기반으로 채움 */
let _pendingCharts = [];

function renderChartsResponsive() {
  _pendingCharts.forEach(({ id, history, exchange }) => {
    const el = document.getElementById(id);
    if (!el) return;
    const w = el.offsetWidth || 480;
    el.innerHTML = svgLineChart(history, exchange, w, 180);
  });
  _pendingCharts = [];
}

function renderPortfolioSection(ex, history) {
  _pendingCharts.push({ id: 'chart-' + ex.exchange, history, exchange: ex.exchange });
  const pf = ex.portfolio || {};
  const capital      = pf.capital_krw || 0;
  const portfolioVal = pf.portfolio_value || capital;
  const cash         = pf.cash_krw || capital;
  const totalPnl     = pf.total_pnl_krw || 0;
  const totalPnlPct  = pf.total_pnl_pct || 0;
  const pnlClass     = totalPnl > 0 ? 'positive' : totalPnl < 0 ? 'negative' : '';
  const pnlSign      = totalPnl > 0 ? '+' : '';

  /* Holdings table */
  const holdings = pf.holdings || [];
  let holdingsHtml = '';
  if (holdings.length > 0) {
    const totalInvested    = holdings.reduce((s, h) => s + h.buy_krw, 0);
    const totalValuation   = holdings.reduce((s, h) => s + h.val_krw, 0);
    const totalHoldingPnl  = holdings.reduce((s, h) => s + h.pnl_krw, 0);
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
          <td class="mono">${h.avg_price?.toLocaleString() || '—'}</td>
          <td class="mono">${fmtKRW(h.buy_krw)}</td>
          <td class="mono" style="font-weight:600">${fmtKRW(h.val_krw)}</td>
        </tr>`;
    }).join('');

    holdingsHtml = `
      <div class="trading-subsection">
        <div class="trading-sub-title">보유 자산 테이블 (총보유자산 아래 = 매수 코인 상세)</div>
        <div class="trading-table-wrap">
          <table class="trading-table holdings-table">
            <thead>
              <tr><th>자산</th><th>평가손익</th><th>수익률</th><th>보유수량</th><th>평균매수가</th><th>매수금액</th><th>평가금액</th></tr>
            </thead>
            <tbody>
              <tr class="holdings-total-row">
                <td style="font-weight:700">총보유자산</td>
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
          <div class="pf-label">현재 수익률 · 자본 ${fmtKRW(capital)}</div>
          <div class="pf-return ${pnlClass}">${pnlSign}${totalPnlPct.toFixed(2)}%</div>
          <div class="pf-value">${portfolioVal.toLocaleString()} KRW</div>
          <div class="pf-detail">원금 ${capital.toLocaleString()} KRW · 현금 ${cash.toLocaleString()} KRW</div>
        </div>
      </div>

      <!-- Donut + Chart row -->
      <div class="pf-charts-row">
        <div class="pf-chart-card">
          <div class="pf-chart-title">자산 분포 (원형)</div>
          ${svgDonutChart(pf.allocation || [], 180)}
        </div>
        <div class="pf-chart-card pf-chart-wide">
          <div class="pf-chart-title">자산 추이 (일자별)</div>
          <div id="chart-${ex.exchange}" class="pf-chart-responsive"></div>
        </div>
      </div>

      ${holdingsHtml}
    </div>`;
}

function renderExchangeCard(ex) {
  const statusColor = ex.status === 'NORMAL' ? 'var(--accent-green)'
                    : ex.status === 'HALTED' ? 'var(--accent-red)'
                    : 'var(--accent-yellow)';
  const statusKo      = ex.status === 'NORMAL' ? '정상' : ex.status === 'HALTED' ? '중지' : ex.status;
  const exchangeEmoji = ex.exchange === 'BITGET' ? '🟡' : ex.exchange === 'BITHUMB' ? '🟠' : '⚪';
  const exchangeType  = ex.exchange === 'BITGET' ? '선물 (Futures)' : '현물 (Spot)';
  const modeLabel     = ex.mode === 'demo' ? 'Paper Trading' : 'Live';
  const posCount      = ex.positions?.length || 0;
  const pnlToday      = ex.pnl_today?.realized_krw ?? 0;
  const tradesToday   = ex.pnl_today?.trades ?? 0;
  const pnlClass      = pnlToday > 0 ? 'positive' : pnlToday < 0 ? 'negative' : '';
  const lastCycle     = ex.last_cycle ? relativeTime(ex.last_cycle) : '—';
  const cfg    = ex.config || {};
  const reg    = ex.strategy_registry || {};
  const sigs   = ex.signals || {};
  const scout  = ex.scout || {};
  const health = ex.cycle_health || {};

  /* ── Config summary ── */
  const configHtml = `
    <div class="trading-config-grid">
      <div class="tcfg"><span class="tcfg-k">자본금</span><span class="tcfg-v">${fmtKRW(cfg.capital_krw || 0)}</span></div>
      <div class="tcfg"><span class="tcfg-k">건당 투자</span><span class="tcfg-v">${fmtKRW(cfg.per_trade_krw || 0)}</span></div>
      <div class="tcfg"><span class="tcfg-k">최대 포지션</span><span class="tcfg-v">${cfg.max_positions || 0}</span></div>
      <div class="tcfg"><span class="tcfg-k">일손절 한도</span><span class="tcfg-v negative">${fmtKRW(cfg.daily_loss_limit_krw || 0)}</span></div>
      <div class="tcfg"><span class="tcfg-k">레버리지</span><span class="tcfg-v">${cfg.leverage || 1}x</span></div>
      <div class="tcfg"><span class="tcfg-k">타임프레임</span><span class="tcfg-v">${escHtml(cfg.timeframe || '?')}</span></div>
    </div>`;

  /* ── Strategy table ── */
  const strats = ex.strategies_flat || [];
  let stratHtml = '';
  if (strats.length > 0) {
    const stratRows = strats.map(s => {
      const total   = s.win_count + s.loss_count;
      const winRate = total > 0 ? Math.round(s.win_count / total * 100) + '%' : '—';
      const pnlCls  = s.total_pnl_krw > 0 ? 'positive' : s.total_pnl_krw < 0 ? 'negative' : '';
      const coins   = s.coins?.length ? s.coins.join(', ') : '';
      const extra   = [];
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
        <div class="trading-sub-title">전략 (${strats.length}개)</div>
        <div class="trading-table-wrap">
          <table class="trading-table">
            <thead><tr><th>전략명</th><th>상태</th><th>시그널</th><th>체결</th><th>PnL</th><th>승률</th></tr></thead>
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
      const sideKo    = s.side === 'buy' ? 'BUY' : 'SELL';
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
        <div class="trading-sub-title">최근 시그널 (paper: ${sigs.paper_count || 0})</div>
        <div class="trading-table-wrap">
          <table class="trading-table">
            <thead><tr><th>심볼</th><th>방향</th><th>신뢰도</th><th>이유</th><th>금액</th></tr></thead>
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
      const winIcon = t.win ? '✅' : '❌';
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
        <div class="trading-sub-title">최근 거래 (최근 5건)</div>
        <div class="trading-table-wrap">
          <table class="trading-table">
            <thead><tr><th>심볼</th><th>알고리즘</th><th>유형</th><th>PnL%</th><th>승패</th></tr></thead>
            <tbody>${tradeRows}</tbody>
          </table>
        </div>
      </div>`;
  }

  /* ── Positions ── */
  let posHtml = '';
  if (posCount > 0) {
    const posRows = ex.positions.map(p => {
      const side      = p.side || p.direction || '—';
      const sideClass = side.toLowerCase().includes('long') ? 'positive' : side.toLowerCase().includes('short') ? 'negative' : '';
      return `
        <tr>
          <td class="mono">${escHtml(p.symbol || '—')}</td>
          <td class="${sideClass}" style="font-weight:700">${escHtml(side)}</td>
          <td class="mono">${fmtKRW(p.entry_krw || p.size_krw || 0)}</td>
          <td class="mono ${(p.pnl_krw || 0) >= 0 ? 'positive' : 'negative'}">${fmtKRW(p.pnl_krw || 0)}</td>
          <td class="mono">${p.entry_time ? relativeTime(p.entry_time) : '—'}</td>
        </tr>`;
    }).join('');

    posHtml = `
      <div class="trading-subsection">
        <div class="trading-sub-title">포지션 (${posCount}개)</div>
        <div class="trading-table-wrap">
          <table class="trading-table">
            <thead><tr><th>심볼</th><th>방향</th><th>크기</th><th>PnL</th><th>진입</th></tr></thead>
            <tbody>${posRows}</tbody>
          </table>
        </div>
      </div>`;
  } else {
    posHtml = `
      <div class="trading-subsection">
        <div class="trading-empty-pos">포지션 없음 — 대기 중</div>
      </div>`;
  }

  /* ── Scout ── */
  let scoutHtml = '';
  if (scout.universe_count > 0) {
    scoutHtml = `
      <div class="trading-scout">
        <span class="trading-scout-label">탐색 유니버스:</span>
        ${scout.top_symbols.map(s => `<span class="scout-chip">${escHtml(s)}</span>`).join('')}
        ${scout.universe_count > 8 ? `<span class="scout-more">+${scout.universe_count - 8}</span>` : ''}
      </div>`;
  }

  /* ── Cycle health ── */
  let healthHtml = '';
  if (health.cycles_in_log) {
    healthHtml = `
      <div class="trading-health">
        <span>사이클: ${health.completed}/${health.cycles_in_log}</span>
        <span>에러: <span class="${health.errors > 0 ? 'negative' : ''}">${health.errors}</span></span>
        <span>마지막: ${lastCycle}</span>
      </div>`;
  }

  return `
    <div class="trading-exchange-card">
      <div class="trading-ex-header">
        <div class="trading-ex-title">
          <span class="trading-ex-emoji">${exchangeEmoji}</span>
          <div>
            <div class="trading-ex-name">${escHtml(ex.exchange)} <span class="trading-mode-badge">${modeLabel}</span></div>
            <div class="trading-ex-type">${exchangeType} · ${escHtml(cfg.market || '')}</div>
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
          <span class="trading-metric-k">포지션</span>
        </div>
        <div class="trading-metric">
          <span class="trading-metric-v ${pnlClass}">${fmtKRW(pnlToday)}</span>
          <span class="trading-metric-k">오늘 PnL</span>
        </div>
        <div class="trading-metric">
          <span class="trading-metric-v">${tradesToday}</span>
          <span class="trading-metric-k">오늘 거래</span>
        </div>
        <div class="trading-metric">
          <span class="trading-metric-v">${reg.total_signals || 0}</span>
          <span class="trading-metric-k">누적 시그널</span>
        </div>
        <div class="trading-metric">
          <span class="trading-metric-v">${reg.active || 0}/${reg.total || 0}</span>
          <span class="trading-metric-k">활성 전략</span>
        </div>
        <div class="trading-metric">
          <span class="trading-metric-v">${lastCycle}</span>
          <span class="trading-metric-k">마지막 사이클</span>
        </div>
      </div>

      ${configHtml}
      ${posHtml}
      ${sigHtml}
      ${stratHtml}
      ${tradesHtml}
      ${scoutHtml}
      ${healthHtml}

      ${ex.error ? `<div class="trading-error">⚠ ${escHtml(ex.error)}</div>` : ''}
    </div>`;
}

function renderTrading() {
  const panel = document.getElementById('tradingPanel');
  if (!panel) return;

  const tb = state.tradebot;
  if (!tb || !tb.exchanges || !tb.exchanges.length) {
    panel.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">📈</span>
        트레이딩 데이터 없음
      </div>`;
    const statusEl = document.getElementById('tradingStatus');
    if (statusEl) statusEl.textContent = '—';
    return;
  }

  const sm = tb.summary || {};
  const summaryHtml = `
    <div class="trading-summary-bar">
      <div class="tsb-item"><span class="tsb-v">${sm.total_exchanges || 0}</span><span class="tsb-k">거래소</span></div>
      <div class="tsb-item"><span class="tsb-v">${sm.total_positions || 0}</span><span class="tsb-k">포지션</span></div>
      <div class="tsb-item"><span class="tsb-v">${sm.total_signals || 0}</span><span class="tsb-k">대기 시그널</span></div>
      <div class="tsb-item"><span class="tsb-v">${sm.total_strategies || 0}</span><span class="tsb-k">전략</span></div>
      <div class="tsb-item"><span class="tsb-v">${tb.host || '—'}</span><span class="tsb-k">호스트</span></div>
      <div class="tsb-item"><span class="tsb-v">${tb.ts ? relativeTime(tb.ts) : '—'}</span><span class="tsb-k">데이터 기준</span></div>
    </div>`;

  _pendingCharts = [];
  panel.innerHTML = summaryHtml + tb.exchanges.map(renderExchangeCard).join('');
  renderChartsResponsive();

  const statusEl = document.getElementById('tradingStatus');
  if (statusEl) {
    statusEl.textContent = `${sm.total_exchanges || 0}개 거래소 · ${sm.total_positions || 0} 포지션 · ${sm.total_signals || 0} 시그널`;
  }
}
