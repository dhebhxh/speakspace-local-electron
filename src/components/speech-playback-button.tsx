import { UiText as Text } from "@/components/ui-text";
import { type Href, useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { Colors, Radius, Spacing } from "@/constants/theme";
import { useSpeechPlayback } from "@/hooks/use-speech-playback";
import { useTheme } from "@/hooks/use-theme";
import { useUiCopyTranslation } from "@/hooks/use-ui-copy-translation";

export function SpeechPlaybackButton({
  speechId,
  label,
  text,
}: {
  speechId: string;
  label: string;
  text: string;
}) {
  const colors = Colors[useTheme().mode];
  const tr = useUiCopyTranslation();
  const router = useRouter();
  const { service, state } = useSpeechPlayback();
  const isActive = state.speechId === speechId;
  const disabled = !isActive && state.inferenceBusy;
  const buttonLabel = tr(isActive
    ? state.phase === "error"
      ? "Try again"
      : "Stop"
    : "Read aloud");

  return (
    <View style={styles.wrapper}>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${buttonLabel}: ${label}`}
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={() => void service.speak({ id: speechId, label, text })}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: colors.accentSoft, borderColor: colors.border },
            disabled && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.glyph, { color: colors.accent }]}>{isActive && state.phase !== "error" ? "■" : "▶"}</Text>
          <Text style={[styles.label, { color: colors.accent }]}>{buttonLabel}</Text>
        </Pressable>
        {isActive && state.phase !== "idle" && state.phase !== "error" && (
          <Text style={[styles.status, { color: colors.textMuted }]}>{state.message}</Text>
        )}
      </View>

      {isActive && state.phase === "error" && (
        <View style={styles.errorRow}>
          <Text selectable style={[styles.error, { color: colors.danger }]}>{state.message}</Text>
          {state.errorCode === "missing-model" && (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/ai/tts-models" as Href)}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Text style={[styles.modelsLink, { color: colors.accent }]}>Open Text-to-Speech Models</Text>
            </Pressable>
          )}
        </View>
      )}
      {!isActive && disabled && (
        <Text style={[styles.status, { color: colors.textMuted }]}>Available when the current local operation finishes.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.xs },
  actions: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  button: { alignItems: "center", borderCurve: "continuous", borderRadius: Radius.sm, borderWidth: 1, flexDirection: "row", gap: 6, minHeight: 34, paddingHorizontal: Spacing.sm },
  glyph: { fontSize: 11, fontWeight: "900" },
  label: { fontSize: 12, fontWeight: "800" },
  status: { flexShrink: 1, fontSize: 11, lineHeight: 15 },
  errorRow: { alignItems: "flex-start", gap: 4 },
  error: { fontSize: 12, lineHeight: 17 },
  modelsLink: { fontSize: 12, fontWeight: "800" },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.65 },
});
