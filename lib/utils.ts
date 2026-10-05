type ClassValue = string | number | false | null | undefined | ClassValue[] | Record<string, boolean | null | undefined>;

/** Tiny classnames helper (no Tailwind in this repo, so no tailwind-merge). */
export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  const walk = (v: ClassValue) => {
    if (!v) return;
    if (Array.isArray(v)) v.forEach(walk);
    else if (typeof v === 'object') Object.entries(v).forEach(([k, on]) => on && out.push(k));
    else out.push(String(v));
  };
  inputs.forEach(walk);
  return out.join(' ');
}
