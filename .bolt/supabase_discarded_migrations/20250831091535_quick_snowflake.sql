/*
  # Create bills table

  1. New Tables
    - `bills`
      - `id` (serial, primary key) - Auto-incrementing bill ID
      - `client_id` (text, not null) - Foreign key to clients table
      - `bill_number` (text, unique) - Unique bill identifier
      - `period_start` (date, not null) - Billing period start date
      - `period_end` (date, not null) - Billing period end date
      - `total_amount` (decimal, default 0) - Total bill amount
      - `payment_status` (text, default 'pending') - Payment status
      - `generated_at` (timestamptz, default now()) - Bill generation timestamp
      - `created_at` (timestamptz, default now()) - Record creation timestamp

  2. Security
    - Enable RLS on `bills` table
    - Add policy for authenticated users to read all bills
    - Add policy for authenticated users to manage bills

  3. Relationships
    - Foreign key constraint to clients table

  4. Constraints
    - Ensure period_end >= period_start
    - Ensure total_amount >= 0
*/

CREATE TABLE IF NOT EXISTS bills (
  id serial PRIMARY KEY,
  client_id text NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  bill_number text UNIQUE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_amount decimal(10,2) DEFAULT 0 CHECK (total_amount >= 0),
  payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'overdue')),
  generated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT bills_period_check CHECK (period_end >= period_start)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_bills_client_id ON bills(client_id);
CREATE INDEX IF NOT EXISTS idx_bills_payment_status ON bills(payment_status);
CREATE INDEX IF NOT EXISTS idx_bills_period ON bills(period_start, period_end);

ALTER TABLE bills ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all bills
CREATE POLICY "Authenticated users can read bills"
  ON bills
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to manage bills
CREATE POLICY "Authenticated users can manage bills"
  ON bills
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);