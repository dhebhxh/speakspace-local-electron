import type { KnowledgeScenario } from "@/domain/knowledge/knowledge-document";

export type KnowledgeScenarioDefinition = {
  id: KnowledgeScenario;
  name: string;
  description: string;
  sections: readonly { key: string; title: string; instruction: string }[];
};

export const KNOWLEDGE_SCENARIO_DEFINITIONS: readonly KnowledgeScenarioDefinition[] = [
  {
    id: "meeting", name: "Meeting", description: "Decisions, owners, deadlines, and next steps",
    sections: [
      { key: "keyPoints", title: "Key Points", instruction: "important topics and facts discussed" },
      { key: "conclusions", title: "Conclusions", instruction: "conclusions reached" },
      { key: "decisions", title: "Decisions", instruction: "explicit decisions that were made" },
      { key: "actionItems", title: "Action Items", instruction: "actions, including owner and deadline in the same item when stated" },
      { key: "openQuestions", title: "Open Questions", instruction: "unresolved questions" },
    ],
  },
  {
    id: "lecture", name: "Lecture", description: "Concepts, explanations, examples, and review points",
    sections: [
      { key: "keyPoints", title: "Core Knowledge", instruction: "core learning points" },
      { key: "concepts", title: "Important Concepts", instruction: "concepts with a concise explanation in each item" },
      { key: "examples", title: "Examples", instruction: "important examples and what they illustrate" },
      { key: "review", title: "Review", instruction: "material worth reviewing" },
      { key: "openQuestions", title: "Questions to Explore", instruction: "topics that still need clarification" },
    ],
  },
  {
    id: "consultation", name: "Consultation", description: "Advice, decisions, follow-ups, and confirmations",
    sections: [
      { key: "issues", title: "Main Issues", instruction: "problems or concerns discussed" },
      { key: "advice", title: "Advice", instruction: "recommendations given by the professional" },
      { key: "importantInfo", title: "Important Information", instruction: "important facts, constraints, or warnings" },
      { key: "decisions", title: "Decisions", instruction: "decisions reached" },
      { key: "followUps", title: "Follow-up", instruction: "next actions, including owner and timing when stated" },
      { key: "confirmations", title: "Still to Confirm", instruction: "details that remain unconfirmed" },
    ],
  },
  {
    id: "interview", name: "Interview", description: "Perspectives, needs, pain points, and insights",
    sections: [
      { key: "perspectives", title: "Core Perspectives", instruction: "the interviewee's main viewpoints" },
      { key: "needs", title: "Needs & Pain Points", instruction: "expressed needs, frustrations, and pain points" },
      { key: "findings", title: "Findings", instruction: "valuable factual findings" },
      { key: "insights", title: "Insights", instruction: "careful insights inferred from the interview; mark inference clearly" },
      { key: "quotes", title: "Notable Quotes", instruction: "short verbatim statements worth preserving; do not invent quotes" },
      { key: "validation", title: "Questions to Validate", instruction: "questions or hypotheses to validate next" },
    ],
  },
  {
    id: "brainstorm", name: "Brainstorm", description: "Ideas, themes, opportunities, risks, and next moves",
    sections: [
      { key: "ideas", title: "Ideas", instruction: "all meaningful ideas proposed" },
      { key: "themes", title: "Themes", instruction: "groups of related ideas, with the category named" },
      { key: "opportunities", title: "Promising Directions", instruction: "directions worth developing and why" },
      { key: "risks", title: "Questions & Risks", instruction: "risks, constraints, and unanswered questions" },
      { key: "nextSteps", title: "Next Steps", instruction: "practical next actions" },
    ],
  },
  {
    id: "general", name: "General", description: "A flexible, organized knowledge note",
    sections: [
      { key: "keyPoints", title: "Key Points", instruction: "important points" },
      { key: "tasks", title: "Tasks", instruction: "tasks or next actions" },
      { key: "reminders", title: "Reminders & Dates", instruction: "reminders, dates, times, and deadlines" },
      { key: "importantInfo", title: "Worth Saving", instruction: "other information worth retaining" },
    ],
  },
];

export function getKnowledgeScenarioDefinition(scenario: KnowledgeScenario) {
  return KNOWLEDGE_SCENARIO_DEFINITIONS.find((item) => item.id === scenario)!;
}
