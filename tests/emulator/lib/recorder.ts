import type { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Records an end-to-end test as an auditable sequence of steps, each with a
 * screenshot, so the run can be turned into a self-contained PDF report and
 * re-executed by hand.
 *
 * One directory per test under tests/emulator/artifacts/<slug>/, containing the
 * PNGs plus a steps.json manifest. scripts/build-test-report.ts turns those into
 * PDFs.
 */

export interface RecordedStep {
  n: number;
  title: string;
  detail?: string;
  screenshot?: string;
  /** 'pass' for a normal step, 'assert' where an expectation was checked. */
  kind: 'action' | 'assert';
  at: string;
}

export interface TestRecord {
  slug: string;
  title: string;
  area: string;
  purpose: string;
  /** Manual reproduction steps, so a human can walk the same path. */
  reproduce: string[];
  steps: RecordedStep[];
  startedAt: string;
  finishedAt?: string;
  status?: 'passed' | 'failed';
  error?: string;
}

const ROOT = path.resolve(process.cwd(), 'tests/emulator/artifacts');

export class Recorder {
  private rec: TestRecord;
  private dir: string;
  private n = 0;

  constructor(opts: { slug: string; title: string; area: string; purpose: string; reproduce: string[] }) {
    this.rec = { ...opts, steps: [], startedAt: new Date().toISOString() };
    this.dir = path.join(ROOT, opts.slug);
    fs.rmSync(this.dir, { recursive: true, force: true });
    fs.mkdirSync(this.dir, { recursive: true });
  }

  /**
   * Capture a step. Screenshots are viewport-sized rather than fullPage: these
   * are embedded base64 in a PDF, and full-page captures of long admin tables
   * produced multi-megabyte pages for no extra information.
   */
  async step(page: Page, title: string, detail?: string, kind: 'action' | 'assert' = 'action'): Promise<void> {
    this.n += 1;
    const file = `${String(this.n).padStart(2, '0')}.png`;
    await page.screenshot({ path: path.join(this.dir, file) }).catch(() => {});
    this.rec.steps.push({ n: this.n, title, detail, screenshot: file, kind, at: new Date().toISOString() });
    // eslint-disable-next-line no-console
    console.log(`    ${String(this.n).padStart(2, '0')}. ${kind === 'assert' ? '✓ ' : ''}${title}`);
  }

  /** A step with no screenshot — for assertions about data rather than pixels. */
  note(title: string, detail?: string): void {
    this.n += 1;
    this.rec.steps.push({ n: this.n, title, detail, kind: 'assert', at: new Date().toISOString() });
    // eslint-disable-next-line no-console
    console.log(`    ${String(this.n).padStart(2, '0')}. ✓ ${title}`);
  }

  finish(status: 'passed' | 'failed', error?: string): void {
    this.rec.finishedAt = new Date().toISOString();
    this.rec.status = status;
    this.rec.error = error;
    fs.writeFileSync(path.join(this.dir, 'steps.json'), JSON.stringify(this.rec, null, 2));
  }
}
