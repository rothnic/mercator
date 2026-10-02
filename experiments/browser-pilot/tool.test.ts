import { test, expect } from 'bun:test';
import { validateInput } from './tool';
import { cases, checkCase } from './acceptance';

test('invalid record identifiers and execution budgets are rejected', () => {
  for (const input of [
    null,
    undefined,
    {},
    { recordId: '' },
    { recordId: 'B"]' },
    { recordId: 'B', maxPages: 0 },
    { recordId: 'B', maxRecords: NaN },
    { recordId: 'B', timeoutMs: 60001 },
  ]) {
    expect(() => Reflect.apply(validateInput, undefined, [input])).toThrow(TypeError);
  }
});

test('independent acceptance rejects plausible wrong record', () => {
  expect(() =>
    checkCase(cases[0], {
      status: 'ok',
      record: { id: 'A', title: 'Birch keyboard', amount: '42.50', currency: 'USD' },
      coverage: { ids: ['A', 'B'], complete: false, stopReason: 'requested_record_loaded' },
      receipt: { toolVersion: 'mutant', modelCalls: 0 },
    }),
  ).toThrow();
});
