export const categories = {
  marmitas: 'Marmitas',
  sexta: 'Sexta-feira',
  porcoes: 'Porções',
  sobremesas: 'Sobremesas',
  kits: 'Kits festa',
  lanches: 'Lanches e hambúrgueres'
};

export const standardTags = ['Mais vendido', 'Doce', 'Salgado', 'Kit', 'Hambúrguer', 'Novidade'];
const currency = new Intl.NumberFormat('pt-BR', {style: 'currency', currency: 'BRL'});
export const money = cents => currency.format(cents / 100);
export const normalize = value => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export function element(name, content, className) {
  const node = document.createElement(name);
  if (content != null) node.textContent = content;
  if (className) node.className = className;
  return node;
}

export const isPreviewHost = () =>
  ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) ||
  (location.origin === 'https://amostrasdesites.github.io' &&
    location.pathname.startsWith('/Cantinho_do_Man-/'));

export function imageSource(value, siteRoot) {
  if (value.startsWith('blob:') && new URLSearchParams(location.search).get('demo') === '1') return value;
  if (isPreviewHost() && /^data:image\/webp;base64,[\w+/=]+$/.test(value)) return value;
  if (/^assets\/img\/[\w-]+\.webp$/.test(value)) return new URL(value, siteRoot).href;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
  } catch {}
  return '';
}
