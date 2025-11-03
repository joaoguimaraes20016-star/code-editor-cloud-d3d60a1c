-- Remove the restrictive status check constraint on sales table
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_status_check;