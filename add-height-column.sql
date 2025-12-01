-- Add height_cm column to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS height_cm numeric DEFAULT 175;

-- Add height_unit column to profiles table (optional, for display preference)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS height_unit text DEFAULT 'cm';
