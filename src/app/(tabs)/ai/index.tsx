import { Stack, type Href, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Colors, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export default function AiManagementScreen() {
  const theme = useTheme();
  const colors = Colors[theme.mode];
  const router = useRouter();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: "AI Management", headerLargeTitle: true }} />
      <View style={styles.content}>
        <View style={styles.heading}>
          <Text style={[styles.kicker, { color: colors.accent }]}>ON-DEVICE AI</Text>
          <Text style={[styles.title, { color: colors.text }]}>AI Management</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Manage the speech and language models that run locally on this device.
          </Text>
        </View>

        <View style={styles.modelLinks}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Manage speech-to-text models"
            onPress={() => router.push("/ai/stt-models")}
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.cardText}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>STT Models</Text>
              <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>
                Speech recognition models for local transcription.
              </Text>
            </View>
            <View style={styles.cardAction}>
              <Text style={[styles.actionLabel, { color: colors.accent }]}>Manage</Text>
              <Text style={[styles.chevron, { color: colors.accent }]}>›</Text>
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Manage local language models"
            onPress={() => router.push("/ai/llm-models" as Href)}
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.cardText}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>LLM Models</Text>
              <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>
                Language models for private, on-device AI features.
              </Text>
            </View>
            <View style={styles.cardAction}>
              <Text style={[styles.actionLabel, { color: colors.accent }]}>Manage</Text>
              <Text style={[styles.chevron, { color: colors.accent }]}>›</Text>
            </View>
          </Pressable>
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
    minHeight: 92,
    padding: Spacing.md,
    width: "100%",
  },
  cardText: { flex: 1, gap: Spacing.xs },
  cardAction: { alignItems: "center", flexDirection: "row", gap: Spacing.xs },
  cardTitle: { fontSize: 17, fontWeight: "700" },
  cardSubtitle: { fontSize: 13, lineHeight: 18 },
  actionLabel: { fontSize: 14, fontWeight: "700" },
  chevron: { fontSize: 26, lineHeight: 26 },
  pressed: { opacity: 0.72 },
});
