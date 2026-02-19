-- Allow PDF uploads to the receipts bucket (UI already accepts application/pdf)
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
WHERE id = 'receipts';
