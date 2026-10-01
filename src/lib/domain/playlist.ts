import type { PlaylistEntry } from "@/lib/domain/types";

export type PlaylistFrame = {
  entry: PlaylistEntry;
  index: number;
  cycleDurationMs: number;
  elapsedInEntryMs: number;
  progress: number;
  nextChangeAt: Date;
};

export function getPlaylistFrame(
  entries: readonly PlaylistEntry[],
  playlistStartedAt: Date,
  at: Date,
): PlaylistFrame | null {
  const active = entries
    .filter((entry) => entry.enabled)
    .toSorted(
      (left, right) =>
        left.sortOrder - right.sortOrder || left.id.localeCompare(right.id),
    );
  if (active.length === 0) return null;

  const cycleDurationMs = active.reduce(
    (total, entry) => total + entry.durationSeconds * 1000,
    0,
  );
  if (!Number.isFinite(cycleDurationMs) || cycleDurationMs <= 0) {
    throw new RangeError("playlist entries must have positive durations");
  }

  const elapsedMs = Math.max(0, at.getTime() - playlistStartedAt.getTime());
  const elapsedInCycle = elapsedMs % cycleDurationMs;
  let boundary = 0;

  for (const [index, entry] of active.entries()) {
    const durationMs = entry.durationSeconds * 1000;
    const nextBoundary = boundary + durationMs;
    if (elapsedInCycle < nextBoundary) {
      const elapsedInEntryMs = elapsedInCycle - boundary;
      return {
        entry,
        index,
        cycleDurationMs,
        elapsedInEntryMs,
        progress: elapsedInEntryMs / durationMs,
        nextChangeAt: new Date(at.getTime() + nextBoundary - elapsedInCycle),
      };
    }
    boundary = nextBoundary;
  }

  return null;
}
