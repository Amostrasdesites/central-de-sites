import {element} from './catalog.js?v=painel-1';
import {demo, changePassword, loadAnalytics, loadTheme, saveTheme} from './repository.js?v=painel-1';

const $ = id => document.getElementById(id);
const number = new Intl.NumberFormat('pt-BR');
const percent = new Intl.NumberFormat('pt-BR', {style:'percent', signDisplay:'exceptZero', maximumFractionDigits:1});
const paths = {'/':'Vitrine', '/#doces':'Doces', '/#marmitas':'Marmitas', '/#sexta':'Sexta-feira', '/#porcoes':'Porções', '/#sobremesas':'Sobremesas', '/#kits':'Kits', '/#lanches':'Lanches', '/#pedidos':'Pedidos'};
let revision = 0;
let active = false;

function metric(title, value, prior) {
  const card = element('div', null, 'stat');
  const change = prior ? percent.format((value-prior)/prior) + ' ante o período anterior' : 'Sem base de comparação';
  card.append(element('strong', number.format(value)), element('span', title), element('small', change));
  return card;
}

async function analytics() {
  const version = ++revision;
  const status = $('analytics-status');
  const results = $('analytics-results');
  status.textContent = 'Carregando…';
  results.hidden = true;
  try {
    const {current, prior, paths: ranking, series} = await loadAnalytics(Number($('period').value));
    if (version !== revision || !active) return;
    $('metrics').replaceChildren(metric('Visitantes estimados',current.visitors,prior.visitors),metric('Visualizações',current.views,prior.views));
    const max = Math.max(1,...series.map(row=>row.views));
    $('chart').replaceChildren(...series.map(row=>{
      const date = row.day.slice(8) + '/' + row.day.slice(5,7);
      const bar = element('li');
      const label = date + ' · ' + number.format(row.views);
      bar.title = label;
      bar.setAttribute('aria-label',label);
      bar.style.height = Math.max(2,row.views/max*100)+'%';
      return bar;
    }));
    $('paths').replaceChildren(...ranking.map(row=>element('li',(paths[row.path] ?? row.path) + ' · ' + number.format(row.views))));
    status.textContent = demo ? 'Dados ilustrativos da demonstração.' : current.views ? '' : 'Nenhuma visualização registrada neste período.';
    results.hidden = false;
  } catch (error) {
    if (version === revision && active) status.textContent = error.message;
  }
}

async function operation(event, status, action) {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  status.textContent = '';
  try { await action(event.currentTarget); }
  catch (error) { if (active) status.textContent = error.message; }
  finally { button.disabled = false; }
}

function previewTheme() {
  const {primary_color,secondary_color,font} = Object.fromEntries(new FormData($('theme')));
  const preview = $('theme-preview');
  Object.assign(preview.style,{color:primary_color,borderColor:secondary_color,fontFamily:font});
  preview.querySelector('span').style.backgroundColor = secondary_color;
}
$('theme').addEventListener('input',previewTheme);
$('period').addEventListener('change', analytics);
$('theme').addEventListener('submit', event=>operation(event,$('theme-status'),async form=>{
  await saveTheme(Object.fromEntries(new FormData(form)));
  if (active) $('theme-status').textContent = 'Aparência salva.';
}));
$('password').addEventListener('submit', event=>operation(event,$('password-status'),async form=>{
  const {current,newPassword,confirmation} = Object.fromEntries(new FormData(form));
  if (newPassword !== confirmation) throw new Error('As senhas novas precisam ser iguais.');
  await changePassword(current,newPassword);
  form.reset();
  if (active) $('password-status').textContent = 'Senha alterada.';
}));
export function showTools() {
  active = true;
  $('password').hidden = demo;
  $('tools').hidden = false;
  $('theme').querySelector('button').disabled = true;
  void analytics();
  loadTheme().then(theme=>{
    if (!active) return;
    for (const [name,value] of Object.entries(theme)) $('theme').elements.namedItem(name).value = value;
    previewTheme();
    $('theme').querySelector('button').disabled = false;
  }).catch(error=>{ if (active) $('theme-status').textContent = error.message; });
}
export function hideTools() {
  active = false;
  revision++;
  $('tools').hidden = true;
  $('analytics-results').hidden = true;
  $('password').reset();
  $('password-status').textContent = '';
  $('theme-status').textContent = '';
}
