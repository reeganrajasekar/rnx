import { capture } from "./process.js";

export function newestStableVersions(input: unknown): string[] {
  if (!Array.isArray(input)) throw new Error("The npm registry did not return a version list.");
  const versions = input.filter((value): value is string => typeof value === "string" && /^0\.\d+\.\d+$/.test(value))
    .sort((a, b) => { const x = a.split(".").map(Number), y = b.split(".").map(Number); return y[1] - x[1] || y[2] - x[2]; });
  const seen = new Set<string>();
  return versions.filter((value) => { const minor = value.split(".")[1]; if (seen.has(minor)) return false; seen.add(minor); return true; });
}

export async function stableVersions(): Promise<string[]> {
  const versions = newestStableVersions(JSON.parse(await capture("npm", ["view", "react-native", "versions", "--json"])));
  if (!versions.length) throw new Error("The npm registry returned no stable React Native versions.");
  return versions;
}
