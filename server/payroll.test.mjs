import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount, formatAmount, sumMinor, draftItems, runStatusFromItems, canExecute, sendable, stepsFor } from './payroll.mjs';

test('parseAmount converts decimal strings to base units without floats', () => {
  assert.equal(parseAmount('5.5'), 55_000_000n);
  assert.equal(parseAmount('0.0000001'), 1n);
  assert.equal(parseAmount(' 18300 '), 183_000_000_000n);
  for (const bad of ['', 'abc', '-1', '1.2.3', '0', '1.00000001', '1e3']) assert.throws(() => parseAmount(bad), bad);
});

test('formatAmount shows two decimals and keeps extra precision', () => {
  assert.equal(formatAmount(55_000_000n), '5.50');
  assert.equal(formatAmount('183000000'), '18.30');
  assert.equal(formatAmount(1n), '0.0000001');
  assert.equal(formatAmount(0n), '0.00');
  assert.equal(formatAmount(-25_000_000n), '-2.50');
});

test('sumMinor adds string amounts exactly', () => {
  assert.equal(sumMinor([{ amountMinor: '55000000' }, { amountMinor: '42000000' }, { amountMinor: '38000000' }]), 135_000_000n);
});

test('draftItems pays active contractors with vaults and warns about the rest', () => {
  const { items, warnings } = draftItems([
    { id: 'a', displayName: 'Maya', status: 'active', vaultAddress: 'G1', amountMinor: '1' },
    { id: 'b', displayName: 'Nadia', status: 'invited', vaultAddress: null, amountMinor: '2' },
    { id: 'c', displayName: 'Jonas', status: 'paused', vaultAddress: 'G3', amountMinor: '3' },
  ]);
  assert.deepEqual(items, [{ contractorId: 'a', amountMinor: '1' }]);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /Nadia/);
});

test('run status follows item outcomes', () => {
  assert.equal(runStatusFromItems([{ status: 'confirmed' }, { status: 'submitted' }]), 'executing');
  assert.equal(runStatusFromItems([{ status: 'confirmed' }, { status: 'confirmed' }]), 'confirmed');
  assert.equal(runStatusFromItems([{ status: 'confirmed' }, { status: 'needs_approval' }]), 'partially_confirmed');
  assert.equal(runStatusFromItems([{ status: 'failed' }, { status: 'needs_approval' }]), 'failed');
});

test('retries never resend confirmed or admin-pending items', () => {
  const items = [{ status: 'confirmed' }, { status: 'failed' }, { status: 'needs_approval' }, { status: 'pending' }];
  assert.deepEqual(sendable(items).map((i) => i.status), ['failed', 'pending']);
  assert.equal(canExecute({ status: 'draft' }), false);
  assert.equal(canExecute({ status: 'approved' }), true);
  assert.equal(canExecute({ status: 'confirmed' }), false);
});

test('steps mark the policy step as the error for a limit refusal', () => {
  const steps = stepsFor({ status: 'needs_approval' });
  assert.deepEqual(steps.map((s) => s.state), ['error', 'todo', 'todo']);
  assert.deepEqual(stepsFor({ status: 'confirmed' }).map((s) => s.state), ['done', 'done', 'done']);
});
