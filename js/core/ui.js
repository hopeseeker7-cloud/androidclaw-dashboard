/* ============================================================
   Shared UI builders — return HTML strings, take plain data.
   Every status here carries an icon AND a label; colour is
   never the only channel.
   ============================================================ */

const UI = (() => {

  /** Envelope status -> visual treatment. */
  const ENVELOPE_STATUS = {
    ok:      { icon: '●', cls: 'badge-ok',       label: '정상' },
    stale:   { icon: '▲', cls: 'badge-warn',     label: '데이터 지연' },
    no_data: { icon: '○', cls: 'badge-idle',     label: '데이터 없음' },
    error:   { icon: '✕', cls: 'badge-critical', label: '오류' },
  };

  /** Domain-level health words (snapshot, pipeline). */
  const HEALTH_STATUS = {
    healthy:    { icon: '●', cls: 'badge-ok',       label: '정상' },
    completed:  { icon: '●', cls: 'badge-ok',       label: '완료' },
    ok:         { icon: '●', cls: 'badge-ok',       label: '정상' },
    rebuilding: { icon: '◐', cls: 'badge-warn',     label: '재생성 중' },
    degraded:   { icon: '▲', cls: 'badge-warn',     label: '주의' },
    stale:      { icon: '▲', cls: 'badge-warn',     label: '데이터 지연' },
    partial:    { icon: '▲', cls: 'badge-warn',     label: '부분 완료' },
    blocked:    { icon: '✕', cls: 'badge-critical', label: '차단' },
    failed:     { icon: '✕', cls: 'badge-critical', label: '실패' },
    error:      { icon: '✕', cls: 'badge-critical', label: '오류' },
  };

  function statusView(raw, table) {
    const key = String(raw ?? '').toLowerCase();
    return (table[key]) || { icon: '○', cls: 'badge-idle', label: raw || '알 수 없음' };
  }

  function badge(raw, table = HEALTH_STATUS) {
    const v = statusView(raw, table);
    return `<span class="badge ${v.cls}">
      <span class="badge-icon" aria-hidden="true">${v.icon}</span>${Fmt.escHtml(v.label)}
    </span>`;
  }

  function envelopeBadge(status) {
    return badge(status, ENVELOPE_STATUS);
  }

  function chip(text) {
    return `<span class="chip">${Fmt.escHtml(text)}</span>`;
  }

  /**
   * KPI tile. `delta` renders sign + arrow + colour; `plain` renders a
   * neutral number.
   */
  function stat({ label, value, sub = '', hero = false }) {
    return `<div class="stat${hero ? ' stat-hero' : ''}">
      <div class="stat-label">${Fmt.escHtml(label)}</div>
      <div class="stat-value">${value}</div>
      ${sub ? `<div class="stat-sub">${sub}</div>` : ''}
    </div>`;
  }

  function statDelta({ label, amount, sub = '', hero = false }) {
    const d = Fmt.delta(amount);
    const value = `<span class="${d.cls}">
      <span class="delta-arrow" aria-hidden="true">${d.arrow}</span> ${d.text}
    </span>`;
    return stat({ label, value, sub, hero });
  }

  function empty(message, hint = '') {
    return `<div class="empty">
      <span class="empty-icon" aria-hidden="true">▨</span>
      <div>${Fmt.escHtml(message)}</div>
      ${hint ? `<div class="empty-hint">${Fmt.escHtml(hint)}</div>` : ''}
    </div>`;
  }

  /**
   * Table. columns: [{ key, label, align, render }]
   * Rendered inside .table-wrap so wide tables scroll themselves.
   */
  function table(columns, rows, emptyMessage = '항목 없음') {
    if (!rows || !rows.length) return empty(emptyMessage);
    const head = columns
      .map(c => `<th scope="col">${Fmt.escHtml(c.label)}</th>`)
      .join('');
    const body = rows.map(row => {
      const cells = columns.map(c => {
        const raw = row[c.key];
        return `<td>${c.render ? c.render(raw, row) : Fmt.escHtml(raw)}</td>`;
      }).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    return `<div class="table-wrap">
      <table class="table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
    </div>`;
  }

  function dl(pairs) {
    const items = pairs
      .map(([k, v]) => `<dt>${Fmt.escHtml(k)}</dt><dd>${v}</dd>`)
      .join('');
    return `<dl class="dl">${items}</dl>`;
  }

  function notes(items) {
    if (!items || !items.length) return '';
    const rows = items.map(it => {
      const level = it.severity === 'critical' ? 'critical' : 'warn';
      const icon = level === 'critical' ? '✕' : '▲';
      return `<div class="note note-${level}">
        <span class="note-icon" aria-hidden="true">${icon}</span>
        <span>[${Fmt.escHtml(it.severity || 'warning')}] ${Fmt.escHtml(it.description || '')}</span>
      </div>`;
    }).join('');
    return `<div class="notes">${rows}</div>`;
  }

  return { badge, envelopeBadge, chip, stat, statDelta, empty, table, dl, notes,
           ENVELOPE_STATUS, HEALTH_STATUS };
})();
