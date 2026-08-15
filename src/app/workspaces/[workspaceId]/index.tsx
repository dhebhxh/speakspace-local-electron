import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import { appContainer } from "@/application";
import { AppButton } from "@/components/app-button";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { NoteCard } from "@/components/note-card";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { ValidationError } from "@/errors/validation-error";
import { useTheme } from "@/hooks/use-theme";

export default function WorkspaceDetailScreen() {
  const { workspaceId } = useLocalSearchParams<{ workspaceId: string }>();
  const router = useRouter();
  const theme = useTheme();
  const colors = Colors[theme.mode];
  const { workspaceService, noteService } = appContainer;
  const [workspace, setWorkspace] =
    useState<Awaited<ReturnType<typeof workspaceService.getWorkspace>>>(null);
  const [notes, setNotes] = useState<
    Awaited<ReturnType<typeof noteService.getNotesByWorkspace>>
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [noteName, setNoteName] = useState("");
  const [transcript, setTranscript] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadWorkspace = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [loadedWorkspace, loadedNotes] = await Promise.all([
        workspaceService.getWorkspace(workspaceId),
        noteService.getNotesByWorkspace(workspaceId),
      ]);
      setWorkspace(loadedWorkspace);
      setNotes(loadedNotes);
      if (loadedWorkspace === null) {
        setError("Workspace not found.");
      }
    } catch {
      setError("Unable to load workspace.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadWorkspace();
  }, [workspaceId]);

  const createNote = async () => {
    setFormError(null);
    setIsSaving(true);

    try {
      await noteService.createNote(workspaceId, noteName, transcript);
      setNoteName("");
      setTranscript("");
      setIsModalVisible(false);
      await loadWorkspace();
    } catch (caughtError) {
      setFormError(
        caughtError instanceof ValidationError
          ? caughtError.message
          : "Unable to create note.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: workspace?.getName() ?? "Workspace" }} />
      <ScrollView contentContainerStyle={styles.content}>
        {isLoading && <LoadingState />}
        {!isLoading && error && (
          <ErrorState message={error} onRetry={() => void loadWorkspace()} />
        )}
        {!isLoading && !error && workspace && (
          <>
            <View style={styles.header}>
              <Text style={[styles.kicker, { color: colors.accent }]}>
                WORKSPACE
              </Text>
              <Text style={[styles.title, { color: colors.text }]}>
                {workspace.getName()}
              </Text>
              <Text style={[styles.meta, { color: colors.textMuted }]}>
                Updated{" "}
                {new Date(workspace.getUpdatedAt()).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Notes
                </Text>
                <Text style={[styles.meta, { color: colors.textMuted }]}>
                  {notes.length} {notes.length === 1 ? "note" : "notes"}
                </Text>
              </View>
              <AppButton
                label="New note"
                onPress={() => setIsModalVisible(true)}
              />
            </View>
            {notes.length === 0 && (
              <EmptyState
                title="No notes yet"
                action={
                  <AppButton
                    label="Create note"
                    onPress={() => setIsModalVisible(true)}
                  />
                }
              />
            )}
            {notes.length > 0 && (
              <View style={styles.list}>
                {notes.map((note) => (
                  <NoteCard
                    key={note.getId()}
                    note={note}
                    onPress={() =>
                      router.push({
                        pathname: "/notes/[noteId]",
                        params: { noteId: note.getId() },
                      })
                    }
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <Modal
        animationType="slide"
        transparent
        visible={isModalVisible}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modal, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                New note
              </Text>
              <Pressable
                onPress={() => setIsModalVisible(false)}
                accessibilityLabel="Close"
              >
                <Text style={[styles.close, { color: colors.textMuted }]}>
                  Close
                </Text>
              </Pressable>
            </View>
            <Text style={[styles.label, { color: colors.textMuted }]}>
              Title (optional)
            </Text>
            <TextInput
              placeholder="e.g. Team meeting"
              placeholderTextColor={colors.textMuted}
              value={noteName}
              onChangeText={setNoteName}
              style={[
                styles.input,
                { borderColor: colors.border, color: colors.text },
              ]}
            />
            <Text style={[styles.label, { color: colors.textMuted }]}>
              Transcript
            </Text>
            <TextInput
              multiline
              placeholder="Write the note transcript..."
              placeholderTextColor={colors.textMuted}
              textAlignVertical="top"
              value={transcript}
              onChangeText={setTranscript}
              style={[
                styles.input,
                styles.transcriptInput,
                { borderColor: colors.border, color: colors.text },
              ]}
            />
            {formError && (
              <Text style={[styles.formError, { color: colors.danger }]}>
                {formError}
              </Text>
            )}
            <AppButton
              label={isSaving ? "Creating..." : "Create note"}
              disabled={isSaving}
              onPress={() => void createNote()}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: Spacing.xl, padding: Spacing.lg, paddingBottom: Spacing.xxl },
  header: { gap: Spacing.xs },
  kicker: { fontSize: 12, fontWeight: "800", letterSpacing: 1.4 },
  title: { fontSize: 36, fontWeight: "800" },
  meta: { fontSize: 13 },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sectionTitle: { fontSize: 24, fontWeight: "800" },
  list: { gap: Spacing.md },
  modalBackdrop: {
    backgroundColor: "rgba(0, 0, 0, 0.36)",
    flex: 1,
    justifyContent: "flex-end",
  },
  modal: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    gap: Spacing.md,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  modalHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  modalTitle: { fontSize: 23, fontWeight: "800" },
  close: { fontSize: 14, fontWeight: "700" },
  label: { fontSize: 14, fontWeight: "700" },
  input: {
    borderRadius: Radius.sm,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: Spacing.md,
  },
  transcriptInput: { minHeight: 130, paddingTop: Spacing.md },
  formError: { fontSize: 14 },
});
