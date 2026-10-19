import { points } from './game';
import type { Copy } from './types';

export function collectionStats(copies: Copy[], catalogSize: number) {
  const albums = new Set(copies.map(c => c.master_id)).size;
  const byTier = [0, 0, 0, 0, 0, 0];
  copies.forEach(c => byTier[c.tier]++);
  return {
    n: copies.length,
    albums,
    value: copies.reduce((s, c) => s + points(c), 0),
    pct: catalogSize ? albums / catalogSize : 0,
    phantoms: copies.filter(c => c.phantom).length,
    byTier,
  };
}
