'use client'
import {Suspense,type MutableRefObject} from 'react'
import {StreamModel} from './StreamModel'
import {floorPlanPaths} from './heroBeats'
export function UnitOutput({progress,isMobile,rumbling}:{progress:MutableRefObject<number>;isMobile:boolean;rumbling:MutableRefObject<boolean>}){return <group>{floorPlanPaths.map((path,i)=><Suspense key={path} fallback={null}><StreamModel path={path} index={i} total={floorPlanPaths.length} progress={progress} rumbling={rumbling} output isMobile={isMobile}/></Suspense>)}</group>}
