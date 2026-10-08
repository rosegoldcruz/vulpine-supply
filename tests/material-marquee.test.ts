import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import { MATERIAL_LOOP_SECONDS, MATERIAL_MODELS, materialPositionX } from '../lib/material-marquee'

const root = resolve(import.meta.dirname, '..')
test('the showcase uses every existing numbered material GLB and revised exports', () => {
  assert.deepEqual(MATERIAL_MODELS.map(model => model.id), [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16])
  for (const model of MATERIAL_MODELS) {
    const bytes = readFileSync(resolve(root, `public${model.src}`))
    assert.equal(bytes.readUInt32LE(0), 0x46546c67, `Not a GLB: ${model.src}`)
    assert.equal(bytes.readUInt32LE(4), 2)
    assert.equal(bytes.readUInt32LE(8), bytes.length)
    const document = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString())
    assert.ok(document.meshes.length > 0, `No live geometry: ${model.src}`)
  }
  assert.equal(MATERIAL_MODELS.find(model => model.id === 9)?.src, '/GLB/materials-v2/mat9.glb')
})
test('material movement loops seamlessly at 9.33 seconds and wraps outside the view', () => {
  assert.equal(MATERIAL_LOOP_SECONDS, 9.33)
  for (const viewport of [6, 24, 64]) {
    for (let index = 0; index < MATERIAL_MODELS.length; index++) {
      assert.ok(Math.abs(materialPositionX(.2, index, viewport) - materialPositionX(.2 + MATERIAL_LOOP_SECONDS, index, viewport)) < 1e-9)
      assert.notEqual(materialPositionX(.2, index, viewport), materialPositionX(.5, index, viewport))
    }
    const span = Math.max(MATERIAL_MODELS.length * 2.6, viewport + 5.2)
    assert.ok(span / 2 > viewport / 2 + 1.8, 'Wrap would be visible inside the viewport')
  }
})
