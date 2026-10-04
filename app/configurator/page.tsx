import { CabinetConfigurator } from '@/components/configurator/CabinetConfigurator';

export const metadata = {
  title: 'Cabinet Configurator - Door Styles, Finishes & Hardware',
  description:
    'Design your cabinets with Vulpine Homes: choose a door style, finish color, and hardware, preview it in a real kitchen or in 3D, and request a quote.',
  alternates: {
    canonical: '/configurator',
  },
};

export default function ConfiguratorPage() {
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
            <a href="/configurator" aria-current="page">
              Configurator
            </a>
          </li>
          <li>
            <a href="/request-bid">Request a Bid</a>
          </li>
          <li>
            <a href="/terms">Terms</a>
          </li>
          <li>
            <a href="/privacy">Privacy</a>
          </li>
        </ul>
        <a href="/request-bid" className="nav-cta">
          Request a Bid
        </a>
      </nav>
      <main>
        <CabinetConfigurator />
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
            <a href="/configurator">Configurator</a>
          </li>
          <li>
            <a href="/request-bid">Request a Bid</a>
          </li>
          <li>
            <a href="/terms">Terms</a>
          </li>
          <li>
            <a href="/privacy">Privacy</a>
          </li>
        </ul>
        <div className="footer-copy">© 2026 Vulpine Homes. All rights reserved.</div>
      </footer>
    </>
  );
}
