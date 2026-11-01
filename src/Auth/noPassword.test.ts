import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Sign-in is by emailed code only. No source file may bring back a password field or a forgot/reset flow. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

describe('no password UI anywhere in the web app', () => {
  const files = sourceFiles(join(process.cwd(), 'src'));

  it('scans the source tree', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('has no password input, forgot-password link or reset-password flow', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const text = readFileSync(f, 'utf8');
      if (/type\s*=\s*["']password["']|forgot|reset[\s-]?password|resetPassword|new password|confirm password/i.test(text)) {
        offenders.push(f);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('has no age field or age state anywhere (the date of birth is the only input)', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const text = readFileSync(f, 'utf8');
      if (/age/i.test(text)) offenders.push(f);
    }
    expect(offenders).toEqual([]);
  });
});
