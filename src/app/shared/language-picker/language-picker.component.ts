import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChildren,
} from '@angular/core';

import { I18nService } from '../../core/i18n/i18n.service';
import { LanguageCode } from '../../core/i18n/i18n.types';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-language-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TranslatePipe],
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(keydown.escape)': 'close(true)',
  },
  template: `
    <button
      #trigger
      type="button"
      class="trigger"
      aria-haspopup="menu"
      [attr.aria-expanded]="open()"
      [attr.aria-label]="('header.language' | t) + ': ' + i18n.languageInfo().name"
      [title]="'header.language' | t"
      (click)="toggle()"
    >
      <img class="flag" [src]="i18n.languageInfo().flag" alt="" width="20" height="14" />
      <span class="code">{{ i18n.language() }}</span>
      <app-icon name="chevron-down" />
    </button>

    @if (open()) {
      <div class="menu" role="menu" (keydown)="onMenuKeydown($event)">
        @for (language of i18n.languages; track language.code) {
          <button
            #item
            type="button"
            role="menuitemradio"
            class="item"
            [attr.aria-checked]="language.code === i18n.language()"
            [attr.lang]="language.code"
            (click)="select(language.code)"
          >
            <img class="flag" [src]="language.flag" alt="" width="20" height="14" />
            <span class="name">{{ language.name }}</span>
            @if (language.code === i18n.language()) {
              <app-icon class="check" name="check" />
            }
          </button>
        }
      </div>
    }
  `,
  styleUrl: './language-picker.component.scss',
})
export class LanguagePickerComponent {
  protected readonly i18n = inject(I18nService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);
  private readonly items = viewChildren<ElementRef<HTMLButtonElement>>('item');

  protected readonly open = signal(false);

  protected toggle(): void {
    this.open.update((open) => !open);
    if (this.open()) {
      afterNextRender(
        () => {
          const items = this.items();
          const active = items.find((i) => i.nativeElement.getAttribute('aria-checked') === 'true');
          (active ?? items[0])?.nativeElement.focus();
        },
        { injector: this.injector },
      );
    }
  }

  protected select(code: LanguageCode): void {
    this.i18n.use(code);
    this.close(true);
  }

  protected close(restoreFocus = false): void {
    if (!this.open()) return;
    this.open.set(false);
    if (restoreFocus) this.host.querySelector<HTMLButtonElement>('.trigger')?.focus();
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (!this.host.contains(event.target as Node)) this.close();
  }

  protected onMenuKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const items = this.items().map((i) => i.nativeElement);
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  }
}
