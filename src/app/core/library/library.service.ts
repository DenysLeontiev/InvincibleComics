import { httpResource } from '@angular/common/http';
import { computed, inject, Injectable } from '@angular/core';

import { LIBRARY_BASE_URL, resolveUrl } from './library.config';
import { Issue, LibraryManifest } from './library.models';

@Injectable({ providedIn: 'root' })
export class LibraryService {
  private readonly baseUrl = resolveUrl(inject(LIBRARY_BASE_URL));

  private readonly manifest = httpResource<LibraryManifest>(() => `${this.baseUrl}library.json`);

  readonly isLoading = this.manifest.isLoading;
  readonly error = this.manifest.error;
  readonly isReady = computed(() => this.manifest.hasValue());

  readonly issues = computed<readonly Issue[]>(() =>
    this.manifest.hasValue() ? [...this.manifest.value().issues].sort((a, b) => a.number - b.number) : [],
  );

  private readonly indexById = computed(
    () => new Map(this.issues().map((issue, index) => [issue.id, index] as const)),
  );

  readonly firstIssue = computed(() => {
    const issues = this.issues();
    return issues.find((i) => i.number === 1) ?? issues[0] ?? null;
  });

  reload(): void {
    this.manifest.reload();
  }

  issue(id: string): Issue | null {
    const index = this.indexById().get(id);
    return index === undefined ? null : this.issues()[index];
  }

  byNumber(number: number): Issue | null {
    return this.issues().find((i) => i.number === number) ?? null;
  }

  next(id: string): Issue | null {
    return this.offset(id, 1);
  }

  previous(id: string): Issue | null {
    return this.offset(id, -1);
  }

  pdfUrl(issue: Issue): string {
    return `${this.baseUrl}${issue.file}`;
  }

  coverUrl(issue: Issue): string {
    return `${this.baseUrl}${issue.cover}`;
  }

  private offset(id: string, delta: number): Issue | null {
    const index = this.indexById().get(id);
    if (index === undefined) return null;
    return this.issues()[index + delta] ?? null;
  }
}
