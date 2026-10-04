// Change glTF scene transforms/camera ONLY. Preserve compressed mesh and texture
// bytes exactly, including the Draco stream (no decode/re-encode quality loss).
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const folder = fileURLToPath(new URL('../../public/GLB/', import.meta.url));
const degrees = (n) => n * Math.PI / 180;
// Visual match to the supplied screenshot; screenshot has no numeric camera metadata.
const yaw = -35, elevation = 8, distance = 4.2;
const min = [-0.45870301127433777, -0.9523299932479858, -0.5326939821243286];
const max = [0.4497404992580414, 0.9525760412216187, 0.5323697328567505];
const height = max[1] - min[1];
const framing = {
  modelYawDegrees: yaw, cameraElevationDegrees: elevation,
  modelRotation: [0, Math.sin(degrees(yaw)/2), 0, Math.cos(degrees(yaw)/2)],
  groundTranslation: [-(min[0]+max[0])/2, -min[1], -(min[2]+max[2])/2],
  cameraPosition: [0, height/2 + distance*Math.sin(degrees(elevation)), distance*Math.cos(degrees(elevation))],
  cameraRotation: [-Math.sin(degrees(elevation)/2), 0, 0, Math.cos(degrees(elevation)/2)],
  target: [0, height/2, 0],
  perspective: { yfov: degrees(35), znear: 0.01, zfar: 100 },
};
const hash = (data) => createHash('sha256').update(data).digest('hex');
function parse(bytes) {
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  assert.equal(bytes.readUInt32LE(16), 0x4e4f534a);
  const end = 20 + bytes.readUInt32LE(12);
  return { json: JSON.parse(bytes.subarray(20,end).toString()), payload: bytes.subarray(end) };
}
function encode(json, payload) {
  const text = Buffer.from(JSON.stringify(json));
  const padded = Buffer.alloc(Math.ceil(text.length/4)*4, 0x20);
  text.copy(padded);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67,0); header.writeUInt32LE(2,4);
  header.writeUInt32LE(20+padded.length+payload.length,8);
  header.writeUInt32LE(padded.length,12); header.writeUInt32LE(0x4e4f534a,16);
  return Buffer.concat([header,padded,payload]);
}

const files = [];
for(let stage=0;stage<4;stage++) {
  const filename = `building-stage-${stage}.glb`;
  const before = await readFile(folder+filename);
  const {json,payload} = parse(before);
  assert.equal(json.scenes.length,1,'Re-audit models with multiple scenes.');
  const scene = json.scenes[0];
  let rig = json.nodes.find(n=>n.extras?.vulpinePresentationRig === 1);
  let cameraNode;
  if(!rig) {
    assert.ok(!json.cameras?.length, 'Do not silently replace an existing authored camera.');
    const alignmentIndex = json.nodes.length;
    json.nodes.push({name:'BuildingGroundAlignment',translation:framing.groundTranslation,children:[...scene.nodes]});
    const rigIndex = json.nodes.length;
    rig = {name:'BuildingPresentation',extras:{vulpinePresentationRig:1},children:[alignmentIndex]};
    json.nodes.push(rig);
    cameraNode = {name:'ConstructionReferenceCamera',camera:0};
    const cameraIndex = json.nodes.length;
    json.nodes.push(cameraNode);
    json.cameras = [{name:'ConstructionReferenceCamera',type:'perspective',perspective:framing.perspective}];
    scene.nodes = [rigIndex,cameraIndex];
  } else {
    cameraNode = json.nodes.find(n=>n.name==='ConstructionReferenceCamera' && n.camera!==undefined);
    assert.ok(cameraNode,'Existing presentation camera missing.');
  }
  rig.rotation = framing.modelRotation;
  json.nodes[rig.children[0]].translation = framing.groundTranslation;
  cameraNode.translation = framing.cameraPosition;
  cameraNode.rotation = framing.cameraRotation;
  json.cameras[cameraNode.camera].perspective = framing.perspective;
  scene.extras = {...scene.extras,vulpinePresentation:{stage,...framing,cameraName:'ConstructionReferenceCamera'}};
  const after = encode(json,payload);
  assert.equal(hash(parse(after).payload),hash(payload),'Binary geometry/textures changed.');
  assert.ok(after.length<3_000_000,'GLB exceeds 3 MB');
  await writeFile(folder+filename,after);
  files.push({file:filename,bytes:after.length,binaryPayloadSha256:hash(payload)});
}
await writeFile(folder+'building-presentation.json',JSON.stringify({
  cameraName:'ConstructionReferenceCamera',...framing,files,
  note:'All four files use the same pose and full-building camera. Use the embedded camera; per-file auto-fit loses consistent framing. Angles are a visual match, not recovered screenshot metadata.',
},null,2)+'\n');
console.log(JSON.stringify({framing,files},null,2));
