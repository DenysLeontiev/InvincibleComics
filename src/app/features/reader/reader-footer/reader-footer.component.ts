import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { Issue } from '../../../core/library/library.models';
import { IconComponent } from '../../../shared/icon/icon.component';
import { IssueNumberPipe } from '../../../shared/issue-number.pipe';

@Component({
  selector: 'app-reader-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, IssueNumberPipe, TranslatePipe],
  template: `
    <button
      type="button"
      class="issue-button"
      [disabled]="!previousIssue()"
      (click)="openIssue.emit(previousIssue()!)"
      [attr.aria-label]="previousIssue() ? ('reader.previousIssue' | t) + ' ' + (previousIssue()!.number | issueNumber) : ('reader.noPreviousIssue' | t)"
      [title]="previousIssue() ? ('reader.previousIssue' | t) : ''"
    >
      <app-icon name="skip-back" />
      <span class="label">{{ previousIssue()?.number | issueNumber }}</span>
    </button>

    <div class="scrubber" [style.--fill]="fill()">
      <span class="readout" aria-hidden="true">
        <strong>{{ label() }}</strong> / {{ pages() }}
      </span>
      <div class="track">
      <input
        type="range"
        min="1"
        [max]="pages()"
        step="1"
        [value]="page()"
        [attr.aria-label]="'reader.page' | t"
        [attr.aria-valuetext]="'reader.pageOf' | t: { page: label(), total: pages() }"
        (input)="onInput($event)"
        (pointerdown)="dragging.set(true)"
        (pointerup)="dragging.set(false)"
        (change)="dragging.set(false)"
      />
      @if (dragging()) {
        <span class="bubble" [style.left]="bubbleLeft()">{{ page() }}</span>
      }
      </div>
    </div>

    <button
      type="button"
      class="issue-button"
      [disabled]="!nextIssue()"
      (click)="openIssue.emit(nextIssue()!)"
      [attr.aria-label]="nextIssue() ? ('reader.nextIssue' | t) + ' ' + (nextIssue()!.number | issueNumber) : ('reader.noNextIssue' | t)"
      [title]="nextIssue() ? ('reader.nextIssue' | t) : ''"
    >
      <span class="label">{{ nextIssue()?.number | issueNumber }}</span>
      <app-icon name="skip-forward" />
    </button>
  `,
  styleUrl: './reader-footer.component.scss',
})
export class ReaderFooterComponent {
  readonly page = input.required<number>();
  readonly lastVisible = input<number | null>(null);
  readonly pages = input.required<number>();
  readonly previousIssue = input<Issue | null>(null);
  readonly nextIssue = input<Issue | null>(null);

  readonly seek = output<number>();
  readonly openIssue = output<Issue>();

  protected readonly dragging = signal(false);

  protected readonly label = computed(() => {
    const last = this.lastVisible();
    return last && last !== this.page() ? `${this.page()}–${last}` : `${this.page()}`;
  });

  protected readonly fill = computed(() => {
    const pages = this.pages();
    return pages > 1 ? ((this.page() - 1) / (pages - 1)).toFixed(4) : '1';
  });

  protected readonly bubbleLeft = computed(
    () => `calc(${this.fill()} * (100% - 18px) + 9px)`,
  );

  protected onInput(event: Event): void {
    this.seek.emit(Number((event.target as HTMLInputElement).value));
  }
}
