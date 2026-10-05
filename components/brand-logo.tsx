import { cn } from '@/lib/utils';

interface BrandLogoProps {
  className?: string;
  width?: number;
  height?: number;
  variant?: 'brand' | 'watermark';
}

/** Vulpine wordmark, matching the site nav ("Vulpine" + orange dot). */
export function BrandLogo({ className, width = 40, height = 40, variant = 'brand' }: BrandLogoProps) {
  return (
    <span
      className={cn(className)}
      aria-label="Vulpine Homes"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: width,
        height,
        fontFamily: "'DM Sans', sans-serif",
        fontWeight: 700,
        fontSize: Math.round(height * 0.42),
        letterSpacing: '-0.02em',
        color: variant === 'watermark' ? 'rgba(17,17,17,0.12)' : 'var(--white, #f5f0eb)',
      }}
    >
      Vulpine<span style={{ color: 'var(--orange, #ee7200)' }}>.</span>
    </span>
  );
}
