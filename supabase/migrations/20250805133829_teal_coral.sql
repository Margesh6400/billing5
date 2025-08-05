/*
  # Add borrowed stock return tracking to return line items

  1. Schema Changes
    - Add `returned_borrowed_stock` column to `return_line_items` table
    - This field will track how much borrowed stock is being returned

  2. Security
    - Maintain existing RLS policies
    - No additional security changes needed

  3. Notes
    - This field allows tracking borrowed stock returns separately from regular returns
    - Supports better inventory management for borrowed stock from partners
    - Complements the existing borrowed_stock field in challan_items
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
COMMENT ON COLUMN return_line_items.returned_borrowed_stock IS 'Quantity of borrowed stock being returned - tracks partner stock returns separately from regular stock';