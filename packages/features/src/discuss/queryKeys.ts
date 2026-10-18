/** Query keys of this area; the course discuss tab invalidates `all` after a read. */
export const discussQueryKeys = {
  all: ['discuss'] as const,
  boards: (boardCid: string) => ['discuss', 'boards', boardCid] as const,
  nodes: (boardCid: string, bid: string, keyword = '') =>
    ['discuss', 'nodes', boardCid, bid, keyword] as const,
  nodesOfBoard: (boardCid: string, bid: string) =>
    ['discuss', 'nodes', boardCid, bid] as const,
  posts: (boardCid: string, bid: string, nid: string) =>
    ['discuss', 'posts', boardCid, bid, nid] as const,
  blockedUsers: ['moderation', 'blocked-users'] as const,
};
