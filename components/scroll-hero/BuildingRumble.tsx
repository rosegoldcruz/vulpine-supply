'use client'

import { useFrame } from '@react-three/fiber'
import { useRef, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { beats } from './heroBeats'

export function BuildingRumble({ progress, buildingRef, rumbling }: {
  progress: MutableRefObject<number>
  buildingRef: MutableRefObject<THREE.Group | null>
  rumbling: MutableRefObject<boolean>
}) {
  const started = useRef(-Infinity)
  const armed = useRef(true)
  useFrame(({ clock }) => {
    const p = progress.current
    if (p < beats.rumble.start - .015) armed.current = true
    if (armed.current && p >= beats.rumble.start) {
      started.current = clock.elapsedTime
      armed.current = false
    }
    const elapsed = clock.elapsedTime - started.current
    const active = elapsed >= 0 && elapsed < .38
    rumbling.current = active
    const building = buildingRef.current
    if (!building) return
    const envelope = active ? Math.sin(elapsed / .38 * Math.PI) : 0
    const shakeTime = active ? elapsed : 0
    building.position.x = Math.sin(shakeTime * 90) * envelope * .022
    building.position.z = Math.cos(shakeTime * 73) * envelope * .012
    building.rotation.z = Math.sin(shakeTime * 80) * envelope * .008
  })
  return null
}
