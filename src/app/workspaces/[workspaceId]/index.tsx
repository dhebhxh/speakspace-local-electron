import { UiAlert as Alert } from "@/localization/ui-alert";
import { UiTextInput as TextInput } from "@/components/ui-text-input";
import { UiText as Text } from "@/components/ui-text";
import { Stack, type Href, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    InputAccessoryView,
    Keyboard,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { appContainer } from "@/application";
import { AppButton } from "@/components/app-button";
import { SafeAreaModal } from "@/components/safe-area-modal";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { NoteCard } from "@/components/note-card";
import { CategoryFilter, type CategoryFilterValue } from "@/components/category-filter";
import { NoteSelectionToolbar } from "@/components/note-selection-toolbar";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { ValidationError } from "@/errors/validation-error";
import { useTheme } from "@/hooks/use-theme";
import { useTrashUndo } from "@/providers/trash-undo-provider";

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
  const { showTrashUndo } = useTrashUndo();
  const [state, setState] = useState<WorkspaceNotesState>({
    status: "loading",
  });
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<"create-note" | "rename">("create-note");
  const [noteName, setNoteName] = useState("");
  const [transcript, setTranscript] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pinningNoteId, setPinningNoteId] = useState<string | null>(null);
  const [category, setCategory] = useState<CategoryFilterValue>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [frozenIds, setFrozenIds] = useState<string[] | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [destinationWorkspaces, setDestinationWorkspaces] = useState<Awaited<ReturnType<typeof workspaceService.getWorkspaces>>>([]);

  const categoryNotes = useMemo(
    () => state.status === "success"
      ? state.notes.filter((note) => category === "all" || note.getCategory() === category)
      : [],
    [category, state],
  );
  const visibleNotes = useMemo(
    () => frozenIds === null ? categoryNotes : frozenIds.flatMap((id) => state.status === "success" ? state.notes.find((note) => note.getId() === id) ?? [] : []),
    [categoryNotes, frozenIds, state],
  );
  const selectedNotes = useMemo(
    () => visibleNotes.filter((note) => selectedIds.has(note.getId())),
    [selectedIds, visibleNotes],
  );

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
      setDestinationWorkspaces(await workspaceService.getWorkspaces());
    } catch {
      setState({ status: "error", message: "Unable to load workspace." });
    }
  };

  useFocusEffect(
    useCallback(() => {
      void loadWorkspace();
    }, [workspaceId]),
  );

  useEffect(() => noteService.subscribeToCategoryChanges(() => {
    void noteService.getNotesByWorkspace(workspaceId).then((notes) => {
      setState((current) => current.status === "success" ? { ...current, notes } : current);
    });
  }), [noteService, workspaceId]);

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

  const togglePinned = async (noteId: string, isPinned: boolean) => {
    setPinningNoteId(noteId);

    try {
      await noteService.setNotePinned(noteId, !isPinned);
      const notes = await noteService.getNotesByWorkspace(workspaceId);
      setState((current) =>
        current.status === "success" ? { ...current, notes } : current,
      );
    } catch {
      Alert.alert(
        isPinned ? "Unable to unpin note" : "Unable to pin note",
        "Please try again.",
      );
    } finally {
      setPinningNoteId(null);
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setFrozenIds(null);
  };

  const toggleSelected = (noteId: string) => {
    if (frozenIds === null) setFrozenIds(categoryNotes.map((note) => note.getId()));
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(noteId)) next.delete(noteId); else next.add(noteId);
      if (next.size === 0) setFrozenIds(null);
      return next;
    });
  };

  const runBatch = async (action: () => Promise<void>) => {
    setBatchBusy(true);
    try {
      await action();
      clearSelection();
      await loadWorkspace();
    } catch (error) {
      Alert.alert("Unable to update selected notes", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBatchBusy(false);
    }
  };

  const confirmDeleteWorkspace = () => {
    if (state.status !== "success") return;
    const count = state.notes.length;
    Alert.alert(
      "Move workspace to Trash?",
      count > 0
        ? `Its ${count} ${count === 1 ? "note" : "notes"} will be hidden but kept until permanent deletion in Settings → Trash.`
        : "You can restore it later from Settings → Trash.",
      [{ text: "Cancel", style: "cancel" }, { text: "Move to Trash", style: "destructive", onPress: () => {
        void workspaceService.deleteWorkspace(workspaceId).then(
          () => {
            showTrashUndo({
              message: `${state.workspace.getName()} moved to Trash`,
              undo: async () => {
                await workspaceService.restoreWorkspace(workspaceId);
                router.replace({ pathname: "/workspaces/[workspaceId]", params: { workspaceId } });
              },
            });
            router.replace("/workspaces");
          },
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
              <View style={styles.headerCopy}>
                <Text style={[styles.meta, { color: colors.textMuted }]}>Updated {new Date(state.workspace.getUpdatedAt()).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</Text>
              </View>
              <View style={styles.actionRow}>
                <Pressable accessibilityRole="button" accessibilityLabel="Rename workspace" onPress={() => {
                  setModalMode("rename");
                  setNoteName(state.workspace.getName());
                  setFormError(null);
                  setIsModalVisible(true);
                }} style={({ pressed }) => [styles.iconButton, { backgroundColor: colors.accentSoft, borderColor: colors.border }, pressed && styles.pressed]}>
                  <Text style={[styles.editIcon, { color: colors.accent }]}>✎</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Delete workspace" onPress={confirmDeleteWorkspace} style={({ pressed }) => [styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}>
                  <Text style={[styles.deleteIcon, { color: colors.danger }]}>×</Text>
                </Pressable>
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
                label="＋ New note"
                onPress={() => {
                  setModalMode("create-note");
                  setNoteName("");
                  setFormError(null);
                  setIsModalVisible(true);
                }}
              />
            </View>
            <CategoryFilter value={category} onChange={setCategory} />
            {frozenIds !== null && (
              <NoteSelectionToolbar
                selectedNotes={selectedNotes}
                allVisibleSelected={selectedIds.size === visibleNotes.length}
                workspaces={destinationWorkspaces}
                busy={batchBusy}
                onToggleAll={() => {
                  if (selectedIds.size === visibleNotes.length) clearSelection();
                  else setSelectedIds(new Set(visibleNotes.map((note) => note.getId())));
                }}
                onCancel={clearSelection}
                onMove={(destinationId) => runBatch(() => noteService.moveNotes([...selectedIds], destinationId))}
                onTrash={() => runBatch(async () => {
                  const ids = [...selectedIds];
                  await noteService.trashNotes(ids);
                  showTrashUndo({
                    message: `${ids.length} notes moved to Trash`,
                    undo: async () => {
                      await noteService.restoreNotes(ids);
                      await loadWorkspace();
                    },
                  });
                })}
                onPin={(pinned) => runBatch(() => noteService.setNotesPinned([...selectedIds], pinned))}
                onAskAi={() => {
                  const noteIds = [...selectedIds].sort().join(",");
                  clearSelection();
                  router.push({ pathname: "/ask-ai", params: { noteIds } } as unknown as Href);
                }}
              />
            )}
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
            {state.notes.length > 0 && visibleNotes.length === 0 && <EmptyState title="No notes in this category" />}
            {visibleNotes.length > 0 && (
              <View style={styles.list}>
                {visibleNotes.map((note) => (
                  <NoteCard
                    key={note.getId()}
                    note={note}
                    isPinning={pinningNoteId === note.getId()}
                    onPinPress={frozenIds === null ? () => void togglePinned(note.getId(), note.getIsPinned()) : undefined}
                    selectionMode={frozenIds !== null}
                    selected={selectedIds.has(note.getId())}
                    onLongPress={() => toggleSelected(note.getId())}
                    onPress={() => frozenIds !== null
                      ? toggleSelected(note.getId())
                      : router.push({ pathname: "/notes/[noteId]", params: { noteId: note.getId() } })}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <SafeAreaModal
        androidKeyboardBehavior="height"
        visible={isModalVisible}
        onRequestClose={() => setIsModalVisible(false)}
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
            <Text style={[styles.close, { color: colors.textMuted }]}>Close</Text>
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
        {modalMode === "create-note" && <>
          <Text style={[styles.label, { color: colors.textMuted }]}>Transcript</Text>
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
          />
        </>}
        {formError && (
          <Text style={[styles.formError, { color: colors.danger }]}>{formError}</Text>
        )}
        <AppButton
          label={isSaving ? "Saving..." : modalMode === "rename" ? "Save name" : "Create note"}
          disabled={isSaving}
          onPress={() => void (modalMode === "rename" ? renameWorkspace() : createNote())}
        />
        {process.env.EXPO_OS === "ios" && modalMode === "create-note" && (
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
      </SafeAreaModal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: Spacing.lg, padding: Spacing.lg },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  headerCopy: { gap: Spacing.xs },
  actionRow: { flexDirection: "row", gap: Spacing.sm },
  iconButton: { alignItems: "center", borderCurve: "continuous", borderRadius: Radius.sm, borderWidth: 1, height: 44, justifyContent: "center", width: 44 },
  editIcon: { fontSize: 23, fontWeight: "700" },
  deleteIcon: { fontSize: 30, fontWeight: "400", lineHeight: 32 },
  pressed: { opacity: 0.65 },
  kicker: { fontSize: 12, fontWeight: "800", letterSpacing: 1.4 },
  meta: { fontSize: 13 },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sectionTitle: { fontSize: 24, fontWeight: "800" },
  list: { gap: Spacing.md },
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
