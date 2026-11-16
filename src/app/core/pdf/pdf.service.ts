import { inject, Injectable, Signal, signal, WritableSignal } from '@angular/core';
import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  PDFWorker,
} from 'pdfjs-dist/legacy/build/pdf.mjs';

import { resolveUrl } from '../library/library.config';
import { Issue } from '../library/library.models';
import { LibraryService } from '../library/library.service';
import { LruCache } from './lru-cache';

type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

type DocumentSource = { url: string; rangeChunkSize: number } | { data: Uint8Array };

export interface RenderedPage {
  readonly url: string;
  readonly width: number;
}

export type RenderPriority = 'high' | 'low';

interface DocEntry {
  readonly primary: Promise<PDFDocumentProxy>;
  readonly progress: WritableSignal<number>;
  bytesReady: boolean;
  slot(index: number): Promise<PDFDocumentProxy>;
  destroy(): void;
}

interface RenderJob {
  readonly key: string;
  readonly issue: Issue;
  readonly page: number;
  readonly width: number;
  readonly promise: Promise<RenderedPage>;
  readonly resolve: (page: RenderedPage) => void;
  readonly reject: (error: unknown) => void;
  priority: RenderPriority;
  seq: number;
  waiters: number;
  started: boolean;
}

const MAX_DOCUMENTS = 3;
const MAX_PAGES = 96;
const WIDTH_STEP = 200;
const MIN_RENDER_WIDTH = 400;
const MAX_RENDER_WIDTH = 2400;
const JPEG_QUALITY = 0.88;
const REVOKE_DELAY_MS = 30_000;

export class RenderAbortedError extends Error {
  constructor() {
    super('Render aborted');
    this.name = 'RenderAbortedError';
  }
}

@Injectable({ providedIn: 'root' })
export class PdfService {
  private readonly library = inject(LibraryService);

  private pdfjs?: Promise<PdfJs>;
  private readonly workers: PDFWorker[] = [];
  private readonly slotCount = Math.min(4, Math.max(1, Math.floor((navigator.hardwareConcurrency || 2) / 2)));
  private readonly freeSlots = Array.from({ length: this.slotCount }, (_, i) => i);

  private readonly docs = new LruCache<string, DocEntry>(MAX_DOCUMENTS, (entry) => entry.destroy());
  private readonly pages = new LruCache<string, RenderedPage>(MAX_PAGES, (page) =>
    setTimeout(() => URL.revokeObjectURL(page.url), REVOKE_DELAY_MS),
  );

  private readonly jobs = new Map<string, RenderJob>();
  private readonly queue: RenderJob[] = [];
  private seq = 0;

  open(issue: Issue): { doc: Promise<PDFDocumentProxy>; progress: Signal<number> } {
    const entry = this.entry(issue);
    return { doc: entry.primary, progress: entry.progress.asReadonly() };
  }

  preload(issue: Issue): void {
    this.entry(issue, false).primary.catch(() => {});
  }

  renderWidth(cssWidth: number): number {
    const px = cssWidth * (globalThis.devicePixelRatio || 1);
    const stepped = Math.ceil(px / WIDTH_STEP) * WIDTH_STEP;
    return Math.min(MAX_RENDER_WIDTH, Math.max(MIN_RENDER_WIDTH, stepped));
  }

  cached(issue: Issue, page: number, cssWidth: number): RenderedPage | null {
    const hit = this.pages.peek(this.pageKey(issue, page));
    return hit && hit.width >= this.renderWidth(cssWidth) ? hit : null;
  }

  anyCached(issue: Issue, page: number): RenderedPage | null {
    return this.pages.peek(this.pageKey(issue, page)) ?? null;
  }

  renderPage(
    issue: Issue,
    page: number,
    cssWidth: number,
    priority: RenderPriority = 'high',
    abort?: AbortSignal,
  ): Promise<RenderedPage> {
    const cached = this.cached(issue, page, cssWidth);
    if (cached) {
      this.pages.get(this.pageKey(issue, page));
      return Promise.resolve(cached);
    }
    if (abort?.aborted) return Promise.reject(new RenderAbortedError());

    const width = this.renderWidth(cssWidth);
    const key = `${this.pageKey(issue, page)}@${width}`;
    let job = this.jobs.get(key);
    if (!job) {
      job = this.createJob(key, issue, page, width, priority);
      this.jobs.set(key, job);
      this.queue.push(job);
    } else if (!job.started) {
      if (priority === 'high') job.priority = 'high';
      job.seq = ++this.seq;
    }
    job.waiters++;

    const current = job;
    abort?.addEventListener(
      'abort',
      () => {
        current.waiters--;
        if (current.waiters <= 0 && !current.started) {
          this.jobs.delete(current.key);
          const index = this.queue.indexOf(current);
          if (index >= 0) this.queue.splice(index, 1);
          current.reject(new RenderAbortedError());
        }
      },
      { once: true },
    );

    this.pump();
    return job.promise;
  }

  private createJob(
    key: string,
    issue: Issue,
    page: number,
    width: number,
    priority: RenderPriority,
  ): RenderJob {
    let resolve!: (page: RenderedPage) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<RenderedPage>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    promise.catch(() => {});
    return {
      key,
      issue,
      page,
      width,
      promise,
      resolve,
      reject,
      priority,
      seq: ++this.seq,
      waiters: 0,
      started: false,
    };
  }

  private pump(): void {
    if (this.freeSlots.length === 0) return;
    const ordered = [...this.queue].sort(compareJobs);
    for (const job of ordered) {
      if (this.freeSlots.length === 0) break;
      const slot = this.pickSlot(job.issue);
      if (slot === null) continue;
      this.queue.splice(this.queue.indexOf(job), 1);
      job.started = true;
      this.draw(job, slot)
        .then(job.resolve, job.reject)
        .finally(() => {
          this.jobs.delete(job.key);
          this.freeSlots.push(slot);
          this.pump();
        });
    }
  }

  private pickSlot(issue: Issue): number | null {
    const entry = this.docs.peek(issue.id);
    const extraSlotsAllowed = entry?.bytesReady ?? false;
    const index = this.freeSlots.findIndex((slot) => slot === 0 || extraSlotsAllowed);
    return index < 0 ? null : this.freeSlots.splice(index, 1)[0];
  }

  private async draw(job: RenderJob, slot: number): Promise<RenderedPage> {
    const doc = await this.entry(job.issue).slot(slot);
    const page = await doc.getPage(job.page);
    const canvas = document.createElement('canvas');
    try {
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: job.width / base.width });
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      await page.render({ canvas, viewport, background: '#ffffff' }).promise;
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Could not encode page'))),
          'image/jpeg',
          JPEG_QUALITY,
        ),
      );
      const rendered: RenderedPage = { url: URL.createObjectURL(blob), width: job.width };
      const key = this.pageKey(job.issue, job.page);
      const previous = this.pages.peek(key);
      if (previous && previous.width > job.width) {
        URL.revokeObjectURL(rendered.url);
        return previous;
      }
      this.pages.set(key, rendered);
      return rendered;
    } finally {
      canvas.width = 0;
      canvas.height = 0;
      page.cleanup();
    }
  }

  private entry(issue: Issue, touch = true): DocEntry {
    const existing = touch ? this.docs.get(issue.id) : this.docs.peek(issue.id);
    if (existing) return existing;

    const progress = signal(0);
    const tasks: PDFDocumentLoadingTask[] = [];
    const slots = new Map<number, Promise<PDFDocumentProxy>>();
    let bytes: Promise<Uint8Array> | undefined;
    let destroyed = false;

    const load = async (slot: number, source: DocumentSource): Promise<PDFDocumentProxy> => {
      const lib = await this.lib();
      if (destroyed) throw new Error('Document was released before it loaded');
      const task = lib.getDocument({
        ...source,
        worker: this.worker(lib, slot),
        wasmUrl: resolveUrl('pdfjs/wasm/'),
        standardFontDataUrl: resolveUrl('pdfjs/standard_fonts/'),
        cMapUrl: resolveUrl('pdfjs/cmaps/'),
        cMapPacked: true,
        enableXfa: false,
      });
      tasks.push(task);
      if (slot === 0) {
        task.onProgress = ({ loaded, total }: { loaded: number; total: number }) => {
          const size = total || issue.size;
          if (size > 0) progress.set(Math.min(1, loaded / size));
        };
      }
      return task.promise;
    };

    const primary = load(0, { url: this.library.pdfUrl(issue), rangeChunkSize: 1 << 19 }).then(
      (doc) => {
        progress.set(1);
        bytes = doc.getData();
        bytes.then(
          () => {
            entry.bytesReady = true;
            this.pump();
          },
          () => {},
        );
        return doc;
      },
      (error: unknown) => {
        if (this.docs.peek(issue.id) === entry) this.docs.delete(issue.id);
        throw error;
      },
    );

    const entry: DocEntry = {
      primary,
      progress,
      bytesReady: false,
      slot: (index) => {
        if (index === 0 || !bytes) return primary;
        let doc = slots.get(index);
        if (!doc) {
          doc = bytes.then((data) => load(index, { data: data.slice() }));
          doc.catch(() => slots.delete(index));
          slots.set(index, doc);
        }
        return doc;
      },
      destroy: () => {
        destroyed = true;
        for (const task of tasks) void task.destroy();
      },
    };
    this.docs.set(issue.id, entry);
    return entry;
  }

  private worker(lib: PdfJs, slot: number): PDFWorker {
    return (this.workers[slot] ??= new lib.PDFWorker());
  }

  private lib(): Promise<PdfJs> {
    return (this.pdfjs ??= import('pdfjs-dist/legacy/build/pdf.mjs').then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = resolveUrl('pdfjs/pdf.worker.min.mjs');
      return lib;
    }));
  }

  private pageKey(issue: Issue, page: number): string {
    return `${issue.id}:${page}`;
  }
}

function compareJobs(a: RenderJob, b: RenderJob): number {
  if (a.priority !== b.priority) return a.priority === 'high' ? -1 : 1;
  return a.priority === 'high' ? b.seq - a.seq : a.seq - b.seq;
}
