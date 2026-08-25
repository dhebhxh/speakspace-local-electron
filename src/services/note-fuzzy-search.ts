import { NOTE_CATEGORY_LABELS } from "@/constants/note-categories";
import type { Note } from "@/domain/note/note";
import type { NoteSearchCorpus } from "@/repositories/note-repository";

export type NoteMatchSource = "Title" | "Transcript" | "Structured Note" | "Knowledge" | "Category";

export type NoteSearchResult = {
  note: Note;
  score: number;
  source: NoteMatchSource;
  excerpt: string;
  knowledgeResultId?: string;
};

type Field = { source: NoteMatchSource; text: string; knowledgeResultId?: string };

function normalize(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

function termsFor(query: string): string[] {
  const normalized = normalize(query);
  const split = normalized.split(/\s+/).filter(Boolean);
  if (split.length > 1 || !/[\p{Script=Han}]/u.test(normalized)) return split;
  if (normalized.length <= 2) return [normalized];
  return [normalized, ...Array.from({ length: normalized.length - 1 }, (_, index) => normalized.slice(index, index + 2))];
}

function boundedEditDistance(left: string, right: string, limit: number): number | null {
  if (Math.abs(left.length - right.length) > limit) return null;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= right.length; j += 1) {
      const value = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
      current.push(value);
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > limit) return null;
    previous = current;
  }
  return previous[right.length] <= limit ? previous[right.length] : null;
}

function fuzzyContains(text: string, query: string): boolean {
  const compactText = normalize(text).replace(/\s/g, "");
  const compactQuery = normalize(query).replace(/\s/g, "");
  if (compactQuery.length < 3) return false;
  const limit = compactQuery.length <= 6 ? 1 : 2;
  for (let size = compactQuery.length - limit; size <= compactQuery.length + limit; size += 1) {
    if (size <= 0) continue;
    for (let index = 0; index + size <= compactText.length; index += 1) {
      if (boundedEditDistance(compactQuery, compactText.slice(index, index + size), limit) !== null) return true;
    }
  }
  return false;
}

function excerptFor(text: string, query: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= 180) return clean;
  const index = normalize(clean).indexOf(normalize(query));
  const start = Math.max(0, (index >= 0 ? index : 0) - 60);
  const end = Math.min(clean.length, start + 180);
  return `${start > 0 ? "…" : ""}${clean.slice(start, end)}${end < clean.length ? "…" : ""}`;
}

export function searchNoteCorpus(corpus: readonly NoteSearchCorpus[], query: string): NoteSearchResult[] {
  const phrase = normalize(query);
  if (!phrase) return [];
  const terms = termsFor(phrase);
  const results: NoteSearchResult[] = [];

  for (const entry of corpus) {
    const fields: Field[] = [
      { source: "Title", text: entry.note.getName() ?? "" },
      { source: "Transcript", text: entry.note.getTranscript() },
      { source: "Structured Note", text: entry.structuredText },
      ...entry.knowledgeResults.map((result) => ({ source: "Knowledge" as const, text: result.text, knowledgeResultId: result.id })),
      { source: "Category", text: NOTE_CATEGORY_LABELS[entry.note.getCategory()] },
    ];
    const title = normalize(fields[0].text);
    const all = normalize(fields.map((field) => field.text).join(" "));
    let score = 0;
    let best = fields[0];

    if (title.includes(phrase)) score = 500;
    else if (terms.every((term) => title.includes(term))) score = 400;
    else {
      const exactField = fields.slice(1).find((field) => normalize(field.text).includes(phrase));
      if (exactField) {
        score = 300;
        best = exactField;
      } else if (terms.every((term) => all.includes(term))) {
        score = 200;
        best = fields.find((field) => terms.some((term) => normalize(field.text).includes(term))) ?? fields[1];
      } else {
        const fuzzyField = fields.find((field) => fuzzyContains(field.text, phrase));
        if (fuzzyField) {
          score = 100;
          best = fuzzyField;
        }
      }
    }
    if (score === 0) continue;
    if (best.source === "Title" && score < 400) {
      best = fields.find((field) => normalize(field.text).includes(phrase)) ?? best;
    }
    results.push({ note: entry.note, score, source: best.source, excerpt: excerptFor(best.text, phrase), knowledgeResultId: best.knowledgeResultId });
  }

  return results.sort((left, right) =>
    right.score - left.score ||
    Number(right.note.getIsPinned()) - Number(left.note.getIsPinned()) ||
    right.note.getUpdatedAt().localeCompare(left.note.getUpdatedAt()),
  );
}
