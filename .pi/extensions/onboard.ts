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

async function promptForProjectRoot(ctx: ExtensionCommandContext) {
  const result = await ctx.ui.input("Onboarding", "Enter the target project root", ctx.cwd);
  if (!result) return null;
  return path.resolve(result.trim());
}

async function selectProvider(ctx: ExtensionCommandContext, current: ProviderId) {
  const value = await ctx.ui.select(
    "Onboarding",
    "Select model provider",
    [
      { value: "zai", label: "Z.ai" },
      { value: "anthropic", label: "Anthropic" },
    ],
    current,
  );
  return value ? (value as ProviderId) : null;
}

async function promptDirectory(
  ctx: ExtensionCommandContext,
  label: string,
  current: string,
) {
  const input = await ctx.ui.input("Onboarding", `${label} path relative to project root`, current);
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
  const choice = await ctx.ui.select(
    "Onboarding",
    title,
    [
      { value: recommended, label: `${recommended} (recommended)` },
      { value: alternate, label: alternate },
      { value: "__custom__", label: "Custom model ID" },
    ],
    current === recommended || current === alternate ? current : "__custom__",
  );
  if (!choice) return null;
  if (choice === "__custom__") {
    const custom = await ctx.ui.input("Onboarding", `${title} - custom model ID`, current);
    return custom?.trim() || null;
  }
  return choice;
}

async function maybeOverrideAgents(ctx: ExtensionCommandContext, state: ConfigState) {
  const shouldOverride = await ctx.ui.confirm(
    "Per-agent overrides",
    "Do you want to override models for individual agents?",
  );
  if (!shouldOverride) return;
  for (const agent of ALL_AGENTS) {
    const current = state.agentModels[agent];
    const shouldChange = await ctx.ui.confirm(
      "Per-agent override",
      `Override model for ${AGENT_DISPLAY_NAMES[agent]}?\nCurrent: ${current}`,
    );
    if (!shouldChange) continue;
    const custom = await ctx.ui.input("Onboarding", `Model for ${AGENT_DISPLAY_NAMES[agent]}`, current);
    if (custom?.trim()) state.agentModels[agent] = custom.trim();
  }
}

async function maybeSetupEnv(ctx: ExtensionCommandContext, state: ConfigState) {
  const provider = PROVIDERS[state.provider];
  const envFilePath = path.join(state.projectRoot, ".env");
  const shouldSetup = await ctx.ui.confirm(
    "Provider credentials",
    `Do you want onboarding to set up ${provider.envVar} in .env?`,
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

  const mode = await ctx.ui.select(
    "Onboarding",
    `How should ${provider.envVar} be added?`,
    [
      { value: "placeholder", label: "Add placeholder value" },
      { value: "value", label: "Add real value now" },
      { value: "skip", label: "Skip" },
    ],
    "placeholder",
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
    value = (await ctx.ui.input("Onboarding", `Enter value for ${provider.envVar}`, "")) || undefined;
  }

  state.envSetup = {
    enabled: true,
    envFilePath,
    envVar: provider.envVar,
    mode: mode as "placeholder" | "value",
    value,
  };
}

export function buildReview(state: ConfigState) {
  const provider = PROVIDERS[state.provider];
  const lines = [
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
          "Choose model for Orchestrator + Leads",
          providerDef.defaultLeadModel,
          leadCurrent,
          provider === "zai" ? "zai/glm-5-turbo" : "anthropic/claude-sonnet-4-6",
        );
        if (!leadModel) return;

        const workerModel = await chooseTierModel(
          ctx,
          "Choose model for Workers",
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

        const confirmed = await ctx.ui.confirm("Review onboarding plan", buildReview(state));
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
