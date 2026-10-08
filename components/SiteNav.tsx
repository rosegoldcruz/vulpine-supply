'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { usePathname } from 'next/navigation'
import { navigationMenus, navigationPromotion, PROJECT_INTAKE, type NavigationItem, type NavigationMenu } from '@/lib/site-navigation'
import styles from './SiteNav.module.css'

function Arrow() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10" /></svg>
}
function Chevron() {
  return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
}
function NavigationEntry({ item, onSelect, mobile = false }: { item: NavigationItem; onSelect: () => void; mobile?: boolean }) {
  // The existing visualizer restores shared style selections only on mount.
  const Destination = item.href?.startsWith('/visualizer?style=') ? 'a' : Link
  const copy = <><span className={styles.itemLabel}>{item.label}{item.href && <Arrow />}</span>{item.description && <span className={styles.description}>{item.description}</span>}</>
  return <li className={`${styles.entry} ${item.featured ? styles.featured : ''}`}>
    {item.image && !mobile && <div className={item.featured ? styles.featuredImage : styles.thumbnail}><Image src={item.image} alt="" width={480} height={320} sizes={item.featured ? '230px' : '48px'} /></div>}
    <div className={styles.entryCopy}>
      {item.href ? <Destination href={item.href} onClick={onSelect}>{copy}</Destination> : !item.children ? <div className={styles.unavailable}>{copy}<span className={styles.availability}>Contact us for details</span></div> : null}
      {item.children && <details className={styles.branch}>
        <summary>{item.href ? 'Browse styles & components' : item.label}<Chevron /></summary>
        <ul className={styles.children}>{item.children.map(child => <NavigationEntry key={child.id} item={child} onSelect={onSelect} mobile={mobile} />)}</ul>
      </details>}
    </div>
  </li>
}
function Promotion({ onSelect }: { onSelect: () => void }) {
  return <aside className={styles.promotion} aria-label="Start a Vulpine project">
    <Image src={navigationPromotion.image} alt="" fill sizes="300px" />
    <div className={styles.promotionCopy}>
      <span className={styles.promotionEyebrow}>VULPINE HOMES</span>
      <h3>{navigationPromotion.title}</h3>
      <p>{navigationPromotion.description}</p>
      <Link href={navigationPromotion.primary.href} className={styles.promotionPrimary} onClick={onSelect}>{navigationPromotion.primary.label}<Arrow /></Link>
      <Link href={navigationPromotion.secondary.href} className={styles.promotionSecondary} onClick={onSelect}>{navigationPromotion.secondary.label}<Arrow /></Link>
    </div>
  </aside>
}
function MenuContent({ menu, onSelect, mobile = false }: { menu: NavigationMenu; onSelect: () => void; mobile?: boolean }) {
  return <>
    {!mobile && <div className={styles.panelHeading}><h2>{menu.label}</h2><p>{menu.description}</p></div>}
    <div className={`${styles.groups} ${menu.presentation === 'links' ? styles.linkGroups : ''}`}>
      {menu.groups.map(group => mobile ? <details className={styles.mobileGroup} key={group.id}>
        <summary>{group.label}<Chevron /></summary>
        <ul>{group.items.map(item => <NavigationEntry key={item.id} item={item} onSelect={onSelect} mobile />)}</ul>
      </details> : <div className={styles.group} key={group.id}>
        <h3>{group.label}</h3>
        <ul>{group.items.map(item => <NavigationEntry key={item.id} item={item} onSelect={onSelect} />)}</ul>
      </div>)}
    </div>
    {menu.footer && <Link className={styles.menuFooter} href={menu.footer.href} onClick={onSelect}>{menu.footer.label}<Arrow /></Link>}
  </>
}
export default function SiteNav() {
  const pathname = usePathname()
  const [active, setActive] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const navRef = useRef<HTMLElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const mobileTrigger = useRef<HTMLButtonElement>(null)
  const triggers = useRef<(HTMLButtonElement | null)[]>([])
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hoverOpened = useRef<string | null>(null)
  const menu = navigationMenus.find(item => item.id === active)
  function cancelClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = null
  }
  function close() {
    cancelClose()
    hoverOpened.current = null
    setActive(null)
  }
  function select() { close(); setMobileOpen(false) }
  function hoverMenu(id: string) {
    cancelClose()
    if (matchMedia('(min-width: 1101px) and (hover: hover)').matches && active !== id) {
      hoverOpened.current = id
      setActive(id)
    }
  }
  function triggerKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive(navigationMenus[index].id)
      requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>('a, summary')?.focus())
    } else if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault()
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? navigationMenus.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + navigationMenus.length) % navigationMenus.length
      triggers.current[next]?.focus()
      if (active) setActive(navigationMenus[next].id)
    }
  }
  useEffect(() => {
    const breakpoint = matchMedia('(min-width: 1101px)')
    const reset = () => { setActive(null); setMobileOpen(false) }
    breakpoint.addEventListener('change', reset)
    return () => { breakpoint.removeEventListener('change', reset); if (closeTimer.current) clearTimeout(closeTimer.current) }
  }, [])
  useEffect(() => { setActive(null); setMobileOpen(false) }, [pathname])
  useEffect(() => {
    if (!active) return
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !navRef.current?.contains(event.target)) close()
    }
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      close()
      triggers.current[navigationMenus.findIndex(item => item.id === active)]?.focus()
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [active])
  useEffect(() => {
    const dialog = dialogRef.current
    if (!mobileOpen || !dialog) return
    const htmlOverflow = document.documentElement.style.overflow
    const bodyOverflow = document.body.style.overflow
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    return () => {
      dialog.close()
      document.documentElement.style.overflow = htmlOverflow
      document.body.style.overflow = bodyOverflow
      mobileTrigger.current?.focus({ preventScroll: true })
    }
  }, [mobileOpen])
  return <>
    <nav ref={navRef} className={styles.header} aria-label="Primary navigation"
      onPointerEnter={cancelClose}
      onPointerLeave={event => { if (event.pointerType === 'mouse' && active) closeTimer.current = setTimeout(close, 140) }}
      onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) close() }}>
      <Link href="/" className={styles.logo} aria-label="Vulpine Homes home" onClick={select}>Vulpine<span>.</span></Link>
      <ul className={styles.parents}>
        {navigationMenus.map((item, index) => <li key={item.id} onPointerEnter={() => hoverMenu(item.id)}>
          <button ref={element => { triggers.current[index] = element }} type="button" aria-expanded={active === item.id} aria-controls={`nav-panel-${item.id}`} onKeyDown={event => triggerKey(event, index)} onClick={() => {
            cancelClose()
            if (hoverOpened.current === item.id) { hoverOpened.current = null; setActive(item.id) }
            else { hoverOpened.current = null; setActive(active === item.id ? null : item.id) }
          }}>{item.label}<Chevron /></button>
        </li>)}
      </ul>
      <div className={styles.actions}>
        <Link href="/visualizer" className={styles.reface} aria-current={pathname === '/visualizer' ? 'page' : undefined} onClick={select}>Reface Your Cabinets</Link>
        <Link href={PROJECT_INTAKE} className={styles.primary} onClick={select}>Submit Project<Arrow /></Link>
        <button ref={mobileTrigger} type="button" className={styles.mobileToggle} aria-expanded={mobileOpen} aria-controls="vulpine-mobile-navigation" aria-label="Open navigation" onClick={() => { close(); setMobileOpen(true) }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg></button>
      </div>
      {menu && <div ref={panelRef} className={styles.panel} id={`nav-panel-${menu.id}`} aria-label={`${menu.label} navigation`}>
        <div className={styles.panelContent}><MenuContent menu={menu} onSelect={select} /></div>
        <Promotion onSelect={select} />
      </div>}
    </nav>
    <dialog ref={dialogRef} id="vulpine-mobile-navigation" className={styles.drawer} aria-labelledby="mobile-navigation-title" onCancel={event => { event.preventDefault(); setMobileOpen(false) }}>
      <div className={styles.drawerHeading}>
        <span className={styles.logo} id="mobile-navigation-title">Vulpine<span>.</span> <span className={styles.srOnly}>navigation</span></span>
        <button type="button" aria-label="Close navigation" autoFocus onClick={() => setMobileOpen(false)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg></button>
      </div>
      <div className={styles.drawerContent}>
        {navigationMenus.map(item => <details className={styles.mobileMenu} name="vulpine-navigation" key={item.id}>
          <summary>{item.label}<Chevron /></summary>
          <MenuContent menu={item} onSelect={select} mobile />
        </details>)}
        <Link href="/visualizer" className={styles.drawerReface} onClick={select}>Reface Your Cabinets<Arrow /></Link>
        <Promotion onSelect={select} />
      </div>
    </dialog>
  </>
}
