import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  output,
} from '@angular/core';

import { elementSize } from '../../../core/layout/element-size';
import { Issue } from '../../../core/library/library.models';
import { PageImagesService } from '../../../core/pages/page-images.service';
import { ReaderFit } from '../../../core/preferences/preferences.service';
import { ComicPageComponent } from '../comic-page/comic-page.component';
import { layoutView, PageView, prefetchOrder } from '../reader-layout';

const SWIPE_DISTANCE = 50;
const TAP_SLOP = 10;
const EDGE_ZONE = 0.3;
const PREFETCH_VIEWS = 6;

@Component({
  selector: 'app-paged-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ComicPageComponent],
  host: {
    '[class.fit-width]': "fit() === 'width'",
    '(pointerdown)': 'onPointerDown($event)',
    '(pointerup)': 'onPointerUp($event)',
    '(pointercancel)': 'pointer = null',
  },
  template: `
    @for (slide of slides(); track slide.key) {
      <div class="spread" [class.from-left]="direction() < 0" [class.from-right]="direction() > 0">
        @for (box of boxes(); track box.page) {
          <app-comic-page
            [issue]="issue()"
            [page]="box.page"
            [width]="box.width"
            [height]="box.height"
          />
        }
      </div>
    }
  `,
  styleUrl: './paged-view.component.scss',
})
export class PagedViewComponent {
  private readonly images = inject(PageImagesService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly size = elementSize(this.host);

  readonly issue = input.required<Issue>();
  readonly views = input.required<readonly PageView[]>();
  readonly viewIndex = input.required<number>();
  readonly fit = input.required<ReaderFit>();
  readonly direction = input(0);

  readonly next = output<void>();
  readonly previous = output<void>();
  readonly toggleChrome = output<void>();

  private readonly stage = this.size;

  protected readonly slides = computed(() => [{ key: this.viewIndex() }]);

  protected readonly boxes = computed(() => {
    const view = this.views()[this.viewIndex()] ?? [];
    return layoutView(view, this.issue().ratios, this.stage(), this.fit());
  });

  protected pointer: { x: number; y: number; t: number; id: number } | null = null;

  constructor() {
    effect(() => {
      this.viewIndex();
      this.host.scrollTop = 0;
    });

    effect((onCleanup) => {
      const issue = this.issue();
      const views = this.views();
      const abort = new AbortController();
      onCleanup(() => abort.abort());
      const pages = prefetchOrder(this.viewIndex(), views.length)
        .slice(0, PREFETCH_VIEWS)
        .flatMap((index) => views[index]);
      this.images.prefetch(issue, pages, abort.signal);
    });
  }

  advance(): void {
    const el = this.host;
    if (el.scrollHeight - el.clientHeight - el.scrollTop > 4) {
      el.scrollBy({ top: el.clientHeight * 0.85, behavior: 'smooth' });
    } else {
      this.next.emit();
    }
  }

  retreat(): void {
    const el = this.host;
    if (el.scrollTop > 4) {
      el.scrollBy({ top: -el.clientHeight * 0.85, behavior: 'smooth' });
    } else {
      this.previous.emit();
    }
  }

  protected onPointerDown(event: PointerEvent): void {
    if (!event.isPrimary || event.button > 0) return;
    this.pointer = { x: event.clientX, y: event.clientY, t: event.timeStamp, id: event.pointerId };
  }

  protected onPointerUp(event: PointerEvent): void {
    const start = this.pointer;
    this.pointer = null;
    if (!start || start.id !== event.pointerId) return;
    if ((event.target as Element | null)?.closest('button')) return;

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const zoomed = (globalThis.visualViewport?.scale ?? 1) > 1.01;

    if (event.pointerType !== 'mouse' && !zoomed) {
      if (Math.abs(dx) > SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy) * 1.5 && event.timeStamp - start.t < 800) {
        if (dx < 0) this.next.emit();
        else this.previous.emit();
        return;
      }
    }

    if (Math.abs(dx) > TAP_SLOP || Math.abs(dy) > TAP_SLOP) return;
    if (window.getSelection()?.toString()) return;
    const rect = this.host.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    if (x < EDGE_ZONE && !zoomed) this.previous.emit();
    else if (x > 1 - EDGE_ZONE && !zoomed) this.next.emit();
    else this.toggleChrome.emit();
  }
}
