import test from 'node:test';
import assert from 'node:assert/strict';
import { clipTriangle, triangleArea } from './clip.mjs';
const vertex = (x,y,z=0) => ({ POSITION:[x,y,z], NORMAL:[0,0,1], TEXCOORD_0:[x,y], TANGENT:[1,0,0,1] });
test('split triangles conserve surface area and interpolate texture coordinates', () => {
  const tri=[vertex(0,0),vertex(1,2),vertex(2,0)];
  const pieces=[...clipTriangle(tri,-Infinity,1),...clipTriangle(tri,1,Infinity)];
  assert.ok(Math.abs(pieces.reduce((s,t)=>s+triangleArea(t),0)-triangleArea(tri)) < 1e-10);
  for (const v of pieces.flat()) {
    assert.deepEqual(v.TEXCOORD_0,v.POSITION.slice(0,2));
    assert.equal(Math.hypot(...v.NORMAL),1);
    assert.equal(v.TANGENT[3],1);
  }
});
test('boundary triangles are not duplicated and outside triangles are excluded', () => {
  const tri=[vertex(0,1,0),vertex(1,1,0),vertex(0,1,1)];
  assert.equal(clipTriangle(tri,-Infinity,1).length,1);
  assert.equal(clipTriangle(tri,1,Infinity).length,0);
  assert.equal(clipTriangle(tri,2,3).length,0);
});
test('crossing several bands retains every surface within its own bounds', () => {
  const tri=[vertex(-1,-2),vertex(2,3),vertex(0,4)];
  const bounds=[-Infinity,0,1,2,Infinity];
  let area=0;
  for(let i=0;i<4;i++) for(const piece of clipTriangle(tri,bounds[i],bounds[i+1])) {
    area+=triangleArea(piece);
    assert.ok(piece.every(v=>v.POSITION[1]>=bounds[i] && v.POSITION[1]<=bounds[i+1]));
  }
  assert.ok(Math.abs(area-triangleArea(tri))<1e-10);
});
