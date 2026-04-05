import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const repoRoot = new URL(".", import.meta.url);
const configPath = new URL("./tsconfig.json", import.meta.url);
const repoRootPath = fileURLToPath(repoRoot);
const configPathString = fileURLToPath(configPath);

await rm(new URL("./dist", import.meta.url), { recursive: true, force: true });

const configFile = ts.readConfigFile(configPathString, ts.sys.readFile);
if (configFile.error) {
  throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"));
}

const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, resolve(repoRootPath));
const program = ts.createProgram(parsed.fileNames, parsed.options);
const emitResult = program.emit();
const diagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);

if (diagnostics.length > 0) {
  const message = diagnostics
    .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"))
    .join("\n");
  throw new Error(message);
}

await runNodeTests();

function runNodeTests() {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, ["--test", "dist/tests/chunk.test.js", "dist/tests/createSlug.test.js"], {
      cwd: repoRoot,
      stdio: "inherit",
    });

    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise(undefined);
        return;
      }

      rejectPromise(new Error(`Tests failed with exit code ${code}`));
    });
  });
}
