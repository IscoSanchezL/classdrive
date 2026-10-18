/* Class Drive — adaptador de Firestore con la misma forma de llamada que Supabase.
   Se usa cuando CD_BACKEND === 'firestore' (ver index.html). No cambia el resto de la app:
   sb.from('tabla').select().eq().single() … funcionan igual, pero leen y escriben en Firestore.
   - Los campos JSON (state, trash, settings, data, config) se guardan como TEXTO JSON, porque
     Firestore no admite listas dentro de listas y así se conserva la forma exacta del estado.
   - Los identificadores de correo se guardan en minúsculas. */
(function (root) {
  'use strict';

  var TABLES = {
    user_data: { col: 'user_data', key: 'user_email', json: ['state', 'trash', 'settings'], stamp: false },
    profiles: { col: 'profiles', key: 'email', json: [], stamp: true },
    respaldos: { col: 'respaldos', key: null, json: ['state'], stamp: true },
    plataforma: { col: 'plataforma', key: 'id', json: ['config'], stamp: false },
    aula_publica: { col: 'aula_publica', key: 'user_email', json: ['data'], stamp: false },
    Resultados: { col: 'resultados', key: null, json: [], stamp: true }
  };

  function lower(v) { return typeof v === 'string' ? v.toLowerCase() : v; }
  function idOf(T, v) { return String(T.key === 'user_email' || T.key === 'email' ? lower(v) : v); }

  function encode(T, row) {
    var out = {};
    Object.keys(row).forEach(function (k) {
      var v = row[k];
      if (v === undefined) return;
      out[k] = T.json.indexOf(k) >= 0 && v !== null ? JSON.stringify(v) : v;
    });
    return out;
  }
  function decode(T, data) {
    var out = {};
    Object.keys(data).forEach(function (k) {
      var v = data[k];
      if (T.json.indexOf(k) >= 0 && typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { /* se deja el texto */ } }
      out[k] = v;
    });
    return out;
  }
  function mapErr(e) {
    var code = e && e.code ? String(e.code) : 'ERR';
    if (code === 'permission-denied' || code === 'firestore/permission-denied') return { code: '42501', message: 'permission denied (Firestore)' };
    return { code: code, message: (e && e.message) || String(e) };
  }
  function likeToRegExp(p) {
    var s = String(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.');
    return new RegExp('^' + s + '$', 'i');
  }
  function project(row, cols) {
    if (!cols || cols === '*') return row;
    var out = {};
    String(cols).split(',').forEach(function (c) { c = c.trim(); if (c && c in row) out[c] = row[c]; });
    return out;
  }

  function make(fs, opts) {
    opts = opts || {};
    var ADMIN = lower(opts.admin || '');

    function QB(table) {
      var T = TABLES[table];
      if (!T) throw new Error('Tabla desconocida: ' + table);
      this.T = T; this.table = table; this.op = 'select'; this.cols = '*';
      this.f = []; this.ord = null; this.lim = null; this.payload = null; this.opt = {}; this.ret = false; this.mode = 'many';
    }
    QB.prototype.select = function (c) { if (this.op !== 'select') this.ret = true; this.cols = c || '*'; return this; };
    QB.prototype.eq = function (c, v) { this.f.push(['eq', c, v]); return this; };
    QB.prototype.neq = function (c, v) { this.f.push(['neq', c, v]); return this; };
    QB.prototype.like = function (c, p) { this.f.push(['like', c, p]); return this; };
    QB.prototype['in'] = function (c, a) { this.f.push(['in', c, a]); return this; };
    QB.prototype.order = function (c, o) { this.ord = [c, !(o && o.ascending === false)]; return this; };
    QB.prototype.limit = function (n) { this.lim = n; return this; };
    QB.prototype.single = function () { this.mode = 'single'; return this; };
    QB.prototype.maybeSingle = function () { this.mode = 'maybe'; return this; };
    QB.prototype.insert = function (r) { this.op = 'insert'; this.payload = r; return this; };
    QB.prototype.upsert = function (r, o) { this.op = 'upsert'; this.payload = r; this.opt = o || {}; return this; };
    QB.prototype.update = function (r) { this.op = 'update'; this.payload = r; return this; };
    QB.prototype['delete'] = function () { this.op = 'delete'; return this; };
    QB.prototype.then = function (a, b) { return this.run().then(a, b); };

    QB.prototype.run = function () {
      var self = this;
      return self._run().then(function (data) {
        return self._wrap(data);
      }, function (e) { return { data: null, error: mapErr(e) }; });
    };
    QB.prototype._wrap = function (rows) {
      if (this.mode === 'many') return { data: rows, error: null };
      if (rows.length === 1) return { data: rows[0], error: null };
      if (rows.length === 0) return this.mode === 'maybe' ? { data: null, error: null } : { data: null, error: { code: 'PGRST116', message: 'no rows returned' } };
      return { data: null, error: { code: 'PGRST116', message: 'multiple rows returned' } };
    };
    QB.prototype._ref = function (id) { return fs.doc(fs.db, this.T.col, String(id)); };
    QB.prototype._row = function (snap) {
      var r = decode(this.T, snap.data());
      if (this.T.key === null || !('id' in r)) r.id = this.T.key === 'id' ? Number(snap.id) : snap.id;
      return r;
    };
    QB.prototype._targetId = function () {
      var T = this.T, i, f;
      for (i = 0; i < this.f.length; i++) {
        f = this.f[i];
        if (f[0] === 'eq' && (f[1] === T.key || f[1] === 'id')) return idOf(T, f[2]);
      }
      return null;
    };
    QB.prototype._matches = function (row) {
      return this.f.every(function (f) {
        var v = row[f[1]];
        if (f[0] === 'eq') return String(v) === String(f[2]) || (typeof v === 'string' && lower(v) === lower(String(f[2])));
        if (f[0] === 'neq') return String(v) !== String(f[2]);
        if (f[0] === 'like') return likeToRegExp(f[2]).test(String(v == null ? '' : v));
        if (f[0] === 'in') return f[2].map(String).indexOf(String(v)) >= 0;
        return true;
      });
    };

    QB.prototype._run = async function () {
      var self = this, T = this.T, op = this.op, id, snap, rows, arr, i, k;
      if (op === 'select') {
        id = this._targetId();
        if (id !== null) {
          snap = await fs.getDoc(this._ref(id));
          rows = snap.exists() ? [this._row(snap)] : [];
        } else {
          var cons = [], clientSide = false;
          this.f.forEach(function (f) {
            if (f[0] === 'eq') cons.push(fs.where(f[1], '==', f[2]));
            else if (f[0] === 'neq') cons.push(fs.where(f[1], '!=', f[2]));
            else clientSide = true;
          });
          if (this.ord) cons.push(fs.orderBy(this.ord[0], this.ord[1] ? 'asc' : 'desc'));
          if (this.lim && !clientSide) cons.push(fs.limit(this.lim));
          var q = cons.length ? fs.query.apply(null, [fs.collection(fs.db, T.col)].concat(cons)) : fs.collection(fs.db, T.col);
          var res = await fs.getDocs(q);
          rows = [];
          res.forEach(function (d) { rows.push(self._row(d)); });
          rows = rows.filter(function (r) { return self._matches(r); });
          if (this.lim) rows = rows.slice(0, this.lim);
        }
        return rows.map(function (r) { return project(r, self.cols); });
      }

      if (op === 'insert' || op === 'upsert') {
        arr = Array.isArray(this.payload) ? this.payload : [this.payload];
        var now = new Date().toISOString(), written = [], batch = null, n = 0;
        for (i = 0; i < arr.length; i++) {
          var row = Object.assign({}, arr[i]);
          if (T.stamp && !row.created_at) row.created_at = now;
          var data = encode(T, row), ref;
          if (T.key) {
            var kv = row[T.key];
            if (kv === undefined || kv === null || kv === '') throw new Error('Falta ' + T.key);
            ref = this._ref(idOf(T, kv));
          } else {
            ref = fs.doc(fs.collection(fs.db, T.col));
            data.id = ref.id; row.id = ref.id;
          }
          if (arr.length > 1) {
            if (!batch) batch = fs.writeBatch(fs.db);
            batch.set(ref, data); n++;
            if (n >= 400) { await batch.commit(); batch = null; n = 0; }
          } else {
            await fs.setDoc(ref, data);
          }
          written.push(project(Object.assign({}, row), this.ret ? this.cols : '*'));
        }
        if (batch) await batch.commit();
        return this.ret ? written : [];
      }

      if (op === 'update') {
        id = this._targetId();
        if (id === null) throw new Error('update necesita un filtro por ' + (T.key || 'id'));
        var patch = encode(T, this.payload);
        try { await fs.updateDoc(this._ref(id), patch); }
        catch (e) { if (e && (e.code === 'not-found' || e.code === 'firestore/not-found')) return []; throw e; }
        if (!this.ret) return [];
        snap = await fs.getDoc(this._ref(id));
        return snap.exists() ? [project(this._row(snap), this.cols)] : [];
      }

      if (op === 'delete') {
        id = this._targetId();
        if (id !== null) { await fs.deleteDoc(this._ref(id)); return []; }
        var inF = null;
        this.f.forEach(function (f) { if (f[0] === 'in' && f[1] === 'id') inF = f[2]; });
        if (!inF) throw new Error('delete necesita un filtro por id');
        for (k = 0; k < inF.length; k += 400) {
          var b = fs.writeBatch(fs.db);
          inF.slice(k, k + 400).forEach(function (x) { b.delete(self._ref(String(x))); });
          await b.commit();
        }
        return [];
      }
      throw new Error('Operación no soportada: ' + op);
    };

    return {
      from: function (t) { return new QB(t); },
      /* Sustituye a la función SQL "diagnostico" de Supabase */
      rpc: async function (name) {
        if (name !== 'diagnostico') return { data: null, error: { code: 'ERR', message: 'rpc no soportada: ' + name } };
        try {
          var me = lower((fs.me && fs.me()) || ''), role = '';
          if (me) {
            var s = await fs.getDoc(fs.doc(fs.db, 'profiles', me));
            role = s.exists() ? String((s.data() || {}).role || 'teacher') : '';
          }
          var admin = me !== '' && (me === ADMIN || role === 'admin' || role === 'superadmin');
          var staff = admin || (role !== '' && role !== 'teacher' && role !== 'blocked');
          return { data: { email: me, admin: admin, staff: staff }, error: null };
        } catch (e) { return { data: null, error: mapErr(e) }; }
      },
      /* Escritura directa con identificador propio (la usa la migración desde Supabase) */
      setRaw: async function (table, id, row) {
        var T = TABLES[table]; if (!T) throw new Error('Tabla desconocida: ' + table);
        var data = encode(T, row);
        if (T.key === null) data.id = String(id);
        await fs.setDoc(fs.doc(fs.db, T.col, String(id)), data);
      },
      getRaw: async function (table, id) {
        var T = TABLES[table]; if (!T) throw new Error('Tabla desconocida: ' + table);
        var s = await fs.getDoc(fs.doc(fs.db, T.col, String(id)));
        return s.exists() ? decode(T, s.data()) : null;
      },
      countRaw: async function (table) {
        var T = TABLES[table]; if (!T) throw new Error('Tabla desconocida: ' + table);
        var r = await fs.getDocs(fs.collection(fs.db, T.col)); var n = 0; r.forEach(function () { n++; }); return n;
      },
      idOf: function (table, v) { return idOf(TABLES[table], v); }
    };
  }

  root.cdMakeFirestoreSB = make;
  if (typeof module !== 'undefined' && module.exports) module.exports = { make: make, TABLES: TABLES };
})(typeof window !== 'undefined' ? window : globalThis);
