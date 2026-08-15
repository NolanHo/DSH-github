/** Fence tests: loopback Host passes, trusted authorities pass, cross-site
 * browser markers and mismatched origins refuse, missing Host refuses. */
import { describe, expect, it } from 'vitest'

import { isLoopbackHostname, isTrustedApiRequest } from '../src/fence.ts'

function req(headers: Record<string, string>): { headers: Record<string, string | string[] | undefined> } {
  return { headers }
}

describe('trust fence', () => {
  it('accepts loopback Hosts with no browser markers', () => {
    expect(isTrustedApiRequest(req({ host: '127.0.0.1:3080' }), [])).toBe(true)
    expect(isTrustedApiRequest(req({ host: 'localhost:3080' }), [])).toBe(true)
    expect(isTrustedApiRequest(req({ host: '[::1]:3080' }), [])).toBe(true)
  })

  it('accepts a trusted authority (exact and port-less) and a same-origin Origin', () => {
    expect(isTrustedApiRequest(req({ host: 'dsh.example.com', origin: 'https://dsh.example.com' }), ['dsh.example.com'])).toBe(true)
    expect(isTrustedApiRequest(req({ host: 'dsh.example.com:8443', origin: 'https://dsh.example.com:8443' }), ['dsh.example.com'])).toBe(true)
  })

  it('refuses an untrusted Host', () => {
    expect(isTrustedApiRequest(req({ host: 'evil.example.com' }), ['dsh.example.com'])).toBe(false)
  })

  it('refuses cross-site browser markers and mismatched origins', () => {
    expect(isTrustedApiRequest(req({ host: '127.0.0.1', 'sec-fetch-site': 'cross-site' }), [])).toBe(false)
    expect(isTrustedApiRequest(req({ host: '127.0.0.1', origin: 'https://evil.example.com' }), [])).toBe(false)
    expect(isTrustedApiRequest(req({}), [])).toBe(false)
    expect(isTrustedApiRequest(req({ host: 'not a host!!' }), [])).toBe(false)
  })

  it('classifies loopback hostnames', () => {
    expect(isLoopbackHostname('127.0.0.1')).toBe(true)
    expect(isLoopbackHostname('localhost')).toBe(true)
    expect(isLoopbackHostname('127.255.255.255')).toBe(true)
    expect(isLoopbackHostname('128.0.0.1')).toBe(false)
    expect(isLoopbackHostname('example.com')).toBe(false)
  })
})
