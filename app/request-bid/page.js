import JsonLd from '../../components/JsonLd';

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
            <form className="bid-form" action="" method="POST" noValidate>
              <div className="form-group">
                <label className="form-label" htmlFor="name">
                  First &amp; Last Name
                </label>
                <input className="form-input" type="text" id="name" name="name" placeholder="Jordan Mercer" required />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="email">
                  Email
                </label>
                <input className="form-input" type="email" id="email" name="email" placeholder="jordan@company.com" required />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="phone">
                  Phone
                </label>
                <input className="form-input" type="tel" id="phone" name="phone" placeholder="(555) 000-0000" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="type">
                  Project Type
                </label>
                <select className="form-select" id="type" name="project_type">
                  <option value="">Select a project type</option>
                  <option value="multifamily">Multifamily / Apartment</option>
                  <option value="single-family">Single-Family Renovation</option>
                  <option value="investor-flip">Investor Flip / Rental Refresh</option>
                  <option value="new-build">New Build</option>
                  <option value="contractor">Contractor Supply Relationship</option>
                </select>
              </div>
              <div className="form-group full">
                <label className="form-label" htmlFor="message">
                  Project Details
                </label>
                <textarea className="form-textarea" id="message" name="message" placeholder="Tell us about unit count, materials needed, location, and schedule."></textarea>
              </div>
              <button type="submit" className="form-submit">
                Send Request
              </button>
            </form>
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
