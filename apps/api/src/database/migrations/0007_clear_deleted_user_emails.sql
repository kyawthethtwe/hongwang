-- Accounts deleted before 0006 kept a tombstone address (deleted+<id>@hongwang.invalid) to satisfy
-- users_email_or_phone. Deleted users may now have neither, so clear it.
UPDATE "users"
SET "email" = NULL
WHERE "deleted_at" IS NOT NULL
  AND "email" LIKE 'deleted+%@hongwang.invalid';
