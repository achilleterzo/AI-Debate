import { hostWithin } from './hosts.js'

/**
 * Qwant renders results client-side from its own API. Read too early, the
 * page shows "temporarily unavailable (HTTP 403)"; read once a result is in
 * the DOM, it is complete. lite.qwant.com now redirects here, so there is no
 * server-rendered alternative left.
 */
export default {
  id: 'qwant',
  url: query => `https://www.qwant.com/?q=${encodeURIComponent(query)}&t=web`,
  waitFor: '[data-testid="webResult"]',
  serp: {
    // Ads carry `adResult` instead, so they never match.
    container: ['[data-testid="webResult"]'],
    title: ['h2 a'],
    // Class names are hashed per build; the snippet is the block after the title.
    snippet: ['h2 + div'],
  },
  // The page footer links to app stores and job boards: a Qwant page with no
  // result containers has nothing else worth reading.
  tiers: ['primary', 'heading'],
  unwrap: () => null,
  ownsHost: host => hostWithin(host, 'qwant.com') || hostWithin(host, 'qwantjunior.com'),
  challenge: /\(HTTP 4\d\d\)|captcha|verify you are human/i,
}
