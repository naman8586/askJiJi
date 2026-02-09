CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    user_type TEXT CHECK (user_type IN ('student', 'professional', 'founder', 'team')) DEFAULT 'student',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.queries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    query_text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_queries_user_id ON public.queries(user_id);
CREATE INDEX IF NOT EXISTS idx_queries_created_at ON public.queries(created_at DESC);

CREATE TABLE IF NOT EXISTS public.resources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    type TEXT CHECK (type IN ('ppt', 'video', 'pdf', 'image', 'text')) NOT NULL,
    url TEXT NOT NULL,
    storage_path TEXT,
    tags TEXT[],
    file_size BIGINT,
    duration_seconds INTEGER,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resources_type ON public.resources(type);
CREATE INDEX IF NOT EXISTS idx_resources_tags ON public.resources USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_resources_is_active ON public.resources(is_active);
CREATE INDEX IF NOT EXISTS idx_resources_created_at ON public.resources(created_at DESC);

CREATE TABLE IF NOT EXISTS public.query_resources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query_id UUID REFERENCES public.queries(id) ON DELETE CASCADE,
    resource_id UUID REFERENCES public.resources(id) ON DELETE CASCADE,
    relevance_score DECIMAL(3,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (query_id, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_query_resources_query_id ON public.query_resources(query_id);
CREATE INDEX IF NOT EXISTS idx_query_resources_resource_id ON public.query_resources(resource_id);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.query_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_read
ON public.profiles
FOR SELECT
USING (true);

CREATE POLICY profiles_insert
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

CREATE POLICY profiles_update
ON public.profiles
FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY queries_select
ON public.queries
FOR SELECT
USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY queries_insert
ON public.queries
FOR INSERT
WITH CHECK (true);

CREATE POLICY resources_select_public
ON public.resources
FOR SELECT
USING (is_active = true);

CREATE POLICY resources_insert
ON public.resources
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY resources_update
ON public.resources
FOR UPDATE
USING (auth.uid() = created_by);

CREATE POLICY query_resources_select
ON public.query_resources
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.queries
        WHERE queries.id = query_resources.query_id
        AND queries.user_id = auth.uid()
    )
);

CREATE POLICY query_resources_insert
ON public.query_resources
FOR INSERT
WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER resources_updated_at
BEFORE UPDATE ON public.resources
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.increment_resource_views(resource_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.resources
    SET view_count = view_count + 1
    WHERE id = resource_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

INSERT INTO storage.buckets (id, name, public)
VALUES ('learning-resources', 'learning-resources', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY storage_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'learning-resources');

CREATE POLICY storage_read
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'learning-resources');

CREATE POLICY storage_update
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'learning-resources' AND auth.uid() = owner::uuid);

CREATE POLICY storage_delete
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'learning-resources' AND auth.uid() = owner::uuid);

CREATE INDEX IF NOT EXISTS idx_resources_search
ON public.resources
USING GIN (to_tsvector('english', title || ' ' || COALESCE(description, '')));
