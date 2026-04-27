const hits = new Map<string, number[]>();

export function isRateLimited(id: string) {
  const now = Date.now();

  if (!hits.has(id)) {
    hits.set(id, []);
  }

  const arr = (hits.get(id) || []).filter((t) => now - t < 60000);

  arr.push(now);
  hits.set(id, arr);

  return arr.length > 10;
}
