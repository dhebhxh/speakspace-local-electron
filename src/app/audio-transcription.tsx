import * as DocumentPicker from "expo-document-picker";
import { Stack, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
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
import { Colors, Radius, Spacing } from "@/constants/theme";
import type { Workspace } from "@/domain/workspace/workspace";
import { useTheme } from "@/hooks/use-theme";
import { formatBytes } from "@/utils/format-bytes";

type Status = "empty" | "selected" | "preparing" | "transcribing" | "complete";
type SelectedAudio = { uri: string; name: string; size: number };

export default function AudioTranscriptionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const colors = Colors[theme.mode];
  const { noteService, transcriptionService, workspaceService } = appContainer;
  const selectedRef = useRef<SelectedAudio | null>(null);
  const [selected, setSelected] = useState<SelectedAudio | null>(null);
  const [status, setStatus] = useState<Status>("empty");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showSave, setShowSave] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [noteName, setNoteName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => () => {
    if (selectedRef.current !== null) {
      transcriptionService.deleteTemporaryImport(selectedRef.current.uri);
    }
  }, [transcriptionService]);

  const replaceSelection = (audio: SelectedAudio | null) => {
    if (selectedRef.current !== null && selectedRef.current.uri !== audio?.uri) {
      transcriptionService.deleteTemporaryImport(selectedRef.current.uri);
    }
    selectedRef.current = audio;
    setSelected(audio);
  };

  const chooseAudio = async () => {
    setError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "audio/*",
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      replaceSelection({ uri: asset.uri, name: asset.name, size: asset.size ?? 0 });
      setTranscript("");
      setStatus("selected");
    } catch (caught) {
      console.error("Audio file selection failed", caught);
      setError("That audio file could not be opened. Please choose another file.");
    }
  };

  const startTranscription = async () => {
    if (selected === null) return;
    let phase: "preparing" | "transcribing" = "preparing";
    setError(null);
    setTranscript("");
    setStatus("preparing");
    try {
      const text = await transcriptionService.transcribeFile(selected.uri, {
        onPrepared: () => {
          phase = "transcribing";
          setStatus("transcribing");
        },
      });
      if (text.length === 0) {
        throw new Error("The model did not detect any speech in this audio.");
      }
      setTranscript(text);
      setStatus("complete");
    } catch (caught) {
      console.error("Imported audio transcription failed", caught);
      const detail = caught instanceof Error ? caught.message : "";
      if (detail.includes("active speech recognition model")) {
        setError("No speech recognition model is active. Activate a model in AI first.");
      } else if (detail.includes("missing")) {
        setError("The active speech recognition model is unavailable. Please download or activate it again.");
      } else if (phase === "preparing") {
        setError("This audio could not be prepared. The file may be damaged or use an unsupported codec.");
      } else {
        setError("Transcription failed. Please try again or choose another audio file.");
      }
      setStatus("selected");
    }
  };

  const prepareSave = async () => {
    setError(null);
    try {
      const defaultWorkspace = await workspaceService.getOrCreateDefaultWorkspace();
      setWorkspaces(await workspaceService.getWorkspaces());
      setSelectedWorkspaceId(defaultWorkspace.getId());
      setNoteName(selected?.name.replace(/\.[^.]+$/, "") ?? "");
      setShowSave(true);
    } catch (caught) {
      console.error("Loading workspaces for imported transcript failed", caught);
      setError("Your workspaces could not be loaded.");
    }
  };

  const save = async () => {
    if (selected === null) return;
    setIsSaving(true);
    setError(null);
    let audioRelativePath: string | null = null;
    try {
      audioRelativePath = transcriptionService.preserveImportedAudio(selected.uri, selected.name);
      const note = await noteService.createNote(
        selectedWorkspaceId,
        noteName,
        transcript,
        audioRelativePath,
      );
      replaceSelection(null);
      setShowSave(false);
      router.replace({ pathname: "/notes/[noteId]", params: { noteId: note.getId() } });
    } catch (caught) {
      if (audioRelativePath !== null) transcriptionService.deleteRecording(audioRelativePath);
      console.error("Saving imported transcript as note failed", caught);
      setError("The note could not be saved. Your transcript is still here.");
    } finally {
      setIsSaving(false);
    }
  };

  const discard = () => {
    replaceSelection(null);
    setTranscript("");
    setError(null);
    setStatus("empty");
  };

  const busy = status === "preparing" || status === "transcribing";

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: "Transcribe audio file" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.content, { paddingBottom: Spacing.xxl + insets.bottom }]}
      >
        <View style={styles.header}>
          <Text style={[styles.kicker, { color: colors.accent }]}>ON-DEVICE TRANSCRIPTION</Text>
          <Text style={[styles.title, { color: colors.text }]}>Bring your own audio.</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>Choose an audio file from anywhere on your device. It never leaves this device.</Text>
        </View>

        {selected === null ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Choose an audio file</Text>
            <Text style={{ color: colors.textMuted, lineHeight: 22 }}>MP3, M4A, AAC, WAV, FLAC, OGG and other device-supported audio formats.</Text>
            <AppButton label="Choose audio" onPress={() => void chooseAudio()} />
          </View>
        ) : (
          <>
            <View style={[styles.fileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.fileDetails}>
                <Text selectable numberOfLines={2} style={[styles.fileName, { color: colors.text }]}>{selected.name}</Text>
                <Text selectable style={{ color: colors.textMuted }}>{formatBytes(selected.size)}</Text>
              </View>
              {status !== "complete" && (
                <View style={styles.actions}>
                  <AppButton label={busy ? (status === "preparing" ? "Preparing audio…" : "Transcribing…") : "Start transcription"} disabled={busy} onPress={() => void startTranscription()} />
                  <AppButton label="Choose another audio" variant="secondary" disabled={busy} onPress={() => void chooseAudio()} />
                </View>
              )}
            </View>

            {(busy || status === "complete") && (
              <View style={[styles.transcript, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.status, { color: busy ? colors.accent : colors.textMuted }]}>
                  {status === "preparing" ? "Preparing audio" : status === "transcribing" ? "Transcribing" : "Transcription complete"}
                </Text>
                <Text selectable style={[styles.body, { color: transcript ? colors.text : colors.textMuted }]}>
                  {transcript || (status === "preparing" ? "Converting audio locally when needed…" : "The full transcript will appear here.")}
                </Text>
              </View>
            )}

            {status === "complete" && (
              <View style={styles.actions}>
                <AppButton label="Save as note" onPress={() => void prepareSave()} />
                <AppButton label="Discard" variant="secondary" onPress={discard} />
              </View>
            )}
          </>
        )}
        {error !== null && <Text selectable style={{ color: colors.danger }}>{error}</Text>}
      </ScrollView>

      <Modal visible={showSave} animationType="slide" transparent onRequestClose={() => setShowSave(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalBackdrop}>
          <ScrollView contentContainerStyle={[styles.modal, { backgroundColor: colors.surface, paddingBottom: Spacing.lg + insets.bottom }]} keyboardShouldPersistTaps="handled">
            <Text style={[styles.modalTitle, { color: colors.text }]}>Save transcription</Text>
            <Text style={[styles.label, { color: colors.textMuted }]}>Note name</Text>
            <TextInput value={noteName} onChangeText={setNoteName} placeholder="e.g. Interview recording" placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
            <Text style={[styles.label, { color: colors.textMuted }]}>Workspace</Text>
            <View style={styles.workspaceList}>
              {workspaces.map((workspace) => {
                const active = workspace.getId() === selectedWorkspaceId;
                return <Pressable key={workspace.getId()} onPress={() => setSelectedWorkspaceId(workspace.getId())} style={[styles.workspace, { borderColor: active ? colors.accent : colors.border, backgroundColor: active ? colors.accentSoft : colors.background }]}><Text style={{ color: colors.text, fontWeight: active ? "800" : "500" }}>{workspace.getName()}</Text></Pressable>;
              })}
            </View>
            {error !== null && <Text selectable style={{ color: colors.danger }}>{error}</Text>}
            <AppButton label={isSaving ? "Saving…" : "Save note"} disabled={isSaving || noteName.trim().length === 0} onPress={() => void save()} />
            <AppButton label="Cancel" variant="quiet" disabled={isSaving} onPress={() => setShowSave(false)} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: Spacing.xl, padding: Spacing.lg },
  header: { gap: Spacing.sm },
  kicker: { fontSize: 12, fontWeight: "800", letterSpacing: 1.4 },
  title: { fontSize: 36, fontWeight: "800", lineHeight: 42 },
  subtitle: { fontSize: 16, lineHeight: 24 },
  emptyCard: { borderRadius: Radius.md, borderWidth: 1, gap: Spacing.md, padding: Spacing.lg },
  cardTitle: { fontSize: 20, fontWeight: "800" },
  fileCard: { borderRadius: Radius.md, borderWidth: 1, gap: Spacing.lg, padding: Spacing.lg },
  fileDetails: { gap: Spacing.xs },
  fileName: { fontSize: 18, fontWeight: "800" },
  transcript: { borderRadius: Radius.md, borderWidth: 1, gap: Spacing.md, minHeight: 260, padding: Spacing.lg },
  status: { fontSize: 14, fontWeight: "800" },
  body: { fontSize: 18, lineHeight: 29 },
  actions: { gap: Spacing.sm },
  modalBackdrop: { backgroundColor: "rgba(0,0,0,0.36)", flex: 1, justifyContent: "flex-end" },
  modal: { borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, gap: Spacing.md, padding: Spacing.lg },
  modalTitle: { fontSize: 24, fontWeight: "800" },
  label: { fontSize: 14, fontWeight: "700" },
  input: { borderRadius: Radius.sm, borderWidth: 1, fontSize: 16, minHeight: 48, paddingHorizontal: Spacing.md },
  workspaceList: { gap: Spacing.sm },
  workspace: { borderRadius: Radius.sm, borderWidth: 1, padding: Spacing.md },
});
