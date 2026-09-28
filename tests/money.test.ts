import assert from 'node:assert/strict';
import test from 'node:test';

import { centsToDollars, dollarsToCents, marginBps, markupBps } from '../lib/db/money';
import { formatQuoteRevision } from '../lib/db/identifiers';

test('money helpers convert decimal strings to integer cents', () => {
  assert.equal(dollarsToCents('1234.56'), 123456);
  assert.equal(dollarsToCents('-10.05'), -1005);
  assert.equal(centsToDollars(123456), '1234.56');
});

test('percentage helpers use basis points', () => {
  assert.equal(marginBps(10000, 7500), 2500);
  assert.equal(markupBps(10000, 7500), 3333);
  assert.equal(marginBps(0, 1000), null);
  assert.equal(markupBps(1000, 0), null);
});

test('quote revision identifiers preserve the base quote number', () => {
  assert.equal(formatQuoteRevision('Q-2026-000421', 0), 'Q-2026-000421');
  assert.equal(formatQuoteRevision('Q-2026-000421', 1), 'Q-2026-000421-R1');
  assert.equal(formatQuoteRevision('Q-2026-000421', 2), 'Q-2026-000421-R2');
});
