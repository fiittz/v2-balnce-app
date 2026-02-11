-- Add unique constraint on vat_return_id to support upsert operations
ALTER TABLE public.vat_finalisation_data 
ADD CONSTRAINT vat_finalisation_data_vat_return_id_unique UNIQUE (vat_return_id);