DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='meide_children') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.meide_children;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='meide_activities') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.meide_activities;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='meide_public_scores') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.meide_public_scores;
  END IF;
END $$;
