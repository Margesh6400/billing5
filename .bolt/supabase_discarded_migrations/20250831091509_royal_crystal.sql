/*
  # Create challans table

  1. New Tables
    - `challans`
      - `id` (serial, primary key) - Auto-incrementing challan ID
      - `challan_number` (text, unique, not null) - Unique challan identifier
      - `client_id` (text, not null) - Foreign key to clients table
      - `challan_date` (date, not null) - Date of challan issuance
      - `status` (text, default 'active') - Challan status (active/completed)
      - `driver_name` (text, nullable) - Name of driver for delivery
      - `created_at` (timestamptz, default now()) - Record creation timestamp

  2. Security
    - Enable RLS on `challans` table
    - Add policy for authenticated users to read all challans
    - Add policy for authenticated users to manage challans

  3. Relationships
    - Foreign key constraint to clients table
*/

CREATE TABLE IF NOT EXISTS challans (
  id serial PRIMARY KEY,
  challan_number text UNIQUE NOT NULL,
  client_id text NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  challan_date date NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  driver_name text,
  created_at timestamptz DEFAULT now()
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_challans_client_id ON challans(client_id);
CREATE INDEX IF NOT EXISTS idx_challans_status ON challans(status);
CREATE INDEX IF NOT EXISTS idx_challans_date ON challans(challan_date);

ALTER TABLE challans ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all challans
CREATE POLICY "Authenticated users can read challans"
  ON challans
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to manage challans
CREATE POLICY "Authenticated users can manage challans"
  ON challans
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);