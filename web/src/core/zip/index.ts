import {
  ERR_INVALID_COMPRESSED_DATA,
  ERR_INVALID_CRC32,
  ERR_INVALID_PASSWORD,
  ERR_INVALID_UNCOMPRESSED_SIZE,
  ERR_UNSUPPORTED_ENCRYPTION,
  Uint8ArrayReader,
  Uint8ArrayWriter,
  ZipReader,
  ZipWriter,
  configure,
  type Entry,
} from '@zip.js/zip.js';
import { MAX_OUTPUT_BYTES, UnpasswordError, type UnlockResult } from '../types';

// unpassword already runs in a dedicated worker; zip.js must not spawn its own
// (blob) workers, which the CSP would block anyway.
configure({ useWebWorkers: false });

/** Upper bound for compressed→uncompressed expansion of a single entry. */
const MAX_RATIO = 1000;
/** Entries smaller than this are exempt from the ratio check. */
const RATIO_EXEMPT_BYTES = 1024 * 1024;

const WRONG_PASSWORD_ERRORS = new Set([
  ERR_INVALID_PASSWORD,
  // ZipCrypto verifies the password on a single byte; a wrong password that
  // passes that check shows up as one of these while reading.
  ERR_INVALID_CRC32,
  ERR_INVALID_COMPRESSED_DATA,
  ERR_INVALID_UNCOMPRESSED_SIZE,
]);

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** A sink that collects chunks and aborts once `limit` bytes are exceeded. */
function limitedSink(limit: number): { stream: WritableStream<Uint8Array>; result(): Uint8Array } {
  const chunks: Uint8Array[] = [];
  let total = 0;
  const stream = new WritableStream<Uint8Array>({
    write(chunk) {
      total += chunk.length;
      if (total > limit) throw new UnpasswordError('too-large', 'archive expands beyond the size limit');
      chunks.push(chunk);
    },
  });
  return {
    stream,
    result() {
      const out = new Uint8Array(total);
      let o = 0;
      for (const c of chunks) {
        out.set(c, o);
        o += c.length;
        c.fill(0);
      }
      return out;
    },
  };
}

/**
 * Decrypts every entry of a password-protected ZIP with the single supplied
 * password and writes an unencrypted ZIP with the same entries.
 */
export async function unlockZip(input: Uint8Array, password: string): Promise<UnlockResult> {
  const reader = new ZipReader(new Uint8ArrayReader(input));
  let entries: Entry[];
  try {
    entries = await reader.getEntries();
  } catch (cause) {
    throw new UnpasswordError('corrupt', 'not a readable ZIP archive', { cause });
  }

  if (!entries.some((e) => e.encrypted)) {
    await reader.close();
    throw new UnpasswordError('not-encrypted', 'this archive is not encrypted');
  }

  const writer = new ZipWriter(new Uint8ArrayWriter(), { level: 6 });
  let total = 0;
  let decryptedAny = false;
  try {
    for (const entry of entries) {
      const options = {
        lastModDate: entry.lastModDate,
        comment: entry.comment,
        externalFileAttributes: entry.externalFileAttributes,
        versionMadeBy: entry.versionMadeBy,
        msDosCompatible: entry.msDosCompatible,
      };
      if (entry.directory) {
        await writer.add(entry.filename, undefined, { ...options, directory: true });
        continue;
      }

      const remaining = MAX_OUTPUT_BYTES - total;
      const declaredTooBig =
        entry.uncompressedSize > remaining ||
        (entry.uncompressedSize > RATIO_EXEMPT_BYTES && entry.uncompressedSize > entry.compressedSize * MAX_RATIO);
      if (declaredTooBig) throw new UnpasswordError('too-large', `entry "${entry.filename}" is too large`);

      const sink = limitedSink(remaining);
      try {
        // Exactly one password, checked against CRC-32 / AES authentication code.
        await entry.getData(sink.stream, { password: entry.encrypted ? password : undefined, checkCrc32: true });
      } catch (e) {
        if (e instanceof UnpasswordError) throw e;
        const msg = errorMessage(e);
        if (entry.encrypted && WRONG_PASSWORD_ERRORS.has(msg)) {
          throw new UnpasswordError(decryptedAny ? 'mixed-passwords' : 'wrong-password', undefined, { cause: e });
        }
        if (msg === ERR_UNSUPPORTED_ENCRYPTION) throw new UnpasswordError('unsupported', msg, { cause: e });
        throw new UnpasswordError('corrupt', `cannot read "${entry.filename}": ${msg}`, { cause: e });
      }
      if (entry.encrypted) decryptedAny = true;

      const data = sink.result();
      total += data.length;
      await writer.add(entry.filename, new Uint8ArrayReader(data), options);
      data.fill(0);
    }
    const out = await writer.close();
    return { format: 'zip', mode: 'decrypted', warnings: [], data: out };
  } catch (e) {
    // Discard the partially written archive.
    await writer.close().catch(() => undefined);
    throw e;
  } finally {
    await reader.close();
  }
}
