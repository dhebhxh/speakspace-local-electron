import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import * as Clipboard from "expo-clipboard";
import { File, Paths } from "expo-file-system";
import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
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
import { SpeechPlaybackButton } from "@/components/speech-playback-button";
import {
  KNOWLEDGE_SCENARIO_DEFINITIONS,
  getKnowledgeScenarioDefinition,
} from "@/constants/knowledge-scenarios";
import { Colors, Radius, Spacing } from "@/constants/theme";
import type {
  KnowledgeDocument,
  KnowledgeScenario,
} from "@/domain/knowledge/knowledge-document";
import type {
  CoreNoteInsight,
  CoreTask,
} from "@/domain/core-note-insight/core-note-insight";
import { CoreNoteInsightGenerationError } from "@/errors/core-note-insight-generation-error";
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
      coreInsights: CoreNoteInsight | null;
    };

type GenerationState =
  | { status: "idle" }
  | { status: "selecting"; scenario: KnowledgeScenario }
  | { status: "queued" | "generating"; scenario: KnowledgeScenario }
  | { status: "error"; scenario: KnowledgeScenario; message: string };

type CoreInsightGenerationState =
  | { status: "idle" }
  | { status: "queued" | "generating" }
  | { status: "error"; message: string };

type NoteSection = "transcript" | "insights" | "knowledge";
type InsightSectionKey = "summary" | "key-points" | "tasks" | "reminders" | "calendar";

export default function NoteDetailScreen() {
  const { noteId } = useLocalSearchParams<{ noteId: string }>();
  const theme = useTheme();
  const colors = Colors[theme.mode];
  const { noteService, workspaceService, knowledgeService, coreNoteInsightService } = appContainer;
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
  const [coreGeneration, setCoreGeneration] = useState<CoreInsightGenerationState>({ status: "idle" });
  const [coreItemError, setCoreItemError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<NoteSection>("transcript");
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

      const [workspace, knowledge, coreInsights] = await Promise.all([
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
        coreNoteInsightService.getForNote(loadedNote.getId()).catch((error) => {
          console.warn("[NoteDetail] Saved core insights could not be loaded", { noteId: loadedNote.getId(), error });
          return null;
        }),
      ]);
      setState({
        status: "success",
        note: loadedNote,
        workspaceName: workspace?.getName() ?? null,
        knowledge,
        coreInsights,
      });
    } catch (error) {
      console.error("[NoteDetail] Unable to load note", { noteId, error });
      setState({ status: "error", message: "Unable to load note." });
    }
  };

  useEffect(() => {
    void loadNote();
  }, [noteId]);

  useEffect(() => coreNoteInsightService.subscribeToGeneration(noteId, (generationState) => {
    if (generationState.status === "queued" || generationState.status === "generating") {
      setCoreGeneration({ status: generationState.status });
      return;
    }
    if (generationState.status === "failed") {
      setCoreGeneration({ status: "error", message: generationState.message });
      return;
    }
    setCoreGeneration({ status: "idle" });
    if (generationState.status === "completed") {
      void coreNoteInsightService.getForNote(noteId).then((coreInsights) => {
        if (coreInsights) setState((current) => current.status === "success" ? { ...current, coreInsights } : current);
      });
    }
  }), [coreNoteInsightService, noteId]);

  useEffect(() => knowledgeService.subscribeToGeneration(noteId, (generationState) => {
    if (generationState.status === "queued" || generationState.status === "generating") {
      setGeneration({ status: generationState.status, scenario: generationState.scenario });
      return;
    }
    if (generationState.status === "failed") {
      setGeneration({ status: "error", scenario: generationState.scenario, message: generationState.message });
      return;
    }
    setGeneration({ status: "idle" });
    if (generationState.status === "completed") {
      void knowledgeService.getForNote(noteId).then((knowledge) => {
        if (knowledge) setState((current) => current.status === "success" ? { ...current, knowledge } : current);
      });
    }
  }), [knowledgeService, noteId]);

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
      setState((current) => current.status === "success" && current.note.getId() === state.note.getId() ? { ...current, knowledge } : current);
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

  const generateCoreInsights = async () => {
    if (state.status !== "success") return;
    const startedAt = Date.now();
    console.info("[NoteDetail] Core insights generation started", { noteId: state.note.getId() });
    setCoreGeneration({ status: "generating" });
    try {
      const coreInsights = await coreNoteInsightService.generate(state.note.getId(), state.note.getTranscript());
      setState((current) => current.status === "success" && current.note.getId() === state.note.getId() ? { ...current, coreInsights } : current);
      setCoreGeneration({ status: "idle" });
      console.info("[NoteDetail] Core insights displayed", { noteId: state.note.getId(), durationMs: Date.now() - startedAt });
    } catch (error) {
      const message = error instanceof CoreNoteInsightGenerationError ? error.message : "Structured Note did not finish. Please try again.";
      console.error("[NoteDetail] Core insights generation failed", { noteId: state.note.getId(), durationMs: Date.now() - startedAt, error });
      setCoreGeneration({ status: "error", message });
    }
  };

  const setCoreTaskCompleted = async (taskId: string, completed: boolean) => {
    if (state.status !== "success") return;
    setCoreItemError(null);
    try {
      const coreInsights = await coreNoteInsightService.setTaskCompleted(
        state.note.getId(), taskId, completed,
      );
      setState((current) => current.status === "success" ? { ...current, coreInsights } : current);
    } catch (error) {
      setCoreItemError(error instanceof Error ? error.message : "Unable to update this task.");
      throw error;
    }
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
              <View style={styles.headerUtilityRow}>
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
                <View style={styles.noteActionRow}>
                  <NoteIconAction label="Rename note" symbol="✎" color={colors.accent} backgroundColor={colors.accentSoft} onPress={() => {
                    setTitleInput(state.note.getName() ?? "");
                    setActionError(null);
                    setActionModal("rename");
                  }} />
                  <NoteIconAction label="Move note" symbol="⇄" color={colors.accent} backgroundColor={colors.accentSoft} onPress={() => void openMove()} />
                  <NoteIconAction label="Delete note" symbol="×" color={colors.danger} backgroundColor={colors.surfaceMuted} onPress={confirmDeleteNote} />
                </View>
              </View>
              {state.note.getAudioRelativePath() && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={playerStatus.playing ? "Pause recording" : "Play recording"}
                  accessibilityState={{ selected: playerStatus.playing }}
                  onPress={() => playerStatus.playing ? player.pause() : player.play()}
                  style={({ pressed }) => [
                    styles.audioPlayer,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.audioControl, { backgroundColor: colors.accent }]}>
                    {playerStatus.playing ? (
                      <View style={styles.pauseGlyph}>
                        <View style={styles.pauseBar} />
                        <View style={styles.pauseBar} />
                      </View>
                    ) : <View style={styles.playGlyph} />}
                  </View>
                  <View style={styles.audioCopy}>
                    <Text style={[styles.audioTitle, { color: colors.text }]}>Recording audio</Text>
                    <Text style={[styles.audioStatus, { color: colors.textMuted }]}>{playerStatus.playing ? "Playing on this device" : "Tap to listen"}</Text>
                  </View>
                  <Text style={[styles.audioAction, { color: colors.accent }]}>{playerStatus.playing ? "Pause" : "Play"}</Text>
                </Pressable>
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
            </View>
            <SectionTabs
              activeSection={activeSection}
              onChange={setActiveSection}
              accentColor={colors.accent}
              backgroundColor={colors.surfaceMuted}
              mutedColor={colors.textMuted}
              surfaceColor={colors.surface}
              textColor={colors.text}
            />
            {activeSection === "transcript" && <View
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
            </View>}
            {activeSection === "insights" && <View style={[styles.knowledgeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.headingCopy}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Structured Note</Text>
                <Text style={[styles.supportingText, { color: colors.textMuted }]}>Summary, key points, tasks, reminders, and calendar events.</Text>
              </View>
              {coreGeneration.status === "generating" || coreGeneration.status === "queued" ? (
                <View style={[styles.generationStatus, { backgroundColor: colors.surfaceMuted }]}>
                  <ActivityIndicator color={colors.accent} />
                  <View style={styles.headingCopy}>
                    <Text style={[styles.statusTitle, { color: colors.text }]}>{coreGeneration.status === "queued" ? "Waiting for local AI…" : "Extracting core insights…"}</Text>
                    <Text style={[styles.supportingText, { color: colors.textMuted }]}>Running privately on this device.</Text>
                  </View>
                </View>
              ) : (
                <>
                  {state.coreInsights && <CoreInsightResult
                    insight={state.coreInsights}
                    textColor={colors.text}
                    mutedColor={colors.textMuted}
                    borderColor={colors.border}
                    accentColor={colors.accent}
                    surfaceMutedColor={colors.surfaceMuted}
                    onTaskCompletedChange={setCoreTaskCompleted}
                  />}
                  {coreItemError && <Text selectable style={[styles.errorText, { color: colors.danger }]}>{coreItemError}</Text>}
                  {coreGeneration.status === "error" && <Text selectable style={[styles.errorText, { color: colors.danger }]}>{coreGeneration.message}</Text>}
                  <AppButton label={state.coreInsights ? "Regenerate Core Insights" : "Generate Core Insights"} variant={state.coreInsights ? "secondary" : undefined} onPress={() => void generateCoreInsights()} />
                </>
              )}
            </View>}
            {activeSection === "knowledge" && <View
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

              {generation.status === "generating" || generation.status === "queued" ? (
                <View
                  style={[
                    styles.generationStatus,
                    { backgroundColor: colors.surfaceMuted },
                  ]}
                >
                  <ActivityIndicator color={colors.accent} />
                  <View style={styles.headingCopy}>
                    <Text style={[styles.statusTitle, { color: colors.text }]}>
                      {generation.status === "queued" ? "Waiting for local AI…" : "Organizing your knowledge…"}
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
            </View>}
          </>
        )}
      </ScrollView>
      <Modal transparent animationType="slide" visible={actionModal !== null} onRequestClose={() => setActionModal(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalBackdrop}>
          <ScrollView keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.modal, { backgroundColor: colors.surface }]}>
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
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function CoreInsightResult({ insight, textColor, mutedColor, borderColor, accentColor, surfaceMutedColor, onTaskCompletedChange }: {
  insight: CoreNoteInsight;
  textColor: string;
  mutedColor: string;
  borderColor: string;
  accentColor: string;
  surfaceMutedColor: string;
  onTaskCompletedChange: (taskId: string, completed: boolean) => Promise<void>;
}) {
  const [activeSection, setActiveSection] = useState<InsightSectionKey>("summary");
  const reminders = insight.getCalendarIntents().filter((item) => item.kind === "reminder");
  const calendarIntents = insight.getCalendarIntents().filter((item) => item.kind === "calendar");
  const empty = "No relevant information found.";
  const formattedHtml = formatCoreInsightsAsHtml(insight);
  return (
    <View style={styles.document}>
      <CopyInsightsButton html={formattedHtml} position="top" />
      <SpeechPlaybackButton
        speechId={`structured-note:${insight.getId()}:${insight.getUpdatedAt()}`}
        label="Structured Note"
        text={formatCoreInsightsAsSpeech(insight)}
      />
      <InsightTabs activeSection={activeSection} onChange={setActiveSection} accentColor={accentColor} borderColor={borderColor} mutedColor={mutedColor} surfaceMutedColor={surfaceMutedColor} />
      {activeSection === "summary" && <InsightSection title="Summary" borderColor={borderColor} textColor={textColor} first>
        <Text selectable style={[styles.body, { color: insight.getSummary() ? textColor : mutedColor }]}>{insight.getSummary() || empty}</Text>
      </InsightSection>}
      {activeSection === "key-points" && <InsightSection title="Key Points" borderColor={borderColor} textColor={textColor} first>
        {insight.getKeyPoints().length ? (
          <View style={styles.bulletList}>
            {insight.getKeyPoints().map((item, index) => (
              <View key={`key-${index}`} style={styles.bulletRow}>
                <Text selectable style={[styles.bulletMarker, { color: mutedColor }]}>•</Text>
                <Text selectable style={[styles.resultItem, { color: textColor }]}>{item}</Text>
              </View>
            ))}
          </View>
        ) : <EmptyInsight text={empty} color={mutedColor} />}
      </InsightSection>}
      {activeSection === "tasks" && <InsightSection title="Tasks & Action Plan" borderColor={borderColor} textColor={textColor} first>
        {insight.getTasks().length ? insight.getTasks().map((task, taskIndex) => (
          <InteractiveTask key={task.id} task={task} index={taskIndex} textColor={textColor}
            mutedColor={mutedColor} borderColor={borderColor} accentColor={accentColor}
            surfaceMutedColor={surfaceMutedColor} onTaskCompletedChange={onTaskCompletedChange}
          />
        )) : <EmptyInsight text={empty} color={mutedColor} />}
        {insight.getUnassignedActionItems().map((item) => <InsightRow key={item.id} title={item.title} detail={item.description} time={coreTimeDisplay(item.metadata, item.dueAt ? "dueAt" : "startsAt", item.dueAt ?? item.startsAt)} textColor={textColor} mutedColor={mutedColor} />)}
      </InsightSection>}
      {activeSection === "reminders" && <InsightSection title="Reminders" borderColor={borderColor} textColor={textColor} first>
        {reminders.length ? reminders.map((item) => <InsightRow key={item.id} title={item.title} detail={item.description} time={coreTimeDisplay(item.metadata, item.remindAt ? "remindAt" : item.dueAt ? "dueAt" : "startsAt", item.remindAt ?? item.dueAt ?? item.startsAt)} textColor={textColor} mutedColor={mutedColor} />) : <EmptyInsight text={empty} color={mutedColor} />}
      </InsightSection>}
      {activeSection === "calendar" && <InsightSection title="Calendar Intents" borderColor={borderColor} textColor={textColor} first>
        {calendarIntents.length ? calendarIntents.map((item) => <InsightRow key={item.id} title={item.title} detail={item.description} time={coreTimeDisplay(item.metadata, "startsAt", item.startsAt)} textColor={textColor} mutedColor={mutedColor} />) : <EmptyInsight text={empty} color={mutedColor} />}
      </InsightSection>}
      <Text selectable style={[styles.generatedMeta, { color: mutedColor }]}>Generated locally · {formatDate(insight.getUpdatedAt())}</Text>
    </View>
  );
}

function SectionTabs({ activeSection, onChange, accentColor, backgroundColor, mutedColor, surfaceColor, textColor }: {
  activeSection: NoteSection;
  onChange: (section: NoteSection) => void;
  accentColor: string;
  backgroundColor: string;
  mutedColor: string;
  surfaceColor: string;
  textColor: string;
}) {
  const sections: { key: NoteSection; label: string }[] = [
    { key: "transcript", label: "Transcript" },
    { key: "insights", label: "Insights" },
    { key: "knowledge", label: "Knowledge" },
  ];
  return (
    <View accessibilityRole="tablist" style={[styles.sectionTabs, { backgroundColor }]}>
      {sections.map((section) => {
        const selected = section.key === activeSection;
        return <Pressable key={section.key} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => onChange(section.key)} style={({ pressed }) => [styles.sectionTab, { borderColor: "transparent" }, selected && { backgroundColor: surfaceColor, borderColor: accentColor }, pressed && styles.pressed]}>
          <Text style={[styles.sectionTabText, { color: selected ? textColor : mutedColor }]}>{section.label}</Text>
        </Pressable>;
      })}
    </View>
  );
}

function InsightTabs({ activeSection, onChange, accentColor, borderColor, mutedColor, surfaceMutedColor }: {
  activeSection: InsightSectionKey;
  onChange: (section: InsightSectionKey) => void;
  accentColor: string;
  borderColor: string;
  mutedColor: string;
  surfaceMutedColor: string;
}) {
  const sections: { key: InsightSectionKey; label: string }[] = [
    { key: "summary", label: "Summary" },
    { key: "key-points", label: "Key points" },
    { key: "tasks", label: "Tasks" },
    { key: "reminders", label: "Reminders" },
    { key: "calendar", label: "Calendar" },
  ];
  return (
    <View accessibilityRole="tablist" style={styles.insightTabs}>
      {sections.map((section) => {
        const selected = activeSection === section.key;
        return <Pressable key={section.key} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => onChange(section.key)} style={({ pressed }) => [styles.insightTab, { backgroundColor: selected ? accentColor : surfaceMutedColor, borderColor: selected ? accentColor : borderColor }, pressed && styles.pressed]}>
          <Text style={[styles.insightTabText, { color: selected ? "#ffffff" : mutedColor }]}>{section.label}</Text>
        </Pressable>;
      })}
    </View>
  );
}

function NoteIconAction({ label, symbol, color, backgroundColor, onPress }: {
  label: string;
  symbol: string;
  color: string;
  backgroundColor: string;
  onPress: () => void;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={6} onPress={onPress} style={({ pressed }) => [styles.noteIconAction, { backgroundColor }, pressed && styles.pressed]}>
    <Text style={[styles.noteIconSymbol, { color }]}>{symbol}</Text>
  </Pressable>;
}

function InteractiveTask({ task, index, textColor, mutedColor, borderColor, accentColor, surfaceMutedColor, onTaskCompletedChange }: {
  task: CoreTask;
  index: number;
  textColor: string;
  mutedColor: string;
  borderColor: string;
  accentColor: string;
  surfaceMutedColor: string;
  onTaskCompletedChange: (taskId: string, completed: boolean) => Promise<void>;
}) {
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const toggle = async (id: string, completed: boolean, update: (id: string, completed: boolean) => Promise<void>) => {
    if (busyIds.has(id)) return;
    setBusyIds((current) => new Set(current).add(id));
    try { await update(id, completed); }
    catch { /* The parent displays the persistence error. */ }
    finally {
      setBusyIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  };

  return (
    <View style={[styles.taskCard, { backgroundColor: surfaceMutedColor, borderColor }]}>
      <ChecklistRow
        title={`${index + 1}. ${task.title}`}
        description={task.description}
        time={coreTimeDisplay(task.metadata, "dueAt", task.dueAt)}
        completed={task.status === "completed"}
        busy={busyIds.has(task.id)}
        emphasized
        textColor={textColor}
        mutedColor={mutedColor}
        borderColor={borderColor}
        accentColor={accentColor}
        onPress={() => void toggle(task.id, task.status !== "completed", onTaskCompletedChange)}
      />
      <View style={styles.actionSteps}>
        {task.actionItems.length ? task.actionItems.map((item, actionIndex) => (
          <View key={item.id} style={styles.actionStep}>
            <Text selectable style={[styles.stepNumber, { color: mutedColor }]}>{actionIndex + 1}</Text>
            <View style={styles.stepCopy}>
              <Text selectable style={[styles.resultItem, { color: textColor }]}>{item.title}</Text>
              {displayValue(item.description) && <Text selectable style={[styles.supportingText, { color: mutedColor }]}>{item.description}</Text>}
              {coreTimeDisplay(item.metadata, item.dueAt ? "dueAt" : "startsAt", item.dueAt ?? item.startsAt) && (
                <Text selectable style={[styles.structuredMeta, { color: mutedColor }]}>Due: {coreTimeDisplay(item.metadata, item.dueAt ? "dueAt" : "startsAt", item.dueAt ?? item.startsAt)}</Text>
              )}
            </View>
          </View>
        )) : <EmptyInsight text="No actionable steps generated." color={mutedColor} />}
      </View>
    </View>
  );
}

function ChecklistRow({ title, description, time, completed, busy, emphasized = false, textColor, mutedColor, borderColor, accentColor, onPress }: {
  title: string;
  description: string | null;
  time: string | null;
  completed: boolean;
  busy: boolean;
  emphasized?: boolean;
  textColor: string;
  mutedColor: string;
  borderColor: string;
  accentColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: completed, disabled: busy }}
      accessibilityLabel={`${completed ? "Mark incomplete" : "Mark complete"}: ${title}`}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [styles.checklistRow, pressed && styles.pressed]}
    >
      <View style={[styles.checkbox, { borderColor: completed ? accentColor : borderColor }, completed && { backgroundColor: accentColor }]}>
        {busy ? <ActivityIndicator size="small" color={completed ? "#ffffff" : accentColor} /> : completed && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <View style={styles.stepCopy}>
        <Text selectable style={[emphasized ? styles.taskTitle : styles.resultItem,
          { color: completed ? mutedColor : textColor }, completed && styles.completedText]}>{title}</Text>
        {displayValue(description) && <Text selectable style={[styles.supportingText, { color: mutedColor }, completed && styles.completedText]}>{description}</Text>}
        {time && <Text selectable style={[styles.structuredMeta, { color: mutedColor }]}>Due: {time}</Text>}
      </View>
    </Pressable>
  );
}

function CopyInsightsButton({ html, position }: { html: string; position: "top" | "bottom" }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const theme = useTheme();
  const colors = Colors[theme.mode];

  const copy = async () => {
    try {
      const copied = await Clipboard.setStringAsync(html, { inputFormat: Clipboard.StringFormat.HTML });
      setCopyState(copied ? "copied" : "error");
      if (copied) setTimeout(() => setCopyState("idle"), 2000);
      console.info("[CoreInsights] Formatted content copied", { position, copied });
    } catch (error) {
      setCopyState("error");
      console.warn("[CoreInsights] Formatted copy failed", { position, error });
    }
  };

  return (
    <View style={styles.copyBlock}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Copy formatted insights"
        onPress={() => void copy()}
        style={({ pressed }) => [styles.copyButton, { backgroundColor: colors.accentSoft }, pressed && styles.pressed]}
      >
        <Text style={[styles.copyIcon, { color: colors.accent }]}>⧉</Text>
        <Text style={[styles.copyLabel, { color: colors.accent }]}>{copyState === "copied" ? "Copied" : "Copy insights"}</Text>
      </Pressable>
      {copyState === "error" && <Text selectable style={styles.copyError}>Unable to copy. Please try again.</Text>}
    </View>
  );
}

function formatCoreInsightsAsHtml(insight: CoreNoteInsight): string {
  const empty = "No relevant information found.";
  const list = (items: readonly string[]) => items.length
    ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : `<p><em>${empty}</em></p>`;
  const tasks = insight.getTasks().length
    ? `<ol>${insight.getTasks().map((task) => `<li><strong>${escapeHtml(task.title)}</strong>${optionalParagraph(task.description)}${optionalMeta("Due", coreTimeDisplay(task.metadata, "dueAt", task.dueAt))}${task.actionItems.length ? `<ol>${task.actionItems.map((item) => `<li>${escapeHtml(item.title)}${optionalParagraph(item.description)}${optionalMeta("Due", coreTimeDisplay(item.metadata, "dueAt", item.dueAt))}</li>`).join("")}</ol>` : `<p><em>No actionable steps generated.</em></p>`}</li>`).join("")}</ol>`
    : `<p><em>${empty}</em></p>`;
  const reminders = insight.getCalendarIntents().filter((item) => item.kind === "reminder");
  const calendarIntents = insight.getCalendarIntents().filter((item) => item.kind === "calendar");
  const timedList = (items: typeof reminders, time: (item: typeof reminders[number]) => string | null) => items.length
    ? `<ul>${items.map((item) => `<li><strong>${escapeHtml(item.title)}</strong>${optionalParagraph(item.description)}${optionalMeta("Time", time(item))}</li>`).join("")}</ul>`
    : `<p><em>${empty}</em></p>`;

  return `<article><h1>Structured Note</h1><h2>Summary</h2><p>${escapeHtml(insight.getSummary() || empty)}</p><h2>Key Points</h2>${list(insight.getKeyPoints())}<h2>Tasks &amp; Action Plan</h2>${tasks}<h2>Reminders</h2>${timedList(reminders, (item) => coreTimeDisplay(item.metadata, item.remindAt ? "remindAt" : item.dueAt ? "dueAt" : "startsAt", item.remindAt ?? item.dueAt ?? item.startsAt))}<h2>Calendar Intents</h2>${timedList(calendarIntents, (item) => coreTimeDisplay(item.metadata, "startsAt", item.startsAt))}<hr><p><small>Generated locally · ${escapeHtml(formatDate(insight.getUpdatedAt()))}</small></p></article>`;
}

function formatCoreInsightsAsSpeech(insight: CoreNoteInsight): string {
  const parts = ["Structured Note."];
  if (insight.getSummary()) parts.push(`Summary. ${insight.getSummary()}`);
  if (insight.getKeyPoints().length) parts.push(`Key points. ${insight.getKeyPoints().join(". ")}`);
  if (insight.getTasks().length) {
    parts.push(`Tasks. ${insight.getTasks().map((task) => {
      const steps = task.actionItems.length ? ` Steps. ${task.actionItems.map((item) => item.title).join(". ")}` : "";
      return `${task.title}.${steps}`;
    }).join(" ")}`);
  }
  const reminders = insight.getCalendarIntents().filter((item) => item.kind === "reminder");
  if (reminders.length) parts.push(`Reminders. ${reminders.map((item) => item.title).join(". ")}`);
  const calendar = insight.getCalendarIntents().filter((item) => item.kind === "calendar");
  if (calendar.length) parts.push(`Calendar. ${calendar.map((item) => item.title).join(". ")}`);
  return parts.join(" ");
}

function coreTimeDisplay(metadata: Record<string, unknown>, field: string, normalized: string | null): string | null {
  const expressions = metadata.timeExpressions;
  if (expressions && typeof expressions === "object" && !Array.isArray(expressions)) {
    const value = (expressions as Record<string, unknown>)[field];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const raw = (value as Record<string, unknown>).raw;
      const resolvedDate = (value as Record<string, unknown>).resolvedDate;
      const resolved = (value as Record<string, unknown>).normalized;
      const precision = (value as Record<string, unknown>).precision;
      if (typeof raw === "string" && displayValue(raw)) {
        const friendlyResolved = precision === "datetime" && typeof resolved === "string"
          ? formatResolvedTime(resolved)
          : typeof resolvedDate === "string" ? formatResolvedDate(resolvedDate) : null;
        return friendlyResolved && !raw.includes(friendlyResolved) ? `${raw}（${friendlyResolved}）` : raw;
      }
    }
  }
  return displayValue(normalized) ? formatResolvedTime(normalized) : null;
}

function formatResolvedDate(value: string): string | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatResolvedTime(value: string): string {
  const dateTime = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (dateTime) return `${new Date(Number(dateTime[1]), Number(dateTime[2]) - 1, Number(dateTime[3])).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}, ${dateTime[4]}:${dateTime[5]}`;
  return formatResolvedDate(value) ?? value;
}

function optionalParagraph(value: string | null): string {
  return displayValue(value) ? `<p>${escapeHtml(value)}</p>` : "";
}

function optionalMeta(label: string, value: string | null): string {
  return displayValue(value) ? `<p><small><strong>${label}:</strong> ${escapeHtml(value)}</small></p>` : "";
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function InsightSection({ title, borderColor, textColor, first = false, children }: { title: string; borderColor: string; textColor: string; first?: boolean; children: ReactNode }) {
  return <View style={[styles.knowledgeSection, !first && styles.dividedSection, !first && { borderColor }]}><Text style={[styles.resultTitle, { color: textColor }]}>{title}</Text>{children}</View>;
}

function InsightRow({ title, detail, time, textColor, mutedColor }: { title: string; detail?: string | null; time?: string | null; textColor: string; mutedColor: string }) {
  return <View style={styles.structuredItem}><Text selectable style={[styles.resultItem, { color: textColor }]}>{title}</Text>{displayValue(detail) && <Text selectable style={[styles.supportingText, { color: mutedColor }]}>{detail}</Text>}{displayValue(time) && <Text selectable style={[styles.structuredMeta, { color: mutedColor }]}>Time: {time}</Text>}</View>;
}

function displayValue(value: string | null | undefined): value is string {
  if (!value?.trim()) return false;
  return !["null", "unknown", "undefined", "none", "n/a", "na", "not specified", "unspecified"].includes(value.trim().toLocaleLowerCase());
}

function EmptyInsight({ text, color }: { text: string; color: string }) {
  return <Text selectable style={[styles.emptyInsight, { color }]}>{text}</Text>;
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
  const coreInsightSectionKeys = new Set(["keyPoints", "tasks", "reminders", "actionItems", "followUps", "nextSteps"]);
  const visibleSections = document.getSections().filter((section) => section.items.length > 0 && !coreInsightSectionKeys.has(section.key));
  return (
    <View style={styles.document}>
      <SpeechPlaybackButton
        speechId={`knowledge:${document.getId()}:${document.getUpdatedAt()}`}
        label="Knowledge document"
        text={[
          document.getSummary(),
          ...visibleSections.flatMap((section) => [section.title, ...section.items]),
        ].filter(Boolean).join(". ")}
      />
      {visibleSections.length === 0 && (
        <Text selectable style={[styles.emptyInsight, { color: mutedColor }]}>No supported scenario-specific information was found in this note.</Text>
      )}
      {visibleSections.map((section, sectionIndex) => (
          <View
            key={section.key}
            style={[
              styles.knowledgeSection,
              sectionIndex > 0 && styles.dividedSection,
              sectionIndex > 0 && { borderColor },
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
  content: { gap: Spacing.lg, padding: Spacing.lg },
  header: { gap: Spacing.md },
  headerUtilityRow: { alignItems: "center", flexDirection: "row", gap: Spacing.md, justifyContent: "space-between" },
  kicker: { fontSize: 12, fontWeight: "800", letterSpacing: 1.4 },
  title: { fontSize: 36, fontWeight: "800", lineHeight: 42 },
  metaRow: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  meta: { fontSize: 13 },
  audioPlayer: { alignItems: "center", borderCurve: "continuous", borderRadius: Radius.md, borderWidth: 1, flexDirection: "row", gap: Spacing.md, minHeight: 64, padding: Spacing.sm },
  audioControl: { alignItems: "center", borderRadius: 20, height: 40, justifyContent: "center", width: 40 },
  audioCopy: { flex: 1, gap: 2, minWidth: 0 },
  audioTitle: { fontSize: 15, fontWeight: "800" },
  audioStatus: { fontSize: 12 },
  audioAction: { fontSize: 13, fontWeight: "800", paddingHorizontal: Spacing.xs },
  playGlyph: { borderBottomWidth: 6, borderLeftColor: "#ffffff", borderLeftWidth: 9, borderTopWidth: 6, borderBottomColor: "transparent", borderTopColor: "transparent", height: 0, marginLeft: 2, width: 0 },
  pauseGlyph: { flexDirection: "row", gap: 4 },
  pauseBar: { backgroundColor: "#ffffff", borderRadius: 1, height: 14, width: 3 },
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
    gap: Spacing.md,
    padding: Spacing.md,
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
  noteActionRow: { flexDirection: "row", gap: 6, justifyContent: "flex-end" },
  noteIconAction: {
    alignItems: "center",
    borderCurve: "continuous",
    borderRadius: 12,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  noteIconSymbol: { fontSize: 23, fontWeight: "700", lineHeight: 27 },
  sectionTabs: { borderCurve: "continuous", borderRadius: Radius.md, flexDirection: "row", gap: 4, padding: 4 },
  sectionTab: { alignItems: "center", borderCurve: "continuous", borderRadius: Radius.sm, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: 44, paddingHorizontal: Spacing.xs },
  sectionTabText: { fontSize: 13, fontWeight: "800" },
  insightTabs: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  insightTab: { alignItems: "center", borderCurve: "continuous", borderRadius: Radius.sm, borderWidth: 1, flexBasis: "30%", flexGrow: 1, justifyContent: "center", minHeight: 42, paddingHorizontal: Spacing.sm },
  insightTabText: { fontSize: 13, fontWeight: "800", textAlign: "center" },
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
  bulletList: { gap: Spacing.sm },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm },
  bulletMarker: { fontSize: 18, lineHeight: 25 },
  itemRow: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm },
  bullet: { fontSize: 18, lineHeight: 25 },
  resultItem: { flex: 1, fontSize: 16, lineHeight: 25 },
  generatedMeta: { fontSize: 12 },
  structuredItem: { gap: Spacing.xs, paddingVertical: Spacing.xs },
  structuredMeta: { fontSize: 12, fontVariant: ["tabular-nums"] },
  emptyInsight: { fontSize: 14, fontStyle: "italic", lineHeight: 20 },
  taskCard: { borderCurve: "continuous", borderRadius: Radius.md, borderWidth: 1, gap: Spacing.sm, padding: Spacing.sm },
  taskTitle: { fontSize: 17, fontWeight: "800", lineHeight: 24 },
  actionSteps: { gap: Spacing.xs, paddingLeft: Spacing.lg },
  actionStep: { alignItems: "flex-start", flexDirection: "row", gap: Spacing.sm, paddingVertical: Spacing.xs },
  stepNumber: { fontSize: 13, fontVariant: ["tabular-nums"], fontWeight: "800", lineHeight: 25, minWidth: 22 },
  stepCopy: { flex: 1, gap: 2 },
  checklistRow: { alignItems: "flex-start", flexDirection: "row", gap: Spacing.sm, minHeight: 44, padding: Spacing.xs },
  checkbox: { alignItems: "center", borderRadius: 7, borderWidth: 2, height: 24, justifyContent: "center", width: 24 },
  checkmark: { color: "#ffffff", fontSize: 16, fontWeight: "900", lineHeight: 19 },
  completedText: { textDecorationLine: "line-through" },
  copyBlock: { alignItems: "flex-start", gap: Spacing.xs },
  copyButton: { alignItems: "center", borderCurve: "continuous", borderRadius: 999, flexDirection: "row", gap: Spacing.xs, minHeight: 40, paddingHorizontal: Spacing.md },
  copyIcon: { fontSize: 19, fontWeight: "700" },
  copyLabel: { fontSize: 14, fontWeight: "800" },
  copyError: { color: Colors.light.danger, fontSize: 13, lineHeight: 18 },
});
