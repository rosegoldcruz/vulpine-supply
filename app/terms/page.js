import LegalPageShell from '../../components/LegalPageShell';

export const metadata = {
  title: 'Terms & Conditions',
  description:
    'Terms and conditions governing use of the Vulpine Homes website, cabinet and finish material quotes, orders, delivery, payment, warranties, and project responsibilities.',
  alternates: { canonical: '/terms' },
};

const sections = [
  {
    id: 'agreement',
    title: 'Agreement and Scope',
    content: <>
      <p>These Terms &amp; Conditions (the “Terms”) govern your access to vulpinehomes.com, any request for information or pricing submitted through the site, and—unless a signed agreement states otherwise—the purchase of cabinets, cabinet components, countertops, vanities, sinks, flooring, hardware, interior doors, trim, finish materials, and related supply services from Vulpine Homes (“Vulpine,” “we,” “us,” or “our”). By using the site, approving a quote, paying a deposit, accepting delivery, or otherwise ordering products or services from us, you agree to these Terms.</p>
      <p>A written quote, sales order, invoice, credit application, project-specific agreement, manufacturer warranty, or other document issued or accepted by Vulpine may contain additional terms. If an expressly stated provision in a signed project-specific agreement conflicts with these Terms, the signed agreement controls for that project. Your purchase order or other form does not modify these Terms unless Vulpine expressly agrees in a writing signed by an authorized representative.</p>
    </>,
  },
  {
    id: 'website-use',
    title: 'Website Use and Information',
    content: <>
      <p>You may use this site for lawful business and personal purposes related to learning about our products, requesting a bid, or communicating with Vulpine. You may not interfere with site operation, attempt unauthorized access, introduce malicious code, scrape the site at an unreasonable rate, impersonate another person, submit false project information, or use site content in a way that violates applicable law or another party’s rights.</p>
      <p>Site content is general information and may be changed without notice. Product images, renderings, diagrams, descriptions, availability, lead times, and pricing examples are illustrative and may not reflect the exact product delivered. The site is not architectural, engineering, installation, code-compliance, tax, legal, or other professional advice.</p>
    </>,
  },
  {
    id: 'quotes-orders',
    title: 'Quotes, Specifications, and Order Acceptance',
    content: <>
      <p>Unless the quote states otherwise, a quote is an estimate based on the plans, dimensions, selections, quantities, site information, and assumptions available when it is prepared. Quotes expire on the date shown or, if no date is shown, thirty days after issuance. Commodity, freight, tariff, fuel, tax, manufacturer, and supplier changes may require updated pricing before order acceptance.</p>
      <p>An order is not binding on Vulpine until we issue written acceptance, receive any required deposit or payment, and confirm product availability. We may reject or cancel an order before acceptance because of pricing or clerical error, discontinued product, supplier allocation, credit concerns, suspected fraud, or circumstances outside our reasonable control. Any deposit received for an order we decline will be returned, except amounts properly applied to authorized work already performed.</p>
      <p>You are responsible for reviewing every quote, plan, elevation, door style, finish, species, construction detail, handing, swing, appliance clearance, quantity, dimension, delivery location, and accessory before approval. Your approval authorizes procurement and fabrication based on the approved information.</p>
    </>,
  },
  {
    id: 'measurements',
    title: 'Measurements, Design, and Site Conditions',
    content: <>
      <p>Accurate field measurements and confirmation of site conditions are essential. Unless Vulpine expressly agrees in writing to perform field measurement or design services, you and your contractor are solely responsible for dimensions, layout, appliance specifications, utilities, wall conditions, floors, corners, openings, fillers, clearances, code requirements, and installation feasibility. Dimensions shown on plans supplied by others must be field verified before ordering.</p>
      <p>Even when Vulpine assists with a takeoff, layout, or product recommendation, that assistance depends on the information supplied and does not replace review by the installer, contractor, architect, engineer, or other responsible project professional. Vulpine is not responsible for fit, alignment, or additional work caused by inaccurate or incomplete measurements, out-of-square walls, uneven floors, concealed conditions, plan revisions, appliance substitutions, or site changes made after approval.</p>
    </>,
  },
  {
    id: 'materials',
    title: 'Natural Variation and Product Characteristics',
    content: <>
      <p>Wood, stone, quartz, tile, flooring, paint, stain, laminate, metal, and other finish materials can vary in color, tone, grain, pattern, texture, sheen, veining, mineral deposits, knots, expansion, and aging. Samples and screen images represent a general appearance only. Lighting, surrounding finishes, display settings, production lots, and time can affect appearance. These ordinary characteristics and reasonable lot-to-lot variations are not defects.</p>
      <p>Painted wood products may develop visible seams or hairline finish changes at joints as humidity and temperature change. Natural wood may darken, lighten, or mellow with exposure to light. Stone and engineered surfaces may require seams, and pattern alignment cannot always be guaranteed. You should order coordinated materials at the same time when reasonable consistency is important and retain attic stock for future repairs because an exact later match may be unavailable.</p>
    </>,
  },
  {
    id: 'changes-cancellations',
    title: 'Changes, Cancellations, and Returns',
    content: <>
      <p>Changes requested after approval may affect price, lead time, availability, freight, and installation sequencing. No change is effective until documented and accepted by Vulpine. Custom, modified, cut, assembled, fabricated, special-order, clearance, or installed products generally cannot be changed, cancelled, or returned once released to production or a supplier.</p>
      <p>Stock products may be eligible for return only with advance written authorization, in new and resalable condition, in original packaging, and within the period Vulpine specifies. Returns may be subject to inspection, return freight, manufacturer charges, and a restocking fee. Unauthorized returns may be refused. Deposits and progress payments may be retained to cover committed materials, fabrication, administrative work, freight, restocking charges, and other nonrecoverable costs.</p>
    </>,
  },
  {
    id: 'lead-times',
    title: 'Lead Times and Delays',
    content: <>
      <p>Lead times are good-faith estimates that begin only after final approval, receipt of required payment, and resolution of all specifications. They are not guaranteed completion or delivery dates. Manufacturing backlogs, material shortages, carrier delays, weather, labor disruptions, port conditions, supplier errors, damage in transit, governmental action, and other events may affect the schedule.</p>
      <p>You should avoid scheduling demolition, installers, tenants, closings, inspections, or other trades solely around an estimated arrival date. Vulpine is not responsible for labor standby, lost rent, financing charges, project delay, temporary housing, missed appointments, or other consequential costs arising from a reasonable delay or an event outside our reasonable control.</p>
    </>,
  },
  {
    id: 'delivery',
    title: 'Delivery, Inspection, Storage, and Risk of Loss',
    content: <>
      <p>Delivery pricing assumes reasonable access, a safe unloading area, and the conditions stated in the quote. Extra charges may apply for redelivery, waiting time, limited access, stairs, special equipment, inside placement, jobsite restrictions, or an incorrect address. You must provide an authorized person to receive and inspect the shipment unless other arrangements are accepted in writing.</p>
      <p>Count packages and inspect for visible damage before signing the delivery receipt. Note shortages or damage on the carrier’s receipt, photograph the condition, preserve packaging, and notify Vulpine promptly. Concealed damage or incorrect items should be reported before installation and no later than the claim period stated in the applicable quote, sales order, or manufacturer policy. Installing, altering, finishing, or disposing of an item may waive a claim that reasonable inspection would have identified.</p>
      <p>Risk of loss transfers as stated in the sales order or, if unstated, when products are delivered to you, your agent, installer, carrier, or designated location. If you delay delivery after products are ready, Vulpine may charge storage and handling, move products to third-party storage at your cost, and treat risk of loss as transferred. Products must be stored flat or upright as appropriate, indoors, dry, secure, climate controlled when required, and protected from jobsite traffic and construction moisture.</p>
    </>,
  },
  {
    id: 'payment',
    title: 'Prices, Taxes, and Payment',
    content: <>
      <p>You agree to pay the price, deposit, progress payments, balance, taxes, freight, storage, collection costs, and other charges shown in the accepted documents. Unless Vulpine receives a valid exemption certificate before invoicing, applicable sales, use, transaction privilege, and similar taxes may be added. Payment is not contingent on project financing, inspection, resale, tenant occupancy, or payment to you by another party.</p>
      <p>Past-due balances may accrue the lesser of 1.5% per month or the maximum lawful rate, plus reasonable collection costs and attorneys’ fees where allowed. Vulpine may suspend performance, withhold delivery, revoke credit terms, or require cleared funds when payment is late or creditworthiness changes. To the extent permitted by law, Vulpine retains all available lien, stop-notice, reclamation, and security-interest rights until paid in full.</p>
    </>,
  },
  {
    id: 'installation',
    title: 'Installation, Codes, and Jobsite Responsibility',
    content: <>
      <p>Unless installation is expressly included in a signed scope, Vulpine supplies materials only and does not control the installer, contractor, schedule, means and methods, or jobsite. You are responsible for qualified installation; permits and inspections; compliance with plans, building codes, accessibility rules, fire and life-safety requirements, HOA rules, and manufacturer instructions; and coordination with appliances, plumbing, electrical, flooring, drywall, paint, and other trades.</p>
      <p>Do not install products that appear damaged, incorrect, or unsuitable. Installation constitutes acceptance of visible characteristics and dimensions that should have been found through reasonable inspection. Field modifications, improper handling, inadequate acclimation, excess humidity or dryness, water intrusion, misuse, failure to maintain products, and installation contrary to instructions may void applicable warranty coverage.</p>
    </>,
  },
  {
    id: 'warranties',
    title: 'Warranties and Remedies',
    content: <>
      <p>Products may carry warranties provided by their manufacturers. Upon request, Vulpine will reasonably assist in identifying available manufacturer warranty information, but warranty eligibility, exclusions, documentation, inspection, repair, replacement, and labor coverage are determined by the manufacturer. Unless Vulpine provides a separate express written warranty, Vulpine makes no additional product warranty.</p>
      <p>TO THE FULLEST EXTENT PERMITTED BY LAW, PRODUCTS AND THE WEBSITE ARE PROVIDED “AS IS” AND “AS AVAILABLE,” AND VULPINE DISCLAIMS IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. Some jurisdictions do not allow certain disclaimers, so portions of this paragraph may not apply to you.</p>
      <p>For a valid claim within Vulpine’s responsibility, our obligation will be limited, at our option, to repair, replacement, re-performance, account credit, or refund of the amount paid for the affected product. Replacement products may vary from the original because of aging, lot changes, or discontinuation. Removal, refinishing, reinstallation, labor, travel, and incidental project costs are excluded unless expressly covered in writing.</p>
    </>,
  },
  {
    id: 'liability',
    title: 'Limitation of Liability and Indemnity',
    content: <>
      <p>TO THE FULLEST EXTENT PERMITTED BY LAW, VULPINE WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, PUNITIVE, OR CONSEQUENTIAL DAMAGES, INCLUDING LOST PROFITS, LOST RENT, LOSS OF USE, DELAY COSTS, OR DAMAGE TO OTHER WORK, EVEN IF ADVISED THAT SUCH DAMAGES MAY OCCUR. VULPINE’S TOTAL LIABILITY ARISING FROM A PRODUCT, ORDER, OR PROJECT WILL NOT EXCEED THE AMOUNT YOU PAID VULPINE FOR THE PRODUCT OR PORTION OF THE ORDER GIVING RISE TO THE CLAIM.</p>
      <p>You agree to defend, indemnify, and hold Vulpine and its personnel harmless from third-party claims, losses, and reasonable costs arising from inaccurate information you supplied, your breach of these Terms, unsafe site conditions, work performed by contractors or installers under your control, misuse or improper storage of products, or your violation of law, except to the extent caused by Vulpine’s negligence or willful misconduct.</p>
    </>,
  },
  {
    id: 'communications',
    title: 'Electronic Communications and Text Messages',
    content: <>
      <p>You consent to conduct transactions electronically and to receive quotes, approvals, invoices, disclosures, and project communications at the email address or phone number you provide. Keep your contact information current and retain copies for your records.</p>
      <p>If you separately consent to text messages, Vulpine may send texts about your inquiry or project. Message frequency varies. Message and data rates may apply. Reply STOP to opt out and HELP for help. Consent to texts is not a condition of purchasing goods or services. Carriers are not liable for delayed or undelivered messages. Our collection and use of personal information is described in the <a href="/privacy">Privacy Policy</a>.</p>
    </>,
  },
  {
    id: 'general',
    title: 'Force Majeure, Governing Law, and General Terms',
    content: <>
      <p>Vulpine is not liable for delay or nonperformance caused by events beyond its reasonable control, including natural disaster, severe weather, fire, epidemic, war, terrorism, civil disturbance, governmental action, embargo, tariff change, labor dispute, cyber incident, utility or network failure, carrier disruption, supplier failure, or shortage of labor or materials.</p>
      <p>These Terms are governed by Arizona law, without regard to conflict-of-law principles. Any dispute that cannot be resolved informally will be brought in a state or federal court with jurisdiction in Maricopa County, Arizona, and each party consents to that venue and jurisdiction. Before filing, each party agrees to provide written notice describing the dispute and allow thirty days for a good-faith resolution, except when immediate relief is reasonably necessary.</p>
      <p>If a provision is unenforceable, it will be modified to the minimum extent necessary and the remaining provisions will continue in effect. Failure to enforce a provision is not a waiver. You may not assign an order without our written consent. These Terms, together with the accepted project documents, form the entire agreement on their subject matter. Headings are for convenience only.</p>
    </>,
  },
  {
    id: 'updates-contact',
    title: 'Updates and Contact',
    content: <>
      <p>We may revise these Terms as our services, products, or legal obligations change. The effective date at the top identifies the current version. Revised Terms apply to later site use and later transactions; they do not retroactively change an accepted order unless the parties agree.</p>
      <p>Questions about these Terms may be submitted through our <a href="/request-bid">contact and request form</a> or mailed to Vulpine Homes in Arizona. For an order-specific question, include the customer name, project name, quote or invoice number, and a clear description of the issue.</p>
    </>,
  },
];

export default function TermsPage() {
  return <LegalPageShell title="Terms & Conditions" description="The rules that govern use of our website and the purchase, delivery, and use of cabinet and interior finish materials." effectiveDate="October 1, 2026" sections={sections} />;
}
