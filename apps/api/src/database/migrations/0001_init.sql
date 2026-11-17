CREATE TYPE "public"."booking_actor" AS ENUM('guest', 'host', 'admin', 'system');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('requested', 'payment_hold', 'confirmed', 'completed', 'rejected', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."cancellation_policy" AS ENUM('flexible', 'moderate', 'strict');--> statement-breakpoint
CREATE TYPE "public"."email_status" AS ENUM('queued', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."kyc_status" AS ENUM('none', 'pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('draft', 'in_review', 'published', 'paused', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('card', 'promptpay', 'mobile_banking');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'succeeded', 'failed', 'cancelled', 'refunded', 'partially_refunded');--> statement-breakpoint
CREATE TYPE "public"."property_type" AS ENUM('condo', 'apartment', 'house', 'townhouse', 'shophouse');--> statement-breakpoint
CREATE TYPE "public"."room_type" AS ENUM('entire_place', 'private_room', 'shared_room');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."verification_kind" AS ENUM('email_verify', 'password_reset', 'phone_otp');--> statement-breakpoint
CREATE TABLE "email_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"to" varchar(254) NOT NULL,
	"template" varchar(60) NOT NULL,
	"status" "email_status" DEFAULT 'queued' NOT NULL,
	"error" text,
	"provider_message_id" text,
	"job_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"user_id" uuid NOT NULL,
	"event" varchar(40) NOT NULL,
	"channel" varchar(10) NOT NULL,
	"enabled" boolean NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_user_id_event_channel_pk" PRIMARY KEY("user_id","event","channel")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"user_agent" text,
	"ip" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" "citext",
	"password_hash" text,
	"first_name" varchar(60) NOT NULL,
	"last_name" varchar(60) DEFAULT '' NOT NULL,
	"phone" varchar(20),
	"email_verified_at" timestamp with time zone,
	"phone_verified_at" timestamp with time zone,
	"google_id" text,
	"avatar_url" text,
	"about" text,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"kyc_status" "kyc_status" DEFAULT 'none' NOT NULL,
	"host_profile" jsonb,
	"stripe_account_id" text,
	"stripe_customer_id" text,
	"line_opt_in" boolean DEFAULT false NOT NULL,
	"locale" varchar(5) DEFAULT 'en' NOT NULL,
	"currency" varchar(3) DEFAULT 'THB' NOT NULL,
	"timezone" varchar(40) DEFAULT 'Asia/Bangkok' NOT NULL,
	"password_changed_at" timestamp with time zone,
	"suspended_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_phone_unique" UNIQUE("phone"),
	CONSTRAINT "users_google_id_unique" UNIQUE("google_id"),
	CONSTRAINT "users_email_or_phone" CHECK ("users"."email" is not null or "users"."phone" is not null)
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"kind" "verification_kind" NOT NULL,
	"target" varchar(254) NOT NULL,
	"token_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_blocks" (
	"listing_id" uuid NOT NULL,
	"date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_blocks_listing_id_date_pk" PRIMARY KEY("listing_id","date")
);
--> statement-breakpoint
CREATE TABLE "listing_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"url" text NOT NULL,
	"caption" varchar(140),
	"position" integer DEFAULT 0 NOT NULL,
	"width" integer,
	"height" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_price_overrides" (
	"listing_id" uuid NOT NULL,
	"date" date NOT NULL,
	"price" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_price_overrides_listing_id_date_pk" PRIMARY KEY("listing_id","date"),
	CONSTRAINT "price_override_positive" CHECK ("listing_price_overrides"."price" > 0)
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host_id" uuid NOT NULL,
	"status" "listing_status" DEFAULT 'draft' NOT NULL,
	"title" varchar(60) DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"room_type" "room_type" DEFAULT 'entire_place' NOT NULL,
	"property_type" "property_type" DEFAULT 'condo' NOT NULL,
	"size_sqm" integer,
	"max_guests" integer DEFAULT 2 NOT NULL,
	"bedrooms" integer DEFAULT 1 NOT NULL,
	"beds" integer DEFAULT 1 NOT NULL,
	"bathrooms" numeric(3, 1) DEFAULT 1 NOT NULL,
	"floor" integer,
	"address_line" text,
	"subdistrict" varchar(100),
	"district" varchar(100),
	"province" varchar(100) DEFAULT 'Bangkok' NOT NULL,
	"postcode" varchar(5),
	"area" varchar(60) DEFAULT '' NOT NULL,
	"location" geometry(Point, 4326),
	"public_location" geometry(Point, 4326),
	"nearest_station" varchar(80),
	"station_walk_minutes" integer,
	"amenities" text[] DEFAULT '{}'::text[] NOT NULL,
	"base_price" integer DEFAULT 0 NOT NULL,
	"cleaning_fee" integer DEFAULT 0 NOT NULL,
	"weekly_discount_pct" integer DEFAULT 0 NOT NULL,
	"instant_book" boolean DEFAULT false NOT NULL,
	"min_nights" integer DEFAULT 1 NOT NULL,
	"max_nights" integer DEFAULT 90 NOT NULL,
	"advance_notice_days" integer DEFAULT 0 NOT NULL,
	"booking_window_months" integer DEFAULT 12 NOT NULL,
	"check_in_from" varchar(5) DEFAULT '14:00' NOT NULL,
	"check_out_by" varchar(5) DEFAULT '11:00' NOT NULL,
	"cancellation_policy" "cancellation_policy" DEFAULT 'moderate' NOT NULL,
	"house_rules" jsonb DEFAULT '{"smoking":false,"pets":false,"events":false,"notes":null}'::jsonb NOT NULL,
	"rating_avg" numeric(3, 2),
	"review_count" integer DEFAULT 0 NOT NULL,
	"review_note" text,
	"submitted_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "listings_money_nonneg" CHECK ("listings"."base_price" >= 0 and "listings"."cleaning_fee" >= 0),
	CONSTRAINT "listings_nights_valid" CHECK ("listings"."min_nights" >= 1 and "listings"."max_nights" >= "listings"."min_nights")
);
--> statement-breakpoint
CREATE TABLE "saved_listings" (
	"user_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_listings_user_id_listing_id_pk" PRIMARY KEY("user_id","listing_id")
);
--> statement-breakpoint
CREATE TABLE "booking_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"from_status" "booking_status",
	"to_status" "booking_status" NOT NULL,
	"actor" "booking_actor" NOT NULL,
	"actor_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref" varchar(12) NOT NULL,
	"listing_id" uuid NOT NULL,
	"guest_id" uuid NOT NULL,
	"host_id" uuid NOT NULL,
	"status" "booking_status" NOT NULL,
	"check_in" date NOT NULL,
	"check_out" date NOT NULL,
	"stay" daterange GENERATED ALWAYS AS (daterange(check_in, check_out, '[)')) STORED,
	"guests" integer NOT NULL,
	"nights" integer NOT NULL,
	"nightly_prices" jsonb NOT NULL,
	"nights_subtotal" integer NOT NULL,
	"weekly_discount" integer DEFAULT 0 NOT NULL,
	"nights_total" integer NOT NULL,
	"cleaning_fee" integer NOT NULL,
	"service_fee" integer NOT NULL,
	"total" integer NOT NULL,
	"host_fee" integer NOT NULL,
	"host_payout" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'THB' NOT NULL,
	"cancellation_policy" "cancellation_policy" NOT NULL,
	"instant" boolean NOT NULL,
	"message" text,
	"request_expires_at" timestamp with time zone,
	"hold_expires_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"reject_reason" text,
	"expired_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" "booking_actor",
	"cancel_reason" text,
	"refund_amount" integer,
	"host_penalty" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_ref_unique" UNIQUE("ref"),
	CONSTRAINT "bookings_not_own_listing" CHECK ("bookings"."guest_id" <> "bookings"."host_id"),
	CONSTRAINT "bookings_dates_valid" CHECK ("bookings"."check_out" > "bookings"."check_in"),
	CONSTRAINT "bookings_guests_positive" CHECK ("bookings"."guests" >= 1)
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"provider" varchar(20) DEFAULT 'stripe' NOT NULL,
	"stripe_payment_intent_id" text,
	"method" "payment_method",
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"amount" integer NOT NULL,
	"refunded_amount" integer DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'THB' NOT NULL,
	"last4" varchar(4),
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_stripe_payment_intent_id_unique" UNIQUE("stripe_payment_intent_id")
);
--> statement-breakpoint
CREATE TABLE "stripe_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_blocks" ADD CONSTRAINT "listing_blocks_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_photos" ADD CONSTRAINT "listing_photos_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_price_overrides" ADD CONSTRAINT "listing_price_overrides_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_host_id_users_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_listings" ADD CONSTRAINT "saved_listings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_listings" ADD CONSTRAINT "saved_listings_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_guest_id_users_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_host_id_users_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_log_user_idx" ON "email_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_tokens_lookup_idx" ON "verification_tokens" USING btree ("kind","target");--> statement-breakpoint
CREATE INDEX "listing_photos_listing_idx" ON "listing_photos" USING btree ("listing_id","position");--> statement-breakpoint
CREATE INDEX "listings_host_idx" ON "listings" USING btree ("host_id");--> statement-breakpoint
CREATE INDEX "listings_status_idx" ON "listings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "listings_public_location_gist" ON "listings" USING gist ("public_location");--> statement-breakpoint
CREATE INDEX "booking_events_booking_idx" ON "booking_events" USING btree ("booking_id","created_at");--> statement-breakpoint
CREATE INDEX "bookings_guest_idx" ON "bookings" USING btree ("guest_id","check_in");--> statement-breakpoint
CREATE INDEX "bookings_host_idx" ON "bookings" USING btree ("host_id","status");--> statement-breakpoint
CREATE INDEX "bookings_listing_idx" ON "bookings" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "bookings_hold_expiry_idx" ON "bookings" USING btree ("hold_expires_at") WHERE "bookings"."status" = 'payment_hold';--> statement-breakpoint
CREATE INDEX "bookings_request_expiry_idx" ON "bookings" USING btree ("request_expires_at") WHERE "bookings"."status" = 'requested';--> statement-breakpoint
CREATE INDEX "payments_booking_idx" ON "payments" USING btree ("booking_id");