-- ====================================================================
-- OMNIMARKET AI - DATABASE MIGRATION (PHASE 1: CORE SCHEMA)
-- Description: Core tables, RLS Policies, Indexes, and Profile Sync
-- Database: Supabase PostgreSQL (Postgres 15+)
-- ====================================================================

-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- --------------------------------------------------------------------
-- 1. USERS TABLE (PROFILES)
-- --------------------------------------------------------------------
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    ai_credits INT NOT NULL DEFAULT 100 CHECK (ai_credits >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS for users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------
-- 2. SOCIAL ACCOUNTS TABLE (OAUTH CREDENTIALS)
-- --------------------------------------------------------------------
CREATE TABLE public.social_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    platform_name TEXT NOT NULL CHECK (platform_name IN ('instagram', 'facebook', 'x', 'youtube')),
    platform_account_id TEXT NOT NULL,
    platform_account_name TEXT,
    access_token TEXT NOT NULL, -- Highly recommended: Encrypted via pgsodium or pg_crypto
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure a user can only have one connected account per platform/account ID
    UNIQUE (user_id, platform_name, platform_account_id)
);

-- Enable RLS for social_accounts
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------
-- 3. CONTENT QUEUE TABLE (SCHEDULER & AUTOMATION)
-- --------------------------------------------------------------------
CREATE TABLE public.content_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    media_url TEXT NOT NULL,
    platform_targets TEXT[] NOT NULL CHECK (cardinality(platform_targets) > 0),
    ai_generated_content JSONB NOT NULL DEFAULT '{}'::jsonb,
    scheduled_time TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS for content_queue
ALTER TABLE public.content_queue ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------
-- 4. ANALYTICS TABLE (POST-PUBLICATION METRICS)
-- --------------------------------------------------------------------
CREATE TABLE public.analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.content_queue(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'x', 'youtube')),
    impressions INT NOT NULL DEFAULT 0 CHECK (impressions >= 0),
    likes INT NOT NULL DEFAULT 0 CHECK (likes >= 0),
    shares INT NOT NULL DEFAULT 0 CHECK (shares >= 0),
    comments INT NOT NULL DEFAULT 0 CHECK (comments >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS for analytics
ALTER TABLE public.analytics ENABLE ROW LEVEL SECURITY;

-- ====================================================================
-- RLS POLICIES (ROW LEVEL SECURITY)
-- ====================================================================

-- Users Policies
CREATE POLICY "Users can view their own profile"
    ON public.users
    FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON public.users
    FOR UPDATE
    USING (auth.uid() = id);

-- Social Accounts Policies
CREATE POLICY "Users can manage their own social accounts"
    ON public.social_accounts
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Content Queue Policies
CREATE POLICY "Users can manage their own content queue"
    ON public.content_queue
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Analytics Policies
CREATE POLICY "Users can view analytics for their own posts"
    ON public.analytics
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.content_queue
            WHERE content_queue.id = analytics.post_id
              AND content_queue.user_id = auth.uid()
        )
    );

-- ====================================================================
-- TRIGGERS & HELPERS (PROFILE SYNC & UPDATED_AT)
-- ====================================================================

-- Sync Profile on User Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, ai_credits)
    VALUES (new.id, new.email, 100) -- Reward 100 free AI Credits on sign up
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto update updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to tables
CREATE TRIGGER update_users_modtime
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_social_accounts_modtime
    BEFORE UPDATE ON public.social_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_queue_modtime
    BEFORE UPDATE ON public.content_queue
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ====================================================================
-- DATABASE INDEXES (FOR QUERY & AUTOMATION OPTIMIZATION)
-- ====================================================================

-- Quick lookups for scheduling jobs and analytics joins
CREATE INDEX idx_content_queue_status_time ON public.content_queue (status, scheduled_time) 
    WHERE status = 'pending';

CREATE INDEX idx_social_accounts_user_platform ON public.social_accounts (user_id, platform_name);
CREATE INDEX idx_content_queue_user_id ON public.content_queue (user_id);
CREATE INDEX idx_analytics_post_id ON public.analytics (post_id);

-- --------------------------------------------------------------------
-- 5. STORAGE BUCKET FOR CAMPAIGN MEDIA
-- --------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for 'media' bucket
CREATE POLICY "Public Read Access for media" ON storage.objects
    FOR SELECT TO public USING (bucket_id = 'media');

CREATE POLICY "Authenticated Insert Access for media" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'media');

CREATE POLICY "Authenticated Delete Access for media" ON storage.objects
    FOR DELETE TO authenticated USING (bucket_id = 'media');
