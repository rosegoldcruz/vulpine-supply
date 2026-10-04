'use client'
import {Suspense,type MutableRefObject} from 'react'
import {StreamModel} from './StreamModel'
export function MaterialIntake({progress,isMobile}:{progress:MutableRefObject<number>;isMobile:boolean}){return <group>{Array.from({length:16},(_,i)=><Suspense key={i} fallback={null}><StreamModel path={`/GLB/mat${i+1}.glb`} index={i} total={16} progress={progress} output={false} isMobile={isMobile}/></Suspense>)}</group>}
