-- ═══════════════════════════════════════════════════════════
-- CLASS DRIVE — Rendimiento y limpieza (ejecutar UNA vez en Supabase → SQL Editor)
-- Es seguro ejecutarlo varias veces.
-- ═══════════════════════════════════════════════════════════

-- 1) Columna "rev": sin ella, CADA guardado descarga primero toda la planeación
--    para comparar versiones. Con ella solo se lee un número. Es la mejora más grande.
alter table public.user_data add column if not exists rev bigint;

-- 2) Índices para que los respaldos y la consola del administrador sean rápidos
create index if not exists idx_respaldos_user_fecha on public.respaldos (user_email, created_at desc);
create index if not exists idx_user_data_email_upd on public.user_data (user_email, updated_at desc);

-- 3) Limpieza automática de respaldos: deja los 6 automáticos y 5 manuales/generales
--    más recientes de cada profesor y borra el resto.
create or replace function public.limpiar_respaldos() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  with r as (
    select id,
           (coalesce(label,'') ilike 'autom%') as auto,
           row_number() over (partition by user_email, (coalesce(label,'') ilike 'autom%') order by created_at desc) as rn
    from public.respaldos
  )
  delete from public.respaldos where id in (select id from r where (auto and rn > 6) or (not auto and rn > 5));
  get diagnostics n = row_count;
  return n;
end $$;

-- Ejecutarla ahora una vez (borra lo acumulado):
select public.limpiar_respaldos() as respaldos_borrados;

-- 4) Programarla cada noche (2:30 a. m. hora de Colombia = 7:30 UTC).
--    Si da error, activa la extensión en: Database → Extensions → pg_cron.
create extension if not exists pg_cron;
do $$ begin perform cron.unschedule('limpiar-respaldos'); exception when others then null; end $$;
select cron.schedule('limpiar-respaldos', '30 7 * * *', $$select public.limpiar_respaldos()$$);

-- 5) Quitar de la nube las claves de IA que los profesores guardaron antes.
--    EJECUTAR AL FINAL, cuando todos ya tengan la versión nueva de la app
--    (la versión vieja volvería a subirlas al guardar).
-- update public.user_data set settings = settings - 'aiKey' where settings ? 'aiKey';
