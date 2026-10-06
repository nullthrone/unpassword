import type { ErrorCode, Format, UnlockMode, UnlockWarning } from './core/types';

export interface WorkerRequest {
  id: number;
  /** A copy of the encrypted file. */
  data: ArrayBuffer;
  password: string;
}

export type WorkerResponse =
  | {
      id: number;
      ok: true;
      result: { format: Format; mode: UnlockMode; warnings: UnlockWarning[]; data: ArrayBuffer };
    }
  | {
      id: number;
      ok: false;
      error: { code: ErrorCode; message: string; retryAfterMs?: number; remainingAttempts?: number };
    };

export type UnlockOutcome = Extract<WorkerResponse, { ok: true }>['result'];
export type UnlockFailure = Extract<WorkerResponse, { ok: false }>['error'];
