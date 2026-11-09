import type { BriefDraft, BriefEvidence } from "./ai.js";

// The no-AI brief: Owlet gathers the researcher's own material (highlights, notes, literature-matrix entries
// and the evidence board) into sections. Every section opens with an empty paragraph where the researcher
// writes the connecting text. Nothing here is generated, so every quote is copied exactly.

export type OutlineSource = {
  title: string;
  reference: string;
  personalNote: string; // the researcher's own note on the whole source
  highlights: { n: number; id: string; text: string; note: string }[]; // n = passage number (1000+)
  matrix: { n: number; text: string }[]; // n = passage number (2000+), text = "Column: value"
};

export type OutlineLink = {
  stance: string; // supports | challenges | background | methodology | open
  kind: "highlight" | "clip" | "note";
  note: string; // text of a note card
  source: number | null; // 0-based position in the picked sources; null for note cards
  highlightId: string | null;
};

export type OutlineOptions = {
  links: OutlineLink[]; // evidence board cards, empty when the board isn't used
  titleFrom: "title" | "reference"; // what to call a per-source section
  perSource: boolean; // force one section per source (annotated bibliography)
};

type Block = BriefDraft["sections"][number]["blocks"][number];

const STANCES: [string, string][] = [
  ["supports", "Evidence that supports your question"],
  ["challenges", "Evidence that challenges your question"],
  ["background", "Background"],
  ["methodology", "Methodology"],
  ["open", "Open questions"],
];

// the empty paragraph the researcher fills in
const writeBlock = (): Block => ({ text: "", evidence: [] });

const noteBlock = (text: string, label = "Your note"): Block => ({ text: `${label}: ${text}`, evidence: [] });

function highlightBlock(sourceIndex: number, h: OutlineSource["highlights"][number]): Block {
  const evidence: BriefEvidence = { source: sourceIndex + 1, passage: h.n, quote: h.text, verified: true };
  return { text: `“${h.text}”${h.note ? `\nYour note: ${h.note}` : ""}`, evidence: [evidence] };
}

function matrixBlock(sourceIndex: number, m: OutlineSource["matrix"][number]): Block {
  const evidence: BriefEvidence = { source: sourceIndex + 1, passage: m.n, quote: m.text.slice(0, 600), verified: true };
  return { text: m.text, evidence: [evidence] };
}

function perSourceSections(sources: OutlineSource[], titleFrom: "title" | "reference"): BriefDraft["sections"] {
  return sources.map((source, i) => {
    const blocks: Block[] = [writeBlock()];
    if (source.personalNote) blocks.push(noteBlock(source.personalNote));
    source.highlights.forEach((h) => blocks.push(highlightBlock(i, h)));
    source.matrix.forEach((m) => blocks.push(matrixBlock(i, m)));
    const title = titleFrom === "reference" ? source.reference || source.title : source.title;
    return { title: title.slice(0, 200), blocks };
  });
}

function stanceSections(sources: OutlineSource[], links: OutlineLink[]): BriefDraft["sections"] {
  const sections: BriefDraft["sections"] = [];
  for (const [stance, label] of STANCES) {
    const blocks: Block[] = [];
    for (const link of links.filter((l) => l.stance === stance)) {
      if (link.kind === "note") {
        if (link.note.trim()) blocks.push(noteBlock(link.note.trim(), "Note card"));
        continue;
      }
      if (link.source === null || !sources[link.source]) continue;
      const source = sources[link.source];
      if (link.kind === "highlight") {
        const h = source.highlights.find((x) => x.id === link.highlightId);
        if (h) blocks.push(highlightBlock(link.source, h));
      } else {
        blocks.push({ text: `Whole source: ${source.title} [${link.source + 1}]`, evidence: [] });
      }
    }
    if (blocks.length) sections.push({ title: label, blocks: [writeBlock(), ...blocks] });
  }

  // matrix entries and notes on whole sources aren't on the board, so they get a section of their own
  const extra: Block[] = [];
  sources.forEach((source, i) => {
    if (source.personalNote) extra.push(noteBlock(source.personalNote, `Your note on [${i + 1}]`));
    source.matrix.forEach((m) => extra.push(matrixBlock(i, m)));
  });
  if (extra.length) sections.push({ title: "Your notes and literature matrix", blocks: [writeBlock(), ...extra] });
  return sections;
}

export function composeBriefOutline(sources: OutlineSource[], options: OutlineOptions): BriefDraft {
  if (!options.perSource && options.links.length) {
    const grouped = stanceSections(sources, options.links);
    // when none of the board cards points at a picked source, fall back to one section per source
    if (grouped.some((s) => s.blocks.length > 1)) return { sections: grouped };
  }
  return { sections: perSourceSections(sources, options.titleFrom) };
}