import type { IncomingMessage, ServerResponse } from 'node:http';
import request from 'supertest';
import { securityHeaders } from './security-headers';

/** A bare Node handler running the middleware, then answering with JSON. */
function app(nodeEnv: 'production' | 'development') {
  const middleware = securityHeaders({ NODE_ENV: nodeEnv });
  return (req: IncomingMessage, res: ServerResponse) =>
    middleware(req, res, () => {
      res.setHeader('Content-Type', 'application/json');
      res.end('{"ok":true}');
    });
}

describe('securityHeaders', () => {
  it('locks responses down in production', async () => {
    const res = await request(app('production')).get('/x');
    expect(res.headers['content-security-policy']).toBe("default-src 'none';frame-ancestors 'none';base-uri 'none';form-action 'none'");
    expect(res.headers['strict-transport-security']).toBe('max-age=63072000; includeSubDomains');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['cross-origin-resource-policy']).toBe('same-site');
  });

  it('leaves CSP and HSTS off in development, where Swagger and the email preview are HTML pages', async () => {
    const res = await request(app('development')).get('/x');
    expect(res.headers['content-security-policy']).toBeUndefined();
    expect(res.headers['strict-transport-security']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['cross-origin-resource-policy']).toBe('same-site');
  });
});
