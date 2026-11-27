import { Injectable } from '@nestjs/common';
import { and, eq, gte } from 'drizzle-orm';
import { PG_ERRORS, pgError } from '../../common/errors';
import { InjectDb, type Database } from '../../database/database.module';
import { emailLog } from '../../database/schema';

export type EmailLogStatus = (typeof emailLog.$inferSelect)['status'];

export interface EmailLogEntry {
  /** BullMQ job id; retries of one job update the same row. */
  jobId: string | null;
  to: string;
  template: string;
  userId: string | null;
}

/** Column limits from src/database/schema/users.ts. */
const clip = (s: string, max: number) => (s.length > max ? s.slice(0, max) : s);
const MAX_ERROR = 2000;

/**
 * Owner: Notifications & Workers module. email_log rows: queued -> sent | failed, or skipped when
 * the user's preferences turned the email off. One row per job.
 */
@Injectable()
export class EmailLogRepository {
  constructor(@InjectDb() private readonly db: Database) {}

  /**
   * Finds this job's row (a retry) or inserts a queued one. `since` is the job's creation time:
   * a custom jobId can be reused once the old job is removed from Redis, and that must be a new
   * email, not a duplicate of the old row.
   */
  async start(entry: EmailLogEntry, since: Date): Promise<{ id: string; status: EmailLogStatus }> {
    const existing = entry.jobId ? await this.findForJob(entry.jobId, since) : null;
    if (existing) {
      if (existing.status === 'failed') {
        await this.db.update(emailLog).set({ status: 'queued' }).where(eq(emailLog.id, existing.id));
        return { id: existing.id, status: 'queued' };
      }
      return existing;
    }
    return this.insertRow(entry, { status: 'queued' });
  }

  /** The user's preferences turned this email off: a 'skipped' row with the reason in `error`, once per job. */
  async recordSkipped(entry: EmailLogEntry, reason: string, since: Date): Promise<void> {
    if (entry.jobId && (await this.findForJob(entry.jobId, since))) return;
    await this.insertRow(entry, { status: 'skipped', error: clip(reason, MAX_ERROR) });
  }

  private async findForJob(jobId: string, since: Date): Promise<{ id: string; status: EmailLogStatus } | null> {
    const [row] = await this.db
      .select({ id: emailLog.id, status: emailLog.status })
      .from(emailLog)
      .where(and(eq(emailLog.jobId, jobId), gte(emailLog.createdAt, since)))
      .limit(1);
    return row ?? null;
  }

  private async insertRow(
    entry: EmailLogEntry,
    state: { status: EmailLogStatus; error?: string },
  ): Promise<{ id: string; status: EmailLogStatus }> {
    const insert = (userId: string | null) =>
      this.db
        .insert(emailLog)
        .values({ jobId: entry.jobId, to: clip(entry.to, 254), template: clip(entry.template, 60), userId, ...state })
        .returning({ id: emailLog.id, status: emailLog.status });
    let rows: Array<{ id: string; status: EmailLogStatus }>;
    try {
      rows = await insert(entry.userId);
    } catch (err) {
      // The user was deleted after the job was queued: still log (and send) the email.
      if (!entry.userId || pgError(err)?.code !== PG_ERRORS.foreignKeyViolation) throw err;
      rows = await insert(null);
    }
    const [row] = rows;
    if (!row) throw new Error('email_log insert returned no row');
    return row;
  }

  async markSent(id: string, providerMessageId: string): Promise<void> {
    await this.db
      .update(emailLog)
      .set({ status: 'sent', providerMessageId: providerMessageId || null, sentAt: new Date(), error: null })
      .where(eq(emailLog.id, id));
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.db.update(emailLog).set({ status: 'failed', error: clip(error, MAX_ERROR) }).where(eq(emailLog.id, id));
  }

  /**
   * A job that failed before it had a row (unknown template): insert it as failed. Without the
   * user id, so a malformed job can't also fail on the foreign key.
   */
  async recordFailure(entry: Omit<EmailLogEntry, 'userId'>, error: string): Promise<void> {
    await this.db.insert(emailLog).values({
      jobId: entry.jobId,
      to: clip(entry.to, 254),
      template: clip(entry.template, 60),
      userId: null,
      status: 'failed',
      error: clip(error, MAX_ERROR),
    });
  }
}
