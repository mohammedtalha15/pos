    -- Create orders table
    CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_number INTEGER NOT NULL,
    items JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'preparing', 'ready')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Create index for faster queries
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

    -- Enable Row Level Security (RLS)
    ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

    -- Drop policy if it exists, then create policy to allow all operations
    -- In production, you should create proper policies based on your auth requirements
    DROP POLICY IF EXISTS "Allow all operations on orders" ON orders;
    CREATE POLICY "Allow all operations on orders" ON orders
    FOR ALL
    USING (true)
    WITH CHECK (true);

    -- Create function to update updated_at timestamp
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
    END;
    $$ language 'plpgsql';

    -- Drop trigger if it exists, then create trigger to automatically update updated_at
    DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
    CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
