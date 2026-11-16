export type PageView = readonly number[];

const isWide = (ratio: number | undefined) => (ratio ?? 0) > 1;

export function buildViews(ratios: readonly number[], double: boolean): PageView[] {
  const count = ratios.length;
  if (!double) return Array.from({ length: count }, (_, i) => [i + 1]);

  const views: PageView[] = [];
  let page = 1;
  if (count > 0) views.push([page++]);
  while (page <= count) {
    const here = ratios[page - 1];
    const next = ratios[page];
    if (page === count || isWide(here) || isWide(next)) {
      views.push([page]);
      page += 1;
    } else {
      views.push([page, page + 1]);
      page += 2;
    }
  }
  return views;
}

export function viewIndexOf(views: readonly PageView[], page: number): number {
  const index = views.findIndex((v) => v.includes(page));
  if (index >= 0) return index;
  return page < 1 ? 0 : Math.max(0, views.length - 1);
}

export interface PageBox {
  readonly page: number;
  readonly width: number;
  readonly height: number;
}

export function layoutView(
  view: PageView,
  ratios: readonly number[],
  stage: { width: number; height: number },
  fit: 'contain' | 'width',
): PageBox[] {
  const rs = view.map((p) => ratios[p - 1] ?? 0.65);
  const total = rs.reduce((a, b) => a + b, 0) || 1;
  const byWidth = stage.width / total;
  const height = Math.max(1, Math.floor(fit === 'width' ? byWidth : Math.min(stage.height, byWidth)));
  return view.map((page, i) => ({ page, width: Math.floor(height * rs[i]), height }));
}

export function prefetchOrder(current: number, count: number): number[] {
  const order: number[] = [];
  const add = (i: number) => {
    if (i >= 0 && i < count && i !== current && !order.includes(i)) order.push(i);
  };
  add(current + 1);
  add(current + 2);
  add(current - 1);
  for (let d = 3; d < count; d++) {
    add(current + d);
    add(current - d + 1);
  }
  for (let i = 0; i < count; i++) add(i);
  return order;
}
