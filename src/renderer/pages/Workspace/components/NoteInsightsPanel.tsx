/* eslint-disable no-void, no-use-before-define, react/no-array-index-key, one-var, jsx-a11y/label-has-associated-control */
import React, { useCallback, useEffect, useState } from 'react';
import { Sparkles, Copy, RefreshCw } from 'lucide-react';
import type {
  StructuredNote,
  KnowledgeScenario,
  NoteKnowledgeBundle,
} from '@shared/types/KnowledgeGenerationTypes';

const scenarios: {
  id: KnowledgeScenario;
  name: string;
  description: string;
}[] = [
  {
    id: 'meeting',
    name: 'Meeting',
    description: 'Decisions, alignment, risks, and unresolved questions',
  },
  {
    id: 'lecture',
    name: 'Lecture',
    description: 'Concepts, explanations, examples, and caveats',
  },
  {
    id: 'consultation',
    name: 'Consultation',
    description: 'Concerns, assessment, advice, options, and constraints',
  },
  {
    id: 'interview',
    name: 'Interview',
    description: 'Perspectives, needs, motivations, patterns, and quotes',
  },
  {
    id: 'brainstorm',
    name: 'Brainstorm',
    description: 'Ideas, alternatives, criteria, and promising directions',
  },
  {
    id: 'general',
    name: 'General',
    description: 'Context, details, reasoning, nuance, and open questions',
  },
];
const emptyBundle: NoteKnowledgeBundle = {
  structuredNote: null,
  scenario: null,
  structuredNoteState: { status: 'idle' },
  scenarioState: { status: 'idle' },
};
const busy = (s: string) => s === 'queued' || s === 'generating';
const escape = (s: string) =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

export default function NoteInsightsPanel({
  noteId,
  hasTranscript,
}: {
  noteId: number;
  hasTranscript: boolean;
}) {
  const [data, setData] = useState<NoteKnowledgeBundle>(emptyBundle);
  const [scenario, setScenario] = useState<KnowledgeScenario>('general');
  const [error, setError] = useState('');
  const [choosing, setChoosing] = useState(false);
  const [runningKind, setRunningKind] = useState<
    'structured-note' | 'scenario' | null
  >(null);
  const load = useCallback(async () => {
    try {
      setData(
        (await window.electron.knowledge.get(noteId)) as NoteKnowledgeBundle,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [noteId]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const listener = () => void load();
    window.addEventListener('knowledge-task-updated', listener);
    return () => window.removeEventListener('knowledge-task-updated', listener);
  }, [load]);
  useEffect(() => {
    if (
      !runningKind &&
      !busy(data.structuredNoteState.status) &&
      !busy(data.scenarioState.status)
    )
      return undefined;
    const timer = setInterval(() => void load(), 700);
    return () => clearInterval(timer);
  }, [
    data.structuredNoteState.status,
    data.scenarioState.status,
    load,
    runningKind,
  ]);
  const run = async (kind: 'structured-note' | 'scenario') => {
    setError('');
    setRunningKind(kind);
    try {
      if (kind === 'structured-note')
        await window.electron.knowledge.generateStructuredNote(noteId);
      else await window.electron.knowledge.generateScenario(noteId, scenario);
      setChoosing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      await load();
      setRunningKind(null);
    }
  };
  const copy = async () => {
    if (!data.structuredNote) return;
    const { html, text } = format(data.structuredNote);
    try {
      if (typeof ClipboardItem !== 'undefined')
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([text], { type: 'text/plain' }),
          }),
        ]);
      else await navigator.clipboard.writeText(text);
    } catch {
      await navigator.clipboard.writeText(text);
    }
  };
  let scenarioGenerateLabel = data.scenario ? 'Regenerate' : 'Generate';
  if (runningKind === 'scenario') scenarioGenerateLabel = 'Generating…';
  return (
    <section className="workspace-insights-panel">
      <div className="workspace-insights-column">
        <header>
          <h3>
            <Sparkles size={17} /> Structured Note
          </h3>
          {data.structuredNote && (
            <button
              className="ws-btn ws-btn-quiet"
              onClick={() => void copy()}
              type="button"
            >
              <Copy size={14} /> Copy Structured Note
            </button>
          )}
        </header>
        {!hasTranscript && (
          <p className="workspace-insight-error">
            A transcript is required before generation.
          </p>
        )}
        {data.structuredNoteState.status === 'failed' && (
          <p className="workspace-insight-error">
            {data.structuredNoteState.message}
          </p>
        )}
        {(runningKind === 'structured-note' ||
          busy(data.structuredNoteState.status)) && (
          <p
            aria-live="polite"
            className="workspace-generation-state"
            role="status"
          >
            <RefreshCw
              aria-hidden="true"
              className="workspace-generation-spinner"
              size={15}
            />
            {data.structuredNoteState.status === 'generating'
              ? 'Generating structured note locally…'
              : 'Waiting for local AI…'}
          </p>
        )}
        {!data.structuredNote ? (
          <button
            className="ws-btn ws-btn-primary"
            disabled={
              !hasTranscript ||
              runningKind !== null ||
              busy(data.structuredNoteState.status)
            }
            onClick={() => void run('structured-note')}
            type="button"
          >
            {runningKind === 'structured-note'
              ? 'Generating…'
              : 'Generate Structured Note'}
          </button>
        ) : (
          <>
            <StructuredNoteResult value={data.structuredNote} />
            <button
              className="ws-btn ws-btn-quiet"
              disabled={
                runningKind !== null || busy(data.structuredNoteState.status)
              }
              onClick={() => void run('structured-note')}
              type="button"
            >
              <RefreshCw
                className={
                  runningKind === 'structured-note'
                    ? 'workspace-generation-spinner'
                    : ''
                }
                size={14}
              />{' '}
              {runningKind === 'structured-note'
                ? 'Regenerating…'
                : 'Regenerate'}
            </button>
          </>
        )}
      </div>
      <div className="workspace-insights-column">
        <header>
          <h3>Scenario Knowledge</h3>
          {data.scenario && (
            <span className="workspace-scenario-badge">
              {scenarios.find((x) => x.id === data.scenario?.scenario)?.name}
            </span>
          )}
        </header>
        {data.scenarioState.status === 'failed' && (
          <p className="workspace-insight-error">
            {data.scenarioState.message}
          </p>
        )}
        {(runningKind === 'scenario' || busy(data.scenarioState.status)) && (
          <p
            aria-live="polite"
            className="workspace-generation-state"
            role="status"
          >
            <RefreshCw
              aria-hidden="true"
              className="workspace-generation-spinner"
              size={15}
            />
            {data.scenarioState.status === 'generating'
              ? 'Generating scenario knowledge locally…'
              : 'Waiting for local AI…'}
          </p>
        )}
        {choosing && (
          <div className="workspace-scenario-picker">
            {scenarios.map((s) => (
              <button
                className={scenario === s.id ? 'selected' : ''}
                key={s.id}
                onClick={() => setScenario(s.id)}
                type="button"
              >
                <strong>{s.name}</strong>
                <span>{s.description}</span>
              </button>
            ))}
            <div>
              <button
                className="ws-btn"
                disabled={runningKind !== null}
                onClick={() => setChoosing(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="ws-btn ws-btn-primary"
                disabled={
                  !hasTranscript ||
                  runningKind !== null ||
                  busy(data.scenarioState.status)
                }
                onClick={() => void run('scenario')}
                type="button"
              >
                {scenarioGenerateLabel}
              </button>
            </div>
          </div>
        )}
        {!choosing &&
          (!data.scenario ? (
            <button
              className="ws-btn ws-btn-primary"
              disabled={!hasTranscript || runningKind !== null}
              onClick={() => setChoosing(true)}
              type="button"
            >
              Generate Knowledge
            </button>
          ) : (
            <>
              <div className="workspace-scenario-result">
                {data.scenario.sections
                  .filter((s) => s.items.length)
                  .map((s) => (
                    <section key={s.key}>
                      <h4>{s.title}</h4>
                      <ul>
                        {s.items.map((x, i) => (
                          <li key={`${s.key}-${i}`}>{x}</li>
                        ))}
                      </ul>
                    </section>
                  ))}
                {data.scenario.sections.every((s) => !s.items.length) && (
                  <p className="workspace-content-empty">
                    No supported scenario-specific information was found.
                  </p>
                )}
                <small>
                  Generated locally ·{' '}
                  {new Date(data.scenario.updatedAt).toLocaleString()}
                </small>
              </div>
              <button
                className="ws-btn ws-btn-quiet"
                disabled={runningKind !== null}
                onClick={() => setChoosing(true)}
                type="button"
              >
                Generate Again
              </button>
            </>
          ))}
      </div>
      {error && (
        <p className="workspace-insight-error workspace-insight-wide">
          {error}
        </p>
      )}
    </section>
  );
}
function StructuredNoteResult({ value }: { value: StructuredNote }) {
  const reminders = value.calendarIntents.filter((x) => x.kind === 'reminder'),
    events = value.calendarIntents.filter((x) => x.kind === 'calendar');
  return (
    <div className="workspace-structured-note-result">
      <Block title="Summary">
        {value.summary || 'No supported summary found.'}
      </Block>
      <Block title="Key Points">
        <List items={value.keyPoints} />
      </Block>
      <Block title="Tasks & Action Plan">
        {value.tasks.length
          ? value.tasks.map((t) => (
              <label className="workspace-task" key={t.id}>
                <input
                  checked={t.status === 'completed'}
                  onChange={async (e) => {
                    await window.electron.knowledge.toggleTask(
                      value.noteId,
                      t.id,
                      e.target.checked,
                    );
                    window.dispatchEvent(
                      new CustomEvent('knowledge-task-updated'),
                    );
                  }}
                  type="checkbox"
                />
                <span className={t.status === 'completed' ? 'done' : ''}>
                  <strong>{t.title}</strong>
                  {t.description && <span>{t.description}</span>}
                  {t.actionItems.length > 0 && (
                    <ol>
                      {t.actionItems.map((a) => (
                        <li key={a.id}>{a.title}</li>
                      ))}
                    </ol>
                  )}
                </span>
              </label>
            ))
          : 'No explicit tasks found.'}
      </Block>
      <Block title="Reminders">
        <List items={reminders.map((x) => x.title)} />
      </Block>
      <Block title="Calendar Intents">
        <List items={events.map((x) => x.title)} />
      </Block>
      <small>
        Generated locally · {new Date(value.updatedAt).toLocaleString()}
      </small>
    </div>
  );
}
function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h4>{title}</h4>
      {children}
    </section>
  );
}
function List({ items }: { items: string[] }) {
  return items.length ? (
    <ul>
      {items.map((x, i) => (
        <li key={i}>{x}</li>
      ))}
    </ul>
  ) : (
    <>No supported items found.</>
  );
}
function format(v: StructuredNote) {
  const list = (a: string[]) => a.map((x) => `- ${x}`).join('\n');
  const text = `Structured Note\n\nSummary\n${v.summary}\n\nKey Points\n${list(v.keyPoints)}\n\nTasks & Action Plan\n${v.tasks.map((t) => `- [${t.status === 'completed' ? 'x' : ' '}] ${t.title}${t.actionItems.map((a) => `\n  - ${a.title}`).join('')}`).join('\n')}\n\nReminders\n${list(v.calendarIntents.filter((x) => x.kind === 'reminder').map((x) => x.title))}\n\nCalendar Intents\n${list(v.calendarIntents.filter((x) => x.kind === 'calendar').map((x) => x.title))}`;
  const html = `<article><h1>Structured Note</h1><h2>Summary</h2><p>${escape(v.summary)}</p><h2>Key Points</h2><ul>${v.keyPoints.map((x) => `<li>${escape(x)}</li>`).join('')}</ul><h2>Tasks &amp; Action Plan</h2><ul>${v.tasks.map((t) => `<li><strong>${escape(t.title)}</strong><ul>${t.actionItems.map((a) => `<li>${escape(a.title)}</li>`).join('')}</ul></li>`).join('')}</ul></article>`;
  return { html, text };
}
