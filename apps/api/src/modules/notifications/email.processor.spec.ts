import type { EmailJob, EmailTemplate } from '@hongwang/shared';
import { Logger } from '@nestjs/common';
import { UnrecoverableError, type Job } from 'bullmq';
import type { MailService } from '../../infra/mail/mail.service';
import { EmailLogRepository } from './email-log.repository';
import { EMAIL_TEMPLATE_EVENT } from './email-policy';
import { EmailProcessor, SKIPPED_BY_PREFERENCES } from './email.processor';
import type { NotificationPreferencesService } from './notification-preferences.service';
import { emailSamples } from './templates/samples';
import { fakeDb } from './testing';

const samples = emailSamples('http://localhost:3000');
const USER = '22222222-2222-4222-8222-222222222222';

function makeJob(data: Partial<EmailJob> = {}, id: string | undefined = 'job-1'): Job<EmailJob> {
  return {
    id,
    timestamp: Date.now(),
    attemptsMade: 0,
    opts: { attempts: 5 },
    data: {
      template: 'booking-confirmed-guest',
      to: 'daniel@example.com',
      data: samples['booking-confirmed-guest'][0].data,
      userId: USER,
      ...data,
    } as EmailJob,
  } as unknown as Job<EmailJob>;
}

function setup(opts: { logStatus?: 'queued' | 'sent' | 'failed'; prefEnabled?: boolean } = {}) {
  const mail = { send: jest.fn().mockResolvedValue({ messageId: '<abc@mailpit>' }) };
  const emailLog = {
    start: jest.fn().mockResolvedValue({ id: 'log-1', status: opts.logStatus ?? 'queued' }),
    markSent: jest.fn().mockResolvedValue(undefined),
    markFailed: jest.fn().mockResolvedValue(undefined),
    recordFailure: jest.fn().mockResolvedValue(undefined),
    recordSkipped: jest.fn().mockResolvedValue(undefined),
  };
  const prefs = { isEnabled: jest.fn().mockResolvedValue(opts.prefEnabled ?? true) };
  const processor = new EmailProcessor(
    mail as unknown as MailService,
    emailLog as unknown as EmailLogRepository,
    prefs as unknown as NotificationPreferencesService,
  );
  return { processor, mail, emailLog, prefs };
}

beforeAll(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});
afterAll(() => jest.restoreAllMocks());

describe('EmailProcessor', () => {
  it('logs, renders, sends and marks the row sent', async () => {
    const { processor, mail, emailLog } = setup();
    const job = makeJob();
    await expect(processor.process(job)).resolves.toEqual({ status: 'sent', logId: 'log-1', messageId: '<abc@mailpit>' });

    expect(emailLog.start).toHaveBeenCalledWith(
      { jobId: 'job-1', to: 'daniel@example.com', template: 'booking-confirmed-guest', userId: USER },
      expect.any(Date),
    );
    const since = emailLog.start.mock.calls[0]![1] as Date;
    expect(since.getTime()).toBeLessThan(job.timestamp);

    expect(mail.send).toHaveBeenCalledTimes(1);
    const sent = mail.send.mock.calls[0]![0] as { to: string; subject: string; html: string; text: string };
    expect(sent.to).toBe('daniel@example.com');
    expect(sent.subject).toBe('Confirmed: Sunny studio near BTS Ari, Dec 12 – 15');
    expect(sent.html).toContain('BK-7F3K2Q');
    expect(sent.text).toContain('BK-7F3K2Q');
    expect(emailLog.markSent).toHaveBeenCalledWith('log-1', '<abc@mailpit>');
    expect(emailLog.markFailed).not.toHaveBeenCalled();
  });

  it('does not send again when an earlier attempt already sent this job', async () => {
    const { processor, mail, emailLog } = setup({ logStatus: 'sent' });
    await expect(processor.process(makeJob())).resolves.toEqual({ status: 'already-sent', logId: 'log-1' });
    expect(mail.send).not.toHaveBeenCalled();
    expect(emailLog.markSent).not.toHaveBeenCalled();
  });

  it('fails an unknown template permanently and records it', async () => {
    const { processor, mail, emailLog } = setup();
    const job = makeJob({ template: 'birthday-card' as EmailTemplate });
    await expect(processor.process(job)).rejects.toBeInstanceOf(UnrecoverableError);
    expect(emailLog.recordFailure).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: 'job-1', template: 'birthday-card' }),
      'Unknown email template "birthday-card"',
    );
    expect(emailLog.start).not.toHaveBeenCalled();
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('still fails permanently when recording the unknown template fails', async () => {
    const { processor, emailLog } = setup();
    emailLog.recordFailure.mockRejectedValueOnce(new Error('db down'));
    await expect(processor.process(makeJob({ template: 'x' as EmailTemplate }))).rejects.toBeInstanceOf(UnrecoverableError);
  });

  it('marks the row failed and rethrows on a temporary SMTP error, so BullMQ retries', async () => {
    const { processor, mail, emailLog } = setup();
    const err = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:1025'), { code: 'ESOCKET', command: 'CONN' });
    mail.send.mockRejectedValueOnce(err);
    const result = processor.process(makeJob());
    await expect(result).rejects.toBe(err);
    await expect(result).rejects.not.toBeInstanceOf(UnrecoverableError);
    expect(emailLog.markFailed).toHaveBeenCalledWith('log-1', 'connect ECONNREFUSED 127.0.0.1:1025');
    expect(emailLog.markSent).not.toHaveBeenCalled();
  });

  it('fails permanently when the server rejects the recipient (5xx)', async () => {
    const { processor, mail, emailLog } = setup();
    mail.send.mockRejectedValueOnce(Object.assign(new Error('550 No such user'), { code: 'EENVELOPE', responseCode: 550, command: 'RCPT TO' }));
    await expect(processor.process(makeJob())).rejects.toBeInstanceOf(UnrecoverableError);
    expect(emailLog.markFailed).toHaveBeenCalledWith('log-1', '550 No such user');
  });

  it('fails permanently when the template cannot render the data', async () => {
    const { processor, mail, emailLog } = setup();
    await expect(processor.process(makeJob({ data: null as never }))).rejects.toBeInstanceOf(UnrecoverableError);
    expect(emailLog.markFailed).toHaveBeenCalledWith('log-1', expect.stringContaining('Could not render booking-confirmed-guest'));
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('does not throw (and so never resends) when the sent row cannot be written', async () => {
    const { processor, mail, emailLog } = setup();
    emailLog.markSent.mockRejectedValueOnce(new Error('db down'));
    await expect(processor.process(makeJob())).resolves.toMatchObject({ status: 'sent' });
    expect(mail.send).toHaveBeenCalledTimes(1);
  });

  it('lets a database error before sending fail the attempt (retryable)', async () => {
    const { processor, mail, emailLog } = setup();
    emailLog.start.mockRejectedValueOnce(new Error('db down'));
    await expect(processor.process(makeJob())).rejects.toThrow('db down');
    expect(mail.send).not.toHaveBeenCalled();
  });

  describe('shouldSend (preferences)', () => {
    it('always sends locked booking mail and account mail without a lookup', async () => {
      const { processor, prefs } = setup({ prefEnabled: false });
      await expect(processor.shouldSend(makeJob().data)).resolves.toBe(true);
      await expect(
        processor.shouldSend(makeJob({ template: 'password-reset', data: samples['password-reset'][0].data }).data),
      ).resolves.toBe(true);
      expect(prefs.isEnabled).not.toHaveBeenCalled();
    });

    describe('for an email mapped to an unlocked event', () => {
      const original = EMAIL_TEMPLATE_EVENT.welcome;
      beforeAll(() => {
        (EMAIL_TEMPLATE_EVENT as Record<string, unknown>).welcome = 'news';
      });
      afterAll(() => {
        (EMAIL_TEMPLATE_EVENT as Record<string, unknown>).welcome = original;
      });
      const welcomeJob = (userId?: string) =>
        makeJob({ template: 'welcome', data: samples.welcome[0].data, ...(userId ? { userId } : { userId: undefined }) });

      it('skips the email when the user turned it off', async () => {
        const { processor, prefs, mail, emailLog } = setup({ prefEnabled: false });
        await expect(processor.process(welcomeJob(USER))).resolves.toEqual({ status: 'skipped', reason: 'preferences' });
        expect(prefs.isEnabled).toHaveBeenCalledWith(USER, 'news', 'email');
        expect(mail.send).not.toHaveBeenCalled();
        expect(emailLog.start).not.toHaveBeenCalled();
        expect(emailLog.recordSkipped).toHaveBeenCalledWith(
          { jobId: 'job-1', to: expect.any(String), template: 'welcome', userId: USER },
          SKIPPED_BY_PREFERENCES,
          expect.any(Date),
        );
      });

      it('still skips when the skipped row can’t be written', async () => {
        const { processor, mail, emailLog } = setup({ prefEnabled: false });
        emailLog.recordSkipped.mockRejectedValueOnce(new Error('db down'));
        await expect(processor.process(welcomeJob(USER))).resolves.toEqual({ status: 'skipped', reason: 'preferences' });
        expect(mail.send).not.toHaveBeenCalled();
      });

      it('sends when the user has it on, or when there is no user id', async () => {
        const on = setup({ prefEnabled: true });
        await expect(on.processor.process(welcomeJob(USER))).resolves.toMatchObject({ status: 'sent' });
        const anon = setup({ prefEnabled: false });
        await expect(anon.processor.process(welcomeJob())).resolves.toMatchObject({ status: 'sent' });
        expect(anon.prefs.isEnabled).not.toHaveBeenCalled();
      });
    });
  });
});

describe('EmailLogRepository', () => {
  const entry = { jobId: 'job-1', to: 'daniel@example.com', template: 'welcome', userId: USER };
  const since = new Date('2026-12-10T07:00:00Z');

  it('inserts a queued row on the first attempt', async () => {
    const fake = fakeDb([[], [{ id: 'log-1', status: 'queued' }]]);
    await expect(new EmailLogRepository(fake.db as never).start(entry, since)).resolves.toEqual({ id: 'log-1', status: 'queued' });
    expect(fake.chains.map((c) => c[0]!.op)).toEqual(['select', 'insert']);
    expect(fake.call(1, 'values')).toEqual([{ ...entry, status: 'queued' }]);
  });

  it('reuses the row on a retry and puts a failed row back to queued', async () => {
    const fake = fakeDb([[{ id: 'log-1', status: 'failed' }], undefined]);
    await expect(new EmailLogRepository(fake.db as never).start(entry, since)).resolves.toEqual({ id: 'log-1', status: 'queued' });
    expect(fake.chains.map((c) => c[0]!.op)).toEqual(['select', 'update']);
    expect(fake.call(1, 'set')).toEqual([{ status: 'queued' }]);
  });

  it('returns a sent row as sent, without writing', async () => {
    const fake = fakeDb([[{ id: 'log-1', status: 'sent' }]]);
    await expect(new EmailLogRepository(fake.db as never).start(entry, since)).resolves.toEqual({ id: 'log-1', status: 'sent' });
    expect(fake.chains).toHaveLength(1);
  });

  it('logs without the user when the user no longer exists', async () => {
    const fk = Object.assign(new Error('insert or update violates foreign key constraint'), { code: '23503' });
    const fake = fakeDb([[], fk, [{ id: 'log-2', status: 'queued' }]]);
    await expect(new EmailLogRepository(fake.db as never).start(entry, since)).resolves.toEqual({ id: 'log-2', status: 'queued' });
    expect(fake.call(2, 'values')).toEqual([{ ...entry, userId: null, status: 'queued' }]);
  });

  it('records a skipped email once per job, with the reason', async () => {
    const fake = fakeDb([[], [{ id: 'log-3', status: 'skipped' }]]);
    await new EmailLogRepository(fake.db as never).recordSkipped(entry, 'Turned off', since);
    expect(fake.chains.map((c) => c[0]!.op)).toEqual(['select', 'insert']);
    expect(fake.call(1, 'values')).toEqual([{ ...entry, status: 'skipped', error: 'Turned off' }]);

    const again = fakeDb([[{ id: 'log-3', status: 'skipped' }]]);
    await new EmailLogRepository(again.db as never).recordSkipped(entry, 'Turned off', since);
    expect(again.chains).toHaveLength(1);
  });

  it('marks sent with the provider id and clears the error; marks failed with a clipped error', async () => {
    const fake = fakeDb([undefined, undefined]);
    const repo = new EmailLogRepository(fake.db as never);
    await repo.markSent('log-1', '<abc@mailpit>');
    await repo.markFailed('log-1', 'x'.repeat(5000));
    expect(fake.call(0, 'set')).toEqual([{ status: 'sent', providerMessageId: '<abc@mailpit>', sentAt: expect.any(Date), error: null }]);
    const failed = fake.call(1, 'set')![0] as { status: string; error: string };
    expect(failed.status).toBe('failed');
    expect(failed.error).toHaveLength(2000);
  });
});
