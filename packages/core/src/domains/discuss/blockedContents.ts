import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { and, eq, inArray } from 'drizzle-orm';
import { blockedContents } from '../../db/schema';
import type { AltUUDatabase } from '../../db/types';

const CHUNK_SIZE = 500;

export function sha256Hex(value: string): string {
  return bytesToHex(sha256(utf8ToBytes(value)));
}

/**
 * Legacy `getBlockedMap`: node id to moderation reason, for the nodes of a
 * board that the community moderation list has blocked.
 */
export async function findBlockedReasons(
  db: AltUUDatabase,
  boardId: string,
  nodeIds: string[],
): Promise<Map<string, string>> {
  const reasons = new Map<string, string>();

  if (nodeIds.length === 0) {
    return reasons;
  }

  const boardHash = sha256Hex(boardId);
  const nodeByHash = new Map(nodeIds.map((id) => [sha256Hex(id), id]));
  const hashes = [...nodeByHash.keys()];

  for (let start = 0; start < hashes.length; start += CHUNK_SIZE) {
    const rows = await db
      .select({
        nodeHash: blockedContents.nodeHash,
        reason: blockedContents.reason,
      })
      .from(blockedContents)
      .where(
        and(
          eq(blockedContents.boardHash, boardHash),
          inArray(
            blockedContents.nodeHash,
            hashes.slice(start, start + CHUNK_SIZE),
          ),
        ),
      );

    for (const row of rows) {
      const nodeId = nodeByHash.get(row.nodeHash);

      if (nodeId !== undefined) {
        reasons.set(nodeId, row.reason);
      }
    }
  }

  return reasons;
}
