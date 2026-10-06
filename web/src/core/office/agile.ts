import { cbc } from '@noble/ciphers/aes.js';
import { hmac } from '@noble/hashes/hmac.js';
import { UnpasswordError } from '../types';
import {
  HASHES,
  base64ToBytes,
  concat,
  constantTimeEqual,
  fit,
  iteratedHash,
  le32,
  packageBody,
  type HashFn,
} from './util';

// MS-OFFCRYPTO 2.3.4.13 / 2.3.4.14 block keys
const BLOCK_VERIFIER_INPUT = Uint8Array.of(0xfe, 0xa7, 0xd2, 0x76, 0x3b, 0x4b, 0x9e, 0x79);
const BLOCK_VERIFIER_VALUE = Uint8Array.of(0xd7, 0xaa, 0x0f, 0x6d, 0x30, 0x61, 0x34, 0x4e);
const BLOCK_KEY_VALUE = Uint8Array.of(0x14, 0x6e, 0x0b, 0xe7, 0xab, 0xac, 0xd0, 0xd6);
const BLOCK_HMAC_KEY = Uint8Array.of(0x5f, 0xb2, 0xad, 0x01, 0x0c, 0xb9, 0xe1, 0xf6);
const BLOCK_HMAC_VALUE = Uint8Array.of(0xa0, 0x67, 0x7f, 0x02, 0xb2, 0x2c, 0x84, 0x33);

const PASSWORD_KEY_ENCRYPTOR = 'http://schemas.microsoft.com/office/2006/keyEncryptor/password';
const SEGMENT = 4096;
const MAX_SPIN_COUNT = 10_000_000;

type Attrs = Record<string, string>;

/** Attributes of the first element with the given local name (namespace prefix ignored). */
function element(xml: string, localName: string, from = 0): { attrs: Attrs; index: number } | null {
  const re = new RegExp(`<(?:[A-Za-z_][\\w.-]*:)?${localName}\\b([^>]*)>`, 'g');
  re.lastIndex = from;
  const m = re.exec(xml);
  if (!m) return null;
  const attrs: Attrs = {};
  for (const a of m[1].matchAll(/([\w:.-]+)\s*=\s*"([^"]*)"/g)) attrs[a[1]] = a[2];
  return { attrs, index: m.index };
}

interface CipherParams {
  salt: Uint8Array;
  blockSize: number;
  keyBits: number;
  hashSize: number;
  hash: HashFn;
}

function cipherParams(a: Attrs, what: string): CipherParams {
  if (a.cipherAlgorithm !== 'AES' || a.cipherChaining !== 'ChainingModeCBC') {
    throw new UnpasswordError('unsupported', `unsupported ${what} cipher ${a.cipherAlgorithm}/${a.cipherChaining}`);
  }
  const hash = HASHES[a.hashAlgorithm];
  if (!hash) throw new UnpasswordError('unsupported', `unsupported hash ${a.hashAlgorithm}`);
  const keyBits = Number(a.keyBits);
  const blockSize = Number(a.blockSize);
  const hashSize = Number(a.hashSize);
  if (![128, 192, 256].includes(keyBits) || blockSize !== 16 || !(hashSize > 0 && hashSize <= 64)) {
    throw new UnpasswordError('unsupported', `unsupported ${what} parameters`);
  }
  return { salt: base64ToBytes(a.saltValue), blockSize, keyBits, hashSize, hash };
}

function aesCbcDecrypt(key: Uint8Array, iv: Uint8Array, data: Uint8Array): Uint8Array {
  if (data.length % 16 !== 0) throw new UnpasswordError('corrupt', 'ciphertext is not block aligned');
  return cbc(key, iv, { disablePadding: true }).decrypt(data);
}

export interface AgileResult {
  data: Uint8Array;
  integrityOk: boolean | null;
}

export function decryptAgile(xmlBytes: Uint8Array, encryptedPackage: Uint8Array, password: string): AgileResult {
  const xml = new TextDecoder('utf-8').decode(xmlBytes);

  const keyData = element(xml, 'keyData');
  const integrity = element(xml, 'dataIntegrity');
  const encryptor = element(xml, 'keyEncryptor');
  if (!keyData || !encryptor) throw new UnpasswordError('corrupt', 'incomplete encryption descriptor');
  if (encryptor.attrs.uri !== PASSWORD_KEY_ENCRYPTOR) {
    // certificate-based key encryptors are not password protection
    throw new UnpasswordError('unsupported', 'document is not password-encrypted');
  }
  const encKey = element(xml, 'encryptedKey', encryptor.index);
  if (!encKey) throw new UnpasswordError('corrupt', 'missing password key encryptor');

  const kd = cipherParams(keyData.attrs, 'data');
  const pk = cipherParams(encKey.attrs, 'key');
  const spinCount = Number(encKey.attrs.spinCount);
  if (!Number.isInteger(spinCount) || spinCount < 0 || spinCount > MAX_SPIN_COUNT) {
    throw new UnpasswordError('unsupported', 'unsupported spin count');
  }

  // 2.3.4.11 password key derivation
  const h = iteratedHash(pk.hash, pk.salt, password, spinCount);
  const keyLen = pk.keyBits / 8;
  const derive = (block: Uint8Array) => fit(pk.hash(concat(h, block)), keyLen);

  // 2.3.4.13 password verification
  const verifierInput = fit(
    aesCbcDecrypt(derive(BLOCK_VERIFIER_INPUT), pk.salt, base64ToBytes(encKey.attrs.encryptedVerifierHashInput)),
    pk.salt.length,
  );
  const verifierHash = aesCbcDecrypt(
    derive(BLOCK_VERIFIER_VALUE),
    pk.salt,
    base64ToBytes(encKey.attrs.encryptedVerifierHashValue),
  ).slice(0, pk.hashSize);
  if (!constantTimeEqual(pk.hash(verifierInput).slice(0, pk.hashSize), verifierHash)) {
    h.fill(0);
    throw new UnpasswordError('wrong-password');
  }

  const secretKey = aesCbcDecrypt(
    derive(BLOCK_KEY_VALUE),
    pk.salt,
    base64ToBytes(encKey.attrs.encryptedKeyValue),
  ).slice(0, kd.keyBits / 8);
  h.fill(0);

  // 2.3.4.14 data integrity: HMAC over the whole EncryptedPackage stream
  let integrityOk: boolean | null = null;
  if (integrity) {
    const iv1 = fit(kd.hash(concat(kd.salt, BLOCK_HMAC_KEY)), kd.blockSize);
    const iv2 = fit(kd.hash(concat(kd.salt, BLOCK_HMAC_VALUE)), kd.blockSize);
    const hmacKey = aesCbcDecrypt(secretKey, iv1, base64ToBytes(integrity.attrs.encryptedHmacKey)).slice(
      0,
      kd.hashSize,
    );
    const expected = aesCbcDecrypt(secretKey, iv2, base64ToBytes(integrity.attrs.encryptedHmacValue)).slice(
      0,
      kd.hashSize,
    );
    const actual = hmac(kd.hash as never, hmacKey, encryptedPackage).slice(0, kd.hashSize);
    integrityOk = constantTimeEqual(actual, expected);
  }

  // 2.3.4.15 data encryption: 4096-byte segments, per-segment IV
  const { size, body } = packageBody(encryptedPackage);
  const out = new Uint8Array(body.length);
  for (let seg = 0, off = 0; off < body.length; seg++, off += SEGMENT) {
    const iv = fit(kd.hash(concat(kd.salt, le32(seg))), kd.blockSize);
    out.set(aesCbcDecrypt(secretKey, iv, body.subarray(off, Math.min(off + SEGMENT, body.length))), off);
  }
  secretKey.fill(0);
  const result = out.slice(0, size);
  out.fill(0);
  return { data: result, integrityOk };
}
