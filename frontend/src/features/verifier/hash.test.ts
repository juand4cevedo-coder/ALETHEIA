import { Blob as NodeBlob } from "node:buffer";
import { createHash } from "node:crypto";

import { expect, it } from "vitest";

import { hashBlob } from "./hash.ts";

it("calcula SHA-256 por fragmentos, incluso al cambiar un byte del último fragmento", async () => {
  const bytes = new Uint8Array(1024 * 1024 + 7);
  bytes.fill(42);
  const progress: number[] = [];
  const actual = await hashBlob(new NodeBlob([bytes]) as Blob, (count) =>
    progress.push(count),
  );
  expect(actual).toBe(createHash("sha256").update(bytes).digest("hex"));
  expect(progress).toEqual([1024 * 1024, bytes.length]);

  bytes[bytes.length - 1] ^= 1;
  const changed = await hashBlob(new NodeBlob([bytes]) as Blob, () => {});
  expect(changed).not.toBe(actual);
  expect(changed).toBe(createHash("sha256").update(bytes).digest("hex"));
});
