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

let activeTab = 'home';
let refreshTimer = null;

function withCacheBust(url) {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}_=${Date.now()}`;
}

async function fetchJSON(url) {
  const resp = await fetch(withCacheBust(url));
  if (!resp.ok) throw new Error(`HTTP ${resp.status} @ ${url}`);
  return resp.json();
}

async function fetchJSONL(url) {
  const resp = await fetch(withCacheBust(url));
  if (!resp.ok) throw new Error(`HTTP ${resp.status} @ ${url}`);
  const text = await resp.text();
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function normalizeTradebotHistory(rawHistory) {
  const history = Array.isArray(rawHistory) ? rawHistory.filter(item => item && typeof item === 'object') : [];
  history.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  return history;
}

function buildAllocationFromPositions(positions) {
  if (!Array.isArray(positions) || positions.length === 0) return [];

  const totals = new Map();

  positions.forEach(position => {
    const key = position.symbol || 'UNKNOWN';
    const value = Number(position.notional_usdt ?? position.margin_usdt ?? 0);
    totals.set(key, (totals.get(key) || 0) + (Number.isFinite(value) ? value : 0));
  });

  const totalValue = Array.from(totals.values()).reduce((sum, value) => sum + value, 0);
  if (totalValue <= 0) return [];

  return Array.from(totals.entries())
    .map(([name, value]) => ({
      name,
      pct: Number(((value / totalValue) * 100).toFixed(1)),
    }))
    .filter(item => item.pct > 0);
}

function normalizeTradebotExchange(rawExchange, exchangeHistory) {
  const exchange = rawExchange && typeof rawExchange === 'object' ? { ...rawExchange } : {};
  const positions = Array.isArray(exchange.positions) ? exchange.positions : [];
  const strategies = Array.isArray(exchange.strategies_flat) ? exchange.strategies_flat : [];
  const latestHistory = exchangeHistory.length ? exchangeHistory[exchangeHistory.length - 1] : null;
  const existingPortfolio = exchange.portfolio && typeof exchange.portfolio === 'object' ? exchange.portfolio : {};

  const capital = existingPortfolio.capital_krw ?? exchange.config?.capital_krw ?? latestHistory?.capital_krw ?? 0;
  const totalPnlKrw = existingPortfolio.total_pnl_krw
    ?? latestHistory?.pnl_krw
    ?? exchange.strategy_registry?.total_pnl_krw
    ?? 0;

  exchange.positions = positions;
  exchange.strategies_flat = strategies;
  exchange.history = exchangeHistory;
  exchange.portfolio = {
    ...existingPortfolio,
    capital_krw: existingPortfolio.capital_krw ?? capital,
    portfolio_value: existingPortfolio.portfolio_value ?? latestHistory?.portfolio_value ?? capital,
    cash_krw: existingPortfolio.cash_krw ?? latestHistory?.cash_krw ?? capital,
    total_pnl_krw: totalPnlKrw,
    total_pnl_pct: existingPortfolio.total_pnl_pct
      ?? latestHistory?.pnl_pct
      ?? (capital > 0 ? (totalPnlKrw / capital) * 100 : 0),
    holdings: Array.isArray(existingPortfolio.holdings) ? existingPortfolio.holdings : [],
    allocation: Array.isArray(existingPortfolio.allocation) && existingPortfolio.allocation.length
      ? existingPortfolio.allocation
      : buildAllocationFromPositions(positions),
  };

  return exchange;
}

function buildTradebotSummary(rawTradebot) {
  const exchanges = Array.isArray(rawTradebot.exchanges) ? rawTradebot.exchanges : [];
  const existingSummary = rawTradebot.summary && typeof rawTradebot.summary === 'object' ? rawTradebot.summary : {};

  return {
    ...existingSummary,
    total_exchanges: existingSummary.total_exchanges ?? exchanges.length,
    total_positions: existingSummary.total_positions ?? exchanges.reduce(
      (sum, exchange) => sum + (Array.isArray(exchange.positions) ? exchange.positions.length : 0),
      0,
    ),
    total_signals: existingSummary.total_signals ?? exchanges.reduce((sum, exchange) => {
      const signals = exchange.signals || {};
      return sum + Number(signals.live_count || 0) + Number(signals.paper_count || 0);
    }, 0),
    total_strategies: existingSummary.total_strategies ?? exchanges.reduce((sum, exchange) => {
      if (exchange.strategy_registry?.total != null) return sum + Number(exchange.strategy_registry.total || 0);
      return sum + (Array.isArray(exchange.strategies_flat) ? exchange.strategies_flat.length : 0);
    }, 0),
  };
}

function normalizeTradebot(rawTradebot, rawHistory) {
  if (!rawTradebot || typeof rawTradebot !== 'object') return null;

  const history = normalizeTradebotHistory(rawHistory);
  const exchanges = Array.isArray(rawTradebot.exchanges) ? rawTradebot.exchanges : [];

  const normalized = {
    ...rawTradebot,
    history,
    exchanges: exchanges.map(exchange => {
      const exchangeHistory = history.filter(item => item.exchange === exchange.exchange);
      return normalizeTradebotExchange(exchange, exchangeHistory);
    }),
  };

  normalized.summary = buildTradebotSummary(normalized);
  return normalized;
}

async function loadData() {
  if (state.loading) return;
  state.loading = true;
  state.errors = [];

  setRefreshButtonLoading(true);

  try {
    const results = await Promise.allSettled([
      fetchJSON(CONFIG.DATA.agents),
      fetchJSON(CONFIG.DATA.system),
      fetchJSONL(CONFIG.DATA.runs),
      fetchJSON(CONFIG.DATA.costs),
      fetchJSON(CONFIG.DATA.health),
      fetchJSON(CONFIG.DATA.tradebot),
      fetchJSONL(CONFIG.DATA.tradebotHistory),
    ]);

    if (results[0].status === 'fulfilled') {
      const raw = results[0].value;
      state.agents = Array.isArray(raw) ? raw : [];
    } else {
      state.agents = [];
      state.errors.push('에이전트 데이터 로딩 실패: ' + results[0].reason.message);
    }

    if (results[1].status === 'fulfilled') {
      state.system = results[1].value;
    } else {
      state.system = null;
      state.errors.push('시스템 데이터 로딩 실패: ' + results[1].reason.message);
    }

    if (results[2].status === 'fulfilled') {
      const raw = results[2].value;
      state.runs = Array.isArray(raw) ? raw : [];
      state.runs.sort((a, b) => new Date(b.startedAt || 0) - new Date(a.startedAt || 0));
    } else {
      state.runs = [];
      state.errors.push('실행 기록 로딩 실패: ' + results[2].reason.message);
    }

    if (results[3].status === 'fulfilled') state.costs = results[3].value;
    else state.costs = null;

    if (results[4].status === 'fulfilled') state.health = results[4].value;
    else state.health = null;

    const tradebotRaw = results[5].status === 'fulfilled' ? results[5].value : null;
    const tradebotHistory = results[6].status === 'fulfilled' ? results[6].value : [];

    if (results[5].status === 'rejected') {
      state.errors.push('트레이딩 데이터 로딩 실패: ' + results[5].reason.message);
    }
    if (results[6].status === 'rejected') {
      state.errors.push('트레이딩 히스토리 로딩 실패: ' + results[6].reason.message);
    }

    state.tradebot = normalizeTradebot(tradebotRaw, tradebotHistory);
    state.lastSync = new Date();
  } finally {
    state.loading = false;
    render();
    setRefreshButtonLoading(false);
  }
}
