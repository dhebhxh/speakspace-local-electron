import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { File, Paths } from "expo-file-system";
import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import {
  KNOWLEDGE_SCENARIO_DEFINITIONS,
  getKnowledgeScenarioDefinition,
} from "@/constants/knowledge-scenarios";
import { Colors, Radius, Spacing } from "@/constants/theme";
import type {
  KnowledgeDocument,
  KnowledgeScenario,
} from "@/domain/knowledge/knowledge-document";
import { KnowledgeGenerationError } from "@/errors/knowledge-generation-error";
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
      knowledge: KnowledgeDocument | null;
    };

type GenerationState =
  | { status: "idle" }
  | { status: "selecting"; scenario: KnowledgeScenario }
  | { status: "generating"; scenario: KnowledgeScenario }
  | { status: "error"; scenario: KnowledgeScenario; message: string };

export default function NoteDetailScreen() {
  const { noteId } = useLocalSearchParams<{ noteId: string }>();
  const theme = useTheme();
  const colors = Colors[theme.mode];
  const { noteService, workspaceService, knowledgeService } = appContainer;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [state, setState] = useState<NoteDetailState>({
    status: "loading",
  });
  const [generation, setGeneration] = useState<GenerationState>({
    status: "idle",
  });
  const [actionModal, setActionModal] = useState<"rename" | "move" | null>(null);
  const [titleInput, setTitleInput] = useState("");
  const [workspaces, setWorkspaces] = useState<Awaited<ReturnType<typeof workspaceService.getWorkspaces>>>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const audioRelativePath =
    state.status === "success" ? state.note.getAudioRelativePath() : null;
  const audioUri = audioRelativePath
    ? new File(Paths.document, ...audioRelativePath.split("/")).uri
    : null;
  const player = useAudioPlayer(audioUri);
  const playerStatus = useAudioPlayerStatus(player);

  const loadNote = async () => {
    setState({ status: "loading" });

    try {
      const loadedNote = await noteService.getNote(noteId);

      if (loadedNote === null) {
        setState({ status: "error", message: "Note not found." });
        return;
      }

      const [workspace, knowledge] = await Promise.all([
        workspaceService
          .getWorkspace(loadedNote.getWorkspaceId())
          .catch((error) => {
            console.warn(
              "[NoteDetail] Workspace metadata could not be loaded",
              {
                noteId: loadedNote.getId(),
                error,
              },
            );
            return null;
          }),
        knowledgeService.getForNote(loadedNote.getId()).catch((error) => {
          console.warn("[NoteDetail] Saved knowledge could not be loaded", {
            noteId: loadedNote.getId(),
            error,
          });
          return null;
        }),
      ]);
      setState({
        status: "success",
        note: loadedNote,
        workspaceName: workspace?.getName() ?? null,
        knowledge,
      });
    } catch (error) {
      console.error("[NoteDetail] Unable to load note", { noteId, error });
      setState({ status: "error", message: "Unable to load note." });
    }
  };

  useEffect(() => {
    void loadNote();
  }, [noteId]);

  const generateKnowledge = async (scenario: KnowledgeScenario) => {
    if (state.status !== "success") return;
    const startedAt = Date.now();
    console.info("[NoteDetail] Knowledge generation started", {
      noteId: state.note.getId(),
      scenario,
    });
    setGeneration({ status: "generating", scenario });
    try {
      const knowledge = await knowledgeService.generate(
        state.note.getId(),
        state.note.getTranscript(),
        scenario,
      );
      setState({ ...state, knowledge });
      setGeneration({ status: "idle" });
      console.info("[NoteDetail] Knowledge generation displayed", {
        noteId: state.note.getId(),
        scenario,
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      const message =
        error instanceof KnowledgeGenerationError
          ? error.message
          : "Knowledge generation did not finish. Please try again.";
      console.error("[NoteDetail] Knowledge generation failed", {
        noteId: state.note.getId(),
        scenario,
        durationMs: Date.now() - startedAt,
        errorCode:
          error instanceof KnowledgeGenerationError ? error.code : "unexpected",
        error,
      });
      setGeneration({ status: "error", scenario, message });
    }
  };

  const openMove = async () => {
    setActionError(null);
    setActionModal("move");
    try {
      setWorkspaces(await workspaceService.getWorkspaces());
    } catch {
      setActionError("Unable to load workspaces.");
    }
  };

  const renameNote = async () => {
    setIsSaving(true);
    setActionError(null);
    try {
      await noteService.renameNote(noteId, titleInput);
      setActionModal(null);
      await loadNote();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to rename note.");
    } finally {
      setIsSaving(false);
    }
  };

  const moveNote = async (workspaceId: string) => {
    setIsSaving(true);
    setActionError(null);
    try {
      await noteService.moveNote(noteId, workspaceId);
      setActionModal(null);
      await loadNote();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to move note.");
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDeleteNote = () => {
    if (state.status !== "success") return;
    const workspaceId = state.note.getWorkspaceId();
    Alert.alert("Delete note?", "This permanently deletes the note and its related insights, knowledge, and AI context.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => {
        void noteService.deleteNote(noteId).then(
          () => router.replace({ pathname: "/workspaces/[workspaceId]", params: { workspaceId } }),
          () => Alert.alert("Unable to delete note", "Please try again."),
        );
      }},
    ]);
  };

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
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Spacing.xxl + insets.bottom },
        ]}
      >
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
                  <AppButton
                    label={
                      playerStatus.playing
                        ? "Pause recording"
                        : "Play recording"
                    }
                    variant="quiet"
                    onPress={() =>
                      playerStatus.playing ? player.pause() : player.play()
                    }
                  />
                </View>
              )}
              <AppButton
                label="Ask AI about this transcript"
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: "/ask-ai",
                    params: { noteId: state.note.getId() },
                  } as unknown as Href)
                }
              />
              <View style={styles.actionRow}>
                <AppButton label="Rename" variant="secondary" onPress={() => {
                  setTitleInput(state.note.getName() ?? "");
                  setActionError(null);
                  setActionModal("rename");
                }} />
                <AppButton label="Move" variant="secondary" onPress={() => void openMove()} />
                <AppButton label="Delete" variant="destructive" onPress={confirmDeleteNote} />
              </View>
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
            <View
              style={[
                styles.knowledgeCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.knowledgeHeading}>
                <View style={styles.headingCopy}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    Knowledge
                  </Text>
                  <Text
                    style={[styles.supportingText, { color: colors.textMuted }]}
                  >
                    Turn this transcript into a note shaped for how you'll use
                    it.
                  </Text>
                </View>
                {state.knowledge && generation.status === "idle" && (
                  <View
                    style={[
                      styles.scenarioBadge,
                      { backgroundColor: colors.accentSoft },
                    ]}
                  >
                    <Text
                      style={[
                        styles.scenarioBadgeText,
                        { color: colors.accent },
                      ]}
                    >
                      {
                        getKnowledgeScenarioDefinition(
                          state.knowledge.getScenario(),
                        ).name
                      }
                    </Text>
                  </View>
                )}
              </View>

              {generation.status === "generating" ? (
                <View
                  style={[
                    styles.generationStatus,
                    { backgroundColor: colors.surfaceMuted },
                  ]}
                >
                  <ActivityIndicator color={colors.accent} />
                  <View style={styles.headingCopy}>
                    <Text style={[styles.statusTitle, { color: colors.text }]}>
                      Organizing your knowledge…
                    </Text>
                    <Text
                      style={[
                        styles.supportingText,
                        { color: colors.textMuted },
                      ]}
                    >
                      Running privately on this device. This can take a moment.
                    </Text>
                  </View>
                </View>
              ) : generation.status === "selecting" ||
                generation.status === "error" ? (
                <View style={styles.selector}>
                  <Text style={[styles.selectorTitle, { color: colors.text }]}>
                    Choose a scene
                  </Text>
                  <View style={styles.scenarioGrid}>
                    {KNOWLEDGE_SCENARIO_DEFINITIONS.map((scenario) => {
                      const selected = generation.scenario === scenario.id;
                      return (
                        <Pressable
                          key={scenario.id}
                          accessibilityRole="radio"
                          accessibilityState={{ selected }}
                          onPress={() =>
                            setGeneration({
                              status: "selecting",
                              scenario: scenario.id,
                            })
                          }
                          style={({ pressed }) => [
                            styles.scenarioOption,
                            {
                              backgroundColor: selected
                                ? colors.accentSoft
                                : colors.background,
                              borderColor: selected
                                ? colors.accent
                                : colors.border,
                            },
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text
                            style={[
                              styles.scenarioTitle,
                              { color: colors.text },
                            ]}
                          >
                            {scenario.name}
                          </Text>
                          <Text
                            style={[
                              styles.scenarioDescription,
                              { color: colors.textMuted },
                            ]}
                          >
                            {scenario.description}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {generation.status === "error" && (
                    <Text
                      selectable
                      style={[styles.errorText, { color: colors.danger }]}
                    >
                      {generation.message}
                    </Text>
                  )}
                  <View style={styles.actionRow}>
                    <AppButton
                      label="Cancel"
                      variant="quiet"
                      onPress={() => setGeneration({ status: "idle" })}
                    />
                    <AppButton
                      label={
                        state.knowledge ? "Regenerate" : "Generate Knowledge"
                      }
                      onPress={() =>
                        void generateKnowledge(generation.scenario)
                      }
                    />
                  </View>
                </View>
              ) : state.knowledge ? (
                <View style={styles.document}>
                  <KnowledgeResult
                    document={state.knowledge}
                    textColor={colors.text}
                    mutedColor={colors.textMuted}
                    borderColor={colors.border}
                  />
                  <AppButton
                    label="Generate again"
                    variant="secondary"
                    onPress={() =>
                      setGeneration({
                        status: "selecting",
                        scenario: state.knowledge!.getScenario(),
                      })
                    }
                  />
                </View>
              ) : (
                <AppButton
                  label="Generate Knowledge"
                  onPress={() =>
                    setGeneration({ status: "selecting", scenario: "general" })
                  }
                />
              )}
            </View>
          </>
        )}
      </ScrollView>
      <Modal transparent animationType="slide" visible={actionModal !== null} onRequestClose={() => setActionModal(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalBackdrop}>
          <View style={[styles.modal, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{actionModal === "rename" ? "Rename note" : "Move note"}</Text>
              <Pressable onPress={() => setActionModal(null)}><Text style={{ color: colors.textMuted }}>Close</Text></Pressable>
            </View>
            {actionModal === "rename" ? <>
              <TextInput autoFocus value={titleInput} onChangeText={setTitleInput} placeholder="Note title" placeholderTextColor={colors.textMuted} style={[styles.input, { borderColor: colors.border, color: colors.text }]} />
              <AppButton label={isSaving ? "Saving..." : "Save title"} disabled={isSaving} onPress={() => void renameNote()} />
            </> : <View style={styles.workspaceChoices}>
              {workspaces.filter((workspace) => state.status === "success" && workspace.getId() !== state.note.getWorkspaceId()).map((workspace) => (
                <AppButton key={workspace.getId()} label={workspace.getName()} variant="secondary" disabled={isSaving} onPress={() => void moveNote(workspace.getId())} />
              ))}
              {!actionError && workspaces.filter((workspace) => state.status === "success" && workspace.getId() !== state.note.getWorkspaceId()).length === 0 && <Text style={{ color: colors.textMuted }}>No other workspace is available.</Text>}
            </View>}
            {actionError && <Text selectable style={{ color: colors.danger }}>{actionError}</Text>}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function KnowledgeResult({
  document,
  textColor,
  mutedColor,
  borderColor,
}: {
  document: KnowledgeDocument;
  textColor: string;
  mutedColor: string;
  borderColor: string;
}) {
  return (
    <View style={styles.document}>
      <View style={styles.knowledgeSection}>
        <Text style={[styles.resultTitle, { color: textColor }]}>Summary</Text>
        <Text selectable style={[styles.body, { color: textColor }]}>
          {document.getSummary()}
        </Text>
      </View>
      {document
        .getSections()
        .filter((section) => section.items.length > 0)
        .map((section) => (
          <View
            key={section.key}
            style={[
              styles.knowledgeSection,
              styles.dividedSection,
              { borderColor },
            ]}
          >
            <Text style={[styles.resultTitle, { color: textColor }]}>
              {section.title}
            </Text>
            <View style={styles.itemList}>
              {section.items.map((item, index) => (
                <View key={`${section.key}-${index}`} style={styles.itemRow}>
                  <Text style={[styles.bullet, { color: mutedColor }]}>•</Text>
                  <Text
                    selectable
                    style={[styles.resultItem, { color: textColor }]}
                  >
                    {item}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      <Text style={[styles.generatedMeta, { color: mutedColor }]}>
        Generated locally · {formatDate(document.getUpdatedAt())}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: Spacing.xl, padding: Spacing.lg },
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
  knowledgeCard: {
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: Spacing.lg,
    padding: Spacing.lg,
  },
  knowledgeHeading: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  headingCopy: { flex: 1, gap: Spacing.xs },
  supportingText: { fontSize: 14, lineHeight: 20 },
  scenarioBadge: {
    borderRadius: 999,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  scenarioBadgeText: { fontSize: 12, fontWeight: "800" },
  generationStatus: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Radius.sm,
    gap: Spacing.md,
    padding: Spacing.md,
  },
  statusTitle: { fontSize: 16, fontWeight: "700" },
  selector: { gap: Spacing.md },
  selectorTitle: { fontSize: 17, fontWeight: "800" },
  scenarioGrid: { gap: Spacing.sm },
  scenarioOption: {
    borderRadius: Radius.sm,
    borderWidth: 1,
    gap: 3,
    padding: Spacing.md,
  },
  scenarioTitle: { fontSize: 16, fontWeight: "800" },
  scenarioDescription: { fontSize: 13, lineHeight: 18 },
  pressed: { opacity: 0.72 },
  errorText: { fontSize: 14, lineHeight: 20 },
  actionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.sm,
  },
  modalBackdrop: { backgroundColor: "rgba(0,0,0,0.36)", flex: 1, justifyContent: "flex-end" },
  modal: { borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, gap: Spacing.md, padding: Spacing.lg },
  modalHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  modalTitle: { fontSize: 23, fontWeight: "800" },
  input: { borderRadius: Radius.sm, borderWidth: 1, fontSize: 16, minHeight: 48, paddingHorizontal: Spacing.md },
  workspaceChoices: { gap: Spacing.sm },
  document: { gap: Spacing.lg },
  knowledgeSection: { gap: Spacing.sm },
  dividedSection: { borderTopWidth: 1, paddingTop: Spacing.lg },
  resultTitle: { fontSize: 19, fontWeight: "800" },
  itemList: { gap: Spacing.sm },
  itemRow: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm },
  bullet: { fontSize: 18, lineHeight: 25 },
  resultItem: { flex: 1, fontSize: 16, lineHeight: 25 },
  generatedMeta: { fontSize: 12 },
});
