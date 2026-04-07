import fs from "node:fs";
import path from "node:path";
import { ALL_AGENTS, PROVIDERS } from "./constants";
import type { ConfigState, DirRoleId, ProviderId } from "./types";

export function fileExists(filePath: string) {
  try {
    fs.accessSync(filePath);
    return true;
  } catch {
    return false;
  }
}

export function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

export function normalizeRelativeDir(input: string) {
  const trimmed = input.trim().replace(/^\.\//, "").replace(/^\/+/, "");
  const normalized = path.posix.normalize(trimmed.replace(/\\/g, "/"));
  if (!normalized || normalized === ".") throw new Error("Directory path cannot be empty");
  if (normalized.startsWith("../") || normalized === "..") {
    throw new Error("Directory path must stay inside the project root");
  }
  return ensureTrailingSlash(normalized);
}

export function readFileSafe(filePath: string) {
  return fs.readFileSync(filePath, "utf8");
}

export function writeBackup(filePath: string) {
  const backupPath = `${filePath}.bak`;
  if (!fileExists(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
  }
}

export function parseFrontmatter(content: string) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error("No frontmatter found");
  return { frontmatter: match[1], body: match[2] };
}

export function replaceModel(frontmatter: string, model: string) {
  if (!/^model:/m.test(frontmatter)) throw new Error("model field not found");
  return frontmatter.replace(/^model:\s.*$/m, `model: ${model}`);
}

export function replaceDomainPath(frontmatter: string, oldPath: string, newPath: string) {
  const escapedOld = oldPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(^\\s*- path: )${escapedOld}$`, "m");
  if (!regex.test(frontmatter)) return frontmatter;
  return frontmatter.replace(regex, `$1${newPath}`);
}

export function replaceBodyPath(body: string, oldPath: string, newPath: string) {
  return body.split(oldPath).join(newPath);
}

export function extractCurrentProvider(configContent: string): ProviderId {
  const match = configContent.match(/^active_provider:\s*(\S+)$/m);
  const provider = match?.[1]?.trim();
  if (provider === "anthropic" || provider === "zai") return provider;
  return "zai";
}

export function extractCurrentModel(content: string): string | null {
  const fm = parseFrontmatter(content).frontmatter;
  const match = fm.match(/^model:\s*(.+)$/m);
  return match ? match[1].trim() : null;
}

export function suggestDirectories(projectRoot: string): Partial<Record<DirRoleId, string>> {
  const suggestions: Partial<Record<DirRoleId, string>> = {};
  const packageJsonPath = path.join(projectRoot, "package.json");
  let pkgText = "";
  if (fileExists(packageJsonPath)) {
    pkgText = readFileSafe(packageJsonPath);
  }

  const candidateExists = (rel: string) => fileExists(path.join(projectRoot, rel));

  if (pkgText.includes('"next"')) {
    if (candidateExists("app")) suggestions.frontend = "app/";
    else if (candidateExists("src/app")) suggestions.frontend = "src/app/";
  }
  if (!suggestions.frontend && pkgText.includes('"vite"')) {
    if (candidateExists("src")) suggestions.frontend = "src/";
  }
  if (!suggestions.frontend && pkgText.includes('"react"')) {
    if (candidateExists("src")) suggestions.frontend = "src/";
  }
  if (!suggestions.backend) {
    for (const rel of ["backend/", "server/", "api/", "src/backend/"]) {
      if (candidateExists(rel.replace(/\/$/, ""))) {
        suggestions.backend = rel;
        break;
      }
    }
  }
  if (!suggestions.tests) {
    for (const rel of ["tests/", "test/", "__tests__/"]) {
      if (candidateExists(rel.replace(/\/$/, ""))) {
        suggestions.tests = rel;
        break;
      }
    }
  }
  if (candidateExists("docs")) suggestions.docs = "docs/";
  if (candidateExists("specs")) suggestions.specs = "specs/";
  return suggestions;
}

export function buildConfigYaml(state: ConfigState): string {
  const provider = PROVIDERS[state.provider];
  const apiBaseLine = provider.apiBase ? `  api_base: ${provider.apiBase}\n` : "";
  return `providers:
  anthropic:
    opus: anthropic/claude-opus-4-6
    sonnet: anthropic/claude-sonnet-4-6
  zai:
    opus: zai/glm-5.1
    sonnet: zai/glm-5-turbo
active_provider: ${state.provider}

orchestrator:
  name: Orchestrator
  path: .pi/multi-team/agents/orchestrator.md
  model: ${state.agentModels.orchestrator}
${apiBaseLine}paths:
  agents: .pi/multi-team/agents/
  sessions: .pi/multi-team/sessions/
  logs: .pi/multi-team/logs/

shared_context:
  - README.md
  - CLAUDE.md

teams:
  - team-name: Planning
    team-color: "#fede5d"
    lead:
      name: Planning Lead
      path: .pi/multi-team/agents/planning-lead.md
      color: "#fede5d"
    members:
      - name: Product Manager
        path: .pi/multi-team/agents/product-manager.md
        color: "#f0c674"
        consult-when: Requirements, feature prioritization, user stories, acceptance criteria
      - name: UX Researcher
        path: .pi/multi-team/agents/ux-researcher.md
        color: "#b893ce"
        consult-when: User behavior, personas, journey mapping, usability, friction points

  - team-name: Engineering
    team-color: "#ff6e96"
    lead:
      name: Engineering Lead
      path: .pi/multi-team/agents/engineering-lead.md
      color: "#ff6e96"
    members:
      - name: Frontend Dev
        path: .pi/multi-team/agents/frontend-dev.md
        color: "#3d19f0"
        consult-when: UI components, layouts, client-side state, browser APIs, CSS
      - name: Backend Dev
        path: .pi/multi-team/agents/backend-dev.md
        color: "#ff7edb"
        consult-when: APIs, databases, infrastructure, background jobs, third-party integrations

  - team-name: Validation
    team-color: "#9aedfe"
    lead:
      name: Validation Lead
      path: .pi/multi-team/agents/validation-lead.md
      color: "#9aedfe"
    members:
      - name: QA Engineer
        path: .pi/multi-team/agents/qa-engineer.md
        color: "#77ffac"
        consult-when: Test coverage, edge cases, regression testing, integration tests
      - name: Security Reviewer
        path: .pi/multi-team/agents/security-reviewer.md
        color: "#ff6188"
        consult-when: Vulnerabilities, auth patterns, input validation, dependency risks
`;
}

export function updateAgentContent(original: string, name: string, state: ConfigState) {
  const { frontmatter, body } = parseFrontmatter(original);
  let nextFrontmatter = replaceModel(frontmatter, state.agentModels[name]);
  let nextBody = body;

  if (name === "backend-dev") {
    nextFrontmatter = replaceDomainPath(nextFrontmatter, "src/backend/", state.directories.backend);
    nextFrontmatter = replaceDomainPath(nextFrontmatter, "docs/", state.directories.docs);
    nextBody = replaceBodyPath(nextBody, "src/backend/", state.directories.backend);
    nextBody = replaceBodyPath(nextBody, "docs/", state.directories.docs);
  }

  if (name === "frontend-dev") {
    nextFrontmatter = replaceDomainPath(nextFrontmatter, "src/frontend/", state.directories.frontend);
    nextFrontmatter = replaceDomainPath(nextFrontmatter, "docs/", state.directories.docs);
    nextBody = replaceBodyPath(nextBody, "src/frontend/", state.directories.frontend);
    nextBody = replaceBodyPath(nextBody, "src/backend/", state.directories.backend);
    nextBody = replaceBodyPath(nextBody, "docs/", state.directories.docs);
  }

  if (name === "qa-engineer") {
    nextFrontmatter = replaceDomainPath(nextFrontmatter, "tests/", state.directories.tests);
    nextBody = replaceBodyPath(nextBody, "tests/", state.directories.tests);
  }

  if (name === "product-manager") {
    nextFrontmatter = replaceDomainPath(nextFrontmatter, "specs/", state.directories.specs);
    nextBody = replaceBodyPath(nextBody, "specs/", state.directories.specs);
  }

  if (name === "ux-researcher") {
    nextFrontmatter = replaceDomainPath(nextFrontmatter, "specs/", state.directories.specs);
    nextBody = replaceBodyPath(nextBody, "specs/", state.directories.specs);
  }

  if (name === "planning-lead") {
    nextFrontmatter = replaceDomainPath(nextFrontmatter, "specs/", state.directories.specs);
    nextBody = replaceBodyPath(nextBody, "specs/", state.directories.specs);
  }

  const updated = `---\n${nextFrontmatter}\n---\n${nextBody}`;
  if (!updated.includes("## Purpose") || !updated.includes("### Skills")) {
    throw new Error(`Validation failed for ${name}.md`);
  }
  return updated;
}

export function ensureDirectories(projectRoot: string, directories: Record<DirRoleId, string>) {
  for (const rel of Object.values(directories)) {
    fs.mkdirSync(path.join(projectRoot, rel), { recursive: true });
  }
  fs.mkdirSync(path.join(projectRoot, ".pi/multi-team/sessions"), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, ".pi/multi-team/logs"), { recursive: true });
}

export function updateEnvContent(existing: string, envVar: string, mode: "placeholder" | "value", value?: string) {
  const regex = new RegExp(`^${envVar}=.*$`, "m");
  if (regex.test(existing) && mode === "placeholder") {
    return existing;
  }
  const lineValue = mode === "placeholder" ? "your-key-here" : (value ?? "");
  const line = `${envVar}=${lineValue}`;
  if (regex.test(existing)) {
    return existing.replace(regex, line);
  }
  const trimmed = existing.trimEnd();
  return trimmed ? `${trimmed}\n${line}\n` : `${line}\n`;
}

export function updateEnvFile(state: ConfigState) {
  if (!state.envSetup || !state.envSetup.enabled || state.envSetup.mode === "skip") return;
  const { envFilePath, envVar, mode, value } = state.envSetup;
  const content = fileExists(envFilePath) ? readFileSafe(envFilePath) : "";
  fs.writeFileSync(envFilePath, updateEnvContent(content, envVar, mode, value), "utf8");
}

export function readCurrentState(projectRoot: string): Partial<ConfigState> {
  const configPath = path.join(projectRoot, ".pi/multi-team/multi-team-config.yaml");
  const partial: Partial<ConfigState> = { projectRoot };
  if (!fileExists(configPath)) return partial;
  const config = readFileSafe(configPath);
  partial.provider = extractCurrentProvider(config);

  const agentModels: Record<string, string> = {};
  for (const agent of ALL_AGENTS) {
    const filePath = path.join(projectRoot, ".pi/multi-team/agents", `${agent}.md`);
    if (fileExists(filePath)) {
      const model = extractCurrentModel(readFileSafe(filePath));
      if (model) agentModels[agent] = model;
    }
  }
  partial.agentModels = agentModels;

  const directories: Partial<Record<DirRoleId, string>> = {};
  const backendPath = path.join(projectRoot, ".pi/multi-team/agents/backend-dev.md");
  const frontendPath = path.join(projectRoot, ".pi/multi-team/agents/frontend-dev.md");
  const qaPath = path.join(projectRoot, ".pi/multi-team/agents/qa-engineer.md");
  const productPath = path.join(projectRoot, ".pi/multi-team/agents/product-manager.md");
  if (fileExists(backendPath)) {
    const content = readFileSafe(backendPath);
    if (content.includes("- path: src/backend/")) directories.backend = "src/backend/";
    else {
      const m = content.match(/- path: ([^\n]+)\n\s+read: true\n\s+upsert: true\n\s+delete: true/);
      if (m) directories.backend = m[1].trim();
    }
    const docsMatch = content.match(/- path: ([^\n]+)\n\s+read: true\n\s+upsert: true\n\s+delete: false/);
    if (docsMatch && docsMatch[1].trim() !== ".pi/multi-team/expertise/backend-dev-mental-model.yaml") {
      directories.docs = docsMatch[1].trim();
    }
  }
  if (fileExists(frontendPath)) {
    const content = readFileSafe(frontendPath);
    const m = content.match(/- path: ([^\n]+)\n\s+read: true\n\s+upsert: true\n\s+delete: true/);
    if (m) directories.frontend = m[1].trim();
  }
  if (fileExists(qaPath)) {
    const content = readFileSafe(qaPath);
    const m = content.match(/- path: ([^\n]+)\n\s+read: true\n\s+upsert: true\n\s+delete: true/);
    if (m) directories.tests = m[1].trim();
  }
  if (fileExists(productPath)) {
    const content = readFileSafe(productPath);
    const matches = [...content.matchAll(/- path: ([^\n]+)\n\s+read: true\n\s+upsert: true\n\s+delete: false/g)];
    for (const match of matches) {
      const value = match[1].trim();
      if (value !== ".pi/multi-team/expertise/product-manager-mental-model.yaml") {
        directories.specs = value;
      }
    }
  }
  partial.directories = directories as Record<DirRoleId, string>;
  return partial;
}

export function validateProjectStructure(projectRoot: string) {
  const requiredFiles = [
    ".pi/multi-team/multi-team-config.yaml",
    ...ALL_AGENTS.map((agent) => `.pi/multi-team/agents/${agent}.md`),
  ];
  for (const rel of requiredFiles) {
    const abs = path.join(projectRoot, rel);
    if (!fileExists(abs)) throw new Error(`Required file missing: ${rel}`);
  }
}

export function applyChanges(state: ConfigState) {
  validateProjectStructure(state.projectRoot);
  ensureDirectories(state.projectRoot, state.directories);

  const configPath = path.join(state.projectRoot, ".pi/multi-team/multi-team-config.yaml");
  writeBackup(configPath);
  fs.writeFileSync(configPath, buildConfigYaml(state), "utf8");

  for (const agent of ALL_AGENTS) {
    const filePath = path.join(state.projectRoot, ".pi/multi-team/agents", `${agent}.md`);
    writeBackup(filePath);
    const updated = updateAgentContent(readFileSafe(filePath), agent, state);
    fs.writeFileSync(filePath, updated, "utf8");
  }

  updateEnvFile(state);
}
