import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function configureNativeWind(root: string): void {
  const manifestPath = join(root, "package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const nativeVersion = String(manifest.dependencies?.["react-native"] ?? "");
  const minor = Number(nativeVersion.match(/0\.(\d+)/)?.[1]);
  if (!Number.isFinite(minor) || minor < 76)
    throw new Error(`NativeWind starter requires React Native 0.76 or newer; found ${nativeVersion || "unknown"}.`);
  const expo = manifest.main === "expo-router/entry";
  const animation = minor >= 86
    ? { reanimated: "~4.7.1", worklets: "~0.13.0" }
    : minor >= 83
      ? { reanimated: "~4.6.0", worklets: "~0.12.0" }
      : minor >= 81
        ? { reanimated: "~4.3.0", worklets: "~0.8.0" }
        : { reanimated: "~3.17.5" };
  Object.assign(manifest.dependencies, {
    nativewind: "4.2.7",
    "react-native-reanimated": animation.reanimated,
    "react-native-safe-area-context": manifest.dependencies["react-native-safe-area-context"] ?? "^5.6.0",
    ...(animation.worklets ? { "react-native-worklets": animation.worklets } : {}),
  });
  manifest.devDependencies ??= {};
  Object.assign(manifest.devDependencies, { tailwindcss: "^3.4.17" });
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

  const babelPath = join(root, "babel.config.js");
  const babel = existsSync(babelPath) ? readFileSync(babelPath, "utf8") : "module.exports = { presets: ['module:@react-native/babel-preset'] };\n";
  const updatedBabel = expo
    ? babel.replace(/presets:\s*\[([^\]]*)\]/, "presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel']")
    : babel.replace(/presets:\s*\[([^\]]*)\]/, (_match, presets: string) => `presets: [${presets.trim().replace(/,\s*$/, "")}, 'nativewind/babel']`);
  if (updatedBabel === babel && !babel.includes("nativewind/babel"))
    throw new Error("Could not configure the template Babel presets for NativeWind.");
  const plugin = minor >= 81 ? "react-native-worklets/plugin" : "react-native-reanimated/plugin";
  const withPlugin = /plugins:\s*\[([^\]]*)\]/.test(updatedBabel)
    ? updatedBabel.replace(/plugins:\s*\[([^\]]*)\]/, (_match, plugins: string) => `plugins: [${plugins.trim().replace(/,\s*$/, "")}${plugins.trim() ? ", " : ""}'${plugin}']`)
    : updatedBabel.replace(/};\s*$/, `  plugins: ['${plugin}'],\n};\n`);
  writeFileSync(babelPath, withPlugin);

  writeFileSync(join(root, "tailwind.config.js"), `/** @type {import('tailwindcss').Config} */\nmodule.exports = {\n  content: ['./App.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],\n  presets: [require('nativewind/preset')],\n  theme: { extend: {} },\n  plugins: [],\n};\n`);
  writeFileSync(join(root, "global.css"), "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n");
  writeFileSync(join(root, "nativewind-env.d.ts"), "/// <reference types=\"nativewind/types\" />\n");

  const metroPath = join(root, "metro.config.js");
  const metro = existsSync(metroPath) ? readFileSync(metroPath, "utf8") : `const { getDefaultConfig, mergeConfig } = require('${expo ? "expo/metro-config" : "@react-native/metro-config"}');\n\nconst config = mergeConfig(getDefaultConfig(__dirname), {});\n\nmodule.exports = config;\n`;
  const withNativeWind = `const { withNativeWind } = require('nativewind/metro');\n`;
  const updatedMetro = metro.replace(/module\.exports\s*=\s*([^;]+);?\s*$/, (_match, config: string) => `module.exports = withNativeWind(${config.trim()}, { input: './global.css' });\n`);
  if (updatedMetro === metro && !metro.includes("withNativeWind"))
    throw new Error("Could not configure the template Metro config for NativeWind.");
  writeFileSync(metroPath, `${metro.includes("withNativeWind") ? "" : withNativeWind}${updatedMetro}`);

  const cssImport = expo ? "import '../../global.css';\n" : "import '../global.css';\n";
  const appPath = join(root, "src", "app", "_layout.tsx");
  const entryPath = existsSync(appPath) ? appPath : join(root, "src", "App.tsx");
  const app = readFileSync(entryPath, "utf8");
  if (!app.includes("global.css")) writeFileSync(entryPath, cssImport + app);
}
