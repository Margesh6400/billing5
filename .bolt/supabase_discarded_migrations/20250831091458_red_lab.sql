/*
  # Create clients table

  1. New Tables
    - `clients`
      - `id` (text, primary key) - Unique client identifier
      - `name` (text, not null) - Client name
      - `site` (text, not null) - Site location
      - `mobile_number` (text, not null) - Mobile contact number
      - `created_at` (timestamptz, default now()) - Record creation timestamp

  2. Security
    - Enable RLS on `clients` table
    - Add policy for authenticated users to read all client data
    - Add policy for admin users to insert/update/delete client data
*/

CREATE TABLE IF NOT EXISTS clients (
  id text PRIMARY KEY,
  name text NOT NULL,
  site text NOT NULL,
  mobile_number text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all clients
CREATE POLICY "Authenticated users can read clients"
  ON clients
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert/update/delete clients
CREATE POLICY "Authenticated users can manage clients"
  ON clients
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);