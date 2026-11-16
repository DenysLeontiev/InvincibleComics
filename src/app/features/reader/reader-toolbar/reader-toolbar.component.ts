import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { Issue } from '../../../core/library/library.models';
import { ReaderFit, ReaderLayout } from '../../../core/preferences/preferences.service';
import { IconComponent, IconName } from '../../../shared/icon/icon.component';
import { IssueNumberPipe } from '../../../shared/issue-number.pipe';

interface LayoutOption {
  readonly value: ReaderLayout;
  readonly icon: IconName;
  readonly label: string;
}

const LAYOUTS: readonly LayoutOption[] = [
  { value: 'single', icon: 'page-single', label: 'Single page' },
  { value: 'double', icon: 'page-double', label: 'Two-page spread' },
  { value: 'scroll', icon: 'page-scroll', label: 'Vertical scroll' },
];

@Component({
  selector: 'app-reader-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, IssueNumberPipe],
  template: `
    <button type="button" class="icon-button back" (click)="back.emit()" aria-label="Back to library" title="Back to library (Esc)">
      <app-icon name="arrow-left" />
    </button>

    <div class="title">
      <span class="series">Invincible</span>
      <span class="number">{{ issue().number | issueNumber }}</span>
      <span class="year">{{ issue().year }}</span>
    </div>

    <div class="actions">
      <div class="segmented" role="radiogroup" aria-label="Page layout">
        @for (option of layouts; track option.value) {
          <button
            type="button"
            role="radio"
            class="icon-button"
            [attr.aria-checked]="layout() === option.value"
            [attr.aria-label]="option.label"
            [title]="option.label"
            [disabled]="option.value === 'double' && !canDouble()"
            (click)="layoutChange.emit(option.value)"
          >
            <app-icon [name]="option.icon" />
          </button>
        }
      </div>

      <button
        type="button"
        class="icon-button"
        [attr.aria-pressed]="fit() === 'width'"
        [attr.aria-label]="fit() === 'width' ? 'Fit page to screen' : 'Fit page to width'"
        [title]="fit() === 'width' ? 'Fit page to screen' : 'Fit page to width'"
        (click)="fitChange.emit(fit() === 'width' ? 'contain' : 'width')"
      >
        <app-icon [name]="fit() === 'width' ? 'fit-contain' : 'fit-width'" />
      </button>

      @if (fullscreenSupported) {
        <button
          type="button"
          class="icon-button"
          [attr.aria-label]="fullscreen() ? 'Exit full screen' : 'Full screen'"
          [title]="(fullscreen() ? 'Exit full screen' : 'Full screen') + ' (F)'"
          (click)="toggleFullscreen.emit()"
        >
          <app-icon [name]="fullscreen() ? 'minimize' : 'maximize'" />
        </button>
      }
    </div>
  `,
  styleUrl: './reader-toolbar.component.scss',
})
export class ReaderToolbarComponent {
  readonly issue = input.required<Issue>();
  readonly layout = input.required<ReaderLayout>();
  readonly fit = input.required<ReaderFit>();
  readonly fullscreen = input(false);
  readonly canDouble = input(true);

  readonly back = output<void>();
  readonly layoutChange = output<ReaderLayout>();
  readonly fitChange = output<ReaderFit>();
  readonly toggleFullscreen = output<void>();

  protected readonly layouts = LAYOUTS;
  protected readonly fullscreenSupported = typeof document !== 'undefined' && document.fullscreenEnabled;
}
