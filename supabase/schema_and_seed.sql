-- EduSphere AI Supabase schema + demo seed
-- Load this in the Supabase SQL editor.
-- The app stores separate logins by role in the users table:
--   student, admin, and super_admin.
-- Every institution-owned row carries institution_id so data stays isolated.

create extension if not exists pgcrypto;

create table if not exists institutions (
  id text primary key,
  name text not null,
  code text not null unique,
  email text not null,
  phone text,
  address text,
  status text not null default 'active',
  plan text not null default 'Free',
  logo text,
  created_at timestamptz not null default now()
);

create table if not exists users (
  id text primary key,
  institution_id text references institutions(id) on delete cascade,
  role text not null check (role in ('student', 'admin', 'super_admin')),
  full_name text not null,
  email text not null unique,
  login_id text not null unique,
  password text not null,
  status text not null default 'active',
  department text,
  year text,
  section text,
  register_number text,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists departments (
  id text primary key,
  institution_id text not null references institutions(id) on delete cascade,
  name text not null,
  hod text,
  created_at timestamptz not null default now()
);

create table if not exists teachers (
  id text primary key,
  institution_id text not null references institutions(id) on delete cascade,
  name text not null,
  employee_id text not null,
  department text not null,
  subject text not null,
  designation text not null,
  email text not null,
  phone text,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists forms (
  id text primary key,
  institution_id text not null references institutions(id) on delete cascade,
  title text not null,
  description text,
  department_id text references departments(id) on delete set null,
  semester text,
  status text not null default 'draft',
  teacher_ids text[] not null default '{}',
  questions jsonb not null default '[]'::jsonb,
  created_by text references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists responses (
  id text primary key,
  institution_id text not null references institutions(id) on delete cascade,
  form_id text not null references forms(id) on delete cascade,
  teacher_id text not null references teachers(id) on delete cascade,
  student_id text not null references users(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now()
);

create index if not exists idx_users_institution_role on users(institution_id, role);
create index if not exists idx_teachers_institution on teachers(institution_id);
create index if not exists idx_forms_institution on forms(institution_id);
create index if not exists idx_responses_institution on responses(institution_id);
create index if not exists idx_responses_form on responses(form_id);

insert into institutions (id, name, code, email, phone, address, status, plan, logo, created_at)
values
  ('inst_ksrct', 'K.S. Rangasamy College of Technology', 'KSRCT001', 'admin@ksrct.edu.in', '+91 4288 274 741', 'Tiruchengode, Namakkal, Tamil Nadu', 'active', 'Pro', 'KS', now())
on conflict (id) do nothing;

insert into users (id, institution_id, role, full_name, email, login_id, password, status, department, year, section, register_number, phone, created_at)
values
  ('usr_admin', 'inst_ksrct', 'admin', 'Institution Admin', 'admin@ksrct.edu.in', 'ADMIN', 'Admin@123', 'active', null, null, null, null, null, now()),
  ('usr_stu1', 'inst_ksrct', 'student', 'Vijay S', 'vijay@ksrct.edu.in', '22AIML101', 'Temp@123', 'active', 'CSE (AIML)', '2', 'A', '22AIML101', '', now()),
  ('usr_stu2', 'inst_ksrct', 'student', 'Abishek S', 'abishek@ksrct.edu.in', '22AIML102', 'Temp@123', 'active', 'CSE (AIML)', '2', 'A', '22AIML102', '', now()),
  ('usr_super', null, 'super_admin', 'Super Admin', 'super@edusphere.ai', 'SUPER', 'Super@123', 'active', null, null, null, null, null, now())
on conflict (id) do nothing;

insert into departments (id, institution_id, name, hod, created_at)
values
  ('dept_aiml', 'inst_ksrct', 'CSE (AIML)', 'Dr. R. Kumar', now()),
  ('dept_cse', 'inst_ksrct', 'CSE', 'Dr. M. Suresh', now()),
  ('dept_ece', 'inst_ksrct', 'ECE', 'Dr. A. Meena', now())
on conflict (id) do nothing;

insert into teachers (id, institution_id, name, employee_id, department, subject, designation, email, phone, status, created_at)
values
  ('tch_kumar', 'inst_ksrct', 'Dr. R. Kumar', 'KSRCT-F101', 'CSE (AIML)', 'Machine Learning', 'Professor', 'kumar@ksrct.edu.in', '9840000001', 'active', now()),
  ('tch_priya', 'inst_ksrct', 'Ms. S. Priya', 'KSRCT-F102', 'CSE (AIML)', 'Data Structures', 'Assistant Professor', 'priya@ksrct.edu.in', '9840000002', 'active', now()),
  ('tch_ravi', 'inst_ksrct', 'Mr. K. Ravi', 'KSRCT-F103', 'ECE', 'Digital Electronics', 'Associate Professor', 'ravi@ksrct.edu.in', '9840000003', 'active', now())
on conflict (id) do nothing;

insert into forms (id, institution_id, title, description, department_id, semester, status, teacher_ids, questions, created_by, created_at)
values (
  'form_odd_2026',
  'inst_ksrct',
  'Odd Semester Course Feedback 2026',
  'Standard end-of-semester faculty evaluation for CSE (AIML), Semester 5.',
  'dept_aiml',
  '5',
  'published',
  array['tch_kumar','tch_priya'],
  '[
    {"id":"q_teach","text":"Teaching Quality","type":"rating","required":true,"options":null},
    {"id":"q_comm","text":"Communication Skills","type":"rating","required":true,"options":null},
    {"id":"q_subject","text":"Subject Knowledge","type":"rating","required":true,"options":null},
    {"id":"q_punctual","text":"Punctuality","type":"rating","required":true,"options":null},
    {"id":"q_emoji","text":"How did this course make you feel overall?","type":"emoji","required":true,"options":null},
    {"id":"q_yesno","text":"Would you recommend this faculty to a junior batch?","type":"yesno","required":true,"options":null},
    {"id":"q_improve","text":"Suggestions for improvement","type":"textarea","required":false,"options":null}
  ]'::jsonb,
  'usr_admin',
  now()
)
on conflict (id) do nothing;

insert into responses (id, institution_id, form_id, teacher_id, student_id, answers, submitted_at)
values
  (
    'resp_1', 'inst_ksrct', 'form_odd_2026', 'tch_kumar', 'usr_stu1',
    '{"q_teach":5,"q_comm":4,"q_subject":5,"q_punctual":5,"q_emoji":"🙂","q_yesno":"Yes","q_improve":"Explains concepts very clearly and patiently."}'::jsonb,
    now() - interval '20 days'
  ),
  (
    'resp_2', 'inst_ksrct', 'form_odd_2026', 'tch_priya', 'usr_stu1',
    '{"q_teach":4,"q_comm":5,"q_subject":4,"q_punctual":5,"q_emoji":"🙂","q_yesno":"Yes","q_improve":"Could slow down a bit during derivations, but overall great."}'::jsonb,
    now() - interval '17 days'
  ),
  (
    'resp_3', 'inst_ksrct', 'form_odd_2026', 'tch_kumar', 'usr_stu2',
    '{"q_teach":5,"q_comm":5,"q_subject":4,"q_punctual":5,"q_emoji":"😍","q_yesno":"Yes","q_improve":"Really engaging labs, learned a lot this semester."}'::jsonb,
    now() - interval '10 days'
  ),
  (
    'resp_4', 'inst_ksrct', 'form_odd_2026', 'tch_priya', 'usr_stu2',
    '{"q_teach":4,"q_comm":4,"q_subject":5,"q_punctual":4,"q_emoji":"🙂","q_yesno":"Yes","q_improve":"Clear explanations and good support during assignments."}'::jsonb,
    now() - interval '7 days'
  )
on conflict (id) do nothing;

-- Optional: if you want this to be role-isolated in Supabase,
-- add RLS policies after you wire auth.
-- The current demo uses its own login table, so migrating to
-- Supabase Auth would mean replacing password checks with auth users.
