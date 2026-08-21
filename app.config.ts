import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  ios: {
    ...config.ios,
    bundleIdentifier:
      process.env.IOS_BUNDLE_IDENTIFIER?.trim() ||
      config.ios?.bundleIdentifier,
  },
});
