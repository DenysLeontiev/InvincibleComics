import { computed, Injectable } from '@angular/core';

import { isRecord, persistedSignal } from '../storage/persisted-signal';

export interface IssueProgress {
  readonly page: number;
  readonly pages: number;
  readonly completed: boolean;
  readonly updatedAt: number;
}

interface ProgressState {
  readonly lastIssueId: string | null;
  readonly issues: Readonly<Record<string, IssueProgress>>;
}

const EMPTY: ProgressState = { lastIssueId: null, issues: {} };

function parseProgress(raw: unknown): ProgressState | null {
  if (!isRecord(raw) || !isRecord(raw['issues'])) return null;
  const issues: Record<string, IssueProgress> = {};
  for (const [id, value] of Object.entries(raw['issues'])) {
    if (!isRecord(value)) continue;
    const { page, pages, completed, updatedAt } = value;
    if (typeof page !== 'number' || typeof pages !== 'number' || page < 1) continue;
    issues[id] = {
      page: Math.floor(page),
      pages: Math.floor(pages),
      completed: completed === true,
      updatedAt: typeof updatedAt === 'number' ? updatedAt : 0,
    };
  }
  const last = raw['lastIssueId'];
  return { lastIssueId: typeof last === 'string' ? last : null, issues };
}

@Injectable({ providedIn: 'root' })
export class ReadingProgressService {
  private readonly state = persistedSignal<ProgressState>('progress.v1', EMPTY, parseProgress);

  readonly lastIssueId = computed(() => this.state().lastIssueId);
  readonly all = computed(() => this.state().issues);
  readonly completedCount = computed(
    () => Object.values(this.state().issues).filter((p) => p.completed).length,
  );

  get(issueId: string): IssueProgress | null {
    return this.state().issues[issueId] ?? null;
  }

  fraction(issueId: string): number {
    const p = this.get(issueId);
    if (!p) return 0;
    if (p.completed) return 1;
    return p.pages > 0 ? Math.min(1, p.page / p.pages) : 0;
  }

  resumePage(issueId: string, pages: number): number {
    const p = this.get(issueId);
    if (!p || (p.completed && p.page >= pages)) return 1;
    return Math.min(Math.max(1, p.page), pages);
  }

  record(issueId: string, page: number, pages: number): void {
    this.state.update((s) => {
      const prev = s.issues[issueId];
      const completed = (prev?.completed ?? false) || page >= pages;
      if (prev && prev.page === page && prev.pages === pages && prev.completed === completed && s.lastIssueId === issueId) {
        return s;
      }
      return {
        lastIssueId: issueId,
        issues: { ...s.issues, [issueId]: { page, pages, completed, updatedAt: Date.now() } },
      };
    });
  }

  setCompleted(issueId: string, pages: number, completed: boolean): void {
    this.state.update((s) => {
      const issues = { ...s.issues };
      if (completed) {
        issues[issueId] = { page: pages, pages, completed: true, updatedAt: Date.now() };
      } else {
        delete issues[issueId];
      }
      return { ...s, issues };
    });
  }

  clearAll(): void {
    this.state.set(EMPTY);
  }
}
