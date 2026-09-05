-- Migration 34: Add share_balance to members
ALTER TABLE members ADD COLUMN IF NOT EXISTS share_balance NUMERIC(15, 2) NOT NULL DEFAULT 0;
