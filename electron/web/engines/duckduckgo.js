import { hostWithin, redirectTarget } from './hosts.js'

export default {
  id: 'duckduckgo',
  url: query => `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
  serp: {
    container: ['.result', '.web-result'],
    title: ['.result__a', 'h2 a'],
    snippet: ['.result__snippet'],
  },
  // Every organic link goes through `duckduckgo.com/l/?uddg=<target>`.
  unwrap: url => (hostWithin(url.hostname, 'duckduckgo.com') ? redirectTarget(url, 'uddg') : null),
  ownsHost: host => hostWithin(host, 'duckduckgo.com'),
  challenge: /anomaly|bots use duckduckgo/i,
}
