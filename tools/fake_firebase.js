// 測試用的假 Firebase（compat 版的一小部分 API），資料存在 localStorage，換頁也還在。
// 用法：瀏覽器測試時把 vendor/firebase/firebase-app-compat.js 換成這個檔案、另外兩個換成空檔案。
// 測試開關：localStorage.__fakeAuthError = 'auth/unauthorized-domain' 讓登入失敗；__fakeUser = JSON 字串直接當作已登入。
(function () {
    const DB_KEY = '__fakefs', USER_KEY = '__fakeUser';
    const load = () => { try { return JSON.parse(localStorage.getItem(DB_KEY)) || {}; } catch (e) { return {}; } };
    const store = data => localStorage.setItem(DB_KEY, JSON.stringify(data));
    const clone = v => v == null ? v : JSON.parse(JSON.stringify(v));
    const INC = '__inc';

    function applyWrite(old, data, merge) {
        const out = merge && old ? {...old} : {};
        for (const [k, v] of Object.entries(data)) out[k] = v && typeof v === 'object' && INC in v ? ((old && old[k]) || 0) + v[INC] : clone(v);
        return out;
    }
    class Snap {
        constructor(ref, data) { this.ref = ref; this.id = ref.id; this.exists = data != null; this._d = data; }
        data() { return clone(this._d); }
    }
    class Doc {
        constructor(path) { this.path = path; this.id = path.split('/').pop(); }
        async get() { return new Snap(this, load()[this.path]); }
        async set(data, opt) { const db = load(); db[this.path] = applyWrite(db[this.path], data, opt?.merge); store(db); }
        async update(data) { return this.set(data, {merge: true}); }
        async delete() { const db = load(); delete db[this.path]; store(db); }
        collection(name) { return new Coll(this.path + '/' + name); }
    }
    class Coll {
        constructor(path, q) { this.path = path; this.q = q || {}; }
        doc(id) { return new Doc(this.path + '/' + (id || Math.random().toString(36).slice(2, 12))); }
        async add(data) { const d = this.doc(); await d.set(data); return d; }
        orderBy(f, dir) { return new Coll(this.path, {...this.q, f, dir}); }
        limit(n) { return new Coll(this.path, {...this.q, n}); }
        async get() {
            const db = load(), depth = this.path.split('/').length + 1;
            let docs = Object.keys(db).filter(p => p.startsWith(this.path + '/') && p.split('/').length === depth).map(p => new Snap(new Doc(p), db[p]));
            const {f, dir, n} = this.q;
            if (f) { docs = docs.filter(d => d._d[f] != null); docs.sort((a, b) => (a._d[f] - b._d[f]) * (dir === 'desc' ? -1 : 1)); }
            if (n) docs = docs.slice(0, n);
            return {docs, size: docs.length, empty: !docs.length};
        }
    }
    const db = {
        collection: p => new Coll(p),
        async runTransaction(fn) {
            const writes = [];
            const t = {get: ref => ref.get(), set: (ref, data, opt) => { writes.push([ref, data, opt]); return t; }};
            const r = await fn(t);
            for (const [ref, data, opt] of writes) await ref.set(data, opt);
            return r;
        },
    };

    let user = null; const listeners = [];
    try { user = JSON.parse(localStorage.getItem(USER_KEY)); } catch (e) { user = null; }
    const notify = () => listeners.forEach(cb => cb(user));
    const auth = {
        get currentUser() { return user; },
        onAuthStateChanged(cb) { listeners.push(cb); setTimeout(() => cb(user), 10); return () => {}; },
        async getRedirectResult() { return {user: null}; },
        async signInWithPopup() {
            const code = localStorage.getItem('__fakeAuthError');
            if (code) { const e = new Error(code); e.code = code; throw e; }
            user = {uid: localStorage.getItem('__fakeUid') || 'u_test', displayName: '測試玩家', email: 'tester@example.com'};
            localStorage.setItem(USER_KEY, JSON.stringify(user));
            notify();
            return {user};
        },
        async signInWithRedirect() { return this.signInWithPopup(); },
        async signOut() { user = null; localStorage.removeItem(USER_KEY); notify(); },
    };
    function GoogleAuthProvider() { this.setCustomParameters = () => {}; }

    const firebase = {initializeApp: () => ({}), auth: () => auth, firestore: () => db};
    firebase.auth.GoogleAuthProvider = GoogleAuthProvider;
    firebase.firestore.FieldValue = {increment: n => ({[INC]: n}), serverTimestamp: () => Date.now()};
    window.firebase = firebase;
})();
