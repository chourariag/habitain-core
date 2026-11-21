/** Serializes captured report saves; a scope change waits for every pending edit. */
export function createReportAutosave(delay = 900) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: (() => Promise<unknown>) | undefined;
  let running: Promise<unknown> = Promise.resolve();
  const clear = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined; };
  const flush = (): Promise<unknown> => {
    clear();
    const save = pending;
    pending = undefined;
    if (save) running = running.catch(() => undefined).then(save);
    return running.then(async result => pending ? flush() : result);
  };
  return {
    schedule(save: () => Promise<unknown>) {
      clear(); pending = save;
      timer = setTimeout(() => { void flush().catch(() => undefined); }, delay);
    },
    flush,
    clear,
  };
}

export const reportTaskStatus = (progress: number | null) => progress === 100 ? "completed" as const : "ongoing" as const;