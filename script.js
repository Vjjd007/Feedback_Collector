/* ================================================================
  FEEDBACK SYSTEM â€” single-file prototype
   ----------------------------------------------------------------
   This file runs entirely client-side with a localStorage-backed
   data layer so it is fully functional the moment you open it â€”
   no server, no build step. It mirrors the schema described in the
   companion schema.sql (institutions / users / teachers / forms /
   questions / responses, every row scoped by institution_id).

   TO GO LIVE ON SUPABASE:
   1. Run schema.sql in your Supabase project's SQL editor.
   2. Fill in SUPABASE_URL / SUPABASE_ANON_KEY below.
   3. Swap the functions inside the `DB` object for calls to
      `supabase.from(...)` / `supabase.auth...` â€” every DB function
      is isolated for exactly this purpose, and each has a comment
      showing the equivalent Supabase call.
   ================================================================ */

const SUPABASE_URL = "https://tayfrezvenspwsqywgqe.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_fKzrhEu_KNEdg4z3h8FBJg_1xcv9gJx";
const SUPABASE = (window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
const LIVE = Boolean(SUPABASE);

/* ---------------- utilities ---------------- */
const uid = (p) => p + '_' + Math.random().toString(36).slice(2,9);
const nowISO = () => new Date().toISOString();
const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
const fmtDateTime = (iso) => new Date(iso).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
const monthKey = (iso) => new Date(iso).toLocaleString('en-IN',{month:'short',year:'2-digit'});
const escapeHtml = (s='') => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function toast(msg, type='ok'){
  const wrap = document.getElementById('toastWrap');
  const t = document.createElement('div');
  t.className = 'toast ' + (type==='ok'?'ok':type==='err'?'err':'');
  t.innerHTML = `<span>${type==='ok'?'&#9679;':type==='err'?'&#33;':'&#8226;'}</span><span>${escapeHtml(msg)}</span>`;
  wrap.appendChild(t);
  setTimeout(()=>{ t.style.opacity='0'; t.style.transition='opacity .3s'; setTimeout(()=>t.remove(),300); }, 3200);
}
function avatarInitials(name=''){ return name.trim().split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase() || '?'; }
function downloadFile(filename, content, mime='text/csv'){
  const blob = new Blob([content], {type:mime});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
function toCSV(rows){
  return rows.map(r => r.map(c => `"${String(c??'').replace(/"/g,'""')}"`).join(',')).join('\n');
}

/* ---------------- persistence layer ---------------- */
const STORE_KEY = 'edusphere_db_v1';
const SESSION_KEY = 'edusphere_session_v1';

function seedData(){
  const instId = 'inst_ksrct';
  const deptAiml = uid('dept'), deptCse = uid('dept'), deptEce = uid('dept');
  const tKumar = uid('tch'), tPriya = uid('tch'), tRavi = uid('tch');
  const adminId = uid('usr'), stu1 = uid('usr'), stu2 = uid('usr');
  const formId = uid('form');
  const q = (type, text, opts) => ({id: uid('q'), text, type, required:true, options: opts||null});
  const questions = [
    q('rating','Teaching Quality'),
    q('rating','Communication Skills'),
    q('rating','Subject Knowledge'),
    q('rating','Punctuality'),
    q('emoji','How did this course make you feel overall?'),
    q('yesno','Would you recommend this faculty to a junior batch?'),
    Object.assign(q('textarea','Suggestions for improvement'), {required:false}),
  ];
  const responses = [];
  // a few pre-filled demo responses so analytics has something to show
  [stu1, stu2].forEach((sid, i) => {
    [tKumar, tPriya].forEach((tid) => {
      const answers = {};
      questions.forEach(qq=>{
        if(qq.type==='rating') answers[qq.id] = 3 + Math.floor(Math.random()*3);
        else if(qq.type==='emoji') answers[qq.id] = ['ðŸ˜','ðŸ™‚','ðŸ˜','ðŸ™','ðŸ˜ž'][Math.floor(Math.random()*3)];
        else if(qq.type==='yesno') answers[qq.id] = Math.random()>0.3 ? 'Yes' : 'No';
        else if(qq.type==='textarea') answers[qq.id] = ['Explains concepts very clearly and patiently.','Could slow down a bit during derivations, but overall great.','Really engaging labs, learned a lot this semester.'][Math.floor(Math.random()*3)];
      });
      const d = new Date(); d.setDate(d.getDate() - (i*3 + Math.floor(Math.random()*20)));
      responses.push({id:uid('resp'), institutionId:instId, formId, teacherId:tid, studentId:sid, answers, submittedAt:d.toISOString()});
    });
  });

  return {
    institutions:[{id:instId, name:'K.S. Rangasamy College of Technology', code:'KSRCT001', email:'admin@ksrct.edu.in', phone:'+91 4288 274 741', address:'Tiruchengode, Namakkal, Tamil Nadu', status:'active', plan:'Pro', logo:'KS', createdAt:nowISO()}],
    users:[
      {id:adminId, institutionId:instId, role:'admin', fullName:'Institution Admin', email:'admin@ksrct.edu.in', loginId:'ADMIN', password:'Admin@123', status:'active', createdAt:nowISO()},
      {id:stu1, institutionId:instId, role:'student', fullName:'Vijay S', email:'vijay@ksrct.edu.in', loginId:'22AIML101', password:'Temp@123', department:'CSE (AIML)', year:'2', section:'A', registerNumber:'22AIML101', phone:'', status:'active', createdAt:nowISO()},
      {id:stu2, institutionId:instId, role:'student', fullName:'Abishek S', email:'abishek@ksrct.edu.in', loginId:'22AIML102', password:'Temp@123', department:'CSE (AIML)', year:'2', section:'A', registerNumber:'22AIML102', phone:'', status:'active', createdAt:nowISO()},
      {id:uid('usr'), institutionId:instId, role:'teacher', fullName:'Dr. R. Kumar', email:'kumar@ksrct.edu.in', loginId:'KSRCT-F101', password:'Temp@123', department:'CSE (AIML)', teacherId:tKumar, phone:'9840000001', status:'active', createdAt:nowISO()},
      {id:uid('usr'), institutionId:instId, role:'teacher', fullName:'Ms. S. Priya', email:'priya@ksrct.edu.in', loginId:'KSRCT-F102', password:'Temp@123', department:'CSE (AIML)', teacherId:tPriya, phone:'9840000002', status:'active', createdAt:nowISO()},
      {id:uid('usr'), institutionId:instId, role:'teacher', fullName:'Mr. K. Ravi', email:'ravi@ksrct.edu.in', loginId:'KSRCT-F103', password:'Temp@123', department:'ECE', teacherId:tRavi, phone:'9840000003', status:'active', createdAt:nowISO()},
    ],
    teachers:[
      {id:tKumar, institutionId:instId, name:'Dr. R. Kumar', employeeId:'KSRCT-F101', department:'CSE (AIML)', subject:'Machine Learning', designation:'Professor', email:'kumar@ksrct.edu.in', phone:'9840000001', status:'active', createdAt:nowISO()},
      {id:tPriya, institutionId:instId, name:'Ms. S. Priya', employeeId:'KSRCT-F102', department:'CSE (AIML)', subject:'Data Structures', designation:'Assistant Professor', email:'priya@ksrct.edu.in', phone:'9840000002', status:'active', createdAt:nowISO()},
      {id:tRavi, institutionId:instId, name:'Mr. K. Ravi', employeeId:'KSRCT-F103', department:'ECE', subject:'Digital Electronics', designation:'Associate Professor', email:'ravi@ksrct.edu.in', phone:'9840000003', status:'active', createdAt:nowISO()},
    ],
    departments:[
      {id:deptAiml, institutionId:instId, name:'CSE (AIML)', hod:'Dr. R. Kumar'},
      {id:deptCse, institutionId:instId, name:'CSE', hod:'Dr. M. Suresh'},
      {id:deptEce, institutionId:instId, name:'ECE', hod:'Dr. A. Meena'},
    ],
    forms:[
      {id:formId, institutionId:instId, title:'Odd Semester Course Feedback 2026', description:'Standard end-of-semester faculty evaluation for CSE (AIML), Semester 5.', departmentId:deptAiml, semester:'5', status:'published', teacherIds:[tKumar,tPriya], questions, createdBy:adminId, createdAt:nowISO()},
    ],
    responses,
    notifications:[],
  };
}

function loadDB(){
  const raw = localStorage.getItem(STORE_KEY);
  if(raw){ try { return JSON.parse(raw); } catch(e){ /* fallthrough */ } }
  const seeded = seedData();
  localStorage.setItem(STORE_KEY, JSON.stringify(seeded));
  return seeded;
}
function saveDB(){ localStorage.setItem(STORE_KEY, JSON.stringify(db)); }
let db = loadDB();

const SUPABASE_ENABLED = Boolean(SUPABASE);

function queueRemote(task){
  if(!SUPABASE_ENABLED) return;
  Promise.resolve().then(task).catch(err => console.warn('Supabase sync failed:', err));
}

function toRemoteInstitution(inst){ return { id: inst.id, name: inst.name, code: inst.code, email: inst.email, phone: inst.phone || null, address: inst.address || null, status: inst.status || 'active', plan: inst.plan || 'Free', logo: inst.logo || null, created_at: inst.createdAt || nowISO() }; }
function fromRemoteInstitution(row){ return { id: row.id, name: row.name, code: row.code, email: row.email, phone: row.phone || '', address: row.address || '', status: row.status || 'active', plan: row.plan || 'Free', logo: row.logo || '', createdAt: row.created_at || nowISO() }; }

function toRemoteUser(user){ return { id: user.id, institution_id: user.institutionId || null, role: user.role, full_name: user.fullName, email: user.email, login_id: user.loginId, password: user.password, status: user.status || 'active', department: user.department || null, year: user.year || null, section: user.section || null, register_number: user.registerNumber || null, phone: user.phone || null, created_at: user.createdAt || nowISO() }; }
function fromRemoteUser(row){ return { id: row.id, institutionId: row.institution_id || null, role: row.role, fullName: row.full_name, email: row.email, loginId: row.login_id, password: row.password, status: row.status || 'active', department: row.department || '', year: row.year || '', section: row.section || '', registerNumber: row.register_number || '', teacherId: row.teacher_id || '', phone: row.phone || '', createdAt: row.created_at || nowISO() }; }

function toRemoteDepartment(dept){ return { id: dept.id, institution_id: dept.institutionId, name: dept.name, hod: dept.hod || null, created_at: dept.createdAt || nowISO() }; }
function fromRemoteDepartment(row){ return { id: row.id, institutionId: row.institution_id, name: row.name, hod: row.hod || '', createdAt: row.created_at || nowISO() }; }

function toRemoteTeacher(teacher){ return { id: teacher.id, institution_id: teacher.institutionId, name: teacher.name, employee_id: teacher.employeeId, department: teacher.department, subject: teacher.subject, designation: teacher.designation, email: teacher.email, phone: teacher.phone || null, status: teacher.status || 'active', created_at: teacher.createdAt || nowISO() }; }
function fromRemoteTeacher(row){ return { id: row.id, institutionId: row.institution_id, name: row.name, employeeId: row.employee_id, department: row.department, subject: row.subject, designation: row.designation, email: row.email, phone: row.phone || '', status: row.status || 'active', createdAt: row.created_at || nowISO() }; }

function toRemoteForm(form){ return { id: form.id, institution_id: form.institutionId, title: form.title, description: form.description || null, department_id: form.departmentId || null, semester: form.semester || null, status: form.status || 'draft', teacher_ids: form.teacherIds || [], questions: form.questions || [], created_by: form.createdBy || null, created_at: form.createdAt || nowISO() }; }
function fromRemoteForm(row){ return { id: row.id, institutionId: row.institution_id, title: row.title, description: row.description || '', departmentId: row.department_id || '', semester: row.semester || '', status: row.status || 'draft', teacherIds: row.teacher_ids || [], questions: row.questions || [], createdBy: row.created_by || '', createdAt: row.created_at || nowISO() }; }

function toRemoteResponse(resp){ return { id: resp.id, institution_id: resp.institutionId, form_id: resp.formId, teacher_id: resp.teacherId, student_id: resp.studentId, answers: resp.answers || {}, submitted_at: resp.submittedAt || nowISO() }; }
function fromRemoteResponse(row){ return { id: row.id, institutionId: row.institution_id, formId: row.form_id, teacherId: row.teacher_id, studentId: row.student_id, answers: row.answers || {}, submittedAt: row.submitted_at || nowISO() }; }

async function fetchRemoteTable(table){
  const {data, error} = await SUPABASE.from(table).select('*');
  if(error) throw error;
  return data || [];
}

async function upsertRemote(table, rows){
  if(!SUPABASE_ENABLED || !rows.length) return;
  const {error} = await SUPABASE.from(table).upsert(rows, { onConflict: 'id' });
  if(error) throw error;
}

async function deleteRemote(table, id){
  if(!SUPABASE_ENABLED) return;
  const {error} = await SUPABASE.from(table).delete().eq('id', id);
  if(error) throw error;
}

async function hydrateFromSupabase(){
  if(!SUPABASE_ENABLED) return false;
  try {
    const [institutions, users, departments, teachers, forms, responses] = await Promise.all([
      fetchRemoteTable('institutions'),
      fetchRemoteTable('users'),
      fetchRemoteTable('departments'),
      fetchRemoteTable('teachers'),
      fetchRemoteTable('forms'),
      fetchRemoteTable('responses'),
    ]);
    const remoteDb = {
      institutions: institutions.map(fromRemoteInstitution),
      users: users.map(fromRemoteUser),
      departments: departments.map(fromRemoteDepartment),
      teachers: teachers.map(fromRemoteTeacher),
      forms: forms.map(fromRemoteForm),
      responses: responses.map(fromRemoteResponse),
      notifications: db.notifications || [],
    };
    const hasRemoteData = Object.entries(remoteDb).some(([key, value]) => Array.isArray(value) && value.length && key !== 'notifications');
    if(hasRemoteData){
      db = remoteDb;
      saveDB();
      return true;
    }
    await syncLocalDbToSupabase(db);
    return true;
  } catch (error) {
    console.warn('Supabase hydration failed, using local data:', error);
    return false;
  }
}

async function syncLocalDbToSupabase(sourceDb){
  if(!SUPABASE_ENABLED) return;
  await Promise.all([
    upsertRemote('institutions', sourceDb.institutions.map(toRemoteInstitution)),
    upsertRemote('users', sourceDb.users.map(toRemoteUser)),
    upsertRemote('departments', sourceDb.departments.map(toRemoteDepartment)),
    upsertRemote('teachers', sourceDb.teachers.map(toRemoteTeacher)),
    upsertRemote('forms', sourceDb.forms.map(toRemoteForm)),
    upsertRemote('responses', sourceDb.responses.map(toRemoteResponse)),
  ]);
}

/* ---------------- DB access layer ----------------
   Every method below is written against the local `db` object.
   Each is annotated with the Supabase call it should become. */
const DB = {
  // supabase: supabase.from('institutions').select('*')
  institutions: () => db.institutions,
  institutionByCode: (code) => db.institutions.find(i => i.code.toLowerCase() === String(code).toLowerCase()),
  institution: (id) => db.institutions.find(i => i.id === id),
  createInstitution(data){
    // supabase: supabase.from('institutions').insert({...}).select().single()
    const inst = {id: uid('inst'), status:'active', plan:'Free', createdAt: nowISO(), ...data};
    db.institutions.push(inst); saveDB(); queueRemote(()=>upsertRemote('institutions', [toRemoteInstitution(inst)])); return inst;
  },
  updateInstitution(id, patch){ const i = DB.institution(id); Object.assign(i, patch); saveDB(); queueRemote(()=>upsertRemote('institutions', [toRemoteInstitution(i)])); return i; },
  deleteInstitution(id){ db.institutions = db.institutions.filter(i=>i.id!==id); saveDB(); queueRemote(()=>deleteRemote('institutions', id)); },

  // supabase: supabase.auth.signInWithPassword({email, password}) then select from users
  findUser: (institutionId, loginOrEmail, password) => db.users.find(u =>
    u.institutionId === institutionId && u.status==='active' &&
    (u.loginId.toLowerCase() === String(loginOrEmail).toLowerCase() || u.email.toLowerCase() === String(loginOrEmail).toLowerCase()) &&
    u.password === password),
  findSuperAdmin: (email, password) => db.users.find(u => u.role==='super_admin' && u.email===email && u.password===password),
  user: (id) => db.users.find(u=>u.id===id),
  usersByInstitution: (instId, role) => db.users.filter(u=>u.institutionId===instId && (!role || u.role===role)),
  createUser(data){
    // supabase: supabase.auth.admin.createUser(...) then insert into users/student_profiles
    const u = {id: uid('usr'), status:'active', createdAt: nowISO(), ...data};
    db.users.push(u); saveDB(); queueRemote(()=>upsertRemote('users', [toRemoteUser(u)])); return u;
  },
  updateUser(id, patch){ const u = DB.user(id); Object.assign(u, patch); saveDB(); queueRemote(()=>upsertRemote('users', [toRemoteUser(u)])); return u; },
  deleteUser(id){ db.users = db.users.filter(u=>u.id!==id); saveDB(); queueRemote(()=>deleteRemote('users', id)); },
  emailTaken(email){ return db.users.some(u=>u.email.toLowerCase()===email.toLowerCase()); },

  teachersByInstitution: (instId) => db.teachers.filter(t=>t.institutionId===instId),
  teacher: (id) => db.teachers.find(t=>t.id===id),
  createTeacher(data){
    const t = {id:uid('tch'), status:'active', createdAt:nowISO(), ...data};
    db.teachers.push(t);
    const teacherUser = {
      id: uid('usr'),
      institutionId: t.institutionId,
      role: 'teacher',
      fullName: t.name,
      email: t.email,
      loginId: t.employeeId,
      password: 'Temp@123',
      status: 'active',
      department: t.department,
      teacherId: t.id,
      phone: t.phone || '',
      createdAt: nowISO(),
    };
    db.users.push(teacherUser);
    saveDB();
    queueRemote(()=>upsertRemote('teachers', [toRemoteTeacher(t)]));
    queueRemote(()=>upsertRemote('users', [toRemoteUser(teacherUser)]));
    return t;
  },
  updateTeacher(id, patch){ const t = DB.teacher(id); Object.assign(t, patch); saveDB(); queueRemote(()=>upsertRemote('teachers', [toRemoteTeacher(t)])); },
  deleteTeacher(id){ db.teachers = db.teachers.filter(t=>t.id!==id); saveDB(); queueRemote(()=>deleteRemote('teachers', id)); },

  departmentsByInstitution: (instId) => db.departments.filter(d=>d.institutionId===instId),
  createDepartment(data){ const d = {id:uid('dept'), ...data}; db.departments.push(d); saveDB(); queueRemote(()=>upsertRemote('departments', [toRemoteDepartment(d)])); return d; },
  deleteDepartment(id){ db.departments = db.departments.filter(d=>d.id!==id); saveDB(); queueRemote(()=>deleteRemote('departments', id)); },

  formsByInstitution: (instId) => db.forms.filter(f=>f.institutionId===instId),
  form: (id) => db.forms.find(f=>f.id===id),
  createForm(data){ const f = {id:uid('form'), status:'draft', questions:[], teacherIds:[], createdAt:nowISO(), ...data}; db.forms.push(f); saveDB(); queueRemote(()=>upsertRemote('forms', [toRemoteForm(f)])); return f; },
  updateForm(id, patch){ const f = DB.form(id); Object.assign(f, patch); saveDB(); queueRemote(()=>upsertRemote('forms', [toRemoteForm(f)])); },
  deleteForm(id){ db.forms = db.forms.filter(f=>f.id!==id); db.responses = db.responses.filter(r=>r.formId!==id); saveDB(); queueRemote(()=>deleteRemote('forms', id)); },

  responsesByInstitution: (instId) => db.responses.filter(r=>r.institutionId===instId),
  responsesByForm: (formId) => db.responses.filter(r=>r.formId===formId),
  responsesByStudent: (studentId) => db.responses.filter(r=>r.studentId===studentId),
  hasResponded: (formId, teacherId, studentId) => db.responses.some(r=>r.formId===formId && r.teacherId===teacherId && r.studentId===studentId),
  submitResponse(data){
    // supabase: one insert per question row into feedback_responses (institution_id, form_id, teacher_id, student_id, question_id, answer)
    const r = {id:uid('resp'), submittedAt: nowISO(), ...data};
    db.responses.push(r); saveDB(); queueRemote(()=>upsertRemote('responses', [toRemoteResponse(r)])); return r;
  },
};

/* ---------------- session ---------------- */
function getSession(){ try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch(e){ return null; } }
function setSession(s){ localStorage.setItem(SESSION_KEY, JSON.stringify(s)); }
function clearSession(){ localStorage.removeItem(SESSION_KEY); }

/* ---------------- app state / router ---------------- */
const state = {
  view: 'landing',
  authTab: 'student',
  adminTab: 'overview',
  studentTab: 'pending',
  teacherTab: 'assigned',
  session: getSession(),
  activeFormBuilder: null, // form id being edited, or 'new'
  activeSubmission: null,  // {formId, teacherId}
  activeAnalyticsForm: null,
  modal: null,
};

function navigate(view, extra={}){ Object.assign(state, {view}, extra); render(); window.scrollTo(0,0); }
function logout(){ clearSession(); state.session=null; navigate('landing'); toast('Signed out'); }

/* ================================================================
   RENDER: LANDING
   ================================================================ */
function renderLanding(){
  return `
  <div class="nav"><div class="container nav-inner">
    <div class="brand"><div class="brand-mark">FS</div>Feedback System</div>
    <div class="nav-links">
      <a href="#features">Features</a><a href="#how">How it works</a><a href="#roles">Roles</a>
    </div>
    <div class="row gap-12">
      <span class="demo-badge">Demo mode Â· local data</span>
      <button class="btn btn-ghost btn-sm" data-nav="login">Log in</button>
    </div>
  </div></div>

  <header class="hero"><div class="container hero-grid">
    <div>
      <span class="eyebrow">Multi-tenant institution feedback</span>
      <h1 style="margin-top:12px;">Every rating, <span class="accent">recorded &amp; verified</span> â€” one register per institution.</h1>
      <p class="lead">Feedback System gives every college its own private feedback register: students rate faculty course by course, admins build the forms, and nothing ever crosses institution lines.</p>
      <div class="row gap-12 hero-cta">
        <button class="btn btn-primary" data-nav="signup">Create a student account</button>
        <button class="btn btn-ghost" data-nav="login">Admin / Super Admin login</button>
      </div>
      <p class="hero-note">Try the seeded demo â€” institution code <strong>KSRCT001</strong>, admin login <strong>ADMIN / Admin@123</strong>, student login <strong>22AIML101 / Temp@123</strong>.</p>
      <div class="access-card">
        <span class="eyebrow">Admin access</span>
        <h3>Open the institution admin panel</h3>
        <p>Use the admin tab on the login screen to sign in and manage students, teachers, departments, forms, and analytics.</p>
        <div class="access-list">
          <span class="access-pill"><strong>Login ID</strong> ADMIN</span>
          <span class="access-pill"><strong>Password</strong> Admin@123</span>
          <span class="access-pill"><strong>Institution code</strong> KSRCT001</span>
        </div>
      </div>
    </div>
    <div class="ledger-card">
      <div class="ledger-head">
        <div><div class="who">Dr. R. Kumar</div><div class="meta">MACHINE LEARNING Â· SEM 5 Â· CSE (AIML)</div></div>
        <div class="seal">RECORDED</div>
      </div>
      <div class="ledger-rows">
        <div class="ledger-row"><span class="label">Teaching Quality</span><span class="stars">â˜…â˜…â˜…â˜…â˜…</span></div>
        <div class="ledger-row"><span class="label">Subject Knowledge</span><span class="stars">â˜…â˜…â˜…â˜…â˜†</span></div>
        <div class="ledger-row"><span class="label">Punctuality</span><span class="stars">â˜…â˜…â˜…â˜…â˜…</span></div>
        <div class="ledger-row"><span class="label">Overall feel</span><span class="stars">ðŸ™‚</span></div>
      </div>
      <div class="ledger-foot"><span><span class="pulse-dot"></span>Synced to institution register</span><span>#RESP-2291</span></div>
    </div>
  </div></header>

  <section class="section" id="features"><div class="container">
    <div class="section-head"><span class="eyebrow">Platform</span><h2>Built for how a college actually runs feedback</h2><p>One codebase, every institution isolated by row-level security, no cross-tenant leakage.</p></div>
    <div class="grid feature-grid">
      ${[
        ['ðŸ“‹','Drag-order form builder','Ratings, emoji scales, MCQ, checkboxes, dropdowns, yes/no, dates and short answers â€” reorder and require any question.'],
        ['ðŸ”','Institution-scoped data','Every table carries an institution_id; RLS policies mean one college can never see another\'s students, staff or scores.'],
        ['ðŸªª','Auto-generated logins','Add a student by register number and Feedback System issues a login ID and temporary password instantly.'],
        ['ðŸ“Š','Live analytics','Faculty comparison, department averages, monthly trend lines and rating distributions, generated as responses arrive.'],
        ['ðŸ§ ','AI-assisted reading','Open-text answers are scanned for sentiment and recurring themes so admins can skim hundreds of comments in seconds.'],
        ['ðŸ–¨ï¸','Exportable reports','Pull a form\'s responses to CSV or a print-ready report in one click for department reviews.'],
      ].map(([ic,t,d])=>`<div class="feature-card"><div class="feature-icon" style="background:var(--parchment-2)">${ic}</div><h3>${t}</h3><p>${d}</p></div>`).join('')}
    </div>
  </div></section>

  <section class="section" id="how" style="background:var(--parchment-2)"><div class="container">
    <div class="section-head"><span class="eyebrow">Flow</span><h2>From form to record, in three steps</h2></div>
    <div class="grid steps">
      <div class="step"><div class="num">01</div><h3>Admin builds the form</h3><p>Pick a department, semester, and the faculty being evaluated, then assemble questions in any order.</p></div>
      <div class="step"><div class="num">02</div><h3>Student rates each faculty</h3><p>Pending evaluations wait on the student dashboard; each is answered once and saved with a timestamp.</p></div>
      <div class="step"><div class="num">03</div><h3>Register updates instantly</h3><p>Admin analytics, department comparisons and exports reflect every new response the moment it lands.</p></div>
    </div>
  </div></section>

  <section class="section" id="roles"><div class="container">
    <div class="role-band">
      <span class="eyebrow" style="color:var(--brass)">Access</span>
      <h2 style="color:var(--parchment);margin-top:10px;font-size:26px;">Three roles, three very different views of the same register</h2>
      <div class="grid role-grid">
        <div class="role-card"><span class="tag">Super Admin</span><h3>Platform owner</h3><ul><li>Create / disable institutions</li><li>View platform-wide analytics</li><li>Manage subscriptions</li></ul></div>
        <div class="role-card"><span class="tag">Institution Admin</span><h3>Runs one college</h3><ul><li>Manage students, teachers, departments</li><li>Build and publish feedback forms</li><li>View analytics, export reports</li></ul></div>
        <div class="role-card"><span class="tag">Student</span><h3>Rates faculty</h3><ul><li>See pending evaluations</li><li>Submit ratings &amp; comments</li><li>Review submission history</li></ul></div>
      </div>
    </div>
  </div></section>

  <footer class="footer"><div class="container row between">
    <div>Â© 2026 Feedback System â€” institution feedback register.</div>
    <div class="row gap-16"><a href="#" data-nav="login">Log in</a><a href="#" data-nav="signup">Sign up</a></div>
  </div></footer>
  `;
}

/* ================================================================
   RENDER: AUTH (login / signup)
   ================================================================ */
function renderAuth(mode){
  const tab = state.authTab;
  return `
  <div class="auth-wrap"><div class="auth-card">
    <a href="#" class="auth-back" data-nav="landing">&larr; Back home</a>
    <h2>${mode==='signup' ? 'Create your student account' : 'Welcome back'}</h2>
    <p class="sub">${mode==='signup' ? 'Join your institution\'s feedback register.' : 'Sign in to continue to your dashboard.'}</p>

    ${mode==='login' ? `
    <div class="tab-row">
      <button class="tab-btn ${tab==='student'?'active':''}" data-authtab="student">Student</button>
      <button class="tab-btn ${tab==='admin'?'active':''}" data-authtab="admin">Institution Admin</button>
      <button class="tab-btn ${tab==='super'?'active':''}" data-authtab="super">Super Admin</button>
    </div>
    <div class="form-err" id="authErr"></div>
    <form id="loginForm">
      ${tab!=='super' ? `<div class="field"><label>Institution code</label><input name="instCode" placeholder="e.g. KSRCT001" value="KSRCT001" required></div>` : ''}
      <div class="field"><label>${tab==='student'?'Login ID or email':'Email or login ID'}</label><input name="loginId" placeholder="${tab==='student'?'22AIML101':tab==='admin'?'ADMIN':'super@edusphere.ai'}" required></div>
      <div class="field"><label>Password</label><input type="password" name="password" placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" required></div>
      <button class="btn btn-primary btn-block" type="submit">Log in</button>
    </form>
    <div class="credential-box">Demo credentials â€”<br>Student: 22AIML101 / Temp@123 (code KSRCT001)<br>Admin: ADMIN / Admin@123 (code KSRCT001)<br>Super Admin: super@edusphere.ai / Super@123</div>
    <div class="auth-switch">New student? <a href="#" data-nav="signup">Create an account</a></div>
    ` : `
    <div class="form-err" id="authErr"></div>
    <form id="signupForm">
      <div class="field"><label>Institution code</label><input name="instCode" placeholder="e.g. KSRCT001" value="KSRCT001" required></div>
      <div class="field"><label>Full name</label><input name="fullName" placeholder="Your name" required></div>
      <div class="field-row">
        <div class="field"><label>Register number</label><input name="registerNumber" placeholder="22AIML1XX" required></div>
        <div class="field"><label>Year</label><select name="year"><option>1</option><option>2</option><option>3</option><option>4</option></select></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Department</label><input name="department" placeholder="CSE (AIML)" required></div>
        <div class="field"><label>Section</label><input name="section" placeholder="A" required></div>
      </div>
      <div class="field"><label>Email</label><input type="email" name="email" placeholder="you@college.edu" required></div>
      <div class="field"><label>Password</label><input type="password" name="password" placeholder="Choose a password" minlength="6" required></div>
      <button class="btn btn-primary btn-block" type="submit">Create account</button>
    </form>
    <div class="auth-switch">Already have an account? <a href="#" data-nav="login">Log in</a></div>
    `}
  </div></div>
  `;
}

function handleLogin(form){
  const errBox = document.getElementById('authErr');
  errBox.style.display='none';
  const tab = state.authTab;
  const loginId = form.loginId.value.trim();
  const password = form.password.value;

  if(tab==='teacher'){
    errBox.textContent='Teacher login is not available on this website.';
    errBox.style.display='block';
    return;
  }

  if(tab==='super'){
    let su = db.users.find(u=>u.role==='super_admin');
    if(!su){ su = {id:uid('usr'), role:'super_admin', fullName:'Super Admin', email:'super@edusphere.ai', password:'Super@123', status:'active'}; db.users.push(su); saveDB(); }
    if(loginId.toLowerCase()!==su.email.toLowerCase() || password!==su.password){ errBox.textContent='Invalid super admin credentials.'; errBox.style.display='block'; return; }
    setSession({userId:su.id, role:'super_admin'}); state.session=getSession();
    navigate('super'); toast('Welcome back, Super Admin'); return;
  }

  const inst = DB.institutionByCode(form.instCode.value.trim());
  if(!inst){ errBox.textContent='No institution found with that code.'; errBox.style.display='block'; return; }
  if(inst.status!=='active'){ errBox.textContent='This institution is currently disabled.'; errBox.style.display='block'; return; }
  const user = DB.findUser(inst.id, loginId, password);
  if(!user || user.role!==tab){ errBox.textContent='Invalid credentials for this role.'; errBox.style.display='block'; return; }
  setSession({userId:user.id, role:user.role, institutionId:inst.id, teacherId:user.teacherId || null}); state.session=getSession();
  if(user.role==='admin') navigate('admin');
  else navigate('student');
  toast(`Welcome, ${user.fullName.split(' ')[0]}`);
}

function handleSignup(form){
  const errBox = document.getElementById('authErr');
  errBox.style.display='none';
  const inst = DB.institutionByCode(form.instCode.value.trim());
  if(!inst){ errBox.textContent='No institution found with that code. Check with your admin.'; errBox.style.display='block'; return; }
  const email = form.email.value.trim();
  if(DB.emailTaken(email)){ errBox.textContent='An account with this email already exists.'; errBox.style.display='block'; return; }
  const regNo = form.registerNumber.value.trim().toUpperCase();
  const user = DB.createUser({
    institutionId: inst.id, role:'student', fullName: form.fullName.value.trim(), email,
    password: form.password.value, department: form.department.value.trim(), year: form.year.value,
    section: form.section.value.trim(), registerNumber: regNo, loginId: regNo, phone:'',
  });
  setSession({userId:user.id, role:'student', institutionId:inst.id}); state.session=getSession();
  navigate('student'); toast('Account created â€” welcome to ' + inst.name);
}

/* ================================================================
   SHELL (sidebar) for student / admin
   ================================================================ */
function shellSidebar(role){
  const s = state.session;
  const inst = DB.institution(s.institutionId);
  const user = DB.user(s.userId);
  const items = role==='admin' ? [
    ['overview','â—§','Overview'], ['teachers','ðŸŽ“','Teachers'], ['departments','ðŸ›','Departments'],
    ['students','ðŸ§‘â€ðŸŽ“','Students'], ['forms','ðŸ“‹','Feedback Forms'], ['responses','ðŸ“Š','Responses & Analytics'],
    ['reports','ðŸ–¨','Reports'], ['settings','âš™','Settings'],
  ] : role==='teacher' ? [
    ['assigned','ðŸ“','Assigned Forms'], ['profile','ðŸ‘¤','Profile'],
  ] : [
    ['pending','ðŸ•“','Pending Feedback'], ['history','ðŸ“œ','Submission History'], ['profile','ðŸ‘¤','Profile'],
  ];
  const activeTab = role==='admin' ? state.adminTab : role==='teacher' ? state.teacherTab : state.studentTab;
  return `
  <aside class="sidebar">
    <div class="sidebar-brand"><div class="brand-mark">FS</div>Feedback System</div>
    <div class="side-inst"><div class="name">${escapeHtml(inst.name)}</div><div class="code mono">${escapeHtml(inst.code)}</div></div>
    <nav class="side-nav">
      ${items.map(([key,ic,label])=>`<button class="side-link ${activeTab===key?'active':''}" data-${role}tab="${key}"><span class="side-ic">${ic}</span>${label}</button>`).join('')}
    </nav>
    <div class="side-foot">
      <div class="side-user"><div class="avatar">${avatarInitials(user.fullName)}</div><div><div class="u-name">${escapeHtml(user.fullName)}</div><div class="u-role">${role.replace('_',' ')}</div></div></div>
      <a href="#" class="logout-link" data-action="logout">Sign out â†’</a>
    </div>
  </aside>`;
}

/* ================================================================
   STUDENT VIEWS
   ================================================================ */
function studentPendingList(){
  const s = state.session;
  const forms = DB.formsByInstitution(s.institutionId).filter(f=>f.status==='published');
  const rows = [];
  forms.forEach(f => f.teacherIds.forEach(tid => {
    if(!DB.hasResponded(f.id, tid, s.userId)){
      const t = DB.teacher(tid);
      if(t) rows.push({form:f, teacher:t});
    }
  }));
  if(!rows.length){
    return `<div class="panel empty"><div class="glyph">âœ…</div><h4>You're all caught up</h4><p>No pending evaluations right now â€” new teachers or forms will appear here once your admin publishes them.</p></div>`;
  }
  return `<div class="grid pf-grid">${rows.map(({form,teacher})=>`
    <div class="pf-card">
      <div><span class="badge badge-brass">${escapeHtml(teacher.subject)}</span></div>
      <div class="form-title">${escapeHtml(teacher.name)}</div>
      <div class="teacher">${escapeHtml(teacher.designation)} Â· ${escapeHtml(teacher.department || 'Department')}</div>
      <div class="meta-row"><span class="badge badge-grey">${form.questions.length} questions</span><span class="badge badge-grey">${escapeHtml(form.title)}</span></div>
      <button class="btn btn-primary btn-block btn-sm" data-submit-form="${form.id}" data-submit-teacher="${teacher.id}">Give feedback</button>
    </div>`).join('')}</div>`;
}

function studentHistory(){
  const s = state.session;
  const my = DB.responsesByStudent(s.userId).sort((a,b)=> new Date(b.submittedAt)-new Date(a.submittedAt));
  if(!my.length) return `<div class="panel empty"><div class="glyph">ðŸ“œ</div><h4>No submissions yet</h4><p>Feedback you submit will show up here with a recorded timestamp.</p></div>`;
  return `<div class="panel">${my.map(r=>{
    const f = DB.form(r.formId), t = DB.teacher(r.teacherId);
    return `<div class="hist-item"><div class="mini-seal">âœ“</div><div style="flex:1;"><div class="h-title">${escapeHtml(t?t.name:'Unknown')} â€” ${escapeHtml(f?f.title:'Deleted form')}</div><div class="h-meta">RECORDED ${fmtDateTime(r.submittedAt)} Â· #${r.id.toUpperCase()}</div></div><span class="badge badge-teal">Verified</span></div>`;
  }).join('')}</div>`;
}

function studentProfile(){
  const u = DB.user(state.session.userId);
  const inst = DB.institution(state.session.institutionId);
  return `<div class="panel" style="max-width:520px;">
    <div class="panel-head"><div><h3>My profile</h3><div class="sub">${escapeHtml(inst.name)}</div></div><div class="avatar" style="width:44px;height:44px;font-size:15px;">${avatarInitials(u.fullName)}</div></div>
    <form id="profileForm">
      <div class="field"><label>Full name</label><input name="fullName" value="${escapeHtml(u.fullName)}" required></div>
      <div class="field-row">
        <div class="field"><label>Register number</label><input value="${escapeHtml(u.registerNumber||'')}" disabled></div>
        <div class="field"><label>Login ID</label><input value="${escapeHtml(u.loginId)}" disabled class="mono"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Department</label><input name="department" value="${escapeHtml(u.department||'')}"></div>
        <div class="field"><label>Year / Section</label><input name="yearSection" value="${escapeHtml((u.year||'')+' / '+(u.section||''))}" disabled></div>
      </div>
      <div class="field"><label>Email</label><input name="email" type="email" value="${escapeHtml(u.email)}" required></div>
      <div class="field"><label>Phone</label><input name="phone" value="${escapeHtml(u.phone||'')}" placeholder="Optional"></div>
      <button class="btn btn-primary" type="submit">Save changes</button>
    </form>
  </div>`;
}

function renderStudent(){
  const stat = {
    pending: (()=>{ const s=state.session; let c=0; DB.formsByInstitution(s.institutionId).filter(f=>f.status==='published').forEach(f=>f.teacherIds.forEach(t=>{ if(!DB.hasResponded(f.id,t,s.userId)) c++; })); return c; })(),
    submitted: DB.responsesByStudent(state.session.userId).length,
  };
  const tabMap = {pending: studentPendingList, history: studentHistory, profile: studentProfile};
  const titleMap = {pending:['Pending feedback','Faculty evaluations waiting for your response'], history:['Submission history','Every evaluation you\'ve recorded so far'], profile:['My profile','Manage your account details']};
  const [title,sub] = titleMap[state.studentTab];
  return `<div class="app-shell">
    ${shellSidebar('student')}
    <main class="main">
      <div class="topbar"><div><h1>${title}</h1><div class="sub">${sub}</div></div></div>
      ${state.studentTab==='pending' ? `<div class="grid stat-grid" style="grid-template-columns:repeat(2,1fr);max-width:520px;">
        <div class="stat-card"><span class="eyebrow">Pending</span><div class="val">${stat.pending}</div></div>
        <div class="stat-card"><span class="eyebrow">Submitted</span><div class="val">${stat.submitted}</div></div>
      </div>` : ''}
      ${tabMap[state.studentTab]()}
    </main>
  </div>`;
}

function teacherAssigned(){
  const s = state.session;
  const teacher = DB.teacher(s.teacherId) || db.teachers.find(t => t.email.toLowerCase() === DB.user(s.userId)?.email.toLowerCase());
  const forms = teacher ? DB.formsByInstitution(s.institutionId).filter(f => f.teacherIds.includes(teacher.id)) : [];
  if(!teacher){
    return `<div class="panel empty"><div class="glyph">ðŸ‘©â€ðŸ«</div><h4>Teacher profile not found</h4><p>Your teacher login is stored, but the linked teacher record is missing.</p></div>`;
  }
  return `<div class="app-shell">
    ${shellSidebar('teacher')}
    <main class="main">
      <div class="topbar"><div><h1>Teacher dashboard</h1><div class="sub">Assigned feedback forms for ${escapeHtml(teacher.name)}</div></div></div>
      <div class="grid stat-grid" style="grid-template-columns:repeat(3,1fr);max-width:720px;">
        <div class="stat-card"><span class="eyebrow">Department</span><div class="val" style="font-size:20px;">${escapeHtml(teacher.department)}</div></div>
        <div class="stat-card"><span class="eyebrow">Subject</span><div class="val" style="font-size:20px;">${escapeHtml(teacher.subject)}</div></div>
        <div class="stat-card"><span class="eyebrow">Forms assigned</span><div class="val">${forms.length}</div></div>
      </div>
      <div class="panel">
        <div class="panel-head"><div><h3>Assigned forms</h3><div class="sub">These are the forms this teacher account can review</div></div></div>
        ${forms.length ? forms.map(f => `<div class="hist-item"><div class="mini-seal">âœ“</div><div style="flex:1;"><div class="h-title">${escapeHtml(f.title)}</div><div class="h-meta">${escapeHtml(f.description || '')} Â· ${escapeHtml(f.status)}</div></div><span class="badge badge-teal">${DB.responsesByForm(f.id).length} responses</span></div>`).join('') : '<div class="empty"><p>No assigned forms yet.</p></div>'}
      </div>
    </main>
  </div>`;
}

/* -------- feedback submission modal -------- */
function renderSubmissionModal(){
  const {formId, teacherId} = state.activeSubmission;
  const form = DB.form(formId), teacher = DB.teacher(teacherId);
  const qHtml = form.questions.map((q,i)=>{
    let input='';
    if(q.type==='rating') input = `<div class="star-picker" data-qid="${q.id}" data-type="rating">${[1,2,3,4,5].map(n=>`<button type="button" data-val="${n}">â˜…</button>`).join('')}</div>`;
    else if(q.type==='emoji') input = `<div class="emoji-picker" data-qid="${q.id}" data-type="emoji">${['ðŸ˜','ðŸ™‚','ðŸ˜','ðŸ™','ðŸ˜ž'].map(e=>`<button type="button" data-val="${e}">${e}</button>`).join('')}</div>`;
    else if(q.type==='yesno') input = `<div class="choice-list" data-qid="${q.id}" data-type="radio">${['Yes','No'].map(o=>`<label class="choice-opt"><input type="radio" name="q_${q.id}" value="${o}">${o}</label>`).join('')}</div>`;
    else if(q.type==='radio' || q.type==='dropdown') input = `<div class="choice-list" data-qid="${q.id}" data-type="radio">${(q.options||['Option A','Option B']).map(o=>`<label class="choice-opt"><input type="radio" name="q_${q.id}" value="${escapeHtml(o)}">${escapeHtml(o)}</label>`).join('')}</div>`;
    else if(q.type==='checkbox') input = `<div class="choice-list" data-qid="${q.id}" data-type="checkbox">${(q.options||['Option A','Option B']).map(o=>`<label class="choice-opt"><input type="checkbox" name="q_${q.id}" value="${escapeHtml(o)}">${escapeHtml(o)}</label>`).join('')}</div>`;
    else if(q.type==='date') input = `<input type="date" name="q_${q.id}" data-qid="${q.id}" data-type="date">`;
    else if(q.type==='textarea') input = `<textarea name="q_${q.id}" data-qid="${q.id}" data-type="text" rows="3" placeholder="Type your answer..."></textarea>`;
    else input = `<input name="q_${q.id}" data-qid="${q.id}" data-type="text" placeholder="Type your answer...">`;
    return `<div class="field"><label>${i+1}. ${escapeHtml(q.text)} ${q.required?'<span style="color:var(--rust)">*</span>':''}</label>${input}</div>`;
  }).join('');
  return `<div class="modal-bg" data-close-on-bg="submitModal">
    <div class="modal">
      <div class="modal-head"><div><h3>${escapeHtml(teacher.name)}</h3><div class="sub" style="font-size:12px;color:var(--ink-50);">${escapeHtml(form.title)}</div></div><button class="icon-btn" data-action="close-modal">âœ•</button></div>
      <form id="submissionForm">${qHtml}<button class="btn btn-primary btn-block" type="submit">Submit feedback</button></form>
    </div>
  </div>`;
}

function collectSubmissionAnswers(formEl, form){
  const answers = {};
  const missing = [];
  form.questions.forEach(q=>{
    let val = null;
    if(q.type==='rating' || q.type==='emoji'){
      const picker = formEl.querySelector(`[data-qid="${q.id}"]`);
      val = picker.dataset.value || null;
    } else if(q.type==='checkbox'){
      const checked = [...formEl.querySelectorAll(`input[name="q_${q.id}"]:checked`)].map(c=>c.value);
      val = checked.length ? checked.join(', ') : null;
    } else if(q.type==='radio' || q.type==='dropdown' || q.type==='yesno'){
      const checked = formEl.querySelector(`input[name="q_${q.id}"]:checked`);
      val = checked ? checked.value : null;
    } else {
      const field = formEl.querySelector(`[name="q_${q.id}"]`);
      val = field.value.trim() || null;
    }
    if(q.required && !val) missing.push(q.text);
    if(val) answers[q.id] = val;
  });
  return {answers, missing};
}

/* ================================================================
   ADMIN VIEWS
   ================================================================ */
function adminOverview(){
  const s = state.session;
  const teachers = DB.teachersByInstitution(s.institutionId);
  const students = DB.usersByInstitution(s.institutionId,'student');
  const forms = DB.formsByInstitution(s.institutionId);
  const responses = DB.responsesByInstitution(s.institutionId);
  const published = forms.filter(f=>f.status==='published');
  let potential = 0; published.forEach(f=>{ potential += f.teacherIds.length * students.length; });
  const responseRate = potential ? Math.round((responses.length/potential)*100) : 0;
  const ratingAnswers = [];
  responses.forEach(r=>{ const f=DB.form(r.formId); if(!f) return; f.questions.forEach(q=>{ if(q.type==='rating' && r.answers[q.id]) ratingAnswers.push(Number(r.answers[q.id])); }); });
  const avgRating = ratingAnswers.length ? (ratingAnswers.reduce((a,b)=>a+b,0)/ratingAnswers.length).toFixed(1) : 'â€”';

  // faculty comparison
  const facAvg = teachers.map(t=>{
    const tResp = responses.filter(r=>r.teacherId===t.id);
    const vals = [];
    tResp.forEach(r=>{ const f=DB.form(r.formId); if(!f) return; f.questions.forEach(q=>{ if(q.type==='rating' && r.answers[q.id]) vals.push(Number(r.answers[q.id])); }); });
    return {name:t.name.split(' ').slice(-1)[0], avg: vals.length ? +(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(2) : 0};
  });
  // monthly trend
  const trendMap = {};
  responses.forEach(r=>{ const k=monthKey(r.submittedAt); trendMap[k]=(trendMap[k]||0)+1; });
  const trendLabels = Object.keys(trendMap);
  const recent = responses.slice().sort((a,b)=>new Date(b.submittedAt)-new Date(a.submittedAt)).slice(0,5);

  setTimeout(()=>drawCharts({facAvg, trendLabels, trendVals:Object.values(trendMap)}), 0);

  return `
  <div class="grid stat-grid">
    <div class="stat-card"><span class="eyebrow">Total students</span><div class="val">${students.length}</div></div>
    <div class="stat-card"><span class="eyebrow">Total teachers</span><div class="val">${teachers.length}</div></div>
    <div class="stat-card"><span class="eyebrow">Feedback forms</span><div class="val">${forms.length}</div><div class="delta">${published.length} published</div></div>
    <div class="stat-card"><span class="eyebrow">Response rate</span><div class="val">${responseRate}%</div><div class="delta ${responseRate<50?'down':''}">${responses.length} responses recorded</div></div>
  </div>
  <div class="grid two-col">
    <div class="panel"><div class="panel-head"><div><h3>Faculty comparison</h3><div class="sub">Average rating out of 5</div></div></div><div class="chart-wrap"><canvas id="chartFaculty"></canvas></div></div>
    <div class="panel"><div class="panel-head"><div><h3>Monthly response trend</h3><div class="sub">Responses recorded per month</div></div></div><div class="chart-wrap"><canvas id="chartTrend"></canvas></div></div>
  </div>
  <div class="grid two-col">
    <div class="panel">
      <div class="panel-head"><div><h3>Recent activity</h3><div class="sub">Latest feedback recorded</div></div></div>
      ${recent.length ? recent.map(r=>{ const f=DB.form(r.formId), t=DB.teacher(r.teacherId), st=DB.user(r.studentId); return `<div class="hist-item"><div class="mini-seal">âœ“</div><div style="flex:1;"><div class="h-title">${escapeHtml(st?st.fullName:'â€”')} rated ${escapeHtml(t?t.name:'â€”')}</div><div class="h-meta">${escapeHtml(f?f.title:'')} Â· ${fmtDateTime(r.submittedAt)}</div></div></div>`;}).join('') : `<div class="empty"><p>No responses yet.</p></div>`}
    </div>
    <div class="panel">
      <div class="panel-head"><div><h3>Average rating</h3><div class="sub">Across all faculty &amp; forms</div></div></div>
      <div style="text-align:center;padding:20px 0;"><div style="font-family:var(--font-display);font-size:52px;">${avgRating}</div><div class="sub" style="color:var(--ink-50);font-size:12.5px;">out of 5.0 Â· ${ratingAnswers.length} rating answers</div></div>
    </div>
  </div>`;
}

let chartRefs = {};
function destroyCharts(){ Object.values(chartRefs).forEach(c=>c && c.destroy()); chartRefs = {}; }
function drawCharts({facAvg, trendLabels, trendVals}){
  destroyCharts();
  const facCanvas = document.getElementById('chartFaculty');
  if(facCanvas){
    chartRefs.faculty = new Chart(facCanvas, {type:'bar', data:{labels:facAvg.map(f=>f.name), datasets:[{label:'Avg rating', data:facAvg.map(f=>f.avg), backgroundColor:'#C9A227', borderRadius:6}]}, options:{scales:{y:{beginAtZero:true,max:5,grid:{color:'#EDE9DC'}}, x:{grid:{display:false}}}, plugins:{legend:{display:false}}}});
  }
  const trendCanvas = document.getElementById('chartTrend');
  if(trendCanvas){
    chartRefs.trend = new Chart(trendCanvas, {type:'line', data:{labels:trendLabels, datasets:[{label:'Responses', data:trendVals, borderColor:'#2F6F62', backgroundColor:'rgba(47,111,98,0.12)', fill:true, tension:.35}]}, options:{scales:{y:{beginAtZero:true,grid:{color:'#EDE9DC'}}, x:{grid:{display:false}}}, plugins:{legend:{display:false}}}});
  }
}

function adminTeachers(){
  const s = state.session;
  const teachers = DB.teachersByInstitution(s.institutionId);
  return `<div class="panel">
    <div class="panel-head"><div><h3>Teachers</h3><div class="sub">${teachers.length} on record Â· adding a teacher creates a student feedback card for that department</div></div><button class="btn btn-brass btn-sm" data-action="open-teacher-modal">+ Add teacher</button></div>
    <div class="table-scroll"><table><thead><tr><th>Name</th><th>Employee ID</th><th>Department</th><th>Subject</th><th>Status</th><th></th></tr></thead><tbody>
    ${teachers.length ? teachers.map(t=>`<tr>
      <td><strong>${escapeHtml(t.name)}</strong><br><span style="font-size:11.5px;color:var(--ink-50);">${escapeHtml(t.designation)}</span></td>
      <td class="mono">${escapeHtml(t.employeeId)}</td><td>${escapeHtml(t.department)}</td><td>${escapeHtml(t.subject)}</td>
      <td><span class="badge ${t.status==='active'?'badge-teal':'badge-grey'}">${t.status}</span></td>
      <td><div class="row-actions">
        <button class="icon-btn" title="Toggle active" data-toggle-teacher="${t.id}">â»</button>
        <button class="icon-btn" title="Delete" data-delete-teacher="${t.id}">ðŸ—‘</button>
      </div></td></tr>`).join('') : `<tr><td colspan="6"><div class="empty"><p>No teachers added yet.</p></div></td></tr>`}
    </tbody></table></div>
  </div>`;
}

function adminDepartments(){
  const s = state.session;
  const depts = DB.departmentsByInstitution(s.institutionId);
  return `<div class="panel">
    <div class="panel-head"><div><h3>Departments</h3><div class="sub">${depts.length} configured</div></div><button class="btn btn-brass btn-sm" data-action="open-dept-modal">+ Add department</button></div>
    <div class="table-scroll"><table><thead><tr><th>Department</th><th>HOD</th><th></th></tr></thead><tbody>
    ${depts.length ? depts.map(d=>`<tr><td><strong>${escapeHtml(d.name)}</strong></td><td>${escapeHtml(d.hod||'â€”')}</td><td><button class="icon-btn" data-delete-dept="${d.id}">ðŸ—‘</button></td></tr>`).join('') : `<tr><td colspan="3"><div class="empty"><p>No departments yet.</p></div></td></tr>`}
    </tbody></table></div>
  </div>`;
}

function adminStudents(){
  const s = state.session;
  const students = DB.usersByInstitution(s.institutionId,'student');
  return `<div class="panel">
    <div class="panel-head"><div><h3>Students</h3><div class="sub">${students.length} enrolled Â· logins auto-generated from register number</div></div><button class="btn btn-brass btn-sm" data-action="open-student-modal">+ Add student</button></div>
    <div class="table-scroll"><table><thead><tr><th>Name</th><th>Register No.</th><th>Login ID</th><th>Dept / Year</th><th>Status</th><th></th></tr></thead><tbody>
    ${students.length ? students.map(u=>`<tr>
      <td>${escapeHtml(u.fullName)}</td><td class="mono">${escapeHtml(u.registerNumber||'â€”')}</td><td class="mono">${escapeHtml(u.loginId)}</td>
      <td>${escapeHtml(u.department||'â€”')} Â· Y${escapeHtml(u.year||'â€”')}</td>
      <td><span class="badge ${u.status==='active'?'badge-teal':'badge-grey'}">${u.status}</span></td>
      <td><div class="row-actions">
        <button class="btn btn-ghost btn-sm" data-reset-password="${u.id}">Reset password</button>
        <button class="icon-btn" data-delete-student="${u.id}">ðŸ—‘</button>
      </div></td></tr>`).join('') : `<tr><td colspan="6"><div class="empty"><p>No students yet â€” add one or share your institution code so students can self-register.</p></div></td></tr>`}
    </tbody></table></div>
  </div>`;
}

function adminForms(){
  const s = state.session;
  const forms = DB.formsByInstitution(s.institutionId);
  return `<div class="panel">
    <div class="panel-head"><div><h3>Feedback forms</h3><div class="sub">${forms.length} total</div></div><button class="btn btn-brass btn-sm" data-action="new-form">+ New form</button></div>
    <div class="table-scroll"><table><thead><tr><th>Title</th><th>Semester</th><th>Faculty</th><th>Questions</th><th>Status</th><th>Responses</th><th></th></tr></thead><tbody>
    ${forms.length ? forms.map(f=>{
      const respCount = DB.responsesByForm(f.id).length;
      return `<tr>
      <td><strong>${escapeHtml(f.title)}</strong></td><td>Sem ${escapeHtml(f.semester||'â€”')}</td>
      <td>${f.teacherIds.map(id=>{const t=DB.teacher(id); return t?escapeHtml(t.name.split(' ').slice(-1)[0]):'';}).filter(Boolean).join(', ')||'â€”'}</td>
      <td>${f.questions.length}</td>
      <td><span class="badge ${f.status==='published'?'badge-teal':'badge-grey'}">${f.status}</span></td>
      <td>${respCount}</td>
      <td><div class="row-actions">
        <button class="btn btn-ghost btn-sm" data-edit-form="${f.id}">Edit</button>
        <button class="btn btn-ghost btn-sm" data-toggle-form="${f.id}">${f.status==='published'?'Unpublish':'Publish'}</button>
        <button class="icon-btn" data-delete-form="${f.id}">ðŸ—‘</button>
      </div></td></tr>`;}).join('') : `<tr><td colspan="7"><div class="empty"><p>No feedback forms yet. Create your first one.</p></div></td></tr>`}
    </tbody></table></div>
  </div>`;
}

function questionEditorRow(q, idx, total){
  const needsOptions = q.type==='radio' || q.type==='checkbox' || q.type==='dropdown';
  return `<div class="q-item" data-qrow="${q.id}">
    <div class="q-item-head">
      <div class="row gap-8"><span class="q-order">Q${idx+1}</span><span class="q-type-pill">${q.type}</span></div>
      <div class="row gap-8">
        <button type="button" class="icon-btn" data-move-q="${q.id}" data-dir="up" ${idx===0?'disabled':''}>â†‘</button>
        <button type="button" class="icon-btn" data-move-q="${q.id}" data-dir="down" ${idx===total-1?'disabled':''}>â†“</button>
        <button type="button" class="icon-btn" data-remove-q="${q.id}">âœ•</button>
      </div>
    </div>
    <div class="field-row">
      <div class="field" style="flex:2;"><label>Question text</label><input data-qfield="text" data-qid="${q.id}" value="${escapeHtml(q.text)}" placeholder="e.g. Teaching Quality"></div>
      <div class="field"><label>Type</label><select data-qfield="type" data-qid="${q.id}">
        ${['rating','emoji','text','textarea','radio','checkbox','dropdown','yesno','date'].map(t=>`<option value="${t}" ${q.type===t?'selected':''}>${({rating:'â˜… Rating',emoji:'Emoji rating',text:'Short text',textarea:'Long text',radio:'Multiple choice',checkbox:'Checkbox',dropdown:'Dropdown',yesno:'Yes / No',date:'Date'})[t]}</option>`).join('')}
      </select></div>
    </div>
    ${needsOptions ? `<div class="field"><label>Options (comma separated)</label><input data-qfield="options" data-qid="${q.id}" value="${escapeHtml((q.options||[]).join(', '))}" placeholder="Option A, Option B, Option C"></div>` : ''}
    <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--ink-70);"><input type="checkbox" data-qfield="required" data-qid="${q.id}" ${q.required?'checked':''}> Required</label>
  </div>`;
}

function adminFormBuilder(){
  const s = state.session;
  const isNew = state.activeFormBuilder==='new';
  const form = isNew ? {id:null, title:'', description:'', departmentId:'', semester:'', teacherIds:[], questions:[], status:'draft'} : DB.form(state.activeFormBuilder);
  const depts = DB.departmentsByInstitution(s.institutionId);
  const teachers = DB.teachersByInstitution(s.institutionId);
  return `<div class="panel">
    <div class="panel-head"><div><h3>${isNew?'New feedback form':'Edit form'}</h3><div class="sub">Assemble faculty &amp; questions, then publish when ready</div></div>
      <button class="btn btn-ghost btn-sm" data-action="cancel-form-builder">â† Back to forms</button>
    </div>
    <form id="formBuilderForm">
      <div class="field-row">
        <div class="field" style="flex:2;"><label>Form title</label><input name="title" value="${escapeHtml(form.title)}" required placeholder="e.g. Odd Semester Course Feedback 2026"></div>
        <div class="field"><label>Semester</label><input name="semester" value="${escapeHtml(form.semester||'')}" placeholder="5"></div>
      </div>
      <div class="field"><label>Description</label><textarea name="description" rows="2" placeholder="Optional context for students">${escapeHtml(form.description||'')}</textarea></div>
      <div class="field-row">
        <div class="field"><label>Department</label><select name="departmentId"><option value="">â€” Select â€”</option>${depts.map(d=>`<option value="${d.id}" ${form.departmentId===d.id?'selected':''}>${escapeHtml(d.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Faculty being evaluated</label>
          <div class="choice-list" id="teacherPicker">${teachers.map(t=>`<label class="choice-opt"><input type="checkbox" value="${t.id}" ${form.teacherIds.includes(t.id)?'checked':''}> ${escapeHtml(t.name)} <span style="color:var(--ink-50);font-size:11.5px;">â€” ${escapeHtml(t.subject)}</span></label>`).join('') || '<p style="font-size:12.5px;color:var(--ink-50)">Add teachers first.</p>'}</div>
        </div>
      </div>

      <div class="panel-head" style="margin-top:18px;"><div><h3 style="font-size:14px;">Questions</h3></div><button type="button" class="btn btn-ghost btn-sm" data-action="add-question">+ Add question</button></div>
      <div id="questionList">${form.questions.map((q,i)=>questionEditorRow(q,i,form.questions.length)).join('') || '<p style="font-size:12.5px;color:var(--ink-50)">No questions yet â€” add your first one.</p>'}</div>

      <div class="row gap-12" style="margin-top:20px;">
        <button class="btn btn-ghost" type="submit" data-save-status="draft">Save as draft</button>
        <button class="btn btn-brass" type="submit" data-save-status="published">Save &amp; publish</button>
      </div>
    </form>
  </div>`;
}
// working in-memory question list for the open builder (kept in sync with DOM, saved on submit)
let builderQuestions = [];

function adminResponses(){
  const s = state.session;
  const forms = DB.formsByInstitution(s.institutionId);
  if(!state.activeAnalyticsForm && forms.length) state.activeAnalyticsForm = forms[0].id;
  const form = DB.form(state.activeAnalyticsForm);
  if(!forms.length) return `<div class="panel empty"><div class="glyph">ðŸ“Š</div><h4>No forms yet</h4><p>Create a feedback form to start collecting responses.</p></div>`;

  const responses = DB.responsesByForm(form.id);
  const ratingQs = form.questions.filter(q=>q.type==='rating');
  const textQs = form.questions.filter(q=>q.type==='textarea' || q.type==='text');

  // per-teacher averages for radar/bar
  const teacherStats = form.teacherIds.map(tid=>{
    const t = DB.teacher(tid);
    const tResp = responses.filter(r=>r.teacherId===tid);
    const perQ = ratingQs.map(q=>{
      const vals = tResp.map(r=>Number(r.answers[q.id])).filter(v=>!isNaN(v));
      return vals.length ? +(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(2) : 0;
    });
    const all = tResp.flatMap(r=>ratingQs.map(q=>Number(r.answers[q.id])).filter(v=>!isNaN(v)));
    return {teacher:t, count:tResp.length, perQ, avg: all.length ? +(all.reduce((a,b)=>a+b,0)/all.length).toFixed(2):0};
  });

  // rating distribution
  const dist = [0,0,0,0,0];
  responses.forEach(r=>ratingQs.forEach(q=>{ const v=Number(r.answers[q.id]); if(v>=1&&v<=5) dist[v-1]++; }));

  // sentiment heuristic on text answers
  const posWords = ['good','great','excellent','clear','patient','engaging','helpful','best','love','amazing','supportive','friendly','well'];
  const negWords = ['bad','poor','boring','confusing','late','unclear','difficult','rude','slow','worst','strict','fast'];
  let pos=0,neg=0,neu=0; const freq={};
  const stop = new Set(['the','and','a','to','is','of','in','it','this','was','very','for','with','on','are','be','as']);
  responses.forEach(r=>textQs.forEach(q=>{
    const text = (r.answers[q.id]||'').toLowerCase();
    if(!text) return;
    let hit=0;
    posWords.forEach(w=>{ if(text.includes(w)) hit++; });
    negWords.forEach(w=>{ if(text.includes(w)) hit--; });
    if(hit>0) pos++; else if(hit<0) neg++; else neu++;
    text.replace(/[^a-z\s]/g,'').split(/\s+/).forEach(w=>{ if(w.length>3 && !stop.has(w)) freq[w]=(freq[w]||0)+1; });
  }));
  const topWords = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const totalSent = pos+neg+neu || 1;

  setTimeout(()=>drawAnalyticsCharts({teacherStats, ratingQs, dist}), 0);

  return `
  <div class="panel"><div class="panel-head"><div><h3>Select form</h3></div>
    <select id="formSelector" style="padding:8px 12px;border-radius:8px;border:1px solid var(--line);">${forms.map(f=>`<option value="${f.id}" ${f.id===form.id?'selected':''}>${escapeHtml(f.title)}</option>`).join('')}</select>
  </div></div>

  <div class="grid two-col">
    <div class="panel"><div class="panel-head"><div><h3>Faculty comparison</h3><div class="sub">Average of all rating questions</div></div></div><div class="chart-wrap"><canvas id="chartRespFaculty"></canvas></div></div>
    <div class="panel"><div class="panel-head"><div><h3>Rating distribution</h3><div class="sub">Across all responses to this form</div></div></div><div class="chart-wrap"><canvas id="chartRespDist"></canvas></div></div>
  </div>
  <div class="grid two-col">
    <div class="panel"><div class="panel-head"><div><h3>Question-wise comparison</h3><div class="sub">Radar across rating questions per faculty</div></div></div><div class="chart-wrap"><canvas id="chartRadar"></canvas></div></div>
    <div class="panel">
      <div class="panel-head"><div><h3>AI-assisted comment reading</h3><div class="sub">Heuristic sentiment scan of open-text answers</div></div></div>
      ${totalSent-neu-pos-neg+pos+neg+neu===0 && responses.length===0 ? '' : ''}
      ${ (pos+neg+neu)===0 ? '<div class="empty"><p>No open-text answers submitted yet.</p></div>' : `
      <div class="row gap-16" style="margin-bottom:16px;">
        <div><div class="eyebrow">Positive</div><div style="font-family:var(--font-mono);font-size:18px;color:var(--teal);">${Math.round(pos/totalSent*100)}%</div></div>
        <div><div class="eyebrow">Neutral</div><div style="font-family:var(--font-mono);font-size:18px;color:var(--ink-70);">${Math.round(neu/totalSent*100)}%</div></div>
        <div><div class="eyebrow">Negative</div><div style="font-family:var(--font-mono);font-size:18px;color:var(--rust);">${Math.round(neg/totalSent*100)}%</div></div>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${Math.round(pos/totalSent*100)}%;"></div></div>
      <p style="font-size:12.5px;color:var(--ink-70);margin-top:14px;">Most mentioned: ${topWords.length ? topWords.map(([w])=>`<span class="badge badge-grey" style="margin:2px;">${escapeHtml(w)}</span>`).join('') : 'â€”'}</p>
      <p style="font-size:12.5px;color:var(--ink-50);margin-top:10px;">Summary: comments skew ${pos>=neg?'positive':'critical'} (${pos} positive vs ${neg} negative out of ${totalSent} written responses). Heuristic keyword scan â€” not a live model call.</p>
      `}
    </div>
  </div>

  <div class="panel">
    <div class="panel-head"><div><h3>Responses (${responses.length})</h3></div></div>
    <div class="table-scroll"><table><thead><tr><th>Student</th><th>Faculty</th><th>Avg. rating</th><th>Submitted</th></tr></thead><tbody>
    ${responses.length ? responses.slice().sort((a,b)=>new Date(b.submittedAt)-new Date(a.submittedAt)).map(r=>{
      const stu=DB.user(r.studentId), t=DB.teacher(r.teacherId);
      const vals = ratingQs.map(q=>Number(r.answers[q.id])).filter(v=>!isNaN(v));
      const avg = vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1) : 'â€”';
      return `<tr><td>${escapeHtml(stu?stu.fullName:'â€”')}</td><td>${escapeHtml(t?t.name:'â€”')}</td><td class="mono">${avg}</td><td>${fmtDateTime(r.submittedAt)}</td></tr>`;
    }).join('') : `<tr><td colspan="4"><div class="empty"><p>No responses recorded yet.</p></div></td></tr>`}
    </tbody></table></div>
  </div>`;
}

function drawAnalyticsCharts({teacherStats, ratingQs, dist}){
  destroyCharts();
  const facC = document.getElementById('chartRespFaculty');
  if(facC) chartRefs.rf = new Chart(facC, {type:'bar', data:{labels:teacherStats.map(t=>t.teacher.name.split(' ').slice(-1)[0]), datasets:[{data:teacherStats.map(t=>t.avg), backgroundColor:'#2F6F62', borderRadius:6}]}, options:{scales:{y:{beginAtZero:true,max:5,grid:{color:'#EDE9DC'}},x:{grid:{display:false}}}, plugins:{legend:{display:false}}}});
  const distC = document.getElementById('chartRespDist');
  if(distC) chartRefs.rd = new Chart(distC, {type:'pie', data:{labels:['1â˜…','2â˜…','3â˜…','4â˜…','5â˜…'], datasets:[{data:dist, backgroundColor:['#B65C3A','#D08862','#EDE9DC','#8FB6AC','#2F6F62']}]}, options:{plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{size:11}}}}}});
  const radarC = document.getElementById('chartRadar');
  if(radarC) chartRefs.radar = new Chart(radarC, {type:'radar', data:{labels:ratingQs.map(q=>q.text), datasets:teacherStats.map((t,i)=>({label:t.teacher.name.split(' ').slice(-1)[0], data:t.perQ, borderColor:['#C9A227','#2F6F62','#B65C3A'][i%3], backgroundColor:['rgba(201,162,39,0.15)','rgba(47,111,98,0.15)','rgba(182,92,58,0.15)'][i%3]}))}, options:{scales:{r:{beginAtZero:true,max:5,pointLabels:{font:{size:10}}}}, plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{size:11}}}}}});
}

function adminReports(){
  const s = state.session;
  const forms = DB.formsByInstitution(s.institutionId);
  return `<div class="panel">
    <div class="panel-head"><div><h3>Reports</h3><div class="sub">Export a form's responses for department review</div></div></div>
    ${forms.length ? `<div class="field" style="max-width:360px;"><label>Form</label><select id="reportFormSelect">${forms.map(f=>`<option value="${f.id}">${escapeHtml(f.title)}</option>`).join('')}</select></div>
    <div class="row gap-12" style="margin-top:16px;">
      <button class="btn btn-primary" data-action="export-csv">â¬‡ Download CSV</button>
      <button class="btn btn-ghost" data-action="print-report">ðŸ–¨ Print / Save as PDF</button>
    </div>
    <p style="font-size:12px;color:var(--ink-50);margin-top:12px;">CSV includes one row per response with every question answer as a column. Print opens a formatted report using your browser's print dialog â€” choose "Save as PDF" there for a PDF file.</p>
    ` : `<div class="empty"><p>Create a feedback form first.</p></div>`}
  </div>`;
}

function adminSettings(){
  const inst = DB.institution(state.session.institutionId);
  return `<div class="panel" style="max-width:520px;">
    <div class="panel-head"><div><h3>Institution settings</h3></div><span class="badge badge-brass">${escapeHtml(inst.plan)} plan</span></div>
    <form id="instSettingsForm">
      <div class="field"><label>Institution name</label><input name="name" value="${escapeHtml(inst.name)}" required></div>
      <div class="field-row">
        <div class="field"><label>Institution code</label><input value="${escapeHtml(inst.code)}" disabled class="mono"></div>
        <div class="field"><label>Status</label><input value="${escapeHtml(inst.status)}" disabled></div>
      </div>
      <div class="field"><label>Contact email</label><input name="email" type="email" value="${escapeHtml(inst.email)}"></div>
      <div class="field"><label>Phone</label><input name="phone" value="${escapeHtml(inst.phone||'')}"></div>
      <div class="field"><label>Address</label><textarea name="address" rows="2">${escapeHtml(inst.address||'')}</textarea></div>
      <button class="btn btn-primary" type="submit">Save settings</button>
    </form>
  </div>`;
}

function renderAdmin(){
  const tabMap = {overview:adminOverview, teachers:adminTeachers, departments:adminDepartments, students:adminStudents, forms: state.activeFormBuilder ? adminFormBuilder : adminForms, responses:adminResponses, reports:adminReports, settings:adminSettings};
  const titleMap = {overview:['Overview','Everything happening in your institution today'], teachers:['Teachers','Add, deactivate or remove faculty records'], departments:['Departments','Configure departments and heads'], students:['Students','Manage enrolment and login credentials'], forms:[state.activeFormBuilder?'Form builder':'Feedback forms','Assemble and publish evaluation forms'], responses:['Responses & analytics','Live insight into every form\'s results'], reports:['Reports','Export data for offline review'], settings:['Settings','Institution profile & plan']};
  const [title,sub] = titleMap[state.adminTab];
  return `<div class="app-shell">
    ${shellSidebar('admin')}
    <main class="main">
      <div class="topbar"><div><h1>${title}</h1><div class="sub">${sub}</div></div></div>
      ${tabMap[state.adminTab]()}
    </main>
  </div>`;
}

/* ================================================================
   SUPER ADMIN
   ================================================================ */
function renderSuper(){
  const insts = DB.institutions();
  const totalStudents = db.users.filter(u=>u.role==='student').length;
  const totalAdmins = db.users.filter(u=>u.role==='admin').length;
  const totalResponses = db.responses.length;
  return `<div class="app-shell">
    <aside class="sidebar">
      <div class="sidebar-brand"><div class="brand-mark">FS</div>Feedback System</div>
      <div class="side-inst"><div class="name">Platform control</div><div class="code mono">SUPER ADMIN</div></div>
      <nav class="side-nav"><button class="side-link active"><span class="side-ic">â—§</span>Institutions</button></nav>
      <div class="side-foot"><div class="side-user"><div class="avatar">SA</div><div><div class="u-name">Super Admin</div><div class="u-role">platform owner</div></div></div><a href="#" class="logout-link" data-action="logout">Sign out â†’</a></div>
    </aside>
    <main class="main">
      <div class="topbar"><div><h1>Institutions</h1><div class="sub">Every institution on the platform, isolated by row-level security</div></div>
        <button class="btn btn-brass" data-action="open-inst-modal">+ New institution</button>
      </div>
      <div class="grid stat-grid">
        <div class="stat-card"><span class="eyebrow">Institutions</span><div class="val">${insts.length}</div></div>
        <div class="stat-card"><span class="eyebrow">Admins</span><div class="val">${totalAdmins}</div></div>
        <div class="stat-card"><span class="eyebrow">Students</span><div class="val">${totalStudents}</div></div>
        <div class="stat-card"><span class="eyebrow">Responses recorded</span><div class="val">${totalResponses}</div></div>
      </div>
      <div class="panel">
        <div class="table-scroll"><table><thead><tr><th>Institution</th><th>Code</th><th>Plan</th><th>Students</th><th>Status</th><th></th></tr></thead><tbody>
        ${insts.map(i=>{
          const sc = db.users.filter(u=>u.institutionId===i.id && u.role==='student').length;
          return `<tr><td><strong>${escapeHtml(i.name)}</strong><br><span style="font-size:11.5px;color:var(--ink-50);">${escapeHtml(i.email)}</span></td>
          <td class="mono">${escapeHtml(i.code)}</td><td><span class="badge badge-brass">${escapeHtml(i.plan)}</span></td><td>${sc}</td>
          <td><span class="badge ${i.status==='active'?'badge-teal':'badge-rust'}">${i.status}</span></td>
          <td><div class="row-actions">
            <button class="btn btn-ghost btn-sm" data-toggle-inst="${i.id}">${i.status==='active'?'Disable':'Enable'}</button>
            <button class="icon-btn" data-delete-inst="${i.id}">ðŸ—‘</button>
          </div></td></tr>`;
        }).join('')}
        </tbody></table></div>
      </div>
    </main>
  </div>`;
}

/* ================================================================
   MODALS
   ================================================================ */
function modalShell(title, bodyHtml, formId){
  return `<div class="modal-bg" data-close-on-bg="genericModal">
    <div class="modal">
      <div class="modal-head"><h3>${title}</h3><button class="icon-btn" data-action="close-modal">âœ•</button></div>
      ${bodyHtml}
    </div></div>`;
}
function renderModal(){
  if(!state.modal) return '';
  const s = state.session;
  if(state.modal==='teacher'){
    const depts = DB.departmentsByInstitution(s.institutionId);
    return modalShell('Add teacher', `<form id="teacherForm">
      <div class="field"><label>Full name</label><input name="name" required placeholder="Dr. Firstname Lastname"></div>
      <div class="field-row"><div class="field"><label>Employee ID</label><input name="employeeId" required></div><div class="field"><label>Designation</label><input name="designation" placeholder="Assistant Professor" required></div></div>
      <div class="field-row"><div class="field"><label>Department</label><input name="department" list="deptList" required>
        <datalist id="deptList">${depts.map(d=>`<option value="${escapeHtml(d.name)}">`).join('')}</datalist></div><div class="field"><label>Subject</label><input name="subject" required></div></div>
      <div class="field-row"><div class="field"><label>Email</label><input type="email" name="email" required></div><div class="field"><label>Phone</label><input name="phone"></div></div>
      <button class="btn btn-primary btn-block" type="submit">Add teacher</button>
    </form>`);
  }
  if(state.modal==='dept'){
    return modalShell('Add department', `<form id="deptForm">
      <div class="field"><label>Department name</label><input name="name" required placeholder="CSE (AIML)"></div>
      <div class="field"><label>Head of Department</label><input name="hod" placeholder="Dr. Firstname Lastname"></div>
      <button class="btn btn-primary btn-block" type="submit">Add department</button>
    </form>`);
  }
  if(state.modal==='student'){
    return modalShell('Add student', `<form id="studentForm">
      <div class="field"><label>Full name</label><input name="fullName" required></div>
      <div class="field-row"><div class="field"><label>Register number</label><input name="registerNumber" required placeholder="22AIML103"></div><div class="field"><label>Year</label><select name="year"><option>1</option><option>2</option><option>3</option><option>4</option></select></div></div>
      <div class="field-row"><div class="field"><label>Department</label><input name="department" required placeholder="CSE (AIML)"></div><div class="field"><label>Section</label><input name="section" required placeholder="A"></div></div>
      <div class="field"><label>Email</label><input type="email" name="email" required></div>
      <p class="field-hint">Login ID and a temporary password (<span class="mono">Temp@123</span>) are generated automatically from the register number.</p>
      <button class="btn btn-primary btn-block" type="submit">Add student &amp; generate login</button>
    </form>`);
  }
  if(state.modal==='institution'){
    return modalShell('Create institution', `<form id="instForm">
      <div class="field"><label>Institution name</label><input name="name" required></div>
      <div class="field-row"><div class="field"><label>Institution code</label><input name="code" required placeholder="e.g. ABCENG001"></div><div class="field"><label>Plan</label><select name="plan"><option>Free</option><option>Pro</option></select></div></div>
      <div class="field"><label>Admin email</label><input type="email" name="email" required></div>
      <div class="field"><label>Admin temporary password</label><input name="password" value="Admin@123" required></div>
      <button class="btn btn-primary btn-block" type="submit">Create institution</button>
    </form>`);
  }
  return '';
}

/* ================================================================
   MASTER RENDER
   ================================================================ */
function render(){
  const app = document.getElementById('app');
  let html = '';
  if(state.view==='landing') html = renderLanding();
  else if(state.view==='login') html = renderAuth('login');
  else if(state.view==='signup') html = renderAuth('signup');
  else if(state.view==='student') html = renderStudent();
  else if(state.view==='teacher') html = teacherAssigned();
  else if(state.view==='admin') html = renderAdmin();
  else if(state.view==='super') html = renderSuper();
  app.innerHTML = html + (state.activeSubmission ? renderSubmissionModal() : '') + renderModal();
  bindStarPickers();
}

function bindStarPickers(){
  document.querySelectorAll('.star-picker').forEach(p=>{
    p.querySelectorAll('button').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const val = btn.dataset.val;
        p.dataset.value = val;
        [...p.children].forEach(c=> c.classList.toggle('on', Number(c.dataset.val) <= Number(val)));
      });
    });
  });
  document.querySelectorAll('.emoji-picker').forEach(p=>{
    p.querySelectorAll('button').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        p.dataset.value = btn.dataset.val;
        [...p.children].forEach(c=>c.classList.toggle('on', c===btn));
      });
    });
  });
}

/* ================================================================
   EVENT DELEGATION
   ================================================================ */
document.addEventListener('click', (e)=>{
  const nav = e.target.closest('[data-nav]');
  if(nav){ e.preventDefault(); navigate(nav.dataset.nav); return; }

  const authTab = e.target.closest('[data-authtab]');
  if(authTab){ state.authTab = authTab.dataset.authtab; render(); return; }

  const adminTab = e.target.closest('[data-admintab]');
  if(adminTab){ state.adminTab = adminTab.dataset.admintab; state.activeFormBuilder=null; render(); return; }

  const studentTab = e.target.closest('[data-studenttab]');
  if(studentTab){ state.studentTab = studentTab.dataset.studenttab; render(); return; }

  if(e.target.closest('[data-action="logout"]')){ e.preventDefault(); logout(); return; }
  if(e.target.closest('[data-action="close-modal"]')){ state.modal=null; state.activeSubmission=null; render(); return; }
  const bg = e.target.closest('[data-close-on-bg]');
  if(bg && e.target===bg){ state.modal=null; state.activeSubmission=null; render(); return; }

  if(e.target.closest('[data-action="open-teacher-modal"]')){ state.modal='teacher'; render(); return; }
  if(e.target.closest('[data-action="open-dept-modal"]')){ state.modal='dept'; render(); return; }
  if(e.target.closest('[data-action="open-student-modal"]')){ state.modal='student'; render(); return; }
  if(e.target.closest('[data-action="open-inst-modal"]')){ state.modal='institution'; render(); return; }

  const submitBtn = e.target.closest('[data-submit-form]');
  if(submitBtn){ state.activeSubmission = {formId:submitBtn.dataset.submitForm, teacherId:submitBtn.dataset.submitTeacher}; render(); return; }

  const toggleTeacher = e.target.closest('[data-toggle-teacher]');
  if(toggleTeacher){ const t=DB.teacher(toggleTeacher.dataset.toggleTeacher); DB.updateTeacher(t.id,{status:t.status==='active'?'inactive':'active'}); render(); toast('Teacher status updated'); return; }
  const deleteTeacher = e.target.closest('[data-delete-teacher]');
  if(deleteTeacher){ if(confirm('Remove this teacher?')){ DB.deleteTeacher(deleteTeacher.dataset.deleteTeacher); render(); toast('Teacher removed'); } return; }
  const deleteDept = e.target.closest('[data-delete-dept]');
  if(deleteDept){ if(confirm('Remove this department?')){ DB.deleteDepartment(deleteDept.dataset.deleteDept); render(); toast('Department removed'); } return; }
  const deleteStudent = e.target.closest('[data-delete-student]');
  if(deleteStudent){ if(confirm('Remove this student?')){ DB.deleteUser(deleteStudent.dataset.deleteStudent); render(); toast('Student removed'); } return; }
  const resetPw = e.target.closest('[data-reset-password]');
  if(resetPw){ DB.updateUser(resetPw.dataset.resetPassword,{password:'Temp@123'}); toast('Password reset to Temp@123'); return; }

  const toggleInst = e.target.closest('[data-toggle-inst]');
  if(toggleInst){ const i=DB.institution(toggleInst.dataset.toggleInst); DB.updateInstitution(i.id,{status:i.status==='active'?'disabled':'active'}); render(); toast('Institution status updated'); return; }
  const deleteInst = e.target.closest('[data-delete-inst]');
  if(deleteInst){ if(confirm('Delete this institution and all its data? This cannot be undone.')){ const id=deleteInst.dataset.deleteInst; db.users=db.users.filter(u=>u.institutionId!==id); db.teachers=db.teachers.filter(t=>t.institutionId!==id); db.forms=db.forms.filter(f=>f.institutionId!==id); db.responses=db.responses.filter(r=>r.institutionId!==id); db.departments=db.departments.filter(d=>d.institutionId!==id); DB.deleteInstitution(id); render(); toast('Institution deleted'); } return; }

  if(e.target.closest('[data-action="new-form"]')){ state.activeFormBuilder='new'; builderQuestions=[]; render(); return; }
  if(e.target.closest('[data-action="cancel-form-builder"]')){ state.activeFormBuilder=null; render(); return; }
  const editForm = e.target.closest('[data-edit-form]');
  if(editForm){ state.activeFormBuilder = editForm.dataset.editForm; builderQuestions = JSON.parse(JSON.stringify(DB.form(state.activeFormBuilder).questions)); render(); return; }
  const toggleForm = e.target.closest('[data-toggle-form]');
  if(toggleForm){ const f=DB.form(toggleForm.dataset.toggleForm); DB.updateForm(f.id,{status:f.status==='published'?'draft':'published'}); render(); toast(f.status==='published'?'Form unpublished':'Form published'); return; }
  const deleteForm = e.target.closest('[data-delete-form]');
  if(deleteForm){ if(confirm('Delete this form and all its responses?')){ DB.deleteForm(deleteForm.dataset.deleteForm); render(); toast('Form deleted'); } return; }

  if(e.target.closest('[data-action="add-question"]')){
    syncBuilderQuestionsFromDOM();
    builderQuestions.push({id:uid('q'), text:'', type:'rating', required:true, options:null});
    rerenderQuestionList(); return;
  }
  const removeQ = e.target.closest('[data-remove-q]');
  if(removeQ){ syncBuilderQuestionsFromDOM(); builderQuestions = builderQuestions.filter(q=>q.id!==removeQ.dataset.removeQ); rerenderQuestionList(); return; }
  const moveQ = e.target.closest('[data-move-q]');
  if(moveQ){
    syncBuilderQuestionsFromDOM();
    const idx = builderQuestions.findIndex(q=>q.id===moveQ.dataset.moveQ);
    const dir = moveQ.dataset.dir==='up' ? -1 : 1;
    const swapIdx = idx+dir;
    if(swapIdx>=0 && swapIdx<builderQuestions.length){ [builderQuestions[idx],builderQuestions[swapIdx]] = [builderQuestions[swapIdx],builderQuestions[idx]]; }
    rerenderQuestionList(); return;
  }

  if(e.target.closest('[data-action="export-csv"]')){
    const formId = document.getElementById('reportFormSelect').value;
    exportFormCSV(formId); return;
  }
  if(e.target.closest('[data-action="print-report"]')){
    const formId = document.getElementById('reportFormSelect').value;
    printReport(formId); return;
  }
});

document.addEventListener('change', (e)=>{
  if(e.target.id==='formSelector'){ state.activeAnalyticsForm = e.target.value; render(); return; }
});

function syncBuilderQuestionsFromDOM(){
  const list = document.getElementById('questionList');
  if(!list) return;
  builderQuestions.forEach(q=>{
    const textEl = list.querySelector(`[data-qfield="text"][data-qid="${q.id}"]`);
    const typeEl = list.querySelector(`[data-qfield="type"][data-qid="${q.id}"]`);
    const optEl = list.querySelector(`[data-qfield="options"][data-qid="${q.id}"]`);
    const reqEl = list.querySelector(`[data-qfield="required"][data-qid="${q.id}"]`);
    if(textEl) q.text = textEl.value;
    if(typeEl) q.type = typeEl.value;
    if(optEl) q.options = optEl.value.split(',').map(s=>s.trim()).filter(Boolean);
    if(reqEl) q.required = reqEl.checked;
  });
}
function rerenderQuestionList(){
  const list = document.getElementById('questionList');
  if(!list) return;
  list.innerHTML = builderQuestions.map((q,i)=>questionEditorRow(q,i,builderQuestions.length)).join('') || '<p style="font-size:12.5px;color:var(--ink-50)">No questions yet â€” add your first one.</p>';
}

function exportFormCSV(formId){
  const form = DB.form(formId);
  const responses = DB.responsesByForm(formId);
  const header = ['Student','Register No.','Faculty','Submitted', ...form.questions.map(q=>q.text)];
  const rows = responses.map(r=>{
    const stu = DB.user(r.studentId), t = DB.teacher(r.teacherId);
    return [stu?stu.fullName:'', stu?stu.registerNumber||'':'', t?t.name:'', fmtDateTime(r.submittedAt), ...form.questions.map(q=>r.answers[q.id]||'')];
  });
  downloadFile(`${form.title.replace(/[^a-z0-9]+/gi,'_')}.csv`, toCSV([header, ...rows]));
  toast('CSV downloaded');
}
function printReport(formId){
  const form = DB.form(formId);
  const responses = DB.responsesByForm(formId);
  const win = window.open('', '_blank');
  const rowsHtml = responses.map(r=>{
    const stu=DB.user(r.studentId), t=DB.teacher(r.teacherId);
    return `<tr><td>${escapeHtml(stu?stu.fullName:'')}</td><td>${escapeHtml(t?t.name:'')}</td><td>${fmtDateTime(r.submittedAt)}</td>${form.questions.map(q=>`<td>${escapeHtml(r.answers[q.id]||'')}</td>`).join('')}</tr>`;
  }).join('');
  win.document.write(`<html><head><title>${escapeHtml(form.title)} â€” Report</title>
    <style>body{font-family:Arial,sans-serif;padding:30px;} h1{font-size:20px;} table{width:100%;border-collapse:collapse;margin-top:16px;} th,td{border:1px solid #ccc;padding:6px 8px;font-size:11px;text-align:left;} th{background:#eee;}</style>
    </head><body><h1>${escapeHtml(form.title)}</h1><p>${responses.length} responses Â· generated ${fmtDateTime(nowISO())}</p>
    <table><thead><tr><th>Student</th><th>Faculty</th><th>Submitted</th>${form.questions.map(q=>`<th>${escapeHtml(q.text)}</th>`).join('')}</tr></thead><tbody>${rowsHtml}</tbody></table>
    </body></html>`);
  win.document.close(); win.focus(); win.print();
}

/* ---------------- form submit delegation ---------------- */
document.addEventListener('submit', (e)=>{
  e.preventDefault();
  const form = e.target;

  if(form.id==='loginForm') return handleLogin(form);
  if(form.id==='signupForm') return handleSignup(form);

  if(form.id==='submissionForm'){
    const {formId, teacherId} = state.activeSubmission;
    const fdef = DB.form(formId);
    const {answers, missing} = collectSubmissionAnswers(form, fdef);
    if(missing.length){ toast('Please answer: ' + missing[0], 'err'); return; }
    DB.submitResponse({institutionId: state.session.institutionId, formId, teacherId, studentId: state.session.userId, answers});
    state.activeSubmission = null; render();
    toast('Feedback recorded â€” thank you!');
    return;
  }

  if(form.id==='profileForm'){
    const u = DB.user(state.session.userId);
    DB.updateUser(u.id, {fullName: form.fullName.value.trim(), email: form.email.value.trim(), department: form.department.value.trim(), phone: form.phone.value.trim()});
    render(); toast('Profile updated'); return;
  }

  if(form.id==='teacherForm'){
    const teacher = DB.createTeacher({institutionId: state.session.institutionId, name:form.name.value.trim(), employeeId:form.employeeId.value.trim(), designation:form.designation.value.trim(), department:form.department.value.trim(), subject:form.subject.value.trim(), email:form.email.value.trim(), phone:form.phone.value.trim()});
    DB.createForm({
      institutionId: state.session.institutionId,
      createdBy: state.session.userId,
      title: `Feedback for ${teacher.name}`,
      description: `Student feedback for ${teacher.name} in ${teacher.department}`,
      departmentId: '',
      semester: '',
      teacherIds: [teacher.id],
      questions: [
        {id:uid('q'), text:'Teaching Quality', type:'rating', required:true, options:null},
        {id:uid('q'), text:'Communication Skills', type:'rating', required:true, options:null},
        {id:uid('q'), text:'Subject Knowledge', type:'rating', required:true, options:null},
        {id:uid('q'), text:'Punctuality', type:'rating', required:true, options:null},
        {id:uid('q'), text:'Suggestions for improvement', type:'textarea', required:false, options:null},
      ],
      status:'published',
    });
    state.modal=null; render(); toast(`Teacher added â€” login ${teacher.employeeId} / Temp@123`); return;
  }
  if(form.id==='deptForm'){
    DB.createDepartment({institutionId: state.session.institutionId, name:form.name.value.trim(), hod:form.hod.value.trim()});
    state.modal=null; render(); toast('Department added'); return;
  }
  if(form.id==='studentForm'){
    const email = form.email.value.trim();
    if(DB.emailTaken(email)){ toast('That email is already in use', 'err'); return; }
    const reg = form.registerNumber.value.trim().toUpperCase();
    DB.createUser({institutionId: state.session.institutionId, role:'student', fullName:form.fullName.value.trim(), email, registerNumber:reg, loginId:reg, password:'Temp@123', department:form.department.value.trim(), year:form.year.value, section:form.section.value.trim(), phone:''});
    state.modal=null; render(); toast(`Student added â€” login ${reg} / Temp@123`); return;
  }
  if(form.id==='instForm'){
    const code = form.code.value.trim().toUpperCase();
    if(DB.institutionByCode(code)){ toast('That institution code is already taken', 'err'); return; }
    const inst = DB.createInstitution({name:form.name.value.trim(), code, email:form.email.value.trim(), plan:form.plan.value});
    DB.createUser({institutionId: inst.id, role:'admin', fullName:'Institution Admin', email:form.email.value.trim(), loginId:'ADMIN', password:form.password.value});
    state.modal=null; render(); toast('Institution created â€” admin login: ADMIN / ' + form.password.value); return;
  }
  if(form.id==='instSettingsForm'){
    DB.updateInstitution(state.session.institutionId, {name:form.name.value.trim(), email:form.email.value.trim(), phone:form.phone.value.trim(), address:form.address.value.trim()});
    render(); toast('Settings saved'); return;
  }

  if(form.id==='formBuilderForm'){
    syncBuilderQuestionsFromDOM();
    const teacherIds = [...document.querySelectorAll('#teacherPicker input:checked')].map(i=>i.value);
    const status = (e.submitter && e.submitter.dataset.saveStatus) || 'draft';
    const payload = {
      title: form.title.value.trim(), semester: form.semester.value.trim(), description: form.description.value.trim(),
      departmentId: form.departmentId.value, teacherIds, questions: builderQuestions, status,
    };
    if(!payload.title){ toast('Give the form a title', 'err'); return; }
    if(state.activeFormBuilder==='new'){ DB.createForm({institutionId: state.session.institutionId, createdBy: state.session.userId, ...payload}); }
    else { DB.updateForm(state.activeFormBuilder, payload); }
    state.activeFormBuilder = null; render();
    toast(status==='published' ? 'Form published' : 'Draft saved');
    return;
  }
});

/* ---------------- init ---------------- */
(async function init(){
  await hydrateFromSupabase();
  if(state.session){
    if(state.session.role==='super_admin') state.view='super';
    else if(state.session.role==='admin') state.view='admin';
    else if(state.session.role==='student') state.view='student';
  }
  render();
})();
