import { DestroyRef, ElementRef, inject, Signal, signal } from '@angular/core';

export interface Size {
  readonly width: number;
  readonly height: number;
}

export function elementSize(element: HTMLElement = inject(ElementRef).nativeElement): Signal<Size> {
  const size = signal<Size>({ width: element.clientWidth, height: element.clientHeight });

  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(([entry]) => {
      const box = entry.contentBoxSize?.[0];
      const width = Math.round(box ? box.inlineSize : entry.contentRect.width);
      const height = Math.round(box ? box.blockSize : entry.contentRect.height);
      const prev = size();
      if (prev.width !== width || prev.height !== height) size.set({ width, height });
    });
    observer.observe(element);
    inject(DestroyRef).onDestroy(() => observer.disconnect());
  }

  return size.asReadonly();
}
