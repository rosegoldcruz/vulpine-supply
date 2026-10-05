import assert from 'node:assert/strict';
import test from 'node:test';
import { materialPaths } from '../components/scroll-hero/heroBeats';
import { extractConfigQuery } from '../lib/configurator-lead';

test('hero has five complete material trios without the retired door', () => {
  assert.equal(materialPaths.length, 15);
  assert.equal(new Set(materialPaths).size, 15);
  assert.ok(materialPaths.every(path => !/\/mat3\.glb$/.test(path)));
  assert.ok(materialPaths.some(path => /\/mat2\.glb$/.test(path)));
});

test('visualizer design links and legacy configurator links retain quote selections', () => {
  for (const route of ['visualizer', 'configurator']) {
    assert.equal(extractConfigQuery({ message: `Design summary: https://vulpinehomes.com/${route}/summary?style=slab&color=flour` }), 'style=slab&color=flour');
    assert.equal(extractConfigQuery({ pageUrl: `https://vulpinehomes.com/${route}?style=slab&color=flour` }), 'style=slab&color=flour');
  }
  assert.equal(extractConfigQuery({pageUrl:'https://vulpinehomes.com/',message:'Regular project inquiry'}), null);
});
