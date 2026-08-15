import { Colors } from "@/constants/theme";

import { useColorScheme } from "./use-color-scheme";

export function useTheme() {
  const mode = useColorScheme();

  return {
    mode,
    ...Colors[mode],
  };
}
