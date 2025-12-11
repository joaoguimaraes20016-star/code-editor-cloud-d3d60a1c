-- Create payments table for tracking all payment/revenue events
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  lead_id UUID NULL,
  appointment_id UUID NULL REFERENCES public.appointments(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_method TEXT NOT NULL DEFAULT 'credit_card',
  type TEXT NOT NULL DEFAULT 'deposit',
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NULL DEFAULT '{}'::jsonb
);

-- Create index for common queries
CREATE INDEX idx_payments_team_id ON public.payments(team_id);
CREATE INDEX idx_payments_appointment_id ON public.payments(appointment_id);
CREATE INDEX idx_payments_type ON public.payments(type);
CREATE INDEX idx_payments_processed_at ON public.payments(processed_at);

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- RLS policies for payments
CREATE POLICY "Team members can view payments"
ON public.payments
FOR SELECT
USING (is_team_member(auth.uid(), team_id));

CREATE POLICY "Team members can insert payments"
ON public.payments
FOR INSERT
WITH CHECK (is_team_member(auth.uid(), team_id));

-- Add comment for documentation
COMMENT ON TABLE public.payments IS 'Tracks all payment events (deposits, initial payments, recurring) for revenue tracking';