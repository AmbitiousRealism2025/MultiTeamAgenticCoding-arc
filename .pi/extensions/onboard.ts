import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import path from "node:path";
import {
  AGENT_DISPLAY_NAMES,
  ALL_AGENTS,
  DEFAULT_DIRECTORIES,
  DIR_ROLE_LABELS,
  LEAD_AGENTS,
  PROVIDERS,
  WORKER_AGENTS,
  applyChanges,
  normalizeRelativeDir,
  readCurrentState,
  suggestDirectories,
} from "../../src/onboarding";
import type { ConfigState, ProviderDef, ProviderId } from "../../src/onboarding";

// --- Screen 0: Welcome ---

async function showWelcome(ctx: ExtensionCommandContext) {
  const message = [
    "Welcome to Multi-Team Agent Pi Setup",
    "",
    "This wizard configures a 10-agent coding team for your project. When finished,",
    "your agents will know which project to work on, which AI models to use, and",
    "where your code lives.",
    "",
    "The team structure:",
    "  - 1 Orchestrator (receives your requests, delegates to teams)",
    "  - 3 Team Leads (Planning, Engineering, Validation)",
    "  - 6 Workers (Product Manager, UX Researcher, Frontend Dev, Backend Dev,",
    "    QA Engineer, Security Reviewer)",
    "",
    "This takes about 2 minutes. You can cancel at any step.",
    "",
    "Ready to start?",
  ].join("\n");

  return ctx.ui.confirm("Multi-Team Agent Pi Setup", message);
}

// --- Screen 1: Project Root ---

async function promptForProjectRoot(ctx: ExtensionCommandContext) {
  const message = [
    "Which project should these agents work on?",
    "",
    "Enter the full path to your project's root folder. This is the folder",
    "that contains your main config files (package.json, Cargo.toml, etc.)",
    "and the top-level source directories.",
    "",
    "Examples:",
    "  /Users/you/projects/my-app",
    "  /home/dev/work/api-server",
    "",
    "If you want the agents to work on the current project, just press Enter.",
  ].join("\n");

  const result = await ctx.ui.input("Step 1 - Project Root", message, ctx.cwd);
  if (!result) return null;
  return path.resolve(result.trim());
}

// --- Shared numbered-choice helper ---

async function promptChoice(
  ctx: ExtensionCommandContext,
  title: string,
  body: string,
  options: Array<{ key: string; label: string; value: string }>,
  defaultKey: string,
) {
  const lines = [
    body,
    "",
    ...options.map((o) => `${o.key}. ${o.label}`),
    "",
    `Type your choice. Default: ${defaultKey}`,
  ];
  const value = await ctx.ui.input(title, lines.join("\n"), defaultKey);
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  const found = options.find((o) => o.key === normalized);
  if (found) return found.value;
  const directValue = options.find((o) => o.value.toLowerCase() === normalized);
  if (directValue) return directValue.value;
  throw new Error(`Invalid choice: ${value}`);
}

// --- Screen 2: Provider ---

async function selectProvider(ctx: ExtensionCommandContext, current: ProviderId) {
  const message = [
    "Which AI service should power your agents?",
    "",
    "This determines which language models your agents use. Each provider",
    "has different models and requires its own API key.",
    "",
    "  1. Z.ai",
    "     Models: GLM-5.1 (leads), GLM-5 Turbo (workers)",
    "     API key needed: ZAI_API_KEY",
    "     Best for: Projects already using Z.ai",
    "",
    "  2. Anthropic",
    "     Models: Claude Opus (leads), Claude Sonnet (workers)",
    "     API key needed: ANTHROPIC_API_KEY",
    "     Best for: Projects preferring Claude models",
  ].join("\n");

  const value = await promptChoice(
    ctx,
    "Step 2 - AI Model Provider",
    message,
    [
      { key: "1", label: "Z.ai", value: "zai" },
      { key: "2", label: "Anthropic", value: "anthropic" },
    ],
    current === "anthropic" ? "2" : "1",
  );
  return value ? (value as ProviderId) : null;
}

// --- Screen 3: Lead Model ---

async function chooseLeadModel(
  ctx: ExtensionCommandContext,
  recommended: string,
  current: string,
  alternate: string,
) {
  const message = [
    "Choose the model for your lead-tier agents.",
    "",
    "These 4 agents handle coordination and planning:",
    "  - Orchestrator (delegates your requests to teams)",
    "  - Planning Lead (strategy, specs, requirements)",
    "  - Engineering Lead (architecture, code decisions)",
    "  - Validation Lead (quality, security, testing)",
    "",
    "Leads need stronger reasoning, so this is usually your most capable model.",
  ].join("\n");

  const currentMatches = current === recommended || current === alternate;
  const selected = await promptChoice(
    ctx,
    "Step 3 - Lead Model",
    message,
    [
      { key: "1", label: `${recommended} (recommended)`, value: recommended },
      { key: "2", label: alternate, value: alternate },
      { key: "3", label: "Custom model ID", value: "__custom__" },
    ],
    currentMatches ? (current === alternate ? "2" : "1") : "1",
  );
  if (!selected) return null;
  if (selected === "__custom__") {
    const fallback = currentMatches ? current : recommended;
    const custom = await ctx.ui.input(
      "Step 3 - Custom Lead Model",
      [
        "Enter a custom model ID for lead-tier agents.",
        "",
        "This should be a valid model identifier for your chosen provider.",
        `Example: ${recommended}`,
        "",
        `Current: ${fallback}`,
      ].join("\n"),
      fallback,
    );
    return custom?.trim() || null;
  }
  return selected;
}

// --- Screen 4: Worker Model ---

async function chooseWorkerModel(
  ctx: ExtensionCommandContext,
  recommended: string,
  current: string,
  alternate: string,
) {
  const message = [
    "Choose the model for your worker-tier agents.",
    "",
    "These 6 agents do focused, specialized work:",
    "  - Product Manager (requirements, user stories)",
    "  - UX Researcher (personas, usability)",
    "  - Frontend Dev (UI, client-side code)",
    "  - Backend Dev (APIs, databases, infrastructure)",
    "  - QA Engineer (testing, edge cases)",
    "  - Security Reviewer (vulnerabilities, auth)",
    "",
    "Workers handle specific tasks, so a faster model often works well here.",
  ].join("\n");

  const currentMatches = current === recommended || current === alternate;
  const selected = await promptChoice(
    ctx,
    "Step 4 - Worker Model",
    message,
    [
      { key: "1", label: `${recommended} (recommended)`, value: recommended },
      { key: "2", label: alternate, value: alternate },
      { key: "3", label: "Custom model ID", value: "__custom__" },
    ],
    currentMatches ? (current === alternate ? "2" : "1") : "1",
  );
  if (!selected) return null;
  if (selected === "__custom__") {
    const fallback = currentMatches ? current : recommended;
    const custom = await ctx.ui.input(
      "Step 4 - Custom Worker Model",
      [
        "Enter a custom model ID for worker-tier agents.",
        "",
        "This should be a valid model identifier for your chosen provider.",
        `Example: ${recommended}`,
        "",
        `Current: ${fallback}`,
      ].join("\n"),
      fallback,
    );
    return custom?.trim() || null;
  }
  return selected;
}

// --- Screen 5: Directory Mapping ---

const DIRECTORY_PROMPTS: Record<string, { title: string; who: string; examples: string[] }> = {
  frontend: {
    title: "Frontend Directory",
    who: "The Frontend Dev agent will read and write files in this directory.",
    examples: ["src/frontend/", "src/", "app/", "client/"],
  },
  backend: {
    title: "Backend Directory",
    who: "The Backend Dev agent will read and write files in this directory.",
    examples: ["src/backend/", "server/", "api/", "src/"],
  },
  tests: {
    title: "Tests Directory",
    who: "The QA Engineer agent will look for and create tests here.",
    examples: ["tests/", "test/", "__tests__/", "src/__tests__/"],
  },
  docs: {
    title: "Documentation Directory",
    who: "Agents with documentation access can read from this directory.",
    examples: ["docs/", "documentation/", "doc/"],
  },
  specs: {
    title: "Specifications Directory",
    who: "The Product Manager, UX Researcher, and Planning Lead use this directory for requirements and specifications.",
    examples: ["specs/", "planning/", "requirements/"],
  },
};

async function promptDirectory(
  ctx: ExtensionCommandContext,
  role: string,
  current: string,
) {
  const config = DIRECTORY_PROMPTS[role];
  const message = [
    `Where is your ${config.title.toLowerCase().replace(" directory", "")} code?`,
    "",
    config.who,
    "Enter a path relative to your project root.",
    "",
    `Examples: ${config.examples.join(", ")}`,
    "",
    "Press Enter to accept the default.",
  ].join("\n");

  const input = await ctx.ui.input(`Step 5 - ${config.title}`, message, current);
  if (!input) return null;
  return normalizeRelativeDir(input);
}

// --- Screen 6: Per-agent overrides ---

async function maybeOverrideAgents(ctx: ExtensionCommandContext, state: ConfigState) {
  const shouldOverride = await ctx.ui.confirm(
    "Step 6 - Advanced (Optional)",
    [
      "Per-agent model overrides",
      "",
      "All agents are set to use your chosen lead or worker model. If you",
      "want specific agents to use different models (for example, putting",
      "the Security Reviewer on a stronger model), you can override them",
      "one by one.",
      "",
      "Most users skip this step.",
      "",
      "Configure per-agent overrides?",
    ].join("\n"),
  );
  if (!shouldOverride) return;

  for (const agent of ALL_AGENTS) {
    const current = state.agentModels[agent];
    const shouldChange = await ctx.ui.confirm(
      `Step 6 - Override ${AGENT_DISPLAY_NAMES[agent]}`,
      [
        `Override model for ${AGENT_DISPLAY_NAMES[agent]}?`,
        "",
        `Current model: ${current}`,
        "",
        "Press y to change, or n to keep the current model.",
      ].join("\n"),
    );
    if (!shouldChange) continue;
    const custom = await ctx.ui.input(
      `Step 6 - ${AGENT_DISPLAY_NAMES[agent]} Model`,
      [
        `Enter a new model ID for ${AGENT_DISPLAY_NAMES[agent]}.`,
        "",
        `Current: ${current}`,
      ].join("\n"),
      current,
    );
    if (custom?.trim()) state.agentModels[agent] = custom.trim();
  }
}

// --- Screen 7: API Key ---

async function maybeSetupEnv(ctx: ExtensionCommandContext, state: ConfigState) {
  const provider = PROVIDERS[state.provider];
  const envFilePath = path.join(state.projectRoot, ".env");

  const shouldSetup = await ctx.ui.confirm(
    "Step 7 - API Key Setup (Optional)",
    [
      `Set up your ${provider.label} API key?`,
      "",
      `Your agents need ${provider.envVar} to call the ${provider.label} API.`,
      "Onboarding can add this to your project's .env file.",
      "",
      "Options:",
      "  - Add a placeholder (you fill in the real key later)",
      "  - Add the real value now",
      "  - Skip entirely",
      "",
      "Note: If you already have a key in .env, it will NOT be overwritten.",
      "",
      `Set up ${provider.envVar} in .env?`,
    ].join("\n"),
  );
  if (!shouldSetup) {
    state.envSetup = {
      enabled: false,
      envFilePath,
      envVar: provider.envVar,
      mode: "skip",
    };
    return;
  }

  const mode = await promptChoice(
    ctx,
    "Step 7 - API Key Setup",
    [
      `How should ${provider.envVar} be added to .env?`,
      "",
      `  1. Add placeholder (${provider.envVar}=your-key-here)`,
      "  2. Add real value now",
      "  3. Skip",
    ].join("\n"),
    [
      { key: "1", label: "Add placeholder", value: "placeholder" },
      { key: "2", label: "Add real value now", value: "value" },
      { key: "3", label: "Skip", value: "skip" },
    ],
    "1",
  );

  if (!mode || mode === "skip") {
    state.envSetup = {
      enabled: false,
      envFilePath,
      envVar: provider.envVar,
      mode: "skip",
    };
    return;
  }

  let value: string | undefined;
  if (mode === "value") {
    value = (await ctx.ui.input(
      "Step 7 - Enter API Key",
      [
        `Enter your ${provider.envVar} value.`,
        "",
        "This will be written to your .env file.",
        "Make sure you are pasting the correct key.",
      ].join("\n"),
      "",
    )) || undefined;
  }

  state.envSetup = {
    enabled: true,
    envFilePath,
    envVar: provider.envVar,
    mode: mode as "placeholder" | "value",
    value,
  };
}

// --- Final Review ---

function buildReview(state: ConfigState) {
  const provider = PROVIDERS[state.provider];
  const lines = [
    "Here is what onboarding will set up. Review before applying.",
    "",
    `  Project:  ${state.projectRoot}`,
    `  Provider: ${provider.label}`,
    "",
    `  Lead model (Orchestrator + 3 Leads):  ${state.leadModel}`,
    `  Worker model (6 Specialists):         ${state.workerModel}`,
    "",
    "Directory mapping:",
    `  Frontend -> ${state.directories.frontend}`,
    `  Backend  -> ${state.directories.backend}`,
    `  Tests    -> ${state.directories.tests}`,
    `  Docs     -> ${state.directories.docs}`,
    `  Specs    -> ${state.directories.specs}`,
    "",
    "Per-agent models:",
    ...ALL_AGENTS.map(
      (agent) => `  ${AGENT_DISPLAY_NAMES[agent].padEnd(20)} -> ${state.agentModels[agent]}`,
    ),
  ];

  if (state.envSetup && state.envSetup.enabled) {
    lines.push("");
    lines.push(`API key: ${state.envSetup.envVar} (${state.envSetup.mode} mode)`);
  }

  lines.push("");
  lines.push("This will update:");
  lines.push("  - .pi/multi-team/multi-team-config.yaml");
  lines.push("  - 10 agent files in .pi/multi-team/agents/");
  if (state.envSetup?.enabled) {
    lines.push(`  - ${state.envSetup.envFilePath}`);
  }
  lines.push("");
  lines.push("Backups will be created (.bak files) before any changes.");
  lines.push("");
  lines.push("Apply these changes?");

  return lines.join("\n");
}

// --- Main handler ---

export default function onboard(pi: ExtensionAPI) {
  pi.registerCommand("onboard", {
    description: "Run an interactive onboarding wizard for the multi-team Agent Pi config",
    handler: async (_args, ctx) => {
      try {
        // Screen 0: Welcome
        const ready = await showWelcome(ctx);
        if (!ready) {
          ctx.ui.notify("Setup cancelled.", "info");
          return;
        }

        // Screen 1: Project root
        const projectRoot = await promptForProjectRoot(ctx);
        if (!projectRoot) return;

        // Read existing state for smart defaults
        const current = readCurrentState(projectRoot);
        const suggested = suggestDirectories(projectRoot);

        // Screen 2: Provider
        const currentProvider = current.provider ?? "zai";
        const provider = await selectProvider(ctx, currentProvider);
        if (!provider) return;
        const providerDef: ProviderDef = PROVIDERS[provider];

        // Screen 3: Lead model
        const leadCurrent = current.agentModels?.orchestrator ?? providerDef.defaultLeadModel;
        const leadAlternate = provider === "zai" ? "zai/glm-5-turbo" : "anthropic/claude-sonnet-4-6";
        const leadModel = await chooseLeadModel(ctx, providerDef.defaultLeadModel, leadCurrent, leadAlternate);
        if (!leadModel) return;

        // Screen 4: Worker model
        const workerCurrent = current.agentModels?.["backend-dev"] ?? providerDef.defaultWorkerModel;
        const workerAlternate = provider === "zai" ? "zai/glm-5.1" : "anthropic/claude-opus-4-6";
        const workerModel = await chooseWorkerModel(ctx, providerDef.defaultWorkerModel, workerCurrent, workerAlternate);
        if (!workerModel) return;

        // Screen 5: Directory mapping
        const directories = {
          frontend: current.directories?.frontend ?? suggested.frontend ?? DEFAULT_DIRECTORIES.frontend,
          backend: current.directories?.backend ?? suggested.backend ?? DEFAULT_DIRECTORIES.backend,
          tests: current.directories?.tests ?? suggested.tests ?? DEFAULT_DIRECTORIES.tests,
          docs: current.directories?.docs ?? suggested.docs ?? DEFAULT_DIRECTORIES.docs,
          specs: current.directories?.specs ?? suggested.specs ?? DEFAULT_DIRECTORIES.specs,
        };

        for (const role of Object.keys(DIR_ROLE_LABELS) as Array<keyof typeof DIR_ROLE_LABELS>) {
          const chosen = await promptDirectory(ctx, role, directories[role]);
          if (!chosen) return;
          directories[role] = chosen;
        }

        // Build state
        const agentModels: Record<string, string> = {};
        for (const agent of LEAD_AGENTS) agentModels[agent] = leadModel;
        for (const agent of WORKER_AGENTS) agentModels[agent] = workerModel;

        const state: ConfigState = {
          projectRoot,
          provider,
          leadModel,
          workerModel,
          agentModels,
          directories,
        };

        // Screen 6: Per-agent overrides (optional)
        await maybeOverrideAgents(ctx, state);

        // Screen 7: API key (optional)
        await maybeSetupEnv(ctx, state);

        // Final review
        const confirmed = await ctx.ui.confirm("Review - Ready to Apply", buildReview(state));
        if (!confirmed) {
          ctx.ui.notify("Setup cancelled. No changes were made.", "info");
          return;
        }

        // Apply
        applyChanges(state);
        ctx.ui.notify(
          "Setup complete! Your 10-agent team is ready. Talk to the Orchestrator to get started.",
          "success",
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.ui.notify(`Onboarding failed: ${message}`, "error");
      }
    },
  });
}
