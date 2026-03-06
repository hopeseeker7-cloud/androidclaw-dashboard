/* ─────────────────────────────────────────────
   state.js — 상태 + 데이터 로딩
───────────────────────────────────────────── */

let state = {
  agents:   [],
  system:   null,
  runs:     [],
  costs:    null,
  health:   null,
  tradebot: null,
  lastSync: null,
  loading:  false,
  errors:   [],
};

let activeTab     = 'home';
let refreshTimer  = null;

async function fetchJSON(url) {
  const resp = await fetch(url + '?_=' + Date.now());
  if (!resp.ok) throw new Error(`HTTP ${resp.status} — ${url}`);
  return resp.json();
}

async function fetchJSONL(url) {
  const resp = await fetch(url + '?_=' + Date.now());
  if (!resp.ok) throw new Error(`HTTP ${resp.status} — ${url}`);
  const text = await resp.text();
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      try { return JSON.parse(line); }
      catch { return null; }
    })
    .filter(Boolean);
}

async function loadData() {
  if (state.loading) return;
  state.loading = true;
  state.errors  = [];

  setRefreshButtonLoading(true);

  const results = await Promise.allSettled([
    fetchJSON(CONFIG.DATA.agents),
    fetchJSON(CONFIG.DATA.system),
    fetchJSONL(CONFIG.DATA.runs),
    fetchJSON(CONFIG.DATA.costs),
    fetchJSON(CONFIG.DATA.health),
    fetchJSON(CONFIG.DATA.tradebot),
  ]);

  if (results[0].status === 'fulfilled') {
    state.agents = results[0].value;
  } else {
    state.errors.push('에이전트 데이터 로딩 실패: ' + results[0].reason.message);
  }

  if (results[1].status === 'fulfilled') {
    state.system = results[1].value;
  } else {
    state.errors.push('시스템 데이터 로딩 실패: ' + results[1].reason.message);
  }

  if (results[2].status === 'fulfilled') {
    state.runs = results[2].value;
    state.runs.sort((a, b) => new Date(b.startedAt || 0) - new Date(a.startedAt || 0));
  } else {
    state.errors.push('실행 기록 로딩 실패: ' + results[2].reason.message);
  }

  if (results[3].status === 'fulfilled') state.costs    = results[3].value;
  else                                    state.costs    = null;

  if (results[4].status === 'fulfilled') state.health   = results[4].value;
  else                                    state.health   = null;

  if (results[5].status === 'fulfilled') state.tradebot = results[5].value;
  else                                    state.tradebot = null;

  state.lastSync = new Date();
  state.loading  = false;

  render();
  setRefreshButtonLoading(false);
}
