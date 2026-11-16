import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Issue } from '../../../core/library/library.models';
import { LibraryService } from '../../../core/library/library.service';
import { ReadingProgressService } from '../../../core/progress/reading-progress.service';
import { IconComponent } from '../../../shared/icon/icon.component';
import { IssueNumberPipe } from '../../../shared/issue-number.pipe';
import { ProgressBarComponent } from '../../../shared/progress-bar/progress-bar.component';

@Component({
  selector: 'app-issue-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, IssueNumberPipe, ProgressBarComponent],
  templateUrl: './issue-card.component.html',
  styleUrl: './issue-card.component.scss',
  host: {
    '[class.read]': 'completed()',
    '[class.current]': 'current()',
    '[attr.data-issue]': 'issue().number',
  },
})
export class IssueCardComponent {
  private readonly library = inject(LibraryService);
  private readonly progress = inject(ReadingProgressService);

  readonly issue = input.required<Issue>();
  readonly current = input(false);

  protected readonly coverUrl = computed(() => this.library.coverUrl(this.issue()));
  protected readonly coverRatio = computed(() => this.issue().ratios[0] ?? 0.65);
  protected readonly state = computed(() => this.progress.all()[this.issue().id] ?? null);
  protected readonly completed = computed(() => this.state()?.completed ?? false);
  protected readonly fraction = computed(() => this.progress.fraction(this.issue().id));
  protected readonly loaded = signal(false);

  protected toggleRead(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const issue = this.issue();
    this.progress.setCompleted(issue.id, issue.pages, !this.completed());
  }
}
