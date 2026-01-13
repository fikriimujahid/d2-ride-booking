import fs from 'node:fs/promises';
import path from 'node:path';

const distDir = path.resolve(process.cwd(), 'dist');
const indexHtmlPath = path.join(distDir, 'index.html');
const notFoundHtmlPath = path.join(distDir, '404.html');

async function main() {
  // For S3 static website hosting, setting Error document to 404.html
  // allows SPA routes to load the app shell.
  const indexHtml = await fs.readFile(indexHtmlPath, 'utf8');
  await fs.writeFile(notFoundHtmlPath, indexHtml, 'utf8');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('postbuild-s3 failed', err);
  process.exit(1);
});
