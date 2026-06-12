import './globals.css';
import Script from 'next/script';

export const metadata = {
  title: {
    default: 'Vulpine Homes | Cabinet & Interior Finish Supply - Arizona',
    template: '%s | Vulpine Homes',
  },
  description:
    'Vulpine Homes supplies cabinet boxes, doors, drawer fronts, refacing fronts, countertops, sinks, vanities, flooring, hardware, and interior finish materials for residential and multifamily projects in Arizona.',
  keywords: [
    'cabinet supply arizona',
    'interior finish supply',
    'multifamily cabinet supply',
    'refacing fronts',
    'cabinet boxes wholesale',
    'countertops arizona',
    'vulpine homes',
  ],
  metadataBase: new URL('https://vulpinehomes.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://vulpinehomes.com',
    siteName: 'Vulpine Homes',
    title: 'Vulpine Homes | Cabinet & Interior Finish Supply - AZ',
    description:
      'Vulpine Homes supplies cabinet and interior finish materials for residential and multifamily projects in Arizona.',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Vulpine Homes cabinet and interior finish supply box image',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vulpine Homes | Cabinet & Interior Finish Supply - AZ',
    description:
      'Vulpine Homes supplies cabinet and interior finish materials for residential and multifamily projects in Arizona.',
    images: ['/og-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ?? '',
  },
};

export default function RootLayout({ children }) {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Serif+Display&family=DM+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        {gaId ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', '${gaId}');`}
            </Script>
          </>
        ) : null}
      </head>
      <body>{children}</body>
    </html>
  );
}
