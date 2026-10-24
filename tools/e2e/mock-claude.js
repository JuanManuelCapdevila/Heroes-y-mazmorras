(() => {
  const uid = new URLSearchParams(location.search).get('uid') || 'anon';
  const KEY = 'mockdb:';
  const subs = new Set();
  const read = p => { const v = localStorage.getItem(KEY + p); return v ? JSON.parse(v) : null; };
  const notify = () => subs.forEach(f => { try { f(); } catch (e) { console.error(e); } });
  window.addEventListener('storage', e => { if (e.key && e.key.startsWith(KEY)) setTimeout(notify, 30); });
  const snapOf = (p, d) => ({ id: p.split('/').pop(), exists: !!d, data: () => d ? JSON.parse(JSON.stringify(d)) : undefined, metadata: { fromCache: false, hasPendingWrites: false } });
  function doc(path) {
    return {
      id: path.split('/').pop(), path,
      async get() { return snapOf(path, read(path)); },
      async set(d) { localStorage.setItem(KEY + path, JSON.stringify(d)); setTimeout(notify, 10); },
      async update(d) { const cur = read(path); if (!cur) throw { code: 'invalid_argument' }; localStorage.setItem(KEY + path, JSON.stringify(Object.assign(cur, d))); setTimeout(notify, 10); },
      async delete() { localStorage.removeItem(KEY + path); setTimeout(notify, 10); },
      async acquire() { return { acquired: true }; },
      onSnapshot(next) { let last = null; const f = () => { const v = localStorage.getItem(KEY + path); if (v !== last) { last = v; next(snapOf(path, v ? JSON.parse(v) : null)); } }; subs.add(f); setTimeout(f, 20); return () => subs.delete(f); },
    };
  }
  function collection(path, ord, lim) {
    const q = {
      orderBy(f, dir) { return collection(path, [f, dir || 'asc'], lim); },
      limit(n) { return collection(path, ord, n); },
      doc(id) { return doc(path + '/' + id); },
      _docs() {
        const out = [];
        for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(KEY + path + '/') && k.slice(KEY.length + path.length + 1).indexOf('/') < 0) out.push(snapOf(k.slice(KEY.length), JSON.parse(localStorage.getItem(k)))); }
        if (ord) out.sort((a, b) => (a.data()[ord[0]] > b.data()[ord[0]] ? 1 : -1) * (ord[1] === 'desc' ? -1 : 1));
        return lim ? out.slice(0, lim) : out;
      },
      async get() { const docs = q._docs(); return { docs, size: docs.length, empty: !docs.length }; },
      onSnapshot(next) { let last = null; const f = () => { const docs = q._docs(); const sig = JSON.stringify(docs.map(d => d.data())); if (sig !== last) { last = sig; next({ docs, size: docs.length, empty: !docs.length, docChanges: () => [] }); } }; subs.add(f); setTimeout(f, 20); return () => subs.delete(f); },
    };
    return q;
  }
  const rooms = {};
  function join(name) {
    const bc = new BroadcastChannel('room:' + name);
    const handlers = {}; const peers = new Map(); let peerFns = [];
    const me = { peer: uid + Math.random(), by: uid, presence: {} };
    const emitPeers = () => { const list = [...peers.values(), { ...me, isMe: true }]; peerFns.forEach(f => f({ peers: list, joined: [], left: [], updated: [] })); };
    bc.onmessage = e => {
      const m = e.data;
      if (m.t === 'msg') (handlers[m.topic] || []).forEach(h => h({ topic: m.topic, data: m.data, by: m.by, isMe: false }));
      if (m.t === 'hello' || m.t === 'pres') { peers.set(m.peer, { peer: m.peer, by: m.by, presence: m.presence, isMe: false }); emitPeers(); if (m.t === 'hello') bc.postMessage({ t: 'pres', peer: me.peer, by: uid, presence: me.presence }); }
      if (m.t === 'bye') { peers.delete(m.peer); emitPeers(); }
    };
    bc.postMessage({ t: 'hello', peer: me.peer, by: uid, presence: {} });
    window.addEventListener('beforeunload', () => bc.postMessage({ t: 'bye', peer: me.peer }));
    return {
      name, emit: async (topic, data) => bc.postMessage({ t: 'msg', topic, data, by: uid }),
      on: (topic, fn) => { (handlers[topic] = handlers[topic] || []).push(fn); return () => { }; },
      presence: async patch => { Object.assign(me.presence, patch); bc.postMessage({ t: 'pres', peer: me.peer, by: uid, presence: me.presence }); emitPeers(); },
      peers: () => [...peers.values()], onPeers: fn => { peerFns.push(fn); setTimeout(emitPeers, 10); return () => { }; },
      connected: () => true, onConnection: () => () => { }, leave: async () => { bc.postMessage({ t: 'bye', peer: me.peer }); bc.close(); },
    };
  }
  const NAMES = { a: 'Juan', b: 'Caro', c: 'Leo' };
  const api = {
    db: { doc, collection: p => collection(p) },
    room: { join: async n => join(n) },
    user: { id: async () => uid, profiles: async ids => Object.fromEntries(ids.map(i => [i, { name: NAMES[i] || '' }])), isOwner: () => uid === 'a', canEdit: () => true, can: () => true },
  };
  window.claude = { use: async n => api[n] || null };
})();
