import LegalPageShell from '../../components/LegalPageShell';
import { privacySections } from '../../lib/legal/privacy';

export const metadata = {
  title: 'Privacy Policy',
  description: 'How Vulpine Homes handles quote requests, project information, browser analytics, SMS consent, and privacy requests.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return <LegalPageShell title="Privacy Policy" description="How information is collected, used, disclosed, and retained when you visit our website or request material supply." lastUpdated="October 1, 2026" sections={privacySections} />;
}
