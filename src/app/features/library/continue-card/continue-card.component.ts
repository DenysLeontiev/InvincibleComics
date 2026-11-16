import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslationKey } from '../../../core/i18n/i18n.types';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { LibraryService } from '../../../core/library/library.service';
import { IconComponent } from '../../../shared/icon/icon.component';
import { IssueNumberPipe } from '../../../shared/issue-number.pipe';
import { ProgressBarComponent } from '../../../shared/progress-bar/progress-bar.component';
import { ContinueTarget } from '../continue-target';

const EYEBROW: Record<ContinueTarget['kind'], TranslationKey> = {
  start: 'continue.start',
  resume: 'continue.resume',
  next: 'continue.next',
  finished: 'continue.finished',
};

@Component({
  selector: 'app-continue-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, IssueNumberPipe, ProgressBarComponent, TranslatePipe],
  templateUrl: './continue-card.component.html',
  styleUrl: './continue-card.component.scss',
})
export class ContinueCardComponent {
  private readonly library = inject(LibraryService);
  private readonly i18n = inject(I18nService);

  readonly target = input.required<ContinueTarget>();

  protected readonly coverUrl = computed(() => this.library.coverUrl(this.target().issue));
  protected readonly eyebrow = computed(() => this.i18n.t(EYEBROW[this.target().kind]));
  protected readonly action = computed(() => {
    const t = this.target();
    if (t.kind === 'finished') return this.i18n.t('continue.readAgain');
    return t.page > 1
      ? this.i18n.t('continue.onPage', { page: t.page })
      : this.i18n.t('continue.startReading');
  });
}
