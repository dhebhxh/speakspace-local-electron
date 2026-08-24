import { Link, type Href, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Calendar, type DateData } from "react-native-calendars";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { appContainer } from "@/application";
import { AppButton } from "@/components/app-button";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { NoteCard } from "@/components/note-card";
import { HomeTaskList } from "@/components/home-task-list";
import { CategoryFilter, type CategoryFilterValue } from "@/components/category-filter";
import { Backgrounds, Colors, Radius, Shadows, Spacing } from "@/constants/theme";
import type { CoreCalendarIntent, CoreTask } from "@/domain/core-note-insight/core-note-insight";
import type { Note } from "@/domain/note/note";
import { useTheme } from "@/hooks/use-theme";

type OverviewState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; notes: Note[]; tasks: CoreTask[]; calendarIntents: CoreCalendarIntent[]; loadedAt: number };
type NoteFilter = "all" | "pinned" | "todos";

function toDateKey(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const formatNumber = (value: number) => new Intl.NumberFormat("en-GB").format(value);

export default function HomeScreen() {
  const theme = useTheme();
  const colors = Colors[theme.mode];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [overview, setOverview] = useState<OverviewState>({ status: "loading" });
  const [noteFilter, setNoteFilter] = useState<NoteFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilterValue>("all");
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date().toISOString())!);

  const loadOverview = useCallback(async () => {
    try {
      const [notes, insightItems] = await Promise.all([
        appContainer.noteService.getAllNotes(),
        appContainer.coreNoteInsightService.getDashboardItems(),
      ]);
      setOverview({ status: "success", notes, ...insightItems, loadedAt: Date.now() });
    } catch {
      setOverview({ status: "error", message: "Unable to load your overview." });
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadOverview(); }, [loadOverview]));

  useEffect(
    () => appContainer.noteService.subscribeToCategoryChanges(() => { void loadOverview(); }),
    [loadOverview],
  );

  const overviewData = useMemo(() => {
    if (overview.status !== "success") return null;
    const weekAgo = overview.loadedAt - 7 * 24 * 60 * 60 * 1000;
    const recentNotes = overview.notes.filter((note) => new Date(note.getCreatedAt()).getTime() >= weekAgo);
    const pendingNoteIds = new Set(overview.tasks.filter((task) => task.status === "pending").map((task) => task.sourceNoteId));
    const filteredNotes = overview.notes.filter((note) =>
      (noteFilter === "pinned" ? note.getIsPinned() : noteFilter === "todos" ? pendingNoteIds.has(note.getId()) : true) &&
      (categoryFilter === "all" || note.getCategory() === categoryFilter),
    );
    const calendarByDate = new Map<string, CoreCalendarIntent[]>();
    for (const intent of overview.calendarIntents) {
      const dateKey = toDateKey(intent.startsAt ?? intent.dueAt ?? intent.remindAt);
      if (dateKey) calendarByDate.set(dateKey, [...(calendarByDate.get(dateKey) ?? []), intent]);
    }
    return {
      pinnedCount: overview.notes.filter((note) => note.getIsPinned()).length,
      pendingCount: overview.tasks.filter((task) => task.status === "pending").length,
      filteredNotes,
      transcriptCount: overview.notes.reduce((sum, note) => sum + note.getTranscript().length, 0),
      recentTranscriptCount: recentNotes.reduce((sum, note) => sum + note.getTranscript().length, 0),
      recentNoteCount: recentNotes.length,
      calendarByDate,
    };
  }, [categoryFilter, noteFilter, overview]);

  const markedDates = useMemo(() => {
    if (!overviewData) return {};
    const marks: Record<string, { marked?: boolean; dotColor?: string; selected?: boolean; selectedColor?: string }> = {};
    for (const dateKey of overviewData.calendarByDate.keys()) marks[dateKey] = { marked: true, dotColor: colors.accent };
    marks[selectedDate] = { ...marks[selectedDate], selected: true, selectedColor: colors.accent };
    return marks;
  }, [colors.accent, overviewData, selectedDate]);

  const selectedEvents = overviewData?.calendarByDate.get(selectedDate) ?? [];
  const toggleNoteFilter = (next: Exclude<NoteFilter, "all">) => setNoteFilter((current) => current === next ? "all" : next);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background, experimental_backgroundImage: Backgrounds[theme.mode] }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + 76 }]}
    >
      <View style={styles.hero}>
        <View style={[styles.brandMark, { backgroundColor: colors.accent }]}><Text style={styles.brandGlyph}>|||</Text></View>
        <View style={styles.heroCopy}>
          <Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={[styles.eyebrow, { color: colors.accent }]}>SPEAKSPACE-LOCAL</Text>
        </View>
      </View>

      <View style={styles.sectionHeading}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Start a transcription</Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>Choose live recording or upload an audio file.</Text>
      </View>

      <View style={styles.transcriptionChoices}>
        <View style={[styles.transcriptionCard, styles.liveCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconTile, styles.liveIconTile, { backgroundColor: colors.accentSoft }]}><MicrophoneIcon color={colors.accent} /></View>
            <View style={styles.cardCopy}>
              <Text style={[styles.cardTitle, styles.liveTitle, { color: colors.text }]}>Live recording</Text>
              <Text style={[styles.cardBody, { color: colors.textMuted }]}>Record and transcribe as you speak.</Text>
            </View>
          </View>
          <Link href="/transcription" asChild><AppButton label="Record now" /></Link>
        </View>

      </View>

      <View style={[styles.secondaryActionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.secondaryIcon, { backgroundColor: colors.accentSoft }]}><Text style={[styles.actionIcon, { color: colors.accent }]}>↑</Text></View>
        <View style={styles.secondaryCopy}>
          <Text style={[styles.actionTitle, { color: colors.text }]}>Upload audio</Text>
          <Text style={[styles.actionBody, { color: colors.textMuted }]}>Choose a file and start transcribing.</Text>
        </View>
        <Link href={"/audio-transcription" as Href} asChild><AppButton label="Upload" variant="quiet" /></Link>
      </View>

      <View style={styles.overviewSection}>
        <View style={styles.overviewHeading}>
          <Text style={[styles.overviewTitle, { color: colors.text }]}>Overview</Text>
          <Text style={[styles.overviewSubtitle, { color: colors.textMuted }]}>Your notes and upcoming moments at a glance.</Text>
        </View>
        {overview.status === "loading" && <LoadingState />}
        {overview.status === "error" && <ErrorState message={overview.message} onRetry={() => void loadOverview()} />}
        {overview.status === "success" && overviewData && <>
          <View style={styles.statsGrid}>
            <HomeStatCard label="Total notes" value={overview.notes.length} detail={`+${overviewData.recentNoteCount} this week`} />
            <HomeStatCard label="Pinned" value={overviewData.pinnedCount} detail={noteFilter === "pinned" ? "Show all notes" : "Filter pinned notes"} active={noteFilter === "pinned"} onPress={() => toggleNoteFilter("pinned")} />
            <HomeStatCard label="Characters" value={overviewData.transcriptCount} detail={`+${formatNumber(overviewData.recentTranscriptCount)} this week`} />
            <HomeStatCard label="Open tasks" value={overviewData.pendingCount} detail={noteFilter === "todos" ? "Show all notes" : "Filter unfinished notes"} active={noteFilter === "todos"} onPress={() => toggleNoteFilter("todos")} />
          </View>
          <HomeTaskList
            tasks={overview.tasks}
            onOpenNote={(noteId) => router.push({ pathname: "/notes/[noteId]", params: { noteId } })}
            onTaskCompletedChange={async (task, completed) => {
              await appContainer.coreNoteInsightService.setTaskCompleted(task.sourceNoteId, task.id, completed);
              await loadOverview();
            }}
            onTaskPinnedChange={async (task, pinned) => {
              await appContainer.coreNoteInsightService.setTaskPinned(task.sourceNoteId, task.id, pinned);
              await loadOverview();
            }}
          />
          <View style={styles.notesSection}>
            <View style={styles.notesHeading}>
              <Text style={[styles.calendarTitle, { color: colors.text }]}>Notes</Text>
              <Text style={[styles.notesCount, { color: colors.textMuted }]}>{overviewData.filteredNotes.length} shown</Text>
            </View>
            <CategoryFilter value={categoryFilter} onChange={setCategoryFilter} />
            {overviewData.filteredNotes.length === 0
              ? <EmptyState title={noteFilter === "all" ? "No notes yet" : "No matching notes"} description={noteFilter === "todos" ? "Notes with unfinished Core Note tasks appear here." : undefined} />
              : <View style={styles.noteList}>{overviewData.filteredNotes.map((note) => <NoteCard key={note.getId()} note={note} onPress={() => router.push({ pathname: "/notes/[noteId]", params: { noteId: note.getId() } })} />)}</View>}
          </View>
          <View style={styles.calendarSection}>
            <Text style={[styles.calendarTitle, { color: colors.text }]}>Calendar</Text>
            <View style={[styles.calendarCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Calendar markedDates={markedDates} onDayPress={(day: DateData) => setSelectedDate(day.dateString)} theme={{ calendarBackground: colors.surface, dayTextColor: colors.text, monthTextColor: colors.text, textDisabledColor: colors.border, todayTextColor: colors.accent, arrowColor: colors.accent, selectedDayBackgroundColor: colors.accent, selectedDayTextColor: colors.surface }} />
              <View style={[styles.agenda, { borderTopColor: colors.border }]}>
                <Text style={[styles.agendaDate, { color: colors.text }]}>{selectedDate}</Text>
                {selectedEvents.length === 0
                  ? <Text style={[styles.agendaEmpty, { color: colors.textMuted }]}>No calendar items for this date.</Text>
                  : selectedEvents.map((event) => <Link key={event.id} href={{ pathname: "/notes/[noteId]", params: { noteId: event.sourceNoteId } }} asChild><Pressable accessibilityRole="button" style={({ pressed }) => [styles.eventRow, { backgroundColor: colors.surfaceMuted }, pressed && styles.pressed]}><View style={[styles.eventDot, { backgroundColor: colors.accent }]} /><View style={styles.eventCopy}><Text style={[styles.eventTitle, { color: colors.text }]}>{event.title}</Text><Text style={[styles.eventKind, { color: colors.textMuted }]}>{event.kind === "reminder" ? "Reminder" : "Calendar event"}</Text></View></Pressable></Link>)}
              </View>
            </View>
          </View>
        </>}
      </View>

      <View style={[styles.localBadge, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
        <View style={[styles.statusDot, { backgroundColor: colors.accent }]} />
        <Text style={[styles.localText, { color: colors.textMuted }]}>Local-first · Your data stays on this device</Text>
      </View>
    </ScrollView>
  );
}

function MicrophoneIcon({ color }: { color: string }) {
  return (
    <View style={styles.microphone}>
      <View style={[styles.microphoneCapsule, { borderColor: color }]} />
      <View style={[styles.microphoneCradle, { borderBottomColor: color, borderLeftColor: color, borderRightColor: color }]} />
      <View style={[styles.microphoneStem, { backgroundColor: color }]} />
      <View style={[styles.microphoneBase, { backgroundColor: color }]} />
    </View>
  );
}

function HomeStatCard({ label, value, detail, active = false, onPress }: { label: string; value: number; detail: string; active?: boolean; onPress?: () => void }) {
  const colors = Colors[useTheme().mode];
  const content = <>
    <Text style={[styles.statLabel, { color: active ? colors.accent : colors.textMuted }]}>{label}</Text>
    <Text selectable style={[styles.statValue, { color: colors.text }]}>{formatNumber(value)}</Text>
    <Text style={[styles.statDetail, { color: onPress ? colors.accent : colors.textMuted }]} numberOfLines={2}>{detail}{onPress ? "  →" : ""}</Text>
  </>;
  const cardStyle = [styles.statCard, { backgroundColor: active ? colors.accentSoft : colors.surface, borderColor: active ? colors.accent : colors.border }];
  return onPress
    ? <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => [cardStyle, pressed && styles.pressed]}>{content}</Pressable>
    : <View style={cardStyle}>{content}</View>;
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, gap: Spacing.md, paddingHorizontal: Spacing.lg },
  hero: { alignItems: "center", flexDirection: "row", gap: Spacing.sm },
  brandMark: { alignItems: "center", borderCurve: "continuous", borderRadius: Radius.sm, height: 40, justifyContent: "center", width: 40 },
  brandGlyph: { color: "#FFFFFF", fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  heroCopy: { flex: 1, gap: Spacing.xs },
  eyebrow: { fontSize: 20, fontWeight: "800", letterSpacing: 0.6 },
  sectionHeading: { gap: Spacing.xs },
  sectionTitle: { fontSize: 20, fontWeight: "800" },
  sectionSubtitle: { fontSize: 14, lineHeight: 20 },
  transcriptionChoices: { gap: Spacing.sm },
  transcriptionCard: { borderCurve: "continuous", borderRadius: Radius.lg, borderWidth: 1, boxShadow: Shadows.card, gap: Spacing.md },
  liveCard: { boxShadow: Shadows.raised, padding: Spacing.lg },
  cardHeader: { alignItems: "center", flexDirection: "row", gap: Spacing.md },
  iconTile: { alignItems: "center", borderCurve: "continuous", borderRadius: Radius.sm, height: 44, justifyContent: "center", width: 44 },
  liveIconTile: { height: 52, width: 52 },
  cardCopy: { gap: Spacing.xs },
  cardTitle: { fontSize: 18, fontWeight: "800" },
  liveTitle: { fontSize: 21 },
  cardBody: { fontSize: 14, lineHeight: 19 },
  secondaryActionCard: { alignItems: "center", borderCurve: "continuous", borderRadius: Radius.md, borderWidth: 1, boxShadow: Shadows.card, flexDirection: "row", gap: Spacing.md, minHeight: 88, padding: Spacing.md },
  secondaryIcon: { alignItems: "center", borderCurve: "continuous", borderRadius: Radius.sm, height: 44, justifyContent: "center", width: 44 },
  secondaryCopy: { flex: 1, gap: 2, minWidth: 0 },
  microphone: { alignItems: "center", height: 30, justifyContent: "flex-start", position: "relative", width: 24 },
  microphoneCapsule: { borderRadius: 7, borderWidth: 2.2, height: 17, width: 11 },
  microphoneCradle: { borderBottomLeftRadius: 9, borderBottomRightRadius: 9, borderBottomWidth: 2.2, borderLeftWidth: 2.2, borderRightWidth: 2.2, height: 12, position: "absolute", top: 7, width: 19 },
  microphoneStem: { borderRadius: 1, height: 6, position: "absolute", top: 18, width: 2.2 },
  microphoneBase: { borderRadius: 2, height: 2.2, position: "absolute", top: 24, width: 12 },
  actionIcon: { fontSize: 26, fontWeight: "700" },
  actionTitle: { fontSize: 17, fontWeight: "800" },
  actionBody: { fontSize: 13, lineHeight: 18 },
  localBadge: { alignItems: "center", borderCurve: "continuous", borderRadius: Radius.md, borderWidth: 1, flexDirection: "row", gap: Spacing.sm, padding: Spacing.md },
  statusDot: { borderRadius: 5, height: 10, width: 10 },
  localText: { flex: 1, fontSize: 13, fontWeight: "600" },
  overviewSection: { gap: Spacing.md, paddingTop: Spacing.sm },
  overviewHeading: { gap: Spacing.xs },
  overviewTitle: { fontSize: 22, fontWeight: "800" },
  overviewSubtitle: { fontSize: 14, lineHeight: 20 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  statCard: { borderCurve: "continuous", borderRadius: Radius.md, borderWidth: 1, boxShadow: Shadows.card, flexBasis: "46%", flexGrow: 1, gap: 2, minHeight: 104, padding: Spacing.md },
  statLabel: { fontSize: 12, fontWeight: "700" },
  statValue: { fontSize: 25, fontVariant: ["tabular-nums"], fontWeight: "800" },
  statDetail: { fontSize: 11, lineHeight: 15 },
  notesSection: { gap: Spacing.sm },
  notesHeading: { alignItems: "baseline", flexDirection: "row", justifyContent: "space-between" },
  notesCount: { fontSize: 12, fontWeight: "700" },
  noteList: { gap: Spacing.sm },
  calendarSection: { gap: Spacing.sm },
  calendarTitle: { fontSize: 19, fontWeight: "800" },
  calendarCard: { borderCurve: "continuous", borderRadius: Radius.lg, borderWidth: 1, boxShadow: Shadows.card, overflow: "hidden" },
  agenda: { borderTopWidth: 1, gap: Spacing.sm, padding: Spacing.md },
  agendaDate: { fontSize: 14, fontVariant: ["tabular-nums"], fontWeight: "800" },
  agendaEmpty: { fontSize: 13, lineHeight: 18 },
  eventRow: { alignItems: "center", borderCurve: "continuous", borderRadius: Radius.sm, flexDirection: "row", gap: Spacing.sm, padding: Spacing.sm },
  eventDot: { borderRadius: 4, height: 8, width: 8 },
  eventCopy: { flex: 1, gap: 2 },
  eventTitle: { fontSize: 14, fontWeight: "700" },
  eventKind: { fontSize: 11 },
  pressed: { opacity: 0.72 },
});
