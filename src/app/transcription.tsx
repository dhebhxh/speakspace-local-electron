import { requestRecordingPermissionsAsync } from "expo-audio";
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
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
import { Colors, Radius, Spacing } from "@/constants/theme";
import type { Workspace } from "@/domain/workspace/workspace";
import { useTheme } from "@/hooks/use-theme";

type SessionStatus = "idle" | "starting" | "recording" | "paused" | "finishing";
type FinishedSession = { transcript: string; audioRelativePath: string };

export default function TranscriptionScreen() {
  const router = useRouter();
  const theme = useTheme();
  const colors = Colors[theme.mode];
  const { transcriptionService, workspaceService, noteService } = appContainer;
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState<FinishedSession | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [noteName, setNoteName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => () => {
    void transcriptionService.discard();
  }, [transcriptionService]);

  const start = async () => {
    setStatus("starting");
    setError(null);
    setTranscript("");
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) throw new Error("Microphone permission is required.");
      await transcriptionService.start({
        onText: setTranscript,
        onError: setError,
      });
      setStatus("recording");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to start transcription.");
      setStatus("idle");
    }
  };

  const togglePause = async () => {
    try {
      if (status === "recording") {
        await transcriptionService.pause();
        setStatus("paused");
      } else if (status === "paused") {
        await transcriptionService.resume();
        setStatus("recording");
      }
    } catch {
      setError("Unable to change recording state.");
    }
  };

  const finish = async () => {
    setStatus("finishing");
    setError(null);
    try {
      const result = await transcriptionService.finish();
      setTranscript(result.transcript);
      setStatus("idle");
      Alert.alert("Finish transcription?", "Save this note or discard the recording and transcript.", [
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            transcriptionService.deleteRecording(result.audioRelativePath);
            setTranscript("");
          },
        },
        { text: "Save", onPress: () => void prepareSave(result) },
      ], { cancelable: false });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to finish transcription.");
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
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: "Live transcription" }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.kicker, { color: colors.accent }]}>LOCAL SPEECH TO TEXT</Text>
          <Text style={[styles.title, { color: colors.text }]}>Capture the conversation.</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>Audio and transcription stay on this device.</Text>
        </View>
        <View style={[styles.transcript, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.status, { color: status === "recording" ? colors.accent : colors.textMuted }]}>
            {status === "recording" ? "● Recording" : status === "paused" ? "Paused" : status === "starting" ? "Loading model…" : status === "finishing" ? "Finishing…" : "Ready"}
          </Text>
          <Text selectable style={[styles.body, { color: transcript ? colors.text : colors.textMuted }]}>
            {transcript || "Your live transcript will appear here."}
          </Text>
        </View>
        {error && <Text selectable style={{ color: colors.danger }}>{error}</Text>}
        <View style={styles.actions}>
          {status === "idle" && <AppButton label="Start transcription" onPress={() => void start()} />}
          {(status === "recording" || status === "paused") && (
            <>
              <AppButton label={status === "paused" ? "Resume" : "Pause"} variant="secondary" onPress={() => void togglePause()} />
              <AppButton label="Finish" onPress={() => void finish()} />
            </>
          )}
        </View>
      </ScrollView>

      <Modal visible={finished !== null} animationType="slide" transparent onRequestClose={() => undefined}>
        <View style={styles.modalBackdrop}>
          <ScrollView contentContainerStyle={[styles.modal, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Save transcription</Text>
            <Text style={[styles.label, { color: colors.textMuted }]}>Note name</Text>
            <TextInput autoFocus value={noteName} onChangeText={setNoteName} placeholder="e.g. Weekly planning" placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
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
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: Spacing.xl, padding: Spacing.lg, paddingBottom: Spacing.xxl },
  header: { gap: Spacing.sm },
  kicker: { fontSize: 12, fontWeight: "800", letterSpacing: 1.4 },
  title: { fontSize: 36, fontWeight: "800", lineHeight: 42 },
  subtitle: { fontSize: 16, lineHeight: 24 },
  transcript: { borderRadius: Radius.md, borderWidth: 1, gap: Spacing.md, minHeight: 260, padding: Spacing.lg },
  status: { fontSize: 14, fontWeight: "800" },
  body: { fontSize: 18, lineHeight: 29 },
  actions: { flexDirection: "row", gap: Spacing.md },
  modalBackdrop: { backgroundColor: "rgba(0,0,0,0.36)", flex: 1, justifyContent: "flex-end" },
  modal: { borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, gap: Spacing.md, padding: Spacing.lg, paddingBottom: Spacing.xxl },
  modalTitle: { fontSize: 24, fontWeight: "800" },
  label: { fontSize: 14, fontWeight: "700" },
  input: { borderRadius: Radius.sm, borderWidth: 1, fontSize: 16, minHeight: 48, paddingHorizontal: Spacing.md },
  workspaceList: { gap: Spacing.sm },
  workspace: { borderRadius: Radius.sm, borderWidth: 1, padding: Spacing.md },
});
