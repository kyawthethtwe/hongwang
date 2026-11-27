import { crossSiteProblem } from './csrf';

const WEB = 'http://localhost:3000';
const req = (method: string, headers: Record<string, string> = {}) => ({ method, headers: { host: 'localhost:4000', ...headers } });

describe('crossSiteProblem', () => {
  it('lets the web app and the API’s own pages through', () => {
    expect(crossSiteProblem(req('POST', { origin: WEB, 'content-type': 'application/json' }), WEB)).toBeNull();
    expect(crossSiteProblem(req('PATCH', { origin: 'http://localhost:4000', 'content-type': 'application/json' }), WEB)).toBeNull();
  });

  it('lets clients without an Origin through (servers, curl, Stripe webhooks)', () => {
    expect(crossSiteProblem(req('POST', { 'content-type': 'application/json; charset=utf-8' }), WEB)).toBeNull();
    expect(crossSiteProblem(req('DELETE'), WEB)).toBeNull();
  });

  it('refuses another origin, a look-alike and the opaque "null" origin', () => {
    for (const origin of ['https://evil.example', 'http://localhost:3001', 'https://localhost:3000', 'null', 'not a url']) {
      expect(crossSiteProblem(req('POST', { origin, 'content-type': 'application/json' }), WEB)).toBe('origin');
    }
  });

  it('refuses form-style bodies on unsafe methods', () => {
    for (const type of ['application/x-www-form-urlencoded', 'multipart/form-data; boundary=x', 'TEXT/PLAIN;charset=UTF-8']) {
      expect(crossSiteProblem(req('POST', { origin: WEB, 'content-type': type }), WEB)).toBe('content-type');
      expect(crossSiteProblem(req('PUT', { 'content-type': type }), WEB)).toBe('content-type');
    }
  });

  it('allows image uploads and ignores safe methods', () => {
    expect(crossSiteProblem(req('PUT', { origin: WEB, 'content-type': 'image/jpeg' }), WEB)).toBeNull();
    expect(crossSiteProblem(req('GET', { origin: 'https://evil.example', 'content-type': 'text/plain' }), WEB)).toBeNull();
    expect(crossSiteProblem(req('OPTIONS', { origin: 'https://evil.example' }), WEB)).toBeNull();
  });
});
