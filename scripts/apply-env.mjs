import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

const root = resolve(import.meta.dirname, '..');
const outDir = resolve(root, 'dist/InvincibleComicsReader/browser');
const envFile = resolve(root, '.env');

const fileEnv = existsSync(envFile) ? parseEnv(await readFile(envFile, 'utf8')) : {};
const value = (name) => (process.env[name] || fileEnv[name] || '').trim();

const tagId = value('GOOGLE_TAG_ID');
const libraryBaseUrl = value('LIBRARY_BASE_URL');

if (tagId && !/^(G|GT|GTM)-[A-Z0-9]+$/i.test(tagId)) {
  console.error(`GOOGLE_TAG_ID "${tagId}" is not a Google tag ID (G-XXXX, GT-XXXX or GTM-XXXX).`);
  process.exit(1);
}

const escape = (text) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const setMeta = (html, name, content) => {
  const pattern = new RegExp(`<meta name="${name}" content(?:="[^"]*")?>`);
  if (!pattern.test(html)) throw new Error(`index.html has no <meta name="${name}"> tag`);
  return html.replace(pattern, `<meta name="${name}" content="${escape(content)}">`);
};

const indexPath = resolve(outDir, 'index.html');
let html = await readFile(indexPath, 'utf8');
html = setMeta(html, 'google-tag-id', tagId);
html = setMeta(html, 'library-base-url', libraryBaseUrl || 'library/');
await writeFile(indexPath, html);
await copyFile(indexPath, resolve(outDir, '404.html'));

console.log(`Google Analytics: ${tagId || 'off'}`);
console.log(`Comic library: ${libraryBaseUrl || 'library/ (bundled)'}`);
