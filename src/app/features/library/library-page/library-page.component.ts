import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injectable,
  Injector,
  signal,
} from '@angular/core';
import { Title } from '@angular/platform-browser';

import { Issue } from '../../../core/library/library.models';
import { LibraryService } from '../../../core/library/library.service';
import { LibraryFilter, PreferencesService } from '../../../core/preferences/preferences.service';
import { ReadingProgressService } from '../../../core/progress/reading-progress.service';
import { IconComponent } from '../../../shared/icon/icon.component';
import { ProgressBarComponent } from '../../../shared/progress-bar/progress-bar.component';
import { ContinueCardComponent } from '../continue-card/continue-card.component';
import { continueTarget } from '../continue-target';
import { IssueCardComponent } from '../issue-card/issue-card.component';
import {
  FilterOption,
  LibraryToolbarComponent,
} from '../library-toolbar/library-toolbar.component';

interface YearGroup {
  readonly year: number;
  readonly issues: readonly Issue[];
}

@Injectable({ providedIn: 'root' })
class LibraryScrollMemory {
  y = 0;
}

@Component({
  selector: 'app-library-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ContinueCardComponent,
    IssueCardComponent,
    LibraryToolbarComponent,
    IconComponent,
    ProgressBarComponent,
  ],
  templateUrl: './library-page.component.html',
  styleUrl: './library-page.component.scss',
})
export class LibraryPageComponent {
  protected readonly library = inject(LibraryService);
  private readonly progress = inject(ReadingProgressService);
  private readonly prefs = inject(PreferencesService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly scrollMemory = inject(LibraryScrollMemory);

  protected readonly filter = this.prefs.libraryFilter;
  protected readonly jumpNotFound = signal(false);

  protected readonly continueTarget = computed(() => continueTarget(this.library, this.progress));
  protected readonly currentId = computed(() => this.progress.lastIssueId());

  protected readonly stats = computed(() => {
    const issues = this.library.issues();
    const all = this.progress.all();
    let read = 0;
    let reading = 0;
    for (const issue of issues) {
      const p = all[issue.id];
      if (p?.completed) read++;
      else if (p) reading++;
    }
    return { total: issues.length, read, reading, unread: issues.length - read - reading };
  });

  protected readonly filterOptions = computed<FilterOption[]>(() => {
    const s = this.stats();
    return [
      { value: 'all', label: 'All', count: s.total },
      { value: 'unread', label: 'Unread', count: s.unread },
      { value: 'reading', label: 'Reading', count: s.reading },
      { value: 'read', label: 'Finished', count: s.read },
    ];
  });

  protected readonly groups = computed<YearGroup[]>(() => {
    const filter = this.filter();
    const all = this.progress.all();
    const groups = new Map<number, Issue[]>();
    for (const issue of this.library.issues()) {
      const p = all[issue.id];
      const visible =
        filter === 'all' ||
        (filter === 'read' && p?.completed) ||
        (filter === 'reading' && p && !p.completed) ||
        (filter === 'unread' && !p);
      if (!visible) continue;
      const list = groups.get(issue.year) ?? [];
      list.push(issue);
      groups.set(issue.year, list);
    }
    return [...groups].sort(([a], [b]) => a - b).map(([year, issues]) => ({ year, issues }));
  });

  constructor() {
    inject(Title).setTitle('Invincible · Comic Reader');

    let restored = false;
    effect(() => {
      if (restored || !this.library.isReady()) return;
      restored = true;
      const y = this.scrollMemory.y;
      if (y > 0) afterNextRender(() => window.scrollTo({ top: y, behavior: 'instant' }), { injector: this.injector });
    });

    inject(DestroyRef).onDestroy(() => (this.scrollMemory.y = window.scrollY));
  }

  protected setFilter(filter: LibraryFilter): void {
    this.prefs.set('libraryFilter', filter);
  }

  protected jumpTo(number: number): void {
    const issue = this.library.byNumber(number);
    this.jumpNotFound.set(!issue);
    if (!issue) return;
    if (!this.groups().some((g) => g.issues.includes(issue))) this.setFilter('all');

    afterNextRender(
      () => {
        const card = this.host.nativeElement.querySelector<HTMLElement>(`app-issue-card[data-issue="${number}"]`);
        if (!card) return;
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.remove('flash');
        void card.offsetWidth;
        card.classList.add('flash');
        card.querySelector<HTMLElement>('a')?.focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
  }

  protected resetProgress(): void {
    if (confirm('Clear all reading progress? This cannot be undone.')) this.progress.clearAll();
  }
}
