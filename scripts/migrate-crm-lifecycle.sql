-- migrate-crm-lifecycle.sql
-- Renames lifecycle stages on prospect_contacts:
--   contact     → pre_opp
--   opportunity → opp
--
-- Run in Supabase SQL Editor (service role context).
-- Safe to run multiple times — UPDATE is idempotent.

-- 1. Drop the existing CHECK constraint so we can write new values
ALTER TABLE prospect_contacts
  DROP CONSTRAINT IF EXISTS prospect_contacts_lifecycle_stage_check;

-- 2. Migrate existing rows
UPDATE prospect_contacts SET lifecycle_stage = 'pre_opp' WHERE lifecycle_stage = 'contact';
UPDATE prospect_contacts SET lifecycle_stage = 'opp'     WHERE lifecycle_stage = 'opportunity';

-- 3. Add the new CHECK constraint with the canonical stage names
ALTER TABLE prospect_contacts
  ADD CONSTRAINT prospect_contacts_lifecycle_stage_check
  CHECK (lifecycle_stage IN ('pre_opp', 'opp', 'lead', 'customer', 'suppressed'));
