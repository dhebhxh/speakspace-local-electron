import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/app-button";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export default function Index() {
  const theme = useTheme();
  const colors = Colors[theme.mode];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.intro}>
        <Text style={[styles.eyebrow, { color: colors.accent }]}>
          SPEAKSPACE
        </Text>
        <Text style={[styles.title, { color: colors.text }]}>
          A calmer place for your thoughts.
        </Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Start with a workspace, then keep every note close to its context.
        </Text>
      </View>
      <Link href="/workspaces" asChild>
        <AppButton label="Open workspaces" />
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    padding: Spacing.xl,
    paddingBottom: Spacing.xxl,
    paddingTop: Spacing.xxl,
  },
  intro: {
    gap: Spacing.md,
    marginTop: Spacing.xxl,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 42,
    fontWeight: "800",
    lineHeight: 47,
    maxWidth: 420,
  },
  subtitle: {
    fontSize: 17,
    lineHeight: 26,
    maxWidth: 420,
  },
  button: {
    borderRadius: Radius.md,
  },
});
