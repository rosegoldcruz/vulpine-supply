import { mkdir, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { draco, prune, dedup, textureCompress } from '../building-stages/node_modules/@gltf-transform/functions/dist/index.js';
import sharp from 'sharp';
import { createIO } from '../building-stages/io.mjs';
const source = resolve(process.argv[2] || '/tmp/vulpine-materials-raw');
const destination = resolve('public/GLB/materials-v2');
await mkdir(destination, {recursive:true});
const io = await createIO(), report=[];
for (const id of [2,3,4,5,7,9,10,11,14,15]) {
 const input=`${source}/mat${id}.glb`, output=`${destination}/mat${id}.glb`;
 const document=await io.read(input);
 await document.transform(dedup(),prune(),textureCompress({encoder:sharp,targetFormat:'webp',resize:[1024,1024],quality:88}),draco({method:'edgebreaker',encodeSpeed:5,quantizePosition:14,quantizeNormal:12,quantizeTexcoord:12}));
 await io.write(output,document);
 report.push({id,sourceBytes:(await stat(input)).size,optimizedBytes:(await stat(output)).size});
 console.log(report.at(-1));
}
await writeFile(`${destination}/verification.json`,JSON.stringify(report,null,2)+'\n');
