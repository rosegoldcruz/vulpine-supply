'use client'
import {Canvas,useFrame,useThree} from '@react-three/fiber'
import {Environment,Lightformer,useGLTF} from '@react-three/drei'
import {Suspense,useRef,type MutableRefObject} from 'react'
import * as THREE from 'three'
import {BuildingStages} from './BuildingStages'
import {MaterialIntake} from './MaterialIntake'
import {BuildingRumble} from './BuildingRumble'
import {UnitOutput} from './UnitOutput'
useGLTF.setDecoderPath('/draco/')
function Damp({source,out,ready}:{source:MutableRefObject<number>;out:MutableRefObject<number>;ready:MutableRefObject<boolean>}){useFrame((_,dt)=>{out.current=THREE.MathUtils.damp(out.current,ready.current?source.current:0,6,dt)},-1);return null}
function ResponsiveCamera(){const {camera,size}=useThree();useFrame(()=>{const c=camera as THREE.OrthographicCamera;if(c.zoom!==size.height/10){c.zoom=size.height/10;c.updateProjectionMatrix()}});return null}
export function HeroCanvas({progress,damped,isMobile,reduced=false}:{progress:MutableRefObject<number>;damped:MutableRefObject<number>;isMobile:boolean;reduced?:boolean}){const building=useRef<THREE.Group>(null),rumbling=useRef(false),ready=useRef(reduced);return <Canvas orthographic camera={{position:[0,0,20],zoom:80,near:.01,far:100}} gl={{alpha:true,antialias:true}} dpr={[1,1.5]}><ResponsiveCamera/><Damp source={progress} out={damped} ready={ready}/><ambientLight intensity={1.1}/><directionalLight position={[0,8,10]} intensity={2.2}/><directionalLight position={[-5,4,2]} intensity={.6}/><Suspense fallback={null}><BuildingStages ready={ready} isMobile={isMobile} groupRef={building} reduced={reduced}/>{!reduced&&<BuildingRumble progress={damped} buildingRef={building} rumbling={rumbling}/>}</Suspense>{!reduced&&<><MaterialIntake progress={damped} isMobile={isMobile}/><UnitOutput progress={damped} isMobile={isMobile} rumbling={rumbling}/></>}<Environment resolution={128}><Lightformer intensity={2} position={[0,6,0]} rotation={[Math.PI/2,0,0]} scale={[10,10,1]}/></Environment></Canvas>}
