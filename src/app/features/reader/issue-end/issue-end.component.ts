import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { Issue } from '../../../core/library/library.models';
import { LibraryService } from '../../../core/library/library.service';
import { IconComponent } from '../../../shared/icon/icon.component';
import { IssueNumberPipe } from '../../../shared/issue-number.pipe';

@Component({
  selector: 'app-issue-end',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, IssueNumberPipe],
  template: `
    <div class="panel">
      <p class="eyebrow"><app-icon name="check" /> Finished {{ issue().number | issueNumber }}</p>

      @if (next(); as n) {
        <button type="button" class="next" (click)="openIssue.emit(n)" autofocus>
          <img [src]="nextCover()" alt="" width="480" height="738" />
          <span class="next-body">
            <span class="up-next">Up next</span>
            <span class="next-title">Invincible {{ n.number | issueNumber }}</span>
            <span class="cta"><app-icon name="play" /> Read now</span>
          </span>
        </button>
      } @else {
        <h2 class="the-end">The End</h2>
        <p class="note">That's the whole series. Thank you for reading!</p>
      }

      <div class="secondary">
        <button type="button" class="ghost" (click)="restart.emit()"><app-icon name="rotate-ccw" /> Read again</button>
        <button type="button" class="ghost" (click)="library.emit()"><app-icon name="library" /> Library</button>
      </div>
    </div>
  `,
  styleUrl: './issue-end.component.scss',
})
export class IssueEndComponent {
  private readonly libraryService = inject(LibraryService);

  readonly issue = input.required<Issue>();
  readonly next = input<Issue | null>(null);

  readonly openIssue = output<Issue>();
  readonly restart = output<void>();
  readonly library = output<void>();

  protected readonly nextCover = computed(() => {
    const n = this.next();
    return n ? this.libraryService.coverUrl(n) : '';
  });
}
