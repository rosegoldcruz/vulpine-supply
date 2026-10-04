/**
 * Which "View in your space" experience a device gets. Tiny and three-free so it runs (synchronously) as soon as the
 * page hydrates.
 *
 *   camera       phone / tablet with a camera API (iPhone Safari, Android Chrome...): the in-page camera AR studio
 *   desktop      non-touch desktop / laptop: QR code to open the design on a phone (or try the webcam)
 *   unsupported  a phone without camera access (insecure context, very old browser): explain
 * WebXR immersive-ar (Android + ARCore) is an extra, in-page true-scale mode inside the studio (see hasWebXrAr).
 */
export type ArPath = 'camera' | 'desktop' | 'unsupported';

export interface DeviceInfo {
  ios: boolean;
  android: boolean;
  /** primary input is touch (no fine pointer at all) */
  touchOnly: boolean;
  mobile: boolean;
  camera: boolean;
}

export function deviceInfo(): DeviceInfo {
  if (typeof navigator === 'undefined') return { ios: false, android: false, touchOnly: false, mobile: false, camera: false };
  const ua = navigator.userAgent || '';
  const touchPoints = navigator.maxTouchPoints || 0;
  const mq = (q: string) => (typeof matchMedia === 'function' ? matchMedia(q).matches : false);
  // iPadOS 13+ Safari and Chrome report a Mac UA; real Macs report 0 touch points (iPads 5)
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh|MacIntel/.test(ua + (navigator.platform || '')) && touchPoints > 0);
  const android = /Android/i.test(ua);
  const touchOnly = (touchPoints > 0 || mq('(any-pointer: coarse)')) && !mq('(any-pointer: fine)');
  const uaMobile = Boolean((navigator as any).userAgentData?.mobile) || /Mobi|Tablet|Silk|Kindle|Opera Mini|IEMobile/i.test(ua);
  const camera = typeof window !== 'undefined' && window.isSecureContext !== false && typeof navigator.mediaDevices?.getUserMedia === 'function';
  return { ios, android, touchOnly, mobile: ios || android || uaMobile || touchOnly, camera };
}

export function arPath(d = deviceInfo()): ArPath {
  if (!d.mobile) return 'desktop';
  return d.camera ? 'camera' : 'unsupported';
}

/** Android Chrome with ARCore: WebXR immersive-ar is available (true-scale, 6DoF, still in the page). */
export async function hasWebXrAr(): Promise<boolean> {
  const xr = (navigator as any).xr;
  if (!xr?.isSessionSupported) return false;
  try {
    return Boolean(await xr.isSessionSupported('immersive-ar'));
  } catch {
    return false; // blocked by permissions policy / insecure context
  }
}

/**
 * Starts the camera + (iOS) motion permission prompts. Call directly from the tap: iOS only shows the
 * DeviceOrientation prompt inside a user gesture.
 */
export function requestArPermissions(): { stream: Promise<MediaStream | null>; motion: Promise<string> } {
  const DOE = (typeof window !== 'undefined' ? (window as any).DeviceOrientationEvent : undefined) as { requestPermission?: () => Promise<string> } | undefined;
  const motion: Promise<string> =
    typeof DOE?.requestPermission === 'function' ? DOE.requestPermission().catch(() => 'denied') : Promise.resolve(DOE ? 'granted' : 'unsupported');
  const stream: Promise<MediaStream | null> = navigator.mediaDevices
    ? navigator.mediaDevices
        .getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
        .catch((e) => {
          console.warn('[ar] camera unavailable', e);
          return null;
        })
    : Promise.resolve(null);
  return { stream, motion };
}
