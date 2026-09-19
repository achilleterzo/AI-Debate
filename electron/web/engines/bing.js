import { Buffer } from 'node:buffer'
import { hostWithin } from './hosts.js'

/**
 * Bing wraps organic links in `bing.com/ck/a?...&u=a1<base64url(target)>`.
 * Left wrapped, the link looks Bing-owned and the result is discarded.
 */
function decodeClickThrough(url) {
  const encoded = url.searchParams.get('u')
  if (!encoded?.startsWith('a1')) return null
  try {
    const target = Buffer.from(encoded.slice(2), 'base64url').toString('utf8')
    return /^https?:\/\//i.test(target) ? target : null
  } catch { return null }
}

export default {
  id: 'bing',
  url: query => `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
  serp: {
    container: ['li.b_algo'],
    title: ['h2 a'],
    snippet: ['.b_caption p', '.b_lineclamp2', '.b_lineclamp3', 'p'],
  },
  unwrap: url => (hostWithin(url.hostname, 'bing.com') && url.pathname.startsWith('/ck/') ? decodeClickThrough(url) : null),
  ownsHost: host => hostWithin(host, 'bing.com') || hostWithin(host, 'microsoft.com') || hostWithin(host, 'msn.com'),
  challenge: /one last step|solve the challenge/i,
}
