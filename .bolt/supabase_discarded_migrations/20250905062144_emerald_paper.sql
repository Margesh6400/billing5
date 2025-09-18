/*
  # Update bills table schema for comprehensive billing

  1. Schema Changes
    - Add comprehensive billing fields to bills table
    - Create bill_line_items table for detailed billing breakdown
    - Update existing columns to match comprehensive billing requirements

  2. Security
    - Maintain existing RLS policies
    - Add policies for bill_line_items table

  3. Features
    - Store complete billing calculations
    - Track extra charges, discounts, and payments
    - Support account closure options
*/

-- Add missing columns to bills table
DO $$
BEGIN
  -- Add bill_number if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bills' AND column_name = 'bill_number'
  ) THEN
    ALTER TABLE bills ADD COLUMN bill_number text UNIQUE;
  END IF;

  -- Add total_udhar_quantity if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bills' AND column_name = 'total_udhar_quantity'
  ) THEN
    ALTER TABLE bills ADD COLUMN total_udhar_quantity integer DEFAULT 0;
  END IF;

  -- Add service_charge if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bills' AND column_name = 'service_charge'
  ) THEN
    ALTER TABLE bills ADD COLUMN service_charge numeric(10,2) DEFAULT 0;
  END IF;

  -- Add period_charges if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bills' AND column_name = 'period_charges'
  ) THEN
    ALTER TABLE bills ADD COLUMN period_charges numeric(10,2) DEFAULT 0;
  END IF;

  -- Add previous_payments if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bills' AND column_name = 'previous_payments'
  ) THEN
    ALTER TABLE bills ADD COLUMN previous_payments numeric(10,2) DEFAULT 0;
  END IF;

  -- Add net_due if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bills' AND column_name = 'net_due'
  ) THEN
    ALTER TABLE bills ADD COLUMN net_due numeric(10,2) DEFAULT 0;
  END IF;

  -- Add daily_rate if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bills' AND column_name = 'daily_rate'
  ) THEN
    ALTER TABLE bills ADD COLUMN daily_rate numeric(10,2) DEFAULT 1.00;
  END IF;

  -- Add service_rate if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bills' AND column_name = 'service_rate'
  ) THEN
    ALTER TABLE bills ADD COLUMN service_rate numeric(10,2) DEFAULT 10.00;
  END IF;

  -- Add generated_at if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bills' AND column_name = 'generated_at'
  ) THEN
    ALTER TABLE bills ADD COLUMN generated_at timestamptz DEFAULT now();
  END IF;

  -- Add updated_at if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bills' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE bills ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;

  -- Add extra_charges_total if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bills' AND column_name = 'extra_charges_total'
  ) THEN
    ALTER TABLE bills ADD COLUMN extra_charges_total numeric(10,2) DEFAULT 0;
  END IF;

  -- Add discounts_total if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bills' AND column_name = 'discounts_total'
  ) THEN
    ALTER TABLE bills ADD COLUMN discounts_total numeric(10,2) DEFAULT 0;
  END IF;

  -- Add payments_total if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bills' AND column_name = 'payments_total'
  ) THEN
    ALTER TABLE bills ADD COLUMN payments_total numeric(10,2) DEFAULT 0;
  END IF;

  -- Add advance_paid if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bills' AND column_name = 'advance_paid'
  ) THEN
    ALTER TABLE bills ADD COLUMN advance_paid numeric(10,2) DEFAULT 0;
  END IF;

  -- Add final_due if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bills' AND column_name = 'final_due'
  ) THEN
    ALTER TABLE bills ADD COLUMN final_due numeric(10,2) DEFAULT 0;
  END IF;

  -- Add balance_carry_forward if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bills' AND column_name = 'balance_carry_forward'
  ) THEN
    ALTER TABLE bills ADD COLUMN balance_carry_forward numeric(10,2) DEFAULT 0;
  END IF;

  -- Add account_closure if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bills' AND column_name = 'account_closure'
  ) THEN
    ALTER TABLE bills ADD COLUMN account_closure text DEFAULT 'continue' CHECK (account_closure IN ('close', 'continue'));
  END IF;
END $$;

-- Create bill_line_items table if not exists
CREATE TABLE IF NOT EXISTS bill_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('rent', 'service_charge', 'extra_charge', 'discount', 'payment')),
  description text NOT NULL,
  quantity integer DEFAULT 1,
  rate numeric(10,2) DEFAULT 0,
  amount numeric(10,2) NOT NULL,
  item_date date,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on bill_line_items
ALTER TABLE bill_line_items ENABLE ROW LEVEL SECURITY;

-- Create policies for bill_line_items
CREATE POLICY "Users can read all bill line items"
  ON bill_line_items
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage bill line items"
  ON bill_line_items
  FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'nilkanthplatdepo@gmail.com');

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_bill_line_items_bill_id ON bill_line_items(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_line_items_type ON bill_line_items(item_type);

-- Update bills table to use uuid for id if not already
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bills' AND column_name = 'id' AND data_type = 'integer'
  ) THEN
    -- Drop existing bills table and recreate with uuid
    DROP TABLE IF EXISTS bills CASCADE;
    
    CREATE TABLE bills (
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
      service_rate numeric(10,2) DEFAULT 10.00,
      generated_at timestamptz DEFAULT now(),
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      extra_charges_total numeric(10,2) DEFAULT 0,
      discounts_total numeric(10,2) DEFAULT 0,
      payments_total numeric(10,2) DEFAULT 0,
      advance_paid numeric(10,2) DEFAULT 0,
      final_due numeric(10,2) DEFAULT 0,
      balance_carry_forward numeric(10,2) DEFAULT 0,
      account_closure text DEFAULT 'continue' CHECK (account_closure IN ('close', 'continue'))
    );

    -- Enable RLS
    ALTER TABLE bills ENABLE ROW LEVEL SECURITY;

    -- Recreate policies
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

    -- Recreate indexes
    CREATE INDEX IF NOT EXISTS idx_bills_client_id ON bills(client_id);
    CREATE INDEX IF NOT EXISTS idx_bills_period ON bills(billing_period_start, billing_period_end);
    CREATE INDEX IF NOT EXISTS idx_bills_bill_number ON bills(bill_number);

    -- Recreate trigger
    CREATE TRIGGER update_bills_updated_at 
      BEFORE UPDATE ON bills 
      FOR EACH ROW 
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;