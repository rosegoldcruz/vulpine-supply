'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, Sparkles, useGLTF } from '@react-three/drei'
import { Suspense, useMemo, useRef, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { MATERIAL_MODELS, materialPositionX } from '@/lib/material-marquee'

useGLTF.setDecoderPath('/draco/')
MATERIAL_MODELS.forEach(model => useGLTF.preload(model.src))

function Timeline({ time, animate }: { time: MutableRefObject<number>; animate: boolean }) {
  useFrame((_, delta) => { if (animate) time.current += Math.min(delta, .1) }, -1)
  return null
}

function FloatingMaterial({ src, index, time }: { src: string; index: number; time: MutableRefObject<number> }) {
  const { scene } = useGLTF(src)
  const group = useRef<THREE.Group>(null)
  const root = useMemo(() => {
    const clone = scene.clone(true)
    const bounds = new THREE.Box3().setFromObject(clone)
    const dimensions = bounds.getSize(new THREE.Vector3())
    clone.position.sub(bounds.getCenter(new THREE.Vector3()))
    const normalized = new THREE.Group()
    normalized.add(clone)
    normalized.scale.setScalar(1.8 / Math.max(dimensions.x, dimensions.y, dimensions.z))
    return normalized
  }, [scene])
  useFrame(state => {
    const object = group.current
    if (!object) return
    const seconds = time.current
    object.position.set(materialPositionX(seconds, index, state.viewport.width), Math.sin(seconds * 1.1 + index * .8) * .2, 0)
    object.rotation.set(.18 + Math.sin(seconds * .7 + index) * .14, -.5 + seconds * .3 + (index % 4) * .14, Math.sin(seconds * .8 + index * .6) * .1)
    object.scale.setScalar(1 + Math.sin(seconds * .9 + index * .7) * .035)
  })
  return <group ref={group} name={`floating-material-${MATERIAL_MODELS[index].id}`} dispose={null}><primitive object={root} /></group>
}

function StarField({ animate }: { animate: boolean }) {
  const { viewport } = useThree()
  return <Sparkles count={70} scale={[viewport.width, 3, 2]} size={1.5} speed={animate ? .25 : 0} opacity={.4} color="#f9bc80" />
}

export default function MaterialMarqueeScene({ animate }: { animate: boolean }) {
  const time = useRef(0)
  return <Canvas orthographic camera={{ position: [0, 0, 12], zoom: 62, near: .01, far: 100 }} dpr={[1, 1.5]}
    frameloop={animate ? 'always' : 'demand'} gl={{ alpha: true, antialias: true }} fallback={<a href="#supply">Explore our materials</a>}>
    <Timeline time={time} animate={animate} />
    <ambientLight intensity={1.1} />
    <directionalLight position={[0, 8, 10]} intensity={2.2} />
    <directionalLight position={[-5, 4, 2]} intensity={.7} color="#ffd7ae" />
    <Suspense fallback={null}>
      {MATERIAL_MODELS.map((model, index) => <FloatingMaterial key={model.id} src={model.src} index={index} time={time} />)}
      <Environment resolution={128} frames={1}>
        <Lightformer intensity={1.5} position={[0, 0, 5]} scale={[8, 8, 1]} />
        <Lightformer intensity={2} position={[0, 6, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[10, 10, 1]} />
      </Environment>
    </Suspense>
    <StarField animate={animate} />
  </Canvas>
}
