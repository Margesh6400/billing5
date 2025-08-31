/*
  # Add returned_borrowed_stock column to return_line_items

  1. Schema Changes
    - Add `returned_borrowed_stock` column to `return_line_items` table
    - This field will track borrowed stock quantities that are returned
    - Supports the advanced billing system's borrowed stock tracking

  2. Security
    - Maintain existing RLS policies
    - No additional security changes needed

  3. Notes
    - This field allows tracking borrowed stock returns separately from regular stock
    - Supports accurate billing calculations for borrowed stock
    - Default value is 0 for existing records
*/

-- Add returned_borrowed_stock column to return_line_items table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'return_line_items' AND column_name = 'returned_borrowed_stock'
  ) THEN
    ALTER TABLE return_line_items ADD COLUMN returned_borrowed_stock integer DEFAULT 0;
  END IF;
END $$;

-- Add comment to explain the purpose of this field
COMMENT ON COLUMN return_line_items.returned_borrowed_stock IS 'Quantity of borrowed stock returned - for billing and tracking purposes';

-- Update existing records to have default value
UPDATE return_line_items 
SET returned_borrowed_stock = 0 
WHERE returned_borrowed_stock IS NULL;