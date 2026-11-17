import { createTransport } from 'nodemailer';
import type { Env } from '../../config/env';
import { isPermanentMailError, MailService, smtpTransportUrl } from './mail.service';

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

const env = { SMTP_URL: 'smtp://localhost:1025', MAIL_FROM: 'Hongwang <no-reply@hongwang.local>' } as Env;

describe('smtpTransportUrl', () => {
  it('pools connections by default', () => {
    expect(smtpTransportUrl('smtp://localhost:1025')).toBe('smtp://localhost:1025?pool=true&maxConnections=5');
  });

  it('keeps credentials and explicit options', () => {
    expect(smtpTransportUrl('smtps://user:p%40ss@smtp.example.com:465?pool=false', 3)).toBe(
      'smtps://user:p%40ss@smtp.example.com:465?pool=false&maxConnections=3',
    );
  });
});

describe('isPermanentMailError', () => {
  it.each([
    [{ code: 'EENVELOPE', responseCode: 550, command: 'RCPT TO' }, true],
    [{ code: 'EENVELOPE' }, true], // no recipients
    [{ code: 'EMESSAGE', responseCode: 554, command: 'DATA' }, true],
    [{ code: 'EENVELOPE', responseCode: 452, command: 'RCPT TO' }, false],
    [{ code: 'EAUTH', responseCode: 535, command: 'AUTH PLAIN' }, false],
    [{ code: 'ESOCKET', command: 'CONN' }, false],
    [new Error('timeout'), false],
    ['nope', false],
  ])('%p -> %p', (err, permanent) => {
    expect(isPermanentMailError(err)).toBe(permanent);
  });
});

describe('MailService', () => {
  const sendMail = jest.fn();
  const close = jest.fn();

  beforeEach(() => {
    sendMail.mockReset();
    close.mockReset();
    jest.mocked(createTransport).mockReturnValue({ sendMail, close } as never);
  });

  it('creates a pooled SMTP transport from SMTP_URL', () => {
    new MailService(env);
    expect(createTransport).toHaveBeenCalledWith('smtp://localhost:1025?pool=true&maxConnections=5');
  });

  it('sends from MAIL_FROM with html and text, returning the Message-ID', async () => {
    sendMail.mockResolvedValue({ messageId: '<1@mailpit>' });
    const result = await new MailService(env).send({ to: 'ploy@example.com', subject: 'Hi', html: '<p>Hi</p>', text: 'Hi' });
    expect(sendMail).toHaveBeenCalledWith({
      from: 'Hongwang <no-reply@hongwang.local>',
      to: 'ploy@example.com',
      subject: 'Hi',
      html: '<p>Hi</p>',
      text: 'Hi',
    });
    expect(result).toEqual({ messageId: '<1@mailpit>' });
  });

  it('propagates SMTP errors and closes the pool on shutdown', async () => {
    sendMail.mockRejectedValue(new Error('ECONNREFUSED'));
    const service = new MailService(env);
    await expect(service.send({ to: 'a@b.c', subject: 's', html: 'h', text: 't' })).rejects.toThrow('ECONNREFUSED');
    service.onApplicationShutdown();
    expect(close).toHaveBeenCalled();
  });
});
