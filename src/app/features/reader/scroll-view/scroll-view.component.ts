import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';

import { elementSize } from '../../../core/layout/element-size';
import { Issue } from '../../../core/library/library.models';
import { PdfService } from '../../../core/pdf/pdf.service';
import { ReaderFit } from '../../../core/preferences/preferences.service';
import { ComicPageComponent } from '../comic-page/comic-page.component';
import { prefetchOrder } from '../reader-layout';

const RENDER_AHEAD = 1.5;
const PAGE_GAP = 8;

@Component({
  selector: 'app-scroll-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ComicPageComponent],
  host: {
    '(scroll)': 'onScroll()',
    '(click)': 'onClick($event)',
  },
  template: `
    <div class="strip" [style.gap.px]="gap">
      @for (box of boxes(); track box.page) {
        <div class="slot" [attr.data-page]="box.page" [style.height.px]="box.height" [style.width.px]="box.width">
          @if (box.page >= windowStart() && box.page <= windowEnd()) {
            <app-comic-page
              [issue]="issue()"
              [page]="box.page"
              [width]="box.width"
              [height]="box.height"
              [priority]="box.page === current() ? 'high' : 'low'"
            />
          }
        </div>
      }
    </div>
    <ng-content />
  `,
  styleUrl: './scroll-view.component.scss',
})
export class ScrollViewComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly pdf = inject(PdfService);
  private readonly size = elementSize(this.host);

  readonly issue = input.required<Issue>();
  readonly fit = input.required<ReaderFit>();
  readonly initialPage = input(1);

  readonly pageChange = output<number>();
  readonly scrolled = output<number>();
  readonly toggleChrome = output<void>();

  protected readonly gap = PAGE_GAP;
  protected readonly current = signal(1);
  private readonly scrollTop = signal(0);
  private lastScrollTop = 0;
  private frame = 0;

  protected readonly boxes = computed(() => {
    const { width, height } = this.size();
    const fit = this.fit();
    return this.issue().ratios.map((ratio, i) => {
      const w = Math.floor(fit === 'width' ? width : Math.min(width, height * ratio, 1100));
      return { page: i + 1, width: w, height: Math.floor(w / ratio) };
    });
  });

  private readonly offsets = computed(() => {
    let top = 0;
    return this.boxes().map((box) => {
      const start = top;
      top += box.height + PAGE_GAP;
      return start;
    });
  });

  private readonly visibleRange = computed(() => {
    const offsets = this.offsets();
    const boxes = this.boxes();
    const viewport = this.size().height;
    const top = this.scrollTop() - viewport * RENDER_AHEAD;
    const bottom = this.scrollTop() + viewport * (1 + RENDER_AHEAD);
    let start = boxes.length;
    let end = 0;
    for (let i = 0; i < boxes.length; i++) {
      if (offsets[i] + boxes[i].height >= top && offsets[i] <= bottom) {
        start = Math.min(start, i + 1);
        end = Math.max(end, i + 1);
      }
    }
    return { start, end };
  });

  protected readonly windowStart = computed(() => this.visibleRange().start);
  protected readonly windowEnd = computed(() => this.visibleRange().end);

  constructor() {
    let ready = false;
    afterRenderEffect(() => {
      const boxes = this.boxes();
      if (!boxes.length || boxes[0].width < 2) return;
      untracked(() => {
        const page = ready ? this.current() : this.initialPage();
        ready = true;
        this.scrollToPage(page, 'instant');
      });
    });
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(this.frame));

    effect((onCleanup) => {
      const issue = this.issue();
      const boxes = this.boxes();
      const current = this.current();
      if (!boxes.length || boxes[0].width < 2) return;
      const abort = new AbortController();
      onCleanup(() => abort.abort());
      for (const index of prefetchOrder(current - 1, boxes.length)) {
        const box = boxes[index];
        this.pdf.renderPage(issue, box.page, box.width, 'low', abort.signal).catch(() => {});
      }
    });
  }

  scrollToPage(page: number, behavior: ScrollBehavior = 'smooth'): void {
    const index = Math.min(Math.max(page, 1), this.boxes().length) - 1;
    const top = this.offsets()[index] ?? 0;
    this.host.scrollTo({ top, behavior });
    if (behavior === 'instant') this.sync();
  }

  scrollByScreen(direction: 1 | -1): void {
    this.host.scrollBy({ top: direction * this.host.clientHeight * 0.85, behavior: 'smooth' });
  }

  protected onScroll(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.sync();
    });
  }

  protected onClick(event: MouseEvent): void {
    if ((event.target as Element | null)?.closest('button, a')) return;
    this.toggleChrome.emit();
  }

  private sync(): void {
    const top = this.host.scrollTop;
    const delta = top - this.lastScrollTop;
    if (Math.abs(delta) > 6) {
      this.scrolled.emit(delta > 0 ? 1 : -1);
      this.lastScrollTop = top;
    }
    this.scrollTop.set(top);

    const probe = top + this.host.clientHeight / 3;
    const offsets = this.offsets();
    let lo = 0;
    let hi = offsets.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (offsets[mid] <= probe) lo = mid;
      else hi = mid - 1;
    }
    let page = lo + 1;
    if (top + this.host.clientHeight >= this.host.scrollHeight - 2) page = offsets.length;
    if (page !== this.current()) {
      this.current.set(page);
      this.pageChange.emit(page);
    }
  }
}
