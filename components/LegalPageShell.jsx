const legalLinks = [
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy Policy' },
];

export default function LegalPageShell({ title, description, lastUpdated, sections }) {
  return (
    <>
      <nav aria-label="Primary navigation">
        <a href="/" className="nav-logo" aria-label="Vulpine Homes home">
          Vulpine<span>.</span>
        </a>
        <ul className="nav-links">
          <li><a href="/supply">Supply Categories</a></li>
          <li><a href="/terms">Terms</a></li>
          <li><a href="/privacy">Privacy</a></li>
        </ul>
        <a href="/request-bid" className="nav-cta">Request a Bid</a>
      </nav>

      <main className="legal-page">
        <header className="legal-hero">
          <div className="legal-hero-inner">
            <p className="legal-kicker">Vulpine Homes</p>
            <h1>{title}</h1>
            <p className="legal-intro">{description}</p>
            <p className="legal-effective">Last Updated: {lastUpdated}</p>
          </div>
        </header>

        <div className="legal-layout">
          <aside className="legal-toc" aria-label={`${title} table of contents`}>
            <details open>
              <summary>On this page</summary>
              <ol>
                {sections.map((section, index) => (
                  <li key={section.id}>
                    <a href={`#${section.id}`}>
                      <span>{String(index + 1).padStart(2, '0')}</span>
                      {section.title}
                    </a>
                  </li>
                ))}
              </ol>
            </details>
          </aside>

          <article className="legal-content">
            {sections.map((section, index) => (
              <section id={section.id} aria-labelledby={`${section.id}-heading`} className="legal-section" key={section.id}>
                <div className="legal-section-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</div>
                <div>
                  <h2 id={`${section.id}-heading`}>{section.title}</h2>
                  {section.paragraphs.map((paragraph, paragraphIndex) => (
                    <p key={paragraphIndex}>{paragraph}</p>
                  ))}
                  {section.link ? <p><a href={section.link.href}>{section.link.label}</a></p> : null}
                </div>
              </section>
            ))}
          </article>
        </div>
      </main>

      <footer>
        <a href="/" className="footer-logo" aria-label="Vulpine Homes home">
          Vulpine<span>.</span>
        </a>
        <ul className="footer-links">
          <li><a href="/supply">Supply</a></li>
          <li><a href="/request-bid">Request a Bid</a></li>
          {legalLinks.map((link) => (
            <li key={link.href}><a href={link.href}>{link.label}</a></li>
          ))}
        </ul>
        <div className="footer-copy">© 2026 Vulpine Homes. All rights reserved.</div>
      </footer>
    </>
  );
}
