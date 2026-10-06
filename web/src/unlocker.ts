import type { UnlockFailure, UnlockOutcome, WorkerRequest, WorkerResponse } from './protocol';

export class UnlockFailed extends Error {
  constructor(readonly failure: UnlockFailure) {
    super(failure.message);
  }
}

/** Main-thread handle to the decryption worker. */
export class Unlocker {
  private readonly worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  private nextId = 1;
  private readonly pending = new Map<number, { resolve: (r: UnlockOutcome) => void; reject: (e: Error) => void }>();

  constructor() {
    this.worker.onmessage = (ev: MessageEvent<WorkerResponse>) => {
      const p = this.pending.get(ev.data.id);
      if (!p) return;
      this.pending.delete(ev.data.id);
      if (ev.data.ok) p.resolve(ev.data.result);
      else p.reject(new UnlockFailed(ev.data.error));
    };
    this.worker.onerror = (ev) => {
      for (const p of this.pending.values()) p.reject(new Error(ev.message || 'worker error'));
      this.pending.clear();
    };
  }

  unlock(encrypted: Uint8Array, password: string): Promise<UnlockOutcome> {
    const id = this.nextId++;
    const copy = encrypted.slice().buffer as ArrayBuffer;
    const req: WorkerRequest = { id, data: copy, password };
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage(req, [copy]);
    });
  }
}
