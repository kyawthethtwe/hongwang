import { Inject, Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { ENV, type Env } from '../../config/env';

/**
 * Owner: Bookings & Payments module. Thin wrapper so tests can replace Stripe:
 *   { provide: StripeService, useValue: { client: fakeStripe, publishableKey: 'pk_test', webhookSecret: 'whsec' } }
 * `client` is null when STRIPE_SECRET_KEY is unset: the API then runs the simulated payment flow.
 */
@Injectable()
export class StripeService {
  readonly client: Stripe | null;
  readonly publishableKey: string | null;
  readonly webhookSecret: string | null;

  constructor(@Inject(ENV) env: Env) {
    this.client = env.STRIPE_SECRET_KEY
      ? new Stripe(env.STRIPE_SECRET_KEY, { maxNetworkRetries: 2, appInfo: { name: 'Hongwang' } })
      : null;
    this.publishableKey = env.STRIPE_PUBLISHABLE_KEY ?? null;
    this.webhookSecret = env.STRIPE_WEBHOOK_SECRET ?? null;
  }
}
