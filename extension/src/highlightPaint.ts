// Runs inside the page via chrome.scripting.executeScript, so it must stay self-contained:
// no references to imports or module-level variables in here.
//
// Paints saved highlights. When saved highlights overlap (the same passage saved again, or a new
// highlight made over an old one), the one saved LATER wins for the overlapping text, so the
// newer color/selection replaces the older one on the page.
export function paintSavedHighlights(
  highlights: { text: string; color: string }[],
  palette: Record<string, string>
): string {
  const pageWindow = window as Window & {
    Highlight?: new (...ranges: Range[]) => object;
    CSS?: {
      highlights?: {
        delete(name: string): void;
        set(name: string, value: object): void;
      };
    };
  };
  const registry = pageWindow.CSS?.highlights;
  const HighlightConstructor = pageWindow.Highlight;
  if (!registry || !HighlightConstructor) return `Showing 0 of ${highlights.length} highlights`;

  const colors = Object.keys(palette);
  for (const color of colors) registry.delete(`owlet-${color}`);

  const root = document.body ?? document.documentElement;
  if (!root) return `Showing 0 of ${highlights.length} highlights`;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      return parent && !["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA"].includes(parent.tagName)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });
  const nodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) nodes.push(node as Text);

  // Match on the text with ALL whitespace removed. The saved selection came from selection.toString(), which
  // puts line breaks between paragraphs, list items and <br>s, but the page's text nodes have no space there,
  // so an exact-spacing match fails. Ignoring whitespace on both sides makes those passages match.
  const offsets: { node: Text; offset: number }[] = [];
  let text = "";
  for (const textNode of nodes) {
    for (let offset = 0; offset < textNode.length; offset += 1) {
      if (/\s/.test(textNode.data[offset])) continue;
      text += textNode.data[offset];
      offsets.push({ node: textNode, offset });
    }
  }

  // owner[i] = index of the highlight that colors character i. Highlights are applied in saved order,
  // so a later one overwrites an earlier one wherever they overlap.
  const owner: number[] = new Array(text.length).fill(-1);
  let matched = 0;
  highlights.forEach((highlight, index) => {
    const needle = highlight.text.replace(/\s+/g, "");
    if (!needle) return;
    const start = text.indexOf(needle);
    if (start < 0) return; // not on this page (changed content, an iframe, hidden text...)
    matched += 1;
    owner.fill(index, start, start + needle.length);
  });

  const rangesByColor = new Map<string, Range[]>();
  let i = 0;
  while (i < owner.length) {
    const current = owner[i];
    if (current < 0) {
      i += 1;
      continue;
    }
    let j = i;
    while (j + 1 < owner.length && owner[j + 1] === current) j += 1;
    const first = offsets[i];
    const last = offsets[j];
    if (first && last) {
      const range = document.createRange();
      range.setStart(first.node, first.offset);
      range.setEnd(last.node, last.offset + 1);
      const color = colors.includes(highlights[current].color) ? highlights[current].color : "yellow";
      const ranges = rangesByColor.get(color) ?? [];
      ranges.push(range);
      rangesByColor.set(color, ranges);
    }
    i = j + 1;
  }

  for (const [color, ranges] of rangesByColor) {
    registry.set(`owlet-${color}`, new HighlightConstructor(...ranges));
  }

  const styledColors = new Set<string>();
  for (const sheet of document.adoptedStyleSheets) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        for (const color of colors) {
          if (rule.cssText.includes(`::highlight(owlet-${color})`)) styledColors.add(color);
        }
      }
    } catch {
      continue;
    }
  }
  const missingStyles = colors.filter((color) => !styledColors.has(color));
  if (missingStyles.length) {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(
      missingStyles.map((color) => `::highlight(owlet-${color}) { background-color: ${palette[color]}; }`).join("\n")
    );
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  }

  return `Showing ${matched} of ${highlights.length} highlights`;
}