import { redirectTarget } from './hosts.js'

// google.com, google.it, google.co.uk, …: any registrable "google." domain.
const GOOGLE_HOST = /(^|\.)google\.[a-z.]+$/i

export default {
  id: 'google',
  url: query => `https://www.google.com/search?q=${encodeURIComponent(query)}&gbv=1&hl=en&pws=0&filter=0`,
  serp: {
    container: ['div.MjjYud', 'div.g'],
    title: ['h3'],
    snippet: ['.VwiC3b', '[data-sncf]', 'p'],
  },
  // The basic-HTML page links through `/url?q=<target>`.
  unwrap: url => (GOOGLE_HOST.test(url.hostname) && url.pathname === '/url'
    ? redirectTarget(url, 'q') ?? redirectTarget(url, 'url')
    : null),
  ownsHost: host => GOOGLE_HOST.test(host) || /(^|\.)(gstatic|googleusercontent)\.com$/i.test(host),
  challenge: /unusual traffic|\/sorry\//i,
}
