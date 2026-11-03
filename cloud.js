// Cliente REST: os tokens ficam somente na memória desta aba.
export function createCloud(config, request = fetch) {
  const url = config.url.replace(/\/$/, '');
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) || !config.publishableKey) {
    throw new Error('Configure a URL e a chave pública do Supabase em config.js. Consulte SUPABASE.md.');
  }
  const key = config.publishableKey;
  if (key.startsWith('sb_secret_')) throw new Error('Use somente a chave pública do Supabase.');
  if (key.startsWith('eyJ')) {
    try { if (JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role !== 'anon') throw new Error(); }
    catch { throw new Error('Use somente a chave anon pública ou publishable do Supabase.'); }
  }
  let session = null;
  let refreshPending = null;
  async function call(path, {method = 'GET', body, authenticated = false, headers = {}} = {}) {
    if (authenticated && !session) throw new Error('Entre na sua conta para continuar.');
    if (authenticated && session.expires_at < Date.now() + 30000) {
      refreshPending ||= call('/auth/v1/token?grant_type=refresh_token', {method:'POST', body:{refresh_token:session.refresh_token}})
        .then(setSession).catch(error => { session = null; throw error; }).finally(() => { refreshPending = null; });
      await refreshPending;
    }
    let response;
    try {
      response = await request(`${url}${path}`, {
        method,
        headers:{apikey:key, ...(authenticated ? {Authorization:`Bearer ${session.access_token}`} : {}), 'Content-Type':'application/json', ...headers},
        ...(body !== undefined ? {body:JSON.stringify(body)} : {}),
      });
    } catch { throw new Error('Não foi possível conectar. Verifique a internet e tente novamente.'); }
    const text = await response.text();
    let result;
    try { result = text ? JSON.parse(text) : null; } catch { throw new Error('Resposta inesperada do serviço.'); }
    if (!response.ok) {
      if (response.status === 401 && authenticated) { session = null; throw new Error('Sessão expirada. Entre novamente.'); }
      if (response.status === 429) throw new Error('Muitas tentativas. Aguarde alguns minutos.');
      if (path.includes('/auth/')) {
        if (result?.error_code === 'invalid_credentials' && path.includes('grant_type=password')) throw Object.assign(new Error('E-mail ou senha incorretos.'), {code:'invalid_credentials'});
        if (result?.error_code === 'email_not_confirmed') throw new Error('Confirme seu e-mail antes de entrar.');
        throw new Error('Não foi possível concluir. Confira e-mail, senha e confirmação de e-mail.');
      }
      throw new Error('Não foi possível salvar ou carregar os dados. Confira a configuração do banco e tente novamente.');
    }
    return result;
  }
  function setSession(data) {
    if (!data?.access_token || !data?.refresh_token || !data?.user?.id) throw new Error('Sessão inválida. Entre novamente.');
    session = {...data, expires_at:Date.now() + Number(data.expires_in || 3600) * 1000};
    return session.user;
  }
  function requireUser() { if (!session) throw new Error('Entre na sua conta para continuar.'); return session.user.id; }
  function fields(e) { return {id:e.id,description:e.description,type:e.type,amount:e.amount,category:e.category,date:e.date}; }
  return {
    get user() { return session?.user || null; },
    async login(email,password) { return setSession(await call('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}})); },
    async signup(email,password,redirect) {
      const data = await call(`/auth/v1/signup?redirect_to=${encodeURIComponent(redirect)}`,{method:'POST',body:{email,password}});
      if (data?.access_token) return setSession(data);
      return null;
    },
    async recover(email,redirect) { await call(`/auth/v1/recover?redirect_to=${encodeURIComponent(redirect)}`,{method:'POST',body:{email}}); },
    async acceptLink(hash) {
      const params = new URLSearchParams(hash.replace(/^#/,''));
      if (!params.get('access_token')) throw new Error('Link inválido ou expirado. Solicite outro.');
      const access = params.get('access_token');
      // Confirma o usuário com o servidor antes de aceitar o token recebido.
      const response = await request(`${url}/auth/v1/user`,{headers:{apikey:key,Authorization:`Bearer ${access}`}});
      if (!response.ok) throw new Error('Link inválido ou expirado. Solicite outro.');
      return setSession({access_token:access,refresh_token:params.get('refresh_token'),expires_in:params.get('expires_in'),user:await response.json()});
    },
    async updatePassword(password) { await call('/auth/v1/user',{method:'PUT',body:{password},authenticated:true}); },
    async logout() {
      try { if (session) await call('/auth/v1/logout',{method:'POST',authenticated:true}); }
      finally { session = null; }
    },
    async list() {
      const user = requireUser();
      const all = [];
      for (let offset=0;;offset+=500) {
        const batch = await call(`/rest/v1/entries?select=id,description,type,amount,category,date&user_id=eq.${encodeURIComponent(user)}&order=date.desc,id.asc&limit=500&offset=${offset}`,{authenticated:true});
        if (!Array.isArray(batch)) throw new Error('Resposta inválida do banco.');
        all.push(...batch);
        if (batch.length < 500) return all;
      }
    },
    async insert(entries) {
      const user = requireUser();
      return call('/rest/v1/entries',{method:'POST',authenticated:true,headers:{Prefer:'return=representation'},body:entries.map(e=>({...fields(e),user_id:user}))});
    },
    async update(entry) {
      const user = requireUser();
      const {id, ...changes} = fields(entry);
      const updated = await call(`/rest/v1/entries?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user)}`,{method:'PATCH',authenticated:true,headers:{Prefer:'return=representation'},body:changes});
      if (!Array.isArray(updated) || updated.length !== 1) throw new Error('Registro não encontrado. Atualize a lista.');
      return updated[0];
    },
    async remove(id) {
      const user = requireUser();
      const removed = await call(`/rest/v1/entries?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user)}`,{method:'DELETE',authenticated:true,headers:{Prefer:'return=representation'}});
      if (!removed?.length) throw new Error('Registro não encontrado. Atualize a lista.');
    },
  };
}
