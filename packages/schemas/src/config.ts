import type { ModelProfile } from "./model.js";

export interface ProviderConfig {
  provider: string;
  model: string;
}

export interface RuntimeConfig {
  defaultProfile: ModelProfile;
  profiles: Record<ModelProfile, ProviderConfig>;
  maxToolRetries?: number;
  workingDirectoryPolicy?: "repo_only" | "explicit_paths";
  eventArtifactPath?: string;
}
