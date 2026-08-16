import { Link, Stack, type Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Colors, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export default function AiManagementScreen() {
  const theme = useTheme();
  const colors = Colors[theme.mode];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{ title: "AI Management", headerLargeTitle: true }}
      />
      <View style={styles.content}>
        <View style={styles.heading}>
          <Text style={[styles.kicker, { color: colors.accent }]}>
            ON-DEVICE AI
          </Text>
          <Text style={[styles.title, { color: colors.text }]}>
            AI Management
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Manage the speech and language models that run locally on this device.
          </Text>
        </View>

        <View style={styles.modelLinks}>
          <Link href="/ai/stt-models" asChild>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.cardText}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  STT Models
                </Text>
                <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>
                  Download, switch, and remove speech-to-text models.
                </Text>
              </View>
              <Text style={[styles.chevron, { color: colors.textMuted }]}>›</Text>
            </Pressable>
          </Link>

          <Link href={"/ai/llm-models" as Href} asChild>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.cardText}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>LLM Models</Text>
                <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>
                  Download, switch, and remove local language models.
                </Text>
              </View>
              <Text style={[styles.chevron, { color: colors.textMuted }]}>›</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: Spacing.xl, padding: Spacing.lg, paddingBottom: Spacing.xxl },
  heading: { gap: Spacing.xs },
  kicker: { fontSize: 12, fontWeight: "800", letterSpacing: 1.4 },
  title: { fontSize: 34, fontWeight: "800" },
  subtitle: { fontSize: 15, lineHeight: 22 },
  modelLinks: { gap: Spacing.md },
  card: {
    alignItems: "center",
    borderRadius: Radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: Spacing.md,
    padding: Spacing.md,
  },
  cardText: { flex: 1, gap: Spacing.xs },
  cardTitle: { fontSize: 17, fontWeight: "700" },
  cardSubtitle: { fontSize: 13 },
  chevron: { fontSize: 26, lineHeight: 26 },
  pressed: { opacity: 0.72 },
});
