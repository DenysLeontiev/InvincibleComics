import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-progress-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'progressbar',
    'aria-valuemin': '0',
    'aria-valuemax': '100',
    '[attr.aria-valuenow]': 'percent()',
    '[class.done]': 'value() >= 1',
  },
  template: `<span class="fill" [style.transform]="'scaleX(' + clamped() + ')'"></span>`,
  styles: `
    :host {
      display: block;
      block-size: var(--progress-height, 4px);
      border-radius: 999px;
      background: var(--progress-track, rgb(255 255 255 / 0.12));
      overflow: hidden;
    }
    .fill {
      display: block;
      block-size: 100%;
      background: var(--progress-color, var(--yellow));
      border-radius: inherit;
      transform-origin: left;
      transition: transform 400ms var(--ease-out);
    }
    :host(.done) .fill {
      background: var(--progress-done-color, var(--progress-color, var(--yellow)));
    }
  `,
})
export class ProgressBarComponent {
  readonly value = input(0);
  protected readonly clamped = computed(() => Math.min(1, Math.max(0, this.value())));
  protected readonly percent = computed(() => Math.round(this.clamped() * 100));
}
