import * as prompts from "@clack/prompts";
import { existsSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { capture, execute, requireMac } from "./process.js";
import { packageManager } from "./packages.js";
import { findProject } from "./project.js";
import { installPods } from "./setup.js";
import { expoSdk, prepareExpoRouter, setupExpoRouter } from "./expo-router.js";
import { stableVersions } from "./versions.js";
import { configureStarter, screensVersion } from "./starter.js";
import { configureNativeWind } from "./nativewind.js";

export interface CreateOptions {
  directory?: string;
  version?: string;
  cliVersion?: string;
  template?: string;
  pm?: string;
  router?: string;
  store?: string;
  styling?: string;
  install?: boolean;
  pods?: boolean;
  git?: boolean;
}
export function initArgs(name: string, options: CreateOptions): string[] {
  if (
    !/^[A-Za-z][A-Za-z0-9]*$/.test(name) ||
    ["React", "ReactNative"].includes(name)
  )
    throw new Error(
      "Use a project name beginning with a letter and containing only letters and numbers.",
    );
  const destination = resolve(options.directory ?? name);
  if (existsSync(destination))
    throw new Error(
      `Destination already exists: ${destination}. Choose a new directory.`,
    );
  const known: Record<number, string> = {
    76: "15",
    77: "15",
    78: "15",
    79: "18",
    80: "19",
    81: "20",
    82: "20",
    83: "20",
    84: "20",
    85: "20",
    86: "20",
    87: "20",
    88: "20",
    89: "21",
  };
  const match = options.version?.match(/^0\.(\d+)(?:\.\d+)?$/);
  const compatible = match ? known[Number(match[1])] : undefined;
  if (options.version && !compatible && !options.cliVersion)
    throw new Error(
      "For this React Native version, provide --cli-version from the official Community CLI compatibility matrix.",
    );
  const cliVersion = options.cliVersion ?? compatible ?? "latest";
  if (!/^[\w.+-]+$/.test(cliVersion))
    throw new Error(
      "Invalid --cli-version. Use a version, major version, or npm tag.",
    );
  const initManager = options.pm === "pnpm" ? "npm" : (options.pm ?? "npm");
  const args = [
    "--yes",
    `@react-native-community/cli@${cliVersion}`,
    "init",
    name,
    "--directory",
    destination,
    "--skip-install",
    "--install-pods",
    "false",
    "--pm",
    initManager,
  ];
  if (options.version) args.push("--version", options.version);
  if (options.template) args.push("--template", options.template);
  if (options.git === false) args.push("--skip-git-init", "true");
  return args;
}
export async function createProject(
  name: string | undefined,
  options: CreateOptions,
): Promise<number> {
  const interactive = !!process.stdin.isTTY && !!process.stdout.isTTY;
  if (!name) {
    if (!interactive)
      throw new Error("Provide a project name: rnx create MyApp.");
    const value = await prompts.text({
      message: "Project name",
      placeholder: "MyApp",
      validate: (input) =>
        /^[A-Za-z][A-Za-z0-9]*$/.test(input) &&
        !["React", "ReactNative"].includes(input)
          ? undefined
          : "Use a name beginning with a letter and containing only letters and numbers.",
    });
    if (prompts.isCancel(value)) throw new Error("Project creation cancelled.");
    name = value;
  }
  if (interactive && !options.template) {
    if (!options.router) {
      const value = await prompts.select({
        message: "Router",
        options: [
          { value: "none", label: "None" },
          {
            value: "react-navigation",
            label: "React Navigation (native stack)",
          },
          { value: "expo-router", label: "Expo Router (bare React Native)" },
        ],
      });
      if (prompts.isCancel(value))
        throw new Error("Project creation cancelled.");
      options.router = value;
    }
    if (!options.styling) {
      const value = await prompts.select({
        message: "Styling",
        options: [
          { value: "native", label: "Standard React Native styles" },
          { value: "nativewind", label: "NativeWind (Tailwind CSS classes)" },
        ],
      });
      if (prompts.isCancel(value)) throw new Error("Project creation cancelled.");
      options.styling = value;
    }
    if (!options.store) {
      const value = await prompts.select({
        message: "State management",
        options: [
          { value: "none", label: "None" },
          { value: "zustand", label: "Zustand" },
          { value: "redux", label: "Redux Toolkit" },
          { value: "jotai", label: "Jotai" },
        ],
      });
      if (prompts.isCancel(value))
        throw new Error("Project creation cancelled.");
      options.store = value;
    }
  }
  if (interactive && !options.version) {
    const versions = await stableVersions();
    const available =
      options.router === "react-navigation"
        ? versions.filter((version) => Number(version.split(".")[1]) <= 88)
        : options.router === "expo-router"
          ? versions.filter((version) => { try { expoSdk(version); return true; } catch { return false; } })
          : versions;
    const selection = await prompts.select({
      message: "React Native version",
      options: [
        ...available.slice(0, 5).map((value, index) => ({ value, label: index === 0 ? `${value === versions[0] ? "Latest" : "Latest compatible"} (${value})` : value })),
        { value: "custom", label: "Enter a version" },
      ],
    });
    if (prompts.isCancel(selection))
      throw new Error("Project creation cancelled.");
    if (selection === "custom") {
      const value = await prompts.text({
        message: "React Native version",
        placeholder: "0.88.1",
        validate: (input) =>
          /^0\.\d+\.\d+$/.test(input)
            ? undefined
            : "Enter an exact stable version, such as 0.88.1.",
      });
      if (prompts.isCancel(value))
        throw new Error("Project creation cancelled.");
      options.version = value;
    } else options.version = selection;
  }
  if (interactive && !options.pm) {
    const value = await prompts.select({
      message: "Package manager",
      options: ["npm", "pnpm", "yarn", "bun"].map((value) => ({
        value,
        label: value,
      })),
    });
    if (prompts.isCancel(value)) throw new Error("Project creation cancelled.");
    options.pm = value;
  }
  const router = options.router ?? "none";
  const store = options.store ?? "none";
  const styling = options.styling ?? "native";
  if (!["native", "nativewind"].includes(styling))
    throw new Error("Styling must be native or nativewind.");
  if (!["none", "react-navigation", "expo-router"].includes(router))
    throw new Error("Router must be none, react-navigation, or expo-router.");
  if (!["none", "zustand", "redux", "jotai"].includes(store))
    throw new Error("Store must be none, zustand, redux, or jotai.");
  if (options.template && (router !== "none" || store !== "none"))
    throw new Error(
      "Router and store setup is only available with the default template.",
    );
  if (options.template && styling !== "native")
    throw new Error("NativeWind setup is only available with the default template.");
  if (options.pods) {
    requireMac();
    if (options.install === false)
      throw new Error("--pods requires dependency installation.");
  }
  const pm = packageManager(options.pm ?? "npm");
  const root = resolve(options.directory ?? name);
  if (
    (!options.cliVersion && !options.version) ||
    options.version === "latest"
  ) {
    const version = (
      await capture("npm", ["view", "react-native", "version"])
    ).trim();
    if (!/^0\.\d+\.\d+$/.test(version))
      throw new Error(
        "Could not determine the latest stable React Native version. Provide --version and --cli-version.",
      );
    options.version = version;
  }
  if (router === "react-navigation" && options.version)
    screensVersion(
      /^0\.\d+$/.test(options.version)
        ? `${options.version}.0`
        : options.version,
    );
  if (router === "expo-router" && options.version) expoSdk(/^0\.\d+$/.test(options.version) ? `${options.version}.0` : options.version);
  const args = initArgs(name, options);
  console.log(
    "Creating Android and iOS projects using the official Community CLI template.",
  );
  let code = await execute("npx", args);
  if (code !== 0) return code;
  const project = findProject(root);
  if (project?.root !== root)
    throw new Error(
      `Initialization exited successfully but no React Native project was created at ${root}.`,
    );
  if (router === "expo-router") expoSdk(project.reactNative);
  if (!options.template) configureStarter(root, router, store, styling);
  if (styling === "nativewind") configureNativeWind(root);
  if (router === "expo-router") prepareExpoRouter(root);
  const config = join(root, "rnx.config.json");
  if (!existsSync(config))
    writeFileSync(
      config,
      JSON.stringify(
        { defaultPlatform: "android", port: 8081, packageManager: pm },
        null,
        2,
      ) + "\n",
    );
  if (options.install !== false) {
    code = router === "expo-router" ? await setupExpoRouter(root, pm) : await execute(pm, ["install"], root);
    if (code !== 0) return code;
  }
  if (options.pods) {
    code = await installPods(root);
    if (code !== 0) return code;
  }
  if (router === "expo-router" && options.install === false) {
    console.log(`Project generated at ${root}. Run rnx get to finish installing Expo Router and native integration.`);
    return 0;
  }
  console.log(
    `Project ready at ${root}\nNext: cd into the project, then rnx doctor and rnx run.\nFor iOS: rnx setup ios --install, then rnx run ios (on macOS).`,
  );
  return 0;
}
