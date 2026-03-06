/* ─────────────────────────────────────────────
   config.js — 상수 및 설정
───────────────────────────────────────────── */
'use strict';

const CONFIG = {
  REFRESH_MS:          5 * 60 * 1000,
  TICKER_MS:           30 * 1000,
  MAX_RUNS:            20,
  BATTERY_GOOD:        50,
  BATTERY_WARN:        20,
  BATTERY_EMOJI_FULL:  80,
  BATTERY_EMOJI_LOW:   40,
  RES_WARN_PCT:        60,
  RES_ALERT_PCT:       80,
  CLAUDE_DAILY_LIMIT:  1_800_000,
  GPT_CONTEXT_DEFAULT: 272_000,
  CONF_HIGH:           60,
  CONF_MID:            40,
  DATA: {
    agents:   'data/agents.json',
    system:   'data/system.json',
    runs:     'data/runs.jsonl',
    costs:    'data/costs.json',
    health:   'data/health.json',
    tradebot: 'data/tradebot.json',
  },
};

const AGENT_EMOJI_MAP = {
  'jjanga-note20':  '🐱',
  'health-watcher': '🛡️',
  'web-crawler':    '🦅',
  'vibe-coder':     '🦉',
  'virtuals-agent': '🤖',
};

const DONUT_COLORS = [
  '#F59E0B','#60A5FA','#34D399','#F472B6','#A78BFA',
  '#FB923C','#2DD4BF','#E879F9','#FCD34D','#6EE7B7',
];
