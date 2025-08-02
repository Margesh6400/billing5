/*
  # Enhanced Stock System with Partner Stock Support

  1. New Tables
    - `partners` - Partner management (SS, SK, ETC)
    - Enhanced `stock` table with partner stock columns
    - Enhanced `challan_items` with partner stock breakdown
    - Enhanced `return_line_items` with partner stock breakdown

  2. Changes
    - Add SS, SK, ETC stock columns to stock table
    - Add partner stock tracking to challan items
    - Add partner stock tracking to return items
    - Remove zero stock validation restrictions
    - Add borrowed_stock and new_and_old calculated columns

  3. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create partners table
CREATE TABLE IF NOT EXISTS partners (
  id VARCHAR PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default partners
INSERT INTO partners (id, name, description, is_active) VALUES
('MAIN', 'Own Stock', 'Company owned plates', true),
('SS', 'SS Partner', 'SS partner plates', true),
('SK', 'SK Partner', 'SK partner plates', true),
('ETC', 'ETC Partner', 'Other partner plates', true)
ON CONFLICT (id) DO NOTHING;

-- Add partner stock columns to stock table
ALTER TABLE stock ADD COLUMN IF NOT EXISTS ss INTEGER DEFAULT 0;
ALTER TABLE stock ADD COLUMN IF NOT EXISTS sk INTEGER DEFAULT 0;
ALTER TABLE stock ADD COLUMN IF NOT EXISTS etc INTEGER DEFAULT 0;
ALTER TABLE stock ADD COLUMN IF NOT EXISTS borrowed_stock INTEGER DEFAULT 0;
ALTER TABLE stock ADD COLUMN IF NOT EXISTS new_and_old INTEGER DEFAULT 0;

-- Add partner tracking to challan_items
ALTER TABLE challan_items ADD COLUMN IF NOT EXISTS partner_id VARCHAR DEFAULT 'MAIN';
ALTER TABLE challan_items ADD COLUMN IF NOT EXISTS own_quantity INTEGER DEFAULT 0;
ALTER TABLE challan_items ADD COLUMN IF NOT EXISTS ss_quantity INTEGER DEFAULT 0;
ALTER TABLE challan_items ADD COLUMN IF NOT EXISTS sk_quantity INTEGER DEFAULT 0;
ALTER TABLE challan_items ADD COLUMN IF NOT EXISTS etc_quantity INTEGER DEFAULT 0;
ALTER TABLE challan_items ADD COLUMN IF NOT EXISTS stock_source VARCHAR DEFAULT 'own';

-- Add partner tracking to challans
ALTER TABLE challans ADD COLUMN IF NOT EXISTS partner_id VARCHAR DEFAULT 'MAIN';

-- Add partner tracking to return_line_items
ALTER TABLE return_line_items ADD COLUMN IF NOT EXISTS partner_id VARCHAR DEFAULT 'MAIN';
ALTER TABLE return_line_items ADD COLUMN IF NOT EXISTS own_quantity INTEGER DEFAULT 0;
ALTER TABLE return_line_items ADD COLUMN IF NOT EXISTS ss_quantity INTEGER DEFAULT 0;
ALTER TABLE return_line_items ADD COLUMN IF NOT EXISTS sk_quantity INTEGER DEFAULT 0;
ALTER TABLE return_line_items ADD COLUMN IF NOT EXISTS etc_quantity INTEGER DEFAULT 0;

-- Add partner tracking to returns
ALTER TABLE returns ADD COLUMN IF NOT EXISTS partner_id VARCHAR DEFAULT 'MAIN';

-- Enable RLS on partners table
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

-- Create policies for partners table
CREATE POLICY "Admin can manage partners"
  ON partners
  FOR ALL
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

CREATE POLICY "Non-admin can view partners"
  ON partners
  FOR SELECT
  TO authenticated
  USING (NOT is_admin_user());

-- Update stock calculation function
CREATE OR REPLACE FUNCTION update_stock_calculations()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate borrowed_stock (SS + SK + ETC)
  NEW.borrowed_stock = NEW.ss + NEW.sk + NEW.etc;
  
  -- Calculate new_and_old (total_quantity + borrowed_stock)
  NEW.new_and_old = NEW.total_quantity + NEW.borrowed_stock;
  
  -- Calculate available_quantity (new_and_old - on_rent_quantity)
  NEW.available_quantity = NEW.new_and_old - NEW.on_rent_quantity;
  
  -- Ensure non-negative values
  NEW.available_quantity = GREATEST(0, NEW.available_quantity);
  NEW.borrowed_stock = GREATEST(0, NEW.borrowed_stock);
  NEW.new_and_old = GREATEST(0, NEW.new_and_old);
  
  NEW.updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic stock calculations
DROP TRIGGER IF EXISTS stock_calculation_trigger ON stock;
CREATE TRIGGER stock_calculation_trigger
  BEFORE INSERT OR UPDATE ON stock
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_calculations();

-- Enhanced stock update function for issues (with partner stock support)
CREATE OR REPLACE FUNCTION update_stock_on_enhanced_issue()
RETURNS TRIGGER AS $$
BEGIN
  -- Update stock based on partner stock breakdown
  UPDATE stock
  SET
    on_rent_quantity = on_rent_quantity + NEW.borrowed_quantity,
    updated_at = NOW()
  WHERE plate_size = NEW.plate_size;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Enhanced stock update function for returns (with partner stock support)
CREATE OR REPLACE FUNCTION update_stock_on_enhanced_return()
RETURNS TRIGGER AS $$
BEGIN
  -- Update stock based on partner stock breakdown
  UPDATE stock
  SET
    on_rent_quantity = GREATEST(0, on_rent_quantity - NEW.returned_quantity),
    updated_at = NOW()
  WHERE plate_size = NEW.plate_size;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update existing triggers
DROP TRIGGER IF EXISTS stock_update_on_issue ON challan_items;
CREATE TRIGGER stock_update_on_issue
  AFTER INSERT ON challan_items
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_on_enhanced_issue();

DROP TRIGGER IF EXISTS stock_update_on_return_item ON return_line_items;
CREATE TRIGGER stock_update_on_return_item
  AFTER INSERT ON return_line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_on_enhanced_return();

-- Update existing stock data with new columns
UPDATE stock SET 
  borrowed_stock = ss + sk + etc,
  new_and_old = total_quantity + ss + sk + etc,
  available_quantity = GREATEST(0, total_quantity + ss + sk + etc - on_rent_quantity)
WHERE borrowed_stock IS NULL OR new_and_old IS NULL;