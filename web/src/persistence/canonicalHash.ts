import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

/**
 * JSON's object-key order is an implementation detail, while authored array order
 * is part of a scenario. This serializer gives saves, manifests and challenge
 * codes one stable representation without changing array order.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Canonical JSON cannot contain a non-finite number.');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry ?? null)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`);
    return `{${entries.join(',')}}`;
  }
  throw new TypeError(`Canonical JSON cannot contain ${typeof value}.`);
}

export function sha256Hex(value: string): string {
  return bytesToHex(sha256(utf8ToBytes(value)));
}

export function canonicalSha256(value: unknown): string {
  return sha256Hex(canonicalJson(value));
}
