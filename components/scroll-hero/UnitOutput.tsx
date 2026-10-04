'use client'
import {Suspense,type MutableRefObject} from 'react'
import {StreamModel} from './StreamModel'
import {floorPlanPaths} from './heroBeats'
export function UnitOutput({progress,isMobile}:{progress:MutableRefObject<number>;isMobile:boolean}){return <group>{floorPlanPaths.map((path,i)=><Suspense key={path} fallback={null}><StreamModel path={path} index={i} total={floorPlanPaths.length} progress={progress} output isMobile={isMobile}/></Suspense>)}</group>}
