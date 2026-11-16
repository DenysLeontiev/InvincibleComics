import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';

import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { LibraryFilter } from '../../../core/preferences/preferences.service';
import { IconComponent } from '../../../shared/icon/icon.component';

export interface FilterOption {
  readonly value: LibraryFilter;
  readonly label: string;
  readonly count: number;
}

@Component({
  selector: 'app-library-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TranslatePipe],
  template: `
    <div class="filters" role="radiogroup" [attr.aria-label]="'filter.label' | t">
      @for (option of options(); track option.value) {
        <button
          type="button"
          role="radio"
          class="chip"
          [attr.aria-checked]="option.value === filter()"
          (click)="filterChange.emit(option.value)"
        >
          {{ option.label }}
          <span class="count">{{ option.count }}</span>
        </button>
      }
    </div>

    <form class="jump" (submit)="submit($event)" role="search">
      <app-icon name="search" />
      <input
        type="text"
        inputmode="numeric"
        pattern="[0-9]*"
        maxlength="4"
        [placeholder]="'jump.placeholder' | t"
        [attr.aria-label]="'jump.label' | t"
        autocomplete="off"
        [value]="query()"
        (input)="onInput($event)"
        (keydown.escape)="query.set('')"
      />
      @if (notFound()) {
        <span class="hint" role="status">{{ 'jump.notFound' | t }}</span>
      }
    </form>
  `,
  styleUrl: './library-toolbar.component.scss',
})
export class LibraryToolbarComponent {
  readonly options = input.required<readonly FilterOption[]>();
  readonly filter = input.required<LibraryFilter>();

  readonly filterChange = output<LibraryFilter>();
  readonly jump = output<number>();
  readonly notFound = input(false);

  protected readonly query = signal('');

  protected onInput(event: Event): void {
    const el = event.target as HTMLInputElement;
    const digits = el.value.replace(/\D+/g, '');
    if (digits !== el.value) el.value = digits;
    this.query.set(digits);
  }

  protected submit(event: Event): void {
    event.preventDefault();
    const value = this.query();
    if (value) this.jump.emit(Number.parseInt(value, 10));
  }
}
