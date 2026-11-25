const test = require('node:test');
const assert = require('node:assert/strict');
const { dateRange } = require('../utils/dateRange');

test('missing or empty from/to means no date filter', () => {
  assert.equal(dateRange({}), null);
  assert.equal(dateRange({ from: '', to: '' }), null);
  assert.equal(dateRange({ from: undefined, to: '' }), null);
});

test('a complete valid range is returned', () => {
  assert.deepEqual(dateRange({ from: '2026-10-01', to: '2026-11-25' }), { from: '2026-10-01', to: '2026-11-25' });
});

test('half-filled, malformed or reversed ranges are rejected', () => {
  for (const query of [{ from: '2026-10-01', to: '' }, { from: '', to: '2026-10-01' }, { from: '2026-02-30', to: '2026-03-01' }, { from: '2026-11-25', to: '2026-10-01' }]) {
    assert.throws(() => dateRange(query), err => err.status === 400);
  }
});
