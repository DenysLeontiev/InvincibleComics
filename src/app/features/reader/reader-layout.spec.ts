import { buildViews, layoutView, prefetchOrder, viewIndexOf } from './reader-layout';

describe('reader layout', () => {
  const portrait = (n: number) => Array.from({ length: n }, () => 0.65);

  describe('buildViews', () => {
    it('shows one page per view in single mode', () => {
      expect(buildViews(portrait(3), false)).toEqual([[1], [2], [3]]);
    });

    it('keeps the cover alone and pairs the rest in double mode', () => {
      expect(buildViews(portrait(6), true)).toEqual([[1], [2, 3], [4, 5], [6]]);
    });

    it('never pairs a page that is already a two-page spread', () => {
      const ratios = [0.65, 0.65, 1.3, 0.65, 0.65];
      expect(buildViews(ratios, true)).toEqual([[1], [2], [3], [4, 5]]);
    });

    it('covers every page exactly once', () => {
      const ratios = [0.65, 1.3, 0.65, 0.65, 0.65, 1.3, 0.65];
      expect(buildViews(ratios, true).flat()).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });
  });

  it('finds the view that contains a page', () => {
    const views = buildViews(portrait(6), true);
    expect(viewIndexOf(views, 1)).toBe(0);
    expect(viewIndexOf(views, 3)).toBe(1);
    expect(viewIndexOf(views, 99)).toBe(views.length - 1);
  });

  describe('layoutView', () => {
    it('fits a page inside the stage in contain mode', () => {
      const [box] = layoutView([1], [0.5], { width: 1000, height: 800 }, 'contain');
      expect(box).toEqual({ page: 1, width: 400, height: 800 });
    });

    it('fills the stage width in width mode', () => {
      const [box] = layoutView([1], [0.5], { width: 1000, height: 800 }, 'width');
      expect(box).toEqual({ page: 1, width: 1000, height: 2000 });
    });

    it('sizes both pages of a spread to the same height', () => {
      const boxes = layoutView([2, 3], [0.65, 0.65, 0.65], { width: 1300, height: 800 }, 'contain');
      expect(boxes.map((b) => b.height)).toEqual([800, 800]);
      expect(boxes[0].width + boxes[1].width).toBeLessThanOrEqual(1300);
    });
  });

  describe('prefetchOrder', () => {
    it('prefers the next pages, then the previous one, then the rest', () => {
      expect(prefetchOrder(3, 8)).toEqual([4, 5, 2, 6, 1, 7, 0]);
    });

    it('never includes the current view and includes every other view', () => {
      const order = prefetchOrder(0, 5);
      expect(order).not.toContain(0);
      expect([...order].sort()).toEqual([1, 2, 3, 4]);
    });
  });
});
