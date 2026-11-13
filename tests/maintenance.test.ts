import { existsSync, mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { cleanPaths } from '../packages/cli/src/maintenance.js';
const dirs: string[] = [];
function fixture() { const root = mkdtempSync(join(tmpdir(), 'rnx-clean-')); dirs.push(root); return root; }
afterEach(() => { for (const root of dirs.splice(0)) rmSync(root, { recursive: true, force: true }); });
it('limits cleanup to generated build/cache directories and preserves dependencies and signing files', () => {
  const root = fixture(); mkdirSync(join(root, 'android/app/build'), { recursive: true }); mkdirSync(join(root, 'ios/Pods'), { recursive: true });
  mkdirSync(join(root, 'node_modules')); writeFileSync(join(root, 'android/signing.keystore'), 'secret');
  expect(cleanPaths(root, 'all')).toEqual([join(root, 'android/app/build')]);
  expect(existsSync(join(root, 'ios/Pods'))).toBe(true);
});
it('rejects cleanup paths redirected through a directory junction or symlink', () => {
  const root = fixture(); const outside = fixture(); mkdirSync(join(root, 'android')); mkdirSync(join(outside, 'build'));
  symlinkSync(outside, join(root, 'android/app'), process.platform === 'win32' ? 'junction' : 'dir');
  expect(() => cleanPaths(root, 'android')).toThrow('outside the project');
});
