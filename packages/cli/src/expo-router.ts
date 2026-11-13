import {
  existsSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { execute } from "./process.js";
import type { PackageManager } from "./packages.js";

const markerName = ".rnx-expo-router-setup.json";
const sdkByMinor: Record<number, number> = { 83: 55, 85: 56, 86: 57, 88: 58 };
export function expoSdk(version: string): number {
  const match = version.match(/^(?:\^|~)?0\.(\d+)\.\d+$/);
  const sdk = match && sdkByMinor[Number(match[1])];
  if (!sdk)
    throw new Error(
      `Expo Router requires a React Native version with a supported Expo SDK (0.83, 0.85, 0.86 or 0.88); received ${version}.`
    );
  return sdk;
}
function writeJson(path: string, value: unknown): void {
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}
export function prepareExpoRouter(root: string): void {
  const manifestPath = join(root, "package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const sdk = expoSdk(manifest.dependencies?.["react-native"] ?? "");
  const appPath = join(root, "app.json");
  const app = JSON.parse(readFileSync(appPath, "utf8"));
  const slug = String(app.name).toLowerCase();
  manifest.main = "expo-router/entry";
  manifest.scripts = {
    ...manifest.scripts,
    start: "expo start",
    android: "expo run:android",
    ios: "expo run:ios",
  };
  app.expo = { name: app.displayName ?? app.name, slug, scheme: slug };
  writeJson(manifestPath, manifest);
  writeJson(appPath, app);
  writeJson(join(root, markerName), { sdk, stage: "install" });
}
function findFiles(dir: string, name: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? findFiles(join(dir, entry.name), name)
      : entry.name === name
      ? [join(dir, entry.name)]
      : []
  );
}
export function patchExpoNative(root: string, sdk: number): void {
  const matches = findFiles(
    join(root, "android", "app", "src", "main", "java"),
    "MainActivity.kt"
  );
  if (matches.length !== 1)
    throw new Error(
      "Cannot identify the default Android MainActivity; Expo Router setup is incomplete."
    );
  const activityPath = matches[0];
  let activity = readFileSync(activityPath, "utf8");
  if (!/override fun getMainComponentName\(\): String = "[^"]+"/.test(activity))
    throw new Error(
      "Unexpected Android MainActivity; Expo Router setup is incomplete."
    );
  activity = activity.replace(
    /(override fun getMainComponentName\(\): String = )"[^"]+"/,
    '$1"main"'
  );
  if (!/override fun onCreate\(/.test(activity)) {
    if (!/class MainActivity\s*:\s*ReactActivity\(\)\s*\{/.test(activity))
      throw new Error(
        "Unexpected Android activity class; Expo Router setup is incomplete."
      );
    activity = activity.replace(
      /^(package .+)$/m,
      `$1\n\nimport android.os.Bundle${
        sdk >= 56
          ? "\nimport com.swmansion.rnscreens.fragment.restoration.RNScreensFragmentFactory"
          : ""
      }`
    );
    const body =
      sdk >= 56
        ? "    supportFragmentManager.fragmentFactory = RNScreensFragmentFactory()\n    super.onCreate(savedInstanceState)"
        : "    super.onCreate(null)";
    activity = activity.replace(
      /(class MainActivity\s*:\s*ReactActivity\(\)\s*\{)/,
      `$1\n  override fun onCreate(savedInstanceState: Bundle?) {\n${body}\n  }\n`
    );
  }
  const androidManifestPath = join(
    root,
    "android",
    "app",
    "src",
    "main",
    "AndroidManifest.xml"
  );
  let androidManifest = readFileSync(androidManifestPath, "utf8");
  if (!/android:enableOnBackInvokedCallback/.test(androidManifest))
    androidManifest = androidManifest.replace(
      /<application(?=\s|>)/,
      '<application android:enableOnBackInvokedCallback="false"'
    );
  const delegates = findFiles(join(root, "ios"), "AppDelegate.swift");
  if (delegates.length !== 1)
    throw new Error(
      "Cannot identify the default iOS AppDelegate; Expo Router setup is incomplete."
    );
  let appDelegate = readFileSync(delegates[0], "utf8");
  const scenePath = join(join(delegates[0], ".."), "SceneDelegate.swift");
  let scene: string | undefined;
  if (sdk === 58) {
    if (!existsSync(scenePath) || !appDelegate.includes("ExpoAppDelegate"))
      throw new Error(
        "Unexpected iOS scene template; Expo Router setup is incomplete."
      );
    const originalScene = readFileSync(scenePath, "utf8");
    if (
      !originalScene.includes("RCTDefaultReactNativeFactoryDelegate") &&
      !originalScene.includes("ExpoAppSceneDelegate")
    )
      throw new Error(
        "Unexpected iOS SceneDelegate; Expo Router setup is incomplete."
      );
    scene =
      "internal import Expo\n\n@objc(SceneDelegate)\nclass SceneDelegate: ExpoAppSceneDelegate {\n}\n";
    appDelegate = `internal import Expo\nimport React\nimport ReactAppDependencyProvider\n\n@main\nclass AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {\n  var window: UIWindow?\n  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?\n  var reactNativeFactory: RCTReactNativeFactory?\n\n  public override func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {\n    let delegate = ReactNativeDelegate()\n    let factory = ExpoReactNativeFactory(delegate: delegate)\n    delegate.dependencyProvider = RCTAppDependencyProvider()\n    reactNativeDelegate = delegate\n    reactNativeFactory = factory\n    return super.application(application, didFinishLaunchingWithOptions: launchOptions)\n  }\n}\n\nclass ReactNativeDelegate: ExpoReactNativeFactoryDelegate {\n  override func sourceURL(for bridge: RCTBridge) -> URL? { bridge.bundleURL ?? bundleURL() }\n  override func bundleURL() -> URL? {\n#if DEBUG\n    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")\n#else\n    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")\n#endif\n  }\n}\n`;
  } else {
    if (!appDelegate.includes("ExpoAppDelegate"))
      throw new Error("Expo modules did not configure the iOS AppDelegate.");
    if (!/withModuleName:\s*"[^"]+"/.test(appDelegate))
      throw new Error("Cannot configure the iOS app module name.");
    appDelegate = appDelegate.replace(/(withModuleName:\s*)"[^"]+"/, '$1"main"');
    appDelegate = appDelegate.replace(
      /jsBundleURL\(forBundleRoot: "index"\)/,
      'jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")'
    );
    if (!appDelegate.includes(".expo/.virtual-metro-entry"))
      throw new Error("Cannot configure the iOS Expo entry point.");
  }
  const podPath = join(root, "ios", "Podfile");
  let podfile = readFileSync(podPath, "utf8");
  if (sdk >= 56)
    podfile = podfile.replace(
      /platform :ios, min_ios_version_supported/,
      "platform :ios, '16.4'"
    );
  writeFileSync(activityPath, activity);
  writeFileSync(androidManifestPath, androidManifest);
  writeFileSync(delegates[0], appDelegate);
  if (scene) writeFileSync(scenePath, scene);
  writeFileSync(podPath, podfile);
}
export function pendingExpoRouter(root: string): boolean {
  return existsSync(join(root, markerName));
}
export function isExpoRouter(root: string): boolean {
  const path = join(root, "package.json");
  return (
    existsSync(path) &&
    JSON.parse(readFileSync(path, "utf8")).main === "expo-router/entry"
  );
}
export async function setupExpoRouter(
  root: string,
  pm: PackageManager
): Promise<number> {
  const path = join(root, markerName);
  const marker = JSON.parse(readFileSync(path, "utf8"));
  const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const sdk = expoSdk(manifest.dependencies?.["react-native"] ?? "");
  if (
    marker.sdk !== sdk ||
    !["install", "native", "packages", "dev", "check"].includes(marker.stage)
  )
    throw new Error(
      "Invalid Expo Router setup marker; check the project before retrying."
    );
  let code: number;
  if (marker.stage === "install") {
    code = await execute(pm, ["install"], root);
    if (code !== 0) return code;
    marker.stage = "native";
    writeJson(path, marker);
  }
  if (marker.stage === "native") {
    const appPath = join(root, "app.json");
    const app = JSON.parse(readFileSync(appPath, "utf8"));
    if (
      Array.isArray(app.expo?.plugins) &&
      !existsSync(join(root, "node_modules", "expo-router"))
    ) {
      app.expo.plugins = app.expo.plugins.filter(
        (plugin: unknown) => plugin !== "expo-router"
      );
      writeJson(appPath, app);
    }
    code = await execute(
      "npx",
      [
        "--yes",
        "install-expo-modules@latest",
        "--sdk-version",
        `${sdk}.0.0`,
        "--non-interactive",
      ],
      root
    );
    if (code !== 0) return code;
    patchExpoNative(root, sdk);
    marker.stage = "packages";
    writeJson(path, marker);
  }
  const require = createRequire(join(root, "package.json"));
  const cli = require.resolve("expo/bin/cli");
  if (marker.stage === "packages") {
    code = await execute(
      process.execPath,
      [
        cli,
        "install",
        "expo-router",
        "react-native-safe-area-context",
        "react-native-screens",
        "expo-linking",
        "expo-constants",
        "expo-status-bar",
        "react-dom",
        "react-native-reanimated",
        "react-native-worklets",
        `--${pm}`,
      ],
      root,
      { ...process.env, CI: "1" }
    );
    if (code !== 0) return code;
    marker.stage = "dev";
    writeJson(path, marker);
  }
  if (marker.stage === "dev") {
    code = await execute(
      process.execPath,
      [cli, "install", "--dev", "@types/react", "typescript", `--${pm}`],
      root,
      { ...process.env, CI: "1" }
    );
    if (code !== 0) return code;
    marker.stage = "check";
    writeJson(path, marker);
  }
  const appPath = join(root, "app.json");
  const app = JSON.parse(readFileSync(appPath, "utf8"));
  const plugins = Array.isArray(app.expo?.plugins) ? app.expo.plugins : [];
  if (
    !plugins.some(
      (plugin: unknown) =>
        plugin === "expo-router" ||
        (Array.isArray(plugin) && plugin[0] === "expo-router")
    )
  )
    plugins.push("expo-router");
  app.expo.plugins = plugins;
  writeJson(appPath, app);
  code = await execute(process.execPath, [cli, "install", "--check"], root, {
    ...process.env,
    CI: "1",
  });
  if (code !== 0)
    console.warn(
      "Expo reported dependency version warnings above. Review them before building; RNX kept the selected React Native version."
    );
  unlinkSync(path);
  if (process.platform === "darwin")
    console.log(
      "Expo modules installer runs CocoaPods; run rnx pods again after adding router dependencies."
    );
  return 0;
}
