/*
  # Add RPC function for borrowed stock management

  1. Functions
    - `increment_borrowed_stock` - Safely increment borrowed stock
    - `recalculate_borrowed_stock` - Recalculate borrowed stock from challan_items

  2. Security
    - Functions are accessible to authenticated users
    - Maintain data consistency

  3. Notes
    - These functions help maintain accurate borrowed stock totals
    - Used when creating, editing, or deleting challans
*/

-- Function to safely increment borrowed stock
CREATE OR REPLACE FUNCTION increment_borrowed_stock(
  p_plate_size text,
  p_increment integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Ensure the stock record exists
  INSERT INTO stock (plate_size, total_quantity, available_quantity, on_rent_quantity, borrowed_stock)
  VALUES (p_plate_size, 0, 0, 0, 0)
  ON CONFLICT (plate_size) DO NOTHING;
  
  -- Update borrowed stock
  UPDATE stock 
  SET borrowed_stock = GREATEST(0, borrowed_stock + p_increment)
  WHERE plate_size = p_plate_size;
END;
$$;

-- Function to recalculate borrowed stock from challan_items
CREATE OR REPLACE FUNCTION recalculate_borrowed_stock(p_plate_size text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec RECORD;
  total_borrowed integer;
BEGIN
  -- If plate_size is specified, recalculate for that size only
  IF p_plate_size IS NOT NULL THEN
    SELECT COALESCE(SUM(borrowed_stock), 0) INTO total_borrowed
    FROM challan_items
    WHERE plate_size = p_plate_size;
    
    UPDATE stock 
    SET borrowed_stock = total_borrowed
    WHERE plate_size = p_plate_size;
  ELSE
    -- Recalculate for all plate sizes
    FOR rec IN SELECT DISTINCT plate_size FROM stock LOOP
      SELECT COALESCE(SUM(borrowed_stock), 0) INTO total_borrowed
      FROM challan_items
      WHERE plate_size = rec.plate_size;
      
      UPDATE stock 
      SET borrowed_stock = total_borrowed
      WHERE plate_size = rec.plate_size;
    END LOOP;
  END IF;
END;
$$;