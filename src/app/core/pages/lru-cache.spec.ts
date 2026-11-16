import { LruCache } from './lru-cache';

describe('LruCache', () => {
  it('evicts the least recently used entry', () => {
    const evicted: string[] = [];
    const cache = new LruCache<string, number>(2, (_, key) => evicted.push(key));
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a');
    cache.set('c', 3);
    expect(evicted).toEqual(['b']);
    expect(cache.peek('a')).toBe(1);
    expect(cache.peek('c')).toBe(3);
  });

  it('notifies when a value is replaced', () => {
    const evicted: number[] = [];
    const cache = new LruCache<string, number>(2, (value) => evicted.push(value));
    cache.set('a', 1);
    cache.set('a', 2);
    expect(evicted).toEqual([1]);
    expect(cache.size).toBe(1);
  });
});
