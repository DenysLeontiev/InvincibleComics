import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parentPort } from 'node:worker_threads';

import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PDFJS_DIR = path.join(ROOT, 'node_modules', 'pdfjs-dist');
const asDirUrl = (dir) => pathToFileURL(path.join(PDFJS_DIR, dir) + path.sep).href;

async function renderCover({ pdfPath, coverPath, coverWidth }) {
  const data = new Uint8Array(await readFile(pdfPath));
  const task = getDocument({
    data,
    standardFontDataUrl: asDirUrl('standard_fonts'),
    wasmUrl: asDirUrl('wasm'),
    verbosity: 0,
  });
  const doc = await task.promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: coverWidth / base.width });
    const { canvas, context } = doc.canvasFactory.create(
      Math.round(viewport.width),
      Math.round(viewport.height),
    );
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    await writeFile(coverPath, await canvas.encode('webp', 82));

    const ratios = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const p = i === 1 ? page : await doc.getPage(i);
      const v = p.getViewport({ scale: 1 });
      ratios.push(Math.round((v.width / v.height) * 1000) / 1000);
    }
    return { pages: doc.numPages, ratios };
  } finally {
    await task.destroy();
  }
}

parentPort.on('message', async (job) => {
  try {
    parentPort.postMessage({ id: job.id, ok: true, ...(await renderCover(job)) });
  } catch (error) {
    parentPort.postMessage({ id: job.id, ok: false, error: String(error?.message ?? error) });
  }
});
