/*
  # Create comprehensive views for reporting

  1. Views
    - `client_ledger_view` - Complete client ledger with outstanding balances
    - `stock_summary_view` - Stock summary with calculated totals
    - `active_rentals_view` - Currently active rentals by client

  2. Benefits
    - Simplified queries for complex reporting
    - Consistent calculations across the application
    - Better performance for dashboard queries
*/

-- Client Ledger View
CREATE OR REPLACE VIEW client_ledger_view AS
SELECT 
  c.id as client_id,
  c.name as client_name,
  c.site as client_site,
  c.mobile_number as client_mobile,
  COALESCE(borrowed.total_borrowed, 0) as total_borrowed,
  COALESCE(returned.total_returned, 0) as total_returned,
  COALESCE(borrowed.total_borrowed, 0) - COALESCE(returned.total_returned, 0) as outstanding_balance,
  CASE 
    WHEN COALESCE(borrowed.total_borrowed, 0) - COALESCE(returned.total_returned, 0) > 0 THEN 'outstanding'
    WHEN COALESCE(borrowed.total_borrowed, 0) > 0 THEN 'cleared'
    ELSE 'no_activity'
  END as status
FROM clients c
LEFT JOIN (
  SELECT 
    ch.client_id,
    SUM(ci.borrowed_quantity) as total_borrowed
  FROM challans ch
  JOIN challan_items ci ON ch.id = ci.challan_id
  GROUP BY ch.client_id
) borrowed ON c.id = borrowed.client_id
LEFT JOIN (
  SELECT 
    r.client_id,
    SUM(rli.returned_quantity) as total_returned
  FROM returns r
  JOIN return_line_items rli ON r.id = rli.return_id
  GROUP BY r.client_id
) returned ON c.id = returned.client_id;

-- Stock Summary View
CREATE OR REPLACE VIEW stock_summary_view AS
SELECT 
  s.*,
  CASE 
    WHEN s.available_quantity = 0 THEN 'out_of_stock'
    WHEN s.available_quantity <= 10 THEN 'low_stock'
    WHEN s.available_quantity <= 50 THEN 'medium_stock'
    ELSE 'good_stock'
  END as stock_status,
  ROUND((s.available_quantity::decimal / NULLIF(s.total_quantity, 0)) * 100, 2) as availability_percentage
FROM stock s;

-- Active Rentals View
CREATE OR REPLACE VIEW active_rentals_view AS
SELECT 
  c.id as client_id,
  c.name as client_name,
  c.site as client_site,
  ch.challan_number,
  ch.challan_date,
  ch.driver_name,
  ci.plate_size,
  ci.borrowed_quantity,
  ci.returned_quantity,
  ci.borrowed_quantity - ci.returned_quantity as outstanding_quantity,
  EXTRACT(days FROM (CURRENT_DATE - ch.challan_date)) as days_on_rent
FROM clients c
JOIN challans ch ON c.id = ch.client_id
JOIN challan_items ci ON ch.id = ci.challan_id
WHERE ch.status = 'active' 
  AND ci.borrowed_quantity > ci.returned_quantity
ORDER BY ch.challan_date DESC;