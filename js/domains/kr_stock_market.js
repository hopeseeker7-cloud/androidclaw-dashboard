/* ============================================================
   시세 — KRX market quotes, sparklines and a trend chart.
   Design by Gemini (agy / gemini-3.1-pro); wired in and corrected here.
   ============================================================ */

const MarketSection = (() => {
  let currentMarketData = null;
  let activeSymbol = null;

  const SPARK_W = 90;
  const SPARK_H = 24;

  function closes(history) {
    return history.map(h => (typeof h === 'object' ? h.c : h));
  }

  /** Direction of a quote, tolerant of the null-change contract. */
  function direction(quote) {
    const unknown = quote.change_krw === null || quote.change_pct === null
      || quote.prev_close === null;
    if (unknown) return { known: false, cls: 'flat', stroke: 'var(--pnl-flat)' };
    if (quote.change_pct > 0) return { known: true, cls: 'up',   stroke: 'var(--pnl-up)' };
    if (quote.change_pct < 0) return { known: true, cls: 'down', stroke: 'var(--pnl-down)' };
    return { known: true, cls: 'flat', stroke: 'var(--pnl-flat)' };
  }

  /**
   * Signed change text. Fmt.krw carries its own minus and Fmt.pct its own
   * sign, so only the positive KRW case needs a prefix — adding one to the
   * percent too would render "++3.99%".
   */
  function changeText(quote) {
    const krw = (quote.change_krw > 0 ? '+' : '') + Fmt.krw(quote.change_krw);
    return { krw, pct: Fmt.pct(quote.change_pct) };
  }

  function renderSparkline(history, quote) {
    if (!Array.isArray(history) || history.length < 2) {
      return '<span class="txt-muted">—</span>';
    }
    const pad = 2;
    const prices = closes(history);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;

    const points = prices.map((price, idx) => {
      const x = (idx / (prices.length - 1)) * (SPARK_W - 2 * pad) + pad;
      const y = SPARK_H - pad - ((price - min) / range) * (SPARK_H - 2 * pad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    return `<svg class="sparkline sparkline-${direction(quote).cls}"
      viewBox="0 0 ${SPARK_W} ${SPARK_H}" width="${SPARK_W}" height="${SPARK_H}"
      role="img" aria-label="${Fmt.escHtml(quote.name)} 최근 추이">
      <polyline points="${points}" fill="none" stroke="currentColor"
        stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>`;
  }

  /**
   * Min/max callouts sit on their data point, so one landing at the first or
   * last session would render half outside the viewBox. Anchor to the near
   * edge instead of centring once the point is close to it.
   */
  function pointLabel(point, text, y, left, right) {
    const margin = 46;
    let anchor = 'middle';
    if (point.x < left + margin) anchor = 'start';
    else if (point.x > right - margin) anchor = 'end';
    return `<text x="${point.x.toFixed(1)}" y="${y.toFixed(1)}"
      class="chart-point-label" text-anchor="${anchor}">${text}</text>`;
  }

  function renderBigChart(quote) {
    if (!quote || !Array.isArray(quote.history) || quote.history.length < 2) {
      return UI.empty('차트 데이터가 없습니다', '표시할 종가 이력이 부족합니다');
    }

    const history = quote.history;
    const W = 600, H = 200;
    const padTop = 22, padBottom = 26, padLeft = 78, padRight = 16;

    const prices = closes(history);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    const chartW = W - padLeft - padRight;
    const chartH = H - padTop - padBottom;

    const pts = prices.map((price, idx) => ({
      x: padLeft + (idx / (prices.length - 1)) * chartW,
      y: padTop + chartH - ((price - min) / range) * chartH,
      price,
      date: history[idx] && history[idx].d ? history[idx].d : '',
    }));

    const line = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const area = `${padLeft},${H - padBottom} ${line} ${padLeft + chartW},${H - padBottom}`;

    let lo = pts[0], hi = pts[0];
    pts.forEach(p => {
      if (p.price < lo.price) lo = p;
      if (p.price > hi.price) hi = p;
    });

    const dir = direction(quote);

    const grid = [];
    const steps = 3;
    for (let i = 0; i <= steps; i++) {
      const y = padTop + (chartH / steps) * i;
      const val = max - (range / steps) * i;
      grid.push(`<line x1="${padLeft}" y1="${y}" x2="${W - padRight}" y2="${y}" class="chart-grid-line" />
        <text x="${padLeft - 8}" y="${y + 4}" class="chart-axis-label" text-anchor="end">${Fmt.krw(Math.round(val))}</text>`);
    }

    let changeHtml = '<span class="txt-muted">—</span>';
    if (dir.known) {
      const c = changeText(quote);
      const arrow = dir.cls === 'up' ? '▲' : dir.cls === 'down' ? '▼' : '·';
      changeHtml = `<span class="${dir.cls}"><span class="delta-arrow" aria-hidden="true">${arrow}</span> ${c.krw} (${c.pct})</span>`;
    }

    const gradId = `mkt-grad-${Fmt.escHtml(quote.symbol)}`;

    return `<div class="market-detail card">
      <div class="market-detail-head">
        <div class="market-detail-title">
          <span class="market-name">${Fmt.escHtml(quote.name)}</span>
          <span class="market-code mono txt-muted">${Fmt.escHtml(quote.symbol)}</span>
          ${UI.chip(`최근 ${history.length}세션`)}
        </div>
        <div class="market-detail-price">
          <span class="market-price num">${Fmt.krw(quote.close)}</span>
          ${changeHtml}
        </div>
      </div>
      <svg class="big-chart" viewBox="0 0 ${W} ${H}"
        role="img" aria-label="${Fmt.escHtml(quote.name)} 종가 추이">
        <defs>
          <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${dir.stroke}" stop-opacity="0.22" />
            <stop offset="100%" stop-color="${dir.stroke}" stop-opacity="0" />
          </linearGradient>
        </defs>
        ${grid.join('')}
        <polygon points="${area}" fill="url(#${gradId})" />
        <polyline points="${line}" fill="none" stroke="${dir.stroke}"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        <circle cx="${hi.x}" cy="${hi.y}" r="3" class="chart-point" />
        ${pointLabel(hi, `최고 ${Fmt.krw(hi.price)}`, Math.max(13, hi.y - 7), padLeft, W - padRight)}
        <circle cx="${lo.x}" cy="${lo.y}" r="3" class="chart-point" />
        ${pointLabel(lo, `최저 ${Fmt.krw(lo.price)}`, Math.min(H - 6, lo.y + 15), padLeft, W - padRight)}
      </svg>
      <div class="chart-footer txt-muted">
        <span>${Fmt.escHtml(history[0].d)} · ${Fmt.krw(history[0].c)}</span>
        <span>${Fmt.escHtml(history[history.length - 1].d)} · ${Fmt.krw(history[history.length - 1].c)}</span>
      </div>
    </div>`;
  }

  /** Swap the detail chart without re-rendering the whole domain. */
  function selectSymbol(symbol) {
    if (!currentMarketData) return;
    const quote = currentMarketData.quotes.find(q => q.symbol === symbol);
    if (!quote) return;
    activeSymbol = symbol;

    const holder = document.getElementById('marketDetail');
    if (holder) holder.innerHTML = renderBigChart(quote);

    document.querySelectorAll('.market-row').forEach(row => {
      const on = row.dataset.symbol === symbol;
      row.classList.toggle('is-selected', on);
      row.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  function render(marketData) {
    if (!marketData || !Array.isArray(marketData.quotes) || !marketData.quotes.length) {
      return UI.empty('수집된 시세가 없습니다', 'collect 파이프라인 실행 후 표시됩니다');
    }

    currentMarketData = marketData;
    if (!activeSymbol || !marketData.quotes.some(q => q.symbol === activeSymbol)) {
      activeSymbol = marketData.quotes[0].symbol;
    }
    const selected = marketData.quotes.find(q => q.symbol === activeSymbol);

    const columns = [
      {
        key: 'name', label: '종목',
        render: (v, row) => `<div class="market-cell">
          <span class="market-name">${Fmt.escHtml(row.name)}</span>
          <span class="market-code mono txt-muted">${Fmt.escHtml(row.symbol)}</span>
        </div>`,
      },
      { key: 'close', label: '종가', render: v => Fmt.krw(v) },
      {
        key: 'change_pct', label: '전일대비',
        render: (v, row) => {
          const dir = direction(row);
          if (!dir.known) return '<span class="txt-muted">—</span>';
          const c = changeText(row);
          const arrow = dir.cls === 'up' ? '▲' : dir.cls === 'down' ? '▼' : '·';
          return `<span class="${dir.cls}">
            <span class="delta-arrow" aria-hidden="true">${arrow}</span> ${c.krw}
            <span class="market-pct">(${c.pct})</span>
          </span>`;
        },
      },
      { key: 'volume', label: '거래량', render: v => Fmt.count(v) },
      { key: 'history', label: '추이', render: (v, row) => renderSparkline(v, row) },
    ];

    const table = UI.table(columns, marketData.quotes, '시세 없음', {
      rowAttrs: row => {
        const sym = Fmt.escHtml(row.symbol);
        const on = row.symbol === activeSymbol;
        return `class="market-row${on ? ' is-selected' : ''}" data-symbol="${sym}" ` +
               `tabindex="0" role="button" aria-selected="${on}" ` +
               `aria-label="${Fmt.escHtml(row.name)} 차트 보기"`;
      },
    });

    const from = marketData.range && marketData.range.from ? marketData.range.from : null;
    const to = marketData.range && marketData.range.to ? marketData.range.to : null;
    const span = from && to ? `${Fmt.escHtml(from)} ~ ${Fmt.escHtml(to)}` : '—';

    return `<div class="section-head">
        <h3 class="subhead" style="margin:0">시세</h3>
        <div class="section-meta">
          종목 ${Fmt.count(marketData.symbol_count)} · 총 ${Fmt.count(marketData.bar_count)}봉 · ${span}
        </div>
      </div>
      <div id="marketDetail">${renderBigChart(selected)}</div>
      ${table}`;
  }

  /**
   * Delegated so it survives every re-render — the table markup is replaced
   * wholesale on refresh, which would strip per-row listeners.
   */
  function bind() {
    document.addEventListener('click', evt => {
      const row = evt.target.closest && evt.target.closest('.market-row');
      if (row && row.dataset.symbol) selectSymbol(row.dataset.symbol);
    });
    document.addEventListener('keydown', evt => {
      if (evt.key !== 'Enter' && evt.key !== ' ') return;
      const row = evt.target.closest && evt.target.closest('.market-row');
      if (row && row.dataset.symbol) {
        evt.preventDefault();
        selectSymbol(row.dataset.symbol);
      }
    });
  }

  return { render, selectSymbol, bind };
})();
