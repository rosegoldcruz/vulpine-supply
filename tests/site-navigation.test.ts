import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import { navigationMenus, navigationPromotion, PROJECT_INTAKE, type NavigationItem } from '../lib/site-navigation'
import { materialCards } from '../components/materialCardData'
import { CONFIG_DATA } from '../components/configurator/data'

const root = resolve(import.meta.dirname, '..')
function descendants(items: readonly NavigationItem[]): NavigationItem[] {
  return items.flatMap(item => [item, ...descendants(item.children ?? [])])
}
const entries = navigationMenus.flatMap(menu => menu.groups.flatMap(group => descendants(group.items)))
const destinations = [
  ...entries.flatMap(item => item.href ? [item.href] : []),
  ...navigationMenus.flatMap(menu => menu.footer ? [menu.footer.href] : []),
  navigationPromotion.primary.href, navigationPromotion.secondary.href, PROJECT_INTAKE,
]

test('every active destination resolves to an implemented page, section, or cabinet style', () => {
  const home = readFileSync(resolve(root, 'components/HomePageClient.jsx'), 'utf8')
  const materialSlugs = new Set(materialCards.map(card => card.slug))
  const visualizer = ['CabinetConfigurator.tsx', 'ProductInfo.tsx'].map(file => readFileSync(resolve(root, 'components/configurator', file), 'utf8')).join('\n')
  for (const destination of destinations) {
    const url = new URL(destination, 'https://vulpinehomes.com')
    const page = url.pathname === '/' ? 'app/page.js' : `app${url.pathname}/page.tsx`
    const jsPage = page.replace(/\.tsx$/, '.js')
    const jsxPage = page.replace(/\.tsx$/, '.jsx')
    assert.ok([page, jsPage, jsxPage].some(file => existsSync(resolve(root, file))), `Missing page: ${destination}`)
    if (url.hash.startsWith('#material-')) {
      assert.ok(materialSlugs.has(url.hash.slice('#material-'.length)), `Missing material: ${destination}`)
      assert.match(readFileSync(resolve(root, 'components/MaterialFlipCard.jsx'), 'utf8'), /id=\{`material-\$\{slug\}`\}/)
    } else if (url.hash) {
      assert.ok((url.pathname === '/' ? home : visualizer).includes(`id="${url.hash.slice(1)}"`), `Missing section: ${destination}`)
    }
    if (url.searchParams.has('style')) assert.ok(url.searchParams.get('style')! in CONFIG_DATA.doorStyles, `Missing cabinet style: ${destination}`)
  }
})

test('unpublished destinations never become broken links or unverified portal URLs', () => {
  assert.ok(entries.some(item => item.unavailableReason))
  for (const item of entries) {
    if (!item.href && !item.children) assert.ok(item.unavailableReason, `Missing audit reason: ${item.label}`)
    if (item.unavailableReason) assert.equal(item.href, undefined)
  }
  assert.equal(PROJECT_INTAKE, '/request-bid')
  assert.ok(!destinations.some(href => href.startsWith('/submit-project')))
})

test('menu identifiers are unique and all navigation imagery is present', () => {
  const ids = [...navigationMenus.map(menu => menu.id), ...navigationMenus.flatMap(menu => menu.groups.map(group => group.id)), ...entries.map(item => item.id)]
  assert.equal(new Set(ids).size, ids.length)
  assert.deepEqual(navigationMenus.map(menu => menu.label), ['Products', 'Solutions', 'Projects', 'Resources', 'Partners', 'About'])
  for (const image of [...entries.flatMap(item => item.image ? [item.image] : []), navigationPromotion.image]) {
    assert.ok(existsSync(resolve(root, `public${image}`)), `Missing navigation image: ${image}`)
  }
})
