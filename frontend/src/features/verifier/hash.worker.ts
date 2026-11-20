import { hashBlob } from "./hash.ts";

self.onmessage = async (event: MessageEvent<{ file: File }>) => {
  if (event.origin && event.origin !== self.location.origin) return;
  if (!(event.data?.file instanceof File)) {
    self.postMessage({ type: "error" });
    return;
  }
  try {
    const digest = await hashBlob(event.data.file, (bytes) => {
      self.postMessage({ type: "progress", bytes });
    });
    self.postMessage({ type: "complete", digest });
  } catch {
    self.postMessage({ type: "error" });
  }
};
