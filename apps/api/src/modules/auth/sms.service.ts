import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENV, type Env } from '../../config/env';

/**
 * Text messages (phone sign-in codes). SMS_DRIVER=log prints the message to the API log, which is
 * all development needs; a real provider (Twilio, ThaiBulkSMS) slots in behind `send`.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(@Inject(ENV) private readonly env: Env) {}

  async send(to: string, body: string): Promise<void> {
    switch (this.env.SMS_DRIVER) {
      case 'log':
      default:
        this.logger.log(`SMS to ${to}: ${body}`);
    }
  }
}
