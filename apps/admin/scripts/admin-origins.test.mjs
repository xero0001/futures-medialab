/* global Headers, URL */
import assert from 'node:assert/strict';
import test from 'node:test';
import { allowsAdminWrite, trustedAdminOrigins } from '../lib/admin-origins.ts';

const origins = [
  'https://futures-medialab-admin.vercel.app',
  'https://admin-f.futuresmedia.app',
];
const headers = (origin, site = 'same-origin', host = new URL(origin).host) =>
  new Headers({ origin, host, ...(site === null ? {} : { 'sec-fetch-site': site }) });

test('both official admin addresses work with either production configuration', () => {
  for (const configured of origins) {
    assert.deepEqual(trustedAdminOrigins(configured), origins);
    for (const origin of origins) {
      assert.equal(allowsAdminWrite(headers(origin), configured), true);
      assert.equal(allowsAdminWrite(headers(origin, null), configured), true);
      assert.equal(allowsAdminWrite(headers(origin, null, new URL(origin).host + ':443'), configured), true);
    }
  }
});

test('platform, lookalike, insecure and unexpected-port origins are rejected', () => {
  for (const origin of [
    'https://www.futuresmedia.app',
    'https://futures-medialab.vercel.app',
    'https://admin-f.futuresmedia.app.evil.invalid',
    'http://admin-f.futuresmedia.app',
    'https://admin-f.futuresmedia.app:444',
    'https://other.futuresmedia.app',
    'https://preview.example',
  ]) assert.equal(allowsAdminWrite(headers(origin), origins[0]), false, origin);
  assert.equal(allowsAdminWrite(new Headers({ host: 'admin-f.futuresmedia.app' }), origins[0]), false);
});

test('trusted origins do not grant cross-site or same-site write access', () => {
  for (const origin of origins) {
    for (const site of ['same-site', 'cross-site', 'none']) {
      assert.equal(allowsAdminWrite(headers(origin, site), origins[0]), false);
    }
    assert.equal(allowsAdminWrite(headers(origin, null, 'other.futuresmedia.app'), origins[0]), false);
  }
  assert.equal(allowsAdminWrite(new Headers({ origin: origins[1] }), origins[0]), false);
  assert.equal(allowsAdminWrite(new Headers({ origin: origins[0] }), origins[0]), true);
});

test('development and preview remain isolated from production and each other', () => {
  for (const configured of ['http://127.0.0.1:3154', 'https://admin-preview.vercel.app']) {
    assert.deepEqual(trustedAdminOrigins(configured), [configured]);
    assert.equal(allowsAdminWrite(headers(configured), configured), true);
    for (const origin of origins) assert.equal(allowsAdminWrite(headers(origin), configured), false);
  }
  assert.throws(() => trustedAdminOrigins(undefined));
});
