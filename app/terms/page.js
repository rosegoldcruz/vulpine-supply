import LegalPageShell from '../../components/LegalPageShell';
import { termsSections } from '../../lib/legal/terms';

export const metadata = {
  title: 'Terms of Use & Terms of Sale',
  description: 'Vulpine Homes website and material-supply terms for cabinet and interior-finish orders, approvals, freight, payments, returns, and warranties.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return <LegalPageShell title="Terms of Use & Terms of Sale" description="Website use and the terms governing cabinet and interior-finish material supply for U.S. projects." lastUpdated="October 1, 2026" sections={termsSections} />;
}
