import {element,imageSource,money} from './catalog.js?v=painel-4';
import {listOrders,saveOrder} from './repository.js?v=painel-4';

const $ = id => document.getElementById(id);
const form=$('order-form');
const editor=$('order-editor');
const detail=$('order-detail');
const payment={pending:'Aguardando pagamento',paid:'Pago',canceled:'Cancelado'};
const delivery={waiting:'Aguardando preparo',preparing:'Em preparo',sent:'Enviado',delivered:'Entregue',issue:'Problema na entrega',canceled:'Cancelado'};
const storefront=new URL('https://amostrasdesites.github.io/Cantinho_do_Man-/');
const dateFormat=new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'});
let catalog=[],orders=[],editing,selected,draftId,generation=0;
const orderNumber=order=>'#'+String(order.number).padStart(4,'0');
const total=items=>items.reduce((sum,item)=>sum+item.quantity*item.price_cents,0);
const phoneDigits=value=>value.replace(/\D/g,'');
function trackingUrl(value) {
  try { const url=new URL(value); if(url.protocol==='https:' && !url.username && !url.password) return url.href; } catch {}
  return '';
}
function badge(labels,id) {return element('span',labels[id]??id,'order-badge badge-'+id);}
function render() {
  const rows=$('orders-rows');
  rows.replaceChildren(...orders.map(order=>{
    const row=element('tr');
    const actions=element('td');
    const button=element('button','Abrir '+orderNumber(order),'btn light');
    button.type='button';
    button.onclick=()=>openDetail(order);
    actions.append(button);
    const paid=element('td'), shipping=element('td');
    paid.append(badge(payment,order.payment));
    shipping.append(badge(delivery,order.delivery));
    row.append(element('td',orderNumber(order)),element('td',order.customer),element('td',money(total(order.items))),paid,shipping,actions);
    return row;
  }));
  $('orders-status').textContent=orders.length?'':'Nenhum pedido cadastrado.';
}
function orderRows() {return Array.from($('order-items').children);}
function readItems() {
  return orderRows().map(row=>{
    const product=row.querySelector('select').value;
    const amount=row.querySelector('input').valueAsNumber;
    const item=row.previousItem?.id===product?row.previousItem:catalog.find(entry=>entry.id===product);
    return item ? {id:product,name:item.name,price_cents:item.price_cents,image:item.image,quantity:amount} : null;
  });
}
function updateTotal() { $('order-total').textContent='Total '+money(total(readItems().filter(item=>item && Number.isFinite(item.quantity)))); }
function addItem(previous) {
  if(orderRows().length>=20) return;
  const row=element('div',null,'order-item');
  row.previousItem=previous;
  const product=element('select');
  product.setAttribute('aria-label','Produto do pedido');
  product.required=true;
  product.append(new Option('Selecione um produto',''));
  if(previous && !catalog.some(item=>item.id===previous.id)) product.append(new Option(previous.name+' (indisponível)',previous.id));
  for(const item of catalog) product.append(new Option(item.name+' · '+money(item.price_cents),item.id));
  product.value=previous?.id??'';
  product.onchange=()=>updateTotal();
  const quantity=element('input');
  quantity.type='number';quantity.min=1;quantity.max=999;quantity.value=previous?.quantity??1;quantity.required=true;
  quantity.setAttribute('aria-label','Quantidade');
  quantity.oninput=updateTotal;
  const remove=element('button','Remover','btn light');
  remove.type='button';
  remove.onclick=()=>{row.remove();updateTotal();};
  row.append(product,quantity,remove);
  $('order-items').append(row);
  updateTotal();
}
function openEditor(order) {
  if(detail.open) detail.close();
  editing=order;
  draftId=order?.id??crypto.randomUUID();
  form.reset();
  $('order-title').textContent=order?'Editar pedido '+orderNumber(order):'Novo pedido';
  $('order-error').textContent='';
  for(const name of ['customer','phone','payment','delivery','tracking']) if(order) form.elements.namedItem(name).value=order[name]??'';
  $('order-items').replaceChildren();
  for(const item of order?.items??[undefined]) addItem(item);
  editor.showModal();
}
function info(parent,title,value) {
  const line=element('p');
  line.append(element('strong',title+' '),document.createTextNode(value));
  parent.append(line);
}
function orderContent(order,printing=false) {
  const content=element('div',null,'order-paper');
  if(printing) content.append(element('h1','Cantinho do Maná'),element('h2','Pedido '+orderNumber(order)));
  info(content,'Cliente',order.customer);
  info(content,'Telefone',order.phone);
  info(content,'Data',dateFormat.format(new Date(order.created_at)));
  const badges=element('div',null,'order-actions');
  badges.append(badge(payment,order.payment),badge(delivery,order.delivery));
  content.append(badges);
  if(order.tracking && trackingUrl(order.tracking)) {
    const line=element('p');
    const link=element('a',printing?order.tracking:'Abrir rastreio');
    link.href=order.tracking;link.target='_blank';link.rel='noopener noreferrer';
    line.append(element('strong','Rastreio '),link);content.append(line);
  }
  const list=element('ul',null,'order-detail-items');
  for(const item of order.items) {
    const row=element('li');
    const image=imageSource(item.image??'',storefront);
    const link=element('a');
    link.href='./produto.html?id='+encodeURIComponent(item.id);
    link.target='_blank';link.rel='noopener noreferrer';
    link.setAttribute('aria-label','Abrir produto '+item.name);
    if(image) { const img=element('img');img.src=image;img.alt='';link.append(img); }
    else link.append(element('span','Ver', 'order-no-photo'));
    row.append(link,element('span',item.name+' · '+item.quantity+' un.'),element('strong',money(item.quantity*item.price_cents)));
    list.append(row);
  }
  content.append(list);
  info(content,'Total',money(total(order.items)));
  return content;
}
function openDetail(order) {
  selected=order;
  $('order-detail-title').textContent='Pedido '+orderNumber(order);
  $('order-detail-body').replaceChildren(orderContent(order));
  $('share-status').textContent='';
  detail.showModal();
}
function whatsapp() {
  let phone=phoneDigits($('owner-phone').value);
  if(phone.length===10 || phone.length===11) phone='55'+phone;
  if(phone.length<12 || phone.length>15) {
    $('share-status').textContent='Informe o WhatsApp da dona com o código do país e o DDD.';
    return;
  }
  const order=selected;
  const lines=['Pedido '+orderNumber(order)+' · Cantinho do Maná','Cliente '+order.customer,'Telefone '+order.phone,
    'Pagamento '+payment[order.payment],'Entrega '+delivery[order.delivery],
    ...order.items.map(item=>item.quantity+'× '+item.name+' · '+money(item.quantity*item.price_cents)+'\n'+new URL('./produto.html?id='+encodeURIComponent(item.id),location.href).href),
    'Total '+money(total(order.items))];
  if(order.tracking && trackingUrl(order.tracking)) lines.push('Rastreio '+order.tracking);
  window.open('https://wa.me/'+phone+'?text='+encodeURIComponent(lines.join('\n')),'_blank','noopener,noreferrer');
  $('share-status').textContent='Confira a mensagem no WhatsApp antes de enviar.';
}
$('new-order').onclick=()=>openEditor();
$('close-order').onclick=()=>editor.close();
$('close-order-detail').onclick=()=>detail.close();
$('add-order-item').onclick=()=>addItem();
$('edit-order').onclick=()=>openEditor(selected);
$('send-order').onclick=whatsapp;
$('print-order-button').onclick=async()=>{
  const print=$('print-order');
  print.replaceChildren(orderContent(selected,true));
  await Promise.race([Promise.all(Array.from(print.querySelectorAll('img'),img=>img.decode().catch(()=>{}))),new Promise(resolve=>setTimeout(resolve,1500))]);
  window.print();
};
window.addEventListener('afterprint',()=>$('print-order').replaceChildren());
form.onsubmit=async event=>{
  event.preventDefault();
  const data=Object.fromEntries(new FormData(form));
  const items=readItems();
  const error=$('order-error');
  error.textContent='';
  if (!data.customer.trim() || phoneDigits(data.phone).length<10 || phoneDigits(data.phone).length>15) {
    error.textContent='Informe o nome e um telefone válido do cliente.';return;
  }
  if (data.tracking && !trackingUrl(data.tracking)) {error.textContent='O rastreio precisa ser um link HTTPS.';return;}
  if (!items.length || items.some(item=>!item || !Number.isInteger(item.quantity) || item.quantity<1 || item.quantity>999)) {
    error.textContent='Selecione ao menos um produto e uma quantidade válida.';return;
  }
  const button=event.submitter;
  const version=generation;
  button.disabled=true;
  try {
    const saved=await saveOrder({...editing,...data,id:draftId,customer:data.customer.trim(),items});
    if(version!==generation) return;
    orders=[saved,...orders.filter(row=>row.id!==saved.id)].sort((a,b)=>b.number-a.number);
    editor.close();render();openDetail(saved);
    window.dispatchEvent(new Event('store-order-saved'));
  } catch(err) {if(version===generation) error.textContent=err.message;}
  finally {button.disabled=false;}
};
export function updateOrderCatalog(products) {catalog=products;}
export async function showOrders() {
  const version=++generation;
  $('orders').hidden=false;
  $('orders-status').textContent='Carregando…';
  $('new-order').disabled=true;
  try {
    const result=await listOrders();
    if(version!==generation) return;
    orders=result;render();
    $('new-order').disabled=false;
  } catch { if(version===generation) $('orders-status').textContent='Não foi possível carregar os pedidos. Confira a conexão com o banco.'; }
}
export function hideOrders() {
  generation++;orders=[];catalog=[];selected=editing=undefined;
  $('orders-rows').replaceChildren();$('order-detail-body').replaceChildren();$('print-order').replaceChildren();
  $('orders').hidden=true;editor.close();detail.close();form.reset();
}
