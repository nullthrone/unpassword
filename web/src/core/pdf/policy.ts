/**
 * Decides what unpassword may do with an encrypted PDF, given which password
 * the user supplied. Pure function; see tests/pdf-policy.test.ts for the table.
 *
 * Principle: unpassword removes protection only with the password that
 * controls it. The open (user) password removes the open protection; the
 * permission restrictions the author set belong to the owner password and are
 * preserved unless that password is supplied.
 */

export interface PdfCapabilities {
  accessibility: boolean;
  extract: boolean;
  modify: boolean;
  modifyannotations: boolean;
  modifyassembly: boolean;
  modifyforms: boolean;
  modifyother: boolean;
  printhigh: boolean;
  printlow: boolean;
}

export interface PdfEncryptionInfo {
  encrypted: boolean;
  userPasswordMatched: boolean;
  ownerPasswordMatched: boolean;
  capabilities: PdfCapabilities;
}

export type PdfAction =
  | { kind: 'decrypt' }
  | { kind: 'preserve-restrictions'; capabilities: PdfCapabilities }
  | { kind: 'refuse'; reason: 'not-encrypted' | 'wrong-password' | 'owner-password-required' };

export function hasRestrictions(c: PdfCapabilities): boolean {
  return !(
    c.accessibility &&
    c.extract &&
    c.modify &&
    c.modifyannotations &&
    c.modifyassembly &&
    c.modifyforms &&
    c.modifyother &&
    c.printhigh &&
    c.printlow
  );
}

/** True if every permission denied in `original` is still denied in `result`. */
export function restrictionsPreserved(original: PdfCapabilities, result: PdfCapabilities): boolean {
  return (Object.keys(original) as (keyof PdfCapabilities)[]).every((k) => original[k] || !result[k]);
}

/**
 * @param withPassword  qpdf's view of the file opened with the supplied password
 *                      (`null` if qpdf rejected the password)
 * @param opensWithoutPassword  whether the file opens with an empty password,
 *                      i.e. it has no open protection at all
 */
export function decidePdfAction(withPassword: PdfEncryptionInfo | null, opensWithoutPassword: boolean): PdfAction {
  if (withPassword === null) return { kind: 'refuse', reason: 'wrong-password' };
  if (!withPassword.encrypted) return { kind: 'refuse', reason: 'not-encrypted' };

  if (withPassword.ownerPasswordMatched) return { kind: 'decrypt' };

  if (!withPassword.userPasswordMatched) return { kind: 'refuse', reason: 'wrong-password' };

  // Only the user password matched.
  if (opensWithoutPassword) {
    // There is no open password to remove; only restrictions are left, and
    // lifting them needs the owner password.
    return { kind: 'refuse', reason: 'owner-password-required' };
  }
  if (!hasRestrictions(withPassword.capabilities)) return { kind: 'decrypt' };
  return { kind: 'preserve-restrictions', capabilities: withPassword.capabilities };
}
