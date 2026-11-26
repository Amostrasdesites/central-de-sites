const {config} = await import("https://amostrasdesites.github.io/Cantinho_do_Man-/assets/js/config.js").catch(()=>({config:{}}));
import {originalCatalog} from './catalog-data.js';

export const configured = Boolean(config.supabaseUrl && config.publishableKey);
export const demo = new URLSearchParams(location.search).get('demo') === '1';
let sample;
let sampleTheme = {primary_color:'#942c20',secondary_color:'#2d482f',font:'system-ui'};
let session = null;

async function request(path, method = 'GET', body, token, prefer = '') {
  const headers = {apikey: config.publishableKey, 'Content-Type': 'application/json'};
  if (body instanceof FormData) delete headers['Content-Type'];
  if (token) headers.Authorization = 'Bearer ' + token;
  if (prefer) headers.Prefer = prefer;
  const response = await fetch(config.supabaseUrl.replace(/\/$/, '') + path, {
    method, headers, body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body)
  });
  if (response.status === 204) return;
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && token && token === session?.access_token) endSession();
    throw new Error(result.message ?? result.msg ?? result.error_description ?? 'Falha ao acessar o catálogo.');
  }
  return result;
}

async function adminRequest(path, method, body, prefer) {
  if (!session) throw new Error('Entre novamente para continuar.');
  if (Date.now() >= session.expiresAt - 30000) {
    const token = await request('/auth/v1/token?grant_type=refresh_token', 'POST', {refresh_token: session.refresh_token});
    session = {...token, expiresAt: Date.now() + token.expires_in * 1000};
  }
  return request(path, method, body, session.access_token, prefer);
}

export async function login(email, password) {
  const token = await request('/auth/v1/token?grant_type=password', 'POST', {email, password});
  session = {...token, expiresAt: Date.now() + token.expires_in * 1000};
  try {
    if (!await adminRequest('/rest/v1/rpc/is_catalog_admin', 'POST', {})) {
      throw new Error('Esta conta não tem acesso ao painel.');
    }
  } catch (error) {
    session = null;
    throw error;
  }
}

export async function logout() {
  const token = session?.access_token;
  session = null;
  if (token) await request('/auth/v1/logout', 'POST', {}, token);
}

export async function listProducts(privateFields = false) {
  if (demo) {
    if (!sample) {
      const {originalCatalog: source} = await import('https://amostrasdesites.github.io/Cantinho_do_Man-/assets/js/catalog-data.js')
        .catch(()=>({originalCatalog}));
      sample = source.map(product=>({...product,cost_cents:null}));
    }
    return structuredClone(sample);
  }
  if (!configured) {
    if (privateFields) throw new Error('Acesso administrativo indisponível.');
    return structuredClone(originalCatalog);
  }
  const all = [];
  for (let offset = 0; ; offset += 100) {
    const page = privateFields
      ? await adminRequest('/rest/v1/products?select=*&order=position,id&limit=100&offset=' + offset)
      : await request('/rest/v1/rpc/catalog_public?order=position,id&limit=100&offset=' + offset);
    all.push(...page);
    if (page.length < 100) return all;
  }
}

export async function uploadPhoto(file) {
  const extension = {'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp'}[file.type];
  if (!extension || file.size < 1 || file.size > 3 * 1024 * 1024) {
    throw new Error('Selecione uma foto JPG, PNG ou WebP de até 3 MB.');
  }
  if (demo) return URL.createObjectURL(file);
  const key = crypto.randomUUID() + '.' + extension;
  const payload = new FormData();
  payload.append('cacheControl', '3600');
  payload.append('', file);
  await adminRequest('/storage/v1/object/catalog-photos/' + key, 'POST', payload);
  return config.supabaseUrl.replace(/\/$/, '') + '/storage/v1/object/public/catalog-photos/' + key;
}

export async function saveProduct(product, editing) {
  if (demo) {
    sample = editing ? sample.map(row=>row.id===product.id?product:row) : [...sample,product];
    return;
  }
  const result = await adminRequest('/rest/v1/products' + (editing ? '?id=eq.' + encodeURIComponent(product.id) : ''),
    editing ? 'PATCH' : 'POST', product, 'return=representation');
  if (result.length !== 1) throw new Error('Produto indisponível para edição.');
}

export async function deleteProduct(id) {
  if (demo) { sample = sample.filter(row=>row.id!==id); return; }
  const result = await adminRequest('/rest/v1/products?id=eq.' + encodeURIComponent(id), 'DELETE', undefined, 'return=representation');
  if (result.length !== 1) throw new Error('Produto já excluído ou indisponível.');
}

export async function loadTheme() {
  if (demo) return {...sampleTheme};
  if (!configured) return null;
  const [theme] = await request('/rest/v1/store_theme?select=primary_color,secondary_color,font&id=eq.true');
  return theme;
}

export async function saveTheme(theme) {
  if (demo) { sampleTheme = {...theme}; return; }
  const rows = await adminRequest('/rest/v1/store_theme?id=eq.true','PATCH',theme,'return=representation');
  if (rows.length !== 1) throw new Error('Aparência indisponível.');
}

export function loadAnalytics(days) {
  if (demo) {
    const series=Array.from({length:days},(_,index)=>({day:new Date(Date.now()-(days-index-1)*86400000).toISOString().slice(0,10),views:18+((index*23)%31)}));
    return Promise.resolve({current:{visitors:days*13,views:series.reduce((sum,row)=>sum+row.views,0)},prior:{visitors:days*16,views:days*38},series,paths:[{path:'/',views:days*12},{path:'/#marmitas',views:days*8},{path:'/#kits',views:days*3}]});
  }
  return adminRequest('/rest/v1/rpc/store_analytics','POST',{p_days:days});
}

export function recordView(visitor,path) {
  return request('/rest/v1/rpc/store_record_view','POST',{p_visitor:visitor,p_path:path});
}

function endSession(message) {
  session = null;
  window.dispatchEvent(new CustomEvent('catalog-session-ended',{detail:message}));
}

export async function changePassword(current,password) {
  if (!session) throw new Error('Entre novamente para continuar.');
  const fresh = await request('/auth/v1/token?grant_type=password','POST',{email:session.user.email,password:current});
  try {
    await request('/auth/v1/user','PUT',{password},fresh.access_token);
  } catch (error) {
    await request('/auth/v1/logout?scope=local','POST',{},fresh.access_token).catch(()=>{});
    throw error;
  }
  await request('/auth/v1/logout','POST',{},fresh.access_token).catch(()=>{});
  endSession('Senha alterada. Entre com a nova senha.');
}
