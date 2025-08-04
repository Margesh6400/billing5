/*
  # Add borrowed stock tracking to stock table

  1. New Columns
    - Add `borrowed_stock` column to `stock` table
    - This field stores total borrowed quantity per product item
    - Aggregated across all credit notes regardless of client

  2. Security
    - Update existing RLS policies to include the new field
    - Maintain existing access controls

  3. Notes
    - This field is for record-keeping and billing purposes only
    - Does not affect actual stock deduction logic
    - Values should be updated when challans are created/edited/deleted
*/

-- Add borrowed_stock column to stock table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock' AND column_name = 'borrowed_stock'
  ) THEN
    ALTER TABLE stock ADD COLUMN borrowed_stock integer DEFAULT 0;
  END IF;
END $$;

-- Add comment to explain the purpose of this field
COMMENT ON COLUMN stock.borrowed_stock IS 'Total quantity of borrowed stock from partners - aggregated across all challans for billing purposes only';

-- Update existing stock records to have borrowed_stock = 0 if null
UPDATE stock SET borrowed_stock = 0 WHERE borrowed_stock IS NULL;

-- Add constraint to ensure borrowed_stock is never negative
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'stock_borrowed_stock_non_negative'
  ) THEN
    ALTER TABLE stock ADD CONSTRAINT stock_borrowed_stock_non_negative CHECK (borrowed_stock >= 0);
  END IF;
END $$;