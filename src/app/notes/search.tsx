import { UiTextInput as TextInput } from "@/components/ui-text-input";
import { UiText as Text } from "@/components/ui-text";
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Keyboard, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { appContainer } from "@/application";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { NoteCard } from "@/components/note-card";
import { Colors, Radius, Spacing } from "@/constants/theme";
import type { Note } from "@/domain/note/note";
import { useTheme } from "@/hooks/use-theme";

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; notes: Note[] };

export default function NoteSearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = Colors[useTheme().mode];
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>({ status: "idle" });

  useEffect(() => {
    let active = true;
    const normalized = query.trim();
    if (normalized.length === 0) {
      setState({ status: "idle" });
      return;
    }
    setState({ status: "loading" });
    const timer = setTimeout(() => {
      void appContainer.noteService.searchNotes(normalized).then(
        (notes) => active && setState({ status: "success", notes }),
        () => active && setState({ status: "error", message: "Unable to search notes." }),
      );
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: "Search notes" }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" onScrollBeginDrag={Keyboard.dismiss} contentContainerStyle={[styles.content, { paddingBottom: Spacing.xxl + insets.bottom }]}>
        <TextInput
          autoFocus
          accessibilityLabel="Search notes"
          value={query}
          onChangeText={setQuery}
          placeholder="Search titles and transcripts"
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
          blurOnSubmit
          onSubmitEditing={Keyboard.dismiss}
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
        />
        {state.status === "idle" && <EmptyState title="Search your notes" description="Enter a word or phrase from a title or transcript." />}
        {state.status === "loading" && <LoadingState />}
        {state.status === "error" && <ErrorState message={state.message} onRetry={() => setQuery((value) => `${value} `)} />}
        {state.status === "success" && state.notes.length === 0 && <EmptyState title="No notes found" description={`No title or transcript matches “${query.trim()}”.`} />}
        {state.status === "success" && state.notes.length > 0 && <View style={styles.list}>
          <Text style={[styles.count, { color: colors.textMuted }]}>{state.notes.length} {state.notes.length === 1 ? "result" : "results"}</Text>
          {state.notes.map((note) => <NoteCard key={note.getId()} note={note} onPress={() => router.push({ pathname: "/notes/[noteId]", params: { noteId: note.getId() } })} />)}
        </View>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: Spacing.lg, padding: Spacing.lg },
  input: { borderRadius: Radius.sm, borderWidth: 1, fontSize: 16, minHeight: 48, paddingHorizontal: Spacing.md },
  list: { gap: Spacing.md },
  count: { fontSize: 13, fontVariant: ["tabular-nums"] },
});
