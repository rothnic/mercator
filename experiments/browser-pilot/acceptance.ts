import assert from 'node:assert/strict';
import type { ToolInput, ToolResult, RecordDetails } from './tool';

export type AcceptanceCase = {
  name: string;
  mode: string;
  input: ToolInput;
  status: ToolResult['status'];
  record?: RecordDetails;
  ids?: string[];
  complete?: boolean;
  stopReason?: string;
};

// Locked expectations: do not import fixture data or derive truth from scraped DOM.
const expected = {
  B: { id: 'B', title: 'Birch keyboard', amount: '42.50', currency: 'USD' },
  E: { id: 'E', title: 'Elm headset', amount: '67.80', currency: 'EUR' },
};

export const cases: AcceptanceCase[] = [
  {
    name: 'delayed detail rejects stale A',
    mode: 'base',
    input: { recordId: 'B' },
    status: 'ok',
    record: expected.B,
  },
  {
    name: 'virtual rows and duplicate boundary',
    mode: 'base',
    input: { recordId: 'E' },
    status: 'ok',
    record: expected.E,
  },
  {
    name: 'complete missing record',
    mode: 'base',
    input: { recordId: 'Z' },
    status: 'not_found',
    ids: ['A', 'B', 'C', 'D', 'E'],
    complete: true,
  },
  {
    name: 'bounded record coverage',
    mode: 'base',
    input: { recordId: 'Z', maxRecords: 3 },
    status: 'partial',
    ids: ['A', 'B', 'C'],
    stopReason: 'record_limit',
  },
  {
    name: 'bounded page coverage',
    mode: 'base',
    input: { recordId: 'E', maxPages: 1 },
    status: 'partial',
    ids: ['A', 'B'],
    stopReason: 'page_limit',
  },
  {
    name: 'wrong-record response rejected',
    mode: 'wrong-record',
    input: { recordId: 'B' },
    status: 'failed',
    stopReason: 'invalid_detail_identity_or_fields',
  },
  {
    name: 'never-loaded detail fails',
    mode: 'timeout',
    input: { recordId: 'B', timeoutMs: 300 },
    status: 'failed',
  },
  {
    name: 'stalled scroll fails',
    mode: 'stalled',
    input: { recordId: 'E', timeoutMs: 300 },
    status: 'failed',
  },
  {
    name: 'held-out order and timing',
    mode: 'holdout',
    input: { recordId: 'E' },
    status: 'ok',
    record: expected.E,
  },
  {
    name: 'malformed cursor fails',
    mode: 'malformed-cursor',
    input: { recordId: 'B' },
    status: 'failed',
    stopReason: 'unsupported_list_state',
  },
  {
    name: 'unsupported target',
    mode: 'unsupported',
    input: { recordId: 'B' },
    status: 'unsupported',
    stopReason: 'unsupported_target',
  },
  {
    name: 'selector drift',
    mode: 'drift',
    input: { recordId: 'B', timeoutMs: 300 },
    status: 'ok',
    record: expected.B,
  },
];

export function checkCase(test: AcceptanceCase, output: ToolResult) {
  assert.equal(output.status, test.status, test.name);
  assert.equal(output.receipt.modelCalls, 0);
  assert.equal(new Set(output.coverage.ids).size, output.coverage.ids.length);
  assert.equal(output.coverage.complete, test.complete ?? false);
  if (test.record) assert.deepEqual(output.record, test.record);
  else assert.equal(output.record, null);
  if (test.ids) assert.deepEqual(output.coverage.ids, test.ids);
  if (test.stopReason) assert.equal(output.coverage.stopReason, test.stopReason);
}
