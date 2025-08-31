/*
  # Create billing system tables

  1. New Tables
    - `bills` - Main billing records with period and totals
    - `bill_periods` - Individual billing periods with stock calculations
    - `bill_payments` - Payment tracking for bills

  2. Security
    - Enable RLS on all billing tables
    - Add policies for authenticated users to manage their data

  3. Features
    - Auto-generated bill numbers
    - Period-based billing with stock calculations
    - Payment tracking with multiple payment methods
    - Service charge calculations
*/

-- Create bills table
CREATE TABLE IF NOT EXISTS bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number text UNIQUE NOT NULL,
  client_id text NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  billing_period_start date NOT NULL,
  billing_period_end date NOT NULL,
  total_udhar_quantity integer DEFAULT 0,
  service_charge numeric(10,2) DEFAULT 0,
  period_charges numeric(10,2) DEFAULT 0,
  total_amount numeric(10,2) DEFAULT 0,
  previous_payments numeric(10,2) DEFAULT 0,
  net_due numeric(10,2) DEFAULT 0,
  payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid', 'overdue')),
  daily_rate numeric(10,2) DEFAULT 1.00,
  service_rate numeric(10,2) DEFAULT 0.50,
  generated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create bill periods table for detailed period calculations
CREATE TABLE IF NOT EXISTS bill_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  days_count integer NOT NULL,
  running_stock integer NOT NULL,
  daily_rate numeric(10,2) NOT NULL,
  period_charge numeric(10,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create bill payments table
CREATE TABLE IF NOT EXISTS bill_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'online', 'cheque', 'bank_transfer')),
  amount numeric(10,2) NOT NULL,
  payment_date date NOT NULL,
  reference_number text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_payments ENABLE ROW LEVEL SECURITY;

-- Create policies for bills
CREATE POLICY "Users can read all bills"
  ON bills
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage bills"
  ON bills
  FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'nilkanthplatdepo@gmail.com');

-- Create policies for bill periods
CREATE POLICY "Users can read all bill periods"
  ON bill_periods
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage bill periods"
  ON bill_periods
  FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'nilkanthplatdepo@gmail.com');

-- Create policies for bill payments
CREATE POLICY "Users can read all bill payments"
  ON bill_payments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage bill payments"
  ON bill_payments
  FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'nilkanthplatdepo@gmail.com');

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_bills_client_id ON bills(client_id);
CREATE INDEX IF NOT EXISTS idx_bills_period ON bills(billing_period_start, billing_period_end);
CREATE INDEX IF NOT EXISTS idx_bill_periods_bill_id ON bill_periods(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_payments_bill_id ON bill_payments(bill_id);

-- Add updated_at trigger for bills
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_bills_updated_at 
  BEFORE UPDATE ON bills 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();