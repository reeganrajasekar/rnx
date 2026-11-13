#!/usr/bin/env node
import pc from "picocolors";
import { createProgram } from "./cli.js";
try {
  await createProgram().parseAsync();
} catch (error) {
  console.error(
    pc.red(`Error: ${error instanceof Error ? error.message : String(error)}`),
  );
  process.exitCode = 1;
}
