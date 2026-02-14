-- Replace CASCADE with RESTRICT on RCT foreign keys
-- Prevents silent deletion of deduction records when a subcontractor is removed

ALTER TABLE public.rct_contracts DROP CONSTRAINT rct_contracts_subcontractor_id_fkey;
ALTER TABLE public.rct_contracts ADD CONSTRAINT rct_contracts_subcontractor_id_fkey
  FOREIGN KEY (subcontractor_id) REFERENCES public.subcontractors(id) ON DELETE RESTRICT;

ALTER TABLE public.rct_deductions DROP CONSTRAINT rct_deductions_subcontractor_id_fkey;
ALTER TABLE public.rct_deductions ADD CONSTRAINT rct_deductions_subcontractor_id_fkey
  FOREIGN KEY (subcontractor_id) REFERENCES public.subcontractors(id) ON DELETE RESTRICT;
