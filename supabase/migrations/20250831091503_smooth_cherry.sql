/*
  # Create stock table

  1. New Tables
    - `stock`
      - `id` (serial, primary key) - Auto-incrementing stock ID
      - `plate_size` (text, unique, not null) - Plate size identifier
      - `total_quantity` (integer, default 0) - Total plates in inventory
      - `available_quantity` (integer, default 0) - Available plates for rent
      - `on_rent_quantity` (integer, default 0) - Plates currently on rent
      - `updated_at` (timestamptz, default now()) - Last update timestamp

  2. Security
    - Enable RLS on `stock` table
    - Add policy for authenticated users to read all stock data
    - Add policy for authenticated users to update stock data

  3. Constraints
    - Ensure quantities are non-negative
    - Ensure available + on_rent <= total
*/

CREATE TABLE IF NOT EXISTS stock (
  id serial PRIMARY KEY,
  plate_size text UNIQUE NOT NULL,
  total_quantity integer DEFAULT 0 CHECK (total_quantity >= 0),
  available_quantity integer DEFAULT 0 CHECK (available_quantity >= 0),
  on_rent_quantity integer DEFAULT 0 CHECK (on_rent_quantity >= 0),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT stock_quantity_balance CHECK (available_quantity + on_rent_quantity <= total_quantity)
);

ALTER TABLE stock ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all stock
CREATE POLICY "Authenticated users can read stock"
  ON stock
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to manage stock
CREATE POLICY "Authenticated users can manage stock"
  ON stock
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);