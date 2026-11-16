import { inject, Injectable } from '@angular/core';

import { Issue } from '../library/library.models';
import { LibraryService } from '../library/library.service';
import { LruCache } from './lru-cache';

const MAX_LOADED = 60;
const MAX_BACKGROUND = 3;

interface Job {
  readonly start: () => void;
  readonly cancel: () => void;
  started: boolean;
  waiters: number;
}

@Injectable({ providedIn: 'root' })
export class PageImagesService {
  private readonly library = inject(LibraryService);

  private readonly loaded = new LruCache<string, HTMLImageElement>(MAX_LOADED);
  private readonly jobs = new Map<string, Job>();
  private readonly queue: Job[] = [];
  private running = 0;

  url(issue: Issue, page: number): string {
    return this.library.pageUrl(issue, page);
  }

  isLoaded(url: string): boolean {
    return this.loaded.get(url) !== undefined;
  }

  markLoaded(url: string, image: HTMLImageElement): void {
    this.loaded.set(url, image);
  }

  prefetch(issue: Issue, pages: readonly number[], abort: AbortSignal): void {
    const wanted: Job[] = [];
    for (const page of pages) {
      const url = this.url(issue, page);
      if (this.isLoaded(url)) continue;
      const job = this.jobs.get(url) ?? this.createJob(url);
      job.waiters++;
      abort.addEventListener('abort', () => this.release(job), { once: true });
      if (!job.started) wanted.push(job);
    }
    const rest = this.queue.filter((job) => !wanted.includes(job));
    this.queue.splice(0, this.queue.length, ...wanted, ...rest);
    this.pump();
  }

  private createJob(url: string): Job {
    const image = new Image();
    image.decoding = 'async';
    image.fetchPriority = 'low';
    let settle!: () => void;
    const done = new Promise<void>((resolve) => (settle = resolve));
    const job: Job = {
      started: false,
      waiters: 0,
      start: () => {
        job.started = true;
        this.running++;
        image.onload = () => {
          this.markLoaded(url, image);
          settle();
        };
        image.onerror = () => settle();
        image.src = url;
      },
      cancel: () => settle(),
    };
    done.then(() => {
      this.jobs.delete(url);
      if (job.started) {
        this.running--;
        this.pump();
      }
    });
    this.jobs.set(url, job);
    return job;
  }

  private release(job: Job): void {
    job.waiters--;
    if (job.waiters > 0 || job.started) return;
    const index = this.queue.indexOf(job);
    if (index >= 0) this.queue.splice(index, 1);
    job.cancel();
  }

  private pump(): void {
    while (this.running < MAX_BACKGROUND && this.queue.length) {
      this.queue.shift()!.start();
    }
  }
}
