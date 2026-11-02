#!/usr/bin/env node
import { main } from "../src/cli.js";

main().then(
  code => { process.exitCode = code; },
  error => {
    process.stderr.write(`datahacks-mcp: ${error?.stack ?? error}\n`);
    process.exitCode = 1;
  },
);
