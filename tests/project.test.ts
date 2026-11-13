import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { findProject, resolveCommunityCli } from '../packages/cli/src/project.js';

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
function fixture() { const dir = mkdtempSync(join(tmpdir(), 'rnx-test-')); dirs.push(dir); return dir; }

describe('project discovery', () => {
  it('finds the nearest React Native manifest from a nested folder', () => {
    const dir = fixture();
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'sample', dependencies: { 'react-native': '0.80.0' } }));
    mkdirSync(join(dir, 'src', 'screens'), { recursive: true });
    writeFileSync(join(dir, 'src', 'package.json'), '{}');
    expect(findProject(join(dir, 'src', 'screens'))).toEqual({ root: dir, name: 'sample', reactNative: '0.80.0' });
    expect(resolveCommunityCli(findProject(dir)!)).toBeUndefined();
  });
  it('resolves the local Community CLI executable', () => {
    const dir = fixture();
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: { 'react-native': '*' } }));
    const cli = join(dir, 'node_modules', '@react-native-community', 'cli');
    mkdirSync(cli, { recursive: true });
    writeFileSync(join(cli, 'package.json'), JSON.stringify({ name: '@react-native-community/cli', bin: { 'rnc-cli': 'bin.js' } }));
    writeFileSync(join(cli, 'bin.js'), '');
    expect(resolveCommunityCli(findProject(dir)!)).toBe(join(cli, 'bin.js'));
  });
  it('does not treat unrelated packages as React Native projects', () => {
    const dir = fixture();
    writeFileSync(join(dir, 'package.json'), '{}');
    expect(findProject(dir)).toBeUndefined();
  });
});
