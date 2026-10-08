'use client';

import { useEffect } from 'react';
import VulpineHomesHero from './scroll-hero/VulpineHomesHero';
import SiteNav from './SiteNav';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import MaterialSupplyGrid from './MaterialSupplyGrid';
import MaterialMarquee from './MaterialMarquee';
import { SMS_CONSENT_TEXT } from '../lib/sms-consent';

  const PAGE_HTML_AFTER_SUPPLY = `
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
    <form class="bid-form reveal" action="/api/request-bid" method="post" data-contact-form novalidate>
      <div class="form-group"><label class="form-label" for="fname">First &amp; Last Name</label><input class="form-input" type="text" id="fname" name="name" placeholder="Jordan Mercer" required></div>
      <div class="form-group"><label class="form-label" for="femail">Email</label><input class="form-input" type="email" id="femail" name="email" placeholder="jordan@company.com" required></div>
      <div class="form-group"><label class="form-label" for="fphone">Phone</label><input class="form-input" type="tel" id="fphone" name="phone" placeholder="(555) 000-0000"></div>
      <div class="form-group"><label class="form-label" for="fcompany">Company</label><input class="form-input" type="text" id="fcompany" name="company" placeholder="Vulpine Builders"></div>
      <div class="form-group">
        <label class="form-label" for="ftype">Project Type</label>
        <select class="form-select" id="ftype" name="project_type" required>
          <option value="">Select a project type</option>
          <option value="Multifamily / Unit Turn">Multifamily / Unit Turn</option>
          <option value="multifamily">Multifamily / Apartment</option>
          <option value="single-family">Single-Family Renovation</option>
          <option value="investor-flip">Investor Flip / Rental Refresh</option>
          <option value="new-build">New Build</option>
          <option value="contractor">Contractor Supply Relationship</option>
          <option value="privacy-legal">Privacy / Legal Request</option>
        </select>
      </div>
      <div class="form-group full"><label class="form-label" for="flocation">Project Location</label><input class="form-input" type="text" id="flocation" name="project_location" placeholder="City, community, or property address"></div>
      <div class="form-group full"><label class="form-label" for="fmessage">Project Details</label><textarea class="form-textarea" id="fmessage" name="message" placeholder="Tell us about the scope — unit count, material categories you need, timeline, location..." required></textarea></div>
      <div class="form-consent">
        <input type="checkbox" id="fsmsconsent" name="sms_consent">
        <label class="form-consent-label" for="fsmsconsent">${SMS_CONSENT_TEXT}</label>
      </div>
      <p class="form-legal">Calls and texts are optional; consent is not a condition of purchase. See our <a href="/terms#sms">Terms</a> and <a href="/privacy">Privacy Policy</a>.</p>
      <button type="submit" class="form-submit">Send Request</button>
      <div aria-live="polite" role="status" data-contact-status></div>
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
    <li><a href="/visualizer">Visualizer</a></li>
    <li><a href="#contact">Request a Bid</a></li>
    <li><a href="/terms">Terms</a></li>
    <li><a href="/privacy">Privacy</a></li>
  </ul>
  <div class="footer-copy">© 2026 Vulpine Homes. All rights reserved.</div>
</footer>
`;

export default function HomePageClient() {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const tl = gsap.timeline();
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
    let cleanupContactForm = () => {};

    const contactForm = document.querySelector('[data-contact-form]');
    const contactStatus = document.querySelector('[data-contact-status]');

    if (contactForm) {
      const handleContactSubmit = async (event) => {
        event.preventDefault();

        const submitButton = contactForm.querySelector('button[type="submit"]');
        const formData = new FormData(contactForm);

        if (contactStatus) contactStatus.innerHTML = '';

        const smsConsent = formData.get('sms_consent') === 'on';

        const params = new URLSearchParams(window.location.search);
        const pageUrl = `${window.location.origin}${window.location.pathname}#contact`;
        const payload = {
          source: 'Homepage #contact',
          pageUrl,
          name: String(formData.get('name') || '').trim(),
          email: String(formData.get('email') || '').trim(),
          phone: String(formData.get('phone') || '').trim(),
          company: String(formData.get('company') || '').trim(),
          projectType: String(formData.get('project_type') || '').trim(),
          projectLocation: String(formData.get('project_location') || '').trim(),
          projectDetails: String(formData.get('message') || '').trim(),
          utm_source: params.get('utm_source') || '',
          utm_medium: params.get('utm_medium') || '',
          utm_campaign: params.get('utm_campaign') || '',
          utm_content: params.get('utm_content') || '',
          utm_term: params.get('utm_term') || '',
          smsConsent,
          smsConsentText: smsConsent ? SMS_CONSENT_TEXT : null,
          smsConsentTimestamp: smsConsent ? new Date().toISOString() : null,
          smsConsentSource: smsConsent ? pageUrl : null,
        };

        if (submitButton) {
          submitButton.disabled = true;
          submitButton.textContent = 'Sending...';
        }

        try {
          const response = await fetch('/api/request-bid', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });
          const data = await response.json().catch(() => null);

          if (!response.ok || !data?.ok) {
            throw new Error(data?.error || 'Request failed');
          }

          contactForm.reset();
          window.location.assign('/thank-you?source=homepage-contact');
        } catch (error) {
          if (contactStatus) {
            const message = document.createElement('p');
            message.className = 'section-body';
            message.textContent = error.message;
            contactStatus.replaceChildren(message);
          }
        } finally {
          if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Send Request';
          }
        }
      };

      contactForm.addEventListener('submit', handleContactSubmit);
      cleanupContactForm = () => contactForm.removeEventListener('submit', handleContactSubmit);
    }



    return () => {
      if (raf) cancelAnimationFrame(raf);
      cleanupContactForm();
      cleanupResize();
      navTrigger.kill();
      tl.kill();
      ScrollTrigger.getAll().forEach((st) => st.kill());
    };
  }, []);

  return (
    <>
      <SiteNav />
      <VulpineHomesHero />
      <MaterialMarquee />
      <section id="supply">
        <span className="section-label reveal">What We Supply</span>
        <h2 className="section-heading reveal">Every material category. One supply partner.</h2>
        <p className="section-body reveal">
          Cabinet boxes, doors, drawer fronts, refacing fronts, countertops, sinks, vanities,
          flooring, hardware, trim, and interior finish materials for residential and multifamily
          projects.
        </p>

        <MaterialSupplyGrid />
      </section>
      <div dangerouslySetInnerHTML={{ __html: PAGE_HTML_AFTER_SUPPLY }} />
    </>
  );
}
