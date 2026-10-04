-- Vuelve al modo anterior (reglas abiertas). Úsalo SOLO si algo falla tras activar el modo seguro.
-- Después poner  const CD_SECURE=false;  en index.html y publicar.
do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
           where schemaname = 'public' and tablename in ('user_data','profiles','respaldos','plataforma','aula_publica')
  loop execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename); end loop;
end $$;
create policy "Allow all" on public.user_data    for all to anon, authenticated using (true) with check (true);
create policy "Allow all" on public.profiles     for all to anon, authenticated using (true) with check (true);
create policy "Allow all" on public.respaldos    for all to anon, authenticated using (true) with check (true);
create policy "Allow all" on public.plataforma   for all to anon, authenticated using (true) with check (true);
create policy "Allow all" on public.aula_publica for all to anon, authenticated using (true) with check (true);
drop trigger if exists trg_profiles_sin_autoascenso on public.profiles;
