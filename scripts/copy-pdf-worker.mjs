#!/usr/bin/env node
/**
 * Copy PDF.js worker into /public so it can be loaded at runtime.
 *
 * pdfjs-dist v5 expects GlobalWorkerOptions.workerSrc to point to a real
 * module worker URL. Next.js does not automatically serve files from
 * node_modules, so we vendor the worker into /public/workers.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceFile = path.join(
  __dirname,
  "../node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
);
const destinationDir = path.join(__dirname, "../public/workers");
const destinationFile = path.join(destinationDir, "pdf.worker.min.mjs");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function needsCopy(src, dest) {
  if (!fs.existsSync(dest)) return true;
  const srcStat = fs.statSync(src);
  const destStat = fs.statSync(dest);
  return srcStat.mtimeMs > destStat.mtimeMs || srcStat.size !== destStat.size;
}

function copyWorker() {
  if (!fs.existsSync(sourceFile)) {
    console.error(
      `PDF.js worker not found at ${sourceFile}. Did you run npm install?`,
    );
    process.exit(1);
  }

  ensureDir(destinationDir);

  if (!needsCopy(sourceFile, destinationFile)) {
    return;
  }

  fs.copyFileSync(sourceFile, destinationFile);
  console.log(`Copied PDF.js worker -> ${path.relative(process.cwd(), destinationFile)}`);
}

copyWorker();

