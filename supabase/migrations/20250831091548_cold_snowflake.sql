/*
  # Create stock update triggers

  1. Triggers
    - Auto-update stock quantities when challans are created/updated
    - Auto-update stock quantities when returns are processed
    - Maintain data consistency between transactions and stock levels

  2. Functions
    - update_stock_on_challan_change() - Updates stock when challan items change
    - update_stock_on_return_change() - Updates stock when return items change
    - update_updated_at() - Updates the updated_at timestamp
*/

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on stock changes
DROP TRIGGER IF EXISTS update_stock_updated_at ON stock;
CREATE TRIGGER update_stock_updated_at
  BEFORE UPDATE ON stock
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Function to recalculate stock quantities
CREATE OR REPLACE FUNCTION recalculate_stock_quantities()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate on_rent_quantity for all plate sizes
  UPDATE stock SET
    on_rent_quantity = COALESCE((
      SELECT SUM(ci.borrowed_quantity) 
      FROM challan_items ci 
      JOIN challans c ON ci.challan_id = c.id 
      WHERE ci.plate_size = stock.plate_size 
      AND c.status = 'active'
    ), 0) - COALESCE((
      SELECT SUM(rli.returned_quantity)
      FROM return_line_items rli
      JOIN returns r ON rli.return_id = r.id
      JOIN challans c ON r.client_id = c.client_id
      WHERE rli.plate_size = stock.plate_size
    ), 0),
    available_quantity = GREATEST(0, total_quantity - COALESCE((
      SELECT SUM(ci.borrowed_quantity) 
      FROM challan_items ci 
      JOIN challans c ON ci.challan_id = c.id 
      WHERE ci.plate_size = stock.plate_size 
      AND c.status = 'active'
    ), 0) + COALESCE((
      SELECT SUM(rli.returned_quantity)
      FROM return_line_items rli
      JOIN returns r ON rli.return_id = r.id
      JOIN challans c ON r.client_id = c.client_id
      WHERE rli.plate_size = stock.plate_size
    ), 0));
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers to recalculate stock when challan items change
DROP TRIGGER IF EXISTS recalculate_stock_on_challan_items ON challan_items;
CREATE TRIGGER recalculate_stock_on_challan_items
  AFTER INSERT OR UPDATE OR DELETE ON challan_items
  FOR EACH STATEMENT
  EXECUTE FUNCTION recalculate_stock_quantities();

-- Triggers to recalculate stock when return items change
DROP TRIGGER IF EXISTS recalculate_stock_on_return_items ON return_line_items;
CREATE TRIGGER recalculate_stock_on_return_items
  AFTER INSERT OR UPDATE OR DELETE ON return_line_items
  FOR EACH STATEMENT
  EXECUTE FUNCTION recalculate_stock_quantities();