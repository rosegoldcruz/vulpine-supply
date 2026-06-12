'use client';

import { useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const PAGE_HTML = `
<!-- ─── NAV ─── -->
<nav>
  <a href="#" class="nav-logo">Vulpine<span>.</span></a>
  <ul class="nav-links">
    <li><a href="#supply">What We Supply</a></li>
    <li><a href="#turns">Property Turns</a></li>
    <li><a href="#mf-split">Multifamily</a></li>
    <li><a href="#contractors">Contractors</a></li>
  </ul>
  <a href="#contact" class="nav-cta">Request a Bid</a>
</nav>

<main>

<!-- ─── HERO ─── -->
<section id="hero">
  <span class="hero-eyebrow">Cabinet &amp; Interior Finish Supply</span>
  <h1 class="hero-headline">
    <span class="line"><span class="line-inner">Faster Turns.</span></span>
    <span class="line"><span class="line-inner">Cleaner Finishes.</span></span>
    <span class="line"><span class="line-inner" style="color: var(--orange)">Smarter Supply.</span></span>
  </h1>
  <p class="hero-sub">Vulpine Homes helps property owners, builders, investors, and multifamily operators source cabinet packages, countertops, vanities, flooring, hardware, and interior finish materials — without chasing scattered vendors.</p>
  <div class="hero-ctas">
    <a href="#contact" class="btn-primary">Request a Bid</a>
    <a href="#supply" class="btn-secondary">View Supply Capabilities</a>
  </div>

  <!-- ─── ISOMETRIC BUILDING STAGE ─── -->
  <div id="building-stage">
    <canvas id="vhCanvas"></canvas>
  </div>
</section>

<!-- ─── TICKER ─── -->
<div class="ticker-wrap">
  <div class="ticker-track">
    <span class="ticker-item">Cabinet Boxes <span class="dot">◆</span></span>
    <span class="ticker-item">Cabinet Doors <span class="dot">◆</span></span>
    <span class="ticker-item">Drawer Fronts <span class="dot">◆</span></span>
    <span class="ticker-item">Refacing Fronts <span class="dot">◆</span></span>
    <span class="ticker-item">Countertops <span class="dot">◆</span></span>
    <span class="ticker-item">Sinks &amp; Vanities <span class="dot">◆</span></span>
    <span class="ticker-item">Flooring <span class="dot">◆</span></span>
    <span class="ticker-item">Interior Doors <span class="dot">◆</span></span>
    <span class="ticker-item">Hardware <span class="dot">◆</span></span>
    <span class="ticker-item">Trim &amp; Finish <span class="dot">◆</span></span>
    <span class="ticker-item">Cabinet Boxes <span class="dot">◆</span></span>
    <span class="ticker-item">Cabinet Doors <span class="dot">◆</span></span>
    <span class="ticker-item">Drawer Fronts <span class="dot">◆</span></span>
    <span class="ticker-item">Refacing Fronts <span class="dot">◆</span></span>
    <span class="ticker-item">Countertops <span class="dot">◆</span></span>
    <span class="ticker-item">Sinks &amp; Vanities <span class="dot">◆</span></span>
    <span class="ticker-item">Flooring <span class="dot">◆</span></span>
    <span class="ticker-item">Interior Doors <span class="dot">◆</span></span>
    <span class="ticker-item">Hardware <span class="dot">◆</span></span>
    <span class="ticker-item">Trim &amp; Finish <span class="dot">◆</span></span>
  </div>
</div>

<!-- ─── WHAT WE SUPPLY ─── -->
<section id="supply">
  <span class="section-label reveal">What We Supply</span>
  <h2 class="section-heading reveal">Every material category. One supply partner.</h2>
  <p class="section-body reveal">Cabinet boxes, doors, drawer fronts, refacing fronts, countertops, sinks, vanities, flooring, hardware, trim, and interior finish materials for residential and multifamily projects.</p>

  <div class="product-grid">
    <div class="product-card reveal"><div class="product-card-bg tex-cabinet-box"></div><div class="product-card-content"><div class="product-card-name">Cabinet Boxes</div><div class="product-card-desc">Frameless and face-frame box construction for kitchens, baths, and utility spaces.</div></div></div>
    <div class="product-card reveal"><div class="product-card-bg tex-cabinet-door"></div><div class="product-card-content"><div class="product-card-name">Cabinet Doors</div><div class="product-card-desc">Shaker, slab, and profile door styles in painted, stained, and thermofoil finishes.</div></div></div>
    <div class="product-card reveal"><div class="product-card-bg tex-refacing"></div><div class="product-card-content"><div class="product-card-name">Refacing Fronts</div><div class="product-card-desc">Update existing cabinet boxes with new door and drawer fronts — no full replacement required.</div></div></div>
    <div class="product-card reveal"><div class="product-card-bg tex-countertop"></div><div class="product-card-content"><div class="product-card-name">Countertops</div><div class="product-card-desc">Laminate, quartz, and solid surface options spec'd for durability and rental longevity.</div></div></div>
    <div class="product-card reveal"><div class="product-card-bg tex-sink"></div><div class="product-card-content"><div class="product-card-name">Sinks</div><div class="product-card-desc">Kitchen and bath sink options to coordinate with countertop and cabinet packages.</div></div></div>
    <div class="product-card reveal"><div class="product-card-bg tex-vanity"></div><div class="product-card-content"><div class="product-card-name">Vanities</div><div class="product-card-desc">Bathroom vanity units in standard and custom widths for single and multifamily renovations.</div></div></div>
    <div class="product-card reveal"><div class="product-card-bg tex-flooring"></div><div class="product-card-content"><div class="product-card-name">Flooring</div><div class="product-card-desc">LVP, hardwood, laminate, and tile options for kitchens, baths, and living areas.</div></div></div>
    <div class="product-card reveal"><div class="product-card-bg tex-hardware"></div><div class="product-card-content"><div class="product-card-name">Hardware</div><div class="product-card-desc">Pulls, knobs, hinges, and drawer slides in matte black, brushed nickel, and more.</div></div></div>
    <div class="product-card reveal"><div class="product-card-bg tex-doors"></div><div class="product-card-content"><div class="product-card-name">Interior Doors</div><div class="product-card-desc">Hollow-core and solid-core interior door slabs and prehung units for complete unit packages.</div></div></div>
    <div class="product-card reveal"><div class="product-card-bg tex-trim"></div><div class="product-card-content"><div class="product-card-name">Trim &amp; Finish</div><div class="product-card-desc">Baseboards, casings, crown, and finish millwork to complete the interior package.</div></div></div>
  </div>
</section>

<!-- ─── BUILT FOR TURNS ─── -->
<section id="turns">
  <span class="section-label reveal">Built for Property Turns</span>
  <h2 class="section-heading reveal">One kitchen or twenty units — same supply clarity.</h2>
  <p class="section-body reveal">Whether it's one kitchen, one rental, or a multi-unit turnover, Vulpine simplifies the material side so owners and operators move faster with fewer loose ends.</p>
  <div class="features-cols">
    <div class="feature-col reveal">
      <div class="feature-icon"><svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"></rect><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"></path><line x1="12" y1="12" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg></div>
      <div class="feature-title">Single-Source for All Finish Categories</div>
      <div class="feature-text">Stop coordinating with five vendors. Vulpine carries cabinet boxes, doors, countertops, flooring, vanities, and hardware under one supply relationship. Less friction. Fewer calls. Faster moves.</div>
    </div>
    <div class="feature-col reveal">
      <div class="feature-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></div>
      <div class="feature-title">Turn-Ready Timelines</div>
      <div class="feature-text">We understand that vacant units cost money. Vulpine coordinates material sequencing so your cabinets, countertops, and finishes arrive in the right order for your install schedule.</div>
    </div>
    <div class="feature-col reveal">
      <div class="feature-icon"><svg viewBox="0 0 24 24"><path d="M21 10H3"></path><path d="M21 6H3"></path><path d="M21 14H3"></path><path d="M21 18H3"></path></svg></div>
      <div class="feature-title">Repeatable Material Specs</div>
      <div class="feature-text">Define your standard once. Vulpine maintains your spec sheet so every unit turn pulls from the same approved selections — consistent quality, no re-speccing from scratch.</div>
    </div>
  </div>
</section>

<!-- ─── MULTIFAMILY / INVESTOR SPLIT ─── -->
<section id="mf-split" style="padding:0;">
  <div class="split-row">
    <div class="split-cell">
      <span class="split-tag reveal">Multifamily Supply Support</span>
      <h2 class="section-heading reveal" style="color:#f5f0eb;">Repeatable packages across every unit.</h2>
      <p class="section-body reveal">For apartment owners and property managers — standardize cabinet and finish packages across multiple units. Reduce sourcing friction, lock in consistent specs, and move through turns without starting material decisions from scratch on every vacancy.</p>
      <div class="split-visual reveal">
        <div class="split-stat"><div class="split-stat-num">12+</div><div class="split-stat-label">Finish categories in one package</div></div>
        <div class="split-stat"><div class="split-stat-num">1</div><div class="split-stat-label">Supply contact for the entire project</div></div>
      </div>
    </div>
    <div class="split-cell">
      <span class="split-tag reveal">Investor Refreshes</span>
      <h2 class="section-heading reveal" style="color:#111111;">Practical upgrades. Clean results.</h2>
      <p class="section-body reveal" style="color:#888480;">For rental owners and real estate investors — practical upgrade packages for kitchens, baths, flooring, and interior finishes without overcomplicating the process. We spec for durability, tenant appeal, and realistic budgets.</p>
      <div class="split-visual reveal">
        <div class="split-stat" style="background:rgba(0,0,0,0.06);"><div class="split-stat-num">↑</div><div class="split-stat-label" style="color:#888480;">Rental value after finish refresh</div></div>
        <div class="split-stat" style="background:rgba(0,0,0,0.06);"><div class="split-stat-num">Fast</div><div class="split-stat-label" style="color:#888480;">Bid-to-materials turnaround</div></div>
      </div>
    </div>
  </div>
</section>

<!-- ─── CONTRACTORS ─── -->
<section id="contractors">
  <div class="contractor-visual reveal">
    <div class="arch-sketch">
      <div class="cabinet-render">
        <div class="cab-upper">
          <div class="cab-door-sm"></div><div class="cab-door-sm"></div><div class="cab-door-sm"></div>
        </div>
        <div class="cab-counter"></div>
        <div class="cab-lower">
          <div class="cab-base-door"></div><div class="cab-base-door"></div>
        </div>
        <div class="cab-label">Cabinet Package</div>
      </div>
    </div>
  </div>
  <div>
    <span class="section-label reveal">Builder &amp; Contractor Relationships</span>
    <h2 class="section-heading reveal">Your finish supply partner — not another vendor to manage.</h2>
    <p class="section-body reveal">Vulpine works alongside builders and contractors as a cabinet and finish material supply partner. We support product options, bid documentation, and delivery coordination so your crew can focus on install.</p>
    <div class="contractor-list">
      <div class="contractor-item reveal"><div class="contractor-dot"></div><div><div class="contractor-item-title">Bid Support</div><div class="contractor-item-text">We prepare material cut sheets and pricing summaries formatted for your bid packages. No guesswork on material allowances.</div></div></div>
      <div class="contractor-item reveal"><div class="contractor-dot"></div><div><div class="contractor-item-title">Product Selection Guidance</div><div class="contractor-item-text">Not sure which cabinet line fits the project spec? We match product to budget, timeline, and install conditions without overengineering the choice.</div></div></div>
      <div class="contractor-item reveal"><div class="contractor-dot"></div><div><div class="contractor-item-title">Delivery Coordination</div><div class="contractor-item-text">We coordinate material delivery to align with your install schedule. Right materials. Right sequence. No site cluttered with boxes three weeks early.</div></div></div>
    </div>
  </div>
</section>

<!-- ─── CONTACT ─── -->
<section id="contact">
  <div class="contact-inner">
    <span class="section-label reveal">Request a Bid</span>
    <h2 class="section-heading reveal">Tell us about your project.</h2>
    <p class="section-body reveal">Share the basics and we'll come back with supply options, material recommendations, and a clear path forward. No obligation. No pitch call required.</p>
    <form class="bid-form reveal" action="" method="POST" novalidate>
      <div class="form-group"><label class="form-label" for="fname">First &amp; Last Name</label><input class="form-input" type="text" id="fname" name="name" placeholder="Jordan Mercer" required></div>
      <div class="form-group"><label class="form-label" for="femail">Email</label><input class="form-input" type="email" id="femail" name="email" placeholder="jordan@company.com" required></div>
      <div class="form-group"><label class="form-label" for="fphone">Phone</label><input class="form-input" type="tel" id="fphone" name="phone" placeholder="(555) 000-0000"></div>
      <div class="form-group">
        <label class="form-label" for="ftype">Project Type</label>
        <select class="form-select" id="ftype" name="project_type">
          <option value="">Select a project type</option>
          <option value="multifamily">Multifamily / Apartment</option>
          <option value="single-family">Single-Family Renovation</option>
          <option value="investor-flip">Investor Flip / Rental Refresh</option>
          <option value="new-build">New Build</option>
          <option value="contractor">Contractor Supply Relationship</option>
        </select>
      </div>
      <div class="form-group full"><label class="form-label" for="fmessage">Project Details</label><textarea class="form-textarea" id="fmessage" name="message" placeholder="Tell us about the scope — unit count, material categories you need, timeline, location..."></textarea></div>
      <button type="submit" class="form-submit">Send Request</button>
    </form>
  </div>
</section>

</main>

<!-- ─── FOOTER ─── -->
<footer>
  <div class="footer-logo">Vulpine<span>.</span></div>
  <ul class="footer-links">
    <li><a href="#supply">Supply</a></li>
    <li><a href="#turns">Property Turns</a></li>
    <li><a href="#mf-split">Multifamily</a></li>
    <li><a href="#contractors">Contractors</a></li>
    <li><a href="#contact">Request a Bid</a></li>
  </ul>
  <div class="footer-copy">© 2026 Vulpine Homes. All rights reserved.</div>
</footer>
`;

export default function HomePageClient() {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.to('.hero-eyebrow', { opacity: 1, y: 0, duration: 0.6, delay: 0.3 })
      .to('.line-inner', { y: '0%', duration: 0.8, stagger: 0.1 }, '-=0.2')
      .to('.hero-sub', { opacity: 1, y: 0, duration: 0.7 }, '-=0.3')
      .to('.hero-ctas', { opacity: 1, y: 0, duration: 0.6 }, '-=0.4');

    gsap.utils.toArray('.reveal').forEach((el) => {
      gsap.to(el, {
        opacity: 1,
        y: 0,
        duration: 0.75,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 88%',
          toggleActions: 'play none none none',
        },
      });
    });

    const nav = document.querySelector('nav');
    const navTrigger = ScrollTrigger.create({
      start: 100,
      onEnter: () => {
        if (nav) nav.style.boxShadow = '0 2px 24px rgba(0,0,0,0.07)';
      },
      onLeaveBack: () => {
        if (nav) nav.style.boxShadow = 'none';
      },
    });

    let raf = null;
    let cleanupResize = () => {};

    (function () {
      const canvas = document.getElementById('vhCanvas');
      if (!canvas) return;
      const stage = document.getElementById('building-stage');
      if (!stage) return;

      const T = {
        bg: 'transparent',
        surface: '#2A2A22',
        gold: '#C8A96E',
        goldDim: '#8A7248',
        green: '#2C4A28',
        greenBright: '#4A7A44',
        slate: '#1A1E16',
        slateLight: '#2E3428',
        wallL: '#1A1E14',
        wallR: '#141810',
      };

      const FLOORS = 8;
      const FW = 110;
      const FD = 80;
      const FH = 26;
      const FS = 3;
      const BUILD_DURATION = 4800;
      const IO_LOOP = 3200;

      const SUPPLY = [
        { id: 'cab1', label: 'Cabinet Door', shape: 'rect', w: 18, h: 24, color: '#8B6914', accent: '#C8A96E' },
        { id: 'cab2', label: 'Cabinet Face', shape: 'rect', w: 22, h: 18, color: '#7A5C10', accent: '#B8952A' },
        { id: 'sink', label: 'Sink', shape: 'oval', w: 20, h: 14, color: '#4A5568', accent: '#718096' },
        { id: 'tub', label: 'Tub', shape: 'tub', w: 28, h: 14, color: '#5A6475', accent: '#8896A8' },
        { id: 'win', label: 'Window', shape: 'window', w: 18, h: 22, color: '#2D4A6E', accent: '#4A7BA8' },
        { id: 'door', label: 'Int. Door', shape: 'door', w: 14, h: 26, color: '#6B4C2A', accent: '#A07840' },
        { id: 'floor', label: 'Flooring', shape: 'plank', w: 32, h: 10, color: '#8B6914', accent: '#D4A860' },
        { id: 'ctr', label: 'Countertop', shape: 'slab', w: 30, h: 10, color: '#E8DCC8', accent: '#F0EBE0' },
        { id: 'hw', label: 'Hardware', shape: 'circle', w: 10, h: 10, color: '#8896A8', accent: '#B8C8D8' },
      ];

      const OUTPUTS = [
        { id: 'kit', label: 'Kitchen Pkg', color: '#3D5C3A', accent: '#6B9E65' },
        { id: 'bath', label: 'Bath Pkg', color: '#2D4A6E', accent: '#4A7BA8' },
        { id: 'full', label: 'Full Unit', color: '#C8A96E', accent: '#F0D090' },
      ];

      let phase = 'build';
      let buildProgress = 0;
      let windowsVisible = false;
      let roofVisible = false;
      let ioElapsed = 0;
      const buildStart = Date.now();
      let ioStart = 0;
      let dpr = window.devicePixelRatio || 1;

      function resize() {
        dpr = window.devicePixelRatio || 1;
        const r = stage.getBoundingClientRect();
        canvas.width = r.width * dpr;
        canvas.height = r.height * dpr;
        canvas.style.width = r.width + 'px';
        canvas.style.height = r.height + 'px';
      }

      resize();
      window.addEventListener('resize', resize);
      cleanupResize = () => window.removeEventListener('resize', resize);

      const c30 = 0.866;
      const s30 = 0.5;
      const ix = (x, z) => (x - z) * c30;
      const iy = (x, y, z) => (x + z) * s30 - y;

      function topFace(cx, cy, x, y, z, w, d) {
        return [
          [cx + ix(x, z), cy + iy(x, y, z)],
          [cx + ix(x + w, z), cy + iy(x + w, y, z)],
          [cx + ix(x + w, z + d), cy + iy(x + w, y, z + d)],
          [cx + ix(x, z + d), cy + iy(x, y, z + d)],
        ];
      }

      function leftFace(cx, cy, x, y, z, w, d, h) {
        return [
          [cx + ix(x, z + d), cy + iy(x, y, z + d)],
          [cx + ix(x + w, z + d), cy + iy(x + w, y, z + d)],
          [cx + ix(x + w, z + d), cy + iy(x + w, y - h, z + d)],
          [cx + ix(x, z + d), cy + iy(x, y - h, z + d)],
        ];
      }

      function rightFace(cx, cy, x, y, z, w, d, h) {
        return [
          [cx + ix(x + w, z), cy + iy(x + w, y, z)],
          [cx + ix(x + w, z + d), cy + iy(x + w, y, z + d)],
          [cx + ix(x + w, z + d), cy + iy(x + w, y - h, z + d)],
          [cx + ix(x + w, z), cy + iy(x + w, y - h, z)],
        ];
      }

      function poly(ctx, pts, fill, stroke, sw, alpha) {
        ctx.save();
        if (alpha != null) ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath();
        if (fill) {
          ctx.fillStyle = fill;
          ctx.fill();
        }
        if (stroke) {
          ctx.strokeStyle = stroke;
          ctx.lineWidth = sw || 0.5;
          ctx.stroke();
        }
        ctx.restore();
      }

      function ha(hex, a) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
      }

      function rr(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
      }

      function drawShape(ctx, item, px, py, scale, alpha) {
        ctx.save();
        ctx.globalAlpha = alpha != null ? alpha : 1;
        ctx.translate(px, py);
        ctx.scale(scale, scale);
        const w = item.w;
        const h = item.h;
        const c = item.color;
        const a = item.accent;
        const s = item.shape;

        if (s === 'rect' || s === 'door') {
          rr(ctx, -w / 2, -h / 2, w, h, 1);
          ctx.fillStyle = c;
          ctx.fill();
          ctx.strokeStyle = a;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          if (s === 'door') {
            ctx.fillStyle = a;
            ctx.fillRect(-1, -h * 0.1, 2, h * 0.4);
          } else {
            ctx.save();
            ctx.globalAlpha *= 0.5;
            ctx.strokeStyle = a;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(-w / 2 + 2, -h / 2 + 2);
            ctx.lineTo(w / 2 - 2, -h / 2 + 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(-w / 2 + 2, h / 2 - 2);
            ctx.lineTo(w / 2 - 2, h / 2 - 2);
            ctx.stroke();
            ctx.restore();
          }
        } else if (s === 'oval') {
          ctx.beginPath();
          ctx.ellipse(0, 0, w / 2 - 1, h / 2 - 1, 0, 0, Math.PI * 2);
          ctx.fillStyle = c;
          ctx.fill();
          ctx.strokeStyle = a;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.save();
          ctx.globalAlpha *= 0.6;
          ctx.beginPath();
          ctx.ellipse(0, 0, w / 4, h / 4, 0, 0, Math.PI * 2);
          ctx.strokeStyle = a;
          ctx.lineWidth = 0.8;
          ctx.stroke();
          ctx.restore();
        } else if (s === 'window') {
          rr(ctx, -w / 2, -h / 2, w, h, 1);
          ctx.fillStyle = c;
          ctx.fill();
          ctx.strokeStyle = a;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.strokeStyle = a;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(0, -h / 2 + 2);
          ctx.lineTo(0, h / 2 - 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(-w / 2 + 2, 0);
          ctx.lineTo(w / 2 - 2, 0);
          ctx.stroke();
        } else if (s === 'plank') {
          rr(ctx, -w / 2, -h / 2, w, h, 1);
          ctx.fillStyle = c;
          ctx.fill();
          ctx.strokeStyle = a;
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.save();
          ctx.globalAlpha *= 0.4;
          ctx.strokeStyle = a;
          ctx.lineWidth = 0.4;
          ctx.beginPath();
          ctx.moveTo(-w / 6, -h / 2 + 1);
          ctx.lineTo(-w / 6, h / 2 - 1);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(w / 6, -h / 2 + 1);
          ctx.lineTo(w / 6, h / 2 - 1);
          ctx.stroke();
          ctx.restore();
        } else if (s === 'slab') {
          rr(ctx, -w / 2, -h / 2, w, h, 1);
          ctx.fillStyle = c;
          ctx.fill();
          ctx.strokeStyle = a;
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.save();
          ctx.globalAlpha *= 0.15;
          rr(ctx, -w / 2 + 2, -h / 2 + 2, w - 4, h - 4, 1);
          ctx.fillStyle = a;
          ctx.fill();
          ctx.restore();
        } else if (s === 'tub') {
          rr(ctx, -w / 2, -h * 0.1, w, h * 0.65, 3);
          ctx.fillStyle = c;
          ctx.fill();
          ctx.strokeStyle = a;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.save();
          ctx.globalAlpha *= 0.15;
          ctx.beginPath();
          ctx.ellipse(0, h * 0.15, w / 2 - 4, h * 0.2, 0, 0, Math.PI * 2);
          ctx.fillStyle = a;
          ctx.fill();
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, w / 2 - 1, 0, Math.PI * 2);
          ctx.fillStyle = c;
          ctx.fill();
          ctx.strokeStyle = a;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        ctx.restore();
        ctx.save();
        ctx.globalAlpha = (alpha || 1) * 0.85;
        ctx.translate(px, py + (item.h / 2) * scale + 7 * scale);
        ctx.fillStyle = item.accent;
        ctx.font = 'bold ' + 7 * scale + 'px "DM Mono",monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(item.label, 0, 0);
        ctx.restore();
      }

      function drawCube(ctx, item, px, py, sc, alpha) {
        const S = 40 * sc;
        const W = S;
        const D = S;
        const H = S * 0.7;
        const lf = [
          [px + ix(0, D), py + iy(0, H, D)],
          [px + ix(W, D), py + iy(W, H, D)],
          [px + ix(W, D), py + iy(W, 0, D)],
          [px + ix(0, D), py + iy(0, 0, D)],
        ];
        const rf = [
          [px + ix(W, 0), py + iy(W, H, 0)],
          [px + ix(W, D), py + iy(W, H, D)],
          [px + ix(W, D), py + iy(W, 0, D)],
          [px + ix(W, 0), py + iy(W, 0, 0)],
        ];
        const tp = [
          [px + ix(0, 0), py + iy(0, H, 0)],
          [px + ix(W, 0), py + iy(W, H, 0)],
          [px + ix(W, D), py + iy(W, H, D)],
          [px + ix(0, D), py + iy(0, H, D)],
        ];
        ctx.save();
        ctx.globalAlpha = alpha || 1;
        poly(ctx, lf, item.color, item.accent, 1);
        poly(ctx, rf, ha(item.color, 0.7), item.accent, 1);
        poly(ctx, tp, ha(item.accent, 0.4), item.accent, 1);
        ctx.fillStyle = item.accent;
        ctx.font = 'bold ' + 5.5 * sc + 'px "DM Mono",monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.label, (lf[0][0] + lf[1][0]) / 2, (lf[0][1] + lf[2][1]) / 2 - H * 0.1);
        ctx.restore();
      }

      function render() {
        const ctx = canvas.getContext('2d');
        const cw = canvas.width;
        const ch = canvas.height;
        ctx.clearRect(0, 0, cw, ch);
        ctx.save();
        ctx.scale(dpr, dpr);
        const vw = cw / dpr;
        const vh = ch / dpr;

        const sc = Math.min(vw, vh) < 400 ? 0.58 : 0.78;
        const bW = FW * sc;
        const bD = FD * sc;
        const bH = FH * sc;
        const bS = FS * sc;
        const cx = vw * 0.5 - ix(bW, bD) * 0.5 - ix(0, bD) * 0.5;
        const cy = vh * 0.64;

        poly(ctx, topFace(cx, cy, -6 * sc, 0, -6 * sc, bW + 12 * sc, bD + 12 * sc), T.surface, T.slate, 0.8);

        const floorsN = Math.floor(buildProgress * FLOORS);
        const partial = (buildProgress * FLOORS) % 1;

        for (let f = 0; f < floorsN; f += 1) {
          const yB = f * (bH + bS);
          poly(ctx, leftFace(cx, cy, 0, yB + bH, 0, bW, bD, bH), T.wallL, T.slate, 0.5);
          poly(ctx, rightFace(cx, cy, 0, yB + bH, 0, bW, bD, bH), T.wallR, T.slate, 0.5);
          poly(ctx, topFace(cx, cy, 0, yB + bH + bS, 0, bW, bD), T.slateLight, T.slate, 0.5);

          if (windowsVisible) {
            [0.22, 0.5, 0.78].forEach((wx) => {
              const px = cx + ix(bW * wx, bD) - 3.5 * sc;
              const py = cy + iy(bW * wx, yB + bH * 0.38, bD);
              ctx.save();
              ctx.globalAlpha = 0.28;
              ctx.fillStyle = T.goldDim;
              ctx.fillRect(px, py, 8 * sc, bH * 0.4);
              ctx.restore();
            });

            [0.28, 0.68].forEach((wz) => {
              const px = cx + ix(bW, bD * wz) - 4 * sc;
              const py = cy + iy(bW, yB + bH * 0.32, bD * wz);
              ctx.save();
              ctx.globalAlpha = 0.2;
              ctx.fillStyle = T.goldDim;
              ctx.fillRect(px, py, 7 * sc, bH * 0.4);
              ctx.restore();
            });
          }
        }

        if (floorsN < FLOORS && partial > 0) {
          const fb = floorsN * (bH + bS);
          const ph = bH * partial;
          poly(ctx, leftFace(cx, cy, 0, fb + ph, 0, bW, bD, ph), T.wallL, T.slate, 0.5, partial);
          poly(ctx, rightFace(cx, cy, 0, fb + ph, 0, bW, bD, ph), T.wallR, T.slate, 0.5, partial);
          poly(ctx, topFace(cx, cy, 0, fb + ph + bS, 0, bW, bD), T.slateLight, T.slate, 0.5, partial);
        }

        if (roofVisible) {
          const ry = FLOORS * (bH + bS) + bS;
          poly(ctx, topFace(cx, cy, -2 * sc, ry + 2, -2 * sc, bW + 4 * sc, bD + 4 * sc), T.green, T.greenBright, 1);
          poly(ctx, topFace(cx, cy, 0, ry, 0, bW, bD), T.slateLight, T.slate, 0.5);
        }

        if (phase === 'build') {
          ctx.fillStyle = 'rgba(0,0,0,0.1)';
          ctx.fillRect(0, vh - 3, vw, 3);
          ctx.fillStyle = T.gold;
          ctx.fillRect(0, vh - 3, vw * buildProgress, 3);
          ctx.save();
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.globalAlpha = 1;
          ctx.font = '700 8px "DM Mono",monospace';
          ctx.textAlign = 'center';
          ctx.fillText('CONSTRUCTING ' + Math.round(buildProgress * 100) + '%', vw * 0.5, vh - 10);
          ctx.restore();
        }

        if (phase === 'io') {
          const bCX = cx + ix(bW, bD) * 0.5;
          const bCY = cy - FLOORS * (bH + bS) * 0.5;

          SUPPLY.forEach((item, i) => {
            const offset = i / SUPPLY.length;
            const raw = (ioElapsed - offset + 100) % 1;
            const progress = raw < 0.5 ? raw * 2 : 0;
            if (progress <= 0 || progress >= 1) return;

            const sy = bCY - 18 + Math.sin(offset * 5) * (vh * 0.2);
            const px = -50 + (bCX - 28 - -50) * progress;
            const py = sy + (bCY - sy) * progress;
            const psc = (1 - progress * 0.72) * sc * 1.1;
            const al = progress < 0.85 ? 1 : 1 - (progress - 0.85) / 0.15;
            drawShape(ctx, item, px, py, psc, al);
          });

          OUTPUTS.forEach((item, i) => {
            const progress = (ioElapsed - i * 0.33 + 100) % 1;
            if (progress < 0.05 || progress > 0.95) return;
            const px = bCX + 18 + progress * (vw * 0.26);
            const py = bCY + 8 + progress * (vh * 0.24) + i * 16;
            const al = progress < 0.15 ? progress / 0.15 : progress > 0.8 ? 1 - (progress - 0.8) / 0.2 : 1;
            drawCube(ctx, item, px, py, sc * 0.88, al);
          });

          ctx.save();
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.globalAlpha = 0.7;
          ctx.font = '700 8px "DM Mono",monospace';
          ctx.textAlign = 'center';
          ctx.fillText('MATERIALS IN  ·  UNITS OUT', vw * 0.5, vh - 14);
          ctx.restore();
        }

        ctx.restore();
      }

      function tick() {
        const now = Date.now();
        const elapsed = now - buildStart;

        if (phase === 'build') {
          buildProgress = Math.min(elapsed / BUILD_DURATION, 1);
          if (buildProgress > 0.6) windowsVisible = true;
          if (buildProgress >= 1 && !roofVisible) {
            roofVisible = true;
            setTimeout(() => {
              phase = 'io';
              ioStart = Date.now();
            }, 700);
          }
        } else if (phase === 'io') {
          ioElapsed = (now - ioStart) / IO_LOOP;
        }

        render();
        raf = requestAnimationFrame(tick);
      }

      raf = requestAnimationFrame(tick);
    })();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      cleanupResize();
      navTrigger.kill();
      tl.kill();
      ScrollTrigger.getAll().forEach((st) => st.kill());
    };
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: PAGE_HTML }} />;
}
