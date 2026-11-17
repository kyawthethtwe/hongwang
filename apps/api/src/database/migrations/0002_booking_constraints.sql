-- Zero double bookings (whiteboard "Constraint, not Redis lock"): two bookings of the same
-- listing can never hold overlapping nights while either is payment_hold, confirmed or completed.
-- Checked by Postgres at commit, so no code path can forget to lock. Violations raise SQLSTATE
-- 23P01, which the API maps to 409 DATES_UNAVAILABLE.
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_no_overlap"
  EXCLUDE USING gist ("listing_id" WITH =, "stay" WITH &&)
  WHERE ("status" IN ('payment_hold', 'confirmed', 'completed'));
--> statement-breakpoint
-- Fuzzy title / area search.
CREATE INDEX IF NOT EXISTS "listings_title_trgm" ON "listings" USING gin ("title" gin_trgm_ops);
