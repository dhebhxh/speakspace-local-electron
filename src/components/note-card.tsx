import { Pressable, StyleSheet, Text, View } from "react-native";

import { Colors, Radius, Shadows, Spacing } from "@/constants/theme";
import { Note } from "@/domain/note/note";
import { useTheme } from "@/hooks/use-theme";
import { formatDate } from "@/utils/format-date";

type NoteCardProps = {
  note: Note;
  onPress: () => void;
  onPinPress?: () => void;
  isPinning?: boolean;
};

export function NoteCard({
  note,
  onPress,
  onPinPress,
  isPinning = false,
}: NoteCardProps) {
  const theme = useTheme();
  const colors = Colors[theme.mode];
  const title = note.getName() || "Untitled note";
  const preview = note.getTranscript().replace(/\s+/g, " ").trim();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.content,
          (onPinPress || note.getIsPinned()) && styles.contentWithPin,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
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
      {onPinPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={note.getIsPinned() ? "Unpin note" : "Pin note"}
          accessibilityState={{ busy: isPinning, disabled: isPinning }}
          disabled={isPinning}
          hitSlop={8}
          onPress={onPinPress}
          style={({ pressed }) => [
            styles.pinButton,
            { borderColor: colors.border },
            pressed && styles.pressed,
            isPinning && styles.disabled,
          ]}
        >
          <Text style={[styles.pinIcon, { color: colors.accent }]}>
            {isPinning ? "…" : note.getIsPinned() ? "★" : "☆"}
          </Text>
        </Pressable>
      ) : note.getIsPinned() ? (
        <Text accessibilityLabel="Pinned note" style={[styles.pinBadge, styles.pinIcon, { color: colors.accent }]}>
          ★
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderCurve: "continuous",
    borderRadius: Radius.md,
    borderWidth: 1,
    boxShadow: Shadows.card,
    overflow: "hidden",
    position: "relative",
  },
  content: {
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  contentWithPin: {
    paddingRight: 58,
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
  pinIcon: { fontSize: 22, fontWeight: "700" },
  pinButton: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 0,
    justifyContent: "center",
    minHeight: 36,
    minWidth: 36,
    position: "absolute",
    right: Spacing.md,
    top: Spacing.md,
  },
  pinBadge: {
    position: "absolute",
    right: Spacing.md,
    top: Spacing.md,
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
  disabled: {
    opacity: 0.5,
  },
});
