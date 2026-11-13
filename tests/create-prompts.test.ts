import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../packages/cli/node_modules/@clack/prompts', () => ({ text: vi.fn(), select: vi.fn(), isCancel: (value: unknown) => typeof value === 'symbol' }));
vi.mock('../packages/cli/src/process.js', () => ({ execute: vi.fn().mockResolvedValue(1), capture: vi.fn().mockResolvedValue('[\"0.87.0\",\"0.88.1\"]'), requireMac: vi.fn() }));
import * as prompts from '../packages/cli/node_modules/@clack/prompts';
import { createProject } from '../packages/cli/src/create.js';
import { execute } from '../packages/cli/src/process.js';
const stdinTTY = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');
const stdoutTTY = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
afterEach(() => {
  if (stdinTTY) Object.defineProperty(process.stdin, 'isTTY', stdinTTY); else delete (process.stdin as { isTTY?: boolean }).isTTY;
  if (stdoutTTY) Object.defineProperty(process.stdout, 'isTTY', stdoutTTY); else delete (process.stdout as { isTTY?: boolean }).isTTY;
  vi.clearAllMocks();
});
it('asks for a name, router, styling, store, and package manager in a terminal', async () => {
  Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
  Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
  vi.mocked(prompts.text).mockResolvedValueOnce('MyApp');
  vi.mocked(prompts.select).mockResolvedValueOnce('react-navigation').mockResolvedValueOnce('nativewind').mockResolvedValueOnce('zustand').mockResolvedValueOnce('0.88.1').mockResolvedValueOnce('pnpm');
  await createProject(undefined, {});
  expect(prompts.text).toHaveBeenCalledOnce();
  const versionPrompt = vi.mocked(prompts.select).mock.calls.find(([options]) => options.message === 'React Native version')?.[0];
  expect(versionPrompt?.options[0].label).toBe('Latest (0.88.1)');
  expect(vi.mocked(prompts.select).mock.calls.map(([options]) => options.message)).toEqual(['Router', 'Styling', 'State management', 'React Native version', 'Package manager']);
  expect(execute).toHaveBeenCalledOnce();
});
it('cancels before invoking the initializer', async () => {
  Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
  Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
  vi.mocked(prompts.select).mockResolvedValueOnce(Symbol('cancel'));
  await expect(createProject('MyApp', {})).rejects.toThrow('cancelled');
  expect(execute).not.toHaveBeenCalled();
});

