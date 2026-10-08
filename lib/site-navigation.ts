export type DoorStyleId = 'shaker_classic' | 'shaker_slide' | 'fusion_shaker' | 'fusion_slide' | 'slab'
export type NavigationHref =
  | '/' | '/supply' | '/request-bid' | '/visualizer' | '/terms' | '/privacy'
  | `/#${'supply' | 'turns' | 'mf-split' | 'contractors' | 'contact' | `material-${string}`}`
  | `/visualizer#${'hardware' | 'cabinet-faq'}`
  | `/visualizer?style=${DoorStyleId}`

interface NavigationItemBase {
  id: string
  label: string
  description?: string
  image?: string
  featured?: boolean
}

export type NavigationItem = NavigationItemBase & (
  | { href: NavigationHref; children?: readonly NavigationItem[]; unavailableReason?: never }
  | { href?: never; children: readonly NavigationItem[]; unavailableReason?: never }
  | { href?: never; children?: never; unavailableReason: string }
)

export interface NavigationGroup {
  id: string
  label: string
  items: readonly NavigationItem[]
}

export interface NavigationMenu {
  id: string
  label: string
  description: string
  presentation: 'products' | 'solutions' | 'links'
  groups: readonly NavigationGroup[]
  footer?: { label: string; href: NavigationHref }
}

// /submit-project is not implemented. Keep intake on the verified existing form.
export const PROJECT_INTAKE: NavigationHref = '/request-bid'
export const navigationPromotion = {
  title: 'BUILT FOR MULTIFAMILY LIVING.',
  description: 'Cabinetry and complete interior finish packages for projects of every scale.',
  image: '/cabs_clean/kitchens/Flour-Shaker_Kitchen.jpg',
  primary: { label: 'Submit Your Project', href: PROJECT_INTAKE },
  secondary: { label: 'Explore Products', href: '/#supply' as NavigationHref },
}

const materialImage = (slug: string) => `/materials/front/optimized/${slug}.webp`
const materialHref = (slug: string): NavigationHref => `/#material-${slug}`

export const navigationMenus: readonly NavigationMenu[] = [
  {
    id: 'products', label: 'Products', presentation: 'products',
    description: 'Cabinetry, interior finishes, and the details that bring a project together.',
    groups: [
      { id: 'cabinetry', label: 'Cabinetry', items: [
        { id: 'reserve', label: 'Vulpine Reserve', description: 'Framed cabinetry', image: '/navigation/reserve-framed.webp', featured: true, unavailableReason: 'Dedicated Vulpine Reserve collection page is not implemented.' },
        { id: 'alta', label: 'Alta Euro', description: 'Frameless cabinetry', image: '/navigation/alta-euro.webp', featured: true, unavailableReason: 'Dedicated Alta Euro collection page is not implemented.' },
        { id: 'collections', label: 'Cabinet Collections', href: '/visualizer', children: [
          { id: 'collection-shaker', label: 'Shaker Classic', href: '/visualizer?style=shaker_classic' },
          { id: 'collection-slide', label: 'Shaker Slide', href: '/visualizer?style=shaker_slide' },
          { id: 'collection-fusion', label: 'Fusion Classic', href: '/visualizer?style=fusion_shaker' },
          { id: 'collection-fusion-slide', label: 'Fusion Slide', href: '/visualizer?style=fusion_slide' },
          { id: 'collection-slab', label: 'Slab', href: '/visualizer?style=slab' },
          { id: 'collection-boxes', label: 'Cabinet Boxes', href: materialHref('cabinet-boxes') },
          { id: 'collection-doors', label: 'Cabinet Doors & Drawer Fronts', href: materialHref('cabinet-doors') },
        ] },
        { id: 'accessories', label: 'Cabinet Accessories', href: materialHref('hardware'), image: materialImage('hardware') },
      ] },
      { id: 'interior-finishes', label: 'Interior Finishes', items: [
        { id: 'countertops', label: 'Countertops', href: materialHref('countertops'), image: materialImage('countertops') },
        { id: 'vanities', label: 'Bathroom Vanities', href: materialHref('vanities'), image: materialImage('vanities') },
        { id: 'interior-doors', label: 'Interior Doors', href: materialHref('interior-doors'), image: materialImage('interior-doors') },
        { id: 'exterior-doors', label: 'Exterior Doors', unavailableReason: 'No exterior-door category page or section exists.' },
        { id: 'windows', label: 'Windows', unavailableReason: 'No window category page or section exists.' },
        { id: 'flooring', label: 'Flooring', href: materialHref('flooring'), image: materialImage('flooring') },
        { id: 'wall-panels', label: 'Wall Panels', unavailableReason: 'No wall-panel category page or section exists.' },
        { id: 'trim', label: 'Trim & Molding', href: materialHref('trim-finish'), image: materialImage('trim-finish') },
        { id: 'sinks', label: 'Sinks', href: materialHref('sinks'), image: materialImage('sinks') },
      ] },
      { id: 'additional-solutions', label: 'Additional Solutions', items: [
        { id: 'refacing', label: 'Cabinet Refacing', href: '/visualizer', image: materialImage('refacing-fronts'), description: 'Explore door styles and finishes.' },
        { id: 'hardware', label: 'Hardware', href: materialHref('hardware'), image: materialImage('hardware') },
        { id: 'finish-packages', label: 'Interior Finish Packages', href: '/supply', description: 'Coordinate materials across your project.' },
        { id: 'refacing-fronts', label: 'Refacing Fronts', href: materialHref('refacing-fronts') },
      ] },
    ], footer: { label: 'View all supply capabilities', href: '/#supply' },
  },
  {
    id: 'solutions', label: 'Solutions', presentation: 'solutions',
    description: 'Supply support for the way you build, renovate, and operate.',
    groups: [
      { id: 'project-teams', label: 'Project Teams', items: [
        { id: 'multifamily', label: 'Multifamily Developments', href: '/#mf-split', featured: true, description: 'Repeatable cabinet and finish packages.', image: '/cabs_clean/kitchens/Flour-Shaker_Kitchen.jpg' },
        { id: 'general-contractors', label: 'General Contractors', href: '/#contractors', description: 'Material selection, bid support, and delivery coordination.' },
        { id: 'builders', label: 'Developers & Builders', href: '/#contractors', description: 'Coordinate the material side of your build.' },
      ] },
      { id: 'owners-renovations', label: 'Owners & Renovations', items: [
        { id: 'owners', label: 'Property Owners & Operators', href: '/#turns', featured: true, description: 'Consistent selections for property turns.', image: '/cabs_clean/kitchens/Sage-Shaker_Kitchen.jpg' },
        { id: 'renovation', label: 'Renovation & Rehabilitation', href: '/#turns', description: 'Practical upgrades and clear material sequencing.' },
      ] },
      { id: 'cabinet-supply', label: 'Cabinet & Material Supply', items: [
        { id: 'residential', label: 'Residential Cabinetry', href: '/#material-cabinet-boxes', featured: true, image: '/cabs_clean/kitchens/Latte-Walnut-Shaker_Kitchen.jpg' },
        { id: 'solution-refacing', label: 'Cabinet Refacing', href: '/visualizer', description: 'Find the right doors, finish, and hardware.' },
        { id: 'nationwide', label: 'Nationwide Material Supply', unavailableReason: 'No dedicated nationwide service page or coverage information is implemented.' },
      ] },
    ], footer: { label: 'Tell us about your project', href: PROJECT_INTAKE },
  },
  {
    id: 'projects', label: 'Projects', presentation: 'links',
    description: 'Bring your scope, explore your selections, and start a conversation.',
    groups: [
      { id: 'start-project', label: 'Start Your Project', items: [
        { id: 'submit-project', label: 'Submit a Project', href: PROJECT_INTAKE, description: 'Share your scope through our existing project inquiry form.' },
        { id: 'request-quote', label: 'Request a Quote', href: '/request-bid' },
      ] },
      { id: 'design-project', label: 'Explore Your Design', items: [
        { id: 'cabinet-visualizer', label: 'Cabinet Visualizer', href: '/visualizer', description: 'Choose a door style, finish, and hardware.' },
        { id: 'reface-navigation', label: 'Reface Your Cabinets', href: '/visualizer' },
      ] },
    ],
    footer: { label: 'SEND US THE PLANS', href: PROJECT_INTAKE },
  },
  {
    id: 'resources', label: 'Resources', presentation: 'links',
    description: 'Explore existing cabinet information or ask our team for project documents.',
    groups: [
      { id: 'cabinet-resources', label: 'Cabinet Resources', items: [
        { id: 'catalogs', label: 'Product Catalogs', unavailableReason: 'No published catalog page or gated download workflow exists in this website.' },
        { id: 'specifications', label: 'Cabinet Specifications', unavailableReason: 'No dedicated published specifications page or download workflow exists.' },
        { id: 'finish-styles', label: 'Finish & Door Styles', href: '/visualizer' },
        { id: 'hardware-options', label: 'Hardware Options', href: '/visualizer#hardware' },
        { id: 'faq', label: 'Frequently Asked Questions', href: '/visualizer#cabinet-faq' },
      ] },
      { id: 'guides-downloads', label: 'Guides & Downloads', items: [
        { id: 'measurements', label: 'Measurement Guides', unavailableReason: 'No measurement-guide page or published resource workflow exists.' },
        { id: 'installation', label: 'Installation Resources', unavailableReason: 'Uploaded source documents are not part of a published or gated installation-resource workflow.' },
        { id: 'downloads', label: 'Downloads', unavailableReason: 'No downloads page or gated resource workflow exists.' },
      ] },
    ], footer: { label: 'Ask our team about product documents', href: '/#contact' },
  },
  {
    id: 'partners', label: 'Partners', presentation: 'links',
    description: 'Connect with Vulpine about your trade relationship and supply requirements.',
    groups: [
      { id: 'trade-partners', label: 'Trade Partners', items: [
        { id: 'dealer', label: 'Become a Dealer', unavailableReason: 'No dealer registration workflow exists in the marketing website.' },
        { id: 'consultant', label: 'Consultant Portal', unavailableReason: 'No verified public consultant portal destination is configured in this website.' },
      ] },
      { id: 'partner-support', label: 'Partner Support', items: [
        { id: 'dealer-resources', label: 'Dealer Resources', unavailableReason: 'No authenticated dealer-resource destination is configured.' },
        { id: 'supplier-partnerships', label: 'Supplier Partnerships', href: '/#contact', description: 'Discuss supply opportunities with our team.' },
      ] },
    ], footer: { label: 'Contact our team', href: '/#contact' },
  },
  {
    id: 'about', label: 'About', presentation: 'links',
    description: 'A supply partner for cabinetry and the interior finishes around it.',
    groups: [
      { id: 'company', label: 'Vulpine', items: [
        { id: 'company-overview', label: 'Company Overview', href: '/' },
        { id: 'why-vulpine', label: 'Why Vulpine', href: '/#turns' },
        { id: 'supply-network', label: 'Our Supply Network', unavailableReason: 'No public supply-network page exists.' },
        { id: 'markets', label: 'Markets We Serve', href: '/#mf-split' },
      ] },
      { id: 'contact-policies', label: 'Contact & Policies', items: [
        { id: 'contact', label: 'Contact', href: '/#contact' },
        { id: 'policies', label: 'Policies', children: [
          { id: 'terms', label: 'Terms', href: '/terms' },
          { id: 'privacy', label: 'Privacy Policy', href: '/privacy' },
        ] },
      ] },
    ],
  },
]
