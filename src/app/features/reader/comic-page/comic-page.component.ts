import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal } from '@angular/core';

import { AnalyticsService } from '../../../core/analytics/analytics.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { Issue } from '../../../core/library/library.models';
import { LibraryService } from '../../../core/library/library.service';
import { PageImagesService } from '../../../core/pages/page-images.service';
import { IconComponent } from '../../../shared/icon/icon.component';

export type PagePriority = 'high' | 'low' | 'auto';

@Component({
  selector: 'app-comic-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TranslatePipe],
  host: {
    '[style.width.px]': 'width()',
    '[style.height.px]': 'height()',
    '[class.ready]': 'loaded()',
  },
  template: `
    @if (failed()) {
      <div class="error">
        <span>{{ 'page.error' | t: { page: page() } }}</span>
        <button type="button" (click)="retry($event)"><app-icon name="refresh" /> {{ 'page.retry' | t }}</button>
      </div>
    } @else {
      @if (!loaded()) {
        @if (placeholder(); as thumb) {
          <img class="thumb" [src]="thumb" alt="" draggable="false" />
          <div class="placeholder subtle"><span class="spinner" aria-hidden="true"></span></div>
        } @else {
          <div class="placeholder"><span class="spinner" aria-hidden="true"></span></div>
        }
      }
      <img
        [src]="src()"
        [attr.fetchpriority]="priority()"
        [alt]="'page.alt' | t: { page: page() }"
        decoding="async"
        draggable="false"
        (load)="onLoad($event)"
        (error)="onError()"
      />
    }
  `,
  styleUrl: './comic-page.component.scss',
})
export class ComicPageComponent {
  private readonly images = inject(PageImagesService);
  private readonly library = inject(LibraryService);
  private readonly analytics = inject(AnalyticsService);

  readonly issue = input.required<Issue>();
  readonly page = input.required<number>();
  readonly width = input.required<number>();
  readonly height = input.required<number>();
  readonly priority = input<PagePriority>('high');

  private readonly url = computed(() => this.images.url(this.issue(), this.page()));
  private readonly attempt = linkedSignal<string, number>({ source: this.url, computation: () => 0 });
  protected readonly src = computed(() => {
    const attempt = this.attempt();
    return attempt ? `${this.url()}&retry=${attempt}` : this.url();
  });
  protected readonly loaded = linkedSignal(() => this.images.isLoaded(this.url()));
  protected readonly failed = linkedSignal<string, boolean>({ source: this.url, computation: () => false });
  protected readonly placeholder = computed(() =>
    this.page() === 1 ? this.library.coverUrl(this.issue()) : null,
  );

  protected onLoad(event: Event): void {
    this.images.markLoaded(this.url(), event.target as HTMLImageElement);
    this.loaded.set(true);
  }

  protected onError(): void {
    this.failed.set(true);
    this.analytics.event('page_error', { issue_number: this.issue().number, page_number: this.page() });
  }

  protected retry(event: Event): void {
    event.stopPropagation();
    this.failed.set(false);
    this.attempt.update((n) => n + 1);
  }
}
