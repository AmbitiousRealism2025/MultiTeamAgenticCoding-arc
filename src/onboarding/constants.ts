import type { DirRoleId, ProviderDef, ProviderId } from "./types";

export const PROVIDERS: Record<ProviderId, ProviderDef> = {
  zai: {
    id: "zai",
    label: "Z.ai",
    defaultLeadModel: "zai/glm-5.1",
    defaultWorkerModel: "zai/glm-5-turbo",
    apiBase: "https://api.z.ai/api/paas/v4/",
    envVar: "ZAI_API_KEY",
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    defaultLeadModel: "anthropic/claude-opus-4-6",
    defaultWorkerModel: "anthropic/claude-sonnet-4-6",
    apiBase: null,
    envVar: "ANTHROPIC_API_KEY",
  },
};

export const LEAD_AGENTS = ["orchestrator", "planning-lead", "engineering-lead", "validation-lead"] as const;
export const WORKER_AGENTS = [
  "product-manager",
  "ux-researcher",
  "frontend-dev",
  "backend-dev",
  "qa-engineer",
  "security-reviewer",
] as const;
export const ALL_AGENTS = [...LEAD_AGENTS, ...WORKER_AGENTS] as const;

export const AGENT_DISPLAY_NAMES: Record<string, string> = {
  orchestrator: "Orchestrator",
  "planning-lead": "Planning Lead",
  "engineering-lead": "Engineering Lead",
  "validation-lead": "Validation Lead",
  "product-manager": "Product Manager",
  "ux-researcher": "UX Researcher",
  "frontend-dev": "Frontend Dev",
  "backend-dev": "Backend Dev",
  "qa-engineer": "QA Engineer",
  "security-reviewer": "Security Reviewer",
};

export const DIR_ROLE_LABELS: Record<DirRoleId, string> = {
  frontend: "Frontend source",
  backend: "Backend source",
  tests: "Tests",
  docs: "Documentation",
  specs: "Specifications",
};

export const DEFAULT_DIRECTORIES: Record<DirRoleId, string> = {
  frontend: "src/frontend/",
  backend: "src/backend/",
  tests: "tests/",
  docs: "docs/",
  specs: "specs/",
};
