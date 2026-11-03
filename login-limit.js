// Limite de interface por navegador; não substitui proteção no servidor de autenticação.
export function createLoginLimit(storage, now = Date.now) {
  const key = 'controle-financeiro.login-limit.v1';
  const duration = 15 * 60 * 1000;
  let memory = {};
  function read() {
    let state = memory;
    try { state = JSON.parse(storage.getItem(key) || '{}'); } catch {}
    if (!state || !Number.isInteger(state.attempts) || state.attempts < 0 || state.attempts > 3 || !Number.isFinite(state.until) || state.until <= now()) return {attempts:0,until:0};
    return state;
  }
  function write(state) { memory = state; try { storage.setItem(key, JSON.stringify(state)); } catch {} return status(); }
  function status() { const s=read(); return {...s, blocked:s.attempts >= 3, remaining:Math.max(0,s.until-now())}; }
  return {
    status,
    fail() { const s=read(); if (s.attempts >= 3) return status(); const attempts=s.attempts+1; return write({attempts,until:attempts===3 || !s.until ? now()+duration : s.until}); },
    reset() { return write({attempts:0,until:0}); },
  };
}
