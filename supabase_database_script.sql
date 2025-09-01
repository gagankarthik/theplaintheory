-- =====================================================
-- MINIMALIST HABIT TRACKER - SUPABASE DATABASE SETUP
-- =====================================================
-- Paste this entire script into your Supabase SQL Editor
-- and run it to set up the complete database structure

-- Enable RLS on all tables by default
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA PUBLIC REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

-- =====================================================
-- 1. PROFILES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    avatar_emoji TEXT DEFAULT '👋',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can read own profile" 
    ON profiles FOR SELECT 
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
    ON profiles FOR UPDATE 
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" 
    ON profiles FOR INSERT 
    WITH CHECK (auth.uid() = id);

-- =====================================================
-- 2. HABITS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS habits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (length(title) <= 40 AND length(title) > 0),
    emoji TEXT DEFAULT '✅',
    cadence TEXT DEFAULT 'daily' CHECK (cadence IN ('daily', 'weekly', 'custom')),
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;

-- RLS Policies for habits
CREATE POLICY "Users can read own habits" 
    ON habits FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can read public habits" 
    ON habits FOR SELECT 
    USING (is_public = TRUE);

CREATE POLICY "Users can insert own habits" 
    ON habits FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own habits" 
    ON habits FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own habits" 
    ON habits FOR DELETE 
    USING (auth.uid() = user_id);

-- =====================================================
-- 3. CHECKINS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    day DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one checkin per habit per day
    UNIQUE(habit_id, day)
);

-- Enable RLS
ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;

-- RLS Policies for checkins
CREATE POLICY "Users can read own checkins" 
    ON checkins FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Buddies can read owner checkins" 
    ON checkins FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM buddies 
            WHERE buddies.owner_id = checkins.user_id 
            AND buddies.buddy_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own checkins" 
    ON checkins FOR INSERT 
    WITH CHECK (
        auth.uid() = user_id 
        AND EXISTS (
            SELECT 1 FROM habits 
            WHERE habits.id = habit_id 
            AND habits.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own checkins" 
    ON checkins FOR DELETE 
    USING (auth.uid() = user_id);

-- =====================================================
-- 4. BUDDIES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS buddies (
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    buddy_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique pairs and prevent self-buddying
    PRIMARY KEY (owner_id, buddy_id),
    CHECK (owner_id != buddy_id)
);

-- Enable RLS
ALTER TABLE buddies ENABLE ROW LEVEL SECURITY;

-- RLS Policies for buddies
CREATE POLICY "Users can read own buddy relationships" 
    ON buddies FOR SELECT 
    USING (auth.uid() = owner_id OR auth.uid() = buddy_id);

CREATE POLICY "Users can create buddy relationships" 
    ON buddies FOR INSERT 
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can delete own buddy relationships" 
    ON buddies FOR DELETE 
    USING (auth.uid() = owner_id);

-- =====================================================
-- 5. BUDDY VIBES TABLE (Optional daily encouragement)
-- =====================================================

CREATE TABLE IF NOT EXISTS buddy_vibes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    day DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- One vibe per day per buddy pair
    UNIQUE(from_user_id, to_user_id, day)
);

-- Enable RLS
ALTER TABLE buddy_vibes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for buddy vibes
CREATE POLICY "Users can read vibes sent to them" 
    ON buddy_vibes FOR SELECT 
    USING (auth.uid() = to_user_id OR auth.uid() = from_user_id);

CREATE POLICY "Users can send vibes to buddies" 
    ON buddy_vibes FOR INSERT 
    WITH CHECK (
        auth.uid() = from_user_id 
        AND EXISTS (
            SELECT 1 FROM buddies 
            WHERE (buddies.owner_id = from_user_id AND buddies.buddy_id = to_user_id)
            OR (buddies.owner_id = to_user_id AND buddies.buddy_id = from_user_id)
        )
    );

-- =====================================================
-- 6. INDEXES FOR PERFORMANCE
-- =====================================================

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_display_name ON profiles(display_name);

-- Habits indexes
CREATE INDEX IF NOT EXISTS idx_habits_user_id ON habits(user_id);
CREATE INDEX IF NOT EXISTS idx_habits_public ON habits(is_public) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_habits_created_at ON habits(created_at DESC);

-- Checkins indexes (critical for performance)
CREATE INDEX IF NOT EXISTS idx_checkins_user_day ON checkins(user_id, day DESC);
CREATE INDEX IF NOT EXISTS idx_checkins_habit_day ON checkins(habit_id, day DESC);
CREATE INDEX IF NOT EXISTS idx_checkins_day ON checkins(day DESC);

-- Buddies indexes
CREATE INDEX IF NOT EXISTS idx_buddies_buddy_id ON buddies(buddy_id);

-- Buddy vibes indexes
CREATE INDEX IF NOT EXISTS idx_buddy_vibes_to_user_day ON buddy_vibes(to_user_id, day DESC);

-- =====================================================
-- 7. USEFUL FUNCTIONS
-- =====================================================

-- Function to calculate habit streak
CREATE OR REPLACE FUNCTION calculate_habit_streak(habit_uuid UUID, user_uuid UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    streak_count INTEGER := 0;
    check_date DATE := CURRENT_DATE;
    has_checkin BOOLEAN;
BEGIN
    -- Verify user owns the habit
    IF NOT EXISTS (
        SELECT 1 FROM habits 
        WHERE id = habit_uuid AND user_id = user_uuid
    ) THEN
        RETURN 0;
    END IF;

    -- Count consecutive days from today backwards
    LOOP
        SELECT EXISTS (
            SELECT 1 FROM checkins 
            WHERE habit_id = habit_uuid 
            AND user_id = user_uuid 
            AND day = check_date
        ) INTO has_checkin;

        IF has_checkin THEN
            streak_count := streak_count + 1;
            check_date := check_date - INTERVAL '1 day';
        ELSE
            EXIT;
        END IF;

        -- Safety limit to prevent infinite loops
        IF streak_count > 1000 THEN
            EXIT;
        END IF;
    END LOOP;

    RETURN streak_count;
END;
$$;

-- Function to get user's habit summary
CREATE OR REPLACE FUNCTION get_user_habit_summary(user_uuid UUID)
RETURNS TABLE(
    habit_id UUID,
    habit_title TEXT,
    habit_emoji TEXT,
    current_streak INTEGER,
    total_checkins INTEGER,
    last_checkin DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        h.id,
        h.title,
        h.emoji,
        calculate_habit_streak(h.id, user_uuid),
        COUNT(c.id)::INTEGER,
        MAX(c.day)
    FROM habits h
    LEFT JOIN checkins c ON h.id = c.habit_id
    WHERE h.user_id = user_uuid
    GROUP BY h.id, h.title, h.emoji, h.created_at
    ORDER BY h.created_at DESC;
END;
$$;

-- Function to get last N days of checkins for a habit
CREATE OR REPLACE FUNCTION get_habit_checkins_last_n_days(
    habit_uuid UUID, 
    user_uuid UUID, 
    days_count INTEGER DEFAULT 7
)
RETURNS TABLE(day DATE, checked BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    start_date DATE := CURRENT_DATE - (days_count - 1);
    end_date DATE := CURRENT_DATE;
BEGIN
    -- Verify user owns the habit
    IF NOT EXISTS (
        SELECT 1 FROM habits 
        WHERE id = habit_uuid AND user_id = user_uuid
    ) THEN
        RETURN;
    END IF;

    RETURN QUERY
    WITH date_series AS (
        SELECT generate_series(start_date, end_date, '1 day'::interval)::date AS day
    )
    SELECT 
        ds.day,
        EXISTS (
            SELECT 1 FROM checkins 
            WHERE habit_id = habit_uuid 
            AND user_id = user_uuid 
            AND day = ds.day
        ) AS checked
    FROM date_series ds
    ORDER BY ds.day;
END;
$$;

-- =====================================================
-- 8. TRIGGERS FOR UPDATED_AT
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at 
    BEFORE UPDATE ON profiles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_habits_updated_at 
    BEFORE UPDATE ON habits 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 9. AUTOMATIC PROFILE CREATION
-- =====================================================

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name, avatar_emoji)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'avatar_emoji', '👋')
    );
    RETURN NEW;
END;
$$;

-- Trigger to create profile on user signup
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- 10. SAMPLE DATA (OPTIONAL - REMOVE IN PRODUCTION)
-- =====================================================

-- Uncomment below to add sample data for testing
/*
-- Sample habits (you'll need to replace user_id with actual UUID)
INSERT INTO habits (user_id, title, emoji, is_public) VALUES 
    ('your-user-uuid-here', 'Drink Water', '💧', false),
    ('your-user-uuid-here', 'Morning Exercise', '🏃', true),
    ('your-user-uuid-here', 'Read 20 minutes', '📚', false),
    ('your-user-uuid-here', 'Meditate', '🧘', false);

-- Sample checkins for the last week
INSERT INTO checkins (habit_id, user_id, day) 
SELECT 
    h.id,
    'your-user-uuid-here',
    CURRENT_DATE - (random() * 6)::integer
FROM habits h 
WHERE h.user_id = 'your-user-uuid-here'
AND random() > 0.3; -- 70% chance of checkin
*/

-- =====================================================
-- 11. GRANTS AND PERMISSIONS
-- =====================================================

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION calculate_habit_streak(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_habit_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_habit_checkins_last_n_days(UUID, UUID, INTEGER) TO authenticated;

-- =====================================================
-- SETUP COMPLETE! 
-- =====================================================
-- 
-- Your database is now ready with:
-- ✅ All tables with proper relationships
-- ✅ Row Level Security (RLS) policies
-- ✅ Performance indexes
-- ✅ Utility functions for streaks and summaries  
-- ✅ Automatic profile creation on signup
-- ✅ Proper constraints and validation
--
-- Next steps:
-- 1. Update your environment variables
-- 2. Test with your Next.js app
-- 3. Remove sample data section before production
-- =====================================================