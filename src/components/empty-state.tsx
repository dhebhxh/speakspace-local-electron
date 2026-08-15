import { StyleSheet, Text, View } from "react-native";

import { Colors, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

type EmptyStateProps = {
  title: string;
  action?: React.ReactNode;
};

export function EmptyState({ title, action }: EmptyStateProps) {
  const theme = useTheme();
  const colors = Colors[theme.mode];

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceMuted }]}>
      <Text style={[styles.title, { color: colors.textMuted }]}>{title}</Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    borderRadius: Radius.md,
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
  },
});
