// Pruebas del adaptador Firestore (cdb.js) con un Firestore simulado en memoria.
// Ejecutar:  node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { make } = createRequire(import.meta.url)('../cdb.js');

function mockFS(me = 'ana@x.com') {
  const store = new Map(); // "col/id" -> data
  let auto = 0;
  const err = (code) => Object.assign(new Error(code), { code });
  const fs = {
    db: {},
    me: () => me,
    collection: (_db, col) => ({ kind: 'col', col }),
    doc: (a, col, id) => (a && a.kind === 'col' ? { kind: 'doc', col: a.col, id: 'auto' + ++auto } : { kind: 'doc', col, id }),
    getDoc: async (r) => { const k = r.col + '/' + r.id; return { exists: () => store.has(k), data: () => structuredClone(store.get(k)), id: r.id }; },
    setDoc: async (r, d) => { for (const v of Object.values(d)) if (v === undefined) throw new Error('undefined'); store.set(r.col + '/' + r.id, structuredClone(d)); },
    updateDoc: async (r, d) => { const k = r.col + '/' + r.id; if (!store.has(k)) throw err('not-found'); store.set(k, { ...store.get(k), ...structuredClone(d) }); },
    deleteDoc: async (r) => { store.delete(r.col + '/' + r.id); },
    where: (f, op, v) => ({ t: 'w', f, op, v }),
    orderBy: (f, dir) => ({ t: 'o', f, dir }),
    limit: (n) => ({ t: 'l', n }),
    query: (c, ...cs) => ({ ...c, cs }),
    getDocs: async (q) => {
      let rows = [...store.entries()].filter(([k]) => k.startsWith(q.col + '/')).map(([k, d]) => ({ id: k.split('/')[1], d }));
      for (const c of q.cs || []) {
        if (c.t === 'w') rows = rows.filter(({ d }) => (c.op === '==' ? d[c.f] === c.v : d[c.f] !== c.v));
      }
      const o = (q.cs || []).find((c) => c.t === 'o');
      if (o) rows.sort((a, b) => (a.d[o.f] < b.d[o.f] ? -1 : a.d[o.f] > b.d[o.f] ? 1 : 0) * (o.dir === 'desc' ? -1 : 1));
      const l = (q.cs || []).find((c) => c.t === 'l'); if (l) rows = rows.slice(0, l.n);
      return { forEach: (cb) => rows.forEach(({ id, d }) => cb({ id, data: () => structuredClone(d) })) };
    },
    writeBatch: () => { const ops = []; return { set: (r, d) => ops.push(() => fs.setDoc(r, d)), delete: (r) => ops.push(() => fs.deleteDoc(r)), commit: async () => { for (const f of ops) await f(); } }; },
  };
  return { fs, store };
}
const ADMIN = 'franksanlo@gmail.com';

test('user_data: upsert reemplaza (no mezcla) y el estado conserva listas anidadas', async () => {
  const { fs, store } = mockFS(); const sb = make(fs, { admin: ADMIN });
  const st1 = { grades: [{ groups: [[1, 2], [3]] }], a: 1, b: 2 };
  assert.equal((await sb.from('user_data').upsert({ user_email: 'Ana@X.com', state: st1, trash: {}, settings: { theme: 'dark' }, rev: 5 }, { onConflict: 'user_email' })).error, null);
  assert.ok(store.has('user_data/ana@x.com')); // id en minúsculas
  assert.equal(typeof store.get('user_data/ana@x.com').state, 'string'); // guardado como texto
  const st2 = { grades: [], a: 9 }; // ya no tiene "b"
  await sb.from('user_data').upsert({ user_email: 'ana@x.com', state: st2, rev: 6 }, { onConflict: 'user_email' });
  const r = await sb.from('user_data').select('state,trash,settings,rev').eq('user_email', 'ana@x.com').single();
  assert.deepEqual(r.data.state, st2); // "b" desapareció
  assert.equal(r.data.rev, 6);
  assert.equal('b' in r.data.state, false);
});

test('single sin filas da PGRST116; maybeSingle da null sin error', async () => {
  const { fs } = mockFS(); const sb = make(fs);
  const a = await sb.from('user_data').select('state').eq('user_email', 'nadie@x.com').single();
  assert.equal(a.error.code, 'PGRST116'); assert.equal(a.data, null);
  const b = await sb.from('profiles').select('role').eq('email', 'nadie@x.com').maybeSingle();
  assert.equal(b.error, null); assert.equal(b.data, null);
});

test('profiles: insert con sello de fecha, update, delete', async () => {
  const { fs, store } = mockFS(); const sb = make(fs);
  assert.equal((await sb.from('profiles').insert({ email: 'Luis@x.com', name: 'Luis', role: 'teacher' })).error, null);
  assert.ok(store.get('profiles/luis@x.com').created_at);
  await sb.from('profiles').update({ role: 'admin' }).eq('email', 'luis@x.com');
  assert.equal((await sb.from('profiles').select('role,name').eq('email', 'luis@x.com').single()).data.role, 'admin');
  const none = await sb.from('profiles').update({ role: 'x' }).eq('email', 'no@x.com').select('email');
  assert.deepEqual(none.data, []); assert.equal(none.error, null);
  await sb.from('profiles').delete().eq('email', 'luis@x.com');
  assert.equal(store.has('profiles/luis@x.com'), false);
});

test('respaldos: insert, listar por usuario ordenado, limit, like y borrado por ids', async () => {
  const { fs, store } = mockFS(); const sb = make(fs);
  const mk = (email, label, t) => sb.from('respaldos').insert({ user_email: email, state: { n: label }, lessons: 3, label, created_at: t });
  await mk('ana@x.com', 'Automático', '2026-10-01T10:00:00.000Z');
  await mk('ana@x.com', 'Manual', '2026-10-02T10:00:00.000Z');
  await mk('ana@x.com', 'Automático', '2026-10-03T10:00:00.000Z');
  await mk('otro@x.com', 'Automático', '2026-10-04T10:00:00.000Z');
  const l = await sb.from('respaldos').select('id,created_at,lessons,label').eq('user_email', 'ana@x.com').order('created_at', { ascending: false }).limit(2);
  assert.equal(l.data.length, 2); assert.equal(l.data[0].created_at, '2026-10-03T10:00:00.000Z');
  assert.deepEqual(Object.keys(l.data[0]).sort(), ['created_at', 'id', 'label', 'lessons']);
  const au = await sb.from('respaldos').select('created_at').eq('user_email', 'ana@x.com').like('label', 'Autom%').order('created_at', { ascending: false }).limit(1);
  assert.equal(au.data.length, 1); assert.equal(au.data[0].created_at, '2026-10-03T10:00:00.000Z');
  const one = await sb.from('respaldos').select('state').eq('id', l.data[0].id).single();
  assert.deepEqual(one.data.state, { n: 'Automático' });
  const ids = l.data.map((x) => x.id);
  await sb.from('respaldos').delete().in('id', ids);
  assert.equal([...store.keys()].filter((k) => k.startsWith('respaldos/')).length, 2);
});

test('insert de varios (lote) y listado completo', async () => {
  const { fs } = mockFS(); const sb = make(fs);
  const rows = Array.from({ length: 450 }, (_, i) => ({ user_email: 'a@x.com', state: { i }, lessons: i, label: 'L' + i }));
  assert.equal((await sb.from('respaldos').insert(rows)).error, null);
  const all = await sb.from('respaldos').select('id,label');
  assert.equal(all.data.length, 450);
});

test('plataforma: id numérico y config JSON; aula_publica por correo', async () => {
  const { fs } = mockFS(); const sb = make(fs);
  await sb.from('plataforma').upsert({ id: 1, config: { appName: 'GI', grades: [['a']] }, updated_at: 't', updated_by: 'x' }, { onConflict: 'id' });
  const p = await sb.from('plataforma').select('config,updated_at').eq('id', 1);
  assert.equal(p.data.length, 1); assert.deepEqual(p.data[0].config, { appName: 'GI', grades: [['a']] });
  await sb.from('aula_publica').upsert({ user_email: 'Ana@x.com', data: { grades: [{ g: 1 }] }, updated_at: 't' }, { onConflict: 'user_email' });
  const a = await sb.from('aula_publica').select('data').eq('user_email', 'ana@x.com');
  assert.deepEqual(a.data[0].data, { grades: [{ g: 1 }] });
});

test('neq con limit (prueba de protección) y errores de permisos mapeados', async () => {
  const { fs } = mockFS('ana@x.com'); const sb = make(fs);
  await sb.from('user_data').upsert({ user_email: 'ana@x.com', state: {} }, { onConflict: 'user_email' });
  await sb.from('user_data').upsert({ user_email: 'bob@x.com', state: {} }, { onConflict: 'user_email' });
  const r = await sb.from('user_data').select('user_email').neq('user_email', 'ana@x.com').limit(1);
  assert.deepEqual(r.data, [{ user_email: 'bob@x.com' }]);
  fs.getDoc = async () => { throw Object.assign(new Error('x'), { code: 'permission-denied' }); };
  const d = await sb.from('user_data').select('state').eq('user_email', 'ana@x.com').single();
  assert.equal(d.error.code, '42501');
});

test('rpc diagnostico: administrador, personal y profesor', async () => {
  let m = mockFS(ADMIN); let sb = make(m.fs, { admin: ADMIN });
  assert.deepEqual((await sb.rpc('diagnostico')).data, { email: ADMIN, admin: true, staff: true });
  m = mockFS('t@x.com'); sb = make(m.fs, { admin: ADMIN });
  await sb.from('profiles').insert({ email: 't@x.com', role: 'teacher' });
  assert.deepEqual((await sb.rpc('diagnostico')).data, { email: 't@x.com', admin: false, staff: false });
  await sb.from('profiles').update({ role: 'coordinator' }).eq('email', 't@x.com');
  assert.equal((await sb.rpc('diagnostico')).data.staff, true);
});

test('setRaw/getRaw/countRaw (migración): respaldos conservan su id', async () => {
  const { fs } = mockFS(); const sb = make(fs);
  await sb.setRaw('respaldos', 17, { user_email: 'a@x.com', state: { x: [[1]] }, lessons: 2, label: 'L', created_at: 't' });
  const r = await sb.from('respaldos').select('id,state').eq('id', '17').single();
  assert.equal(r.data.id, '17'); assert.deepEqual(r.data.state, { x: [[1]] });
  assert.equal(await sb.countRaw('respaldos'), 1);
  assert.equal(sb.idOf('profiles', 'A@B.com'), 'a@b.com');
});
