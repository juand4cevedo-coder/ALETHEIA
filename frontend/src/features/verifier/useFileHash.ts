import { useEffect, useRef, useState } from "react";

type WorkerMessage =
  | { type: "progress"; bytes: number }
  | { type: "complete"; digest: string }
  | { type: "error" };

export function useFileHash() {
  const workerRef = useRef<Worker | null>(null);
  const [digest, setDigest] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  function stop() {
    workerRef.current?.terminate();
    workerRef.current = null;
  }
  useEffect(() => stop, []);
  function reset() {
    stop();
    setDigest(null);
    setFailed(false);
    setProgress(null);
  }
  function start(file: File) {
    reset();
    function fail() {
      stop();
      setProgress(null);
      setFailed(true);
    }
    try {
      const worker = new Worker(new URL("./hash.worker.ts", import.meta.url), {
        type: "module",
      });
      workerRef.current = worker;
      setProgress(0);
      worker.onmessage = ({ data }: MessageEvent<WorkerMessage>) => {
        if (workerRef.current !== worker) return;
        if (data.type === "progress") {
          setProgress(
            file.size ? Math.round((data.bytes / file.size) * 100) : 0,
          );
        } else if (data.type === "complete") {
          stop();
          setProgress(null);
          setDigest(data.digest);
        } else fail();
      };
      worker.onerror = worker.onmessageerror = () => {
        if (workerRef.current === worker) fail();
      };
      worker.postMessage({ file });
    } catch {
      fail();
    }
  }
  return { digest, progress, failed, start, reset };
}
