import { Issue } from '../../core/library/library.models';
import { LibraryService } from '../../core/library/library.service';
import { ReadingProgressService } from '../../core/progress/reading-progress.service';

export type ContinueKind = 'start' | 'resume' | 'next' | 'finished';

export interface ContinueTarget {
  readonly issue: Issue;
  readonly kind: ContinueKind;
  readonly page: number;
  readonly fraction: number;
}

export function continueTarget(
  library: LibraryService,
  progress: ReadingProgressService,
): ContinueTarget | null {
  const lastId = progress.lastIssueId();
  const last = lastId ? library.issue(lastId) : null;

  if (last) {
    const p = progress.get(last.id);
    if (p && !p.completed) {
      return { issue: last, kind: 'resume', page: p.page, fraction: progress.fraction(last.id) };
    }
    const next = library.next(last.id);
    if (next) {
      const np = progress.get(next.id);
      const resuming = np && !np.completed;
      return {
        issue: next,
        kind: 'next',
        page: resuming ? np.page : 1,
        fraction: resuming ? progress.fraction(next.id) : 0,
      };
    }
    return { issue: last, kind: 'finished', page: 1, fraction: 1 };
  }

  const first = library.firstIssue();
  return first ? { issue: first, kind: 'start', page: 1, fraction: 0 } : null;
}
