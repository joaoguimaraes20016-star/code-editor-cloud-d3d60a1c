-- Add closer_notes column to appointments table
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS closer_notes text;