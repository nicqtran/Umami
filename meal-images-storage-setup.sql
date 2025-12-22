-- =====================================================
-- MEAL IMAGES STORAGE SETUP
-- =====================================================
-- Run this in Supabase Dashboard → SQL Editor
-- This creates a storage bucket for meal images and
-- sets up the necessary security policies.
-- =====================================================

-- Step 1: Create the storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('meal-images', 'meal-images', true)
ON CONFLICT (id) DO NOTHING;

-- Step 2: Allow authenticated users to upload images to their own folder
-- Users can only upload to a folder named after their user ID
CREATE POLICY "Users can upload their own meal images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'meal-images' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Step 3: Allow anyone to view meal images (public read access)
CREATE POLICY "Anyone can view meal images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'meal-images');

-- Step 4: Allow users to update their own images
CREATE POLICY "Users can update their own meal images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'meal-images' 
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'meal-images' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Step 5: Allow users to delete their own images
CREATE POLICY "Users can delete their own meal images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'meal-images' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);
