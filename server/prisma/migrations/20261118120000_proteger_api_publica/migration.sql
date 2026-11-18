-- Protección para bases que exponen las tablas en una API pública (por ejemplo Supabase, con su "Data API").
-- Se activa RLS (seguridad por fila) en todas las tablas SIN crear permisos: la API pública no puede leer
-- ni modificar nada. La aplicación no se ve afectada: se conecta con el usuario dueño de las tablas,
-- y el dueño no queda alcanzado por RLS. En Neon o en una base local no cambia nada.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
