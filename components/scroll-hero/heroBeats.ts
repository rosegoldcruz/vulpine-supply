export const beats = {intake:{start:0,end:.56},rumble:{start:.56,end:.61},output:{start:.61,end:.97},release:{start:.97,end:1}} as const
export type BeatName=keyof typeof beats
// Construction uses its own load-time clock, independent of scrolling.
export const constructionDuration = 2.5
export const stageBeats=[{start:0,end:0},{start:0,end:1/3},{start:1/3,end:2/3},{start:2/3,end:1}]
export const clamp01=(v:number)=>Math.max(0,Math.min(1,v))
export const easeOutCubic=(t:number)=>1-(1-t)**3
export const smoothstep=(a:number,b:number,t:number)=>{const x=clamp01((t-a)/(b-a));return x*x*(3-2*x)}
export const rangeProgress=(p:number,start:number,end:number)=>clamp01((p-start)/(end-start))
export const getBeatProgress=(p:number,name:BeatName)=>rangeProgress(p,beats[name].start,beats[name].end)
export const isBeatActive=(p:number,name:BeatName)=>p>=beats[name].start&&p<=beats[name].end
// Three distinct arrivals per group. Every item gets the same travel time.
export const stream = { itemGap: .34, groupGap: .16, travel: 1.65 }
export const outputStream = { itemGap: .65, groupGap: .20, travel: 2.0 }
export const startTime = (index: number, output = false) => {
  const timing = output ? outputStream : stream
  return index * timing.itemGap + Math.floor(index / 3) * timing.groupGap
}
export const itemProgress = (p: number, index: number, total: number, output = false) => {
  const timing = output ? outputStream : stream
  return (p * (startTime(total - 1, output) + timing.travel) - startTime(index, output)) / timing.travel
}
export const floorPlanPaths=Array.from({length:10},(_,i)=>`/GLB/${i>=7?'web/':''}floor_plan_${i+1}.glb`)

export const revisedMaterialIds = [2,3,4,5,7,9,10,11,14,15]
export const materialPaths = Array.from({length:16},(_,i)=>`/GLB/${revisedMaterialIds.includes(i+1)?'materials-v2/':''}mat${i+1}.glb`)
