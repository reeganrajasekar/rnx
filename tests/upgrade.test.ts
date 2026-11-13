import { expect, it } from 'vitest';
import { newestStableVersions } from '../packages/cli/src/versions.js';
import { upgradedManifest } from '../packages/cli/src/upgrade.js';

it('shows the newest stable patch of each minor, ignoring prereleases', () => {
  expect(newestStableVersions(['0.87.1', '0.88.0-rc.1', '0.88.0', '0.87.3', '0.88.1', 'nightly'])).toEqual(['0.88.1', '0.87.3']);
});
it('updates only installed React Native core dependencies and preserves app packages', () => {
  const current = { dependencies: { react: '18.0.0', 'react-native': '0.80.0', 'my-app-lib': '^1.0.0' }, devDependencies: { '@react-native/metro-config': '0.80.0', typescript: '^5.0.0' } };
  const template = { dependencies: { react: '19.3.0', 'react-native': '0.88.1', 'my-app-lib': '^3.0.0' }, devDependencies: { '@react-native/metro-config': '0.88.1', typescript: '^6.0.0' } };
  const { manifest, changes } = upgradedManifest(current, template);
  expect(manifest.dependencies).toEqual({ react: '19.3.0', 'react-native': '0.88.1', 'my-app-lib': '^1.0.0' });
  expect(manifest.devDependencies.typescript).toBe('^5.0.0');
  expect(changes).toHaveLength(3);
});
