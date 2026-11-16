import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';

import { Issue } from '../../../core/library/library.models';
import { LibraryService } from '../../../core/library/library.service';
import { PdfService, RenderAbortedError, RenderPriority } from '../../../core/pdf/pdf.service';
import { IconComponent } from '../../../shared/icon/icon.component';

@Component({
  selector: 'app-comic-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  host: {
    '[style.width.px]': 'width()',
    '[style.height.px]': 'height()',
    '[class.ready]': 'src() !== null',
  },
  template: `
    @if (src(); as url) {
      <img [src]="url" [alt]="'Page ' + page()" draggable="false" />
    } @else if (failed()) {
      <div class="error">
        <span>Page {{ page() }} couldn't be drawn</span>
        <button type="button" (click)="retry($event)"><app-icon name="refresh" /> Retry</button>
      </div>
    } @else if (placeholder(); as thumb) {
      <img class="thumb" [src]="thumb" alt="" draggable="false" />
      <div class="placeholder subtle"><span class="spinner" aria-hidden="true"></span></div>
    } @else {
      <div class="placeholder"><span class="spinner" aria-hidden="true"></span></div>
    }
  `,
  styleUrl: './comic-page.component.scss',
})
export class ComicPageComponent {
  private readonly pdf = inject(PdfService);
  private readonly library = inject(LibraryService);

  readonly issue = input.required<Issue>();
  readonly page = input.required<number>();
  readonly width = input.required<number>();
  readonly height = input.required<number>();
  readonly priority = input<RenderPriority>('high');

  protected readonly src = signal<string | null>(null);
  protected readonly failed = signal(false);
  private readonly attempt = signal(0);
  private readonly key = computed(() => `${this.issue().id}:${this.page()}`);
  protected readonly placeholder = computed(() =>
    this.page() === 1 ? this.library.coverUrl(this.issue()) : null,
  );

  constructor() {
    let shownKey = '';

    effect((onCleanup) => {
      const key = this.key();
      const issue = this.issue();
      const page = this.page();
      const width = this.width();
      this.attempt();

      if (key !== shownKey) {
        shownKey = key;
        this.failed.set(false);
        this.src.set(this.pdf.anyCached(issue, page)?.url ?? null);
      }
      if (width < 2) return;
      const exact = this.pdf.cached(issue, page, width);
      if (exact) {
        this.src.set(exact.url);
        return;
      }

      const abort = new AbortController();
      onCleanup(() => abort.abort());
      const priority = untracked(this.priority);
      this.pdf
        .renderPage(issue, page, width, priority, abort.signal)
        .then(async (rendered) => {
          if (abort.signal.aborted) return;
          await decode(rendered.url);
          if (!abort.signal.aborted) this.src.set(rendered.url);
        })
        .catch((error: unknown) => {
          if (abort.signal.aborted || error instanceof RenderAbortedError) return;
          console.error(`Failed to render ${key}`, error);
          if (!this.src()) this.failed.set(true);
        });
    });
  }

  protected retry(event: Event): void {
    event.stopPropagation();
    this.failed.set(false);
    this.attempt.update((n) => n + 1);
  }
}

async function decode(url: string): Promise<void> {
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch {}
}
