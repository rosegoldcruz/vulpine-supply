/**
 * Vulpi's page walk. Moves the whole guide (fox + bubble + tools) along the bottom of the viewport with a
 * CSS transform, plays the in-place `walk` clip while moving, turns him to face the direction of travel,
 * and stops to idle (or point) near key UI: anything marked `data-fox-stop`, or a visible "Request a quote" link.
 * Only runs while he is awake and not talking/chatting, never with prefers-reduced-motion. See docs/fox.md.
 */
import { FoxStage } from './stage';

const SPEED = 70; // px/s, matches the 1.07 s walk cycle at the corner size
const MOBILE_SPEED = 45;
const EDGE = 18; // keep in sync with .root right offset
const STOPS = '[data-fox-stop], a[href*="request-bid"]';

export class FoxWalker {
  private x = 0; // translateX in px (0 = home corner, negative = toward screen left)
  private target = 0;
  private walking = false;
  private pauseUntil = 0;
  private atStop = false;
  private raf = 0;
  private last = 0;

  constructor(
    private root: HTMLElement,
    private stage: FoxStage,
    private isBusy: () => boolean,
  ) {
    this.pauseUntil = performance.now() + 4000;
    this.raf = requestAnimationFrame(this.tick);
  }

  /** Leftmost offset that keeps the whole guide (including an open bubble/chat) on screen. */
  private minX() {
    return -Math.max(0, window.innerWidth - this.root.offsetWidth - EDGE * 2);
  }

  private pickTarget(now: number) {
    const min = this.minX();
    if (min > -40) return; // no room to walk
    const rootW = this.root.offsetWidth;
    const homeCenter = window.innerWidth - EDGE - rootW / 2;
    const stops = Array.from(document.querySelectorAll<HTMLElement>(STOPS))
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.bottom > 0 && r.top < window.innerHeight);
    this.atStop = false;
    if (stops.length && Math.random() < 0.4) {
      const r = stops[Math.floor(Math.random() * stops.length)];
      this.target = Math.max(min, Math.min(0, r.left + r.width / 2 - homeCenter + rootW * 0.6));
      this.atStop = true;
    } else if (this.x < min * 0.6 && Math.random() < 0.5) {
      this.target = 0; // head back home now and then
    } else {
      this.target = min * (0.1 + Math.random() * 0.9);
    }
    if (Math.abs(this.target - this.x) < 30) {
      this.pauseUntil = now + 3000;
      return;
    }
    this.walking = true;
    this.stage.face(this.target < this.x ? -Math.PI / 2 : Math.PI / 2);
    this.stage.play('walk');
  }

  private arrive(now: number) {
    this.walking = false;
    this.stage.face(FoxStage.REST_YAW);
    if (this.atStop && Math.random() < 0.6) this.stage.play('point');
    else this.stage.play('idle');
    this.pauseUntil = now + 5000 + Math.random() * 7000;
  }

  private tick = (now: number) => {
    this.raf = requestAnimationFrame(this.tick);
    const dt = Math.min(0.1, (now - (this.last || now)) / 1000);
    this.last = now;
    const min = this.minX();
    if (this.isBusy()) {
      if (this.walking) {
        this.walking = false;
        this.stage.face(FoxStage.REST_YAW); // the guide has already started its own move (talk/wave)
      }
      // keep a growing bubble/chat on screen: glide back in
      if (this.x < min) this.apply(Math.min(min, this.x + 600 * dt));
      this.pauseUntil = now + 4000;
      return;
    }
    if (this.x < min) this.target = Math.max(this.target, min);
    if (!this.walking) {
      if (now >= this.pauseUntil) this.pickTarget(now);
      return;
    }
    const speed = window.innerWidth <= 700 ? MOBILE_SPEED : SPEED;
    const d = this.target - this.x;
    const step = Math.sign(d) * Math.min(Math.abs(d), speed * dt);
    this.apply(this.x + step);
    if (Math.abs(this.target - this.x) < 0.5) this.arrive(now);
  };

  private apply(x: number) {
    this.x = x;
    this.root.style.transform = x ? `translate3d(${x.toFixed(1)}px,0,0)` : '';
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    if (this.walking) this.stage.play('idle');
    this.stage.face(FoxStage.REST_YAW);
    this.root.style.transform = '';
  }
}
