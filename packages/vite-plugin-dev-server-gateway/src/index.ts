export { ensureTrailingSlash } from "./resolve/base";
export { instanceFromEnv } from "./plugin/presets/from-env";
export { devServerGateway } from "./plugin/plugin";
export { resolvePreview } from "./resolve/resolve-preview";
export type {
  DevServerGatewayOptions,
  KeyStrategy,
  PreviewDiagnostics,
  PreviewKey,
  ResolvedPreview,
  ResolvePreviewOptions,
} from "./types";
