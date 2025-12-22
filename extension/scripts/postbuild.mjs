import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.cwd());
const dist = path.join(root, 'dist');

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function copyFile(src, dest) {
  await ensureDir(path.dirname(dest));
  await fs.copyFile(src, dest);
}

async function moveFile(src, dest) {
  await ensureDir(path.dirname(dest));
  await fs.copyFile(src, dest);
}

async function main() {
  // Copy manifest
  await copyFile(path.join(root, 'src', 'manifest.json'), path.join(dist, 'manifest.json'));

  // Copy icons referenced by manifest
  await copyFile(path.join(root, 'src', 'assets', 'icon16.png'), path.join(dist, 'assets', 'icon16.png'));
  await copyFile(path.join(root, 'src', 'assets', 'icon32.png'), path.join(dist, 'assets', 'icon32.png'));
  await copyFile(path.join(root, 'src', 'assets', 'icon128.png'), path.join(dist, 'assets', 'icon128.png'));

  // Move HTML into expected paths
  // Vite currently outputs HTML under dist/src/*
  const popupSrc = path.join(dist, 'src', 'popup', 'popup.html');
  const offscreenSrc = path.join(dist, 'src', 'offscreen', 'offscreen.html');

  await moveFile(popupSrc, path.join(dist, 'popup', 'popup.html'));
  await moveFile(offscreenSrc, path.join(dist, 'offscreen', 'offscreen.html'));

  // content-script output location differs by Vite versions; normalize to dist/content-script.js
  const cs1 = path.join(dist, 'content-script.js');
  const cs2 = path.join(dist, 'assets', 'content-script.js');
  try {
    await fs.access(cs1);
  } catch {
    try {
      await fs.access(cs2);
      await copyFile(cs2, cs1);
    } catch {
      // ignore
    }
  }
}

await main();
