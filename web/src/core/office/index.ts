import { UnpasswordError, type UnlockResult, type UnlockWarning } from '../types';
import { decryptAgile } from './agile';
import { readEncryptedOoxml } from './container';
import { decryptStandard } from './standard';

export async function unlockOoxml(input: Uint8Array, password: string): Promise<UnlockResult> {
  const { encryptionInfo, encryptedPackage } = readEncryptedOoxml(input);
  if (encryptionInfo.length < 8) throw new UnpasswordError('corrupt', 'EncryptionInfo too short');
  const v = new DataView(encryptionInfo.buffer, encryptionInfo.byteOffset, encryptionInfo.byteLength);
  const major = v.getUint16(0, true);
  const minor = v.getUint16(2, true);
  const rest = encryptionInfo.subarray(8);

  let data: Uint8Array;
  const warnings: UnlockWarning[] = [];
  if (major === 4 && minor === 4) {
    const r = decryptAgile(rest, encryptedPackage, password);
    data = r.data;
    if (r.integrityOk === false) warnings.push('integrity-check-failed');
  } else if ((major === 2 || major === 3 || major === 4) && minor === 2) {
    data = decryptStandard(rest, encryptedPackage, password);
  } else {
    throw new UnpasswordError('unsupported', `unsupported Office encryption version ${major}.${minor}`);
  }

  // The plaintext of an OOXML package is a ZIP file.
  if (!(data[0] === 0x50 && data[1] === 0x4b && data[2] === 0x03 && data[3] === 0x04)) {
    throw new UnpasswordError('corrupt', 'decrypted package is not an OOXML document');
  }
  return { format: 'ooxml', mode: 'decrypted', warnings, data };
}
