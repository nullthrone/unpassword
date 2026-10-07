import { describe, expect, it } from 'vitest';
import {
  decidePdfAction,
  restrictionsPreserved,
  type PdfCapabilities,
  type PdfEncryptionInfo,
} from '../src/core/pdf/policy';

const ALL: PdfCapabilities = {
  accessibility: true,
  extract: true,
  modify: true,
  modifyannotations: true,
  modifyassembly: true,
  modifyforms: true,
  modifyother: true,
  printhigh: true,
  printlow: true,
};
const RESTRICTED: PdfCapabilities = { ...ALL, extract: false, printhigh: false, modify: false };

const info = (p: Partial<PdfEncryptionInfo>): PdfEncryptionInfo => ({
  encrypted: true,
  userPasswordMatched: false,
  ownerPasswordMatched: false,
  capabilities: ALL,
  ...p,
});

describe('decidePdfAction', () => {
  it('user password, no restrictions → decrypt', () => {
    expect(decidePdfAction(info({ userPasswordMatched: true }), false)).toEqual({ kind: 'decrypt' });
  });

  it('user password, restrictions → remove open password only, keep restrictions', () => {
    expect(decidePdfAction(info({ userPasswordMatched: true, capabilities: RESTRICTED }), false)).toEqual({
      kind: 'preserve-restrictions',
      capabilities: RESTRICTED,
    });
  });

  it('user password, only the deprecated accessibility permission denied → decrypt', () => {
    expect(
      decidePdfAction(info({ userPasswordMatched: true, capabilities: { ...ALL, accessibility: false } }), false),
    ).toEqual({ kind: 'decrypt' });
  });

  it('owner password → decrypt, whatever the restrictions', () => {
    expect(decidePdfAction(info({ ownerPasswordMatched: true, capabilities: RESTRICTED }), false)).toEqual({
      kind: 'decrypt',
    });
    expect(decidePdfAction(info({ ownerPasswordMatched: true, capabilities: RESTRICTED }), true)).toEqual({
      kind: 'decrypt',
    });
  });

  it('owner-only file without owner password → refused', () => {
    expect(decidePdfAction(info({ userPasswordMatched: true, capabilities: RESTRICTED }), true)).toEqual({
      kind: 'refuse',
      reason: 'owner-password-required',
    });
    expect(decidePdfAction(info({ userPasswordMatched: true }), true)).toEqual({
      kind: 'refuse',
      reason: 'owner-password-required',
    });
  });

  it('wrong password → refused', () => {
    expect(decidePdfAction(null, false)).toEqual({ kind: 'refuse', reason: 'wrong-password' });
    expect(decidePdfAction(info({}), false)).toEqual({ kind: 'refuse', reason: 'wrong-password' });
  });

  it('unencrypted → refused', () => {
    expect(decidePdfAction(info({ encrypted: false }), true)).toEqual({ kind: 'refuse', reason: 'not-encrypted' });
  });
});

describe('restrictionsPreserved', () => {
  it('detects a lost restriction', () => {
    expect(restrictionsPreserved(RESTRICTED, RESTRICTED)).toBe(true);
    expect(restrictionsPreserved(RESTRICTED, { ...RESTRICTED, extract: true })).toBe(false);
    expect(restrictionsPreserved(RESTRICTED, { ...RESTRICTED, printlow: false })).toBe(true);
  });

  it('ignores the deprecated accessibility permission', () => {
    const noAccess = { ...RESTRICTED, accessibility: false };
    expect(restrictionsPreserved(noAccess, RESTRICTED)).toBe(true);
    expect(restrictionsPreserved(noAccess, { ...RESTRICTED, extract: true })).toBe(false);
  });
});
