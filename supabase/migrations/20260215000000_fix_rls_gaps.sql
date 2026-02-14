-- Fix RLS gaps identified in security audit
-- 1. processing_jobs UPDATE policy missing WITH CHECK
-- 2. Storage receipts path validation hardening

-- ============================================================
-- 1. Fix processing_jobs UPDATE policy — add WITH CHECK clause
-- ============================================================
-- Without WITH CHECK, a user could theoretically set user_id
-- to another user's ID during an UPDATE operation.

DROP POLICY IF EXISTS "Users can update own jobs" ON processing_jobs;

CREATE POLICY "Users can update own jobs"
  ON processing_jobs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 2. Harden storage.objects receipts policies
-- ============================================================
-- Add NULL safety to path-based user_id extraction.
-- If foldername() returns NULL or empty, deny access.

DROP POLICY IF EXISTS "Users can upload their own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own receipts" ON storage.objects;

CREATE POLICY "Users can upload their own receipts"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own receipts"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own receipts"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own receipts"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
