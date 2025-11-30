-- Meals table
CREATE TABLE IF NOT EXISTS meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_id date NOT NULL,
  name text NOT NULL,
  time text NOT NULL,
  image_uri text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Food items table (related to meals)
CREATE TABLE IF NOT EXISTS food_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id uuid NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  name text NOT NULL,
  quantity text NOT NULL,
  calories numeric NOT NULL,
  protein numeric NOT NULL,
  carbs numeric NOT NULL,
  fat numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS meals_user_id_idx ON meals(user_id);
CREATE INDEX IF NOT EXISTS meals_day_id_idx ON meals(day_id);
CREATE INDEX IF NOT EXISTS meals_user_day_idx ON meals(user_id, day_id);
CREATE INDEX IF NOT EXISTS food_items_meal_id_idx ON food_items(meal_id);

-- Enable Row Level Security
ALTER TABLE meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for meals table
CREATE POLICY "Users can view their own meals"
  ON meals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own meals"
  ON meals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own meals"
  ON meals FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own meals"
  ON meals FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for food_items table
CREATE POLICY "Users can view food items from their meals"
  ON food_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM meals
      WHERE meals.id = food_items.meal_id
      AND meals.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert food items to their meals"
  ON food_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meals
      WHERE meals.id = food_items.meal_id
      AND meals.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update food items from their meals"
  ON food_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM meals
      WHERE meals.id = food_items.meal_id
      AND meals.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meals
      WHERE meals.id = food_items.meal_id
      AND meals.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete food items from their meals"
  ON food_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM meals
      WHERE meals.id = food_items.meal_id
      AND meals.user_id = auth.uid()
    )
  );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_meals_updated_at
  BEFORE UPDATE ON meals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
