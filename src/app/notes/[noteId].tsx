import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { appContainer } from "@/application";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { formatDate } from "@/utils/format-date";

type NoteDetailState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "success";
      note: NonNullable<
        Awaited<ReturnType<typeof appContainer.noteService.getNote>>
      >;
      workspaceName: string | null;
    };

export default function NoteDetailScreen() {
  const { noteId } = useLocalSearchParams<{ noteId: string }>();
  const theme = useTheme();
  const colors = Colors[theme.mode];
  const { noteService, workspaceService } = appContainer;
  const [state, setState] = useState<NoteDetailState>({
    status: "loading",
  });

  const loadNote = async () => {
    setState({ status: "loading" });

    try {
      const loadedNote = await noteService.getNote(noteId);

      if (loadedNote === null) {
        setState({ status: "error", message: "Note not found." });
        return;
      }

      const workspace = await workspaceService.getWorkspace(
        loadedNote.getWorkspaceId(),
      );
      setState({
        status: "success",
        note: loadedNote,
        workspaceName: workspace?.getName() ?? null,
      });
    } catch {
      setState({ status: "error", message: "Unable to load note." });
    }
  };

  useEffect(() => {
    void loadNote();
  }, [noteId]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title:
            state.status === "success"
              ? (state.note.getName() ?? "Note")
              : "Note",
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        {state.status === "loading" && <LoadingState />}
        {state.status === "error" && (
          <ErrorState message={state.message} onRetry={() => void loadNote()} />
        )}
        {state.status === "success" && (
          <>
            <View style={styles.header}>
              <Text style={[styles.kicker, { color: colors.accent }]}>
                NOTE
              </Text>
              <Text style={[styles.title, { color: colors.text }]}>
                {state.note.getName() || "Untitled note"}
              </Text>
              <View style={styles.metaRow}>
                {state.workspaceName && (
                  <Text style={[styles.meta, { color: colors.textMuted }]}>
                    {state.workspaceName}
                  </Text>
                )}
                <Text style={[styles.meta, { color: colors.textMuted }]}>
                  {formatDate(state.note.getUpdatedAt())}
                </Text>
                {state.note.getIsPinned() && (
                  <Text style={[styles.meta, { color: colors.accent }]}>
                    Pinned
                  </Text>
                )}
              </View>
              {state.note.getAudioRelativePath() && (
                <View
                  style={[
                    styles.audioBadge,
                    { backgroundColor: colors.accentSoft },
                  ]}
                >
                  <Text style={[styles.audioText, { color: colors.accent }]}>
                    Audio available
                  </Text>
                </View>
              )}
            </View>
            <View
              style={[
                styles.transcript,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Transcript
              </Text>
              <Text style={[styles.body, { color: colors.text }]}>
                {state.note.getTranscript()}
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: Spacing.xl, padding: Spacing.lg, paddingBottom: Spacing.xxl },
  header: { gap: Spacing.sm },
  kicker: { fontSize: 12, fontWeight: "800", letterSpacing: 1.4 },
  title: { fontSize: 36, fontWeight: "800", lineHeight: 42 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.md },
  meta: { fontSize: 13 },
  audioBadge: {
    alignSelf: "flex-start",
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  audioText: { fontSize: 13, fontWeight: "700" },
  transcript: {
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  sectionTitle: { fontSize: 20, fontWeight: "800" },
  body: { fontSize: 17, lineHeight: 28 },
});
