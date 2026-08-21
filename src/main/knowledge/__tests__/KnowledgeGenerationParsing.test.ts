import { SCENARIOS } from '../KnowledgeScenarios';
import {
  isStructuredNoteActions,
  isStructuredNoteContent,
  parseStrictJson,
} from '../CoreOutputParser';

describe('knowledge generation strict parsing', () => {
  it('accepts exact structured note content and preserves empty arrays', () => {
    expect(
      parseStrictJson(
        '{"summary":"Supported","keyPoints":[]}',
        isStructuredNoteContent,
      ),
    ).toEqual({ summary: 'Supported', keyPoints: [] });
  });
  it('rejects prose, missing fields, and unknown fields', () => {
    expect(() =>
      parseStrictJson('Here is JSON: {}', isStructuredNoteContent),
    ).toThrow(/unreadable JSON/);
    expect(() =>
      parseStrictJson('{"summary":"x"}', isStructuredNoteContent),
    ).toThrow(/incomplete structured data/);
    expect(() =>
      parseStrictJson(
        '{"summary":"x","keyPoints":[],"tasks":[]}',
        isStructuredNoteContent,
      ),
    ).toThrow(/incomplete structured data/);
  });
  it('requires the task/action hierarchy and null time fields', () => {
    const value = {
      tasks: [
        {
          title: 'Send draft',
          description: null,
          startsAtExpression: null,
          dueAtExpression: 'tomorrow',
          actionItems: [
            {
              title: 'Attach PDF',
              description: null,
              startsAtExpression: null,
              dueAtExpression: null,
            },
          ],
        },
      ],
      unassignedActionItems: [],
      reminders: [],
      calendarIntents: [],
    };
    expect(isStructuredNoteActions(value)).toBe(true);
    expect(
      isStructuredNoteActions({
        ...value,
        tasks: [{ title: 'Send draft', actionItems: [] }],
      }),
    ).toBe(false);
  });
  it('keeps scenario section order and excludes structured note categories', () => {
    expect(SCENARIOS.meeting.sections.map((s) => s.key)).toEqual([
      'discussionTopics',
      'decisions',
      'agreements',
      'disagreements',
      'risks',
      'openQuestions',
    ]);
    const forbidden = new Set([
      'summary',
      'keyPoints',
      'tasks',
      'actionItems',
      'reminders',
      'calendarIntents',
    ]);
    expect(
      Object.values(SCENARIOS)
        .flatMap((s) => s.sections)
        .some((s) => forbidden.has(s.key)),
    ).toBe(false);
  });
});
