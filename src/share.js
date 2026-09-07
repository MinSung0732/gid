export function resultLink(base, result) {
  const url = new URL(base);
  url.search = ''; url.hash = '';
  url.searchParams.set('result', '1');
  for (const key of ['stone', 'score', 'combo', 'hits']) url.searchParams.set(key, result[key]);
  return url.href;
}

export function readResult(base) {
  const params = new URL(base).searchParams;
  if (params.get('result') !== '1') return null;
  const stone = params.get('stone');
  if (!['pink', 'green', 'volcanic'].includes(stone)) return null;
  const data = { stone };
  for (const key of ['score', 'combo', 'hits']) {
    const raw = params.get(key);
    if (!raw || !/^\d{1,15}$/.test(raw)) return null;
    data[key] = Number(raw);
    if (!Number.isSafeInteger(data[key])) return null;
  }
  if (data.combo > data.hits * 2 || data.score > data.hits * 200) return null;
  return data;
}
