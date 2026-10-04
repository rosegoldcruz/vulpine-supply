/**
 * Which "View in your space" path a device gets. Tiny and three-free so it runs (synchronously) as soon as the page
 * hydrates, never waiting on the 3D bundle.
 *
 *   quicklook          iPhone / iPad (incl. iPadOS that reports as "Macintosh"): AR Quick Look with a USDZ
 *   webxr              Android Chrome with ARCore: immersive-ar WebXR session (the live configured model)
 *   sceneviewer        Android without WebXR AR: Google Scene Viewer intent with a server-built GLB of the design
 *   mobile-unsupported a phone/tablet with no AR path: explain (never the desktop QR)
 *   desktop            genuinely non-touch desktop/laptop: QR code to open the design on a phone
 */
export type ArPath = 'quicklook' | 'webxr' | 'sceneviewer' | 'mobile-unsupported' | 'desktop';

export interface DeviceInfo {
  ios: boolean;
  android: boolean;
  /** primary input is touch (no fine pointer at all) */
  touchOnly: boolean;
  mobile: boolean;
  /** <a rel="ar"> is supported, or an iOS browser that hands rel=ar to Quick Look */
  quickLook: boolean;
}

export function deviceInfo(): DeviceInfo {
  if (typeof navigator === 'undefined') return { ios: false, android: false, touchOnly: false, mobile: false, quickLook: false };
  const ua = navigator.userAgent || '';
  const touchPoints = navigator.maxTouchPoints || 0;
  const mq = (q: string) => (typeof matchMedia === 'function' ? matchMedia(q).matches : false);
  // iPadOS 13+ Safari and Chrome report a Mac UA; real Macs report 0 touch points (iPads 5)
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh|MacIntel/.test(ua + (navigator.platform || '')) && touchPoints > 0);
  const android = /Android/i.test(ua);
  const touchOnly = (touchPoints > 0 || mq('(any-pointer: coarse)')) && !mq('(any-pointer: fine)');
  const uaMobile = Boolean((navigator as any).userAgentData?.mobile) || /Mobi|Tablet|Silk|Kindle|Opera Mini|IEMobile/i.test(ua);
  let relAr = false;
  try {
    relAr = Boolean(document.createElement('a').relList?.supports?.('ar'));
  } catch {
    /* relList.supports throws on some engines */
  }
  // Chrome/Edge/Firefox/Google app on iOS run in WKWebView, where relList doesn't report 'ar' but Quick Look still opens
  const iosOtherBrowser = ios && /CriOS\/|EdgiOS\/|FxiOS\/|GSA\/|DuckDuckGo\//.test(ua);
  return { ios, android, touchOnly, mobile: ios || android || uaMobile || touchOnly, quickLook: ios && (relAr || iosOtherBrowser) };
}

/** Immediate answer from the UA/touch signals; Android starts as 'sceneviewer' until WebXR support is known. */
export function initialArPath(d = deviceInfo()): ArPath {
  if (d.ios) return d.quickLook ? 'quicklook' : 'mobile-unsupported';
  if (d.android) return 'sceneviewer';
  if (d.mobile) return 'mobile-unsupported';
  return 'desktop';
}

/** Full answer: Android upgrades to WebXR when immersive-ar is supported. */
export async function detectArPath(): Promise<ArPath> {
  const d = deviceInfo();
  const base = initialArPath(d);
  if (base === 'desktop' || base === 'quicklook') return base;
  const xr = (navigator as any).xr;
  if (xr?.isSessionSupported) {
    try {
      if (await xr.isSessionSupported('immersive-ar')) return 'webxr';
    } catch {
      /* blocked by permissions policy / insecure context */
    }
  }
  return base;
}

/**
 * Scene Viewer intent (ARCore). `ar_preferred` falls back to Scene Viewer's 3D viewer when ARCore is missing;
 * if the Google app isn't installed Chrome opens `fallbackUrl` instead.
 */
export function sceneViewerIntent(glbUrl: string, title: string, fallbackUrl: string): string {
  const params = new URLSearchParams({ file: glbUrl, mode: 'ar_preferred', resizable: 'false', title });
  return (
    `intent://arvr.google.com/scene-viewer/1.0?${params.toString()}` +
    `#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;` +
    `S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end;`
  );
}
