#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COMICS_DIR = path.resolve(process.env.COMICS_DIR ?? 'C:\\invincible comics');
const OUT_DIR = path.join(ROOT, 'public', 'library');
const LEGACY_ISSUES_DIR = path.join(OUT_DIR, 'issues');
const PAGES_DIR = path.join(OUT_DIR, 'pages');
const COVERS_DIR = path.join(OUT_DIR, 'covers');
const MANIFEST = path.join(OUT_DIR, 'library.json');
const COVER_WIDTH = 480;
const COVER_QUALITY = 82;
const PAGE_HEIGHT = 1600;
const PAGE_QUALITY = 75;
const RENDER_VERSION = `${PAGE_HEIGHT}q${PAGE_QUALITY}`;
const CONCURRENCY = Math.max(1, os.availableParallelism() - 2);

const FILE_PATTERN = /^Invincible\s+(\d{1,4})\s*\((\d{4})\)(.*)\.pdf$/i;

function parseFileName(fileName) {
  const match = FILE_PATTERN.exec(fileName);
  if (!match) return null;
  const [, num, year, rest] = match;
  const number = Number.parseInt(num, 10);
  const covers = /\((\d+)\s+covers?\)/i.exec(rest);
  return {
    id: `invincible-${String(number).padStart(3, '0')}`,
    number,
    year: Number.parseInt(year, 10),
    variantCovers: covers ? Number.parseInt(covers[1], 10) : 1,
  };
}

async function readPreviousManifest() {
  try {
    const data = JSON.parse(await readFile(MANIFEST, 'utf8'));
    return new Map(data.issues.map((i) => [i.id, i]));
  } catch {
    return new Map();
  }
}

class RenderPool {
  #idle = [];
  #queue = [];
  #pending = new Map();
  #nextId = 0;
  #workers = [];

  constructor(size) {
    for (let i = 0; i < size; i++) {
      const worker = new Worker(new URL('./render-issue.worker.mjs', import.meta.url));
      worker.on('message', ({ id, ok, error, ...result }) => {
        const job = this.#pending.get(id);
        this.#pending.delete(id);
        if (ok) job.resolve(result);
        else job.reject(new Error(error));
        this.#idle.push(worker);
        this.#drain();
      });
      this.#workers.push(worker);
      this.#idle.push(worker);
    }
  }

  render(pdfPath, pagesDir, coverPath) {
    return new Promise((resolve, reject) => {
      this.#queue.push({
        id: this.#nextId++,
        pdfPath,
        pagesDir,
        coverPath,
        coverWidth: COVER_WIDTH,
        coverQuality: COVER_QUALITY,
        pageHeight: PAGE_HEIGHT,
        pageQuality: PAGE_QUALITY,
        resolve,
        reject,
      });
      this.#drain();
    });
  }

  #drain() {
    while (this.#idle.length && this.#queue.length) {
      const worker = this.#idle.pop();
      const { resolve, reject, ...job } = this.#queue.shift();
      this.#pending.set(job.id, { resolve, reject });
      worker.postMessage(job);
    }
  }

  async close() {
    await Promise.all(this.#workers.map((w) => w.terminate()));
  }
}

async function countFiles(dir) {
  try {
    return (await readdir(dir)).length;
  } catch {
    return -1;
  }
}

function writeManifest(issues) {
  const manifest = {
    version: 2,
    series: 'Invincible',
    publisher: 'Image Comics',
    generatedAt: new Date().toISOString(),
    issues,
  };
  return writeFile(MANIFEST, JSON.stringify(manifest));
}

async function processIssue(entry, previous, pool) {
  const source = path.join(COMICS_DIR, entry.fileName);
  const pagesDir = path.join(PAGES_DIR, entry.id);
  const coverTarget = path.join(COVERS_DIR, `${entry.id}.webp`);
  const info = await stat(source);
  const fingerprint = createHash('sha1')
    .update(`${entry.fileName}|${info.size}|${Math.round(info.mtimeMs)}|${RENDER_VERSION}`)
    .digest('hex')
    .slice(0, 12);

  const prev = previous.get(entry.id);
  let pages = prev?.pages;
  let ratios = prev?.ratios;
  const upToDate =
    prev?.fingerprint === fingerprint &&
    ratios &&
    existsSync(coverTarget) &&
    (await countFiles(pagesDir)) === pages;
  if (!upToDate) ({ pages, ratios } = await pool.render(source, pagesDir, coverTarget));

  return {
    id: entry.id,
    number: entry.number,
    year: entry.year,
    variantCovers: entry.variantCovers,
    pages,
    ratios,
    fingerprint,
    pagesPath: `pages/${entry.id}/`,
    cover: `covers/${entry.id}.webp?v=${fingerprint}`,
  };
}

async function main() {
  if (!existsSync(COMICS_DIR)) {
    console.error(`Comics folder not found: ${COMICS_DIR}\nSet COMICS_DIR to the folder with the PDFs.`);
    process.exit(1);
  }
  await rm(LEGACY_ISSUES_DIR, { recursive: true, force: true });
  await mkdir(PAGES_DIR, { recursive: true });
  await mkdir(COVERS_DIR, { recursive: true });

  const files = (await readdir(COMICS_DIR)).filter((f) => f.toLowerCase().endsWith('.pdf'));
  const entries = [];
  for (const fileName of files) {
    const parsed = parseFileName(fileName);
    if (!parsed) {
      console.warn(`  skipped (unrecognised name): ${fileName}`);
      continue;
    }
    entries.push({ ...parsed, fileName });
  }
  entries.sort((a, b) => a.number - b.number);

  const previous = await readPreviousManifest();
  const results = new Array(entries.length);
  let cursor = 0;
  let done = 0;
  const started = Date.now();
  let saving = Promise.resolve();
  const checkpoint = () => {
    const issues = entries.map((e, i) => results[i] ?? previous.get(e.id)).filter(Boolean);
    saving = saving.then(() => writeManifest(issues));
    return saving;
  };

  async function worker() {
    while (cursor < entries.length) {
      const index = cursor++;
      const entry = entries[index];
      try {
        results[index] = await processIssue(entry, previous, pool);
        await checkpoint();
      } catch (error) {
        console.error(`  failed: ${entry.fileName}\n    ${error?.message ?? error}`);
      }
      done++;
      process.stdout.write(`\r  ${done}/${entries.length} issues processed`);
    }
  }
  console.log(`Building library from ${COMICS_DIR} (${CONCURRENCY} threads)`);
  const pool = new RenderPool(CONCURRENCY);
  try {
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  } finally {
    await pool.close();
  }
  process.stdout.write('\n');

  await saving;
  const issues = results.filter(Boolean);
  await writeManifest(issues);

  const valid = new Set(entries.map((e) => e.id));
  for (const f of await readdir(COVERS_DIR)) {
    if (!valid.has(path.basename(f, '.webp'))) await rm(path.join(COVERS_DIR, f));
  }
  for (const f of await readdir(PAGES_DIR)) {
    if (!valid.has(f)) await rm(path.join(PAGES_DIR, f), { recursive: true, force: true });
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`Library ready: ${issues.length} issues in ${seconds}s -> ${path.relative(ROOT, MANIFEST)}`);
}

await main();
