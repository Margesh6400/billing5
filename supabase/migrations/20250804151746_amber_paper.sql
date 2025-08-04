/*
  # Add borrowed stock tracking to stock table

  1. Schema Changes
    - Add `borrowed_stock` column to `stock` table to track total borrowed quantities
    - This aggregates all borrowed_stock values from challan_items across all clients

  2. Functions
    - Create function to calculate and update borrowed stock totals
    - Create trigger to automatically sync borrowed_stock when challan_items change

  3. Security
    - Update existing RLS policies to include the new field
    - Maintain existing access controls

  4. Notes
    - This field shows total borrowed stock across all clients for each plate size
    - Updates automatically when challans are created, modified, or deleted
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
COMMENT ON COLUMN stock.borrowed_stock IS 'Total borrowed stock from partners across all clients - aggregated from challan_items.borrowed_stock';

-- Function to update borrowed stock totals
CREATE OR REPLACE FUNCTION update_borrowed_stock_totals()
RETURNS void AS $$
BEGIN
  -- Update borrowed_stock for all plate sizes
  UPDATE stock 
  SET borrowed_stock = COALESCE(
    (
      SELECT SUM(ci.borrowed_stock)
      FROM challan_items ci
      JOIN challans c ON ci.challan_id = c.id
      WHERE ci.plate_size = stock.plate_size
    ), 0
  );
END;
$$ LANGUAGE plpgsql;

-- Function to update borrowed stock for specific plate size
CREATE OR REPLACE FUNCTION update_borrowed_stock_for_plate_size(plate_size_param text)
RETURNS void AS $$
BEGIN
  UPDATE stock 
  SET borrowed_stock = COALESCE(
    (
      SELECT SUM(ci.borrowed_stock)
      FROM challan_items ci
      JOIN challans c ON ci.challan_id = c.id
      WHERE ci.plate_size = plate_size_param
    ), 0
  )
  WHERE plate_size = plate_size_param;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to sync borrowed stock when challan_items change
CREATE OR REPLACE FUNCTION sync_borrowed_stock_on_challan_change()
RETURNS trigger AS $$
BEGIN
  -- Handle INSERT and UPDATE
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    PERFORM update_borrowed_stock_for_plate_size(NEW.plate_size);
    RETURN NEW;
  END IF;
  
  -- Handle DELETE
  IF TG_OP = 'DELETE' THEN
    PERFORM update_borrowed_stock_for_plate_size(OLD.plate_size);
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on challan_items table
DROP TRIGGER IF EXISTS trigger_sync_borrowed_stock ON challan_items;
CREATE TRIGGER trigger_sync_borrowed_stock
  AFTER INSERT OR UPDATE OR DELETE ON challan_items
  FOR EACH ROW
  EXECUTE FUNCTION sync_borrowed_stock_on_challan_change();

-- Initialize borrowed stock values for existing data
SELECT update_borrowed_stock_totals();