/* ============================================================
   Domain renderer — 한국 주식 (kr_stock)
   Reads the v2 envelope; renders status → KPI → positions → ops.
   ============================================================ */

const KrStockDomain = (() => {

  const MODE_LABEL = { paper: '모의', canary: '카나리' };
  const MARKET_LABEL = {
    open: '장중', closed: '장마감', pre_market: '장전',
    holiday: '휴장', unknown: '알 수 없음',
  };

  function label() { return '한국 주식'; }

  /** Top strip: envelope status + mode + market + cutoff. */
  function statusbar(entry) {
    const p = entry.payload;
    const d = p.data;
    const mode = MODE_LABEL[d.mode] || d.mode || 'paper';
    const market = MARKET_LABEL[d.snapshot?.market_status] || d.snapshot?.market_status || '—';
    const reason = p.status !== 'ok' && p.status_reason ? p.status_reason : '';

    return `<div class="statusbar">
      <div class="statusbar-left">
        ${UI.envelopeBadge(p.status)}
        ${UI.chip(mode)}
        ${UI.chip(market)}
      </div>
      <div class="statusbar-meta">
        기준 <span class="mono">${Fmt.dateTime(p.as_of)}</span>
        · 갱신 ${Fmt.relative(p.generated_at)}
      </div>
      ${reason ? `<div class="statusbar-reason">${Fmt.escHtml(reason)}</div>` : ''}
    </div>`;
  }

  /** KPI row. Cash uses the display fields — never the raw ledger sign. */
  function kpis(d) {
    const pf = d.portfolio || {};
    const cash = pf.cash || {};
    const pnl = d.pnl || {};

    return `<div class="grid grid-kpi">
      ${UI.stat({
        label: '포트폴리오 총액',
        value: `<span class="num">${Fmt.krw(pf.total_value_krw)}</span>`,
        sub: `보유 ${Fmt.count(pf.position_count ?? 0)}종목`,
        hero: true,
      })}
      ${UI.statDelta({
        label: '당일 실현손익',
        amount: pnl.realized_today_krw,
        sub: `체결 ${Fmt.count(pnl.trades_today ?? 0)}건`,
      })}
      ${UI.statDelta({
        label: '평가손익',
        amount: pnl.unrealized_krw,
        sub: `누적 실현 ${Fmt.krw(pnl.realized_cumulative_krw)}`,
      })}
      ${UI.stat({
        label: '주문가능 현금',
        value: `<span class="num">${Fmt.krw(cash.available_krw)}</span>`,
        sub: `투입원금 ${Fmt.krw(cash.net_deposit_krw)}`,
      })}
    </div>`;
  }

  function positions(d) {
    const rows = Array.isArray(d.positions) ? d.positions : [];
    const columns = [
      { key: 'symbol', label: '종목' },
      { key: 'quantity', label: '수량', render: v => Fmt.count(v) },
      { key: 'avg_cost', label: '평단', render: v => Fmt.krw(v) },
      {
        key: 'unrealized_pnl_krw', label: '평가손익',
        render: (v, row) => {
          const dd = Fmt.delta(v);
          return `<span class="${dd.cls}">
            <span class="delta-arrow" aria-hidden="true">${dd.arrow}</span> ${dd.text}
          </span> <span class="table-muted">(${Fmt.pct(row.pnl_pct)})</span>`;
        },
      },
    ];
    return UI.table(columns, rows, '보유 포지션 없음');
  }

  /** Operational health: snapshot, reconciliation, pipeline, strategies. */
  function operations(d) {
    const snap = d.snapshot || {};
    const recon = d.reconciliation || {};
    const pipe = d.pipeline || {};
    const strategies = Array.isArray(d.strategies) ? d.strategies : [];

    const openIssues = recon.open_issues ?? 0;
    const reconStatus = recon.critical ? 'failed' : (openIssues > 0 ? 'degraded' : 'healthy');
    const reconText = recon.critical
      ? '정합성 CRITICAL'
      : (openIssues > 0 ? `미해결 이슈 ${Fmt.count(openIssues)}건` : '이슈 없음');

    const strategyChips = strategies.length
      ? strategies.map(s => UI.chip(`${s.name || '—'} · ${s.status || '—'}`)).join(' ')
      : '<span class="table-muted">등록된 전략 없음</span>';

    return `<div class="grid grid-split">
      <div class="card card-tight">
        <div class="subhead" style="margin-top:0">스냅샷</div>
        ${UI.dl([
          ['상태', UI.badge(snap.status)],
          ['사유', `<span class="table-muted">${Fmt.escHtml(snap.status_reason || '—')}</span>`],
          ['종목 / 지연', `${Fmt.count(snap.total_symbols ?? 0)} / ${Fmt.count(snap.stale_symbols ?? 0)}`],
          ['ID', `<span class="table-muted">${Fmt.escHtml((snap.snapshot_id || '—').slice(0, 18))}</span>`],
        ])}
      </div>
      <div class="card card-tight">
        <div class="subhead" style="margin-top:0">정합성 · 파이프라인</div>
        ${UI.dl([
          ['정합성', `${UI.badge(reconStatus)} <span class="table-muted">${Fmt.escHtml(reconText)}</span>`],
          ['파이프라인', UI.badge(pipe.last_status || 'unknown')],
          ['최근 실행', `<span class="table-muted">${Fmt.dateTime(pipe.last_run)}</span>`],
        ])}
        ${UI.notes((recon.issues || []).slice(0, 4))}
      </div>
      <div class="card card-tight">
        <div class="subhead" style="margin-top:0">전략</div>
        <div style="display:flex;flex-wrap:wrap;gap:var(--sp-1)">${strategyChips}</div>
      </div>
    </div>`;
  }

  function render(entry) {
    const p = entry.payload;

    if (entry.error) {
      return statusbarError(entry) +
        UI.empty('데이터를 불러오지 못했습니다', entry.error);
    }

    const body = p.status === 'no_data'
      ? UI.empty(p.status_reason || '아직 수집된 데이터가 없습니다',
                 'collect 파이프라인 실행 후 표시됩니다')
      : `${kpis(p.data)}
         <div class="subhead">보유 포지션</div>
         ${positions(p.data)}
         <div class="subhead">운영 상태</div>
         ${operations(p.data)}`;

    return `${statusbar(entry)}
      ${body}
      <div class="footnote">🔒 live 발주 비활성 · paper/canary 전용</div>`;
  }

  function statusbarError(entry) {
    return `<div class="statusbar">
      <div class="statusbar-left">
        ${UI.envelopeBadge('error')}
        ${UI.chip(entry.label || entry.key)}
      </div>
    </div>`;
  }

  return { key: 'kr_stock', label, render };
})();
