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

// ---------------------------------------------------------------------------
// Shared: Show explanation as a confirm dialog, then collect input separately.
//
// ctx.ui.confirm(title, message) renders the message as visible body text.
// ctx.ui.input(title, placeholder) only shows the placeholder dimly inside
// the input field. So any guidance the user needs to see MUST go through
// confirm(), not input().
// ---------------------------------------------------------------------------

async function guidedInput(
  ctx: ExtensionCommandContext,
  explainTitle: string,
  explainMessage: string,
  inputTitle: string,
  inputPlaceholder: string,
): Promise<string | null> {
  const understood = await ctx.ui.confirm(explainTitle, explainMessage);
  if (!understood) return null;
  const result = await ctx.ui.input(inputTitle, inputPlaceholder);
  return result?.trim() || null;
}

async function guidedChoice(
  ctx: ExtensionCommandContext,
  explainTitle: string,
  explainMessage: string,
  inputTitle: string,
  options: Array<{ key: string; label: string; value: string }>,
  defaultKey: string,
): Promise<string | null> {
  const understood = await ctx.ui.confirm(explainTitle, explainMessage);
  if (!understood) return null;
  const hint = options.map((o) => `  ${o.key}. ${o.label}`).join("\n");
  const result = await ctx.ui.input(inputTitle, `Type ${options.map((o) => o.key).join(", ")}. Default: ${defaultKey}\n\n${hint}`);
  if (!result) return null;
  const normalized = result.trim().toLowerCase();
  const found = options.find((o) => o.key === normalized);
  if (found) return found.value;
  const directValue = options.find((o) => o.value.toLowerCase() === normalized);
  if (directValue) return directValue.value;
  throw new Error(`Invalid choice: "${result}". Please enter ${options.map((o) => o.key).join(", ")}.`);
}

// ---------------------------------------------------------------------------
// Screen 0: Welcome
// ---------------------------------------------------------------------------

async function showWelcome(ctx: ExtensionCommandContext) {
  return ctx.ui.confirm(
    "Multi-Team Agent Pi Setup",
    [
      "Welcome to Multi-Team Agent Pi Setup",
      "",
      "This wizard configures a 10-agent coding team for your project.",
      "When finished, your agents will know which project to work on,",
      "which AI models to use, and where your code lives.",
      "",
      "The team:",
      "  - 1 Orchestrator (receives your requests, delegates to teams)",
      "  - 3 Team Leads (Planning, Engineering, Validation)",
      "  - 6 Workers (Product Manager, UX Researcher, Frontend Dev,",
      "    Backend Dev, QA Engineer, Security Reviewer)",
      "",
      "What you will provide:",
      "  Step 1  - Your project's root folder path",
      "  Step 2  - Which AI provider to use (Z.ai or Anthropic)",
      "  Step 3  - Which model leads should use",
      "  Step 4  - Which model workers should use",
      "  Step 5  - Where your code directories are",
      "  Step 6  - Optional per-agent model overrides",
      "  Step 7  - Optional API key setup",
      "",
      "This takes about 2 minutes. Press y to start, or n to cancel.",
    ].join("\n"),
  );
}

// ---------------------------------------------------------------------------
// Screen 1: Project Root
// ---------------------------------------------------------------------------

async function promptForProjectRoot(ctx: ExtensionCommandContext) {
  const ok = await ctx.ui.confirm(
    "Step 1 of 7 - Project Root",
    [
      "Which project should these agents work on?",
      "",
      "Enter the full path to your project's root folder.",
      "This is the folder that contains your main config files",
      "(package.json, Cargo.toml, pyproject.toml, etc.) and top-level",
      "source directories.",
      "",
      "What to type in the next screen: a full directory path",
      "",
      "Examples:",
      "  /Users/you/projects/my-app",
      "  /home/dev/work/api-server",
      "  C:\\Users\\you\\projects\\my-app",
      "",
      "Tip: You can press Enter to accept the default path.",
      "",
      "Press y to continue.",
    ].join("\n"),
  );
  if (!ok) return null;

  const result = await ctx.ui.input(
    "Step 1 - Enter Project Root Path",
    ctx.cwd,
  );
  if (!result) return null;
  return path.resolve(result.trim());
}

// ---------------------------------------------------------------------------
// Screen 2: Provider
// ---------------------------------------------------------------------------

async function selectProvider(ctx: ExtensionCommandContext, current: ProviderId) {
  const value = await guidedChoice(
    ctx,
    "Step 2 of 7 - AI Model Provider",
    [
      "Which AI service should power your agents?",
      "",
      "This determines which language models your agents use and which",
      "API key you will need.",
      "",
      "Your two options:",
      "",
      "  1. Z.ai",
      "     Provider of GLM models. Uses API key ZAI_API_KEY.",
      "     Default lead model:   zai/glm-5.1",
      "     Default worker model: zai/glm-5-turbo",
      "",
      "  2. Anthropic",
      "     Provider of Claude models. Uses API key ANTHROPIC_API_KEY.",
      "     Default lead model:   anthropic/claude-opus-4-6",
      "     Default worker model: anthropic/claude-sonnet-4-6",
      "",
      "What to type in the next screen: 1 or 2",
      "",
      "Press y to continue.",
    ].join("\n"),
    "Step 2 - Choose Provider",
    [
      { key: "1", label: "Z.ai (GLM-5.1, GLM-5 Turbo)", value: "zai" },
      { key: "2", label: "Anthropic (Claude Opus, Claude Sonnet)", value: "anthropic" },
    ],
    current === "anthropic" ? "2" : "1",
  );
  return value ? (value as ProviderId) : null;
}

// ---------------------------------------------------------------------------
// Screen 3: Lead Model
// ---------------------------------------------------------------------------

async function chooseLeadModel(
  ctx: ExtensionCommandContext,
  provider: ProviderId,
  recommended: string,
  current: string,
  alternate: string,
) {
  const providerLabel = provider === "zai" ? "Z.ai" : "Anthropic";

  const modelGuide = [
    "  The 4 available models:",
    "",
    "    zai/glm-5.1               -- GLM 5.1       (Z.ai's strongest, best for leads)",
    "    zai/glm-5-turbo           -- GLM 5 Turbo   (Z.ai's faster model, good for workers)",
    "    anthropic/claude-opus-4-6  -- Claude Opus   (Anthropic's strongest)",
    "    anthropic/claude-sonnet-4-6 -- Claude Sonnet (Anthropic's fast model)",
  ];

  const ok = await ctx.ui.confirm(
    "Step 3 of 7 - Lead Model",
    [
      "Choose the model for your lead-tier agents.",
      "",
      "These 4 agents handle coordination and planning:",
      "  - Orchestrator    (delegates your requests to teams)",
      "  - Planning Lead   (strategy, specs, requirements)",
      "  - Engineering Lead (architecture, code decisions)",
      "  - Validation Lead  (quality, security, testing)",
      "",
      "Leads need stronger reasoning, so pick the most capable model.",
      "",
      ...modelGuide,
      "",
      `Your provider is ${providerLabel}. Recommended lead model: ${recommended}`,
      "",
      "What to type in the next screen: 1, 2, or 3",
      "",
      "Press y to continue.",
    ].join("\n"),
  );
  if (!ok) return null;

  const currentMatches = current === recommended || current === alternate;
  const defaultKey = currentMatches ? (current === alternate ? "2" : "1") : "1";

  const options = [
    { key: "1", label: `${recommended} (recommended)`, value: recommended },
    { key: "2", label: alternate, value: alternate },
    { key: "3", label: "Custom model ID", value: "__custom__" },
  ];

  const hint = options.map((o) => `  ${o.key}. ${o.label}`).join("\n");
  const result = await ctx.ui.input(
    "Step 3 - Choose Lead Model",
    `Type 1, 2, or 3. Default: ${defaultKey}\n\n${hint}`,
  );

  if (!result) return null;
  const normalized = result.trim().toLowerCase();
  const found = options.find((o) => o.key === normalized);
  const selected = found
    ? found.value
    : options.find((o) => o.value.toLowerCase() === normalized)?.value;

  if (!selected) throw new Error(`Invalid choice: "${result}". Type 1, 2, or 3.`);
  if (selected === "__custom__") {
    const fallback = currentMatches ? current : recommended;
    const customOk = await ctx.ui.confirm(
      "Step 3 - Custom Lead Model",
      [
        "Enter a custom model ID for all lead-tier agents.",
        "",
        "Copy and paste one of these exactly as shown:",
        "  zai/glm-5.1",
        "  zai/glm-5-turbo",
        "  anthropic/claude-opus-4-6",
        "  anthropic/claude-sonnet-4-6",
        "",
        "Or enter any valid model ID for your provider.",
        "",
        "Press y to continue.",
      ].join("\n"),
    );
    if (!customOk) return null;
    const custom = await ctx.ui.input("Step 3 - Enter Custom Lead Model ID", fallback);
    return custom?.trim() || null;
  }
  return selected;
}

// ---------------------------------------------------------------------------
// Screen 4: Worker Model
// ---------------------------------------------------------------------------

async function chooseWorkerModel(
  ctx: ExtensionCommandContext,
  provider: ProviderId,
  recommended: string,
  current: string,
  alternate: string,
) {
  const providerLabel = provider === "zai" ? "Z.ai" : "Anthropic";

  const modelGuide = [
    "  The 4 available models:",
    "",
    "    zai/glm-5.1               -- GLM 5.1       (Z.ai's strongest)",
    "    zai/glm-5-turbo           -- GLM 5 Turbo   (Z.ai's faster model, good for workers)",
    "    anthropic/claude-opus-4-6  -- Claude Opus   (Anthropic's strongest)",
    "    anthropic/claude-sonnet-4-6 -- Claude Sonnet (Anthropic's fast model)",
  ];

  const ok = await ctx.ui.confirm(
    "Step 4 of 7 - Worker Model",
    [
      "Choose the model for your worker-tier agents.",
      "",
      "These 6 agents do focused, specialized work:",
      "  - Product Manager    (requirements, user stories)",
      "  - UX Researcher      (personas, usability)",
      "  - Frontend Dev       (UI, client-side code)",
      "  - Backend Dev        (APIs, databases, infrastructure)",
      "  - QA Engineer        (testing, edge cases)",
      "  - Security Reviewer  (vulnerabilities, auth)",
      "",
      "Workers handle specific tasks, so a faster model is often a good fit.",
      "",
      ...modelGuide,
      "",
      `Your provider is ${providerLabel}. Recommended worker model: ${recommended}`,
      "",
      "What to type in the next screen: 1, 2, or 3",
      "",
      "Press y to continue.",
    ].join("\n"),
  );
  if (!ok) return null;

  const currentMatches = current === recommended || current === alternate;
  const defaultKey = currentMatches ? (current === alternate ? "2" : "1") : "1";

  const options = [
    { key: "1", label: `${recommended} (recommended)`, value: recommended },
    { key: "2", label: alternate, value: alternate },
    { key: "3", label: "Custom model ID", value: "__custom__" },
  ];

  const hint = options.map((o) => `  ${o.key}. ${o.label}`).join("\n");
  const result = await ctx.ui.input(
    "Step 4 - Choose Worker Model",
    `Type 1, 2, or 3. Default: ${defaultKey}\n\n${hint}`,
  );

  if (!result) return null;
  const normalized = result.trim().toLowerCase();
  const found = options.find((o) => o.key === normalized);
  const selected = found
    ? found.value
    : options.find((o) => o.value.toLowerCase() === normalized)?.value;

  if (!selected) throw new Error(`Invalid choice: "${result}". Type 1, 2, or 3.`);
  if (selected === "__custom__") {
    const fallback = currentMatches ? current : recommended;
    const customOk = await ctx.ui.confirm(
      "Step 4 - Custom Worker Model",
      [
        "Enter a custom model ID for all worker-tier agents.",
        "",
        "Copy and paste one of these exactly as shown:",
        "  zai/glm-5.1",
        "  zai/glm-5-turbo",
        "  anthropic/claude-opus-4-6",
        "  anthropic/claude-sonnet-4-6",
        "",
        "Or enter any valid model ID for your provider.",
        "",
        "Press y to continue.",
      ].join("\n"),
    );
    if (!customOk) return null;
    const custom = await ctx.ui.input("Step 4 - Enter Custom Worker Model ID", fallback);
    return custom?.trim() || null;
  }
  return selected;
}

// ---------------------------------------------------------------------------
// Screen 5: Directory Mapping (5 prompts)
// ---------------------------------------------------------------------------

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
    who: "The Product Manager, UX Researcher, and Planning Lead use this\n  directory for requirements and specifications.",
    examples: ["specs/", "planning/", "requirements/"],
  },
};

async function promptDirectory(
  ctx: ExtensionCommandContext,
  role: string,
  current: string,
) {
  const config = DIRECTORY_PROMPTS[role];
  const ok = await ctx.ui.confirm(
    `Step 5 - ${config.title}`,
    [
      `Where is your ${config.title.toLowerCase().replace(" directory", "")} code?`,
      "",
      config.who,
      "",
      "Enter a path relative to your project root.",
      "The path must end with a slash.",
      "",
      `What to type in the next screen: a relative folder path`,
      "",
      `Examples: ${config.examples.join(", ")}`,
      "",
      "You can press Enter to accept the default.",
      "",
      "Press y to continue.",
    ].join("\n"),
  );
  if (!ok) return null;

  const input = await ctx.ui.input(
    `Step 5 - Enter ${config.title} Path`,
    current,
  );
  if (!input) return null;
  return normalizeRelativeDir(input);
}

// ---------------------------------------------------------------------------
// Screen 6: Per-agent overrides (optional)
// ---------------------------------------------------------------------------

async function maybeOverrideAgents(ctx: ExtensionCommandContext, state: ConfigState) {
  const shouldOverride = await ctx.ui.confirm(
    "Step 6 of 7 - Advanced (Optional)",
    [
      "Per-agent model overrides",
      "",
      "Right now all leads use the same model and all workers use the same",
      "model. If you want a specific agent on a different model (for example,",
      "putting the Security Reviewer on a stronger model), you can override",
      "them individually.",
      "",
      "Most users skip this.",
      "",
      "What to type: y to configure overrides, n to skip",
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
        "What to type: y to change, n to keep current model",
      ].join("\n"),
    );
    if (!shouldChange) continue;
    const customOk = await ctx.ui.confirm(
      `Step 6 - ${AGENT_DISPLAY_NAMES[agent]} Model`,
      [
        `Enter a new model ID for ${AGENT_DISPLAY_NAMES[agent]}.`,
        "",
        "Copy and paste one of these exactly as shown:",
        "  zai/glm-5.1",
        "  zai/glm-5-turbo",
        "  anthropic/claude-opus-4-6",
        "  anthropic/claude-sonnet-4-6",
        "",
        `Current: ${current}`,
        "",
        "Press y to continue.",
      ].join("\n"),
    );
    if (!customOk) continue;
    const custom = await ctx.ui.input(
      `Step 6 - Enter Model ID for ${AGENT_DISPLAY_NAMES[agent]}`,
      current,
    );
    if (custom?.trim()) state.agentModels[agent] = custom.trim();
  }
}

// ---------------------------------------------------------------------------
// Screen 7: API Key (optional)
// ---------------------------------------------------------------------------

async function maybeSetupEnv(ctx: ExtensionCommandContext, state: ConfigState) {
  const provider = PROVIDERS[state.provider];
  const envFilePath = path.join(state.projectRoot, ".env");

  const shouldSetup = await ctx.ui.confirm(
    "Step 7 of 7 - API Key Setup (Optional)",
    [
      `Set up your ${provider.label} API key?`,
      "",
      `Your agents need ${provider.envVar} to call the ${provider.label} API.`,
      "Onboarding can add this to your project's .env file.",
      "",
      "Your choices in the next screen:",
      "  1. Add placeholder -- writes your-key-here (safe, edit later)",
      "  2. Add real value  -- paste your actual key now",
      "  3. Skip            -- do not touch .env",
      "",
      "Note: If you already have a key in .env, it will NOT be overwritten.",
      "",
      "What to type: y to set up, n to skip",
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

  const mode = await guidedChoice(
    ctx,
    "Step 7 - How to Add API Key",
    [
      `How should ${provider.envVar} be added to .env?`,
      "",
      "  1. Add placeholder -- writes your-key-here (safe, edit later)",
      "  2. Add real value  -- paste your actual key now",
      "  3. Skip            -- do not touch .env",
      "",
      "What to type in the next screen: 1, 2, or 3",
      "",
      "Press y to continue.",
    ].join("\n"),
    "Step 7 - Choose Option",
    [
      { key: "1", label: "Add placeholder (safe, edit later)", value: "placeholder" },
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
    const pasteOk = await ctx.ui.confirm(
      "Step 7 - Paste Your API Key",
      [
        `Paste your ${provider.envVar} value in the next screen.`,
        "",
        "This will be written to your .env file.",
        "",
        "Press y to continue.",
      ].join("\n"),
    );
    if (!pasteOk) {
      state.envSetup = {
        enabled: false,
        envFilePath,
        envVar: provider.envVar,
        mode: "skip",
      };
      return;
    }
    value = (await ctx.ui.input(
      "Step 7 - Paste API Key",
      `Paste your ${provider.envVar} here`,
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

// ---------------------------------------------------------------------------
// Final Review
// ---------------------------------------------------------------------------

function buildReview(state: ConfigState) {
  const provider = PROVIDERS[state.provider];
  const lines = [
    "Review your choices before applying.",
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
  lines.push("Backups (.bak) will be created before any changes are made.");
  lines.push("");
  lines.push("What to type: y to apply, n to cancel");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export default function onboard(pi: ExtensionAPI) {
  pi.registerCommand("onboard", {
    description: "Run an interactive onboarding wizard for the multi-team Agent Pi config",
    handler: async (_args, ctx) => {
      try {
        // Screen 0: Welcome
        const ready = await showWelcome(ctx);
        if (!ready) {
          ctx.ui.notify("Setup cancelled. No changes were made.", "info");
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
        const leadModel = await chooseLeadModel(ctx, provider, providerDef.defaultLeadModel, leadCurrent, leadAlternate);
        if (!leadModel) return;

        // Screen 4: Worker model
        const workerCurrent = current.agentModels?.["backend-dev"] ?? providerDef.defaultWorkerModel;
        const workerAlternate = provider === "zai" ? "zai/glm-5.1" : "anthropic/claude-opus-4-6";
        const workerModel = await chooseWorkerModel(ctx, provider, providerDef.defaultWorkerModel, workerCurrent, workerAlternate);
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
