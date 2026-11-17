import { HttpException } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Env } from '../../config/env';
import { EmailPreviewController } from './email-preview.controller';

interface FakeRes {
  body: unknown;
  contentType: string | undefined;
  type: jest.Mock<FakeRes, [string]>;
  send: jest.Mock<FakeRes, [unknown]>;
  json: jest.Mock<FakeRes, [unknown]>;
}

function fakeRes(): FakeRes {
  const res: FakeRes = {
    body: undefined,
    contentType: undefined,
    type: jest.fn((t: string) => {
      res.contentType = t;
      return res;
    }),
    send: jest.fn((b: unknown) => {
      res.body = b;
      return res;
    }),
    json: jest.fn((b: unknown) => {
      res.body = b;
      return res;
    }),
  };
  return res;
}

const env = (NODE_ENV: Env['NODE_ENV']) => ({ NODE_ENV, WEB_ORIGIN: 'http://localhost:3000' }) as Env;
const req = { originalUrl: '/api/notifications/dev/preview/' } as Request;

describe('EmailPreviewController', () => {
  const dev = new EmailPreviewController(env('development'));

  it('lists every template and variant with links', () => {
    const res = fakeRes();
    dev.index(req, res as unknown as Response);
    expect(res.contentType).toBe('html');
    const html = res.body as string;
    expect(html).toContain('href="/api/notifications/dev/preview/booking-expired-guest?variant=hold"');
    expect(html).toContain('href="/api/notifications/dev/preview/booking-expired-guest?variant=request&amp;format=text"');
    expect(html).toContain('href="/api/notifications/dev/preview/verify-email?variant=default"');
    expect(html).toContain('Confirm your email for Hongwang');
  });

  it('renders a template as HTML, text or JSON', () => {
    const html = fakeRes();
    dev.preview('booking-approved-guest', undefined, undefined, html as unknown as Response);
    expect(html.contentType).toBe('html');
    expect(html.body).toContain('Daniel');
    expect(html.body).toContain('http://localhost:3000/checkout/');

    const text = fakeRes();
    dev.preview('booking-expired-guest', 'request', 'text', text as unknown as Response);
    expect(text.contentType).toBe('text/plain; charset=utf-8');
    expect(text.body).toMatch(/^Subject: Your request to Ploy has expired\n/);

    const json = fakeRes();
    dev.preview('welcome', undefined, 'json', json as unknown as Response);
    expect(json.body).toMatchObject({ template: 'welcome', variant: 'default', subject: 'Welcome to Hongwang, Daniel' });
  });

  it('404s unknown templates and variants', () => {
    expect(() => dev.preview('nope', undefined, undefined, fakeRes() as unknown as Response)).toThrow(HttpException);
    expect(() => dev.preview('welcome', 'nope', undefined, fakeRes() as unknown as Response)).toThrow('Sample variant not found');
  });

  it('is a 404 in production', () => {
    const prod = new EmailPreviewController(env('production'));
    const res = fakeRes();
    let status: number | undefined;
    try {
      prod.index(req, res as unknown as Response);
    } catch (e) {
      status = (e as HttpException).getStatus();
    }
    expect(status).toBe(404);
    expect(() => prod.preview('welcome', undefined, undefined, res as unknown as Response)).toThrow(HttpException);
    expect(res.send).not.toHaveBeenCalled();
  });
});
