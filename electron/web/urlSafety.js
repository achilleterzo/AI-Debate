import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

function privateIPv4(address) {
  const parts = address.split('.').map(Number)
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return true
  const [a, b] = parts
  return a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19))
    || a >= 224
}

function privateIp(address) {
  const kind = isIP(address)
  if (kind === 4) return privateIPv4(address)
  if (kind !== 6) return true
  const value = address.toLowerCase().split('%')[0]
  if (value === '::' || value === '::1' || value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe8') || value.startsWith('fe9') || value.startsWith('fea') || value.startsWith('feb')) return true
  const mapped = value.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  return mapped ? privateIPv4(mapped[1]) : false
}

function localHostname(hostname) {
  const value = hostname.toLowerCase().replace(/\.$/, '')
  return value === 'localhost'
    || value.endsWith('.localhost')
    || value.endsWith('.local')
    || value.endsWith('.internal')
}

export async function assertPublicHttpUrl(raw, dnsCache = new Map()) {
  let parsed
  try { parsed = new URL(String(raw || '')) } catch { throw new Error('Invalid URL') }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only http(s) URLs are allowed')
  if (parsed.username || parsed.password) throw new Error('URLs containing credentials are not allowed')
  if (!parsed.hostname || localHostname(parsed.hostname)) throw new Error('Local network URLs are not allowed')

  if (isIP(parsed.hostname)) {
    if (privateIp(parsed.hostname)) throw new Error('Private network URLs are not allowed')
    return parsed.toString()
  }

  let pending = dnsCache.get(parsed.hostname)
  if (!pending) {
    pending = lookup(parsed.hostname, { all: true, verbatim: true })
    dnsCache.set(parsed.hostname, pending)
  }
  const addresses = await pending
  if (!addresses.length || addresses.some(entry => privateIp(entry.address))) {
    throw new Error('The hostname resolves to a private or unavailable address')
  }
  return parsed.toString()
}

