import {hideTools, showTools, syncProducts} from './panel-tools.js?v=painel-2';
import {categories, element, imageSource, money, normalize, standardTags} from './catalog.js?v=painel-2';
import {configured, demo, deleteProduct, listProducts, login, logout, saveProduct, uploadPhoto} from './repository.js?v=painel-2';

const $ = selector => document.querySelector(selector);
const form = $('#product-form');
const editor = $('#editor');
const status = $('#status');
const loginForm = $('#login');
const field = name => form.elements.namedItem(name);
const siteRoot = new URL("https://amostrasdesites.github.io/Cantinho_do_Man-/");
let products = [];
let category = '';
let current = null;
let previewUrl = '';

function render() {
  const query = normalize($('#search').value.trim());
  const tag = $('#tag').value;
  const visibility = $('#visibility').value;
  const filtered = products.filter(product =>
    (!category || product.category === category) &&
    (!tag || product.tags.includes(tag)) &&
    (!visibility || product.active === (visibility === 'active')) &&
    normalize([product.name, product.description, categories[product.category], ...product.tags].join(' ')).includes(query));
  $('#result').textContent = filtered.length ? filtered.length + ' produto(s) encontrado(s)' : 'Nenhum produto encontrado.';
  $('#rows').replaceChildren(...filtered.map(product => {
    const row = element('tr');
    const info = element('td');
    info.append(element('strong', product.name), element('span', categories[product.category], 'product-meta'));
    for (const label of product.tags) info.append(element('span', label, 'chip'));
    const open = element('button', 'Editar', 'order');
    open.setAttribute('aria-label', 'Editar ' + product.name + ' em ' + categories[product.category]);
    open.addEventListener('click', () => openEditor(product));
    const action = element('td');
    action.append(open);
    row.append(info, element('td', money(product.price_cents)),
      element('td', product.cost_cents == null ? '—' : money(product.cost_cents)),
      element('td', product.active ? 'Na vitrine' : 'Oculto'), action);
    return row;
  }));
}

async function refresh() {
  products = await listProducts(true);
  const previousTag = $('#tag').value;
  const tags = [...new Set([...standardTags, ...products.flatMap(product => product.tags)])].sort((a,b) => a.localeCompare(b, 'pt-BR'));
  $('#tag').replaceChildren(new Option('Todas', ''), ...tags.map(tag => new Option(tag, tag)));
  $('#tag').value = tags.includes(previousTag) ? previousTag : '';
  const active = products.filter(product => product.active).length;
  $('#summary').replaceChildren(...[[products.length, 'Produtos'], [active, 'Na vitrine'], [products.length - active, 'Ocultos']].map(([count, name]) => {
    const stat = element('div', null, 'stat');
    stat.append(element('strong', count), element('span', name));
    return stat;
  }));
  render();
  syncProducts(products);
  if (demo) {
    $('#demo-preview').hidden = false;
    $('#demo-products').replaceChildren(...products.filter(product=>product.active).map(product=>element('li',product.name+' · '+money(product.price_cents))));
  }
}

function openEditor(product) {
  current = product;
  form.reset();
  $('#form-error').textContent = '';
  $('#editor-title').textContent = product ? product.name : 'Novo produto';
  $('#delete').hidden = !product;
  field('name').value = product?.name ?? '';
  field('category').value = product?.category ?? (category || 'marmitas');
  field('description').value = product?.description ?? '';
  field('price').value = product ? (product.price_cents / 100).toFixed(2).replace('.', ',') : '';
  field('cost').value = product?.cost_cents != null ? (product.cost_cents / 100).toFixed(2).replace('.', ',') : '';
  $('#remove-photo').hidden = !product?.image;
  updatePhotoPreview();
  field('active').checked = product?.active ?? true;
  field('starting').checked = product?.starting ?? false;
  field('extra').value = (product?.tags ?? []).filter(tag => !standardTags.includes(tag)).join(', ');
  for (const checkbox of $('#labels').querySelectorAll('input')) checkbox.checked = product?.tags.includes(checkbox.value) ?? false;
  editor.showModal();
}

function updatePhotoPreview() {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  const file = field('image').files[0];
  previewUrl = file ? URL.createObjectURL(file) : '';
  const existing = !field('removePhoto').checked && imageSource(current?.image ?? '', siteRoot);
  const src = previewUrl || existing;
  const preview = $('#photo-preview');
  preview.hidden = !src;
  if (src) preview.src = src;
  else preview.removeAttribute('src');
  $('#photo-status').textContent = file?.name || 'Escolha uma foto JPG, PNG ou WebP de até 3 MB.';
}
field('image').addEventListener('change', updatePhotoPreview);
field('removePhoto').addEventListener('change', updatePhotoPreview);
editor.addEventListener('close', () => {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = '';
});

function parseCents(value, label) {
  const raw = value.trim();
  if (!/^\d{1,7}(?:[,.]\d{1,2})?$/.test(raw)) throw new Error('Informe um valor válido para ' + label + ', como 20,00.');
  const [whole, fraction = ''] = raw.split(/[,.]/);
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

function readProduct() {
  const name = field('name').value.trim();
  const image = field('removePhoto').checked ? '' : current?.image ?? '';
  if (!name) throw new Error('Informe o nome do produto.');
  const labels = [...$('#labels').querySelectorAll('input:checked')].map(input => input.value);
  const tags = [...new Map([...labels, ...field('extra').value.split(',').map(tag => tag.trim()).filter(Boolean)]
    .map(tag => [normalize(tag), standardTags.find(label => normalize(label) === normalize(tag)) ?? tag])).values()];
  if (tags.length > 15 || tags.some(tag => tag.length > 35)) throw new Error('Use até 15 etiquetas de até 35 caracteres.');
  return {
    id: current?.id ?? crypto.randomUUID(),
    category: field('category').value,
    name,
    description: field('description').value.trim(),
    price_cents: parseCents(field('price').value, 'preço de venda'),
    cost_cents: field('cost').value.trim() ? parseCents(field('cost').value, 'preço de custo') : null,
    image, tags, active: field('active').checked, starting: field('starting').checked,
    position: current?.position ?? (products.at(-1)?.position ?? 0) + 1
  };
}

async function mutate(button, operation, message) {
  const buttons = [...form.querySelectorAll('button')];
  for (const control of buttons) control.disabled = true;
  editor.dataset.busy = 'true';
  $('#form-error').textContent = '';
  try {
    await operation();
    editor.close();
    status.textContent = message;
    try { await refresh(); }
    catch { status.textContent += ' Atualize a página para recarregar a lista.'; }
  } catch (error) {
    $('#form-error').textContent = error.message;
  } finally {
    delete editor.dataset.busy;
    for (const control of buttons) control.disabled = false;
    if (editor.open) button?.focus();
  }
}

for (const [value, title] of [['', 'Todos'], ...Object.entries(categories)]) {
  const tab = element('button', title);
  tab.type = 'button';
  tab.setAttribute('aria-pressed', String(!value));
  tab.addEventListener('click', () => {
    category = value;
    for (const button of $('#categories').children) button.setAttribute('aria-pressed', String(button === tab));
    render();
  });
  $('#categories').append(tab);
  if (value) field('category').add(new Option(title, value));
}
for (const tag of standardTags) {
  const label = element('label');
  const input = element('input');
  input.type = 'checkbox';
  input.value = tag;
  label.append(input, document.createTextNode(tag));
  $('#labels').append(label);
}
$('#search').addEventListener('input', render);
$('#tag').addEventListener('change', render);
$('#visibility').addEventListener('change', render);
$('#new').addEventListener('click', () => openEditor(null));
$('#close').addEventListener('click', () => editor.close());
editor.addEventListener('cancel', event => {
  if (editor.dataset.busy) event.preventDefault();
});
form.addEventListener('submit', event => {
  event.preventDefault();
  mutate(event.submitter, async () => {
    const product = readProduct();
    const file = field('image').files[0];
    if (file) product.image = await uploadPhoto(file);
    await saveProduct(product, Boolean(current));
  }, field('active').checked ? 'Produto salvo.' : 'Produto ocultado.');
});
$('#delete').addEventListener('click', event => {
  if (current && confirm('Excluir “' + current.name + '” do catálogo?')) {
    mutate(event.currentTarget, () => deleteProduct(current.id), 'Produto excluído.');
  }
});

async function showCatalog() {
  await refresh();
  loginForm.hidden = true;
  $('#catalog').hidden = false;
  $('#new').hidden = false;
  $('#logout').hidden = false;
  showTools();
}

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  event.submitter.disabled = true;
  status.textContent = '';
  try {
    await login(loginForm.elements.email.value, loginForm.elements.password.value);
    loginForm.reset();
    await showCatalog();
  } catch (error) { status.textContent = error.message; }
  finally { event.submitter.disabled = false; }
});
function showLogin(message) {
  if (editor.open) editor.close();
  $('#catalog').hidden = $('#new').hidden = $('#logout').hidden = true;
  products = [];
  current = null;
  $('#rows').replaceChildren();
  form.reset();
  hideTools();
  loginForm.hidden = false;
  status.textContent = message;
}
window.addEventListener('catalog-session-ended', event=>showLogin(event.detail || 'Entre novamente para continuar.'));
$('#logout').addEventListener('click', async () => {
  showLogin('Sessão encerrada.');
  try { await logout(); }
  catch { status.textContent = 'Sessão encerrada neste navegador.'; }
});
if (demo) {
  $('#example-banner').hidden = false;
  $('#example-link').hidden = true;
  showCatalog().then(() => { $('#logout').hidden = true; }).catch(error=>{status.textContent=error.message;});
} else if (configured) {
  loginForm.hidden = false;
} else {
  $('#configuration-needed').hidden = false;
}
