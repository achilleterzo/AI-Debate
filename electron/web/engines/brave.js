import { hostWithin } from './hosts.js'

export default {
  id: 'brave',
  url: query => `https://search.brave.com/search?q=${encodeURIComponent(query)}&source=web`,
  serp: {
    container: ['#results .snippet', '.snippet[data-type="web"]', '.search-result'],
    title: ['.snippet-title', 'h2 a', 'a h3', 'h3 a'],
    snippet: ['.snippet-description', '[data-testid="description"]', '.generic-snippet', 'p'],
  },
  unwrap: () => null,
  ownsHost: host => hostWithin(host, 'brave.com'),
  challenge: /pow captcha|verify you are human/i,
}
