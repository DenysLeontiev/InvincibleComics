import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  linkedSignal,
  resource,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { Router } from '@angular/router';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { elementSize } from '../../../core/layout/element-size';
import { Issue } from '../../../core/library/library.models';
import { LibraryService } from '../../../core/library/library.service';
import { PdfService } from '../../../core/pdf/pdf.service';
import { PreferencesService, ReaderFit, ReaderLayout } from '../../../core/preferences/preferences.service';
import { ReadingProgressService } from '../../../core/progress/reading-progress.service';
import { IconComponent } from '../../../shared/icon/icon.component';
import { IssueNumberPipe } from '../../../shared/issue-number.pipe';
import { ProgressBarComponent } from '../../../shared/progress-bar/progress-bar.component';
import { IssueEndComponent } from '../issue-end/issue-end.component';
import { PagedViewComponent } from '../paged-view/paged-view.component';
import { ReaderFooterComponent } from '../reader-footer/reader-footer.component';
import { ReaderToolbarComponent } from '../reader-toolbar/reader-toolbar.component';
import { buildViews, viewIndexOf } from '../reader-layout';
import { ScrollViewComponent } from '../scroll-view/scroll-view.component';

const CHROME_AUTO_HIDE_MS = 2800;
const CHROME_HOT_ZONE_PX = 96;
const MIN_DOUBLE_WIDTH = 720;

@Component({
  selector: 'app-reader-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IconComponent,
    IssueEndComponent,
    IssueNumberPipe,
    PagedViewComponent,
    ProgressBarComponent,
    ReaderFooterComponent,
    ReaderToolbarComponent,
    ScrollViewComponent,
    TranslatePipe,
  ],
  templateUrl: './reader-page.component.html',
  styleUrl: './reader-page.component.scss',
  host: {
    '[class.chrome-hidden]': '!chromeShown()',
    '(document:keydown)': 'onKeydown($event)',
    '(document:fullscreenchange)': 'syncFullscreen()',
    '(mousemove)': 'onMouseMove($event)',
  },
})
export class ReaderPageComponent {
  private readonly library = inject(LibraryService);
  private readonly progress = inject(ReadingProgressService);
  private readonly prefs = inject(PreferencesService);
  private readonly pdf = inject(PdfService);
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly document = inject(DOCUMENT);
  private readonly i18n = inject(I18nService);
  private readonly size = elementSize();

  readonly id = input.required<string>();

  private readonly pagedView = viewChild(PagedViewComponent);
  private readonly scrollView = viewChild(ScrollViewComponent);

  protected readonly issue = computed(() => this.library.issue(this.id()));
  protected readonly notFound = computed(() => this.library.isReady() && !this.issue());
  protected readonly libraryError = this.library.error;
  protected readonly previousIssue = computed(() => this.library.previous(this.id()));
  protected readonly nextIssue = computed(() => this.library.next(this.id()));
  protected readonly coverUrl = computed(() => {
    const issue = this.issue();
    return issue ? this.library.coverUrl(issue) : '';
  });

  private readonly retries = signal(0);
  private readonly opened = computed(() => {
    this.retries();
    const issue = this.issue();
    return issue ? this.pdf.open(issue) : undefined;
  });
  protected readonly doc = resource({
    params: () => this.opened(),
    loader: ({ params }) => params.doc,
  });
  protected readonly loadProgress = computed(() => this.opened()?.progress() ?? 0);

  protected readonly canDouble = computed(() => {
    const { width, height } = this.size();
    return width >= MIN_DOUBLE_WIDTH && width > height;
  });
  protected readonly layout = computed<ReaderLayout>(() => {
    const layout = this.prefs.layout();
    return layout === 'double' && !this.canDouble() ? 'single' : layout;
  });
  protected readonly preferredLayout = this.prefs.layout;
  protected readonly fit = this.prefs.fit;

  protected readonly views = computed(() => {
    const issue = this.issue();
    return issue ? buildViews(issue.ratios, this.layout() === 'double') : [];
  });

  protected readonly page = linkedSignal<Issue | null, number>({
    source: this.issue,
    computation: (issue) =>
      issue ? untracked(() => this.progress.resumePage(issue.id, issue.pages)) : 1,
  });
  protected readonly atEnd = linkedSignal<Issue | null, boolean>({
    source: this.issue,
    computation: () => false,
  });
  protected readonly direction = signal(0);

  protected readonly viewIndex = computed(() => viewIndexOf(this.views(), this.page()));
  protected readonly firstVisible = computed(() => {
    if (this.layout() === 'scroll') return this.page();
    return this.views()[this.viewIndex()]?.[0] ?? this.page();
  });
  protected readonly lastVisible = computed(() => {
    if (this.layout() === 'scroll') return this.page();
    const view = this.views()[this.viewIndex()];
    return view ? view[view.length - 1] : this.page();
  });

  private readonly chromeVisible = signal(true);
  protected readonly chromeShown = computed(
    () => this.chromeVisible() || !this.doc.hasValue() || (this.atEnd() && this.layout() !== 'scroll'),
  );
  protected readonly fullscreen = signal(false);
  protected readonly showHints = computed(() => !this.prefs.hintsSeen() && this.doc.hasValue());
  private hideTimer: ReturnType<typeof setTimeout> | undefined;
  private pointerOnChrome = false;

  constructor() {
    const root = this.document.documentElement;
    root.classList.add('reader-open');
    inject(DestroyRef).onDestroy(() => {
      root.classList.remove('reader-open');
      clearTimeout(this.hideTimer);
    });

    effect(() => {
      const issue = this.issue();
      this.title.setTitle(
        issue ? this.i18n.t('app.readerTitle', { issue: `#${issue.number}` }) : this.i18n.t('app.title'),
      );
    });

    effect(() => {
      const issue = this.issue();
      if (!issue || !this.doc.hasValue()) return;
      const page = this.lastVisible();
      untracked(() => this.progress.record(issue.id, page, issue.pages));
    });

    effect(() => {
      const issue = this.issue();
      const next = this.nextIssue();
      if (!issue || !next || !this.doc.hasValue()) return;
      if (this.atEnd() || this.lastVisible() >= issue.pages - 3) this.pdf.preload(next);
    });

    effect(() => {
      if (this.doc.hasValue()) untracked(() => this.showChrome());
    });
  }

  protected next(): void {
    this.dismissHints();
    if (this.atEnd()) {
      const next = this.nextIssue();
      if (next) this.openIssue(next);
      return;
    }
    if (this.layout() === 'scroll') {
      this.scrollView()?.scrollToPage(this.page() + 1);
      return;
    }
    const index = this.viewIndex();
    const views = this.views();
    this.direction.set(1);
    if (index < views.length - 1) this.page.set(views[index + 1][0]);
    else this.atEnd.set(true);
    this.hideChrome();
  }

  protected previous(): void {
    this.dismissHints();
    if (this.layout() === 'scroll') {
      this.scrollView()?.scrollToPage(this.page() - 1);
      return;
    }
    this.direction.set(-1);
    if (this.atEnd()) {
      this.atEnd.set(false);
      return;
    }
    const index = this.viewIndex();
    if (index > 0) this.page.set(this.views()[index - 1][0]);
    this.hideChrome();
  }

  private turn(direction: 1 | -1): void {
    if (direction > 0) this.next();
    else this.previous();
  }

  protected seek(page: number): void {
    const issue = this.issue();
    if (!issue) return;
    const target = Math.min(Math.max(1, page), issue.pages);
    this.direction.set(0);
    this.atEnd.set(false);
    this.page.set(target);
    this.scrollView()?.scrollToPage(target, 'instant');
    this.showChrome();
  }

  protected restart(): void {
    this.seek(1);
  }

  protected openIssue(issue: Issue): void {
    void this.router.navigate(['/read', issue.id]);
  }

  protected back(): void {
    void this.router.navigate(['/']);
  }

  protected onScrollPage(page: number): void {
    this.page.set(page);
  }

  protected onScrolled(direction: number): void {
    if (direction > 0) this.hideChrome();
    else this.showChrome();
  }

  protected setLayout(layout: ReaderLayout): void {
    this.atEnd.set(false);
    this.prefs.set('layout', layout);
    this.showChrome();
  }

  protected setFit(fit: ReaderFit): void {
    this.prefs.set('fit', fit);
    this.showChrome();
  }

  protected retry(): void {
    this.retries.update((n) => n + 1);
  }

  protected toggleChrome(): void {
    this.dismissHints();
    if (this.chromeVisible()) {
      this.pointerOnChrome = false;
      this.hideChrome();
    } else {
      this.showChrome();
    }
  }

  protected showChrome(): void {
    this.chromeVisible.set(true);
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => this.hideChrome(), CHROME_AUTO_HIDE_MS);
  }

  protected hideChrome(): void {
    clearTimeout(this.hideTimer);
    if (!this.pointerOnChrome) this.chromeVisible.set(false);
  }

  protected chromePointer(inside: boolean): void {
    this.pointerOnChrome = inside;
    if (inside) {
      this.chromeVisible.set(true);
      clearTimeout(this.hideTimer);
    } else {
      this.showChrome();
    }
  }

  protected onMouseMove(event: MouseEvent): void {
    const nearEdge = event.clientY < CHROME_HOT_ZONE_PX || event.clientY > window.innerHeight - CHROME_HOT_ZONE_PX;
    if (nearEdge && !this.chromeVisible()) this.showChrome();
  }

  protected dismissHints(): void {
    if (!this.prefs.hintsSeen()) this.prefs.set('hintsSeen', true);
  }

  protected toggleFullscreen(): void {
    const doc = this.document;
    if (doc.fullscreenElement) void doc.exitFullscreen().catch(() => {});
    else void doc.documentElement.requestFullscreen?.().catch(() => {});
  }

  protected syncFullscreen(): void {
    this.fullscreen.set(!!this.document.fullscreenElement);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
    const onButton = !!target?.closest('button, a');
    const scroll = this.layout() === 'scroll';

    let handled = true;
    switch (event.key) {
      case 'ArrowRight':
      case 'd':
        this.next();
        break;
      case 'ArrowLeft':
      case 'a':
        this.previous();
        break;
      case ' ':
      case 'PageDown':
      case 'PageUp': {
        if (onButton && event.key === ' ') return;
        const back = event.key === 'PageUp' || (event.key === ' ' && event.shiftKey);
        if (scroll) this.scrollView()?.scrollByScreen(back ? -1 : 1);
        else if (this.atEnd()) this.turn(back ? -1 : 1);
        else if (back) this.pagedView()?.retreat();
        else this.pagedView()?.advance();
        break;
      }
      case 'Home':
        this.seek(1);
        break;
      case 'End':
        this.seek(this.issue()?.pages ?? 1);
        break;
      case 'f':
      case 'F':
        this.toggleFullscreen();
        break;
      case 'Escape':
        if (!this.document.fullscreenElement) this.back();
        break;
      default:
        handled = false;
    }
    if (handled) event.preventDefault();
  }
}
