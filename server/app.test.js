import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import express from 'express';
import { createApi } from './app.js';
import { openDatabase } from './db.js';

const valid = { name: 'Test Student', email: 'test@example.com', interest: 'adult', consent: true };
let server, base, db;

const post = (body) => fetch(`${base}/enquiries`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

before(async () => {
  db = openDatabase(':memory:');
  const app = express();
  app.use('/api', createApi({ db, adminToken: 'secret-token', enquiryLimit: 1000 }));
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(() => {
  server.closeAllConnections();
  server.close();
  db.close();
});

test('serves the dojo list', async () => {
  const dojos = await (await fetch(`${base}/dojos`)).json();
  assert.equal(dojos.length, 45);
  assert.equal(dojos.filter((d) => d.isHq).length, 1);
});

test('stores a valid enquiry and shows it to the admin', async () => {
  const res = await post({ ...valid, message: 'Hello' });
  assert.equal(res.status, 201);
  const { enquiries } = await (await fetch(`${base}/admin/enquiries`, {
    headers: { authorization: 'Bearer secret-token' },
  })).json();
  assert.ok(enquiries.some((e) => e.message === 'Hello'));
});

test('rejects missing fields and missing consent, field by field', async () => {
  const res = await post({ name: '', email: 'nope', interest: 'x' });
  assert.equal(res.status, 400);
  const { errors } = await res.json();
  assert.deepEqual(Object.keys(errors).sort(), ['consent', 'email', 'interest', 'name']);
});

test('stores nothing when the hidden bot field is filled', async () => {
  const count = db.listEnquiries().length;
  const res = await post({ ...valid, website: 'http://spam.example' });
  assert.equal(res.status, 201);
  assert.equal(db.listEnquiries().length, count);
});

test('answers malformed JSON with a 400', async () => {
  assert.equal((await post('{not json')).status, 400);
});

test('keeps enquiries behind the admin token', async () => {
  assert.equal((await fetch(`${base}/admin/enquiries`)).status, 401);
  const wrong = await fetch(`${base}/admin/enquiries`, { headers: { authorization: 'Bearer wrong' } });
  assert.equal(wrong.status, 401);
});
