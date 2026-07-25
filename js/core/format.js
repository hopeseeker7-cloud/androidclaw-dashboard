/* ============================================================
   Formatting helpers — pure, no DOM.
   ============================================================ */

const Fmt = (() => {

  function escHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * ₩1,234,567 — integer KRW. Non-numeric renders as an em dash, never 0.
   * The sign leads the symbol (-₩38,000), which is how it reads in Korean;
   * '₩-38,000' puts the minus where it scans as part of the amount.
   */
  function krw(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    const rounded = Math.round(n);
    const sign = rounded < 0 ? '-' : '';
    return sign + '₩' + Math.abs(rounded).toLocaleString('ko-KR');
  }

  /**
   * Signed money with a direction arrow.
   * The arrow is the non-chromatic carrier so the sign survives
   * colour-blindness, greyscale print and forced-colors mode.
   */
  function delta(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return { text: '—', arrow: '', cls: 'flat' };
    if (n > 0) return { text: '+' + krw(n), arrow: '▲', cls: 'up' };
    if (n < 0) return { text: krw(n),       arrow: '▼', cls: 'down' };
    return { text: krw(0), arrow: '·', cls: 'flat' };
  }

  function pct(value, digits = 2) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return (n > 0 ? '+' : '') + n.toFixed(digits) + '%';
  }

  function count(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString('ko-KR') : '—';
  }

  /** "2026. 7. 24. 15:30" in KST — absolute, for data cutoffs. */
  function dateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  }

  /** "3분 전" — relative, for freshness. */
  function relative(iso) {
    if (!iso) return '—';
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '—';
    const sec = Math.floor((Date.now() - then) / 1000);
    if (sec < 0) return '방금';
    if (sec < 60) return `${sec}초 전`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}분 전`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}시간 전`;
    const day = Math.floor(hr / 24);
    return `${day}일 전`;
  }

  return { escHtml, krw, delta, pct, count, dateTime, relative };
})();
