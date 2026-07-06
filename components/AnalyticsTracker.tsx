'use client';

import { useEffect } from 'react';

const VISITOR_ID_KEY = 'vulpine_supply_visitor_id';

function getVisitorId(): string {
  const existing = window.localStorage.getItem(VISITOR_ID_KEY);
  if (existing) return existing;

  const id = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(VISITOR_ID_KEY, id);
  return id;
}

function getDeviceType(): string {
  const userAgent = window.navigator.userAgent.toLowerCase();
  const width = window.innerWidth;

  if (/ipad|tablet/.test(userAgent) || (width >= 768 && width <= 1024 && /mobile/.test(userAgent))) {
    return 'tablet';
  }

  if (/mobi|android|iphone|ipod/.test(userAgent) || width < 768) {
    return 'mobile';
  }

  return 'desktop';
}

function sendEvent(eventType: 'page_view' | 'contact_section_view') {
  const params = new URLSearchParams(window.location.search);

  fetch('/api/analytics/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({
      path: window.location.pathname,
      href: window.location.href,
      referrer: document.referrer,
      utmSource: params.get('utm_source') || '',
      utmMedium: params.get('utm_medium') || '',
      utmCampaign: params.get('utm_campaign') || '',
      eventType,
      deviceType: getDeviceType(),
      visitorId: getVisitorId(),
    }),
  }).catch(() => {});
}

export default function AnalyticsTracker() {
  useEffect(() => {
    sendEvent('page_view');

    if (window.location.hash === '#contact') {
      sendEvent('contact_section_view');
    }

    const handleContactClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest('a[href$="#contact"]') : null;
      if (target) sendEvent('contact_section_view');
    };

    window.addEventListener('hashchange', () => {
      if (window.location.hash === '#contact') sendEvent('contact_section_view');
    });
    document.addEventListener('click', handleContactClick);

    return () => {
      document.removeEventListener('click', handleContactClick);
    };
  }, []);

  return null;
}