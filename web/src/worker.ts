/// <reference lib="webworker" />
/**
 * The only place where passwords and decrypted content are processed. The
 * worker makes no network requests beyond loading its own WASM asset.
 */
import wasmUrl from '@neslinesli93/qpdf-wasm/dist/qpdf.wasm?url';
import { setQpdfWasmLocation } from './core/pdf/qpdf';
import { UnlockSession } from './core/session';
import { UnpasswordError } from './core/types';
import type { WorkerRequest, WorkerResponse } from './protocol';

// Resolve against the worker's own URL; Emscripten fetches it from this origin.
setQpdfWasmLocation(new URL(wasmUrl, self.location.href).href);

const session = new UnlockSession();
const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.onmessage = async (ev: MessageEvent<WorkerRequest>) => {
  const { id, data, password } = ev.data;
  const input = new Uint8Array(data);
  try {
    const result = await session.attempt(input, password);
    // Transfer a buffer that holds exactly the result, never a larger backing store.
    const exact =
      result.data.byteOffset === 0 && result.data.byteLength === result.data.buffer.byteLength
        ? result.data
        : result.data.slice();
    const buffer = exact.buffer as ArrayBuffer;
    const msg: WorkerResponse = {
      id,
      ok: true,
      result: { format: result.format, mode: result.mode, warnings: result.warnings, data: buffer },
    };
    scope.postMessage(msg, [buffer]);
  } catch (e) {
    const err =
      e instanceof UnpasswordError
        ? { code: e.code, message: e.message, retryAfterMs: e.retryAfterMs, remainingAttempts: e.remainingAttempts }
        : { code: 'corrupt' as const, message: e instanceof Error ? e.message : String(e) };
    scope.postMessage({ id, ok: false, error: err } satisfies WorkerResponse);
  } finally {
    input.fill(0);
  }
};
