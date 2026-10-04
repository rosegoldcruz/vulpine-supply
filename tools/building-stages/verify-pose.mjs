import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createIO } from './io.mjs';
const folder=fileURLToPath(new URL('../../public/GLB/',import.meta.url));
const presentation=JSON.parse(await readFile(folder+'building-presentation.json','utf8'));
const io=await createIO();
for(const file of presentation.files) {
  const bytes=await readFile(folder+file.file);
  assert.equal(bytes.length,file.bytes);
  assert.ok(bytes.length<3_000_000);
  const payload=bytes.subarray(20+bytes.readUInt32LE(12));
  assert.equal(createHash('sha256').update(payload).digest('hex'),file.binaryPayloadSha256);
  const doc=await io.readBinary(new Uint8Array(bytes)),root=doc.getRoot();
  assert.equal(root.listCameras().length,1);
  const nodes=root.listNodes();
  assert.deepEqual(nodes.find(n=>n.getName()==='BuildingPresentation').getRotation(),presentation.modelRotation);
  assert.deepEqual(nodes.find(n=>n.getName()==='BuildingGroundAlignment').getTranslation(),presentation.groundTranslation);
  const camera=nodes.find(n=>n.getCamera());
  assert.equal(camera.getName(),presentation.cameraName);
  assert.deepEqual(camera.getTranslation(),presentation.cameraPosition);
  assert.deepEqual(camera.getRotation(),presentation.cameraRotation);
  assert.equal(camera.getCamera().getYFov(),presentation.perspective.yfov);
  assert.equal(root.listAnimations().length,0);
  assert.equal(root.listTextures().length,3);
  let triangles=0;
  for(const mesh of root.listMeshes())for(const p of mesh.listPrimitives()) {
    const pos=p.getAttribute('POSITION');
    assert.ok(pos.getCount()>0);
    assert.ok(pos.getArray().every(Number.isFinite));
    assert.ok(p.getIndices().getArray().every(i=>i<pos.getCount()));
    triangles+=p.getIndices().getCount()/3;
  }
  console.log(JSON.stringify({file:file.file,triangles,camera:'identical',binaryPayload:'unchanged',bytes:bytes.length}));
}
