import { describe, expect, test } from "bun:test";
import { buildConfigYaml, normalizeRelativeDir, updateAgentContent, updateEnvContent } from "../src/onboarding";
import type { ConfigState } from "../src/onboarding";
import fs from "node:fs";
import path from "node:path";

const baseState: ConfigState = {
  projectRoot: "/tmp/project",
  provider: "zai",
  leadModel: "zai/glm-5.1",
  workerModel: "zai/glm-5-turbo",
  agentModels: {
    orchestrator: "zai/glm-5.1",
    "planning-lead": "zai/glm-5.1",
    "engineering-lead": "zai/glm-5.1",
    "validation-lead": "zai/glm-5.1",
    "product-manager": "zai/glm-5-turbo",
    "ux-researcher": "zai/glm-5-turbo",
    "frontend-dev": "zai/glm-5-turbo",
    "backend-dev": "zai/glm-5-turbo",
    "qa-engineer": "zai/glm-5-turbo",
    "security-reviewer": "zai/glm-5-turbo"
  },
  directories: {
    frontend: "app/",
    backend: "server/",
    tests: "__tests__/",
    docs: "guides/",
    specs: "planning/"
  }
};

describe("normalizeRelativeDir", () => {
  test("normalizes relative paths and adds trailing slash", () => {
    expect(normalizeRelativeDir("./src/backend")).toBe("src/backend/");
    expect(normalizeRelativeDir("app")).toBe("app/");
  });

  test("rejects escaping project root", () => {
    expect(() => normalizeRelativeDir("../secret")).toThrow();
  });
});

describe("buildConfigYaml", () => {
  test("includes api_base for Z.ai", () => {
    const yaml = buildConfigYaml(baseState);
    expect(yaml).toContain("active_provider: zai");
    expect(yaml).toContain("api_base: https://api.z.ai/api/paas/v4/");
    expect(yaml).toContain("model: zai/glm-5.1");
  });

  test("omits api_base for Anthropic", () => {
    const yaml = buildConfigYaml({
      ...baseState,
      provider: "anthropic",
      agentModels: { ...baseState.agentModels, orchestrator: "anthropic/claude-opus-4-6" }
    });
    expect(yaml).toContain("active_provider: anthropic");
    expect(yaml).not.toContain("api_base:");
  });
});

describe("updateAgentContent", () => {
  test("rewrites backend agent paths and model", () => {
    const filePath = path.resolve(".pi/multi-team/agents/backend-dev.md");
    const original = fs.readFileSync(filePath, "utf8");
    const updated = updateAgentContent(original, "backend-dev", baseState);
    expect(updated).toContain("model: zai/glm-5-turbo");
    expect(updated).toContain("- path: server/");
    expect(updated).toContain("- path: guides/");
    expect(updated).toContain("You own `server/`");
  });

  test("rewrites QA tests path", () => {
    const filePath = path.resolve(".pi/multi-team/agents/qa-engineer.md");
    const original = fs.readFileSync(filePath, "utf8");
    const updated = updateAgentContent(original, "qa-engineer", baseState);
    expect(updated).toContain("- path: __tests__/");
    expect(updated).toContain("You own `__tests__/`");
  });

  test("rewrites specs path for planning agents", () => {
    const filePath = path.resolve(".pi/multi-team/agents/product-manager.md");
    const original = fs.readFileSync(filePath, "utf8");
    const updated = updateAgentContent(original, "product-manager", baseState);
    expect(updated).toContain("- path: planning/");
    expect(updated).toContain("Write specs and user stories in `planning/`");
  });
});

describe("updateEnvContent", () => {
  test("creates a new env var when missing", () => {
    expect(updateEnvContent("", "ZAI_API_KEY", "placeholder")).toBe("ZAI_API_KEY=your-key-here\n");
  });

  test("preserves an existing env var in placeholder mode", () => {
    const updated = updateEnvContent("FOO=bar\nZAI_API_KEY=realkey\n", "ZAI_API_KEY", "placeholder");
    expect(updated).toContain("FOO=bar");
    expect(updated).toContain("ZAI_API_KEY=realkey");
    expect(updated).not.toContain("your-key-here");
  });

  test("replaces an existing env var", () => {
    const updated = updateEnvContent("FOO=bar\nZAI_API_KEY=old\n", "ZAI_API_KEY", "value", "newkey");
    expect(updated).toContain("FOO=bar");
    expect(updated).toContain("ZAI_API_KEY=newkey");
    expect(updated).not.toContain("ZAI_API_KEY=old");
  });
});
