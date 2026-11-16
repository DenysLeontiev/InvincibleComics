import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parentPort } from 'node:worker_threads';

import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PDFJS_DIR = path.join(ROOT, 'node_modules', 'pdfjs-dist');
const asDirUrl = (dir) => pathToFileURL(path.join(PDFJS_DIR, dir) + path.sep).href;

const pageFileName = (page) => `${String(page).padStart(3, '0')}.webp`;

async function encode(doc, page, scale, quality) {
  const viewport = page.getViewport({ scale });
  const { canvas, context } = doc.canvasFactory.create(
    Math.round(viewport.width),
    Math.round(viewport.height),
  );
  await page.render({ canvas, canvasContext: context, viewport, background: '#ffffff' }).promise;
  return canvas.encode('webp', quality);
}

async function renderIssue({ pdfPath, pagesDir, coverPath, coverWidth, pageHeight, pageQuality, coverQuality }) {
  const data = new Uint8Array(await readFile(pdfPath));
  const task = getDocument({
    data,
    standardFontDataUrl: asDirUrl('standard_fonts'),
    wasmUrl: asDirUrl('wasm'),
    verbosity: 0,
  });
  const doc = await task.promise;
  try {
    const partialDir = `${pagesDir}.partial`;
    await rm(partialDir, { recursive: true, force: true });
    await mkdir(partialDir, { recursive: true });

    const ratios = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const base = page.getViewport({ scale: 1 });
      ratios.push(Math.round((base.width / base.height) * 1000) / 1000);
      if (i === 1) await writeFile(coverPath, await encode(doc, page, coverWidth / base.width, coverQuality));
      await writeFile(path.join(partialDir, pageFileName(i)), await encode(doc, page, pageHeight / base.height, pageQuality));
      page.cleanup();
    }
    await rm(pagesDir, { recursive: true, force: true });
    await rename(partialDir, pagesDir);
    return { pages: doc.numPages, ratios };
  } finally {
    await task.destroy();
  }
}

parentPort.on('message', async (job) => {
  try {
    parentPort.postMessage({ id: job.id, ok: true, ...(await renderIssue(job)) });
  } catch (error) {
    parentPort.postMessage({ id: job.id, ok: false, error: String(error?.message ?? error) });
  }
});
