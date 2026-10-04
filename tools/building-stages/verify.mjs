import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createIO } from './io.mjs';
const directory=fileURLToPath(new URL('../../public/GLB/',import.meta.url));
const io=await createIO();
const manifest=JSON.parse(await readFile(directory+'building-stages/manifest.json','utf8'));
const hash=buffer=>createHash('sha256').update(buffer).digest('hex');
assert.equal(hash(await readFile(directory+'multifamily-building.glb')),manifest.sourceSha256);
assert.equal(hash(await readFile(directory+'building-stages/building-stage-3.glb')),manifest.sourceSha256);
const original=await io.read(directory+'multifamily-building.glb');
const textureHashes=original.getRoot().listTextures().map(t=>hash(t.getImage()));
for(const file of manifest.files) {
  const filename=directory+'building-stages/'+file.file;
  assert.equal((await stat(filename)).size,file.bytes);
  assert.ok(file.bytes<3_000_000);
  const document=await io.read(filename), root=document.getRoot();
  assert.deepEqual(root.listTextures().map(t=>hash(t.getImage())),textureHashes);
  assert.equal(root.listAnimations().length,0);
  if(file.file==='building-stage-3.glb') continue;
  const count=file.file==='building-assembly.glb'?4:Number(file.file.match(/stage-(\d)/)[1])+1;
  assert.equal(root.listNodes().length,count);
  for(const node of root.listNodes()) {
    const band=node.getExtras().constructionBand;
    assert.equal(node.getName(),manifest.nodes[band]);
    const p=node.getMesh().listPrimitives()[0], pos=p.getAttribute('POSITION');
    assert.ok(pos.getCount()>0);
    const tolerance=0.0001; // Draco 16-bit quantization on this source's bounds.
    assert.ok(pos.getMin([])[1]>=manifest.cuts[band]-tolerance);
    assert.ok(pos.getMax([])[1]<=manifest.cuts[band+1]+tolerance);
    for(const a of p.listAttributes()) assert.equal(a.getCount(),pos.getCount());
    for(const a of p.listAttributes()) assert.ok(a.getArray().every(Number.isFinite));
    assert.ok(p.getIndices().getArray().every(i=>i<pos.getCount()));
  }
}
let total=0,count=0;
for(const name of await readdir(directory)) if(name.endsWith('.glb')) {
  const size=(await stat(directory+name)).size;
  assert.ok(size<3_000_000,`${name} exceeds 3 MB`);
  await io.read(directory+name);
  total+=size;count++;
}
const fox=await io.read(directory+'vulpi_fox.glb');
const foxClips=fox.getRoot().listAnimations().map(a=>a.getName()).sort();
assert.deepEqual(foxClips,['celebrate','idle','point','talk','walk','wave']);
const foxV1=await io.read(directory+'vulpi_fox_v1.glb');
assert.equal(foxV1.getRoot().listAnimations().length,22);
console.log(JSON.stringify({verifiedSourceGLBs:count,totalSourceBytes:total,verifiedStageGLBs:manifest.files.length,foxAnimations:foxClips,foxV1Animations:22,sourceAndFullStageIdentical:true,texturesUnchanged:true}));
