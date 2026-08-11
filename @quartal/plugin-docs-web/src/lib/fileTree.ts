import type { SkillFileWithUrl } from "@quartal/plugin-core";

export interface TreeNode {
  name: string;
  children: Map<string, TreeNode>;
  file?: SkillFileWithUrl;
}

export function buildFileTree(files: SkillFileWithUrl[]): TreeNode {
  const root: TreeNode = { name: "", children: new Map() };
  for (const f of files) {
    const parts = f.path.split("/");
    let node = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!node.children.has(part)) {
        node.children.set(part, { name: part, children: new Map() });
      }
      const child = node.children.get(part)!;
      if (i === parts.length - 1) child.file = f;
      node = child;
    }
  }
  return root;
}

export function sortedChildren(node: TreeNode): TreeNode[] {
  return [...node.children.values()].sort((a, b) => {
    const aDir = a.children.size > 0 || !a.file;
    const bDir = b.children.size > 0 || !b.file;
    if (aDir !== bDir) return aDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}
