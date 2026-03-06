/* ─────────────────────────────────────────────
   utils.js — 공통 유틸리티
───────────────────────────────────────────── */

function relativeTime(isoString) {
  if (!isoString) return '—';
  const diff = Date.now() - new Date(isoString).getTime();
  if (isNaN(diff)) return '—';
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60)  return seconds + '초 전';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60)  return minutes + '분 전';
  const hours = Math.floor(minutes / 60);
  if (hours < 24)    return hours + '시간 전';
  const days = Math.floor(hours / 24);
  return days + '일 전';
}

function formatTimestamp(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('ko-KR', {
    month:  '2-digit',
    day:    '2-digit',
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

function fmtKRW(n) {
  if (n == null || isNaN(n)) return '₩0';
  const abs  = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1000000) return sign + '₩' + (abs / 1000000).toFixed(1) + 'M';
  if (abs >= 1000)    return sign + '₩' + Math.round(abs / 1000).toLocaleString() + 'K';
  return sign + '₩' + Math.round(abs).toLocaleString();
}

function fmtTokens(n) {
  if (n == null || isNaN(n)) return '—';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000)    return Math.round(n / 1000) + 'K';
  return String(n);
}

function fmtResetTime(epochMs) {
  if (!epochMs) return '';
  const diff = epochMs - Date.now();
  if (diff <= 0) return '리셋됨';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}분 후`;
  const hrs   = Math.floor(mins / 60);
  const remMin = mins % 60;
  if (hrs < 24) return remMin > 0 ? `${hrs}h ${remMin}m` : `${hrs}h`;
  const days  = Math.floor(hrs / 24);
  const remHr  = hrs % 24;
  return `${days}d ${remHr}h`;
}

function confidenceBadge(c) {
  if (c == null) return '';
  const pct = Math.round(c * 100);
  const cls = pct >= CONFIG.CONF_HIGH ? 'high' : pct >= CONFIG.CONF_MID ? 'mid' : 'low';
  return `<span class="conf-badge conf-${cls}">${pct}%</span>`;
}
