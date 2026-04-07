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

async function showIntro(ctx: ExtensionCommandContext) {
  const message = [
    "This onboarding wizard will configure the multi-team Agent Pi setup for a project.",
    "",
    "What you will be asked for:",
    "1. Project root directory",
    "2. Model provider",
    "3. Lead and worker model selection",
    "4. Directory mappings for frontend, backend, tests, docs, and specs",
    "5. Optional per-agent model overrides",
    "6. Optional .env provider key setup",
    "",
    "Important:",
    "- Step 1 is your target project directory",
    "- directory paths should be relative to that project root",
    "- you can cancel at any prompt",
    "",
    "Continue?",
  ].join("\n");

  return ctx.ui.confirm("Onboarding", message);
}

async function promptForProjectRoot(ctx: ExtensionCommandContext) {
  const result = await ctx.ui.input(
    "Onboarding - Step 1 of 6",
    "Enter the target project root directory",
    ctx.cwd,
  );
  if (!result) return null;
  return path.resolve(result.trim());
}

async function promptChoice(
  ctx: ExtensionCommandContext,
  title: string,
  prompt: string,
  options: Array<{ key: string; label: string; value: string }>,
  defaultKey: string,
) {
  const lines = [prompt, "", ...options.map((option) => `${option.key}. ${option.label}`), "", `Default: ${defaultKey}`];
  const value = await ctx.ui.input(title, lines.join("\n"), defaultKey);
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  const found = options.find((option) => option.key === normalized);
  if (found) return found.value;
  const directValue = options.find((option) => option.value.toLowerCase() === normalized);
  if (directValue) return directValue.value;
  throw new Error(`Invalid choice: ${value}`);
}

async function selectProvider(ctx: ExtensionCommandContext, current: ProviderId) {
  const value = await promptChoice(
    ctx,
    "Onboarding - Step 2 of 6",
    "Choose your model provider.",
    [
      { key: "1", label: "Z.ai", value: "zai" },
      { key: "2", label: "Anthropic", value: "anthropic" },
    ],
    current === "anthropic" ? "2" : "1",
  );
  return value ? (value as ProviderId) : null;
}

async function promptDirectory(ctx: ExtensionCommandContext, label: string, current: string) {
  const input = await ctx.ui.input(
    "Onboarding - Directory Mapping",
    `${label} path relative to the selected project root`,
    current,
  );
  if (!input) return null;
  return normalizeRelativeDir(input);
}

async function chooseTierModel(
  ctx: ExtensionCommandContext,
  title: string,
  recommended: string,
  current: string,
  alternate: string,
) {
  const currentMatches = current === recommended || current === alternate;
  const selected = await promptChoice(
    ctx,
    title,
    "Choose a model option.",
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
    const custom = await ctx.ui.input(title, "Enter a custom model ID", fallback);
    return custom?.trim() || null;
  }
  return selected;
}

async function maybeOverrideAgents(ctx: ExtensionCommandContext, state: ConfigState) {
  const shouldOverride = await ctx.ui.confirm(
    "Onboarding - Optional overrides",
    "Do you want to override models for individual agents?",
  );
  if (!shouldOverride) return;

  for (const agent of ALL_AGENTS) {
    const current = state.agentModels[agent];
    const shouldChange = await ctx.ui.confirm(
      "Onboarding - Per-agent override",
      `Override model for ${AGENT_DISPLAY_NAMES[agent]}?\n\nCurrent model: ${current}`,
    );
    if (!shouldChange) continue;
    const custom = await ctx.ui.input(
      "Onboarding - Per-agent override",
      `Enter model ID for ${AGENT_DISPLAY_NAMES[agent]}`,
      current,
    );
    if (custom?.trim()) state.agentModels[agent] = custom.trim();
  }
}

async function maybeSetupEnv(ctx: ExtensionCommandContext, state: ConfigState) {
  const provider = PROVIDERS[state.provider];
  const envFilePath = path.join(state.projectRoot, ".env");
  const shouldSetup = await ctx.ui.confirm(
    "Onboarding - Provider credentials",
    `Do you want onboarding to help set up ${provider.envVar} in .env?`,
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
    "Onboarding - Provider credentials",
    `How should ${provider.envVar} be added to .env?`,
    [
      { key: "1", label: "Add placeholder value", value: "placeholder" },
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
      "Onboarding - Provider credentials",
      `Enter value for ${provider.envVar}`,
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

function buildReview(state: ConfigState) {
  const provider = PROVIDERS[state.provider];
  const lines = [
    "Review your onboarding choices before applying.",
    "",
    `Project root: ${state.projectRoot}`,
    `Provider: ${provider.label}`,
    `Lead-tier model: ${state.leadModel}`,
    `Worker-tier model: ${state.workerModel}`,
    "",
    "Directories:",
    `  frontend -> ${state.directories.frontend}`,
    `  backend  -> ${state.directories.backend}`,
    `  tests    -> ${state.directories.tests}`,
    `  docs     -> ${state.directories.docs}`,
    `  specs    -> ${state.directories.specs}`,
    "",
    "Per-agent models:",
    ...ALL_AGENTS.map((agent) => `  ${AGENT_DISPLAY_NAMES[agent]} -> ${state.agentModels[agent]}`),
  ];
  if (state.envSetup && state.envSetup.enabled) {
    lines.push("");
    lines.push(`Env file: ${state.envSetup.envFilePath}`);
    lines.push(`Env var: ${state.envSetup.envVar}`);
    lines.push(`Env mode: ${state.envSetup.mode}`);
  }
  return lines.join("\n");
}

export default function onboard(pi: ExtensionAPI) {
  pi.registerCommand("onboard", {
    description: "Run an interactive onboarding wizard for the multi-team Agent Pi config",
    handler: async (_args, ctx) => {
      try {
        const continueOnboarding = await showIntro(ctx);
        if (!continueOnboarding) {
          ctx.ui.notify("Onboarding cancelled", "info");
          return;
        }

        const projectRoot = await promptForProjectRoot(ctx);
        if (!projectRoot) return;

        const current = readCurrentState(projectRoot);
        const suggested = suggestDirectories(projectRoot);
        const currentProvider = current.provider ?? "zai";
        const provider = await selectProvider(ctx, currentProvider);
        if (!provider) return;
        const providerDef: ProviderDef = PROVIDERS[provider];

        const leadCurrent = current.agentModels?.orchestrator ?? providerDef.defaultLeadModel;
        const workerCurrent = current.agentModels?.["backend-dev"] ?? providerDef.defaultWorkerModel;

        const leadModel = await chooseTierModel(
          ctx,
          "Onboarding - Step 3 of 6",
          providerDef.defaultLeadModel,
          leadCurrent,
          provider === "zai" ? "zai/glm-5-turbo" : "anthropic/claude-sonnet-4-6",
        );
        if (!leadModel) return;

        const workerModel = await chooseTierModel(
          ctx,
          "Onboarding - Step 4 of 6",
          providerDef.defaultWorkerModel,
          workerCurrent,
          provider === "zai" ? "zai/glm-5.1" : "anthropic/claude-opus-4-6",
        );
        if (!workerModel) return;

        const directories = {
          frontend: current.directories?.frontend ?? suggested.frontend ?? DEFAULT_DIRECTORIES.frontend,
          backend: current.directories?.backend ?? suggested.backend ?? DEFAULT_DIRECTORIES.backend,
          tests: current.directories?.tests ?? suggested.tests ?? DEFAULT_DIRECTORIES.tests,
          docs: current.directories?.docs ?? suggested.docs ?? DEFAULT_DIRECTORIES.docs,
          specs: current.directories?.specs ?? suggested.specs ?? DEFAULT_DIRECTORIES.specs,
        };

        for (const role of Object.keys(DIR_ROLE_LABELS) as Array<keyof typeof DIR_ROLE_LABELS>) {
          const chosen = await promptDirectory(ctx, DIR_ROLE_LABELS[role], directories[role]);
          if (!chosen) return;
          directories[role] = chosen;
        }

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

        await maybeOverrideAgents(ctx, state);
        await maybeSetupEnv(ctx, state);

        const confirmed = await ctx.ui.confirm("Onboarding - Final review", buildReview(state));
        if (!confirmed) {
          ctx.ui.notify("Onboarding cancelled", "info");
          return;
        }

        applyChanges(state);
        ctx.ui.notify("Onboarding applied successfully", "success");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.ui.notify(`Onboarding failed: ${message}`, "error");
      }
    },
  });
}
