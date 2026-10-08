'use client'

import { useEffect, useRef, useState } from 'react'

export default function VulpineHomesHero() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => {
      if (motion.matches) video.pause()
      else void video.play().catch(() => {})
    }
    update()
    motion.addEventListener('change', update)
    return () => motion.removeEventListener('change', update)
  }, [])

  const togglePlayback = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) void video.play().catch(() => {})
    else video.pause()
  }

  return (
    <section className="vs-hero" aria-labelledby="vs-hero-title">
      <video
        ref={videoRef}
        className="vs-video"
        src="/video/hero.mp4"
        poster="/video/hero-poster.jpg"
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      <div className="vs-copy">
        <span className="vs-eyebrow">Cabinet &amp; Interior Finish Supply</span>
        <h1 id="vs-hero-title">Faster Turns.<br />Cleaner Finishes.<br /><span>Smarter Supply.</span></h1>
        <p>Vulpine Homes helps property owners, builders, investors, and multifamily operators source cabinet packages, countertops, vanities, flooring, hardware, and interior finish materials — without chasing scattered vendors.</p>
        <div className="vs-ctas">
          <a href="#contact" className="vs-primary">Request a Bid</a>
          <a href="#supply" className="vs-secondary">View Supply Capabilities</a>
        </div>
      </div>
      <button type="button" className="vs-playback" onClick={togglePlayback}>
        {playing ? 'Pause video' : 'Play video'}
      </button>
    </section>
  )
}
