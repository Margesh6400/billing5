/*
  # Insert initial stock data

  1. Initial Data
    - Insert default plate sizes with zero quantities
    - Covers all standard centering plate sizes used in construction

  2. Plate Sizes
    - Standard sizes: 2 X 3, 21 X 3, 18 X 3, 15 X 3, 12 X 3, 9 X 3
    - Special sizes: પતરા (Gujarati for thin plates), 2 X 2, 2 ફુટ (2 feet)
*/

-- Insert initial stock data for all plate sizes
INSERT INTO stock (plate_size, total_quantity, available_quantity, on_rent_quantity) VALUES
  ('2 X 3', 0, 0, 0),
  ('21 X 3', 0, 0, 0),
  ('18 X 3', 0, 0, 0),
  ('15 X 3', 0, 0, 0),
  ('12 X 3', 0, 0, 0),
  ('9 X 3', 0, 0, 0),
  ('પતરા', 0, 0, 0),
  ('2 X 2', 0, 0, 0),
  ('2 ફુટ', 0, 0, 0)
ON CONFLICT (plate_size) DO NOTHING;