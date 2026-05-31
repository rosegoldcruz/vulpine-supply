import JsonLd from '../../components/JsonLd';

export const metadata = {
  title: 'Supply Categories - Cabinet, Countertop, Flooring, Finish Materials',
  description:
    'Browse Vulpine Homes supply categories for Arizona projects, including cabinet components, countertops, sinks, vanities, flooring, hardware, interior doors, trim, and complete material packages.',
  alternates: {
    canonical: '/supply',
  },
};

const itemListSchema = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Vulpine Homes Material Categories',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Cabinet Boxes' },
    { '@type': 'ListItem', position: 2, name: 'Cabinet Doors' },
    { '@type': 'ListItem', position: 3, name: 'Drawer Fronts' },
    { '@type': 'ListItem', position: 4, name: 'Refacing Fronts' },
    { '@type': 'ListItem', position: 5, name: 'Countertops' },
    { '@type': 'ListItem', position: 6, name: 'Sinks' },
    { '@type': 'ListItem', position: 7, name: 'Vanities' },
    { '@type': 'ListItem', position: 8, name: 'Flooring' },
    { '@type': 'ListItem', position: 9, name: 'Hardware' },
    { '@type': 'ListItem', position: 10, name: 'Interior Doors' },
    { '@type': 'ListItem', position: 11, name: 'Trim & Finish' },
    { '@type': 'ListItem', position: 12, name: 'Complete Packages' },
  ],
};

const categories = [
  'Cabinet Boxes',
  'Cabinet Doors',
  'Drawer Fronts',
  'Refacing Fronts',
  'Countertops',
  'Sinks',
  'Vanities',
  'Flooring',
  'Hardware',
  'Interior Doors',
  'Trim & Finish',
  'Complete Packages',
];

export default function SupplyPage() {
  return (
    <>
      <JsonLd schema={itemListSchema} />
      <nav>
        <a href="/" className="nav-logo">
          Vulpine<span>.</span>
        </a>
        <ul className="nav-links">
          <li>
            <a href="/supply">Supply Categories</a>
          </li>
          <li>
            <a href="/request-bid">Request a Bid</a>
          </li>
        </ul>
        <a href="/request-bid" className="nav-cta">
          Request a Bid
        </a>
      </nav>
      <main>
        <section id="supply-page">
          <span className="section-label">Supply Categories</span>
          <h1 className="section-heading">Material categories for Arizona projects.</h1>
          <p className="section-body">
            Vulpine Homes provides coordinated cabinet and interior finish supply categories for
            residential and multifamily work throughout Arizona.
          </p>
          <div className="seo-list-wrap">
            <ol className="seo-list">
              {categories.map((category) => (
                <li key={category}>{category}</li>
              ))}
            </ol>
          </div>
        </section>
      </main>
      <footer>
        <div className="footer-logo">
          Vulpine<span>.</span>
        </div>
        <ul className="footer-links">
          <li>
            <a href="/">Home</a>
          </li>
          <li>
            <a href="/supply">Supply Categories</a>
          </li>
          <li>
            <a href="/request-bid">Request a Bid</a>
          </li>
        </ul>
        <div className="footer-copy">© 2026 Vulpine Homes. All rights reserved.</div>
      </footer>
    </>
  );
}
