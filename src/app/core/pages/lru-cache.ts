export class LruCache<K, V> {
  private readonly map = new Map<K, V>();

  constructor(
    private readonly capacity: number,
    private readonly onEvict: (value: V, key: K) => void = () => {},
  ) {}

  get size(): number {
    return this.map.size;
  }

  get(key: K): V | undefined {
    const value = this.map.get(key);
    if (value !== undefined) {
      this.map.delete(key);
      this.map.set(key, value);
    }
    return value;
  }

  peek(key: K): V | undefined {
    return this.map.get(key);
  }

  set(key: K, value: V): void {
    const existing = this.map.get(key);
    if (existing !== undefined) {
      this.map.delete(key);
      if (existing !== value) this.onEvict(existing, key);
    }
    this.map.set(key, value);
    while (this.map.size > this.capacity) {
      const [oldestKey, oldest] = this.map.entries().next().value as [K, V];
      this.map.delete(oldestKey);
      this.onEvict(oldest, oldestKey);
    }
  }

  delete(key: K): void {
    const value = this.map.get(key);
    if (value !== undefined) {
      this.map.delete(key);
      this.onEvict(value, key);
    }
  }

  clear(): void {
    for (const [key, value] of this.map) this.onEvict(value, key);
    this.map.clear();
  }
}
