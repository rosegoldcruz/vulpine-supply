import JsonLd from '../../components/JsonLd';
import RequestBidForm from '../../components/RequestBidForm';

export const metadata = {
  title: 'Request a Bid - Cabinet and Interior Finish Supply',
  description:
    'Request a cabinet and interior finish supply bid from Vulpine Homes for Arizona residential, multifamily, and contractor-led projects.',
  alternates: {
    canonical: '/request-bid',
  },
};

const contactPageSchema = {
  '@context': 'https://schema.org',
  '@type': 'ContactPage',
  name: 'Request a Bid - Vulpine Homes',
  url: 'https://vulpinehomes.com/request-bid',
  description:
    'Contact Vulpine Homes to request cabinet and interior finish material pricing and project support in Arizona.',
};

export default function RequestBidPage() {
  return (
    <>
      <JsonLd schema={contactPageSchema} />
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
        <section id="contact">
          <div className="contact-inner">
            <span className="section-label">Request a Bid</span>
            <h1 className="section-heading">Tell us about your project.</h1>
            <p className="section-body">
              Share your scope, material categories, and timeline. Vulpine Homes will reply with
              supply options and pricing guidance for your Arizona project.
            </p>
            <RequestBidForm />
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
