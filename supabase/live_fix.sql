-- Live Supabase repair for EduSphere AI
-- Run this in the Supabase SQL editor for the live project.

create extension if not exists pgcrypto;

alter table if exists users add column if not exists teacher_id text;

alter table if exists institutions enable row level security;
alter table if exists users enable row level security;
alter table if exists departments enable row level security;
alter table if exists teachers enable row level security;
alter table if exists forms enable row level security;
alter table if exists responses enable row level security;

drop policy if exists institutions_demo_policy on institutions;
drop policy if exists users_demo_policy on users;
drop policy if exists departments_demo_policy on departments;
drop policy if exists teachers_demo_policy on teachers;
drop policy if exists forms_demo_policy on forms;
drop policy if exists responses_demo_policy on responses;

create policy institutions_demo_policy on institutions for all to anon, authenticated using (true) with check (true);
create policy users_demo_policy on users for all to anon, authenticated using (true) with check (true);
create policy departments_demo_policy on departments for all to anon, authenticated using (true) with check (true);
create policy teachers_demo_policy on teachers for all to anon, authenticated using (true) with check (true);
create policy forms_demo_policy on forms for all to anon, authenticated using (true) with check (true);
create policy responses_demo_policy on responses for all to anon, authenticated using (true) with check (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on institutions, users, departments, teachers, forms, responses to anon, authenticated;
