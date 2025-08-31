/*
  # Create returns table

  1. New Tables
    - `returns`
      - `id` (serial, primary key) - Auto-incrementing return ID
      - `return_challan_number` (text, unique, not null) - Unique return challan identifier
      - `client_id` (text, not null) - Foreign key to clients table
      - `return_date` (date, not null) - Date of plate return
      - `driver_name` (text, nullable) - Name of driver for pickup
      - `created_at` (timestamptz, default now()) - Record creation timestamp

  2. Security
    - Enable RLS on `returns` table
    - Add policy for authenticated users to read all returns
    - Add policy for authenticated users to manage returns

  3. Relationships
    - Foreign key constraint to clients table
*/

CREATE TABLE IF NOT EXISTS returns (
  id serial PRIMARY KEY,
  return_challan_number text UNIQUE NOT NULL,
  client_id text NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  return_date date NOT NULL,
  driver_name text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_returns_client_id ON returns(client_id);
CREATE INDEX IF NOT EXISTS idx_returns_date ON returns(return_date);

ALTER TABLE returns ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all returns
CREATE POLICY "Authenticated users can read returns"
  ON returns
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to manage returns
CREATE POLICY "Authenticated users can manage returns"
  ON returns
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);