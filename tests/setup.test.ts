import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../packages/cli/src/process.js', () => ({ execute: vi.fn(), capture: vi.fn(), requireMac: vi.fn() }));
import { execute } from '../packages/cli/src/process.js';
import { installPods } from '../packages/cli/src/setup.js';
let root: string;
beforeEach(() => { vi.resetAllMocks(); root = mkdtempSync(join(tmpdir(), 'rnx-pods-')); mkdirSync(join(root, 'ios')); writeFileSync(join(root, 'ios/Podfile'), ''); writeFileSync(join(root, 'Gemfile'), ''); });
afterEach(() => rmSync(root, { recursive: true, force: true }));
it('uses the project Gemfile to install CocoaPods rather than global gem versions', async () => {
  vi.mocked(execute).mockResolvedValue(0);
  expect(await installPods(root)).toBe(0);
  expect(execute).toHaveBeenNthCalledWith(1, 'bundle', ['install'], root);
  expect(execute).toHaveBeenNthCalledWith(2, 'bundle', ['exec', 'pod', 'install'], join(root, 'ios'));
});
it('stops when Ruby dependency installation fails', async () => {
  vi.mocked(execute).mockResolvedValue(5);
  expect(await installPods(root)).toBe(5);
  expect(execute).toHaveBeenCalledTimes(1);
});
