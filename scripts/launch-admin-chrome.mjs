import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const sourceProfile = 'C:/Users/91779/AppData/Local/Google/Chrome/User Data/Default';
const copyProfile = 'C:/Users/91779/tresor-admin-chrome-profile-copy';
const chromeExe = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9223;

function copyRecursive(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  let entries = [];
  try {
    entries = fs.readdirSync(src, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      try {
        fs.copyFileSync(srcPath, destPath, fs.constants.COPYFILE_FICLONE);
      } catch {
        // Skip locked/temp/protected files
      }
    }
  }
}

(async () => {
  console.log('Copying admin Chrome profile...');
  fs.rmSync(copyProfile, { recursive: true, force: true });
  copyRecursive(sourceProfile, copyProfile);
  console.log('Admin profile copied. Launching detached Chrome with CDP...');

  const chrome = spawn(chromeExe, [
    `--user-data-dir=${copyProfile}`,
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${port}`,
    '--no-sandbox',
    'https://tresorcouture.in',
  ], {
    detached: true,
    stdio: 'ignore',
  });

  chrome.unref();
  console.log(`Admin Chrome launched with CDP on port ${port} (pid ${chrome.pid}).`);
})();
