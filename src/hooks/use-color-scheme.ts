import { useColorScheme as useNativeColorScheme } from "react-native";

export function useColorScheme(): "light" | "dark" {
  const scheme = useNativeColorScheme();

  return scheme === "dark" ? "dark" : "light";
}
