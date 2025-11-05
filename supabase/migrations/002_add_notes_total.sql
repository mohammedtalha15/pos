-- Add optional notes and total_price to orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS total_price NUMERIC(10,2) DEFAULT 0;

-- Backfill default values
UPDATE orders SET total_price = COALESCE(total_price, 0);

