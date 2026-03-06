/* ─────────────────────────────────────────────
   app.js — 오케스트레이터 (진입점)
   의존성 순서:
     config.js → utils.js → state.js →
     charts.js → render-home.js → render-runs.js →
     render-costs.js → render-trading.js → app.js
───────────────────────────────────────────── */

/* ── Master Render ── */
function render() {
  renderErrors();
  renderSyncTime();
  renderSystemBar();

  switch (activeTab) {
    case 'home':
      renderServerGrid();
      renderAgentGrid();
      renderTimeline();
      break;
    case 'runs':
      renderRunsTable();
      break;
    case 'costs':
      renderCosts();
      break;
    case 'trading':
      renderTrading();
      break;
  }
}

/* ── Tab Switching ── */
function initTabs() {
  const buttons = document.querySelectorAll('.tab-btn');
  const panels  = document.querySelectorAll('.tab-panel');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;

      buttons.forEach(b => b.classList.remove('active'));
      panels.forEach(p  => p.classList.remove('active'));

      btn.classList.add('active');
      const panel = document.getElementById('tab-' + target);
      if (panel) panel.classList.add('active');

      activeTab = target;
      render();
    });
  });
}

/* ── Refresh Button ── */
function setRefreshButtonLoading(loading) {
  const btn  = document.getElementById('refreshBtn');
  const icon = document.getElementById('refreshIcon');
  if (!btn) return;

  if (loading) {
    btn.classList.add('loading');
    btn.disabled = true;
    if (icon) icon.style.display = 'inline-block';
  } else {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

function initRefreshButton() {
  const btn = document.getElementById('refreshBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    clearInterval(refreshTimer);
    loadData();
    refreshTimer = setInterval(loadData, CONFIG.REFRESH_MS);
  });
}

/* ── Relative Time Ticker (30s) ── */
function tickRelativeTimes() {
  renderSyncTime();
  if (activeTab === 'home' && state.agents.length) renderAgentGrid();
  if (activeTab === 'home' && state.runs.length)   renderTimeline();
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initRefreshButton();

  loadData();

  refreshTimer = setInterval(loadData, CONFIG.REFRESH_MS);
  setInterval(tickRelativeTimes, CONFIG.TICKER_MS);
});
