import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../packages/cli/src/create.js', () => ({ createProject: vi.fn().mockResolvedValue(0) }));
vi.mock('../packages/cli/src/run.js', () => ({ run: vi.fn().mockResolvedValue(0), resolvePlatform: vi.fn() }));
vi.mock('../packages/cli/src/boom.js', () => ({ boom: vi.fn().mockResolvedValue(1) }));
import { createProgram } from '../packages/cli/src/cli.js';
import { createProject } from '../packages/cli/src/create.js';
import { run } from '../packages/cli/src/run.js';
import { boom } from '../packages/cli/src/boom.js';
afterEach(() => { process.exitCode = 0; vi.clearAllMocks(); });
it('keeps the create React Native version separate from the RNX version flag', async () => {
  await createProgram().exitOverride().parseAsync(['node', 'rnx', 'create', 'MyApp', '--version', '0.85.0', '--no-install', '--no-git', '--pm', 'pnpm']);
  expect(createProject).toHaveBeenCalledWith('MyApp', expect.objectContaining({ version: '0.85.0', install: false, git: false, pm: 'pnpm' }));
});
it('forwards additional native flags after -- while preserving RNX options', async () => {
  await createProgram().exitOverride().parseAsync(['node', 'rnx', 'run', 'ios', '--device', 'phone', '--', '--force-pods']);
  expect(run).toHaveBeenCalledWith('ios', expect.objectContaining({ device: 'phone' }), ['--force-pods']);
});
it('runs boom and preserves its exit code', async () => {
  await createProgram().exitOverride().parseAsync(['node', 'rnx', 'boom']);
  expect(boom).toHaveBeenCalledOnce();
  expect(process.exitCode).toBe(1);
});
