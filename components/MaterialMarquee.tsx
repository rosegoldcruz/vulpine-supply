'use client'

import dynamic from 'next/dynamic'
import { Component, useEffect, useRef, useState, type ReactNode } from 'react'
import { MATERIAL_LOOP_SECONDS, MATERIAL_MODELS } from '@/lib/material-marquee'
import styles from './MaterialMarquee.module.css'

const Scene = dynamic(() => import('./MaterialMarqueeScene'), { ssr: false })

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    return this.state.failed ? <a className={styles.fallback} href="#supply">Explore our materials</a> : this.props.children
  }
}

export default function MaterialMarquee() {
  const ref = useRef<HTMLDivElement>(null)
  const [seen, setSeen] = useState(false)
  const [visible, setVisible] = useState(false)
  const [background, setBackground] = useState(false)
  const [paused, setPaused] = useState(true)
  useEffect(() => {
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    const preference = () => setPaused(motion.matches)
    preference()
    motion.addEventListener('change', preference)
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setSeen(true)
    }, { rootMargin: '120px' })
    const visibilityObserver = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting))
    if (ref.current) { observer.observe(ref.current); visibilityObserver.observe(ref.current) }
    const visibility = () => setBackground(document.hidden)
    visibility()
    document.addEventListener('visibilitychange', visibility)
    return () => { observer.disconnect(); visibilityObserver.disconnect(); motion.removeEventListener('change', preference); document.removeEventListener('visibilitychange', visibility) }
  }, [])
  return <div ref={ref} className={styles.marquee} role="region" aria-label="Vulpine 3D material showcase" data-loop-seconds={MATERIAL_LOOP_SECONDS} data-model-count={MATERIAL_MODELS.length}>
    <div className={styles.stage}>
      {seen && <SceneBoundary><Scene animate={visible && !background && !paused} /></SceneBoundary>}
    </div>
    <p className={styles.srOnly}>Explore Vulpine’s interior finish supply materials in a floating three-dimensional showcase.</p>
    <button type="button" className={styles.pause} onClick={() => setPaused(!paused)} aria-label={paused ? 'Resume material motion' : 'Pause material motion'}>{paused ? 'Resume motion' : 'Pause motion'}</button>
  </div>
}
