/** True for `domain` itself and any of its subdomains. */
export function hostWithin(host, domain) {
  const value = String(host || '').toLowerCase()
  return value === domain || value.endsWith(`.${domain}`)
}

/** The target hidden in `param` of a redirect URL, when it is an http(s) URL. */
export function redirectTarget(url, param) {
  const target = url.searchParams.get(param)
  return target && /^https?:\/\//i.test(target) ? target : null
}
