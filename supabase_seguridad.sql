-- ═══════════════════════════════════════════════════════════
-- CLASS DRIVE — Seguridad: cada profesor solo ve y modifica lo suyo
-- ═══════════════════════════════════════════════════════════
-- ORDEN (si no se sigue, la app deja de cargar datos):
--   1. Supabase → Authentication → Sign In / Providers → Third-Party Auth
--      → Add provider → Firebase, con el Project ID:  classdrive-981c2
--   2. En index.html cambiar  const CD_SECURE=false;  por  true  y publicar (./publicar.sh)
--   3. Ejecutar ESTE archivo (SQL Editor).
-- Para volver atrás: ejecutar supabase_seguridad_revertir.sql
-- Las reglas valen para los roles anon y authenticated: decide el correo verificado
-- dentro del token de Google. Sin token no se ve ni se escribe nada (salvo el portal público).
-- ═══════════════════════════════════════════════════════════

create or replace function public.mi_email() returns text
language sql stable as $$ select lower(coalesce(auth.jwt() ->> 'email','')) $$;

create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.mi_email() = 'franksanlo@gmail.com'
      or exists (select 1 from public.profiles where lower(email) = public.mi_email() and role in ('admin','superadmin'));
$$;

-- Personal con consola (cualquier rol distinto de profesor/bloqueado): puede LEER datos de otros, no cambiar roles
create or replace function public.es_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select public.es_admin()
      or exists (select 1 from public.profiles where lower(email) = public.mi_email() and coalesce(role,'teacher') not in ('teacher','blocked'));
$$;

-- Empezar limpio: borrar las reglas abiertas actuales
do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
           where schemaname = 'public' and tablename in ('user_data','profiles','respaldos','plataforma','aula_publica','Resultados')
  loop execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename); end loop;
end $$;

alter table public.user_data    enable row level security;
alter table public.profiles     enable row level security;
alter table public.respaldos    enable row level security;
alter table public.plataforma   enable row level security;
alter table public.aula_publica enable row level security;
alter table public."Resultados" enable row level security;

-- user_data: cada profesor la suya; el personal lee todas; el admin escribe todas
create policy ud_ver on public.user_data for select to anon, authenticated using (lower(user_email) = public.mi_email() or public.es_staff());
create policy ud_ins on public.user_data for insert to anon, authenticated with check (lower(user_email) = public.mi_email() or public.es_admin());
create policy ud_upd on public.user_data for update to anon, authenticated using (lower(user_email) = public.mi_email() or public.es_admin()) with check (lower(user_email) = public.mi_email() or public.es_admin());
create policy ud_del on public.user_data for delete to anon, authenticated using (public.es_admin());

-- profiles: ver el propio (el personal ve todos); crear solo el propio como profesor; solo el admin cambia roles
create policy pf_ver on public.profiles for select to anon, authenticated using (lower(email) = public.mi_email() or public.es_staff());
create policy pf_ins on public.profiles for insert to anon, authenticated with check (public.es_admin() or (lower(email) = public.mi_email() and coalesce(role,'teacher') = 'teacher'));
create policy pf_upd on public.profiles for update to anon, authenticated using (lower(email) = public.mi_email() or public.es_admin()) with check (lower(email) = public.mi_email() or public.es_admin());
create policy pf_del on public.profiles for delete to anon, authenticated using (public.es_admin());

create or replace function public.profiles_sin_autoascenso() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not public.es_admin() then
    raise exception 'Solo el administrador puede cambiar roles';
  end if;
  return new;
end $$;
drop trigger if exists trg_profiles_sin_autoascenso on public.profiles;
create trigger trg_profiles_sin_autoascenso before update on public.profiles
  for each row execute function public.profiles_sin_autoascenso();

-- respaldos: cada profesor los suyos; el personal puede verlos; el admin crea/borra los de cualquiera
create policy rs_ver on public.respaldos for select to anon, authenticated using (lower(user_email) = public.mi_email() or public.es_staff());
create policy rs_ins on public.respaldos for insert to anon, authenticated with check (lower(user_email) = public.mi_email() or public.es_admin());
create policy rs_del on public.respaldos for delete to anon, authenticated using (lower(user_email) = public.mi_email() or public.es_admin());

-- plataforma (configuración general): la lee cualquiera, solo el admin la cambia
create policy pl_ver on public.plataforma for select to anon, authenticated using (true);
create policy pl_ins on public.plataforma for insert to anon, authenticated with check (public.es_admin());
create policy pl_upd on public.plataforma for update to anon, authenticated using (public.es_admin()) with check (public.es_admin());

-- aula_publica (portal de estudiantes): lectura pública; cada profesor escribe SOLO el suyo
create policy ap_ver on public.aula_publica for select to anon, authenticated using (true);
create policy ap_ins on public.aula_publica for insert to anon, authenticated with check (lower(user_email) = public.mi_email() or public.es_admin());
create policy ap_upd on public.aula_publica for update to anon, authenticated using (lower(user_email) = public.mi_email() or public.es_admin()) with check (lower(user_email) = public.mi_email() or public.es_admin());
create policy ap_del on public.aula_publica for delete to anon, authenticated using (lower(user_email) = public.mi_email() or public.es_admin());

-- Resultados: solo insertar
create policy rz_ins on public."Resultados" for insert to anon, authenticated with check (true);
