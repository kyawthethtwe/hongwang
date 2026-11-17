import {
  BOOKING_ACTORS,
  BOOKING_STATUSES,
  CANCELLATION_POLICIES,
  KYC_STATUSES,
  LISTING_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  PROPERTY_TYPES,
  ROOM_TYPES,
  USER_ROLES,
} from '@hongwang/shared';
import { pgEnum } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', USER_ROLES);
export const kycStatusEnum = pgEnum('kyc_status', KYC_STATUSES);
export const verificationKindEnum = pgEnum('verification_kind', ['email_verify', 'password_reset', 'phone_otp']);
export const listingStatusEnum = pgEnum('listing_status', LISTING_STATUSES);
export const roomTypeEnum = pgEnum('room_type', ROOM_TYPES);
export const propertyTypeEnum = pgEnum('property_type', PROPERTY_TYPES);
export const cancellationPolicyEnum = pgEnum('cancellation_policy', CANCELLATION_POLICIES);
export const bookingStatusEnum = pgEnum('booking_status', BOOKING_STATUSES);
export const bookingActorEnum = pgEnum('booking_actor', BOOKING_ACTORS);
export const paymentStatusEnum = pgEnum('payment_status', PAYMENT_STATUSES);
export const paymentMethodEnum = pgEnum('payment_method', PAYMENT_METHODS);
export const emailStatusEnum = pgEnum('email_status', ['queued', 'sent', 'failed']);
