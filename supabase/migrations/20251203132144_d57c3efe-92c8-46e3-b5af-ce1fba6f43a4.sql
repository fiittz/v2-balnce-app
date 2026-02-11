-- Create import_batches table to track CSV upload sessions
CREATE TABLE public.import_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  filename TEXT,
  transaction_count INTEGER NOT NULL DEFAULT 0,
  imported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own import batches" 
ON public.import_batches 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own import batches" 
ON public.import_batches 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own import batches" 
ON public.import_batches 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add batch_id to transactions table
ALTER TABLE public.transactions 
ADD COLUMN import_batch_id UUID REFERENCES public.import_batches(id) ON DELETE CASCADE;