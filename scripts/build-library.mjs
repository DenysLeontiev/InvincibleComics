#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, link, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COMICS_DIR = path.resolve(process.env.COMICS_DIR ?? 'C:\\invincible comics');
const OUT_DIR = path.join(ROOT, 'public', 'library');
const ISSUES_DIR = path.join(OUT_DIR, 'issues');
const COVERS_DIR = path.join(OUT_DIR, 'covers');
const MANIFEST = path.join(OUT_DIR, 'library.json');
const COVER_WIDTH = 480;
const CONCURRENCY = Math.max(1, Math.min(8, os.availableParallelism() - 2));

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

async function exposePdf(source, target) {
  if (existsSync(target)) {
    const [s, t] = await Promise.all([stat(source), stat(target)]);
    if (s.size === t.size && t.mtimeMs >= s.mtimeMs - 1000) return;
    await rm(target);
  }
  try {
    await link(source, target);
  } catch {
    await copyFile(source, target);
  }
}

class CoverPool {
  #idle = [];
  #queue = [];
  #pending = new Map();
  #nextId = 0;
  #workers = [];

  constructor(size) {
    for (let i = 0; i < size; i++) {
      const worker = new Worker(new URL('./render-cover.worker.mjs', import.meta.url));
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

  render(pdfPath, coverPath) {
    return new Promise((resolve, reject) => {
      this.#queue.push({ id: this.#nextId++, pdfPath, coverPath, coverWidth: COVER_WIDTH, resolve, reject });
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

async function processIssue(entry, previous, pool) {
  const source = path.join(COMICS_DIR, entry.fileName);
  const pdfTarget = path.join(ISSUES_DIR, `${entry.id}.pdf`);
  const coverTarget = path.join(COVERS_DIR, `${entry.id}.webp`);
  const info = await stat(source);
  const fingerprint = createHash('sha1')
    .update(`${entry.fileName}|${info.size}|${Math.round(info.mtimeMs)}`)
    .digest('hex')
    .slice(0, 12);

  await exposePdf(source, pdfTarget);

  const prev = previous.get(entry.id);
  let pages = prev?.pages;
  let ratios = prev?.ratios;
  if (!prev || prev.fingerprint !== fingerprint || !existsSync(coverTarget) || !ratios) {
    ({ pages, ratios } = await pool.render(source, coverTarget));
  }

  return {
    id: entry.id,
    number: entry.number,
    year: entry.year,
    variantCovers: entry.variantCovers,
    pages,
    ratios,
    size: info.size,
    fingerprint,
    file: `issues/${entry.id}.pdf`,
    cover: `covers/${entry.id}.webp?v=${fingerprint}`,
  };
}

async function main() {
  if (!existsSync(COMICS_DIR)) {
    console.error(`Comics folder not found: ${COMICS_DIR}\nSet COMICS_DIR to the folder with the PDFs.`);
    process.exit(1);
  }
  await mkdir(ISSUES_DIR, { recursive: true });
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

  async function worker() {
    while (cursor < entries.length) {
      const index = cursor++;
      const entry = entries[index];
      try {
        results[index] = await processIssue(entry, previous, pool);
      } catch (error) {
        console.error(`  failed: ${entry.fileName}\n    ${error?.message ?? error}`);
      }
      done++;
      process.stdout.write(`\r  ${done}/${entries.length} issues processed`);
    }
  }
  console.log(`Building library from ${COMICS_DIR} (${CONCURRENCY} threads)`);
  const pool = new CoverPool(CONCURRENCY);
  try {
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  } finally {
    await pool.close();
  }
  process.stdout.write('\n');

  const issues = results.filter(Boolean);
  const manifest = {
    version: 1,
    series: 'Invincible',
    publisher: 'Image Comics',
    generatedAt: new Date().toISOString(),
    issues,
  };
  await writeFile(MANIFEST, JSON.stringify(manifest));

  const valid = new Set(entries.map((e) => e.id));
  for (const [dir, ext] of [
    [ISSUES_DIR, '.pdf'],
    [COVERS_DIR, '.webp'],
  ]) {
    for (const f of await readdir(dir)) {
      if (!valid.has(path.basename(f, ext))) await rm(path.join(dir, f));
    }
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`Library ready: ${issues.length} issues in ${seconds}s -> ${path.relative(ROOT, MANIFEST)}`);
}

await main();
