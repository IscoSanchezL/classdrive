// Pruebas de las reglas de Firestore (firestore.rules) con el emulador. Ver docs/FIRESTORE.md para ejecutarlas.
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { doc, getDoc, setDoc, deleteDoc, updateDoc, getDocs, collection, query, where } from 'firebase/firestore';

const env = await initializeTestEnvironment({ projectId: 'demo-classdrive', firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8085 } });
let ok = 0, bad = 0;
const t = async (name, fn) => { try { await fn(); ok++; console.log('OK   ' + name); } catch (e) { bad++; console.log('FALLA ' + name + ' → ' + e.message.split('\n')[0]); } };
const user = (email) => env.authenticatedContext('uid-' + email, { email, email_verified: true }).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const ADMIN = 'franksanlo@gmail.com';

await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await setDoc(doc(db, 'profiles/ana@x.com'), { email: 'ana@x.com', role: 'teacher' });
  await setDoc(doc(db, 'profiles/bob@x.com'), { email: 'bob@x.com', role: 'teacher' });
  await setDoc(doc(db, 'profiles/coord@x.com'), { email: 'coord@x.com', role: 'coordinator' });
  await setDoc(doc(db, 'profiles/blk@x.com'), { email: 'blk@x.com', role: 'blocked' });
  await setDoc(doc(db, 'profiles/adm@x.com'), { email: 'adm@x.com', role: 'admin' });
  await setDoc(doc(db, 'user_data/ana@x.com'), { user_email: 'ana@x.com', state: '{}' });
  await setDoc(doc(db, 'user_data/bob@x.com'), { user_email: 'bob@x.com', state: '{}' });
  await setDoc(doc(db, 'respaldos/r1'), { user_email: 'ana@x.com', created_at: '1', state: '{}' });
  await setDoc(doc(db, 'respaldos/r2'), { user_email: 'bob@x.com', created_at: '2', state: '{}' });
  await setDoc(doc(db, 'plataforma/1'), { config: '{}' });
  await setDoc(doc(db, 'aula_publica/ana@x.com'), { data: '{}' });
});

await t('profesor lee su planeación', () => assertSucceeds(getDoc(doc(user('ana@x.com'), 'user_data/ana@x.com'))));
await t('profesor NO lee la de otro', () => assertFails(getDoc(doc(user('ana@x.com'), 'user_data/bob@x.com'))));
await t('sin sesión NO lee planeaciones', () => assertFails(getDoc(doc(anon(), 'user_data/ana@x.com'))));
await t('profesor escribe la suya', () => assertSucceeds(setDoc(doc(user('ana@x.com'), 'user_data/ana@x.com'), { user_email: 'ana@x.com', state: '{"a":1}' })));
await t('profesor NO escribe la de otro', () => assertFails(setDoc(doc(user('ana@x.com'), 'user_data/bob@x.com'), { user_email: 'bob@x.com', state: '{}' })));
await t('correo en mayúsculas del token cuenta como el propio', () => assertSucceeds(getDoc(doc(user('Ana@X.com'), 'user_data/ana@x.com'))));
await t('correo NO verificado no lee', () => assertFails(getDoc(doc(env.authenticatedContext('u', { email: 'ana@x.com', email_verified: false }).firestore(), 'user_data/ana@x.com'))));
await t('coordinador (personal) lee la de otros', () => assertSucceeds(getDoc(doc(user('coord@x.com'), 'user_data/bob@x.com'))));
await t('coordinador NO escribe la de otros', () => assertFails(setDoc(doc(user('coord@x.com'), 'user_data/bob@x.com'), { user_email: 'bob@x.com', state: '{}' })));
await t('bloqueado NO lee la de otros', () => assertFails(getDoc(doc(user('blk@x.com'), 'user_data/bob@x.com'))));
await t('admin (franksanlo) lee y escribe todo', async () => { const d = user(ADMIN); await assertSucceeds(getDoc(doc(d, 'user_data/bob@x.com'))); await assertSucceeds(setDoc(doc(d, 'user_data/bob@x.com'), { user_email: 'bob@x.com', state: '{}' })); });
await t('rol admin de perfil escribe lo de otros', () => assertSucceeds(setDoc(doc(user('adm@x.com'), 'user_data/bob@x.com'), { user_email: 'bob@x.com', state: '{"x":1}' })));
await t('solo admin borra user_data', async () => { await assertFails(deleteDoc(doc(user('ana@x.com'), 'user_data/ana@x.com'))); await assertSucceeds(deleteDoc(doc(user(ADMIN), 'user_data/bob@x.com'))); });
await t('personal lista todas las planeaciones', () => assertSucceeds(getDocs(collection(user('coord@x.com'), 'user_data'))));
await t('profesor NO lista todas las planeaciones', () => assertFails(getDocs(collection(user('ana@x.com'), 'user_data'))));

await t('profesor crea su perfil como profesor', () => assertSucceeds(setDoc(doc(user('nuevo@x.com'), 'profiles/nuevo@x.com'), { email: 'nuevo@x.com', role: 'teacher' })));
await t('profesor NO se crea perfil de admin', () => assertFails(setDoc(doc(user('otro@x.com'), 'profiles/otro@x.com'), { email: 'otro@x.com', role: 'admin' })));
await t('profesor NO se autoasciende', () => assertFails(updateDoc(doc(user('ana@x.com'), 'profiles/ana@x.com'), { role: 'admin' })));
await t('profesor sí actualiza su nombre', () => assertSucceeds(updateDoc(doc(user('ana@x.com'), 'profiles/ana@x.com'), { name: 'Ana' })));
await t('admin cambia roles', () => assertSucceeds(updateDoc(doc(user(ADMIN), 'profiles/bob@x.com'), { role: 'coordinator' })));
await t('profesor NO lee perfil de otro', () => assertFails(getDoc(doc(user('ana@x.com'), 'profiles/bob@x.com'))));
await t('personal lee todos los perfiles', () => assertSucceeds(getDocs(collection(user('coord@x.com'), 'profiles'))));

await t('profesor lista SUS respaldos', () => assertSucceeds(getDocs(query(collection(user('ana@x.com'), 'respaldos'), where('user_email', '==', 'ana@x.com')))));
await t('profesor NO lista los de otro', () => assertFails(getDocs(query(collection(user('ana@x.com'), 'respaldos'), where('user_email', '==', 'bob@x.com')))));
await t('profesor crea su respaldo', () => assertSucceeds(setDoc(doc(user('ana@x.com'), 'respaldos/n1'), { user_email: 'ana@x.com', created_at: '3', state: '{}' })));
await t('profesor NO crea respaldo a nombre de otro', () => assertFails(setDoc(doc(user('ana@x.com'), 'respaldos/n2'), { user_email: 'bob@x.com', created_at: '3', state: '{}' })));
await t('profesor borra su respaldo y no el ajeno', async () => { await assertSucceeds(deleteDoc(doc(user('ana@x.com'), 'respaldos/r1'))); await assertFails(deleteDoc(doc(user('ana@x.com'), 'respaldos/r2'))); });
await t('personal lista todos los respaldos', () => assertSucceeds(getDocs(collection(user('coord@x.com'), 'respaldos'))));

await t('cualquiera lee plataforma', () => assertSucceeds(getDoc(doc(anon(), 'plataforma/1'))));
await t('solo admin escribe plataforma', async () => { await assertFails(setDoc(doc(user('ana@x.com'), 'plataforma/1'), { config: '{}' })); await assertSucceeds(setDoc(doc(user(ADMIN), 'plataforma/1'), { config: '{"a":1}' })); });
await t('estudiante (sin sesión) lee el aula pública', () => assertSucceeds(getDoc(doc(anon(), 'aula_publica/ana@x.com'))));
await t('profesor escribe SOLO su aula', async () => { await assertSucceeds(setDoc(doc(user('ana@x.com'), 'aula_publica/ana@x.com'), { data: '{}' })); await assertFails(setDoc(doc(user('ana@x.com'), 'aula_publica/bob@x.com'), { data: '{}' })); });
await t('sin sesión NO escribe el aula', () => assertFails(setDoc(doc(anon(), 'aula_publica/ana@x.com'), { data: '{}' })));
await t('resultados: se puede crear, no leer', async () => { await assertSucceeds(setDoc(doc(anon(), 'resultados/x1'), { nombre: 'n' })); await assertFails(getDoc(doc(anon(), 'resultados/x1'))); });
await t('colecciones no declaradas están cerradas', () => assertFails(getDoc(doc(user(ADMIN), 'otra/cosa'))));

console.log(`\n${ok} correctas, ${bad} con fallo`);
await env.cleanup();
process.exit(bad ? 1 : 0);
