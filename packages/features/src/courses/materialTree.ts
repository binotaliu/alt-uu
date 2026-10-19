/** A node as the directory consumes it (learning-time item or path node). */
export interface DirectorySourceNode {
  identifier: string;
  href: string | null;
  text: string;
  level: number;
  itemDisabled: boolean;
  duration?: string | null;
}

export interface DirectoryDisplayNode extends DirectorySourceNode {
  internalId: string;
  targetIdentifier: string;
  isDirectory: boolean;
  ancestorDirectoryIds: string[];
  parentInternalId: string | null;
}

/**
 * Flattens the material path into display rows. A node that has children is
 * a folder; any page link it carries is discarded.
 */
export function buildDirectoryNodes(
  sourceNodes: readonly DirectorySourceNode[],
): DirectoryDisplayNode[] {
  type Normalized = Omit<
    DirectoryDisplayNode,
    'ancestorDirectoryIds' | 'parentInternalId'
  >;
  const normalized: Normalized[] = [];

  sourceNodes.forEach((node, index) => {
    const nextNode = sourceNodes[index + 1];
    const hasChildren = (nextNode?.level ?? -1) > node.level;

    normalized.push({
      ...node,
      internalId: node.identifier,
      targetIdentifier: node.identifier,
      // A folder's own link is discarded: the row only expands / collapses.
      href: hasChildren ? null : node.href,
      itemDisabled: hasChildren ? true : node.itemDisabled,
      duration: hasChildren ? null : node.duration,
      isDirectory: hasChildren,
    });
  });

  const stack: DirectoryDisplayNode[] = [];

  return normalized.map((node) => {
    while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
      stack.pop();
    }

    const parent = stack[stack.length - 1] ?? null;
    const displayNode: DirectoryDisplayNode = {
      ...node,
      ancestorDirectoryIds: parent
        ? [...parent.ancestorDirectoryIds, parent.internalId]
        : [],
      parentInternalId: parent?.internalId ?? null,
    };

    if (displayNode.isDirectory) {
      stack.push(displayNode);
    }

    return displayNode;
  });
}

/** Rows that are not hidden by a collapsed ancestor. */
export function visibleDirectoryNodes(
  nodes: readonly DirectoryDisplayNode[],
  collapsed: ReadonlySet<string>,
): DirectoryDisplayNode[] {
  return nodes.filter(
    (node) =>
      !node.ancestorDirectoryIds.some((ancestor) => collapsed.has(ancestor)),
  );
}
