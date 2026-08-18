import { Pressable, StyleSheet, Text, View } from "react-native";

import { Colors, Radius, Spacing } from "@/constants/theme";
import { Note } from "@/domain/note/note";
import { useTheme } from "@/hooks/use-theme";
import { formatDate } from "@/utils/format-date";

type NoteCardProps = {
  note: Note;
  onPress: () => void;
};

export function NoteCard({ note, onPress }: NoteCardProps) {
  const theme = useTheme();
  const colors = Colors[theme.mode];
  const title = note.getName() || "Untitled note";
  const preview = note.getTranscript().replace(/\s+/g, " ").trim();

  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        {note.getIsPinned() && (
          <Text style={[styles.pin, { color: colors.accent }]}>Pinned</Text>
        )}
      </View>
      <Text
        style={[styles.preview, { color: colors.textMuted }]}
        numberOfLines={3}
      >
        {preview}
      </Text>
      <View style={styles.footer}>
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          {formatDate(note.getUpdatedAt())}
        </Text>
        {note.getAudioRelativePath() && (
          <Text style={[styles.meta, { color: colors.accent }]}>
            Audio available
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    minWidth: 0,
  },
  pin: {
    fontSize: 12,
    fontWeight: "700",
  },
  preview: {
    fontSize: 15,
    lineHeight: 22,
  },
  footer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    justifyContent: "space-between",
  },
  meta: {
    fontSize: 12,
  },
  pressed: {
    opacity: 0.72,
  },
});
