import { hostWithin, redirectTarget } from './hosts.js'

const YANDEX_DOMAINS = ['yandex.com', 'yandex.ru', 'yandex.net', 'ya.ru', 'yandex.com.tr', 'yandex.kz', 'yandex.by']

export default {
  id: 'yandex',
  // The query parameter is `text`, not `q`.
  url: query => `https://yandex.com/search/?text=${encodeURIComponent(query)}`,
  serp: {
    container: ['li.serp-item', '.serp-item'],
    title: ['.OrganicTitle-Link', 'h2 a', 'a h2'],
    snippet: ['.OrganicTextContentSpan', '.TextContainer', '.Organic-ContentWrapper', 'p'],
  },
  // Organic links are direct today; older layouts went through /clck/jsredir?url=.
  unwrap: url => (YANDEX_DOMAINS.some(domain => hostWithin(url.hostname, domain)) ? redirectTarget(url, 'url') : null),
  ownsHost: host => YANDEX_DOMAINS.some(domain => hostWithin(host, domain)),
  challenge: /showcaptcha|smartcaptcha|are you not a robot|вы не робот/i,
}
