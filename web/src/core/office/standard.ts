import { ecb } from '@noble/ciphers/aes.js';
import { sha1 } from '@noble/hashes/legacy.js';
import { UnpasswordError } from '../types';
import { concat, constantTimeEqual, iteratedHash, le32, packageBody } from './util';

const ALG_AES128 = 0x660e;
const ALG_AES192 = 0x660f;
const ALG_AES256 = 0x6610;
const ALG_HASH_SHA1 = 0x8004;
const FLAG_CRYPTOAPI = 0x04;
const FLAG_AES = 0x20;
const SPIN_COUNT = 50_000;

/**
 * ECMA-376 Standard Encryption (MS-OFFCRYPTO 2.3.4.5 – 2.3.4.9).
 * `data` is the EncryptionInfo stream starting after the 8-byte version/flags header.
 */
export function decryptStandard(info: Uint8Array, encryptedPackage: Uint8Array, password: string): Uint8Array {
  const v = new DataView(info.buffer, info.byteOffset, info.byteLength);
  const headerSize = v.getUint32(0, true);
  const h = 4; // EncryptionHeader starts after headerSize field
  const flags = v.getUint32(h, true);
  const algId = v.getUint32(h + 8, true);
  const algIdHash = v.getUint32(h + 12, true);
  const keyBits = v.getUint32(h + 16, true);

  if (!(flags & FLAG_CRYPTOAPI) || !(flags & FLAG_AES)) {
    throw new UnpasswordError('unsupported', 'only AES-based standard encryption is supported');
  }
  if (![ALG_AES128, ALG_AES192, ALG_AES256].includes(algId) || (algIdHash !== 0 && algIdHash !== ALG_HASH_SHA1)) {
    throw new UnpasswordError('unsupported', 'unsupported standard encryption algorithm');
  }
  if (![128, 192, 256].includes(keyBits)) throw new UnpasswordError('unsupported', 'unsupported key size');

  // EncryptionVerifier
  let o = 4 + headerSize;
  const saltSize = v.getUint32(o, true);
  o += 4;
  if (saltSize !== 16) throw new UnpasswordError('corrupt', 'unexpected salt size');
  const salt = info.slice(o, o + 16);
  o += 16;
  const encryptedVerifier = info.slice(o, o + 16);
  o += 16;
  const verifierHashSize = v.getUint32(o, true);
  o += 4;
  const encryptedVerifierHash = info.slice(o, o + 32);
  if (encryptedVerifierHash.length !== 32) throw new UnpasswordError('corrupt', 'truncated encryption verifier');

  // 2.3.4.7 key derivation
  const hn = iteratedHash(sha1, salt, password, SPIN_COUNT);
  const hfinal = sha1(concat(hn, le32(0)));
  hn.fill(0);
  const buf1 = new Uint8Array(64).fill(0x36);
  const buf2 = new Uint8Array(64).fill(0x5c);
  for (let i = 0; i < hfinal.length; i++) {
    buf1[i] ^= hfinal[i];
    buf2[i] ^= hfinal[i];
  }
  const key = concat(sha1(buf1), sha1(buf2)).slice(0, keyBits / 8);
  hfinal.fill(0);

  // 2.3.4.9 password verification
  const cipher = ecb(key, { disablePadding: true });
  const verifier = cipher.decrypt(encryptedVerifier);
  const verifierHash = cipher.decrypt(encryptedVerifierHash).slice(0, verifierHashSize);
  if (!constantTimeEqual(sha1(verifier), verifierHash)) {
    key.fill(0);
    throw new UnpasswordError('wrong-password');
  }

  const { size, body } = packageBody(encryptedPackage);
  const out = ecb(key, { disablePadding: true }).decrypt(body);
  key.fill(0);
  const result = out.slice(0, size);
  out.fill(0);
  return result;
}
