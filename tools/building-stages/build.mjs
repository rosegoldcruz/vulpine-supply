import { readFile, writeFile, copyFile, mkdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { draco, prune } from '@gltf-transform/functions';
import { createIO } from './io.mjs';
import { clipTriangle, triangleArea } from './clip.mjs';

const assets = fileURLToPath(new URL('../../public/GLB/', import.meta.url));
const source = assets + 'multifamily-building.glb';
const output = assets + 'building-stages/';
const io = await createIO();
const original = await io.read(source);
const root = original.getRoot();
if (root.listMeshes().length !== 1 || root.listNodes().length !== 1 || root.listAnimations().length) {
  throw new Error('Expected the audited static, single-mesh building. Re-audit a replacement model.');
}
const node = root.listNodes()[0];
if (JSON.stringify(node.getMatrix()) !== JSON.stringify([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])) {
  throw new Error('Expected identity transform and Y-up coordinates.');
}
const primitives = root.listMeshes()[0].listPrimitives();
if (primitives.length !== 1 || primitives[0].getMode() !== 4 || primitives[0].listTargets().length) {
  throw new Error('Expected a single triangle primitive without morph targets.');
}
const primitive = primitives[0];
const semantics = primitive.listSemantics();
if (semantics.some(s=>!['POSITION','NORMAL','TANGENT','TEXCOORD_0'].includes(s))) throw new Error('Unexpected vertex attribute.');
const position = primitive.getAttribute('POSITION');
const min = position.getMin([]), max = position.getMax([]);
// A thin ground/base slice, not an invented basement or architectural floor plan.
const baseTop = min[1] + (max[1] - min[1]) * 0.025;
const towerHeight = max[1] - baseTop;
const cuts = [min[1]-1e-6, baseTop, baseTop+towerHeight/3, baseTop+2*towerHeight/3, max[1]+1e-6];
const bands = Array.from({length:4},()=>Object.fromEntries(semantics.map(s=>[s,[]])));
const indices = primitive.getIndices();
let sourceArea=0, splitArea=0;
for(let i=0;i<indices.getCount();i+=3) {
  const triangle=[0,1,2].map(j=>Object.fromEntries(semantics.map(s=>[s,primitive.getAttribute(s).getElement(indices.getScalar(i+j),[])])));
  sourceArea+=triangleArea(triangle);
  for(let band=0;band<4;band++) for(const tri of clipTriangle(triangle,cuts[band],cuts[band+1])) {
    splitArea+=triangleArea(tri);
    for(const vertex of tri) for(const semantic of semantics) bands[band][semantic].push(...vertex[semantic]);
  }
}
if(Math.abs(sourceArea-splitArea)/sourceArea>1e-8) throw new Error('Clipping lost or duplicated surface area.');
await mkdir(output,{recursive:true});
const names=['stage_0_ground','stage_1_lower_third','stage_2_middle_third','stage_3_upper_third'];
const files=[];
async function writeModel(filename, lastBand) {
  const doc=await io.read(source), r=doc.getRoot(), oldNode=r.listNodes()[0];
  const material=r.listMaterials()[0], buffer=r.listBuffers()[0], scene=r.listScenes()[0];
  oldNode.dispose();
  for(let band=0;band<=lastBand;band++) {
    const p=doc.createPrimitive().setMaterial(material);
    for(const semantic of semantics) p.setAttribute(semantic,doc.createAccessor(`${names[band]}_${semantic}`)
      .setType(primitive.getAttribute(semantic).getType()).setArray(new Float32Array(bands[band][semantic])).setBuffer(buffer));
    const mesh=doc.createMesh(names[band]).addPrimitive(p);
    scene.addChild(doc.createNode(names[band]).setMesh(mesh).setExtras({constructionBand:band,lowerY:cuts[band],upperY:cuts[band+1]}));
  }
  await doc.transform(prune(),draco({quantizePosition:16,quantizationVolume:'scene'}));
  await io.write(output+filename,doc);
  files.push({file:filename,bytes:(await stat(output+filename)).size});
}
for(let stage=0;stage<3;stage++) await writeModel(`building-stage-${stage}.glb`,stage);
// The full-state standalone asset is byte-identical to the optimized source.
await copyFile(source,output+'building-stage-3.glb');
files.push({file:'building-stage-3.glb',bytes:(await stat(source)).size});
await writeModel('building-assembly.glb',3);
if(files.some(f=>f.bytes>=3_000_000)) throw new Error('Stage asset exceeds the 3 MB budget.');
const manifest={
  source:'/GLB/multifamily-building.glb',sourceSha256:createHash('sha256').update(await readFile(source)).digest('hex'),
  units:'Original model units; not calibrated architectural dimensions',upAxis:'Y',bounds:{min,max},
  baseFraction:0.025,cuts,nodes:names,sourceTriangles:indices.getCount()/3,
  bandTriangles:bands.map(b=>b.POSITION.length/9),surfaceAreaRelativeError:Math.abs(sourceArea-splitArea)/sourceArea,
  stageRule:'Show assembly nodes with constructionBand <= stage. Do not recenter individual stages.',
  limitation:'Visual height bands of the existing exterior mesh, not BIM floors. Cut faces are open; no structural interiors or caps invented.',files,
};
await writeFile(output+'manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest,null,2));
