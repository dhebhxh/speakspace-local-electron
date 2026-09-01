import { UiText as Text } from "@/components/ui-text";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SymbolView } from "expo-symbols";
import { type Href, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Backgrounds, Colors, Radius, Shadows, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useUiLanguage } from "@/hooks/use-ui-language";
import { UI_LANGUAGES, type UiLanguage } from "@/localization/i18n";
import type { ThemePreference } from "@/providers/theme-provider";

export default function SettingsScreen() {
  const theme = useTheme();
  const colors = Colors[theme.mode];
  const insets = useSafeAreaInsets();
  const { language, languageNames, savingLanguage, setLanguage, t } = useUiLanguage();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<ThemePreference | null>(null);
  const options: readonly { value: ThemePreference; label: string; detail: string }[] = [
    { value: "light", label: t("settings.light"), detail: t("settings.lightDescription") },
    { value: "dark", label: t("settings.dark"), detail: t("settings.darkDescription") },
    { value: "system", label: t("settings.system"), detail: t("settings.systemDescription") },
  ];
  const router = useRouter();

  const choose = async (preference: ThemePreference) => {
    if (saving !== null || preference === theme.preference) return;
    setError(null);
    setSaving(preference);
    try {
      await theme.setPreference(preference);
    } catch {
      setError(t("settings.appearanceSaveError"));
    } finally {
      setSaving(null);
    }
  };

  const chooseLanguage = async (next: UiLanguage) => {
    if (savingLanguage !== null || next === language) return;
    setError(null);
    try {
      await setLanguage(next);
    } catch {
      setError(t("settings.languageSaveError"));
    }
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{
        backgroundColor: colors.background,
        experimental_backgroundImage: Backgrounds[theme.mode],
      }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + 76 },
      ]}
    >
      <View style={styles.heading}>
        <Text style={[styles.kicker, { color: colors.accent }]}>{t("settings.kicker")}</Text>
        <Text style={[styles.title, { color: colors.text }]}>{t("settings.appearance")}</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t("settings.appearanceDescription")}</Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {options.map((option, index) => {
          const selected = theme.preference === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled: saving !== null }}
              disabled={saving !== null}
              onPress={() => void choose(option.value)}
              style={({ pressed }) => [
                styles.option,
                index > 0 && { borderTopColor: colors.border, borderTopWidth: 1 },
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.optionCopy}>
                <Text style={[styles.optionLabel, { color: colors.text }]}>{option.label}</Text>
                <Text style={[styles.optionDetail, { color: colors.textMuted }]}>{option.detail}</Text>
              </View>
              <View style={[styles.radio, { borderColor: selected ? colors.accent : colors.border }]}>
                {selected && <View style={[styles.radioDot, { backgroundColor: colors.accent }]} />}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.heading}>
        <Text style={[styles.title, styles.sectionTitle, { color: colors.text }]}>{t("settings.language")}</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t("settings.languageDescription")}</Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {UI_LANGUAGES.map((option, index) => {
          const selected = language === option;
          return (
            <Pressable
              key={option}
              accessibilityLabel={languageNames[option]}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled: savingLanguage !== null }}
              disabled={savingLanguage !== null}
              onPress={() => void chooseLanguage(option)}
              style={({ pressed }) => [
                styles.languageOption,
                index > 0 && { borderTopColor: colors.border, borderTopWidth: 1 },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.optionLabel, { color: colors.text }]}>{languageNames[option]}</Text>
              <View style={[styles.radio, { borderColor: selected ? colors.accent : colors.border }]}>
                {selected && <View style={[styles.radioDot, { backgroundColor: colors.accent }]} />}
              </View>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.scopeNote, { color: colors.textMuted }]}>{t("settings.languageScope")}</Text>

      {error && <Text selectable style={[styles.error, { color: colors.danger }]}>{error}</Text>}

      <View style={styles.heading}>
        <Text style={[styles.title, styles.sectionTitle, { color: colors.text }]}>Data</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open Trash"
        onPress={() => router.push("/trash" as Href)}
        style={({ pressed }) => [styles.trashCard, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}
      >
        <View style={[styles.trashIcon, { backgroundColor: colors.surfaceMuted }]}>
          <SymbolView name="trash" size={22} tintColor={colors.text} />
        </View>
        <View style={styles.optionCopy}>
          <Text style={[styles.optionLabel, { color: colors.text }]}>Trash</Text>
          <Text style={[styles.optionDetail, { color: colors.textMuted }]}>Restore or permanently delete removed items.</Text>
        </View>
        <Text style={[styles.chevron, { color: colors.accent }]}>›</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, gap: Spacing.lg, paddingHorizontal: Spacing.lg },
  heading: { gap: Spacing.xs },
  kicker: { fontSize: 12, fontWeight: "800", letterSpacing: 1.4 },
  title: { fontSize: 36, fontWeight: "800", lineHeight: 42 },
  subtitle: { fontSize: 15, lineHeight: 21 },
  card: { borderCurve: "continuous", borderRadius: Radius.lg, borderWidth: 1, boxShadow: Shadows.card, overflow: "hidden" },
  option: { alignItems: "center", flexDirection: "row", gap: Spacing.md, minHeight: 78, padding: Spacing.md },
  languageOption: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 56, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  optionCopy: { flex: 1, gap: 3 },
  optionLabel: { fontSize: 17, fontWeight: "800" },
  optionDetail: { fontSize: 13, lineHeight: 18 },
  radio: { alignItems: "center", borderRadius: 11, borderWidth: 2, height: 22, justifyContent: "center", width: 22 },
  radioDot: { borderRadius: 6, height: 12, width: 12 },
  error: { fontSize: 13, lineHeight: 18 },
  scopeNote: { fontSize: 13, lineHeight: 19 },
  pressed: { opacity: 0.72 },
  sectionTitle: { fontSize: 24, lineHeight: 30 },
  trashCard: { alignItems: "center", borderCurve: "continuous", borderRadius: Radius.lg, borderWidth: 1, boxShadow: Shadows.card, flexDirection: "row", gap: Spacing.md, minHeight: 78, padding: Spacing.md },
  trashIcon: { alignItems: "center", borderRadius: Radius.sm, height: 42, justifyContent: "center", width: 42 },
  chevron: { fontSize: 28, lineHeight: 28 },
});
