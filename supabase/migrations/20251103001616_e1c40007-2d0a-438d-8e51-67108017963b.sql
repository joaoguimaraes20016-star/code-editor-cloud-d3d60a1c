-- Make setter column nullable in sales table to allow closing deals without a setter
ALTER TABLE sales ALTER COLUMN setter DROP NOT NULL;