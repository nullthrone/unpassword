import * as CFB from 'cfb';
import { UnpasswordError } from '../types';

export interface EncryptedOoxml {
  encryptionInfo: Uint8Array;
  encryptedPackage: Uint8Array;
}

function toBytes(blob: number[] | Uint8Array): Uint8Array {
  return blob instanceof Uint8Array ? blob : Uint8Array.from(blob);
}

/**
 * Reads the two streams of an encrypted OOXML file (MS-OFFCRYPTO 2.3.4.4).
 * CFB containers without them (legacy .doc/.xls/.ppt) are not supported.
 */
export function readEncryptedOoxml(data: Uint8Array): EncryptedOoxml {
  let container: CFB.CFB$Container;
  try {
    container = CFB.parse(data, { type: 'array' } as CFB.CFB$ParsingOptions);
  } catch (cause) {
    throw new UnpasswordError('corrupt', 'not a valid compound file', { cause });
  }
  const info = CFB.find(container, 'EncryptionInfo');
  const pkg = CFB.find(container, 'EncryptedPackage');
  if (!info?.content || !pkg?.content) {
    throw new UnpasswordError(
      'unsupported',
      'legacy binary Office files (.doc/.xls/.ppt) are not supported; only encrypted .docx/.xlsx/.pptx',
    );
  }
  return { encryptionInfo: toBytes(info.content), encryptedPackage: toBytes(pkg.content) };
}
