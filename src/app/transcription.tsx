import { requestRecordingPermissionsAsync } from "expo-audio";
import {
  activateKeepAwakeAsync,
  deactivateKeepAwake,
} from "expo-keep-awake";
import { Stack, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  AppState,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { addAudioInterruptionListener } from "../../modules/audio-session-events";

import { appContainer } from "@/application";
import { AppButton } from "@/components/app-button";
import { SafeAreaModal } from "@/components/safe-area-modal";
import { Backgrounds, Colors, Radius, Shadows, Spacing } from "@/constants/theme";
import type { Workspace } from "@/domain/workspace/workspace";
import { useTheme } from "@/hooks/use-theme";

type SessionStatus = "idle" | "starting" | "recording" | "paused" | "finishing";
type FinishedSession = { transcript: string; audioRelativePath: string };
const LIVE_TRANSCRIPTION_KEEP_AWAKE_TAG = "speakspace-live-transcription";

export default function TranscriptionScreen() {
  const router = useRouter();
  const theme = useTheme();
  const colors = Colors[theme.mode];
  const insets = useSafeAreaInsets();
  const { transcriptionService, workspaceService, noteService } = appContainer;
  const [status, setStatus] = useState<SessionStatus>("idle");
  const statusRef = useRef<SessionStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState<FinishedSession | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [noteName, setNoteName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const pauseForSystem = (message: string) => {
      if (statusRef.current !== "recording") return;

      statusRef.current = "paused";
      setStatus("paused");
      void deactivateKeepAwake(LIVE_TRANSCRIPTION_KEEP_AWAKE_TAG).catch(
        () => undefined,
      );
      void transcriptionService.pause().then(
        () => setError(message),
        () => {
          setError(
            "SpeakSpace could not fully pause the recording. Return to the app and finish or discard it.",
          );
        },
      );
    };

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active" || statusRef.current !== "recording") return;
      pauseForSystem(
        "Recording paused because SpeakSpace left the foreground or the iPhone was locked. Tap Resume when you are ready.",
      );
    });
    const interruptionSubscription = addAudioInterruptionListener((event) => {
      if (event.type === "began") {
        pauseForSystem(
          "Recording paused because another app or system feature interrupted the microphone. Tap Resume when you are ready.",
        );
      }
    });

    return () => {
      subscription.remove();
      interruptionSubscription.remove();
    };
  }, [transcriptionService]);

  useEffect(() => () => {
    statusRef.current = "idle";
    void deactivateKeepAwake(LIVE_TRANSCRIPTION_KEEP_AWAKE_TAG).catch(
      () => undefined,
    );
    void transcriptionService.discard();
  }, [transcriptionService]);

  const start = async () => {
    Keyboard.dismiss();
    statusRef.current = "starting";
    setStatus("starting");
    setError(null);
    setTranscript("");
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) throw new Error("Microphone permission is required.");
      await transcriptionService.start({
        onText: setTranscript,
        onError: setError,
        onDurationWarning: () => {
          Alert.alert(
            "Five minutes remaining",
            "Live transcription will finish automatically at the two-hour limit.",
          );
        },
        onDurationLimitReached: () => {
          void finish(true);
        },
      });
      statusRef.current = "recording";
      setStatus("recording");
      void activateKeepAwakeAsync(LIVE_TRANSCRIPTION_KEEP_AWAKE_TAG).catch(
        () => undefined,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to start transcription.");
      statusRef.current = "idle";
      setStatus("idle");
    }
  };

  const togglePause = async () => {
    try {
      if (status === "recording") {
        statusRef.current = "paused";
        await transcriptionService.pause();
        setStatus("paused");
        void deactivateKeepAwake(LIVE_TRANSCRIPTION_KEEP_AWAKE_TAG).catch(
          () => undefined,
        );
      } else if (status === "paused") {
        await transcriptionService.resume();
        statusRef.current = "recording";
        setStatus("recording");
        setError(null);
        void activateKeepAwakeAsync(LIVE_TRANSCRIPTION_KEEP_AWAKE_TAG).catch(
          () => undefined,
        );
      }
    } catch {
      setError("Unable to change recording state.");
    }
  };

  const discardFinishedSession = (session: FinishedSession) => {
    transcriptionService.deleteRecording(session.audioRelativePath);
    setFinished(null);
    setTranscript("");
    setNoteName("");
    setError(null);
  };

  const confirmDiscardFinishedSession = () => {
    if (finished === null || isSaving) return;
    Keyboard.dismiss();
    Alert.alert(
      "Discard recording?",
      "This permanently deletes the finished recording and transcript.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => discardFinishedSession(finished),
        },
      ],
    );
  };

  const finish = async (reachedDurationLimit = false) => {
    statusRef.current = "finishing";
    setStatus("finishing");
    setError(null);
    void deactivateKeepAwake(LIVE_TRANSCRIPTION_KEEP_AWAKE_TAG).catch(
      () => undefined,
    );
    try {
      const result = await transcriptionService.finish();
      setTranscript(result.transcript);
      statusRef.current = "idle";
      setStatus("idle");
      if (result.transcript.trim().length === 0) {
        Alert.alert(
          "No speech detected",
          "SpeakSpace cannot create a note because no speech was transcribed. Discard the empty recording and try again.",
          [
            {
              text: "Discard recording",
              style: "destructive",
              onPress: () => discardFinishedSession(result),
            },
          ],
          { cancelable: false },
        );
        return;
      }
      Alert.alert(reachedDurationLimit ? "Two-hour limit reached" : "Finish transcription?", reachedDurationLimit
        ? "The recording finished safely. Save this note or discard the recording and transcript."
        : "Save this note or discard the recording and transcript.", [
        {
          text: "Discard",
          style: "destructive",
          onPress: () => discardFinishedSession(result),
        },
        { text: "Save", onPress: () => void prepareSave(result) },
      ], { cancelable: false });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to finish transcription.");
      statusRef.current = "idle";
      setStatus("idle");
    }
  };

  const prepareSave = async (result: FinishedSession) => {
    try {
      const defaultWorkspace = await workspaceService.getOrCreateDefaultWorkspace();
      const all = await workspaceService.getWorkspaces();
      setWorkspaces(all);
      setSelectedWorkspaceId(defaultWorkspace.getId());
      setFinished(result);
    } catch {
      setError("Unable to load workspaces.");
    }
  };

  const save = async () => {
    if (finished === null) return;
    setIsSaving(true);
    setError(null);
    try {
      const note = await noteService.createNote(
        selectedWorkspaceId,
        noteName,
        finished.transcript,
        finished.audioRelativePath,
      );
      setFinished(null);
      router.replace({ pathname: "/notes/[noteId]", params: { noteId: note.getId() } });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save note.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, experimental_backgroundImage: Backgrounds[theme.mode] }]}>
      <Stack.Screen options={{ title: "Live transcription" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Spacing.xxl + insets.bottom },
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>Audio and transcription stay on this device.</Text>
        </View>
        <View style={[styles.sessionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.transcript}>
            <Text style={[styles.status, { color: status === "recording" ? colors.accent : colors.textMuted }]}>
              {status === "recording" ? "●  Recording" : status === "paused" ? "Paused" : status === "starting" ? "Loading model…" : status === "finishing" ? "Finishing…" : "Ready to record"}
            </Text>
            <Text selectable style={[styles.body, { color: transcript ? colors.text : colors.textMuted }]}>
              {transcript || "Your live transcript will appear here."}
            </Text>
            {error && <Text selectable style={{ color: colors.danger }}>{error}</Text>}
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.controls}>
          {status === "idle" && <View style={styles.idleControl}>
            <Pressable accessibilityRole="button" accessibilityLabel="Start recording" onPress={() => void start()} style={({ pressed }) => [styles.recordButton, { backgroundColor: colors.accent }, pressed && styles.controlPressed]}>
              <View style={[styles.recordButtonInner, { backgroundColor: colors.surface }]} />
            </Pressable>
            <View style={styles.controlCopy}>
              <Text style={[styles.controlTitle, { color: colors.text }]}>Start recording</Text>
              <Text style={[styles.controlHint, { color: colors.textMuted }]}>Tap the button to begin live transcription</Text>
            </View>
          </View>}
          {(status === "starting" || status === "finishing") && <View style={styles.busyControl}>
            <ActivityIndicator color={colors.accent} size="large" />
            <Text style={[styles.controlHint, { color: colors.textMuted }]}>{status === "starting" ? "Preparing the speech model…" : "Finishing your transcript…"}</Text>
          </View>}
          {(status === "recording" || status === "paused") && (
            <View style={styles.activeControls}>
              <Pressable accessibilityRole="button" accessibilityLabel={status === "paused" ? "Resume recording" : "Pause recording"} onPress={() => void togglePause()} style={({ pressed }) => [styles.pauseButton, { backgroundColor: colors.accentSoft, borderColor: colors.border }, pressed && styles.controlPressed]}>
                <Text style={[styles.pauseIcon, { color: colors.accent }]}>{status === "paused" ? "▶" : "Ⅱ"}</Text>
              </Pressable>
              <View style={styles.activeCopy}>
                <Text style={[styles.controlTitle, { color: colors.text }]}>{status === "paused" ? "Recording paused" : "Recording in progress"}</Text>
                <Text style={[styles.controlHint, { color: colors.textMuted }]}>{status === "paused" ? "Resume when you are ready" : "Your words appear above as you speak"}</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => void finish()} style={({ pressed }) => [styles.finishButton, { borderColor: colors.accent }, pressed && styles.controlPressed]}>
                <Text style={[styles.finishLabel, { color: colors.accent }]}>Finish</Text>
              </Pressable>
            </View>
          )}
          </View>
        </View>
      </ScrollView>

      <SafeAreaModal
        androidPresentation="center"
        visible={finished !== null}
        onRequestClose={confirmDiscardFinishedSession}
      >
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Save transcription</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Discard recording"
            disabled={isSaving}
            hitSlop={10}
            onPress={confirmDiscardFinishedSession}
          >
            <Text style={[styles.discardLabel, { color: colors.danger }]}>Discard</Text>
          </Pressable>
        </View>
        <Text style={[styles.label, { color: colors.textMuted }]}>Note name</Text>
        <TextInput value={noteName} onChangeText={setNoteName} placeholder="e.g. Weekly planning" placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
        <Text style={[styles.label, { color: colors.textMuted }]}>Workspace</Text>
        <View style={styles.workspaceList}>
          {workspaces.map((workspace) => {
            const selected = workspace.getId() === selectedWorkspaceId;
            return (
              <Pressable key={workspace.getId()} onPress={() => setSelectedWorkspaceId(workspace.getId())} style={[styles.workspace, { borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.accentSoft : colors.background }]}>
                <Text style={{ color: colors.text, fontWeight: selected ? "800" : "500" }}>{workspace.getName()}</Text>
              </Pressable>
            );
          })}
        </View>
        {error && <Text selectable style={{ color: colors.danger }}>{error}</Text>}
        <AppButton label={isSaving ? "Saving…" : "Save note"} disabled={isSaving || noteName.trim().length === 0} onPress={() => void save()} />
      </SafeAreaModal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: Spacing.lg, padding: Spacing.lg },
  header: { gap: Spacing.sm },
  kicker: { fontSize: 12, fontWeight: "800", letterSpacing: 1.4 },
  title: { fontSize: 32, fontWeight: "800", lineHeight: 38 },
  subtitle: { fontSize: 16, lineHeight: 24 },
  sessionCard: { borderCurve: "continuous", borderRadius: Radius.lg, borderWidth: 1, boxShadow: Shadows.raised, overflow: "hidden" },
  transcript: { gap: Spacing.md, minHeight: 300, padding: Spacing.lg },
  status: { fontSize: 14, fontWeight: "800" },
  body: { fontSize: 18, lineHeight: 29 },
  divider: { height: StyleSheet.hairlineWidth },
  controls: { minHeight: 124, padding: Spacing.md },
  idleControl: { alignItems: "center", flexDirection: "row", gap: Spacing.md },
  recordButton: { alignItems: "center", borderRadius: 42, height: 84, justifyContent: "center", width: 84 },
  recordButtonInner: { borderRadius: 17, height: 34, width: 34 },
  controlCopy: { flex: 1, gap: Spacing.xs },
  controlTitle: { fontSize: 18, fontWeight: "800" },
  controlHint: { fontSize: 13, lineHeight: 19 },
  busyControl: { alignItems: "center", flex: 1, gap: Spacing.sm, justifyContent: "center" },
  activeControls: { alignItems: "center", flex: 1, flexDirection: "row", gap: Spacing.sm },
  pauseButton: { alignItems: "center", borderRadius: 30, borderWidth: 1, height: 60, justifyContent: "center", width: 60 },
  pauseIcon: { fontSize: 22, fontWeight: "900" },
  activeCopy: { flex: 1, gap: 2, minWidth: 0 },
  finishButton: { alignItems: "center", borderRadius: Radius.md, borderWidth: 1, justifyContent: "center", minHeight: 46, paddingHorizontal: Spacing.md },
  finishLabel: { fontSize: 14, fontWeight: "800" },
  controlPressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  modalHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  modalTitle: { fontSize: 24, fontWeight: "800" },
  discardLabel: { fontSize: 14, fontWeight: "800" },
  label: { fontSize: 14, fontWeight: "700" },
  input: { borderRadius: Radius.sm, borderWidth: 1, fontSize: 16, minHeight: 48, paddingHorizontal: Spacing.md },
  workspaceList: { gap: Spacing.sm },
  workspace: { borderRadius: Radius.sm, borderWidth: 1, padding: Spacing.md },
});
