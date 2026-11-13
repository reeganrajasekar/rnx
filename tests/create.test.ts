import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { initArgs } from '../packages/cli/src/create.js';
const dirs: string[] = [];
afterEach(() => { for (const root of dirs.splice(0)) rmSync(root, { recursive: true, force: true }); });
it('pins a compatible Community CLI for an explicit React Native version', () => {
  const root = mkdtempSync(join(tmpdir(), 'rnx-create-')); dirs.push(root);
  const args = initArgs('MyApp', { version: '0.80.0', directory: join(root, 'MyApp') });
  expect(args).toContain('@react-native-community/cli@19');
  expect(args).toContain('--skip-install');
  expect(args).toContain('0.80.0');
});
it('refuses unsafe names, existing destinations and unknown compatibility combinations', () => {
  expect(() => initArgs('../app', {})).toThrow('project name');
  expect(() => initArgs('MyApp', { directory: process.cwd() })).toThrow('already exists');
  expect(() => initArgs('MyApp', { version: '0.999.0' })).toThrow('--cli-version');
});
