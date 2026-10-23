// A paragraph is a string; an array of strings is a bullet list.
export type Block = string | string[];
export type Section = { id: string; title: string; body: Block[] };