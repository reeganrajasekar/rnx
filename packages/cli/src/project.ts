import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";

export interface Project {
  root: string;
  name: string;
  reactNative: string;
}

export function findProject(start = process.cwd()): Project | undefined {
  let directory = resolve(start);
  while (true) {
    const manifest = join(directory, "package.json");
    if (existsSync(manifest)) {
      let data: {
        name?: string;
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      try {
        data = JSON.parse(readFileSync(manifest, "utf8"));
      } catch {
        throw new Error(`Cannot read or parse ${manifest}.`);
      }
      const version =
        data.dependencies?.["react-native"] ??
        data.devDependencies?.["react-native"];
      if (version)
        return {
          root: directory,
          name: data.name ?? "(unnamed)",
          reactNative: version,
        };
    }
    const parent = dirname(directory);
    if (parent === directory) return undefined;
    directory = parent;
  }
}

export function resolveCommunityCli(project: Project): string | undefined {
  const require = createRequire(join(project.root, "package.json"));
  try {
    const manifest =
      require.resolve("@react-native-community/cli/package.json");
    const pkg = JSON.parse(readFileSync(manifest, "utf8")) as {
      bin?: string | Record<string, string>;
    };
    const bin =
      typeof pkg.bin === "string"
        ? pkg.bin
        : (pkg.bin?.["rnc-cli"] ?? pkg.bin?.["react-native"]);
    if (bin && existsSync(resolve(dirname(manifest), bin)))
      return resolve(dirname(manifest), bin);
  } catch {
    /* Older React Native versions include their own CLI entry point. */
  }
  try {
    return require.resolve("react-native/cli.js");
  } catch {
    return undefined;
  }
}

export function requireProject(): Project {
  const project = findProject();
  if (!project)
    throw new Error(
      "No React Native project found. Run inside a project or create one with rnx create MyApp.",
    );
  return project;
}
