'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { materialCards } from './materialCardData'

function Arrow() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10" /></svg>
}

function Chevron() {
  return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
}

export default function SiteNav() {
  const pathname = usePathname()
  const onHome = pathname === '/'
  const home = onHome ? '' : '/'
  const [open, setOpen] = useState(false)
  const navRef = useRef<HTMLElement>(null)
  const desktopTrigger = useRef<HTMLButtonElement>(null)
  const mobileTrigger = useRef<HTMLButtonElement>(null)
  const openedByHover = useRef(false)

  const close = () => {
    openedByHover.current = false
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !navRef.current?.contains(event.target)) close()
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      close()
      const trigger = matchMedia('(min-width: 1101px)').matches ? desktopTrigger : mobileTrigger
      trigger.current?.focus()
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  return (
    <nav
      ref={navRef}
      className="site-nav"
      aria-label="Primary navigation"
      onMouseLeave={close}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) close() }}
    >
      <a href="/" className="nav-logo" aria-label="Vulpine Homes home">Vulpine<span>.</span></a>
      <ul className="nav-links">
        <li onMouseEnter={() => {
          if (matchMedia('(hover: hover)').matches && !open) {
            openedByHover.current = true
            setOpen(true)
          }
        }}>
          <button ref={desktopTrigger} className="nav-products-trigger" type="button" aria-expanded={open} aria-controls="vulpine-products-menu" onClick={() => {
            if (openedByHover.current) {
              openedByHover.current = false
              setOpen(true)
            } else setOpen(!open)
          }}>
            What We Supply <Chevron />
          </button>
        </li>
        <li><a href={`${home}#turns`} onClick={close} onMouseEnter={close}>Property Turns</a></li>
        <li><a href={`${home}#mf-split`} onClick={close} onMouseEnter={close}>Multifamily</a></li>
        <li><a href={`${home}#contractors`} onClick={close} onMouseEnter={close}>Contractors</a></li>
      </ul>
      <div className="nav-actions">
        <a href="/visualizer" className="nav-reface" aria-current={pathname === '/visualizer' ? 'page' : undefined} onClick={close}>Reface Your Cabinets</a>
        <a href={onHome ? '#contact' : '/request-bid'} className="nav-cta" onClick={close}>Request a Bid</a>
      </div>
      <button ref={mobileTrigger} type="button" className="nav-browse-trigger" aria-expanded={open} aria-controls="vulpine-products-menu" onClick={() => setOpen(!open)}>
        Browse products <Chevron />
      </button>
      {open && (
        <div className="nav-mega" id="vulpine-products-menu">
          <div className="nav-mega-products">
            <div className="nav-mega-heading"><h2>Products</h2><a href={`${home}#supply`} onClick={close}>View all materials <Arrow /></a></div>
            <div className="nav-product-grid">
              {materialCards.slice(0, 4).map(card => (
                <a key={card.slug} className="nav-product" href={`${home}#material-${card.slug}`} onClick={close}>
                  <div className="nav-product-image"><Image src={card.frontImage} alt="" width={400} height={250} sizes="(max-width: 600px) 42vw, 200px" /></div>
                  <span>{card.title}<Arrow /></span>
                </a>
              ))}
            </div>
            <div className="nav-mobile-links">
              <a href={`${home}#turns`} onClick={close}>Property Turns <Arrow /></a>
              <a href={`${home}#mf-split`} onClick={close}>Multifamily <Arrow /></a>
              <a href={`${home}#contractors`} onClick={close}>Contractors <Arrow /></a>
            </div>
          </div>
          <aside className="nav-quote-panel">
            <Image src="/cabs_clean/kitchens/Flour-Shaker_Kitchen.jpg" alt="" fill sizes="(max-width: 600px) 90vw, 300px" />
            <div className="nav-quote-copy">
              <h2>Planning your next project?</h2>
              <p>Get pricing and guidance for your cabinet and interior finish package.</p>
              <a href="/request-bid" className="nav-quote-primary" onClick={close}>Request a Bid <Arrow /></a>
              <a href="/visualizer" className="nav-quote-secondary" onClick={close}>Reface Your Cabinets <Arrow /></a>
            </div>
          </aside>
        </div>
      )}
    </nav>
  )
}
