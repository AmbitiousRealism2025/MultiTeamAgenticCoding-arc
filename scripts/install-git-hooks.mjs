import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const hooksDir = path.join(repoRoot, ".git", "hooks");
const preCommitPath = path.join(hooksDir, "pre-commit");

if (!fs.existsSync(path.join(repoRoot, ".git"))) {
  console.error("No .git directory found. Run this from the repository root.");
  process.exit(1);
}

fs.mkdirSync(hooksDir, { recursive: true });

const script = `#!/usr/bin/env bash
set -e

echo "[pre-commit] Running bun run typecheck"
bun run typecheck

echo "[pre-commit] Running bun test"
bun test
`;

fs.writeFileSync(preCommitPath, script, "utf8");
fs.chmodSync(preCommitPath, 0o755);

console.log(`Installed pre-commit hook at ${preCommitPath}`);
