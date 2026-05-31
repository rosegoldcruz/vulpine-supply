/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: 'https://vulpinehomes.com',
  generateRobotsTxt: true,
  outDir: './public',
  changefreq: 'weekly',
  priority: 0.7,
  sitemapSize: 5000,
  robotsTxtOptions: {
    policies: [{ userAgent: '*', allow: '/' }],
  },
};
