import { SMS_CONSENT_TEXT } from '../sms-consent';

export const privacySections = [
  {
    id: 'overview', title: 'Scope and Business Identity',
    paragraphs: [
      'This Policy describes information handled by Vulpine Homes (“Vulpine,” “we,” “us,” or “our”), the business name published at vulpinehomes.com. It covers this website, quote and contact forms, project information you provide, related communications, and information used to administer a material-supply relationship.',
      'Vulpine supplies cabinet and interior-finish materials for U.S. projects. Information provided directly to an independent manufacturer, carrier, installer, or external website is governed by that party’s practices. This Policy does not expand Vulpine’s role into installation, contracting, or design services.',
    ],
  },
  {
    id: 'information', title: 'Information Collected Through Forms',
    paragraphs: [
      'Public forms collect name, email, optional phone number, company, project type, project location, and free-text details. Details may include materials requested, unit count, specifications, quantities, or schedules you choose to provide. The intake endpoint also accepts address, city, state, and ZIP fields when provided in an authorized submission.',
      'Submissions include the source page and URL, referrer, submission timestamp, browser user-agent information, and campaign parameters present in the URL: UTM source, medium, campaign, content, and term. The server can receive an IP address from forwarding headers and include it in the internal inquiry notification.',
      'We record the SMS checkbox choice and, when consent is given, the disclosure language, server timestamp, and source page. The submitted payload, user-agent, and referrer may be retained in the configured lead database. Do not include unrelated sensitive data in project details.',
    ],
  },
  {
    id: 'project-records', title: 'Project Records and Feature Boundaries',
    paragraphs: [
      'When you supply additional information through an agreed project channel, we may retain relevant plans, drawings, unit matrices, specifications, notes, approvals, quotes, order correspondence, and delivery or warranty details you actually provide. This supports the material-supply relationship and does not transfer ownership of architectural work.',
      'The current public website has no customer accounts, login, file-upload fields, online checkout, or card-payment processing. The site does not solicit account passwords, uploaded files, card numbers, payment credentials, or call recordings. Arrange an appropriate project channel before providing documents outside the text-based forms.',
    ],
  },
  {
    id: 'device-information', title: 'Device and Website Activity',
    paragraphs: [
      'First-party analytics records page views and contact-section interactions and sends page path, full URL, referring URL, UTM source, medium and campaign, device category, and a random browser visitor ID to our analytics endpoint. Bid submissions also generate an analytics event. Device category is derived from user-agent information and screen width, not access to contacts or device files.',
      'Local storage holds the visitor ID under vulpine_supply_visitor_id for repeat-visitor counting. It is not an account login and remains until cleared or removed. Server and external-resource requests expose normal network metadata, including IP address and browser headers, to the receiving service.',
      'URLs and submissions can contain personal information if you put it there. Avoid sensitive identifiers in links or descriptions. The current code does not request precise device geolocation or calculate an IP-based location profile.',
    ],
  },
  {
    id: 'sources', title: 'Sources of Information',
    paragraphs: [
      'Information comes directly from you through forms and communications, automatically through browser and server requests, and from authorized employers, contractors, owners, managers, designers, and project participants communicating on your behalf. Suppliers and carriers may provide information needed for an actual order or delivery.',
      'Referring websites and campaign links may supply attribution parameters. The site implements no public-record enrichment, purchased-list, or contact-enrichment integration. Provide others’ information only with project authority and tell them about this Policy where appropriate.',
    ],
  },
  {
    id: 'uses', title: 'Purposes for Using Information',
    paragraphs: [
      'Inquiry information is used to respond, prepare estimates and recommendations, clarify specifications, and communicate about the requested project. Information provided for accepted orders supports procurement, fulfillment, delivery coordination, service, returns, and warranty support.',
      'Activity and attribution data help measure traffic and inquiries, evaluate campaign performance, improve the site, troubleshoot, and protect systems. Relevant business records support accounting, compliance, dispute resolution, and enforcing accepted agreements.',
      'Contact details are used for the inquiry and related administration. There is no separate newsletter signup on the current site. Additional marketing use must comply with law and obtain consent when required. Inquiry SMS consent is not blanket permission for unrelated campaigns. Request that promotional contact stop without giving up necessary order communications.',
    ],
  },
  {
    id: 'cookies', title: 'Cookies, Local Storage, and Analytics',
    paragraphs: [
      'First-party visitor storage supports analytics rather than essential login or checkout functionality. The application sets no authentication or cart cookies because those public features do not exist. Browsers and hosting infrastructure may use necessary technical mechanisms to deliver and protect requests.',
      'A conditional Google Analytics integration loads only when a measurement ID is configured. When enabled, Google receives requests and may use analytics cookies and identifiers. First-party analytics operates separately. The application currently implements no advertising pixel, remarketing audience integration, or third-party ad tag.',
      'Fonts load from Google Fonts, whose receiving service sees network metadata such as IP and browser headers. Server-side analytics may use configured Redis storage, including Upstash-compatible storage, or temporary in-process storage. These server mechanisms are not browser advertising cookies.',
      'Browser settings can clear local storage and manage cookies. Removing a visitor ID resets it; later visits can generate another while analytics remains active. Blocking tools can restrict external requests. The current application has no automatic response to Do Not Track or Global Privacy Control signals. Use the request method below for an applicable opt-out. This disclosure does not waive any legally required automated signal response.',
    ],
  },
  {
    id: 'sms', title: 'SMS Privacy and Opt-Outs',
    paragraphs: [
      'Inquiry forms offer optional calls-and-texts consent. You can submit without selecting it. The disclosure reads:',
      SMS_CONSENT_TEXT,
      'Frequency varies; message and data rates may apply. Reply STOP to opt out or HELP for assistance as stated in the disclosure, or use the existing contact form. Opt-out requests are respected, and limited suppression or consent records may be retained to honor them.',
      'Phone numbers and SMS consent are not sold or transferred to third parties for their own marketing merely because you opted in. Communications providers may process relevant information solely to support Vulpine messaging or as required by law. The website records consent but implements no carrier SMS gateway or inbound STOP/HELP automation; communications must be administered through Vulpine’s actual messaging channel.',
    ],
    link: { href: '/terms#sms', label: 'SMS terms' },
  },
  {
    id: 'disclosures', title: 'Recipients and Operational Disclosures',
    paragraphs: [
      'The intake endpoint is built to store lead records in NocoDB when configured and send internal inquiry notifications through Telegram when configured. Notifications include contact and project details, page/source information, time, consent choice, and available IP and user-agent metadata. Internal traffic reports can also be sent through Telegram. These are internal business notifications, not public posts.',
      'Hosting and IT services process requests and operational data. Configured analytics storage processes event counters and visitor IDs. Google Analytics receives analytics information only when enabled, and Google Fonts receives font requests. Code availability does not mean every integration is enabled in each deployment.',
      'For actual orders, necessary specifications, contact, and delivery details may be shared with manufacturers, distributors, fabricators, freight carriers, and authorized project participants for quoting, fulfillment, and support. Advisers may receive relevant accounting or legal records. Not every visitor’s information goes to every listed recipient.',
      'Disclosure may also be required by law or valid legal process, to investigate fraud or security incidents, protect legal rights, or support a business sale, merger, financing, or reorganization with appropriate protections.',
    ],
  },
  {
    id: 'sale-sharing', title: 'Sale, Sharing, and Targeted Advertising',
    paragraphs: [
      'The reviewed website has no implemented data-sale transaction, advertising pixel, remarketing audience, or targeted-advertising integration. Analytics consists of first-party measurement and conditional Google Analytics. Operational disclosures support the purposes described above.',
      'Some state definitions of sale cover valuable consideration beyond money, and sharing may mean cross-context behavioral advertising. Whether a configured analytics service falls within those definitions depends on its actual settings and provider terms. We do not make an unsupported blanket assurance about unverified off-site practices or provider use.',
      'Use the request channel for applicable opt-out rights. Any new sale, sharing, or targeted-advertising use requires appropriate disclosure and legally required opt-out mechanisms before implementation. Inquiry SMS consent is not permission to sell marketing leads.',
    ],
  },
  {
    id: 'retention', title: 'Retention',
    paragraphs: [
      'Information is retained for periods reasonably needed for quotes, follow-up, orders, delivery, warranties, accounting, project history, security, disputes, and legal compliance. Consent or suppression records may be retained to honor preferences. Deletion can be subject to those legitimate or legally required needs.',
      'Configured Redis analytics counters and visitor sets use a rolling 30-day expiration renewed when their key is updated. In-process analytics persists until the process ends. This expiry does not establish retention for inquiries, Telegram messages, backups, or other providers. The application establishes no exact general retention schedule.',
      'Records no longer reasonably needed should be deleted or de-identified through the applicable operational process. Backups may remain until ordinary replacement cycles complete. This Policy does not promise automated deletion that the site does not implement.',
    ],
  },
  {
    id: 'security', title: 'Security',
    paragraphs: [
      'We use reasonable administrative, technical, and organizational safeguards appropriate to the information and systems used. The public site uses HTTPS, configured integrations use server-side credentials, and inquiry processing validates inputs. Project and inquiry access should be restricted to authorized business use.',
      'No system, service, email, text message, or network transmission is completely secure. This Policy does not promise certification, encryption at every storage layer, or a control not established for the relevant system. Contact us about suspected misuse of project or personal information.',
    ],
  },
  {
    id: 'children', title: 'Children’s Information',
    paragraphs: [
      'The site is intended for adults and business users and is not directed to children under 13. We do not knowingly solicit their personal information. Notify Vulpine through the existing contact form if you believe a child has submitted information so it can be reviewed and deleted where appropriate.',
    ],
  },
  {
    id: 'state-rights', title: 'U.S. Privacy Rights and Choices',
    paragraphs: [
      'Depending on where you live and subject to applicable law, rights may include access, correction, deletion, a portable copy, opt-out of sale or sharing or targeted advertising, and an appeal of a request decision. Additional rights or limits may apply to sensitive-information processing.',
      'Applicability depends on state law, thresholds, and exemptions; listing rights does not assert every statute applies to Vulpine. Requests will be evaluated under applicable law, with an explanation of any lawful refusal and an appeal process where required. Reply through the established response channel or submit “Privacy Appeal” to request an appeal.',
      'We will not unlawfully discriminate for exercising rights. Verification may be needed for access, correction, or deletion. Opt-outs will not require identity verification where prohibited. Information may be retained to complete a transaction, comply with law, protect security, or resolve a claim.',
    ],
  },
  {
    id: 'california', title: 'California Residents',
    paragraphs: [
      'The categories, sources, purposes, recipients, and retention described here also explain the reviewed website’s collection for California visitors. Identifiers include contacts and the visitor ID; commercial or project information includes requested materials and descriptions; internet activity includes URLs, referrals, device category, and interaction events.',
      'If Vulpine is subject to the California Consumer Privacy Act as amended, eligible residents may exercise applicable rights to know, access, correct, delete, opt out of sale or sharing, limit qualifying sensitive-information uses, and receive non-discriminatory treatment. Statutory applicability and all exemptions have not been represented as already determined.',
      'Identify California residence in a request. Authorized agents may act with appropriate authority subject to applicable verification rules. The site does not intentionally solicit unrelated sensitive data or implement cross-context advertising. See the analytics and sale/sharing sections for current browser-signal handling and disclosure limits.',
    ],
  },
  {
    id: 'sensitive-information', title: 'Sensitive Information and External Links',
    paragraphs: [
      'Do not send Social Security numbers, financial-account credentials, card security codes, medical information, passwords, tenant identity documents, or unrelated confidential personal data in quote fields or ordinary communications. Arrange a secure authorized process first if genuinely needed for a transaction. Remove unrelated details from plans and schedules.',
      'External services operate under their own policies. Information supplied directly to them follows their practices; a link does not mean Vulpine controls them. Evaluate the receiving service before disclosing sensitive information.',
    ],
  },
  {
    id: 'international', title: 'International Visitors',
    paragraphs: [
      'The website and supply business are directed to U.S. projects. Information is processed in the United States and may be processed in locations used by actual technology providers, with privacy rules different from your residence.',
      'Visiting from abroad does not mean Vulpine has established an EU or UK representative, a GDPR consent program, or specific international-transfer arrangements. Mandatory rights applicable to a particular interaction are preserved.',
    ],
  },
  {
    id: 'changes-contact', title: 'Requests and Policy Updates',
    paragraphs: [
      'Use the existing contact form, choose “Privacy / Legal Request,” and begin details with “Privacy Request” or “Privacy Appeal.” Include your name, email or other response method, residence where relevant, and request description. Calls-and-texts consent is optional. This website publishes no dedicated privacy email, mailing address, or telephone support number.',
      'We may request information reasonably needed to verify identity or agent authority under law. Do not send identity documents until an appropriate channel is agreed. Privacy requests use the same intake and internal notifications described above; the form is not an automated access, export, or deletion tool.',
      'Material changes receive an updated Last Updated date and any notice required by law. Changes apply prospectively and do not authorize materially different uses of existing information without any required notice or consent.',
    ],
    link: { href: '/request-bid', label: 'Submit a privacy or legal request' },
  },
];
