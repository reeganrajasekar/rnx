import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function findActivity(dir: string): string | undefined {
  if (!existsSync(dir)) return undefined;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findActivity(path);
      if (found) return found;
    } else if (entry.name === "MainActivity.kt") return path;
  }
}

// These ranges follow react-native-screens' Fabric compatibility table.
export function screensVersion(spec: string): { version: string; factory: boolean } {
  const match = spec.match(/^(?:\^|~)?0\.(\d+)\.\d+$/);
  if (!match) throw new Error(`Cannot determine a supported React Native version from ${JSON.stringify(spec)}. Use an exact stable version.`);
  const minor = Number(match[1]);
  if (minor < 76 || minor > 88) throw new Error(`No verified React Navigation starter dependency mapping for React Native ${spec}; use a supported 0.76–0.88 release or choose --router none.`);
  if (minor === 76) return { version: "~4.4.0", factory: false };
  if (minor <= 78) return { version: "~4.9.0", factory: false };
  if (minor <= 80) return { version: "~4.14.0", factory: false };
  if (minor === 81) return { version: "~4.19.0", factory: false };
  if (minor <= 83) return { version: "~4.25.0", factory: false };
  if (minor <= 86) return { version: "~4.26.0", factory: true };
  if (minor === 87) return { version: "~4.27.0", factory: true };
  return { version: "~4.30.0", factory: true };
}

export function configureStarter(root: string, router: string, store: string, styling = "native"): void {
  const manifestPath = join(root, "package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const appPath = join(root, "App.tsx");
  const entryPath = join(root, "index.js");
  const expo = router === "expo-router";
  const expoLayout = join(root, "src", "app", "_layout.tsx");
  const expoIndex = join(root, "src", "app", "index.tsx");
  if (!existsSync(appPath)) throw new Error("The default template has no App.tsx. The project was left in place.");
  mkdirSync(join(root, "src"), { recursive: true });
  const registerInSrc = () => {
    if (!existsSync(entryPath)) throw new Error("The default template has no index.js entry point. The project was left in place.");
    const entry = readFileSync(entryPath, "utf8");
    if (!entry.includes("from './App'") && !entry.includes('from "./App"'))
      throw new Error("The default index.js does not import the root App component. The project was left in place.");
    writeFileSync(entryPath, entry.replace("from './App'", "from './src/App'").replace('from "./App"', 'from "./src/App"'));
  };
  if (router === "none" && store === "none") {
    const original = readFileSync(appPath, "utf8").replace(/(from\s+|import\s*|require\s*\(\s*|import\s*\(\s*)(["'])\.\//g, "$1$2../");
    writeFileSync(join(root, "src", "App.tsx"), original);
    registerInSrc();
    rmSync(appPath);
    return;
  }
  if (expo) mkdirSync(join(root, "src", "app"), { recursive: true });
  let activityPath: string | undefined;
  let activity = "";
  let androidManifest = "";
  const androidManifestPath = join(root, "android", "app", "src", "main", "AndroidManifest.xml");
  if (router === "react-navigation") {
    const rnVersion = String(manifest.dependencies?.["react-native"] ?? "");
    const screens = screensVersion(rnVersion);
    console.log(`React Native ${rnVersion}: selecting react-native-screens ${screens.version}.`);
    activityPath = findActivity(join(root, "android", "app", "src", "main", "java"));
    if (!activityPath || !existsSync(androidManifestPath)) throw new Error("Cannot find the default Android activity or manifest to configure React Navigation. The generated project was left in place.");
    activity = readFileSync(activityPath, "utf8");
    androidManifest = readFileSync(androidManifestPath, "utf8");
    if (!/^package .+$/m.test(activity) || !/class MainActivity\s*:\s*ReactActivity\(\)\s*\{/.test(activity) || !/<application(?:\s|>)/.test(androidManifest) || /onCreate\s*\(/.test(activity) || /android:enableOnBackInvokedCallback/.test(androidManifest)) throw new Error("The Android template differs from the expected default; configure React Navigation manually. The generated project was left in place.");
    activity = activity.replace(/^(package .+)$/m, `$1\n\nimport android.os.Bundle${screens.factory ? "\nimport com.swmansion.rnscreens.fragment.restoration.RNScreensFragmentFactory" : ""}`);
    const create = screens.factory ? "    supportFragmentManager.fragmentFactory = RNScreensFragmentFactory()\n    super.onCreate(savedInstanceState)" : "    super.onCreate(null)";
    activity = activity.replace(/(class MainActivity\s*:\s*ReactActivity\(\)\s*\{)/, `$1\n  override fun onCreate(savedInstanceState: Bundle?) {\n${create}\n  }\n`);
    androidManifest = androidManifest.replace(/<application(?=\s|>)/, '<application android:enableOnBackInvokedCallback="false"');
    Object.assign(manifest.dependencies, { "@react-navigation/native": "^7.0.0", "@react-navigation/native-stack": "^7.0.0", "react-native-screens": screens.version, "react-native-safe-area-context": Number(rnVersion.replace(/^[~^]/, "").split(".")[1]) >= 88 ? "~5.11.0" : "~5.6.0" });
  }
  if (store === "zustand") manifest.dependencies.zustand = "^5.0.0";
  if (store === "redux") Object.assign(manifest.dependencies, { "@reduxjs/toolkit": "^2.0.0", "react-redux": "^9.0.0" });
  if (store === "jotai") manifest.dependencies.jotai = "^2.0.0";
  const imports = ["import React from 'react';", store === "none" ? "import { Text, View } from 'react-native';" : "import { Button, Text, View } from 'react-native';"];
  if (router === "react-navigation") imports.push("import { NavigationContainer } from '@react-navigation/native';", "import { createNativeStackNavigator } from '@react-navigation/native-stack';");
  const storePath = expo ? "../store" : "./store";
  if (store === "zustand") imports.push(`import { useCounter } from '${storePath}';`);
  if (store === "jotai") imports.push("import { useAtom } from 'jotai';", `import { counterAtom } from '${storePath}';`);
  if (store === "redux") imports.push("import { useDispatch, useSelector" + (expo ? "" : ", Provider") + " } from 'react-redux';", `import { ${expo ? "" : "store, "}increment, type RootState } from '${storePath}';`);
  const states: Record<string, string> = {
    zustand: "import { create } from 'zustand';\n\nexport const useCounter = create<{ count: number; increment: () => void }>((set) => ({ count: 0, increment: () => set((state) => ({ count: state.count + 1 })) }));\n",
    jotai: "import { atom } from 'jotai';\n\nexport const counterAtom = atom(0);\n",
    redux: "import { configureStore, createSlice } from '@reduxjs/toolkit';\n\nconst counter = createSlice({ name: 'counter', initialState: { value: 0 }, reducers: { increment: (state) => { state.value += 1; } } });\nexport const { increment } = counter.actions;\nexport const store = configureStore({ reducer: { counter: counter.reducer } });\nexport type RootState = ReturnType<typeof store.getState>;\n",
  };
  const hooks: Record<string, string> = {
    zustand: "  const { count, increment } = useCounter();\n",
    jotai: "  const [count, setCount] = useAtom(counterAtom);\n  const increment = () => setCount((value) => value + 1);\n",
    redux: "  const count = useSelector((state: RootState) => state.counter.value);\n  const dispatch = useDispatch();\n  const incrementCount = () => dispatch(increment());\n",
  };
  const container = styling === "nativewind" ? '<View className="flex-1 items-center justify-center">' : "<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>";
  const screen = `function HomeScreen() {\n${hooks[store] ?? ""}  return (\n    ${container}\n      <Text>Welcome to your app</Text>\n${store !== "none" ? (store === "redux" ? "      <Text>Count: {count}</Text>\n      <Button title=\"Increment\" onPress={incrementCount} />\n" : "      <Text>Count: {count}</Text>\n      <Button title=\"Increment\" onPress={increment} />\n") : ""}    </View>\n  );\n}\n`;
  const body = router === "react-navigation" ? "<NavigationContainer><Stack.Navigator><Stack.Screen name=\"Home\" component={HomeScreen} /></Stack.Navigator></NavigationContainer>" : "<HomeScreen />";
  const content = imports.join("\n") + "\n\n" + screen + "\n" + (router === "react-navigation" ? "const Stack = createNativeStackNavigator();\n\n" : "") + `export default function App() {\n  return ${store === "redux" && !expo ? `<Provider store={store}>${body}</Provider>` : body};\n}\n`;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  if (store !== "none") writeFileSync(join(root, "src", "store.ts"), states[store]);
  if (expo) {
    const layout = store === "redux" ? "import { Stack } from 'expo-router';\nimport { Provider } from 'react-redux';\nimport { store } from '../store';\n\nexport default function RootLayout() {\n  return <Provider store={store}><Stack /></Provider>;\n}\n" : "import { Stack } from 'expo-router';\n\nexport default function RootLayout() {\n  return <Stack />;\n}\n";
    writeFileSync(expoLayout, layout);
    writeFileSync(expoIndex, content);
    writeFileSync(appPath, "export { default } from './src/app/index';\n");
  } else {
    writeFileSync(join(root, "src", "App.tsx"), content);
    if (!expo) registerInSrc();
    rmSync(appPath);
  }
  if (activityPath) { writeFileSync(activityPath, activity); writeFileSync(androidManifestPath, androidManifest); }
}
