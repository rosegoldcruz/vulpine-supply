import assert from 'node:assert/strict';
import test from 'node:test';
import { extractConfigQuery } from '../lib/configurator-lead';

test('visualizer design links and legacy configurator links retain quote selections', () => {
  for (const route of ['visualizer', 'configurator']) {
    assert.equal(extractConfigQuery({ message: `Design summary: https://vulpinehomes.com/${route}/summary?style=slab&color=flour` }), 'style=slab&color=flour');
    assert.equal(extractConfigQuery({ pageUrl: `https://vulpinehomes.com/${route}?style=slab&color=flour` }), 'style=slab&color=flour');
  }
  assert.equal(extractConfigQuery({pageUrl:'https://vulpinehomes.com/',message:'Regular project inquiry'}), null);
});
