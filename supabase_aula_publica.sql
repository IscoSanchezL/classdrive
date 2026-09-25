-- Class Drive 4.0: copia pública para el portal de estudiantes.
-- Solo contiene clases marcadas como "Visible"; nunca planeaciones ni ajustes.
create table if not exists public.aula_publica (
  user_email text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.aula_publica enable row level security;

drop policy if exists "aula_publica_lectura" on public.aula_publica;
create policy "aula_publica_lectura" on public.aula_publica
  for select to anon, authenticated using (true);

drop policy if exists "aula_publica_escritura" on public.aula_publica;
create policy "aula_publica_escritura" on public.aula_publica
  for insert to anon, authenticated with check (true);

drop policy if exists "aula_publica_actualizar" on public.aula_publica;
create policy "aula_publica_actualizar" on public.aula_publica
  for update to anon, authenticated using (true) with check (true);
