/*
  # Create return_line_items table

  1. New Tables
    - `return_line_items`
      - `id` (serial, primary key) - Auto-incrementing item ID
      - `return_id` (integer, not null) - Foreign key to returns table
      - `plate_size` (text, not null) - Size of plates being returned
      - `returned_quantity` (integer, not null) - Number of plates returned
      - `damaged_quantity` (integer, default 0) - Number of damaged plates
      - `lost_quantity` (integer, default 0) - Number of lost plates
      - `returned_borrowed_stock` (integer, default 0) - Returned borrowed stock
      - `damage_notes` (text, nullable) - Notes about damage or issues
      - `created_at` (timestamptz, default now()) - Record creation timestamp

  2. Security
    - Enable RLS on `return_line_items` table
    - Add policy for authenticated users to read all return line items
    - Add policy for authenticated users to manage return line items

  3. Relationships
    - Foreign key constraint to returns table

  4. Constraints
    - Ensure quantities are non-negative
*/

CREATE TABLE IF NOT EXISTS return_line_items (
  id serial PRIMARY KEY,
  return_id integer NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  plate_size text NOT NULL,
  returned_quantity integer NOT NULL CHECK (returned_quantity >= 0),
  damaged_quantity integer DEFAULT 0 CHECK (damaged_quantity >= 0),
  lost_quantity integer DEFAULT 0 CHECK (lost_quantity >= 0),
  returned_borrowed_stock integer DEFAULT 0 CHECK (returned_borrowed_stock >= 0),
  damage_notes text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_return_line_items_return_id ON return_line_items(return_id);
CREATE INDEX IF NOT EXISTS idx_return_line_items_plate_size ON return_line_items(plate_size);

ALTER TABLE return_line_items ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all return line items
CREATE POLICY "Authenticated users can read return_line_items"
  ON return_line_items
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to manage return line items
CREATE POLICY "Authenticated users can manage return_line_items"
  ON return_line_items
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);