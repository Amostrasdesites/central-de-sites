import {listProducts} from './repository.js?v=painel-4';
import {element,imageSource,money} from './catalog.js?v=painel-4';
const target=document.getElementById('product-page-content');
try {
  const id=new URLSearchParams(location.search).get('id');
  const item=(await listProducts()).find(row=>row.id===id);
  if(!item || item.active===false) throw new Error();
  const root=new URL('https://amostrasdesites.github.io/Cantinho_do_Man-/');
  const src=imageSource(item.image??'',root);
  const children=[element('h1',item.name)];
  if(src){const img=element('img');img.src=src;img.alt=item.name;children.push(img);}
  children.push(element('p',item.description),element('strong',money(item.price_cents??item.price)));
  target.replaceChildren(...children);
  document.title=item.name+' · Cantinho do Maná';
} catch {
  target.replaceChildren(element('h1','Produto indisponível'),element('p','Confira os itens disponíveis no cardápio.'));
}
