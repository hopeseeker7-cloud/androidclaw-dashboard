/* ============================================================
   Data loading — manifest first, then only the domains it lists.
   v1 hard-coded nine files and kept 404-ing on producers that had
   been dead since April; the manifest makes that impossible.
   ============================================================ */

const DataLoader = (() => {

  const MANIFEST_URL = 'data/index.json';

  function bust(url) {
    return url + (url.includes('?') ? '&' : '?') + '_=' + Date.now();
  }

  async function getJSON(url) {
    const resp = await fetch(bust(url), { cache: 'no-store' });
    if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText} — ${url}`);
    return resp.json();
  }

  /** Envelope guard: a payload we cannot trust is reported, not rendered. */
  function validate(payload, expectedDomain) {
    if (!payload || typeof payload !== 'object') {
      return { ok: false, reason: '응답이 객체가 아님' };
    }
    if (payload.domain !== expectedDomain) {
      return { ok: false, reason: `도메인 불일치 (${payload.domain ?? '없음'})` };
    }
    if (!payload.data || typeof payload.data !== 'object') {
      return { ok: false, reason: 'data 필드 없음' };
    }
    return { ok: true };
  }

  /**
   * Returns { manifest, domains: [{ key, label, payload, error }] }.
   * A single broken domain never takes the page down.
   */
  async function loadAll() {
    const manifest = await getJSON(MANIFEST_URL);
    const entries = Array.isArray(manifest.domains) ? manifest.domains : [];

    const domains = await Promise.all(entries.map(async entry => {
      try {
        const payload = await getJSON('data/' + entry.file);
        const check = validate(payload, entry.key);
        if (!check.ok) {
          return { ...entry, payload: null, error: check.reason };
        }
        return { ...entry, payload, error: null };
      } catch (err) {
        return { ...entry, payload: null, error: err.message };
      }
    }));

    return { manifest, domains };
  }

  return { loadAll, getJSON };
})();
