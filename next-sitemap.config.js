/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: 'https://vulpinehomes.com',
  generateRobotsTxt: true,
  outDir: './public',
  changefreq: 'weekly',
  priority: 0.7,
  sitemapSize: 5000,
  exclude: ['/thank-you'],
  robotsTxtOptions: {
    policies: [{ userAgent: '*', allow: '/' }],
  },
};
