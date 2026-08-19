import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
    Alert,
    InputAccessoryView,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { appContainer } from "@/application";
import { AppButton } from "@/components/app-button";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { NoteCard } from "@/components/note-card";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { ValidationError } from "@/errors/validation-error";
import { useTheme } from "@/hooks/use-theme";

type WorkspaceNotesState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "success";
      workspace: NonNullable<
        Awaited<ReturnType<typeof appContainer.workspaceService.getWorkspace>>
      >;
      notes: Awaited<
        ReturnType<typeof appContainer.noteService.getNotesByWorkspace>
      >;
    };

const TRANSCRIPT_INPUT_ACCESSORY_ID = "new-note-transcript-accessory";

export default function WorkspaceDetailScreen() {
  const { workspaceId } = useLocalSearchParams<{ workspaceId: string }>();
  const router = useRouter();
  const theme = useTheme();
  const colors = Colors[theme.mode];
  const insets = useSafeAreaInsets();
  const { workspaceService, noteService } = appContainer;
  const [state, setState] = useState<WorkspaceNotesState>({
    status: "loading",
  });
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<"create-note" | "rename">("create-note");
  const [noteName, setNoteName] = useState("");
  const [transcript, setTranscript] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadWorkspace = async () => {
    setState({ status: "loading" });

    try {
      const [loadedWorkspace, loadedNotes] = await Promise.all([
        workspaceService.getWorkspace(workspaceId),
        noteService.getNotesByWorkspace(workspaceId),
      ]);
      if (loadedWorkspace === null) {
        setState({ status: "error", message: "Workspace not found." });
        return;
      }

      setState({
        status: "success",
        workspace: loadedWorkspace,
        notes: loadedNotes,
      });
    } catch {
      setState({ status: "error", message: "Unable to load workspace." });
    }
  };

  useFocusEffect(
    useCallback(() => {
      void loadWorkspace();
    }, [workspaceId]),
  );

  const createNote = async () => {
    setFormError(null);
    setIsSaving(true);

    try {
      await noteService.createNote(workspaceId, noteName, transcript);
      setNoteName("");
      setTranscript("");
      Keyboard.dismiss();
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

  const renameWorkspace = async () => {
    setFormError(null);
    setIsSaving(true);
    try {
      await workspaceService.renameWorkspace(workspaceId, noteName);
      setNoteName("");
      setIsModalVisible(false);
      await loadWorkspace();
    } catch (error) {
      setFormError(error instanceof ValidationError ? error.message : "Unable to rename workspace.");
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDeleteWorkspace = () => {
    if (state.status !== "success") return;
    const count = state.notes.length;
    Alert.alert(
      "Delete workspace?",
      count > 0
        ? `This permanently deletes the workspace and its ${count} ${count === 1 ? "note" : "notes"}, including related insights and AI context.`
        : "This permanently deletes the workspace.",
      [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => {
        void workspaceService.deleteWorkspace(workspaceId).then(
          () => router.replace("/workspaces"),
          () => Alert.alert("Unable to delete workspace", "Please try again."),
        );
      }}],
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title:
            state.status === "success"
              ? state.workspace.getName()
              : "Workspace",
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Spacing.xxl + insets.bottom },
        ]}
      >
        {state.status === "loading" && <LoadingState />}
        {state.status === "error" && (
          <ErrorState
            message={state.message}
            onRetry={() => void loadWorkspace()}
          />
        )}
        {state.status === "success" && (
          <>
            <View style={styles.header}>
              <Text style={[styles.kicker, { color: colors.accent }]}>
                WORKSPACE
              </Text>
              <Text style={[styles.title, { color: colors.text }]}>
                {state.workspace.getName()}
              </Text>
              <Text style={[styles.meta, { color: colors.textMuted }]}>
                Updated{" "}
                {new Date(state.workspace.getUpdatedAt()).toLocaleDateString()}
              </Text>
              <View style={styles.actionRow}>
                <AppButton label="Rename" variant="secondary" onPress={() => {
                  setModalMode("rename");
                  setNoteName(state.workspace.getName());
                  setFormError(null);
                  setIsModalVisible(true);
                }} />
                <AppButton label="Delete" variant="destructive" onPress={confirmDeleteWorkspace} />
              </View>
            </View>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Notes
                </Text>
                <Text style={[styles.meta, { color: colors.textMuted }]}>
                  {state.notes.length}{" "}
                  {state.notes.length === 1 ? "note" : "notes"}
                </Text>
              </View>
              <AppButton
                label="New note"
                onPress={() => {
                  setModalMode("create-note");
                  setNoteName("");
                  setFormError(null);
                  setIsModalVisible(true);
                }}
              />
            </View>
            {state.notes.length === 0 && (
              <EmptyState
                title="No notes yet"
                action={
                  <AppButton
                    label="Create note"
                    onPress={() => {
                      setModalMode("create-note");
                      setIsModalVisible(true);
                    }}
                  />
                }
              />
            )}
            {state.notes.length > 0 && (
              <View style={styles.list}>
                {state.notes.map((note) => (
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
        <KeyboardAvoidingView
          behavior={process.env.EXPO_OS === "ios" ? "padding" : "height"}
          style={styles.modalBackdrop}
        >
          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={[
              styles.modal,
              {
                backgroundColor: colors.surface,
                paddingBottom: Spacing.lg + insets.bottom,
              },
            ]}
            keyboardDismissMode={
              Platform.OS === "ios" ? "interactive" : "on-drag"
            }
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {modalMode === "rename" ? "Rename workspace" : "New note"}
              </Text>
              <Pressable
                hitSlop={10}
                onPress={() => {
                  Keyboard.dismiss();
                  setIsModalVisible(false);
                }}
                accessibilityLabel="Close"
              >
                <Text style={[styles.close, { color: colors.textMuted }]}>
                  Close
                </Text>
              </Pressable>
            </View>
            <Text style={[styles.label, { color: colors.textMuted }]}>
              {modalMode === "rename" ? "Workspace name" : "Title (optional)"}
            </Text>
            <TextInput
              placeholder={modalMode === "rename" ? "Workspace name" : "e.g. Team meeting"}
              placeholderTextColor={colors.textMuted}
              value={noteName}
              onChangeText={setNoteName}
              style={[
                styles.input,
                { borderColor: colors.border, color: colors.text },
              ]}
            />
            {modalMode === "create-note" && <><Text style={[styles.label, { color: colors.textMuted }]}>
              Transcript
            </Text>
            <TextInput
              multiline
              inputAccessoryViewID={TRANSCRIPT_INPUT_ACCESSORY_ID}
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
            /></>}
            {formError && (
              <Text style={[styles.formError, { color: colors.danger }]}>
                {formError}
              </Text>
            )}
            <AppButton
              label={isSaving ? "Saving..." : modalMode === "rename" ? "Save name" : "Create note"}
              disabled={isSaving}
              onPress={() => void (modalMode === "rename" ? renameWorkspace() : createNote())}
            />
          </ScrollView>
          {process.env.EXPO_OS === "ios" && (
            <InputAccessoryView nativeID={TRANSCRIPT_INPUT_ACCESSORY_ID}>
              <View
                style={[
                  styles.inputAccessory,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Pressable
                  onPress={Keyboard.dismiss}
                  accessibilityRole="button"
                >
                  <Text
                    style={[
                      styles.inputAccessoryAction,
                      { color: colors.accent },
                    ]}
                  >
                    Done
                  </Text>
                </Pressable>
              </View>
            </InputAccessoryView>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: Spacing.xl, padding: Spacing.lg },
  header: { gap: Spacing.xs },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
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
  },
  modalScroll: { maxHeight: "92%" },
  inputAccessory: {
    alignItems: "flex-end",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  inputAccessoryAction: { fontSize: 16, fontWeight: "700" },
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
