'use client'
import {Suspense,type MutableRefObject} from 'react'
import {StreamModel} from './StreamModel'
import {materialPaths} from './heroBeats'
export function MaterialIntake({progress,isMobile}:{progress:MutableRefObject<number>;isMobile:boolean}){return <group>{materialPaths.map((path,i)=><Suspense key={i} fallback={null}><StreamModel path={path} index={i} total={materialPaths.length} progress={progress} output={false} isMobile={isMobile}/></Suspense>)}</group>}
