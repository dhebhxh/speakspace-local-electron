import { requestRecordingPermissionsAsync } from "expo-audio";
import { Stack, type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useHeaderHeight } from "expo-router/build/react-navigation/elements";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
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
import {
  NO_ACTIVE_LLM_ERROR,
  TRANSCRIPT_TOO_LONG_ERROR,
} from "@/constants/ask-ai-grounding-policy";
import { Colors, Radius, Spacing } from "@/constants/theme";
import type { AiMessage } from "@/domain/ai-message/ai-message";
import type { Note } from "@/domain/note/note";
import { useTheme } from "@/hooks/use-theme";
import type { AiConversationHistoryItem } from "@/services/ai-conversation-service";
import { formatDate } from "@/utils/format-date";

type ScreenState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      transcriptNotes: Note[];
      selectedNote: Note | null;
      messages: AiMessage[];
      conversationId: string | null;
      hasActiveModel: boolean;
      activeModelFileExists: boolean;
    };

type VoiceStatus = "idle" | "starting" | "recording" | "finishing";

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function noteTitle(note: Note | null): string {
  return note?.getName()?.trim() || "Untitled transcript";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export default function AskAiScreen() {
  const params = useLocalSearchParams<{
    conversationId?: string;
    noteId?: string;
  }>();
  const router = useRouter();
  const theme = useTheme();
  const colors = Colors[theme.mode];
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const {
    aiConversationService,
    llmInferenceService,
    llmModelService,
    noteService,
    transcriptionService,
  } = appContainer;
  const [state, setState] = useState<ScreenState>({ status: "loading" });
  const [input, setInput] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [history, setHistory] = useState<AiConversationHistoryItem[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("idle");
  const [voiceText, setVoiceText] = useState("");
  const scrollViewRef = useRef<ScrollView | null>(null);
  const generationInFlightRef = useRef(false);
  const retryInFlightRef = useRef(false);
  const sendInFlightRef = useRef(false);
  const [shouldFollowLatestMessage, setShouldFollowLatestMessage] =
    useState(true);

  const routeConversationId = firstParam(params.conversationId);
  const routeNoteId = firstParam(params.noteId);
  const isPersisted = state.status === "ready" && state.conversationId !== null;
  const isBusy = isGenerating || voiceStatus !== "idle";
  const latestMessage =
    state.status === "ready" ? (state.messages.at(-1) ?? null) : null;
  const hasUnansweredUserMessage =
    isPersisted && !isGenerating && latestMessage?.getRole() === "user";

  const visibleMessages = useMemo(() => {
    if (state.status !== "ready") return [];
    return state.messages;
  }, [state]);

  const load = async () => {
    if (
      routeConversationId !== null &&
      state.status === "ready" &&
      state.conversationId === routeConversationId
    ) {
      return;
    }

    setState({ status: "loading" });
    setNotice(null);

    try {
      const [transcriptNotes, activeModel] = await Promise.all([
        noteService.getTranscriptNotes(),
        llmModelService.getActiveModel(),
      ]);
      const hasActiveModel = activeModel !== null;
      const activeModelFileExists =
        activeModel === null || llmModelService.resolveModelFile(activeModel).exists;

      if (routeConversationId !== null) {
        await aiConversationService.getConversationOrThrow(routeConversationId);
        const [messages, linkedNotes] = await Promise.all([
          aiConversationService.getCanonicalMessages(routeConversationId),
          aiConversationService.getLinkedNotes(routeConversationId),
        ]);

        setState({
          status: "ready",
          transcriptNotes,
          selectedNote: linkedNotes[0] ?? null,
          messages,
          conversationId: routeConversationId,
          hasActiveModel,
          activeModelFileExists,
        });
        return;
      }

      const selectedNote =
        transcriptNotes.find((note) => note.getId() === routeNoteId) ??
        transcriptNotes[0] ??
        null;

      setState({
        status: "ready",
        transcriptNotes,
        selectedNote,
        messages: [],
        conversationId: null,
        hasActiveModel,
        activeModelFileExists,
      });
    } catch (error) {
      setState({ status: "error", message: errorMessage(error) });
    }
  };

  useEffect(() => {
    void load();
  }, [routeConversationId, routeNoteId]);

  useEffect(
    () => () => {
      void transcriptionService.discard();
    },
    [transcriptionService],
  );

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSubscription = Keyboard.addListener(showEvent, () =>
      setIsKeyboardVisible(true),
    );
    const hideSubscription = Keyboard.addListener(hideEvent, () =>
      setIsKeyboardVisible(false),
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const refreshMessages = async (conversationId: string) => {
    const messages = await aiConversationService.getCanonicalMessages(
      conversationId,
    );
    setState((previous) =>
      previous.status === "ready" && previous.conversationId === conversationId
        ? { ...previous, messages }
        : previous,
    );
  };

  const claimGeneration = (): boolean => {
    if (generationInFlightRef.current) {
      return false;
    }

    generationInFlightRef.current = true;
    setIsGenerating(true);
    return true;
  };

  const generateForConversation = async (conversationId: string) => {
    setNotice(null);
    setStreamingText("");

    try {
      await llmInferenceService.generate(conversationId, {
        onToken: (tokenText) =>
          setStreamingText((previous) => previous + tokenText),
      });
      setStreamingText("");
      await refreshMessages(conversationId);
      setNotice(null);
    } catch (error) {
      const message = errorMessage(error);
      setNotice(
        message === TRANSCRIPT_TOO_LONG_ERROR
          ? TRANSCRIPT_TOO_LONG_ERROR
          : message,
      );
      setStreamingText("");
      await refreshMessages(conversationId).catch(() => undefined);
    } finally {
      generationInFlightRef.current = false;
      setIsGenerating(false);
    }
  };

  const sendMessage = async (rawContent: string, ignoreBusy = false) => {
    const content = rawContent.trim();
    if (state.status !== "ready" || content.length === 0) return;
    if (sendInFlightRef.current || generationInFlightRef.current) return;
    if (!ignoreBusy && isBusy) return;

    if (hasUnansweredUserMessage) {
      setNotice(
        "Finish the current turn first. Retry the last question or start a new conversation.",
      );
      return;
    }

    if (state.selectedNote === null && state.conversationId === null) {
      setNotice("Select a transcript before asking.");
      return;
    }

    setNotice(null);
    setStreamingText("");
    if (!claimGeneration()) {
      return;
    }
    sendInFlightRef.current = true;

    let generationConversationId: string | null = null;
    try {
      const createdNewConversation = state.conversationId === null;
      const sendResult =
        state.conversationId === null
          ? await aiConversationService.sendUserMessage({
              noteId: state.selectedNote!.getId(),
              content,
            })
          : await aiConversationService.sendUserMessage({
              conversationId: state.conversationId,
              content,
            });

      generationConversationId = sendResult.conversationId;
      setInput("");
      setState((previous) =>
        previous.status === "ready"
          ? {
              ...previous,
              conversationId: sendResult.conversationId,
              messages: sendResult.messages,
            }
          : previous,
      );

      await generateForConversation(sendResult.conversationId);

      if (createdNewConversation) {
        router.setParams({ conversationId: sendResult.conversationId });
      }
    } catch (error) {
      generationInFlightRef.current = false;
      setIsGenerating(false);
      const message = errorMessage(error);
      setNotice(
        message === TRANSCRIPT_TOO_LONG_ERROR
          ? TRANSCRIPT_TOO_LONG_ERROR
          : message,
      );
      setStreamingText("");
      if (generationConversationId !== null) {
        await refreshMessages(generationConversationId).catch(() => undefined);
      }
    } finally {
      sendInFlightRef.current = false;
    }
  };

  const retryLastUserMessage = async () => {
    if (
      state.status !== "ready" ||
      state.conversationId === null ||
      !hasUnansweredUserMessage ||
      isBusy ||
      retryInFlightRef.current ||
      generationInFlightRef.current
    ) {
      return;
    }

    retryInFlightRef.current = true;
    if (!claimGeneration()) {
      retryInFlightRef.current = false;
      return;
    }

    let handedOffToGeneration = false;
    try {
      const canonicalMessages =
        await aiConversationService.getCanonicalMessages(state.conversationId);
      const canonicalLastMessage = canonicalMessages.at(-1) ?? null;

      if (canonicalLastMessage?.getRole() === "assistant") {
        setStreamingText("");
        setNotice(null);
        setState((previous) =>
          previous.status === "ready" &&
          previous.conversationId === state.conversationId
            ? { ...previous, messages: canonicalMessages }
            : previous,
        );
        generationInFlightRef.current = false;
        setIsGenerating(false);
        return;
      }

      if (canonicalLastMessage?.getRole() !== "user") {
        generationInFlightRef.current = false;
        setIsGenerating(false);
        await refreshMessages(state.conversationId).catch(() => undefined);
        return;
      }

      setState((previous) =>
        previous.status === "ready" &&
        previous.conversationId === state.conversationId
          ? { ...previous, messages: canonicalMessages }
          : previous,
      );
      handedOffToGeneration = true;
      await generateForConversation(state.conversationId);
    } catch (error) {
      const message = errorMessage(error);
      setNotice(
        message === TRANSCRIPT_TOO_LONG_ERROR
          ? TRANSCRIPT_TOO_LONG_ERROR
          : message,
      );
      setStreamingText("");
      await refreshMessages(state.conversationId).catch(() => undefined);
    } finally {
      if (!handedOffToGeneration) {
        generationInFlightRef.current = false;
        setIsGenerating(false);
      }
      retryInFlightRef.current = false;
    }
  };

  const stopGeneration = async () => {
    setNotice("Generation stopped.");
    await llmInferenceService.stopGeneration();
  };

  const loadHistory = async () => {
    Keyboard.dismiss();
    setHistoryVisible(true);
    setHistoryError(null);
    try {
      setHistory(await aiConversationService.getConversationHistory());
    } catch (error) {
      setHistoryError(errorMessage(error));
    }
  };

  const openHistoryItem = (conversationId: string) => {
    setHistoryVisible(false);
    router.replace({
      pathname: "/ask-ai",
      params: { conversationId },
    } as unknown as Href);
  };

  const handleMessageScroll = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom =
      contentSize.height - (contentOffset.y + layoutMeasurement.height);
    setShouldFollowLatestMessage(distanceFromBottom < 72);
  };

  const startVoice = async () => {
    if (isGenerating || voiceStatus !== "idle") return;
    Keyboard.dismiss();
    setVoiceStatus("starting");
    setVoiceText("");
    setNotice(null);

    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        throw new Error("Microphone permission is required.");
      }
      await transcriptionService.start({
        onText: setVoiceText,
        onError: setNotice,
      });
      setVoiceStatus("recording");
    } catch (error) {
      setNotice(errorMessage(error));
      setVoiceStatus("idle");
    }
  };

  const finishVoice = async () => {
    if (voiceStatus !== "recording") return;
    setVoiceStatus("finishing");
    setNotice(null);

    try {
      const result = await transcriptionService.finish();
      transcriptionService.deleteRecording(result.audioRelativePath);
      setVoiceStatus("idle");
      setVoiceText("");
      if (result.transcript.trim().length === 0) {
        setNotice("Transcription did not produce a question.");
        return;
      }
      await sendMessage(result.transcript, true);
    } catch (error) {
      setNotice(errorMessage(error));
      setVoiceStatus("idle");
    }
  };

  const cancelVoice = async () => {
    await transcriptionService.discard();
    setVoiceStatus("idle");
    setVoiceText("");
  };

  const modelNotice =
    state.status === "ready" && !state.hasActiveModel
      ? NO_ACTIVE_LLM_ERROR
      : state.status === "ready" && !state.activeModelFileExists
        ? "The active model file is missing on this device."
        : null;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: "Ask AI" }} />
      {state.status === "loading" && <LoadingState />}
      {state.status === "error" && (
        <View style={styles.content}>
          <ErrorState message={state.message} onRetry={() => void load()} />
        </View>
      )}
      {state.status === "ready" && (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? headerHeight : 0}
          style={styles.keyboardAvoidingArea}
        >
          <View style={styles.readyContent}>
            <ScrollView
              ref={scrollViewRef}
              style={styles.messageScroller}
              contentInsetAdjustmentBehavior="automatic"
              keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={() => {
                if (shouldFollowLatestMessage) {
                  scrollViewRef.current?.scrollToEnd({ animated: true });
                }
              }}
              onScroll={handleMessageScroll}
              onScrollBeginDrag={Keyboard.dismiss}
              onTouchStart={Keyboard.dismiss}
              scrollEventThrottle={120}
              contentContainerStyle={[
                styles.content,
                { paddingBottom: Spacing.xxl + insets.bottom },
              ]}
            >
              <View style={styles.header}>
                <Text style={[styles.kicker, { color: colors.accent }]}>
                  LOCAL TRANSCRIPT AI
                </Text>
                <Text style={[styles.title, { color: colors.text }]}>Ask AI</Text>
                <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                  Ask about your transcripts. Answers are based only on the selected transcript.
                </Text>
                <View style={styles.headerActions}>
                  <AppButton
                    label="History"
                    variant="secondary"
                    onPress={() => void loadHistory()}
                  />
                  <AppButton
                    label="LLM Models"
                    variant="quiet"
                    onPress={() => router.push("/ai/llm-models" as Href)}
                  />
                </View>
              </View>

              {state.transcriptNotes.length === 0 ? (
                <EmptyState
                  title="You don't have any transcripts yet."
                  action={
                    <AppButton
                      label="Start recording"
                      onPress={() => router.push("/transcription")}
                    />
                  }
                />
              ) : (
                <View
                  style={[
                    styles.contextBar,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <View style={styles.contextText}>
                    <Text style={[styles.contextLabel, { color: colors.textMuted }]}>
                      Based on
                    </Text>
                    <Text style={[styles.contextTitle, { color: colors.text }]}>
                      {noteTitle(state.selectedNote)}
                    </Text>
                    {isPersisted && (
                      <Text style={[styles.locked, { color: colors.textMuted }]}>
                        Context locked for this conversation
                      </Text>
                    )}
                  </View>
                  {!isPersisted && (
                    <AppButton
                      label="Change"
                      variant="secondary"
                      disabled={isBusy}
                      onPress={() => {
                        Keyboard.dismiss();
                        setPickerVisible(true);
                      }}
                    />
                  )}
                  {isPersisted && (
                    <AppButton
                      label="New"
                      variant="secondary"
                      disabled={isBusy}
                      onPress={() => router.replace("/ask-ai" as Href)}
                    />
                  )}
                </View>
              )}

              {modelNotice !== null && (
                <View
                  style={[
                    styles.notice,
                    { backgroundColor: colors.accentSoft, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.noticeText, { color: colors.text }]}>
                    {modelNotice}
                  </Text>
                  <AppButton
                    label="Open models"
                    variant="quiet"
                    onPress={() => router.push("/ai/llm-models" as Href)}
                  />
                </View>
              )}

              {notice !== null && (
                <Text selectable style={[styles.errorText, { color: colors.danger }]}>
                  {notice}
                </Text>
              )}

              {hasUnansweredUserMessage && !isGenerating && (
                <View
                  style={[
                    styles.notice,
                    { backgroundColor: colors.accentSoft, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.noticeText, { color: colors.text }]}>
                    The last question has not received an assistant response yet.
                  </Text>
                  <View style={styles.composerActions}>
                    <AppButton
                      label="New conversation"
                      variant="secondary"
                      disabled={voiceStatus !== "idle"}
                      onPress={() => router.replace("/ask-ai" as Href)}
                    />
                    <AppButton
                      label="Retry"
                      disabled={voiceStatus !== "idle" || modelNotice !== null}
                      onPress={() => void retryLastUserMessage()}
                    />
                  </View>
                </View>
              )}

              <View style={styles.messages}>
                {visibleMessages.length === 0 && streamingText.length === 0 && (
                  <Text style={[styles.placeholder, { color: colors.textMuted }]}>
                    Start with a question about the selected transcript.
                  </Text>
                )}
                {visibleMessages.map((message) => (
                  <View
                    key={message.getId()}
                    style={[
                      styles.messageBubble,
                      message.getRole() === "user" ? styles.userBubble : styles.assistantBubble,
                      {
                        backgroundColor:
                          message.getRole() === "user"
                            ? colors.accent
                            : colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text
                      selectable
                      style={[
                        styles.messageText,
                        {
                          color:
                            message.getRole() === "user"
                              ? colors.surface
                              : colors.text,
                        },
                      ]}
                    >
                      {message.getContent()}
                    </Text>
                  </View>
                ))}
                {streamingText.length > 0 && (
                  <View
                    style={[
                      styles.messageBubble,
                      styles.assistantBubble,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                  >
                    <Text selectable style={[styles.messageText, { color: colors.text }]}>
                      {streamingText}
                    </Text>
                  </View>
                )}
              </View>

              {voiceStatus !== "idle" && (
                <View
                  style={[
                    styles.voicePanel,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.contextLabel, { color: colors.textMuted }]}>
                    {voiceStatus === "starting"
                      ? "Starting microphone"
                      : voiceStatus === "finishing"
                        ? "Finishing transcription"
                        : "Recording question"}
                  </Text>
                  <Text
                    selectable
                    style={[
                      styles.voiceText,
                      { color: voiceText ? colors.text : colors.textMuted },
                    ]}
                  >
                    {voiceText || "Your spoken question will appear here."}
                  </Text>
                  <View style={styles.composerActions}>
                    <AppButton
                      label="Cancel"
                      variant="secondary"
                      onPress={() => void cancelVoice()}
                    />
                    <AppButton
                      label="Finish"
                      disabled={voiceStatus !== "recording"}
                      onPress={() => void finishVoice()}
                    />
                  </View>
                </View>
              )}
            </ScrollView>

            <View
              style={[
                styles.composer,
                {
                  backgroundColor: colors.surface,
                  borderTopColor: colors.border,
                  paddingBottom: isKeyboardVisible
                    ? Spacing.md
                    : Math.max(Spacing.md, insets.bottom + Spacing.sm),
                },
              ]}
            >
              <TextInput
                multiline
                editable={!isBusy && !hasUnansweredUserMessage}
                placeholder="Ask about this transcript..."
                placeholderTextColor={colors.textMuted}
                value={input}
                onChangeText={setInput}
                style={[
                  styles.input,
                  { borderColor: colors.border, color: colors.text },
                ]}
              />
              <View style={styles.composerActions}>
                {isGenerating ? (
                  <AppButton
                    label="Stop"
                    variant="secondary"
                    onPress={() => void stopGeneration()}
                  />
                ) : (
                  <AppButton
                    label="Mic"
                    variant="secondary"
                    disabled={
                      voiceStatus !== "idle" ||
                      hasUnansweredUserMessage ||
                      state.transcriptNotes.length === 0 ||
                      modelNotice !== null
                    }
                    onPress={() => void startVoice()}
                  />
                )}
                <AppButton
                  label={isGenerating ? "Sending..." : "Send"}
                  disabled={
                    isBusy ||
                    hasUnansweredUserMessage ||
                    input.trim().length === 0 ||
                    state.transcriptNotes.length === 0 ||
                    modelNotice !== null
                  }
                  onPress={() => void sendMessage(input)}
                />
              </View>
            </View>

            <Modal
              visible={pickerVisible}
              animationType="slide"
              transparent
              onRequestClose={() => setPickerVisible(false)}
            >
              <View style={styles.modalBackdrop}>
                <ScrollView
                  contentInsetAdjustmentBehavior="automatic"
                  keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={[
                    styles.modal,
                    {
                      backgroundColor: colors.surface,
                      paddingBottom: Spacing.lg + insets.bottom,
                    },
                  ]}
                >
                  <View style={styles.modalHeader}>
                    <Text style={[styles.modalTitle, { color: colors.text }]}>
                      Choose transcript
                    </Text>
                    <Pressable onPress={() => setPickerVisible(false)}>
                      <Text style={[styles.close, { color: colors.textMuted }]}>
                        Close
                      </Text>
                    </Pressable>
                  </View>
                  {state.transcriptNotes.map((note) => {
                    const selected = note.getId() === state.selectedNote?.getId();
                    return (
                      <Pressable
                        key={note.getId()}
                        accessibilityRole="button"
                        onPress={() => {
                          setState((previous) =>
                            previous.status === "ready"
                              ? { ...previous, selectedNote: note }
                              : previous,
                          );
                          setPickerVisible(false);
                        }}
                        style={[
                          styles.pickRow,
                          {
                            backgroundColor: selected
                              ? colors.accentSoft
                              : colors.background,
                            borderColor: selected ? colors.accent : colors.border,
                          },
                        ]}
                      >
                        <Text style={[styles.pickTitle, { color: colors.text }]}>
                          {noteTitle(note)}
                        </Text>
                        <Text style={[styles.pickMeta, { color: colors.textMuted }]}>
                          {formatDate(note.getUpdatedAt())}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </Modal>

            <Modal
              visible={historyVisible}
              animationType="slide"
              transparent
              onRequestClose={() => setHistoryVisible(false)}
            >
              <View style={styles.modalBackdrop}>
                <ScrollView
                  contentInsetAdjustmentBehavior="automatic"
                  keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={[
                    styles.modal,
                    {
                      backgroundColor: colors.surface,
                      paddingBottom: Spacing.lg + insets.bottom,
                    },
                  ]}
                >
                  <View style={styles.modalHeader}>
                    <Text style={[styles.modalTitle, { color: colors.text }]}>
                      AI History
                    </Text>
                    <Pressable onPress={() => setHistoryVisible(false)}>
                      <Text style={[styles.close, { color: colors.textMuted }]}>
                        Close
                      </Text>
                    </Pressable>
                  </View>
                  {historyError !== null && (
                    <Text style={[styles.errorText, { color: colors.danger }]}>
                      {historyError}
                    </Text>
                  )}
                  {history.length === 0 && historyError === null && (
                    <Text style={[styles.placeholder, { color: colors.textMuted }]}>
                      No Ask AI conversations yet.
                    </Text>
                  )}
                  {history.map((item) => (
                    <Pressable
                      key={item.conversation.getId()}
                      accessibilityRole="button"
                      onPress={() => openHistoryItem(item.conversation.getId())}
                      style={[
                        styles.pickRow,
                        { backgroundColor: colors.background, borderColor: colors.border },
                      ]}
                    >
                      <Text style={[styles.pickTitle, { color: colors.text }]}>
                        {item.conversation.getName()}
                      </Text>
                      <Text style={[styles.pickMeta, { color: colors.textMuted }]}>
                        Based on {noteTitle(item.linkedNotes[0] ?? null)}
                      </Text>
                      {item.latestMessage !== null && (
                        <Text
                          numberOfLines={2}
                          style={[styles.pickMeta, { color: colors.textMuted }]}
                        >
                          {item.latestMessage.getContent()}
                        </Text>
                      )}
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </Modal>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  keyboardAvoidingArea: { flex: 1 },
  readyContent: { flex: 1 },
  messageScroller: { flex: 1 },
  content: {
    gap: Spacing.lg,
    padding: Spacing.lg,
  },
  header: { gap: Spacing.xs },
  kicker: { fontSize: 12, fontWeight: "800", letterSpacing: 1.4 },
  title: { fontSize: 36, fontWeight: "800", lineHeight: 42 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  headerActions: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  contextBar: {
    alignItems: "center",
    borderRadius: Radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: Spacing.md,
    padding: Spacing.md,
  },
  contextText: { flex: 1, gap: 3 },
  contextLabel: { fontSize: 12, fontWeight: "800", letterSpacing: 0.8 },
  contextTitle: { fontSize: 17, fontWeight: "800" },
  locked: { fontSize: 12 },
  notice: {
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  noticeText: { fontSize: 14, lineHeight: 20 },
  errorText: { fontSize: 14, lineHeight: 20 },
  messages: { gap: Spacing.md, minHeight: 220 },
  placeholder: { fontSize: 15, lineHeight: 22, textAlign: "center" },
  messageBubble: {
    borderRadius: Radius.md,
    borderWidth: 1,
    maxWidth: "88%",
    padding: Spacing.md,
  },
  userBubble: { alignSelf: "flex-end" },
  assistantBubble: { alignSelf: "flex-start" },
  messageText: { fontSize: 16, lineHeight: 24 },
  voicePanel: {
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: Spacing.md,
    padding: Spacing.md,
  },
  voiceText: { fontSize: 16, lineHeight: 24 },
  composer: {
    borderTopWidth: 1,
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  input: {
    borderRadius: Radius.md,
    borderWidth: 1,
    fontSize: 16,
    maxHeight: 118,
    minHeight: 48,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  composerActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    backgroundColor: "rgba(0,0,0,0.36)",
    flex: 1,
    justifyContent: "flex-end",
  },
  modal: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    gap: Spacing.md,
    maxHeight: "82%",
    padding: Spacing.lg,
  },
  modalHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  modalTitle: { fontSize: 24, fontWeight: "800" },
  close: { fontSize: 14, fontWeight: "700" },
  pickRow: {
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: Spacing.xs,
    padding: Spacing.md,
  },
  pickTitle: { fontSize: 16, fontWeight: "800" },
  pickMeta: { fontSize: 13, lineHeight: 18 },
});
