/*
  # Create challan_items table

  1. New Tables
    - `challan_items`
      - `id` (serial, primary key) - Auto-incrementing item ID
      - `challan_id` (integer, not null) - Foreign key to challans table
      - `plate_size` (text, not null) - Size of plates being borrowed
      - `borrowed_quantity` (integer, not null) - Number of plates borrowed
      - `returned_quantity` (integer, default 0) - Number of plates returned
      - `borrowed_stock` (integer, default 0) - Borrowed stock from partners
      - `partner_stock_notes` (text, nullable) - Notes about partner stock
      - `status` (text, default 'active') - Item status
      - `created_at` (timestamptz, default now()) - Record creation timestamp

  2. Security
    - Enable RLS on `challan_items` table
    - Add policy for authenticated users to read all challan items
    - Add policy for authenticated users to manage challan items

  3. Relationships
    - Foreign key constraint to challans table

  4. Constraints
    - Ensure quantities are non-negative
    - Ensure returned_quantity <= borrowed_quantity
*/

CREATE TABLE IF NOT EXISTS challan_items (
  id serial PRIMARY KEY,
  challan_id integer NOT NULL REFERENCES challans(id) ON DELETE CASCADE,
  plate_size text NOT NULL,
  borrowed_quantity integer NOT NULL CHECK (borrowed_quantity >= 0),
  returned_quantity integer DEFAULT 0 CHECK (returned_quantity >= 0),
  borrowed_stock integer DEFAULT 0 CHECK (borrowed_stock >= 0),
  partner_stock_notes text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT challan_items_return_check CHECK (returned_quantity <= borrowed_quantity)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_challan_items_challan_id ON challan_items(challan_id);
CREATE INDEX IF NOT EXISTS idx_challan_items_plate_size ON challan_items(plate_size);
CREATE INDEX IF NOT EXISTS idx_challan_items_status ON challan_items(status);

ALTER TABLE challan_items ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all challan items
CREATE POLICY "Authenticated users can read challan_items"
  ON challan_items
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to manage challan items
CREATE POLICY "Authenticated users can manage challan_items"
  ON challan_items
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);