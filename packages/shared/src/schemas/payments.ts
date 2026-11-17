import { z } from 'zod';
import { PAYMENT_METHODS } from '../enums';
import type { Satang } from '../money';

/**
 * Payments contract. Owner: Bookings & Payments module. Stripe in test mode.
 *
 *   POST /payments/intent               CreatePaymentIntentInput -> PaymentIntentDto
 *   POST /payments/webhook              (Stripe-signed raw body) -> 200
 *   POST /payments/:bookingId/simulate  -                         -> BookingDto
 *        Dev only: when STRIPE_SECRET_KEY is unset and NODE_ENV !== 'production', marks the
 *        payment succeeded through the same code path the webhook uses.
 *
 * A booking is confirmed ONLY by the webhook (or simulate), never by the browser redirect.
 * Errors: 410 HOLD_EXPIRED (hold ran out), 409 INVALID_TRANSITION (not in payment_hold),
 *         403 FORBIDDEN (not the guest).
 * Stripe: one PaymentIntent per booking (amount = booking total in satang, currency thb),
 * payment_method_types ['promptpay'] for PromptPay, ['card'] otherwise; metadata.bookingId.
 */

export const bookingIdParamSchema = z.object({ bookingId: z.uuid() });
export type BookingIdParam = z.infer<typeof bookingIdParamSchema>;

export const createPaymentIntentInputSchema = z.object({
  bookingId: z.uuid(),
  method: z.enum(PAYMENT_METHODS).default('card'),
});
export type CreatePaymentIntentInput = z.input<typeof createPaymentIntentInputSchema>;

export interface PaymentIntentDto {
  mode: 'stripe' | 'simulated';
  /** Stripe PaymentIntent client secret (mode 'stripe'). */
  clientSecret: string | null;
  publishableKey: string | null;
  amount: Satang;
  currency: 'THB';
  holdExpiresAt: string;
}
