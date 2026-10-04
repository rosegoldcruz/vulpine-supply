import { DesignSummary } from '@/components/configurator/DesignSummary';

export const metadata = {
  title: 'Cabinet Design Summary',
  description: 'A printable summary of your Vulpine Homes cabinet design: door style, finish and hardware.',
  robots: { index: false, follow: true },
  alternates: { canonical: '/configurator/summary' },
};

export default function DesignSummaryPage() {
  return (
    <main>
      <DesignSummary />
    </main>
  );
}
