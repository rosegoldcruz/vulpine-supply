'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export function useScrollProgress(runwayRef: RefObject<HTMLDivElement | null>) {
  const progress = useRef(0)
  useEffect(() => {
    if (!runwayRef.current) return
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
    let lenis: Lenis | undefined
    let tick: ((time: number) => void) | undefined
    const configureScroll = () => {
      if (tick) gsap.ticker.remove(tick)
      lenis?.destroy()
      if (reducedMotion.matches) return
      lenis = new Lenis({
        lerp: 0.075,
        wheelMultiplier: 0.65,
        smoothWheel: true,
        syncTouch: false,
        anchors: { offset: -80, duration: 1.6 },
      })
      lenis.on('scroll', ScrollTrigger.update)
      gsap.ticker.lagSmoothing(0)
      tick = (time) => lenis?.raf(time * 1000)
      gsap.ticker.add(tick)
    }
    configureScroll()
    reducedMotion.addEventListener('change', configureScroll)
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: runwayRef.current,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: (self) => { progress.current = self.progress },
      })
    }, runwayRef)
    return () => {
      ctx.revert()
      reducedMotion.removeEventListener('change', configureScroll)
      if (tick) gsap.ticker.remove(tick)
      lenis?.destroy()
    }
  }, [runwayRef])
  return progress
}

export function useIsMobile() {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const mq = matchMedia('(max-width:768px)')
    const update = () => setMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return mobile
}
