/* ============================================================
   Bootstrap — theme, load, render, refresh.
   ============================================================ */

(() => {
  const REFRESH_MS = 5 * 60 * 1000;
  const TICK_MS = 30 * 1000;
  const THEME_KEY = 'androidclaw.theme';

  const REGISTRY = { kr_stock: KrStockDomain };

  const el = {
    root: document.getElementById('domains'),
    banner: document.getElementById('banner'),
    sync: document.getElementById('syncTime'),
    refresh: document.getElementById('refreshBtn'),
    theme: document.getElementById('themeBtn'),
  };

  let lastSync = null;

  /* ── Theme ── */
  function applyTheme(theme) {
    if (theme === 'light' || theme === 'dark') {
      document.documentElement.setAttribute('data-theme', theme);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    if (el.theme) {
      const label = theme === 'dark' ? '다크' : theme === 'light' ? '라이트' : '시스템';
      el.theme.textContent = `테마: ${label}`;
    }
  }

  function initTheme() {
    applyTheme(localStorage.getItem(THEME_KEY) || 'system');
    el.theme?.addEventListener('click', () => {
      const order = ['system', 'light', 'dark'];
      const current = localStorage.getItem(THEME_KEY) || 'system';
      const next = order[(order.indexOf(current) + 1) % order.length];
      localStorage.setItem(THEME_KEY, next);
      applyTheme(next);
    });
  }

  /* ── Banner ── */
  function showBanner(message) {
    if (!el.banner) return;
    el.banner.textContent = message;
    el.banner.dataset.visible = 'true';
  }
  function clearBanner() {
    if (el.banner) el.banner.dataset.visible = 'false';
  }

  /* ── Render ── */
  function renderDomains(domains) {
    if (!domains.length) {
      el.root.innerHTML = UI.empty(
        '표시할 도메인이 없습니다',
        'data/index.json 매니페스트가 비어 있습니다',
      );
      return;
    }

    el.root.innerHTML = domains.map(entry => {
      const domain = REGISTRY[entry.key];
      const heading = entry.label || domain?.label?.() || entry.key;
      const body = domain
        ? domain.render(entry)
        : UI.empty(`렌더러 없음: ${entry.key}`, '이 도메인은 아직 지원되지 않습니다');
      return `<section class="section" aria-labelledby="sec-${Fmt.escHtml(entry.key)}">
        <div class="section-head">
          <h2 class="section-title" id="sec-${Fmt.escHtml(entry.key)}">${Fmt.escHtml(heading)}</h2>
        </div>
        ${body}
      </section>`;
    }).join('');
  }

  function tickSync() {
    if (el.sync) el.sync.textContent = lastSync ? Fmt.relative(lastSync) : '—';
  }

  /* ── Load ── */
  async function load() {
    el.refresh?.setAttribute('disabled', 'true');
    try {
      const { domains } = await DataLoader.loadAll();
      renderDomains(domains);

      const broken = domains.filter(d => d.error);
      if (broken.length) {
        showBanner(`${broken.length}개 도메인을 불러오지 못했습니다: ` +
                   broken.map(d => d.key).join(', '));
      } else {
        clearBanner();
      }

      lastSync = new Date().toISOString();
      tickSync();
    } catch (err) {
      showBanner(`데이터 로딩 실패 — ${err.message}`);
      el.root.innerHTML = UI.empty(
        '매니페스트를 불러오지 못했습니다',
        'data/index.json 이 존재하는지 확인하세요',
      );
    } finally {
      el.refresh?.removeAttribute('disabled');
    }
  }

  /* ── Start ── */
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    el.refresh?.addEventListener('click', load);
    load();
    setInterval(load, REFRESH_MS);
    setInterval(tickSync, TICK_MS);
  });
})();
