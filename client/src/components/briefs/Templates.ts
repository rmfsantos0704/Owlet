import type { BriefTemplateId } from "../../types";

export const BRIEF_TEMPLATES: { id: BriefTemplateId; label: string; description: string }[] = [
  { id: "literature_review", label: "Literature review", description: "Themes, agreements, conflicts, and gaps" },
  { id: "research_summary", label: "Research summary", description: "Findings, limitations, and implications" },
  { id: "argument_outline", label: "Argument outline", description: "Thesis, evidence, and counterarguments" },
  { id: "study_guide", label: "Study guide", description: "Concepts, terms, and review questions" },
  { id: "meeting_brief", label: "Meeting brief", description: "Where the evidence stands and what to decide" },
  { id: "annotated_bibliography", label: "Annotated bibliography", description: "One annotation per source" },
];

export const templateLabel = (id: string) => BRIEF_TEMPLATES.find((t) => t.id === id)?.label ?? "Brief";