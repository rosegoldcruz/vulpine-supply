import LegalPageShell from '../../components/LegalPageShell';

export const metadata = {
  title: 'Privacy Policy',
  description:
    'Learn how Vulpine Homes collects, uses, shares, safeguards, and retains information from website visitors and cabinet and interior finish supply customers.',
  alternates: { canonical: '/privacy' },
};

const sections = [
  {
    id: 'overview',
    title: 'Overview and Scope',
    content: <>
      <p>This Privacy Policy explains how Vulpine Homes (“Vulpine,” “we,” “us,” or “our”) collects, uses, discloses, and protects information when you visit vulpinehomes.com, request a bid, communicate with us, or purchase cabinet and interior finish materials. It also explains the choices available to you.</p>
      <p>This Policy applies to information handled through this website and related customer and project communications. It does not govern a manufacturer, carrier, installer, contractor, social network, or other third party operating under its own privacy practices. If you interact with a third-party service through a link or integration, review that service’s policy as well.</p>
    </>,
  },
  {
    id: 'information',
    title: 'Information We Collect',
    content: <>
      <p><strong>Information you provide.</strong> We may collect your name, email address, phone number, company, billing or project address, city, state, ZIP code, project type, project location, project description, material selections, plans, measurements, photos, quantities, budget, timeline, and other information included in a request, order, payment record, or communication.</p>
      <p><strong>Transaction and project information.</strong> If you do business with us, we may maintain quotes, approvals, purchase details, invoices, delivery information, warranty communications, tax documentation, customer-service records, and notes about your project. Payment card information may be processed by a payment provider; we generally receive transaction status and limited payment details rather than a full card number.</p>
      <p><strong>Website and device information.</strong> Our systems may automatically receive your IP address, browser and device type, operating system, pages viewed, date and time, referring page, links or sections used, approximate location inferred from IP, and campaign parameters such as UTM source, medium, campaign, content, and term. The site creates a random visitor identifier in browser local storage so we can understand repeat site activity without requiring an account.</p>
      <p><strong>Communications and consent records.</strong> We may retain emails, calls, text messages, form submissions, and records of your communication preferences. When you consent to calls or texts, we may record the consent language, date and time, source page, and related phone number to document and honor your choice.</p>
    </>,
  },
  {
    id: 'sources',
    title: 'Sources of Information',
    content: <>
      <p>We collect information directly from you; automatically from your browser or device; from your employer, contractor, property manager, designer, architect, installer, or other project participant; and from service providers that help us operate the site and business. We may also receive information from public records, manufacturers, suppliers, carriers, referral sources, advertising or analytics partners, and publicly available business profiles.</p>
      <p>If you give us information about another person, you represent that you are authorized to provide it for the relevant project or transaction and that you will direct that person to this Policy when appropriate.</p>
    </>,
  },
  {
    id: 'uses',
    title: 'How We Use Information',
    content: <>
      <p>We use personal information to respond to inquiries; prepare quotes and material recommendations; confirm specifications; process and fulfill orders; coordinate suppliers, freight, delivery, service, returns, and warranty claims; manage customer relationships; provide project updates; and maintain transaction and consent records.</p>
      <p>We also use information to operate, secure, troubleshoot, and improve the website; measure site traffic and campaign performance; understand which products and services interest visitors; prevent fraud and abuse; collect amounts due; enforce agreements; protect people, property, and legal rights; comply with tax, accounting, warranty, recordkeeping, and other legal obligations; and establish, exercise, or defend legal claims.</p>
      <p>Where allowed by law, we may use contact information to tell you about relevant products, services, availability, or project opportunities. You may opt out of promotional email through the unsubscribe method in the message and opt out of text messages by replying STOP. We may still send non-promotional communications needed to answer a request, administer an order, provide safety or service information, or comply with law.</p>
    </>,
  },
  {
    id: 'cookies',
    title: 'Cookies, Local Storage, and Analytics',
    content: <>
      <p>We and our service providers may use cookies, pixels, scripts, server logs, and similar technologies to keep the site functional, remember preferences, measure performance, attribute referrals, and understand use. Our site may use Google Analytics when configured, and it also sends first-party analytics events such as page views, device category, referral information, campaign parameters, and a random browser visitor ID to our systems.</p>
      <p>You can delete or block cookies through browser controls and can clear local storage through browser settings. Blocking these technologies may affect site features and will not necessarily prevent all server-side logging. You can use browser or device privacy controls and, where offered by the provider, analytics opt-out tools. At this time, our response to browser “Do Not Track” signals may vary because there is no universally accepted technical standard.</p>
    </>,
  },
  {
    id: 'disclosures',
    title: 'How We Disclose Information',
    content: <>
      <p>We may disclose information to vendors that perform services for us, such as website hosting, cloud storage, customer and lead databases, analytics, communications and internal notifications, payment processing, accounting, document management, security, IT support, and professional advice. These providers receive information needed for their assigned functions and are expected to handle it appropriately.</p>
      <p>For a project or order, we may disclose relevant information to cabinet and material manufacturers, distributors, fabricators, carriers, delivery providers, warranty administrators, installers or contractors, and other project participants. For example, a supplier may need a delivery address and specifications, while a carrier may need a contact name and phone number.</p>
      <p>We may also disclose information when required by law, court order, subpoena, or valid governmental request; to collect a debt or enforce an agreement; to investigate fraud, security issues, or misuse; to protect the rights and safety of Vulpine, customers, or others; or as part of a merger, financing, sale, reorganization, bankruptcy, or transfer of some or all business assets.</p>
      <p>We do not sell personal information for money. We do not share mobile opt-in information or text-message consent with third parties for their own marketing. We may disclose information to service providers that support our communications, subject to appropriate limitations, and when disclosure is required by law.</p>
    </>,
  },
  {
    id: 'sms',
    title: 'Calls and Text Messages',
    content: <>
      <p>If you check the consent box or otherwise provide valid consent, Vulpine may call or text the number you provide about your inquiry or project. Message frequency varies. Message and data rates may apply. Reply STOP to opt out and HELP for help. Consent is not a condition of purchasing goods or services, and opting out of texts does not prevent you from communicating with us through other available methods.</p>
      <p>We may use vendors to deliver or route communications. Mobile information and opt-in consent will not be sold or disclosed to third parties for their own promotional use. We retain consent and opt-out records as reasonably necessary to document and comply with your request.</p>
    </>,
  },
  {
    id: 'retention',
    title: 'Data Retention',
    content: <>
      <p>We retain information for as long as reasonably necessary for the purpose collected and for legitimate operational, accounting, tax, warranty, safety, fraud-prevention, dispute-resolution, and legal needs. Retention varies by record. A general inquiry may be kept for follow-up and business planning, while accepted quotes, orders, payment records, specifications, consent records, and warranty materials may be retained for longer periods tied to the transaction and applicable limitation periods.</p>
      <p>When information is no longer reasonably needed, we may delete it, de-identify it, or retain it in a form that does not identify you. Backup and archival copies may remain for a limited period until overwritten through ordinary system processes.</p>
    </>,
  },
  {
    id: 'security',
    title: 'Information Security',
    content: <>
      <p>We use reasonable administrative, technical, and physical safeguards designed for the nature of the information we handle. These may include access restrictions, authenticated systems, encrypted network transmission where supported, vendor management, backups, logging, and employee or contractor confidentiality requirements.</p>
      <p>No website, database, email, text message, or transmission method is completely secure. You should use care when sending sensitive information, verify unexpected payment or wiring requests through a known contact method, and avoid placing payment card numbers, government identifiers, passwords, or other unnecessary sensitive data in an open project-description field.</p>
    </>,
  },
  {
    id: 'choices',
    title: 'Your Choices and Requests',
    content: <>
      <p>You may ask to access, correct, or delete certain personal information we hold about you, subject to verification and legal exceptions. You may also ask questions about our practices, update project contact information, opt out of promotional communications, or withdraw text-message consent. We may retain information needed to complete an order, document a transaction or opt-out, comply with law, detect security incidents, resolve disputes, or exercise legal rights.</p>
      <p>To protect you, we may ask for information reasonably needed to verify identity and authority. If an authorized agent submits a request, we may request proof of authorization and may still need to verify the request with you. We will not discriminate against you for making a privacy request, although deleting information may limit our ability to provide requested services.</p>
    </>,
  },
  {
    id: 'state-rights',
    title: 'State Privacy Rights',
    content: <>
      <p>Depending on where you live and the laws that apply to Vulpine, you may have additional rights concerning access, correction, deletion, portability, or certain disclosures or processing of personal information. These rights may be limited by exemptions for small businesses, business-to-business information, completed transactions, legal compliance, security, and other circumstances.</p>
      <p>Submit a request through the method in the Contact section below and identify the state where you reside. We will evaluate the request under applicable law, verify it as required, and explain any decision or available appeal process. If the law permits an appeal, you may reply to our decision and state that you wish to appeal.</p>
    </>,
  },
  {
    id: 'children',
    title: 'Children’s Privacy',
    content: <>
      <p>The site and our cabinet and finish supply services are intended for adults and business users, not children under 13. We do not knowingly collect personal information from children under 13. If you believe a child has submitted personal information, contact us so we can review and delete it where appropriate.</p>
    </>,
  },
  {
    id: 'external',
    title: 'External Sites and Services',
    content: <>
      <p>The site may link to maps, social platforms, manufacturer resources, payment services, or other external sites. A link does not mean Vulpine controls or endorses the third party’s privacy or security practices. Information you give directly to an external service is governed by that service’s terms and privacy policy.</p>
    </>,
  },
  {
    id: 'changes-contact',
    title: 'Policy Changes and Contact',
    content: <>
      <p>We may update this Policy to reflect changes in our practices, technology, vendors, or legal requirements. The effective date at the top shows when the current version took effect. Material changes may be highlighted on the site or communicated through another reasonable method when required.</p>
      <p>To ask a privacy question or submit a privacy request, use our <a href="/request-bid">contact and request form</a> and write “Privacy Request” at the beginning of the project-details field. You may also write to Vulpine Homes in Arizona. Please provide enough information for us to understand the request, but do not submit sensitive identification documents unless we specifically request them through an appropriate method.</p>
    </>,
  },
];

export default function PrivacyPage() {
  return <LegalPageShell title="Privacy Policy" description="How we collect, use, share, protect, and retain information when you visit our site or work with Vulpine Homes." effectiveDate="October 1, 2026" sections={sections} />;
}
