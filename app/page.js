import HomePageClient from '../components/HomePageClient';
import JsonLd from '../components/JsonLd';

export const metadata = {
  title: 'Vulpine Homes | Cabinet & Interior Finish Supply - Arizona',
  description:
    'Vulpine Homes supplies cabinet boxes, doors, refacing fronts, countertops, vanities, flooring, hardware, interior doors, and finish materials for residential and multifamily projects across Arizona.',
  alternates: {
    canonical: '/',
  },
};

const homeBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': ['LocalBusiness', 'Organization'],
  name: 'Vulpine Homes',
  url: 'https://vulpinehomes.com',
  logo: 'https://vulpinehomes.com/logo.png',
  description:
    'Cabinet and interior finish supply for residential and multifamily projects in Arizona.',
  address: {
    '@type': 'PostalAddress',
    addressRegion: 'AZ',
    addressCountry: 'US',
  },
  areaServed: 'Arizona',
  sameAs: [],
};

export default function Page() {
  return (
    <>
      <JsonLd schema={homeBusinessSchema} />
      <HomePageClient />
    </>
  );
}
