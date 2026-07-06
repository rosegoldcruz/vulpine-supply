export const metadata = {
  title: 'Request Received',
  description:
    'Vulpine Homes received your bid request and will follow up with supply options and project guidance.',
  alternates: {
    canonical: '/thank-you',
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function ThankYouPage() {
  return (
    <>
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
            <span className="section-label">Request Received</span>
            <h1 className="section-heading">Thank you. We have your project details.</h1>
            <p className="section-body">
              Vulpine Homes will review the scope and follow up with supply options, material
              recommendations, and next steps for your project.
            </p>
            <div className="hero-ctas" style={{ opacity: 1, transform: 'none' }}>
              <a href="/" className="btn-primary">
                Back to Home
              </a>
              <a href="/supply" className="btn-secondary">
                View Supply Categories
              </a>
            </div>
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