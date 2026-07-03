"use client";

/* Tiny localStorage store with change events, shared across tabs/components. */

const KEYS = {
  watchlist: "ps_watchlist",
  portfolio: "ps_portfolio",
  alerts: "ps_alerts",
  prefs: "ps_prefs",
  notified: "ps_notified",
  smart: "ps_smart",
  smartLast: "ps_smart_last"
};

const DEFAULT_WATCHLIST = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "KO", "JNJ", "T"];

function read(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent("ps-store", { detail: { key } }));
  } catch {}
}

export function onStoreChange(cb) {
  const h = () => cb();
  window.addEventListener("ps-store", h);
  window.addEventListener("storage", h);
  return () => {
    window.removeEventListener("ps-store", h);
    window.removeEventListener("storage", h);
  };
}

/* ---- watchlist ---- */
export const getWatchlist = () => read(KEYS.watchlist, DEFAULT_WATCHLIST);
export function toggleWatch(sym) {
  const list = getWatchlist();
  const next = list.includes(sym) ? list.filter((s) => s !== sym) : [...list, sym];
  write(KEYS.watchlist, next);
  return next.includes(sym);
}
export const inWatchlist = (sym) => getWatchlist().includes(sym);

/* ---- portfolio: { SYM: { shares, cost } } ---- */
export const getPortfolio = () => read(KEYS.portfolio, {});
export function setHolding(sym, shares, cost) {
  const p = getPortfolio();
  if (!shares || shares <= 0) delete p[sym];
  else p[sym] = { shares: Number(shares), cost: Number(cost) || 0 };
  write(KEYS.portfolio, p);
}

/* ---- alerts: [{ id, sym, dir: "above"|"below", price }] ---- */
export const getAlerts = () => read(KEYS.alerts, []);
export function addAlert(sym, dir, price) {
  const list = getAlerts();
  list.push({ id: Date.now() + Math.random().toString(36).slice(2), sym, dir, price: Number(price) });
  write(KEYS.alerts, list);
}
export function removeAlert(id) {
  write(KEYS.alerts, getAlerts().filter((a) => a.id !== id));
}

/* ---- smart notify: symbols that get a rich update on every price change ---- */
export const getSmartNotify = () => read(KEYS.smart, []);
export function toggleSmartNotify(sym) {
  const list = getSmartNotify();
  const next = list.includes(sym) ? list.filter((s) => s !== sym) : [...list, sym];
  write(KEYS.smart, next);
  return next.includes(sym);
}
export const isSmartNotify = (sym) => getSmartNotify().includes(sym);

/* Last price we told Papa about, per symbol — so we only notify on real changes. */
export const getSmartLast = () => read(KEYS.smartLast, {});
export function setSmartLast(sym, price) {
  const m = getSmartLast();
  m[sym] = price;
  write(KEYS.smartLast, m);
}

/* ---- prefs ---- */
export const getPrefs = () =>
  read(KEYS.prefs, { theme: "manus", bigText: false, notifications: true, moveThreshold: 3 });
export function setPref(k, v) {
  const p = getPrefs();
  p[k] = v;
  write(KEYS.prefs, p);
}

/* ---- notification dedupe (one per symbol per rule per day) ---- */
export function shouldNotify(tag) {
  const today = new Date().toDateString();
  const seen = read(KEYS.notified, {});
  if (seen.day !== today) {
    write(KEYS.notified, { day: today, tags: [tag] });
    return true;
  }
  if (seen.tags.includes(tag)) return false;
  seen.tags.push(tag);
  write(KEYS.notified, seen);
  return true;
}

export function applyPrefsToDocument() {
  const p = getPrefs();
  document.documentElement.dataset.theme = p.theme || "manus";
  document.documentElement.dataset.bigtext = p.bigText ? "1" : "0";
}
