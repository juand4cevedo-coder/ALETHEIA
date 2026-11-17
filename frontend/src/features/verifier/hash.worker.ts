import { hashBlob } from "./hash.ts";

self.onmessage = async (event: MessageEvent<{ file: File }>) => {
  try {
    const digest = await hashBlob(event.data.file, (bytes) => {
      self.postMessage({ type: "progress", bytes });
    });
    self.postMessage({ type: "complete", digest });
  } catch {
    self.postMessage({ type: "error" });
  }
};
