export const BRIEF_TEMPLATE_IDS = [
  "literature_review",
  "study_guide",
  "argument_outline",
  "research_summary",
  "meeting_brief",
  "annotated_bibliography",
] as const;
export type BriefTemplateId = (typeof BRIEF_TEMPLATE_IDS)[number];

type Template = {
  label: string;
  // fixed section titles, or null when there is one section per source
  sections: string[] | null;
  instruction: string;
};

export const BRIEF_TEMPLATES: Record<BriefTemplateId, Template> = {
  literature_review: {
    label: "Literature review",
    sections: ["Introduction", "Themes and findings", "Agreements", "Disagreements and conflicts", "Research gaps", "Conclusion"],
    instruction:
      "Write a literature review that synthesizes the sources by theme rather than listing them one by one. Say where sources agree, where they conflict, and what is still missing.",
  },
  study_guide: {
    label: "Study guide",
    sections: ["Key concepts", "Important findings", "Terms and definitions", "Questions to review"],
    instruction:
      "Write a study guide for a student. Explain concepts plainly, define technical terms the sources use, and end with review questions the sources can answer.",
  },
  argument_outline: {
    label: "Argument outline",
    sections: ["Thesis", "Supporting arguments", "Counterarguments", "Evidence gaps", "Conclusion"],
    instruction:
      "Write an argument outline: a clear thesis the evidence supports, the strongest supporting arguments, the best counterarguments, and where evidence is still missing.",
  },
  research_summary: {
    label: "Research summary",
    sections: ["Overview", "Key findings", "Limitations", "Implications"],
    instruction: "Write a concise research summary of what the sources found, how far the findings can be trusted, and what follows from them.",
  },
  meeting_brief: {
    label: "Meeting brief",
    sections: ["Purpose", "Where the evidence stands", "Decisions needed", "Open questions and next steps"],
    instruction:
      "Write a short brief for a meeting: why the group is meeting, what the evidence says so far, what must be decided, and what is still open. Keep it scannable.",
  },
  annotated_bibliography: {
    label: "Annotated bibliography",
    sections: null,
    instruction:
      "Write an annotated bibliography. For each source, in the order given, write one annotation of 3-4 sentences: what it is about, its method or approach, its main findings, and how useful it is for the research question.",
  },
};