-- Add sale_id column to mrr_commissions to track which sale generated the MRR
ALTER TABLE mrr_commissions 
ADD COLUMN sale_id uuid REFERENCES sales(id) ON DELETE CASCADE;