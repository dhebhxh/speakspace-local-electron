import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Calendar, type DateData } from "react-native-calendars";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { appContainer } from "@/application";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { NoteCard } from "@/components/note-card";
import { Colors, Radius, Spacing } from "@/constants/theme";
import type { CoreCalendarIntent, CoreInsightStatus } from "@/domain/core-note-insight/core-note-insight";
import type { Note } from "@/domain/note/note";
import { useTheme } from "@/hooks/use-theme";

type NoteFilter = "all" | "pinned" | "todos";
type DashboardState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; notes: Note[]; tasks: { id: string; noteId: string; status: CoreInsightStatus }[]; calendarIntents: CoreCalendarIntent[]; loadedAt: number };

function toDateKey(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const formatNumber = (value: number) => new Intl.NumberFormat().format(value);

export default function DashboardScreen() {
  const router = useRouter();
  const theme = useTheme();
  const colors = Colors[theme.mode];
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [state, setState] = useState<DashboardState>({ status: "loading" });
  const [filter, setFilter] = useState<NoteFilter>("all");
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date().toISOString())!);

  const loadDashboard = useCallback(async () => {
    try {
      const [notes, insightItems] = await Promise.all([
        appContainer.noteService.getAllNotes(),
        appContainer.coreNoteInsightService.getDashboardItems(),
      ]);
      setState({ status: "success", notes, ...insightItems, loadedAt: Date.now() });
    } catch {
      setState({ status: "error", message: "Unable to load your dashboard." });
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadDashboard(); }, [loadDashboard]));

  const data = useMemo(() => {
    if (state.status !== "success") return null;
    const weekAgo = state.loadedAt - 7 * 24 * 60 * 60 * 1000;
    const pendingNoteIds = new Set(state.tasks.filter((task) => task.status === "pending").map((task) => task.noteId));
    const filteredNotes = state.notes.filter((note) => filter === "pinned" ? note.getIsPinned() : filter === "todos" ? pendingNoteIds.has(note.getId()) : true);
    const recentNotes = state.notes.filter((note) => new Date(note.getCreatedAt()).getTime() >= weekAgo);
    const calendarByDate = new Map<string, CoreCalendarIntent[]>();
    for (const intent of state.calendarIntents) {
      const dateKey = toDateKey(intent.startsAt ?? intent.dueAt ?? intent.remindAt);
      if (dateKey) calendarByDate.set(dateKey, [...(calendarByDate.get(dateKey) ?? []), intent]);
    }
    return {
      filteredNotes,
      pinnedCount: state.notes.filter((note) => note.getIsPinned()).length,
      todoCount: state.tasks.length,
      pendingCount: state.tasks.filter((task) => task.status === "pending").length,
      transcriptCount: state.notes.reduce((sum, note) => sum + note.getTranscript().length, 0),
      recentTranscriptCount: recentNotes.reduce((sum, note) => sum + note.getTranscript().length, 0),
      recentNoteCount: recentNotes.length,
      calendarByDate,
    };
  }, [filter, state]);

  const markedDates = useMemo(() => {
    if (!data) return {};
    const marks: Record<string, { marked?: boolean; dotColor?: string; selected?: boolean; selectedColor?: string }> = {};
    for (const dateKey of data.calendarByDate.keys()) marks[dateKey] = { marked: true, dotColor: colors.accent };
    marks[selectedDate] = { ...marks[selectedDate], selected: true, selectedColor: colors.accent };
    return marks;
  }, [colors.accent, data, selectedDate]);

  const selectedEvents = data?.calendarByDate.get(selectedDate) ?? [];
  const toggleFilter = (next: Exclude<NoteFilter, "all">) => setFilter((current) => current === next ? "all" : next);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + 96 }]}>
      <View style={styles.heading}>
        <Text style={[styles.kicker, { color: colors.accent }]}>SPEAKSPACE</Text>
        <Text style={[styles.title, { color: colors.text }]}>Dashboard</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>Your notes, tasks, and upcoming moments at a glance.</Text>
      </View>

      {state.status === "loading" && <LoadingState />}
      {state.status === "error" && <ErrorState message={state.message} onRetry={() => void loadDashboard()} />}
      {state.status === "success" && data && <>
        <View style={[styles.statsGrid, width < 390 && styles.statsGridSingle]}>
          <StatCard label="Total notes" value={state.notes.length} detail={`+${data.recentNoteCount} in the last 7 days`} />
          <StatCard label="Pinned notes" value={data.pinnedCount} detail={filter === "pinned" ? "Show all notes" : "Quick filter"} active={filter === "pinned"} onPress={() => toggleFilter("pinned")} />
          <StatCard label="Transcript characters" value={data.transcriptCount} detail={`+${formatNumber(data.recentTranscriptCount)} in the last 7 days`} />
          <StatCard label="To-dos" value={data.todoCount} detail={filter === "todos" ? "Show all notes" : `${data.pendingCount} unfinished · Filter`} active={filter === "todos"} onPress={() => toggleFilter("todos")} />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: colors.text }]}>Notes</Text><Text style={[styles.sectionMeta, { color: colors.textMuted }]}>{data.filteredNotes.length} shown</Text></View>
          {data.filteredNotes.length === 0
            ? <EmptyState title={filter === "all" ? "No notes yet" : "No matching notes"} description={filter === "todos" ? "Notes with unfinished CoreNote tasks appear here." : undefined} />
            : <View style={styles.noteList}>{data.filteredNotes.map((note) => <NoteCard key={note.getId()} note={note} onPress={() => router.push({ pathname: "/notes/[noteId]", params: { noteId: note.getId() } })} />)}</View>}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: colors.text }]}>Calendar</Text><Text style={[styles.sectionMeta, { color: colors.textMuted }]}>CoreNote Insights</Text></View>
          <View style={[styles.calendarCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Calendar markedDates={markedDates} onDayPress={(day: DateData) => setSelectedDate(day.dateString)} theme={{ calendarBackground: colors.surface, dayTextColor: colors.text, monthTextColor: colors.text, textDisabledColor: colors.border, todayTextColor: colors.accent, arrowColor: colors.accent, selectedDayBackgroundColor: colors.accent, selectedDayTextColor: colors.surface }} />
            <View style={[styles.agenda, { borderTopColor: colors.border }]}>
              <Text style={[styles.agendaDate, { color: colors.text }]}>{selectedDate}</Text>
              {selectedEvents.length === 0
                ? <Text style={[styles.agendaEmpty, { color: colors.textMuted }]}>No CoreNote calendar items for this date.</Text>
                : selectedEvents.map((event) => <Pressable key={event.id} accessibilityRole="button" onPress={() => router.push({ pathname: "/notes/[noteId]", params: { noteId: event.sourceNoteId } })} style={({ pressed }) => [styles.eventRow, { backgroundColor: colors.surfaceMuted }, pressed && styles.pressed]}><View style={[styles.eventDot, { backgroundColor: colors.accent }]} /><View style={styles.eventCopy}><Text style={[styles.eventTitle, { color: colors.text }]}>{event.title}</Text><Text style={[styles.eventKind, { color: colors.textMuted }]}>{event.kind === "reminder" ? "Reminder" : "Calendar event"}</Text></View></Pressable>)}
            </View>
          </View>
        </View>
      </>}
    </ScrollView>
  );
}

function StatCard({ label, value, detail, active = false, onPress }: { label: string; value: number; detail: string; active?: boolean; onPress?: () => void }) {
  const theme = useTheme();
  const colors = Colors[theme.mode];
  const content = <><Text style={[styles.statLabel, { color: active ? colors.accent : colors.textMuted }]}>{label}</Text><Text selectable style={[styles.statValue, { color: colors.text }]}>{formatNumber(value)}</Text><Text style={[styles.statDetail, { color: onPress ? colors.accent : colors.textMuted }]}>{detail}{onPress ? "  →" : ""}</Text></>;
  const cardStyle = [styles.statCard, { backgroundColor: active ? colors.accentSoft : colors.surface, borderColor: active ? colors.accent : colors.border }];
  return onPress ? <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => [cardStyle, pressed && styles.pressed]}>{content}</Pressable> : <View style={cardStyle}>{content}</View>;
}

const styles = StyleSheet.create({
  content: { gap: Spacing.xl, paddingHorizontal: Spacing.lg },
  heading: { gap: Spacing.xs },
  kicker: { fontSize: 12, fontWeight: "800", letterSpacing: 1.4 },
  title: { fontSize: 34, fontWeight: "800" },
  subtitle: { fontSize: 16, lineHeight: 23, maxWidth: 520 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.md },
  statsGridSingle: { flexDirection: "column" },
  statCard: { borderCurve: "continuous", borderRadius: Radius.md, borderWidth: 1, flexBasis: "46%", flexGrow: 1, gap: Spacing.xs, minHeight: 142, padding: Spacing.md },
  statLabel: { fontSize: 13, fontWeight: "700" },
  statValue: { fontSize: 30, fontVariant: ["tabular-nums"], fontWeight: "800" },
  statDetail: { fontSize: 13, lineHeight: 18 },
  section: { gap: Spacing.md },
  sectionHeader: { alignItems: "baseline", flexDirection: "row", justifyContent: "space-between" },
  sectionTitle: { fontSize: 24, fontWeight: "800" },
  sectionMeta: { fontSize: 13, fontWeight: "600" },
  noteList: { gap: Spacing.md },
  calendarCard: { borderCurve: "continuous", borderRadius: Radius.lg, borderWidth: 1, overflow: "hidden" },
  agenda: { borderTopWidth: 1, gap: Spacing.sm, padding: Spacing.md },
  agendaDate: { fontSize: 15, fontVariant: ["tabular-nums"], fontWeight: "800" },
  agendaEmpty: { fontSize: 14, lineHeight: 20 },
  eventRow: { alignItems: "center", borderCurve: "continuous", borderRadius: Radius.sm, flexDirection: "row", gap: Spacing.sm, padding: Spacing.sm },
  eventDot: { borderRadius: 4, height: 8, width: 8 },
  eventCopy: { flex: 1, gap: 2 },
  eventTitle: { fontSize: 15, fontWeight: "700" },
  eventKind: { fontSize: 12 },
  pressed: { opacity: 0.72 },
});
