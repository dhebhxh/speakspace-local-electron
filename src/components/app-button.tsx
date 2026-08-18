import { Pressable, StyleSheet, Text, type PressableProps } from "react-native";

import { Colors, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

type AppButtonProps = Omit<PressableProps, "style"> & {
  label: string;
  variant?: "primary" | "secondary" | "quiet";
};

export function AppButton({
  label,
  variant = "primary",
  disabled,
  hitSlop,
  ...props
}: AppButtonProps) {
  const theme = useTheme();
  const colors = Colors[theme.mode];

  return (
    <Pressable
      {...props}
      accessibilityRole="button"
      disabled={disabled}
      hitSlop={hitSlop ?? 4}
      style={({ pressed }) => [
        styles.base,
        variant === "primary" && { backgroundColor: colors.accent },
        variant === "secondary" && {
          backgroundColor: colors.accentSoft,
          borderColor: colors.border,
          borderWidth: 1,
        },
        variant === "quiet" && styles.quiet,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text
        style={[
          styles.label,
          { color: variant === "primary" ? colors.surface : colors.accent },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 46,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  quiet: {
    paddingHorizontal: Spacing.sm,
  },
  label: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  pressed: {
    opacity: 0.72,
  },
  disabled: {
    opacity: 0.45,
  },
});
