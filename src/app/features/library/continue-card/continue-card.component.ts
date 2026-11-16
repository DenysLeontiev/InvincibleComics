import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { LibraryService } from '../../../core/library/library.service';
import { IconComponent } from '../../../shared/icon/icon.component';
import { IssueNumberPipe } from '../../../shared/issue-number.pipe';
import { ProgressBarComponent } from '../../../shared/progress-bar/progress-bar.component';
import { ContinueTarget } from '../continue-target';

const EYEBROW: Record<ContinueTarget['kind'], string> = {
  start: 'Start the story',
  resume: 'Continue reading',
  next: 'Up next',
  finished: 'You finished the series',
};

@Component({
  selector: 'app-continue-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, IssueNumberPipe, ProgressBarComponent],
  templateUrl: './continue-card.component.html',
  styleUrl: './continue-card.component.scss',
})
export class ContinueCardComponent {
  private readonly library = inject(LibraryService);

  readonly target = input.required<ContinueTarget>();

  protected readonly coverUrl = computed(() => this.library.coverUrl(this.target().issue));
  protected readonly eyebrow = computed(() => EYEBROW[this.target().kind]);
  protected readonly action = computed(() => {
    const t = this.target();
    if (t.kind === 'finished') return 'Read it again';
    return t.page > 1 ? `Continue on page ${t.page}` : 'Start reading';
  });
}
