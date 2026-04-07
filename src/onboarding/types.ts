export type ProviderId = "zai" | "anthropic";
export type DirRoleId = "frontend" | "backend" | "tests" | "docs" | "specs";

export type EnvSetup = {
  enabled: boolean;
  envFilePath: string;
  envVar: string;
  mode: "placeholder" | "value" | "skip";
  value?: string;
};

export type ConfigState = {
  projectRoot: string;
  provider: ProviderId;
  leadModel: string;
  workerModel: string;
  agentModels: Record<string, string>;
  directories: Record<DirRoleId, string>;
  envSetup?: EnvSetup;
};

export type ProviderDef = {
  id: ProviderId;
  label: string;
  defaultLeadModel: string;
  defaultWorkerModel: string;
  apiBase: string | null;
  envVar: string;
};
