// Calcul des paliers de rareté (1 « Bac à 1 € » … 5 « Graal ») pour chaque album × format.
// Entrée : lignes `releases` (have, want, lowest_price, fmt_counts). Sortie : { [master_id]: {v,c,k,e} }.

export const FORMATS = ['v', 'c', 'k', 'e'];
const FMT_BONUS = { v: 0.0, c: -0.10, k: 0.06, e: 0.18 }; // 8-track plus rare, CD plus courant
const PHANTOM_BONUS = 0.22;                              // format jamais sorti pour cet album
const CUTS = [[0.42, 1], [0.70, 2], [0.87, 3], [0.96, 4], [1.01, 5]];

function pctRank(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  return (x) => {
    let lo = 0, hi = n; // nombre de valeurs strictement inférieures
    while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] < x) lo = mid + 1; else hi = mid; }
    return lo / Math.max(1, n - 1);
  };
}

export function computeTiers(rows) {
  if (!rows.length) return {};
  const demand = rows.map(r => (r.want || 0) / Math.max(1, r.have || 0));
  const prices = rows.map(r => r.lowest_price).filter(p => p != null).sort((a, b) => a - b);
  const median = prices.length ? prices[Math.floor(prices.length / 2)] : 1;
  const priceOf = r => (r.lowest_price != null ? Number(r.lowest_price) : median);
  const rd = pctRank(demand), rp = pctRank(rows.map(priceOf));

  const combos = [];
  rows.forEach((r, i) => {
    const base = 0.6 * rd(demand[i]) + 0.4 * rp(priceOf(r));
    const counts = r.fmt_counts || {};
    const total = FORMATS.reduce((s, f) => s + (counts[f] || 0), 0) || 1;
    for (const f of FORMATS) {
      const cnt = counts[f] || 0;
      const bonus = cnt === 0
        ? PHANTOM_BONUS + FMT_BONUS[f] * 0.5
        : FMT_BONUS[f] + (cnt <= 2 ? 0.12 : cnt <= 6 ? 0.05 : 0) - 0.05 * (cnt / total);
      combos.push({ id: r.master_id, f, s: base + bonus });
    }
  });
  const rs = pctRank(combos.map(c => c.s));
  const out = {};
  for (const c of combos) {
    const q = rs(c.s);
    (out[c.id] ||= {})[c.f] = CUTS.find(([cut]) => q < cut)[1];
  }
  return out;
}
