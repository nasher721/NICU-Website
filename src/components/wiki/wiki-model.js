export function titleWithoutPart(title = "") {
  return String(title)
    .replace(/^KEEP THIS PAGE HANDY\s*·\s*/i, "")
    .replace(/^PART \d+\s*·\s*/i, "")
    .replace(/^APPENDIX [A-Z]\s*·\s*/i, "");
}

export function buildContentsTree(sections = []) {
  const nodes = new Map(
    sections.map((section) => [section.id, { ...section, children: [] }]),
  );
  const roots = [];

  for (const section of sections) {
    const node = nodes.get(section.id);
    const parent = section.parentId ? nodes.get(section.parentId) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  return roots;
}

export function flattenContentsTree(tree = []) {
  return tree.flatMap((item) => [item, ...flattenContentsTree(item.children)]);
}

export function getAncestors(handbook, section) {
  const ancestors = [];
  let cursor = section;
  while (cursor?.parent) {
    cursor = handbook.sections.find((item) => item.slug === cursor.parent);
    if (cursor) ancestors.unshift(cursor);
  }
  return ancestors;
}

export function getArticleSections(handbook, selected) {
  if (!selected) return [];
  const start = selected.order;
  const results = [selected];
  for (let index = start + 1; index < handbook.sections.length; index += 1) {
    const candidate = handbook.sections[index];
    if (candidate.level <= selected.level) break;
    results.push(candidate);
  }
  return results;
}

export function groupContentBlocks(blocks = []) {
  const grouped = [];
  for (const block of blocks) {
    if (block.type === "list-item") {
      const previous = grouped[grouped.length - 1];
      if (previous?.type === "list") previous.items.push(block.text);
      else grouped.push({ type: "list", items: [block.text] });
    } else {
      grouped.push(block);
    }
  }
  return grouped;
}

export function formatVerificationDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) return value || "Not recorded";
  const [year, month, day] = value.split("-");
  return `${month}/${day}/${year}`;
}
