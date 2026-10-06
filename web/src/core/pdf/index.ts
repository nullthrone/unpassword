import { UnpasswordError, type UnlockResult } from '../types';
import { decidePdfAction, restrictionsPreserved } from './policy';
import { decryptPdf, inspectEncryption, removeOpenPasswordKeepRestrictions } from './qpdf';

export async function unlockPdf(input: Uint8Array, password: string): Promise<UnlockResult> {
  const withoutPassword = await inspectEncryption(input, '');
  if (withoutPassword && !withoutPassword.encrypted) {
    throw new UnpasswordError('not-encrypted', 'this PDF is not encrypted');
  }
  const withPassword = await inspectEncryption(input, password);
  const action = decidePdfAction(withPassword, withoutPassword !== null);

  switch (action.kind) {
    case 'refuse':
      throw new UnpasswordError(action.reason);
    case 'decrypt':
      return { format: 'pdf', mode: 'decrypted', warnings: [], data: await decryptPdf(input, withPassword!.password) };
    case 'preserve-restrictions': {
      const data = await removeOpenPasswordKeepRestrictions(input, withPassword!.password, action.capabilities);
      // Verify: opens without a password and carries the same restrictions.
      const check = await inspectEncryption(data, '');
      if (
        !check?.encrypted ||
        !check.userPasswordMatched ||
        !restrictionsPreserved(action.capabilities, check.capabilities)
      ) {
        throw new UnpasswordError('corrupt', 're-encryption could not be verified');
      }
      return { format: 'pdf', mode: 'open-password-removed', warnings: [], data };
    }
  }
}
