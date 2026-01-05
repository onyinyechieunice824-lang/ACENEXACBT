/*
  # Create Subjects Table for Dynamic Subject Management

  ## Overview
  This migration creates a new `subjects` table to enable dynamic subject management
  by administrators. This replaces the hardcoded subject lists and allows subjects to
  be added, viewed, and deleted through the admin panel.

  ## 1. New Tables
    - `subjects`
      - `id` (uuid, primary key) - Unique identifier for each subject
      - `name` (text, unique, not null) - Subject name (e.g., "Physics", "Mathematics")
      - `category` (text, not null) - Subject category: General, Science, Commercial, or Arts
      - `is_compulsory` (boolean, default false) - Whether subject is compulsory (like English in JAMB)
      - `created_at` (timestamptz, default now()) - Record creation timestamp

  ## 2. Constraints
    - Unique constraint on `name` to prevent duplicate subjects
    - Check constraint on `category` to ensure only valid categories

  ## 3. Security (RLS)
    - Enable Row Level Security on `subjects` table
    - SELECT policy: Allow all users to view subjects (needed for exam functionality)
    - INSERT/UPDATE/DELETE: Authentication is handled at the API layer in server.js
      The Express server validates admin credentials before allowing write operations

  ## 4. Default Data
    - Seeds table with 17 default subjects covering JAMB and WAEC curricula
    - Includes subjects across all four categories (General, Science, Commercial, Arts)
    - English is marked as compulsory for JAMB exams

  ## Notes
    - This migration is idempotent (safe to run multiple times)
    - Existing questions will continue to work with their current subject references
    - Subject names are case-sensitive and should match question data exactly
    - Write access control is enforced at the API level using the service role key
*/

-- Create subjects table
CREATE TABLE IF NOT EXISTS subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  category text NOT NULL CHECK (category IN ('General', 'Science', 'Commercial', 'Arts')),
  is_compulsory boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow all users to read subjects (required for student exam functionality)
DROP POLICY IF EXISTS "Anyone can view subjects" ON subjects;
CREATE POLICY "Anyone can view subjects"
  ON subjects
  FOR SELECT
  USING (true);

-- RLS Policy: Allow service role to manage subjects (used by Express API with authentication)
DROP POLICY IF EXISTS "Service role can manage subjects" ON subjects;
CREATE POLICY "Service role can manage subjects"
  ON subjects
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Seed default subjects (only if table is empty)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM subjects LIMIT 1) THEN
    INSERT INTO subjects (name, category, is_compulsory) VALUES
      ('English', 'General', true),
      ('Mathematics', 'General', false),
      ('Civic Education', 'General', false),
      ('Physics', 'Science', false),
      ('Chemistry', 'Science', false),
      ('Biology', 'Science', false),
      ('Further Mathematics', 'Science', false),
      ('Agricultural Science', 'Science', false),
      ('Geography', 'Science', false),
      ('Computer Studies', 'Science', false),
      ('Economics', 'Commercial', false),
      ('Commerce', 'Commercial', false),
      ('Financial Accounting', 'Commercial', false),
      ('Government', 'Arts', false),
      ('Literature', 'Arts', false),
      ('CRS', 'Arts', false),
      ('History', 'Arts', false);
  END IF;
END $$;