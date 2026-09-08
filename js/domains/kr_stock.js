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
    const generatedAt = typeof p.generated_at === 'string' ? Date.parse(p.generated_at) : NaN;
    const fileIsOld = Number.isFinite(generatedAt) && Date.now() - generatedAt > 48 * 60 * 60 * 1000;
    const refreshed = `갱신 ${Fmt.relative(p.generated_at)}`;
    const fileAge = fileIsOld
      ? `<span class="chip chip-warn"><span aria-hidden="true">⚠</span> ${refreshed} · 생산자 정지 의심</span>`
      : refreshed;

    return `<div class="statusbar">
      <div class="statusbar-left">
        ${UI.envelopeBadge(p.status)}
        ${UI.chip(mode)}
        ${UI.chip(market)}
      </div>
      <div class="statusbar-meta">
        기준 <span class="mono">${Fmt.dateTime(p.as_of)}</span>
        · ${fileAge}
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

  function flowAmount(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
    const delta = Fmt.delta(value);
    const sign = value > 0 ? '+' : value < 0 ? '-' : '';
    const amount = Math.abs(value / 100000000).toLocaleString('ko-KR', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    });
    return `<span class="${delta.cls} num" title="${Fmt.krw(value)}"><span aria-hidden="true">${delta.arrow}</span> ${sign}${amount}억</span>`;
  }

  function flowSection(flow = {}) {
    const sourceLabel = value => ({ KRX: 'KRX 확정', KIS: 'KIS 추정' }[value] || '—');
    const columns = [
      { key: 'name', label: '종목', render: (v, r) => `${Fmt.escHtml(v || r.symbol)}<div class="table-muted">${Fmt.escHtml(r.symbol)} · ${sourceLabel(r.source)}</div>` },
      { key: 'foreign_net_krw', label: '외국인', render: flowAmount },
      { key: 'institution_net_krw', label: '기관', render: flowAmount },
      { key: 'individual_net_krw', label: '개인', render: flowAmount },
      { key: 'foreign_net_5d_krw', label: '외인 5세션', render: flowAmount },
      { key: 'foreign_net_20d_krw', label: '외인 20세션', render: flowAmount },
    ];
    const rank = (label, rows) => `<div class="card card-tight"><h3 class="subhead">${label}</h3>${UI.table(columns, rows || [], '해당 방향의 순매수·순매도 종목 없음')}</div>`;
    const breadth = flow.breadth || {};
    const dates = flow.as_of_by_source || {};
    const violations = flow.integrity?.zero_sum_violations || 0;
    return `<section id="kr-flow" aria-labelledby="kr-flow-title">
      <h3 class="subhead" id="kr-flow-title">수급</h3>
      <div class="section-meta">기준 ${Fmt.escHtml(flow.as_of || '—')} · KRX 확정 ${Fmt.escHtml(dates.KRX || '—')} · KIS 추정 ${Fmt.escHtml(dates.KIS || '—')} · 금액: 억 원</div>
      <div class="grid grid-kpi section-spacing">${UI.stat({ label: '외국인 순매수 종목 / 수급 관측 종목', value: `${Fmt.count(breadth.foreign_buy_count ?? 0)} / ${Fmt.count(breadth.total_count ?? 0)}`, sub: '같은 종목·세션 KRX 우선, 없으면 KIS 추정' })}</div>
      ${!(flow.rows || []).length ? UI.empty('수급 데이터 없음', '누적 세션 부족은 0이 아닌 —로 표시합니다') : ''}
      ${violations ? `<div class="signal-note">무결성: KRX 합계 위반 ${Fmt.count(violations)}행 제외 (${flow.integrity.scope === 'full' ? '전체 이력' : '최근 20세션'})</div>` : ''}
      <div class="grid grid-split section-spacing">${rank('외국인 순매수 상위 10', flow.top_foreign_buy)}${rank('외국인 순매도 상위 10', flow.top_foreign_sell)}</div>
    </section>`;
  }

  function signalsSection(signals = {}) {
    const pct = (v, signed = false) => {
      if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
      if (!signed) return `${(v * 100).toFixed(1)}%`;
      const delta = Fmt.delta(v);
      return `<span class="${delta.cls}"><span aria-hidden="true">${delta.arrow}</span> ${Fmt.pct(v * 100)}</span>`;
    };
    const columns = [
      { key: 'name', label: '종목', render: (v, r) => `${Fmt.escHtml(v || r.symbol)}<div class="table-muted">${Fmt.escHtml(r.symbol)} · ${Fmt.escHtml(r.side)}</div>` },
      { key: 'confidence', label: '신뢰도', render: v => pct(v) },
      { key: 'metadata', label: '12M', render: m => pct(m?.ret_12m, true) },
      { key: 'metadata', label: '1M', render: m => pct(m?.ret_1m, true) },
      { key: 'metadata', label: '52주고가 비율', render: m => pct(m?.pct_of_52w_high) },
      { key: 'reason', label: '전략 근거', render: v => Fmt.escHtml(v || '—') },
    ];
    const conditions = Object.entries(signals.rejections_by_condition || {}).filter(([, n]) => typeof n === 'number' && Number.isFinite(n) && n >= 0);
    const maxRejected = Math.max(1, ...conditions.map(([, n]) => n));
    const bars = conditions.map(([key, n]) => `<div class="rejection-row"><span>${Fmt.escHtml(key)} · ${Fmt.count(n)}건</span><svg class="rejection-bar" viewBox="0 0 100 8" aria-hidden="true"><rect width="${100 * n / maxRejected}" height="8"></rect></svg></div>`).join('');
    return `<section id="kr-signals" aria-labelledby="kr-signals-title">
      <h3 class="subhead" id="kr-signals-title">신호(GR-01)</h3>
      <div class="signal-note"><strong>원신호 — 게이트 미적용</strong><div>진입 조건 관측이며 실제 주문 가능 여부와 다릅니다.</div></div>
      <div class="section-meta">기준 ${Fmt.escHtml(signals.as_of || '—')} · ${signals.universe_basis === 'kospi200_membership' ? 'KOSPI200 구성 종목' : signals.universe_basis === 'canonical_symbols_fallback' ? '시세 보유 종목 기준' : '유니버스 없음'}</div>
      <div class="grid grid-kpi section-spacing">
        ${UI.stat({ label: '유니버스', value: Fmt.count(signals.universe_count ?? 0) })}
        ${UI.stat({ label: '스크리닝 통과', value: Fmt.count(signals.screened_count ?? 0), sub: `스크리닝 탈락 ${Fmt.count(signals.screening_rejections ?? 0)}종목` })}
        ${UI.stat({ label: '진입 신호', value: Fmt.count(signals.signal_count ?? 0), sub: `진입 검사 탈락 ${Fmt.count(signals.entry_rejections ?? 0)}종목` })}
      </div>
      ${UI.table(columns, signals.entries || [], '오늘 진입 신호 없음')}
      ${bars ? `<div class="card card-tight section-spacing"><h3 class="subhead">공개 API 탈락 사유</h3>${bars}</div>` : ''}
    </section>`;
  }

  function render(entry) {
    const p = entry.payload;

    if (entry.error) {
      return statusbarError(entry) +
        UI.empty('데이터를 불러오지 못했습니다', entry.error);
    }

    const body = p.status === 'no_data'
      ? UI.empty(p.status_reason || '아직 수집된 데이터가 없습니다',
                 'collect 파이프라인 실행 후 표시됩니다') +
        flowSection(p.data.flow) + signalsSection(p.data.signals)
      : `${kpis(p.data)}
         ${MarketSection.render(p.data.market)}
         ${flowSection(p.data.flow)}
         ${signalsSection(p.data.signals)}
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
