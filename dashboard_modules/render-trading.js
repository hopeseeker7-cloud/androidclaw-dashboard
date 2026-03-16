let _pendingCharts = [];

function renderChartsResponsive() {
  _pendingCharts.forEach(({ id, history, exchange }) => {
    const el = document.getElementById(id);
    if (!el) return;
    const width = el.offsetWidth || 480;
    el.innerHTML = svgLineChart(history, exchange, width, 180);
  });
  _pendingCharts = [];
}

function fmtPlainNumber(value, digits = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  return num.toLocaleString('en-US', {
    minimumFractionDigits: num % 1 === 0 ? 0 : 0,
    maximumFractionDigits: digits,
  });
}

function fmtUSDT(value, digits = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  return `${num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })} USDT`;
}

function formatSignedPercent(value, digits = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  return `${num > 0 ? '+' : ''}${num.toFixed(digits)}%`;
}

function positionPnlText(position) {
  if (position.pnl_krw != null) return fmtKRW(position.pnl_krw);

  const pnlUsdt = position.unrealized_pnl_usdt ?? position.pnl_usdt;
  if (pnlUsdt == null) return '—';
  const num = Number(pnlUsdt);
  if (!Number.isFinite(num)) return '—';
  return `${num > 0 ? '+' : ''}${fmtUSDT(num, 2)}`;
}

function buildPositionExposure(position) {
  if (position.notional_usdt != null) {
    const leverage = position.leverage != null ? ` · ${position.leverage}x` : '';
    return `${fmtUSDT(position.notional_usdt)}${leverage}`;
  }

  if (position.margin_usdt != null) {
    const leverage = position.leverage != null ? ` · ${position.leverage}x` : '';
    return `${fmtUSDT(position.margin_usdt)} margin${leverage}`;
  }

  if (position.krw != null) return fmtKRW(position.krw);
  if (position.size_krw != null) return fmtKRW(position.size_krw);
  if (position.entry_krw != null) return fmtKRW(position.entry_krw);
  if (position.qty != null) return fmtPlainNumber(position.qty, 6);

  return '—';
}

function buildPositionEntry(position) {
  const parts = [];

  if (position.entry_price != null) {
    parts.push(fmtPlainNumber(position.entry_price, 4));
  } else if (position.entry_krw != null) {
    parts.push(fmtKRW(position.entry_krw));
  }

  const openedAt = position.opened_ts || position.entry_time;
  if (openedAt) parts.push(relativeTime(openedAt));

  return parts.length ? parts.join(' · ') : '—';
}

function renderPortfolioSection(exchange) {
  const history = Array.isArray(exchange.history) ? exchange.history : [];
  _pendingCharts.push({ id: 'chart-' + exchange.exchange, history, exchange: exchange.exchange });

  const portfolio = exchange.portfolio || {};
  const capital = Number(portfolio.capital_krw ?? 0);
  const portfolioValue = Number(portfolio.portfolio_value ?? capital);
  const cash = Number(portfolio.cash_krw ?? capital);
  const totalPnl = Number(portfolio.total_pnl_krw ?? 0);
  const totalPnlPct = Number(portfolio.total_pnl_pct ?? 0);
  const pnlClass = totalPnl > 0 ? 'positive' : totalPnl < 0 ? 'negative' : '';
  const pnlSign = totalPnl > 0 ? '+' : '';

  const holdings = Array.isArray(portfolio.holdings) ? portfolio.holdings : [];
  const allocation = Array.isArray(portfolio.allocation) ? portfolio.allocation : [];
  const allocationHtml = allocation.length
    ? svgDonutChart(allocation, 180)
    : '<div class="chart-empty">현재 포지션 기준 배분 데이터 없음</div>';

  let holdingsHtml = '';
  if (holdings.length > 0) {
    const totalInvested = holdings.reduce((sum, holding) => sum + Number(holding.buy_krw || 0), 0);
    const totalValuation = holdings.reduce((sum, holding) => sum + Number(holding.val_krw || 0), 0);
    const totalHoldingPnl = holdings.reduce((sum, holding) => sum + Number(holding.pnl_krw || 0), 0);
    const totalHoldingPnlPct = totalInvested > 0 ? (totalHoldingPnl / totalInvested) * 100 : 0;
    const totalClass = totalHoldingPnl > 0 ? 'positive' : totalHoldingPnl < 0 ? 'negative' : '';

    const rows = holdings.map(holding => {
      const pnl = Number(holding.pnl_krw || 0);
      const pnlClassName = pnl > 0 ? 'positive' : pnl < 0 ? 'negative' : '';
      const pnlPct = Number(holding.pnl_pct || 0);

      return `
        <tr>
          <td class="mono" style="font-weight:600">${escHtml(holding.symbol || '—')}</td>
          <td class="mono ${pnlClassName}">${pnl > 0 ? '+' : ''}${fmtKRW(pnl)}</td>
          <td class="mono ${pnlClassName}">${formatSignedPercent(pnlPct)}</td>
          <td class="mono">${fmtPlainNumber(holding.qty, 8)}</td>
          <td class="mono">${holding.avg_price != null ? fmtPlainNumber(holding.avg_price, 6) : '—'}</td>
          <td class="mono">${fmtKRW(holding.buy_krw || 0)}</td>
          <td class="mono" style="font-weight:600">${fmtKRW(holding.val_krw || 0)}</td>
        </tr>`;
    }).join('');

    holdingsHtml = `
      <div class="trading-subsection">
        <div class="trading-sub-title">보유 자산 상세</div>
        <div class="trading-table-wrap">
          <table class="trading-table holdings-table">
            <thead>
              <tr><th>자산</th><th>평가 손익</th><th>수익률</th><th>보유 수량</th><th>평균 매수가</th><th>매수 금액</th><th>평가 금액</th></tr>
            </thead>
            <tbody>
              <tr class="holdings-total-row">
                <td style="font-weight:700">총 보유 자산</td>
                <td class="mono ${totalClass}" style="font-weight:700">${totalHoldingPnl > 0 ? '+' : ''}${fmtKRW(totalHoldingPnl)}</td>
                <td class="mono ${totalClass}" style="font-weight:700">${formatSignedPercent(totalHoldingPnlPct)}</td>
                <td>-</td>
                <td>-</td>
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
      <div class="pf-summary-header">
        <div class="pf-summary-left">
          <div class="pf-label">누적 손익 기준 자본 ${fmtKRW(capital)}</div>
          <div class="pf-return ${pnlClass}">${pnlSign}${totalPnlPct.toFixed(2)}%</div>
          <div class="pf-value">${portfolioValue.toLocaleString()} KRW</div>
          <div class="pf-detail">원금 ${capital.toLocaleString()} KRW · 현금 ${cash.toLocaleString()} KRW</div>
        </div>
      </div>

      <div class="pf-charts-row">
        <div class="pf-chart-card">
          <div class="pf-chart-title">현재 포지션 배분</div>
          ${allocationHtml}
        </div>
        <div class="pf-chart-card pf-chart-wide">
          <div class="pf-chart-title">자산 추이</div>
          <div id="chart-${exchange.exchange}" class="pf-chart-responsive"></div>
        </div>
      </div>

      ${holdingsHtml}
    </div>`;
}

function renderPassionateTrader(exchange) {
  const pt = exchange.passionate_trader;
  if (!pt) return '';

  const emotional = pt.emotional || {};
  const budget = pt.budget || {};
  const desires = pt.desires || {};
  const emotionState = emotional.state || 'neutral';
  const emotionMap = {
    neutral: { emoji: '🙂', ko: '중립', color: 'var(--text-dim)' },
    excited: { emoji: '😆', ko: '흥분', color: 'var(--accent-green)' },
    confident: { emoji: '😎', ko: '자신감', color: 'var(--accent-blue, #60a5fa)' },
    cautious: { emoji: '😬', ko: '경계', color: 'var(--accent-yellow)' },
    frustrated: { emoji: '😤', ko: '초조', color: 'var(--accent-orange, #fb923c)' },
    defeated: { emoji: '😵', ko: '침체', color: 'var(--accent-red)' },
    bored: { emoji: '🥱', ko: '지루함', color: 'var(--text-dim)' },
  };
  const emotionInfo = emotionMap[emotionState] || { emoji: '🙂', ko: emotionState, color: 'var(--text-dim)' };

  const riskPct = Math.round((Number(emotional.win_rate_7d) || 0.5) * 100);
  const dailyPnl = Number(emotional.daily_pnl_pct || 0);
  const dailyPnlClass = dailyPnl > 0 ? 'positive' : dailyPnl < 0 ? 'negative' : '';
  const consecutiveWins = Number(emotional.consecutive_wins || 0);
  const consecutiveLosses = Number(emotional.consecutive_losses || 0);
  const apiUsed = Number(budget.daily_calls || 0);
  const apiMax = 50;
  const tradeLoss = Math.abs(Number(budget.daily_trade_loss_krw || 0));

  const desireChips = Object.entries(desires)
    .filter(([name]) => name !== '_meta')
    .map(([name, item]) => {
      const failures = Number(item.consecutive_failures || 0);
      const cls = failures >= 3 ? 'negative' : failures > 0 ? 'accent-yellow' : '';
      return `<span class="scout-chip ${cls}" title="failures: ${failures}">${escHtml(name)}</span>`;
    })
    .join('');

  return `
    <div class="pt-status-bar">
      <div class="pt-emotion" style="border-left: 3px solid ${emotionInfo.color}">
        <span class="pt-emoji">${emotionInfo.emoji}</span>
        <div>
          <div class="pt-emotion-name" style="color:${emotionInfo.color}">${emotionInfo.ko}</div>
          <div class="pt-emotion-detail">
            연승 ${consecutiveWins} · 연패 ${consecutiveLosses} · 7일 승률 ${riskPct}%
          </div>
        </div>
      </div>
      <div class="pt-metrics-row">
        <div class="pt-metric">
          <span class="pt-metric-v ${dailyPnlClass}">${dailyPnl > 0 ? '+' : ''}${dailyPnl.toFixed(2)}%</span>
          <span class="pt-metric-k">오늘 PnL</span>
        </div>
        <div class="pt-metric">
          <span class="pt-metric-v">${apiUsed}/${apiMax}</span>
          <span class="pt-metric-k">API 사용</span>
        </div>
        <div class="pt-metric">
          <span class="pt-metric-v ${tradeLoss > 0 ? 'negative' : ''}">${fmtKRW(tradeLoss)}</span>
          <span class="pt-metric-k">매매 손실</span>
        </div>
      </div>
      ${desireChips ? `<div class="pt-desires">${desireChips}</div>` : ''}
    </div>`;
}

function renderExchangeCard(exchange) {
  const statusColor = exchange.status === 'NORMAL'
    ? 'var(--accent-green)'
    : exchange.status === 'HALTED'
      ? 'var(--accent-red)'
      : 'var(--accent-yellow)';

  const statusKo = exchange.status === 'NORMAL' ? '정상' : exchange.status === 'HALTED' ? '중지' : exchange.status;
  const exchangeEmoji = exchange.exchange === 'BITGET' ? '📈' : exchange.exchange === 'BITHUMB' ? '💱' : '📊';
  const exchangeType = exchange.exchange === 'BITGET' ? '선물 (Futures)' : '현물 (Spot)';
  const modeLabel = exchange.mode === 'demo' ? 'Paper Trading' : 'Live';
  const positions = Array.isArray(exchange.positions) ? exchange.positions : [];
  const posCount = positions.length;
  const pnlToday = Number(exchange.pnl_today?.realized_krw ?? 0);
  const tradesToday = Number(exchange.pnl_today?.trades ?? 0);
  const pnlClass = pnlToday > 0 ? 'positive' : pnlToday < 0 ? 'negative' : '';
  const lastCycle = exchange.last_cycle ? relativeTime(exchange.last_cycle) : '—';
  const config = exchange.config || {};
  const registry = exchange.strategy_registry || {};
  const signals = exchange.signals || {};
  const scout = exchange.scout || {};
  const health = exchange.cycle_health || {};

  const configHtml = `
    <div class="trading-config-grid">
      <div class="tcfg"><span class="tcfg-k">자본금</span><span class="tcfg-v">${fmtKRW(config.capital_krw || 0)}</span></div>
      <div class="tcfg"><span class="tcfg-k">거래당 투자</span><span class="tcfg-v">${fmtKRW(config.per_trade_krw || 0)}</span></div>
      <div class="tcfg"><span class="tcfg-k">최대 포지션</span><span class="tcfg-v">${config.max_positions || 0}</span></div>
      <div class="tcfg"><span class="tcfg-k">일일 손실 한도</span><span class="tcfg-v negative">${fmtKRW(config.daily_loss_limit_krw || 0)}</span></div>
      <div class="tcfg"><span class="tcfg-k">레버리지</span><span class="tcfg-v">${config.leverage || 1}x</span></div>
      <div class="tcfg"><span class="tcfg-k">타임프레임</span><span class="tcfg-v">${escHtml(config.timeframe || '—')}</span></div>
    </div>`;

  let strategyHtml = '';
  const strategies = Array.isArray(exchange.strategies_flat) ? exchange.strategies_flat : [];
  if (strategies.length > 0) {
    const strategyRows = strategies.map(strategy => {
      const total = Number(strategy.win_count || 0) + Number(strategy.loss_count || 0);
      const winRate = total > 0 ? `${Math.round((Number(strategy.win_count || 0) / total) * 100)}%` : '—';
      const pnl = Number(strategy.total_pnl_krw || 0);
      const pnlClassName = pnl > 0 ? 'positive' : pnl < 0 ? 'negative' : '';
      const coins = Array.isArray(strategy.coins) && strategy.coins.length ? strategy.coins.join(', ') : '';
      const extra = [];
      if (strategy.timeframe) extra.push(strategy.timeframe);
      if (strategy.position_scale && strategy.position_scale !== 1) extra.push('scale:' + strategy.position_scale);

      return `
        <tr>
          <td>
            <div class="strat-name">${escHtml(strategy.name || '—')}</div>
            ${coins ? `<div class="strat-coins">${escHtml(coins)}</div>` : ''}
            ${extra.length ? `<span class="strat-extra">${escHtml(extra.join(' · '))}</span>` : ''}
          </td>
          <td><span class="strat-status-badge strat-${strategy.status}">${escHtml(strategy.status || 'unknown')}</span></td>
          <td class="mono">${strategy.total_signals || 0}</td>
          <td class="mono">${strategy.total_fills || 0}</td>
          <td class="mono ${pnlClassName}">${fmtKRW(pnl)}</td>
          <td class="mono">${winRate}</td>
        </tr>`;
    }).join('');

    strategyHtml = `
      <div class="trading-subsection">
        <div class="trading-sub-title">전략 (${strategies.length}개)</div>
        <div class="trading-table-wrap">
          <table class="trading-table">
            <thead><tr><th>전략명</th><th>상태</th><th>시그널</th><th>체결</th><th>PnL</th><th>승률</th></tr></thead>
            <tbody>${strategyRows}</tbody>
          </table>
        </div>
      </div>`;
  }

  let signalHtml = '';
  const paperSignals = Array.isArray(signals.paper_signals) ? signals.paper_signals : [];
  if (paperSignals.length > 0) {
    const signalRows = paperSignals.map(signal => {
      const sideClass = signal.side === 'buy' ? 'positive' : 'negative';
      const sideKo = signal.side === 'buy' ? 'BUY' : 'SELL';

      return `
        <tr>
          <td class="mono">${escHtml(signal.symbol || '')}</td>
          <td class="${sideClass}" style="font-weight:700">${sideKo}</td>
          <td>${confidenceBadge(signal.confidence)}</td>
          <td class="sig-reason">${escHtml((signal.reason || '').slice(0, 60))}</td>
          <td class="mono">${fmtKRW(signal.krw || 0)}</td>
        </tr>`;
    }).join('');

    signalHtml = `
      <div class="trading-subsection">
        <div class="trading-sub-title">최근 시그널 (paper: ${signals.paper_count || 0})</div>
        <div class="trading-table-wrap">
          <table class="trading-table">
            <thead><tr><th>심볼</th><th>방향</th><th>신뢰도</th><th>이유</th><th>금액</th></tr></thead>
            <tbody>${signalRows}</tbody>
          </table>
        </div>
      </div>`;
  }

  let tradesHtml = '';
  const recentTrades = Array.isArray(exchange.recent_trades) ? exchange.recent_trades : [];
  if (recentTrades.length > 0) {
    const tradeRows = recentTrades.slice(0, 10).map(trade => {
      const pnlKrw = Number(trade.pnl_krw || 0);
      const tradePnlClass = pnlKrw > 0 ? 'positive' : pnlKrw < 0 ? 'negative' : '';
      const reason = (trade.reason || '').replace(/^exit:\s*/i, '').slice(0, 30);
      const timeText = trade.ts ? relativeTime(trade.ts) : '—';
      const winIcon = trade.win ? '✅' : '❌';

      return `
        <tr>
          <td class="mono">${escHtml(trade.symbol || '—')}</td>
          <td>${escHtml(trade.algo || trade.type || '—')}</td>
          <td class="mono ${tradePnlClass}">${pnlKrw > 0 ? '+' : ''}${fmtKRW(pnlKrw)}</td>
          <td class="mono ${tradePnlClass}">${formatSignedPercent(trade.pnl_pct || 0)}</td>
          <td class="sig-reason">${escHtml(reason)}</td>
          <td>${timeText}</td>
          <td>${winIcon}</td>
        </tr>`;
    }).join('');

    tradesHtml = `
      <div class="trading-subsection">
        <div class="trading-sub-title">최근 거래 (${recentTrades.length}건)</div>
        <div class="trading-table-wrap">
          <table class="trading-table">
            <thead><tr><th>심볼</th><th>전략</th><th>PnL</th><th>수익률</th><th>사유</th><th>시간</th><th>결과</th></tr></thead>
            <tbody>${tradeRows}</tbody>
          </table>
        </div>
      </div>`;
  }

  let positionsHtml = '';
  if (posCount > 0) {
    const positionRows = positions.map(position => {
      const side = position.side || position.direction || '—';
      const sideLower = side.toLowerCase();
      const sideClass = (sideLower.includes('long') || sideLower === 'buy')
        ? 'positive'
        : (sideLower.includes('short') || sideLower === 'sell')
          ? 'negative'
          : '';
      const pnlText = positionPnlText(position);
      const pnlRaw = position.pnl_krw ?? position.unrealized_pnl_usdt ?? position.pnl_usdt;
      const pnlClassName = pnlRaw > 0 ? 'positive' : pnlRaw < 0 ? 'negative' : '';

      return `
        <tr>
          <td class="mono">${escHtml(position.symbol || '—')}</td>
          <td class="${sideClass}" style="font-weight:700">${escHtml(side)}</td>
          <td class="mono">${buildPositionExposure(position)}</td>
          <td class="mono ${pnlClassName}">${pnlText}</td>
          <td class="mono">${buildPositionEntry(position)}</td>
        </tr>`;
    }).join('');

    positionsHtml = `
      <div class="trading-subsection">
        <div class="trading-sub-title">포지션 (${posCount}개)</div>
        <div class="trading-table-wrap">
          <table class="trading-table">
            <thead><tr><th>심볼</th><th>방향</th><th>노출</th><th>PnL</th><th>진입</th></tr></thead>
            <tbody>${positionRows}</tbody>
          </table>
        </div>
      </div>`;
  } else {
    positionsHtml = `
      <div class="trading-subsection">
        <div class="trading-empty-pos">포지션 없음 · 대기 중</div>
      </div>`;
  }

  let scoutHtml = '';
  if (Number(scout.universe_count || 0) > 0) {
    const topSymbols = Array.isArray(scout.top_symbols) ? scout.top_symbols : [];
    scoutHtml = `
      <div class="trading-scout">
        <span class="trading-scout-label">탐색 유니버스:</span>
        ${topSymbols.slice(0, 8).map(symbol => `<span class="scout-chip">${escHtml(symbol)}</span>`).join('')}
        ${Number(scout.universe_count) > 8 ? `<span class="scout-more">+${Number(scout.universe_count) - 8}</span>` : ''}
      </div>`;
  }

  let healthHtml = '';
  if (health.cycles_in_log) {
    healthHtml = `
      <div class="trading-health">
        <span>사이클: ${health.completed || 0}/${health.cycles_in_log}</span>
        <span>에러: <span class="${health.errors > 0 ? 'negative' : ''}">${health.errors || 0}</span></span>
        <span>마지막: ${lastCycle}</span>
      </div>`;
  }

  return `
    <div class="trading-exchange-card">
      <div class="trading-ex-header">
        <div class="trading-ex-title">
          <span class="trading-ex-emoji">${exchangeEmoji}</span>
          <div>
            <div class="trading-ex-name">${escHtml(exchange.exchange || '—')} <span class="trading-mode-badge">${modeLabel}</span></div>
            <div class="trading-ex-type">${exchangeType} · ${escHtml(config.market || '')}</div>
          </div>
        </div>
        <div class="trading-ex-status" style="color:${statusColor}">
          <span class="trading-status-dot" style="background:${statusColor}"></span>
          ${statusKo}
        </div>
      </div>

      ${renderPassionateTrader(exchange)}
      ${renderPortfolioSection(exchange)}

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
          <span class="trading-metric-v">${registry.total_signals || 0}</span>
          <span class="trading-metric-k">누적 시그널</span>
        </div>
        <div class="trading-metric">
          <span class="trading-metric-v">${registry.active || 0}/${registry.total || 0}</span>
          <span class="trading-metric-k">활성 전략</span>
        </div>
        <div class="trading-metric">
          <span class="trading-metric-v">${lastCycle}</span>
          <span class="trading-metric-k">마지막 사이클</span>
        </div>
      </div>

      ${configHtml}
      ${positionsHtml}
      ${signalHtml}
      ${strategyHtml}
      ${tradesHtml}
      ${scoutHtml}
      ${healthHtml}

      ${exchange.error ? `<div class="trading-error">⚠ ${escHtml(exchange.error)}</div>` : ''}
    </div>`;
}

function renderTrading() {
  const panel = document.getElementById('tradingPanel');
  if (!panel) return;

  const tradebot = state.tradebot;
  const exchanges = Array.isArray(tradebot?.exchanges) ? tradebot.exchanges : [];

  if (!tradebot || exchanges.length === 0) {
    panel.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">📈</span>
        트레이딩 데이터 없음
      </div>`;

    const statusEl = document.getElementById('tradingStatus');
    if (statusEl) statusEl.textContent = '—';
    return;
  }

  const summary = tradebot.summary || {};
  const summaryHtml = `
    <div class="trading-summary-bar">
      <div class="tsb-item"><span class="tsb-v">${summary.total_exchanges || exchanges.length}</span><span class="tsb-k">거래소</span></div>
      <div class="tsb-item"><span class="tsb-v">${summary.total_positions || 0}</span><span class="tsb-k">포지션</span></div>
      <div class="tsb-item"><span class="tsb-v">${summary.total_signals || 0}</span><span class="tsb-k">대기 시그널</span></div>
      <div class="tsb-item"><span class="tsb-v">${summary.total_strategies || 0}</span><span class="tsb-k">전략</span></div>
      <div class="tsb-item"><span class="tsb-v">${escHtml(tradebot.host || '—')}</span><span class="tsb-k">호스트</span></div>
      <div class="tsb-item"><span class="tsb-v">${tradebot.ts ? relativeTime(tradebot.ts) : '—'}</span><span class="tsb-k">데이터 기준</span></div>
    </div>`;

  _pendingCharts = [];
  panel.innerHTML = summaryHtml + exchanges.map(renderExchangeCard).join('');
  renderChartsResponsive();

  const statusEl = document.getElementById('tradingStatus');
  if (statusEl) {
    statusEl.textContent = `${summary.total_exchanges || exchanges.length}개 거래소 · ${summary.total_positions || 0} 포지션 · ${summary.total_signals || 0} 시그널`;
  }
}
