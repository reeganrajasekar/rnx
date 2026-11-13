import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { detectPackageManager, packageArgs, validatePackages } from '../packages/cli/src/packages.js';
const dirs: string[] = [];
function fixture() { const root = mkdtempSync(join(tmpdir(), 'rnx-pm-')); dirs.push(root); return root; }
afterEach(() => { for (const root of dirs.splice(0)) rmSync(root, { recursive: true, force: true }); });
it('uses the workspace package-manager declaration from a nested project', () => {
  const root = fixture(); mkdirSync(join(root, 'app'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ packageManager: 'pnpm@10.20.0' }));
  expect(detectPackageManager(join(root, 'app'))).toBe('pnpm');
});
it('refuses conflicting lockfiles rather than modifying the wrong dependency graph', () => {
  const root = fixture(); writeFileSync(join(root, 'yarn.lock'), ''); writeFileSync(join(root, 'package-lock.json'), '{}');
  expect(() => detectPackageManager(root)).toThrow('Multiple');
});
it('uses npm dev dependencies and Yarn removal semantics without a shell', () => {
  expect(packageArgs('npm', 'add', ['@scope/package@1.0.0'], true)).toEqual(['install', '@scope/package@1.0.0', '--save-dev']);
  expect(packageArgs('yarn', 'remove', ['old-package'])).toEqual(['remove', 'old-package']);
  expect(() => validatePackages(['--global'])).toThrow('not command options');
});

it('updates Bun dependencies without upgrading the runtime and supports modern Yarn resolution updates', () => {
  expect(packageArgs('bun', 'upgrade')).toEqual(['update']);
  expect(packageArgs('yarn', 'upgrade', ['example'], false, 4)).toEqual(['up', '-R', 'example']);
});
