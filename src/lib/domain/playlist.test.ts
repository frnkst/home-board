import { describe, expect, it } from "vitest";

import { getPlaylistFrame } from "@/lib/domain/playlist";
import type { PlaylistEntry } from "@/lib/domain/types";

const entries: PlaylistEntry[] = [
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    kind: "photos",
    referenceId: null,
    durationSeconds: 20,
    sortOrder: 2,
    enabled: true,
  },
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    kind: "events",
    referenceId: null,
    durationSeconds: 10,
    sortOrder: 1,
    enabled: true,
  },
];

describe("getPlaylistFrame", () => {
  it("uses stable ordering and exact boundaries", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    expect(
      getPlaylistFrame(entries, start, new Date("2026-01-01T00:00:09Z"))
        ?.entry.kind,
    ).toBe("events");

    const frame = getPlaylistFrame(
      entries,
      start,
      new Date("2026-01-01T00:00:10Z"),
    );
    expect(frame?.entry.kind).toBe("photos");
    expect(frame?.progress).toBe(0);
    expect(frame?.nextChangeAt.toISOString()).toBe("2026-01-01T00:00:30.000Z");
  });

  it("loops deterministically and ignores disabled entries", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const frame = getPlaylistFrame(
      [...entries, { ...entries[0], id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", enabled: false }],
      start,
      new Date("2026-01-01T00:01:05Z"),
    );
    expect(frame?.entry.kind).toBe("events");
    expect(frame?.elapsedInEntryMs).toBe(5000);
    expect(frame?.cycleDurationMs).toBe(30000);
  });

  it("returns null for an empty active playlist", () => {
    expect(
      getPlaylistFrame(
        entries.map((entry) => ({ ...entry, enabled: false })),
        new Date(0),
        new Date(1000),
      ),
    ).toBeNull();
  });
});
