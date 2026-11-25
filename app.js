'use strict';

// Verdulería Blunno V5 — registro simple de gastos y listas de precios para imprimir.
const STORAGE_KEY = 'verduleria-blunno-data-v1';
const UNIT_OPTIONS = ['kg','gramo','unidad','atado','bolsa','bolsón','paquete','cajón','maple','docena','bandeja','litro','tonelada'];
const CATEGORIES = ['Frutas','Verduras','Condimentos','Pollería','Leña y carbón'];
const DEFAULT_CATALOG = [
  ['Banana','Frutas','kg'],['Manzana roja','Frutas','kg'],['Manzana verde','Frutas','kg'],['Naranja','Frutas','kg'],['Mandarina','Frutas','kg'],['Pera','Frutas','kg'],['Durazno','Frutas','kg'],['Ciruela','Frutas','kg'],['Uva','Frutas','kg'],['Limón','Frutas','kg'],['Pomelo','Frutas','kg'],['Palta','Frutas','kg'],['Kiwi','Frutas','kg'],['Frutilla','Frutas','kg'],['Melón','Frutas','unidad'],['Sandía','Frutas','unidad'],['Ananá','Frutas','unidad'],
  ['Papa','Verduras','kg'],['Cebolla','Verduras','kg'],['Cebolla morada','Verduras','kg'],['Zanahoria','Verduras','kg'],['Tomate','Verduras','kg'],['Tomate perita','Verduras','kg'],['Lechuga','Verduras','unidad'],['Acelga','Verduras','atado'],['Espinaca','Verduras','atado'],['Zapallito','Verduras','kg'],['Zucchini','Verduras','kg'],['Zapallo','Verduras','kg'],['Calabaza','Verduras','kg'],['Berenjena','Verduras','kg'],['Morrón rojo','Verduras','kg'],['Morrón verde','Verduras','kg'],['Ajo','Verduras','unidad'],['Batata','Verduras','kg'],['Choclo','Verduras','unidad'],['Pepino','Verduras','kg'],['Brócoli','Verduras','kg'],['Coliflor','Verduras','unidad'],
  ['Perejil','Condimentos','atado'],['Cilantro','Condimentos','atado'],['Laurel','Condimentos','paquete'],['Orégano','Condimentos','paquete'],['Ají molido','Condimentos','paquete'],['Pimentón','Condimentos','paquete'],['Comino','Condimentos','paquete'],['Provenzal','Condimentos','paquete'],['Pimienta','Condimentos','paquete'],
  ['Pollo entero','Pollería','kg'],['Suprema de pollo','Pollería','kg'],['Pata muslo','Pollería','kg'],['Muslo','Pollería','kg'],['Alitas','Pollería','kg'],['Pechuga de pollo','Pollería','kg'],['Menudos','Pollería','kg'],['Milanesas de pollo','Pollería','kg'],['Hamburguesas de pollo','Pollería','unidad'],
  ['Leña','Leña y carbón','bolsa'],['Leña por kilo','Leña y carbón','kg'],['Carbón','Leña y carbón','bolsa'],['Carbón 3 kg','Leña y carbón','bolsa'],['Carbón 5 kg','Leña y carbón','bolsa'],['Carbón 10 kg','Leña y carbón','bolsa']
];

const makeId = (prefix = 'id') => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function parseAmount(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.max(0, value) : 0;
  let s = String(value ?? '').trim().replace(/\s/g, '').replace(/\$/g, '').replace(/[^\d,.-]/g, '');
  if (!s || s === '-' || s === ',' || s === '.') return 0;
  const comma = s.lastIndexOf(','), dot = s.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) { if (comma > dot) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/,/g, ''); }
  else if (comma >= 0) s = s.replace(/\./g, '').replace(',', '.');
  else if (dot >= 0) { const a = s.split('.'); if (a.length > 2 || (a.length === 2 && a[1].length === 3)) s = a.join(''); }
  const n = Number(s); return Number.isFinite(n) ? Math.max(0, n) : 0;
}
const money = value => '$ ' + new Intl.NumberFormat('es-AR',{minimumFractionDigits:0,maximumFractionDigits:2}).format(Number.isFinite(Number(value)) ? Number(value) : 0);
const numberFmt = value => new Intl.NumberFormat('es-AR',{maximumFractionDigits:2}).format(Number(value) || 0);
const dateToday = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,10); };
const monthToday = () => dateToday().slice(0,7);
const formatDate = value => { if (!value) return '—'; const d = new Date(`${value}T12:00:00`); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-AR'); };
const cleanName = value => String(value ?? '').trim().replace(/\s+/g,' ');
const sameName = (a,b) => cleanName(a).toLocaleLowerCase('es') === cleanName(b).toLocaleLowerCase('es');

function freshData() {
  const responsibles = ['Luz','Flor','Agus','Nico'].map(name => ({id:makeId('resp'),name}));
  return {version:5,responsibles,selectedResponsibleId:responsibles[0]?.id || null,products:DEFAULT_CATALOG.map(([name,category,unit])=>({id:makeId('prod'),name:cleanName(name),category,unit,cost:'',margin:40})),purchases:[],suppliers:[],promotions:[]};
}
function normalizeProduct(p) {
  const category = CATEGORIES.includes(p.category) ? p.category : 'Verduras';
  return {id:String(p.id || makeId('prod')),name:cleanName(p.name || 'Producto') || 'Producto',category,unit:cleanName(p.unit || 'kg') || 'kg',cost:p.cost === '' || p.cost == null ? '' : parseAmount(p.cost),margin:Math.min(1000,parseAmount(p.margin ?? 40))};
}
function normalizeLine(l) {
  const quantity = parseAmount(l.quantity), unitCost = parseAmount(l.unitCost);
  return {productId:String(l.productId || ''),productName:cleanName(l.productName || 'Producto'),quantity,unit:cleanName(l.unit || 'kg') || 'kg',unitCost,subtotal:parseAmount(l.subtotal) || quantity*unitCost};
}
function normalizePurchase(p) {
  const lines = Array.isArray(p.lines) ? p.lines.map(normalizeLine) : [];
  return {id:String(p.id || makeId('buy')),date:String(p.date || dateToday()),supplier:cleanName(p.supplier || p.provider || 'Sin proveedor cargado'),responsible:String(p.responsible || 'Sin asignar'),responsibleId:String(p.responsibleId || ''),lines,total:parseAmount(p.total) || lines.reduce((s,l)=>s+l.subtotal,0)};
}
function normalizePromotion(p) {
  // Compatible con V1/V2: el precio antiguo se transforma en una oferta de una unidad.
  const quantity = parseAmount(p.quantity) || 1;
  return {id:String(p.id || makeId('promo')),productId:String(p.productId || ''),quantity,promoTotalPrice:parseAmount(p.promoTotalPrice ?? p.promoPrice),promoMargin:p.promoMargin==null?null:Math.min(1000,parseAmount(p.promoMargin)),startDate:String(p.startDate || ''),endDate:String(p.endDate || '')};
}
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshData();
    const saved = JSON.parse(raw);
    const base = freshData();
    if (!saved || !Array.isArray(saved.products) || !Array.isArray(saved.responsibles) || !Array.isArray(saved.purchases)) return freshData();
    const responsibles = saved.responsibles.map(r=>({id:String(r.id || makeId('resp')),name:cleanName(r.name)})).filter(r=>r.name);
    const purchases = saved.purchases.map(normalizePurchase);
    const suppliers = Array.isArray(saved.suppliers) ? saved.suppliers.map(s=>({id:String(s.id || makeId('sup')),name:cleanName(s.name || s)})).filter(s=>s.name) : [];
    purchases.forEach(p=>{ if (p.supplier && !sameName(p.supplier,'Sin proveedor cargado') && !suppliers.some(s=>sameName(s.name,p.supplier))) suppliers.push({id:makeId('sup'),name:p.supplier}); });
    const selectedResponsibleId = responsibles.some(r=>r.id===saved.selectedResponsibleId) ? saved.selectedResponsibleId : (responsibles[0]?.id || null);
    const products=saved.products.length?saved.products.map(normalizeProduct):base.products;
    // Agrega la nueva categoría Pollería a instalaciones anteriores sin duplicar productos existentes.
    base.products.filter(p=>p.category==='Pollería').forEach(defaultProduct=>{if(!products.some(p=>p.category==='Pollería'&&sameName(p.name,defaultProduct.name)))products.push(defaultProduct);});
    return {version:5,responsibles,selectedResponsibleId,products,purchases,suppliers,promotions:Array.isArray(saved.promotions)?saved.promotions.map(normalizePromotion).filter(p=>p.productId && p.promoTotalPrice>0):[]};
  } catch (e) { console.warn('No se pudieron leer los datos guardados. Se abre una planilla nueva.',e); return freshData(); }
}
let state = loadData();
let activePage = 'prices';
let activeCategory = 'Todos';
let editingResponsibleId = null;
let editingSupplierId = null;
let editingPurchaseId = null;
let saveStatusTimer = null;
let promotionPriceTouched = false;

const elements = {
  responsibleSelect:$('responsibleSelect'),manageResponsiblesBtn:$('manageResponsiblesBtn'),pageTitle:$('pageTitle'),pageSubtitle:$('pageSubtitle'),todayLabel:$('todayLabel'),
  pricesPage:$('pricesPage'),purchasesPage:$('purchasesPage'),firewoodPage:$('firewoodPage'),promotionsPage:$('promotionsPage'),
  priceTableBody:$('priceTableBody'),firewoodTableBody:$('firewoodTableBody'),promotionsTableBody:$('promotionsTableBody'),productCount:$('productCount'),firewoodCount:$('firewoodCount'),promotionCount:$('promotionCount'),
  emptyProducts:$('emptyProducts'),emptyFirewood:$('emptyFirewood'),emptyPromotions:$('emptyPromotions'),productSearch:$('productSearch'),firewoodSearch:$('firewoodSearch'),categoryFilters:$('categoryFilters'),
  productDialog:$('productDialog'),productForm:$('productForm'),productDialogTitle:$('productDialogTitle'),editingProductId:$('editingProductId'),newProductName:$('newProductName'),newProductCategory:$('newProductCategory'),newProductUnit:$('newProductUnit'),newProductCost:$('newProductCost'),newProductMargin:$('newProductMargin'),
  responsiblesDialog:$('responsiblesDialog'),responsiblesList:$('responsiblesList'),newResponsibleName:$('newResponsibleName'),
  purchaseDate:$('purchaseDate'),purchaseDateBadge:$('purchaseDateBadge'),purchaseFormTitle:$('purchaseFormTitle'),purchaseSupplier:$('purchaseSupplier'),purchaseAmount:$('purchaseAmount'),purchaseResponsible:$('purchaseResponsible'),purchaseFeedback:$('purchaseFeedback'),purchaseHistoryBody:$('purchaseHistoryBody'),emptyPurchases:$('emptyPurchases'),purchaseCount:$('purchaseCount'),
  promotionDialog:$('promotionDialog'),promotionForm:$('promotionForm'),promotionDialogTitle:$('promotionDialogTitle'),editingPromotionId:$('editingPromotionId'),promotionProductSelect:$('promotionProductSelect'),promotionQuantityInput:$('promotionQuantityInput'),promotionUnitLabel:$('promotionUnitLabel'),promotionMarginInput:$('promotionMarginInput'),promotionPriceInput:$('promotionPriceInput'),promotionCalculation:$('promotionCalculation'),promotionStartDate:$('promotionStartDate'),promotionEndDate:$('promotionEndDate'),
  suppliersDialog:$('suppliersDialog'),suppliersList:$('suppliersList'),newSupplierName:$('newSupplierName')
};
function persist() {
  try {
    state.version=5;
    localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
    document.querySelectorAll('.save-status').forEach(el=>el.textContent='Cambios guardados');
    clearTimeout(saveStatusTimer); saveStatusTimer=setTimeout(()=>document.querySelectorAll('.save-status').forEach(el=>el.textContent='Guardado automático activado'),1600);
    return true;
  } catch(e) { console.error('Error al guardar:',e); alert('No se pudieron guardar los cambios en este navegador. Descargá un respaldo y revisá el espacio disponible.'); return false; }
}
function productById(id) { return state.products.find(p=>p.id===id) || null; }
function suggestedPrice(product) { return parseAmount(product.cost)*(1+parseAmount(product.margin)/100); }
function currentResponsibleName() { return state.responsibles.find(r=>r.id===state.selectedResponsibleId)?.name || 'Sin asignar'; }
function updateResponsiblePicker() {
  const selected=currentResponsibleName();
  elements.responsibleSelect.innerHTML=state.responsibles.length?state.responsibles.map(r=>`<option value="${esc(r.id)}" ${r.id===state.selectedResponsibleId?'selected':''}>${esc(r.name)}</option>`).join(''):'<option value="">Sin responsables cargados</option>';
  elements.responsibleSelect.disabled=!state.responsibles.length;
  elements.purchaseResponsible.textContent=selected;
}
function updatePurchaseDateLabel() { elements.purchaseDateBadge.textContent=formatDate(elements.purchaseDate.value); }
function actionButtons(id,type='product') {
  const attrEdit=type==='promotion'?'data-edit-promotion':'data-edit-product';
  const attrDelete=type==='promotion'?'data-delete-promotion':'data-delete-product';
  return `<div class="row-actions"><button class="row-edit" type="button" ${attrEdit}="${esc(id)}">Modificar</button><button class="row-delete" type="button" ${attrDelete}="${esc(id)}" aria-label="Eliminar" title="Eliminar">×</button></div>`;
}
function renderCategoryFilters() {
  const categories=['Todos',...CATEGORIES.filter(c=>c!=='Leña y carbón')];
  elements.categoryFilters.innerHTML=categories.map(c=>`<button class="filter-chip ${activeCategory===c?'active':''}" data-category="${esc(c)}" type="button">${esc(c)}</button>`).join('');
}
function unitOptionsMarkup(current='', includeBlank=false) {
  const selected=cleanName(current);
  const storedUnits=[...(state?.products||[]).map(p=>p.unit),...(state?.purchases||[]).flatMap(p=>(p.lines||[]).map(l=>l.unit))].map(cleanName).filter(Boolean);
  const options=[...UNIT_OPTIONS];
  storedUnits.forEach(unit=>{if(!options.some(u=>sameName(u,unit)))options.push(unit);});
  if(selected && !options.some(u=>sameName(u,selected))) options.push(selected);
  return `${includeBlank?'<option value="">Elegir unidad…</option>':''}`+options.map(unit=>`<option value="${esc(unit)}" ${sameName(unit,selected)?'selected':''}>${esc(unit)}</option>`).join('');
}
function productRow(product,inFirewood=false) {
  const cost=product.cost===''?'':parseAmount(product.cost), price=suggestedPrice(product), profit=price-parseAmount(product.cost);
  if (inFirewood) return `<tr data-product-row="${esc(product.id)}"><td><span class="product-name">${esc(product.name)}</span></td><td><select class="unit-select" data-field="unit" data-id="${esc(product.id)}" aria-label="Unidad de ${esc(product.name)}">${unitOptionsMarkup(product.unit)}</select></td><td class="numeric"><input class="table-input" type="text" inputmode="decimal" placeholder="Ingresar costo" aria-label="Costo de ${esc(product.name)}" data-field="cost" data-id="${esc(product.id)}" value="${cost===''?'':esc(numberFmt(cost))}"></td><td class="numeric"><input class="table-input percent" type="text" inputmode="decimal" aria-label="Ganancia de ${esc(product.name)}" data-field="margin" data-id="${esc(product.id)}" value="${esc(product.margin)}"></td><td class="numeric suggested-price" data-price="${esc(product.id)}">${cost===''?'—':money(price)}</td><td class="numeric profit-value" data-profit="${esc(product.id)}">${cost===''?'—':money(profit)}</td><td>${actionButtons(product.id)}</td></tr>`;
  return `<tr data-product-row="${esc(product.id)}"><td><span class="product-name">${esc(product.name)}</span></td><td><span class="product-category">${esc(product.category)}</span></td><td><select class="unit-select" data-field="unit" data-id="${esc(product.id)}" aria-label="Unidad de ${esc(product.name)}">${unitOptionsMarkup(product.unit)}</select></td><td class="numeric"><input class="table-input" type="text" inputmode="decimal" placeholder="Ingresar costo" aria-label="Costo de ${esc(product.name)}" data-field="cost" data-id="${esc(product.id)}" value="${cost===''?'':esc(numberFmt(cost))}"></td><td class="numeric"><input class="table-input percent" type="text" inputmode="decimal" aria-label="Ganancia de ${esc(product.name)}" data-field="margin" data-id="${esc(product.id)}" value="${esc(product.margin)}"></td><td class="numeric suggested-price" data-price="${esc(product.id)}">${cost===''?'—':money(price)}</td><td class="numeric profit-value" data-profit="${esc(product.id)}">${cost===''?'—':money(profit)}</td><td>${actionButtons(product.id)}</td></tr>`;
}
function renderPriceTable() {
  const query=elements.productSearch.value.trim().toLocaleLowerCase('es');
  const products=state.products.filter(p=>p.category!=='Leña y carbón'&&(activeCategory==='Todos'||p.category===activeCategory)&&p.name.toLocaleLowerCase('es').includes(query));
  elements.priceTableBody.innerHTML=products.map(p=>productRow(p)).join('');
  elements.emptyProducts.classList.toggle('hidden',products.length!==0); $('priceTableScroll').classList.toggle('hidden',products.length===0);
  elements.productCount.textContent=`${products.length} ${products.length===1?'producto':'productos'}`;
}
function renderFirewoodTable() {
  const query=elements.firewoodSearch.value.trim().toLocaleLowerCase('es');
  const products=state.products.filter(p=>p.category==='Leña y carbón'&&p.name.toLocaleLowerCase('es').includes(query));
  elements.firewoodTableBody.innerHTML=products.map(p=>productRow(p,true)).join('');
  elements.emptyFirewood.classList.toggle('hidden',products.length!==0); elements.firewoodTableBody.closest('.table-scroll').classList.toggle('hidden',products.length===0);
  elements.firewoodCount.textContent=`${products.length} ${products.length===1?'producto':'productos'}`;
}
function renderPage() {
  const config={prices:['Precios de productos','Frutas, verduras, condimentos y pollería. Costos, ganancias y precios de venta.'],firewood:['Leña y carbón','Una lista independiente para sus costos y precios de venta.'],promotions:['Promociones por cantidad','Ofertas para llevar más kilos o unidades por un precio total menor.'],purchases:['Compras a proveedores','Registrá cada compra y controlá cuánto se gasta en cada proveedor.']}[activePage];
  elements.pageTitle.textContent=config[0]; elements.pageSubtitle.textContent=config[1];
  elements.pricesPage.classList.toggle('hidden',activePage!=='prices'); elements.firewoodPage.classList.toggle('hidden',activePage!=='firewood'); elements.promotionsPage.classList.toggle('hidden',activePage!=='promotions'); elements.purchasesPage.classList.toggle('hidden',activePage!=='purchases');
  document.querySelectorAll('.tab').forEach(tab=>tab.classList.toggle('active',tab.dataset.page===activePage));
  updateResponsiblePicker();
  if(activePage==='prices')renderPriceTable(); if(activePage==='firewood')renderFirewoodTable(); if(activePage==='promotions')renderPromotions(); if(activePage==='purchases'){renderPurchaseHistory();renderSupplierSummary();renderPurchaseKpis();updatePurchaseDateLabel();refreshSupplierOptions();}
}
function setPage(page) { if(!['prices','firewood','promotions','purchases'].includes(page))return; activePage=page; renderPage(); window.scrollTo({top:0,behavior:'smooth'}); }
function updateRowCalculation(id) {
  const p=productById(id); if(!p)return;
  const priceCell=document.querySelector(`[data-price="${CSS.escape(id)}"]`),profitCell=document.querySelector(`[data-profit="${CSS.escape(id)}"]`);
  if(priceCell)priceCell.textContent=p.cost===''?'—':money(suggestedPrice(p));
  if(profitCell)profitCell.textContent=p.cost===''?'—':money(suggestedPrice(p)-parseAmount(p.cost));
  if(activePage==='promotions')renderPromotions();
}

// Productos: alta, modificación y baja sin límite artificial de cantidad.
function openProductDialog(category='Frutas',product=null) {
  elements.productForm.reset(); elements.editingProductId.value=product?.id||''; elements.productDialogTitle.textContent=product?'Modificar producto':'Agregar producto';
  elements.newProductName.value=product?.name||''; elements.newProductCategory.value=product?.category||category; elements.newProductUnit.innerHTML=unitOptionsMarkup(product?.unit||(category==='Leña y carbón'?'bolsa':'kg')); elements.newProductUnit.value=product?.unit||(category==='Leña y carbón'?'bolsa':'kg');
  elements.newProductCost.value=product?.cost===''||product?.cost==null?'':numberFmt(product.cost); elements.newProductMargin.value=String(product?.margin??40);
  elements.productDialog.showModal(); setTimeout(()=>elements.newProductName.focus(),40);
}
function saveProductForm(event) {
  event.preventDefault(); const name=cleanName(elements.newProductName.value),category=elements.newProductCategory.value,unit=cleanName(elements.newProductUnit.value),costText=elements.newProductCost.value.trim(),margin=parseAmount(elements.newProductMargin.value);
  if(!name){alert('Ingresá el nombre del producto.');elements.newProductName.focus();return;}
  if(!CATEGORIES.includes(category)||!unit){alert('Revisá la categoría y la unidad de venta.');return;}
  if(margin>1000){alert('La ganancia no puede superar el 1000%.');elements.newProductMargin.focus();return;}
  const editingId=elements.editingProductId.value;
  if(state.products.some(p=>sameName(p.name,name)&&p.category===category&&p.id!==editingId)){alert('Ya existe un producto con ese nombre en esta categoría.');return;}
  const update={name,category,unit,cost:costText===''?'':parseAmount(costText),margin};
  if(editingId){const p=productById(editingId);if(!p){alert('Ese producto ya no está en la lista.');return;}Object.assign(p,update);} else state.products.push({id:makeId('prod'),...update});
  if(!persist())return; elements.productDialog.close(); refreshProductOptions();renderCategoryFilters();renderPriceTable();renderFirewoodTable();renderPromotions();
}
function deleteProduct(id) {
  const p=productById(id);if(!p)return;
  if(!confirm(`¿Eliminar “${p.name}” de la lista? Las compras guardadas conservarán el detalle y se eliminarán las promociones de ese producto.`))return;
  state.products=state.products.filter(x=>x.id!==id);state.promotions=state.promotions.filter(x=>x.productId!==id);persist();refreshProductOptions();renderCategoryFilters();renderPriceTable();renderFirewoodTable();renderPromotions();
}
function handleProductTableEvent(event) {
  const target=event.target,edit=target.closest('[data-edit-product]'),del=target.closest('[data-delete-product]');
  if(edit){const p=productById(edit.dataset.editProduct);if(p)openProductDialog(p.category,p);return;} if(del){deleteProduct(del.dataset.deleteProduct);return;}
  const field=target.dataset.field,id=target.dataset.id;if(!field||!id)return;const p=productById(id);if(!p)return;
  if(field==='unit')p.unit=cleanName(target.value)||p.unit; if(field==='cost')p.cost=target.value.trim()===''?'':parseAmount(target.value); if(field==='margin')p.margin=Math.min(1000,parseAmount(target.value));
  updateRowCalculation(id); if(event.type==='change'){persist();if(field==='unit'){renderPromotions();}}
}

// Responsables.
function renderResponsibles() {
  elements.responsiblesList.innerHTML=state.responsibles.length?state.responsibles.map(r=>{
    if(editingResponsibleId===r.id)return `<div class="responsible-item"><div class="responsible-edit"><input type="text" maxlength="40" value="${esc(r.name)}" data-responsible-edit-name="${esc(r.id)}" aria-label="Nuevo nombre para ${esc(r.name)}"><div class="responsible-actions"><button type="button" data-save-responsible="${esc(r.id)}">Guardar</button><button type="button" data-cancel-responsible="${esc(r.id)}">Cancelar</button></div></div></div>`;
    const current=r.id===state.selectedResponsibleId?'<span class="current-responsible-tag">En uso</span>':'';
    return `<div class="responsible-item"><div class="responsible-name"><strong>${esc(r.name)}</strong>${current}</div><div class="responsible-actions"><button type="button" data-edit-responsible="${esc(r.id)}">Modificar</button><button class="delete" type="button" data-delete-responsible="${esc(r.id)}">Eliminar</button></div></div>`;
  }).join(''):'<div class="empty-responsibles">No hay responsables cargados. Agregá uno arriba.</div>';
}
function addResponsible() {
  const name=cleanName(elements.newResponsibleName.value);if(!name){elements.newResponsibleName.focus();return;}if(state.responsibles.some(r=>sameName(r.name,name))){alert('Ese responsable ya está en la lista.');return;}
  const r={id:makeId('resp'),name};state.responsibles.push(r);state.selectedResponsibleId=r.id;elements.newResponsibleName.value='';editingResponsibleId=null;persist();updateResponsiblePicker();renderResponsibles();elements.newResponsibleName.focus();
}
function beginResponsibleEdit(id){if(!state.responsibles.some(r=>r.id===id))return;editingResponsibleId=id;renderResponsibles();const input=elements.responsiblesList.querySelector(`[data-responsible-edit-name="${CSS.escape(id)}"]`);input?.focus();input?.select();}
function saveResponsibleEdit(id){const r=state.responsibles.find(x=>x.id===id),input=elements.responsiblesList.querySelector(`[data-responsible-edit-name="${CSS.escape(id)}"]`),name=cleanName(input?.value);if(!r||!name){input?.focus();return;}if(state.responsibles.some(x=>x.id!==id&&sameName(x.name,name))){alert('Ya existe un responsable con ese nombre.');input?.focus();return;}r.name=name;editingResponsibleId=null;persist();updateResponsiblePicker();renderResponsibles();}
function deleteResponsible(id){const r=state.responsibles.find(x=>x.id===id);if(!r)return;if(!confirm(`¿Eliminar a ${r.name}? El historial conservará el nombre registrado en cada compra.`))return;state.responsibles=state.responsibles.filter(x=>x.id!==id);if(state.selectedResponsibleId===id)state.selectedResponsibleId=state.responsibles[0]?.id||null;if(editingResponsibleId===id)editingResponsibleId=null;persist();updateResponsiblePicker();renderResponsibles();}

// Proveedores: agenda persistente y acumulado calculado desde las compras guardadas.
function addSupplierName(name) {
  name=cleanName(name);if(!name)return null;let existing=state.suppliers.find(s=>sameName(s.name,name));if(existing)return existing;
  const supplier={id:makeId('sup'),name};state.suppliers.push(supplier);return supplier;
}
function refreshProductOptions(){
  $('productOptions').innerHTML=state.products.slice().sort((a,b)=>a.name.localeCompare(b.name,'es')).map(p=>`<option value="${esc(p.name)}">${esc(p.category)} · ${esc(p.unit)}</option>`).join('');
}
function refreshSupplierOptions(){
  const names=[...new Set([...state.suppliers.map(s=>s.name),...state.purchases.map(p=>p.supplier)].filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  $('supplierOptions').innerHTML=names.map(n=>`<option value="${esc(n)}"></option>`).join('');
}
function supplierSummaryData(month=''){
  const map=new Map();
  state.purchases.filter(p=>!month||p.date.startsWith(month)).forEach(p=>{
    const name=p.supplier||'Proveedor sin especificar';const key=name.toLocaleLowerCase('es');
    if(!map.has(key))map.set(key,{name,count:0,total:0,lastDate:''});const row=map.get(key);row.count++;row.total+=parseAmount(p.total);if(p.date>row.lastDate)row.lastDate=p.date;
  });
  return [...map.values()].sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name,'es'));
}
function renderSupplierSummary(){
  const month=$('supplierMonthFilter').value;const rows=supplierSummaryData(month);$('supplierSummaryBody').innerHTML=rows.map(r=>`<tr><td><strong class="product-name">${esc(r.name)}</strong></td><td class="numeric">${r.count}</td><td>${formatDate(r.lastDate)}</td><td class="numeric history-total">${money(r.total)}</td></tr>`).join('');
  $('emptySupplierSummary').classList.toggle('hidden',rows.length>0);$('supplierSummaryBody').closest('.table-scroll').classList.toggle('hidden',rows.length===0);$('supplierSummaryCount').textContent=`${rows.length} ${rows.length===1?'proveedor':'proveedores'}`;
}
function renderPurchaseKpis(){
  const month=monthToday(),items=state.purchases.filter(p=>p.date.startsWith(month)),total=items.reduce((s,p)=>s+parseAmount(p.total),0);
  $('monthSpendValue').textContent=money(total);$('monthSpendCaption').textContent=new Date(`${month}-15T12:00:00`).toLocaleDateString('es-AR',{month:'long',year:'numeric'});
  $('supplierCountValue').textContent=new Set([...state.suppliers.map(s=>s.name.toLocaleLowerCase('es')),...state.purchases.map(p=>(p.supplier||'').toLocaleLowerCase('es'))].filter(Boolean)).size;
  $('monthPurchaseCount').textContent=items.length;
}
function renderSuppliers(){
  const names=[...state.suppliers].sort((a,b)=>a.name.localeCompare(b.name,'es'));
  elements.suppliersList.innerHTML=names.length?names.map(s=>{
    const spent=state.purchases.filter(p=>sameName(p.supplier,s.name)).reduce((sum,p)=>sum+parseAmount(p.total),0);
    if(editingSupplierId===s.id)return `<div class="responsible-item"><div class="responsible-edit"><input type="text" maxlength="80" value="${esc(s.name)}" data-supplier-edit-name="${esc(s.id)}"><div class="responsible-actions"><button type="button" data-save-supplier="${esc(s.id)}">Guardar</button><button type="button" data-cancel-supplier="${esc(s.id)}">Cancelar</button></div></div></div>`;
    return `<div class="responsible-item"><div><strong>${esc(s.name)}</strong><small class="supplier-lifetime-spend">Acumulado histórico: ${money(spent)}</small></div><div class="responsible-actions"><button type="button" data-edit-supplier="${esc(s.id)}">Modificar</button><button class="delete" type="button" data-delete-supplier="${esc(s.id)}">Eliminar</button></div></div>`;
  }).join(''):'<div class="empty-responsibles">Todavía no hay proveedores guardados. También se agregan automáticamente al cargar una compra.</div>';
}
function addSupplier(){const name=cleanName(elements.newSupplierName.value);if(!name){elements.newSupplierName.focus();return;}if(state.suppliers.some(s=>sameName(s.name,name))){alert('Ese proveedor ya está en la lista.');return;}state.suppliers.push({id:makeId('sup'),name});elements.newSupplierName.value='';editingSupplierId=null;persist();refreshSupplierOptions();renderSuppliers();renderPurchaseKpis();elements.newSupplierName.focus();}
function saveSupplierEdit(id){const s=state.suppliers.find(x=>x.id===id),input=elements.suppliersList.querySelector(`[data-supplier-edit-name="${CSS.escape(id)}"]`),name=cleanName(input?.value);if(!s||!name){input?.focus();return;}if(state.suppliers.some(x=>x.id!==id&&sameName(x.name,name))){alert('Ya existe un proveedor con ese nombre.');input?.focus();return;}const old=s.name;s.name=name;state.purchases.forEach(p=>{if(sameName(p.supplier,old))p.supplier=name;});editingSupplierId=null;persist();refreshSupplierOptions();renderSuppliers();renderSupplierSummary();renderPurchaseHistory();refreshProductOptions();}
function deleteSupplier(id){const s=state.suppliers.find(x=>x.id===id);if(!s)return;if(!confirm(`¿Quitar a ${s.name} de la agenda? El historial de compras no se borra y seguirá mostrando los gastos registrados.`))return;state.suppliers=state.suppliers.filter(x=>x.id!==id);if(editingSupplierId===id)editingSupplierId=null;persist();refreshSupplierOptions();renderSuppliers();renderPurchaseKpis();}

// Compras: cada renglón permite cualquier unidad de costo y detalle libre.
function setPurchaseFeedback(message,isError=false){elements.purchaseFeedback.textContent=message;elements.purchaseFeedback.classList.toggle('error',isError);}
function resetPurchaseForm(){
  editingPurchaseId=null;
  elements.purchaseFormTitle.textContent='Registrar gasto';
  $('savePurchaseBtn').innerHTML='Guardar gasto <span aria-hidden="true">→</span>';
  $('cancelEditPurchaseBtn').classList.add('hidden');
  elements.purchaseDate.value=dateToday();
  elements.purchaseSupplier.value='';
  elements.purchaseAmount.value='';
  updatePurchaseDateLabel();
  setPurchaseFeedback('Elegí el proveedor, ingresá el monto y guardá el gasto.');
}
function savePurchase(){
  const date=elements.purchaseDate.value;
  const supplier=cleanName(elements.purchaseSupplier.value);
  const total=parseAmount(elements.purchaseAmount.value);
  if(!date){setPurchaseFeedback('Ingresá la fecha del gasto.',true);elements.purchaseDate.focus();return;}
  if(!supplier){setPurchaseFeedback('Elegí o escribí el proveedor.',true);elements.purchaseSupplier.focus();return;}
  if(total<=0){setPurchaseFeedback('Ingresá un monto mayor que cero.',true);elements.purchaseAmount.focus();return;}
  const old=editingPurchaseId?state.purchases.find(p=>p.id===editingPurchaseId):null;
  const record={
    id:editingPurchaseId||makeId('buy'),date,supplier,total,
    responsible:currentResponsibleName(),
    responsibleId:state.selectedResponsibleId||'',
    // Conservamos los renglones de compras antiguas para no perder el detalle previo.
    lines:Array.isArray(old?.lines)?old.lines:[]
  };
  if(old)Object.assign(old,record);else state.purchases.unshift(record);
  addSupplierName(supplier);
  if(!persist())return;
  resetPurchaseForm();
  refreshSupplierOptions();
  renderPurchaseHistory();renderSupplierSummary();renderPurchaseKpis();renderSuppliers();
  setPurchaseFeedback(old?'Gasto modificado y guardado.':'Gasto guardado correctamente.');
}
function editPurchase(id){
  const p=state.purchases.find(x=>x.id===id);if(!p)return;
  editingPurchaseId=id;
  elements.purchaseFormTitle.textContent='Modificar gasto';
  $('savePurchaseBtn').innerHTML='Guardar cambios <span aria-hidden="true">→</span>';
  $('cancelEditPurchaseBtn').classList.remove('hidden');
  elements.purchaseDate.value=p.date||dateToday();
  elements.purchaseSupplier.value=p.supplier||'';
  elements.purchaseAmount.value=numberFmt(p.total);
  const responsible=state.responsibles.find(r=>r.id===p.responsibleId||sameName(r.name,p.responsible));
  if(responsible){state.selectedResponsibleId=responsible.id;elements.responsibleSelect.value=responsible.id;persist();updateResponsiblePicker();}
  updatePurchaseDateLabel();
  setPurchaseFeedback(`Editando el gasto de ${p.supplier||'proveedor'} del ${formatDate(p.date)}.`);
  window.scrollTo({top:$('purchasesPage').offsetTop,behavior:'smooth'});
}
function renderPurchaseHistory(){
  const month=$('purchaseMonthFilter').value;
  const list=state.purchases.filter(p=>!month||p.date.startsWith(month));
  elements.purchaseHistoryBody.innerHTML=list.map(p=>`<tr><td>${formatDate(p.date)}</td><td><strong>${esc(p.supplier||'—')}</strong></td><td>${esc(p.responsible||'Sin asignar')}</td><td class="numeric history-total">${money(p.total)}</td><td><div class="row-actions"><button class="row-edit" type="button" data-edit-purchase="${esc(p.id)}">Modificar</button><button class="row-delete" type="button" data-delete-purchase="${esc(p.id)}" aria-label="Eliminar gasto">×</button></div></td></tr>`).join('');
  elements.emptyPurchases.classList.toggle('hidden',list.length!==0);
  elements.purchaseHistoryBody.closest('.table-scroll').classList.toggle('hidden',list.length===0);
  elements.purchaseCount.textContent=`${list.length} ${list.length===1?'gasto registrado':'gastos registrados'}`;
}
function deletePurchase(id){const p=state.purchases.find(x=>x.id===id);if(!p)return;if(!confirm(`¿Eliminar la compra de ${p.supplier} del ${formatDate(p.date)}? El registro se quitará del total de ese proveedor.`))return;state.purchases=state.purchases.filter(x=>x.id!==id);if(editingPurchaseId===id)resetPurchaseForm();persist();renderPurchaseHistory();renderSupplierSummary();renderPurchaseKpis();renderSuppliers();}

// Promociones: sugerencia basada en el costo real y una ganancia promocional configurable.
function defaultPromotionMargin(product){
  // La sugerencia inicial conserva el 75% del margen habitual: ofrece un precio más atractivo sin regalar el trabajo.
  return Math.max(0,Math.round(parseAmount(product?.margin??40)*0.75*10)/10);
}
function promotionNormalTotal(product,quantity){return suggestedPrice(product)*quantity;}
function promotionCostTotal(product,quantity){return parseAmount(product?.cost)*quantity;}
function roundPromoPrice(value){return Math.ceil(Math.max(0,value)/10)*10;}
function recommendedPromotionPrice(product,quantity,margin){
  if(!product||product.cost===''||parseAmount(product.cost)<=0||quantity<=0)return 0;
  return roundPromoPrice(promotionCostTotal(product,quantity)*(1+Math.max(0,parseAmount(margin))/100));
}
function isPromotionActive(p,today=dateToday()){
  return (!p.startDate||p.startDate<=today)&&(!p.endDate||p.endDate>=today);
}
function updatePromotionCalculation(){
  const p=productById(elements.promotionProductSelect.value),q=parseAmount(elements.promotionQuantityInput.value),margin=Math.min(1000,parseAmount(elements.promotionMarginInput.value)),offer=parseAmount(elements.promotionPriceInput.value);
  elements.promotionUnitLabel.textContent=p?.unit||'—';
  if(!p){elements.promotionCalculation.textContent='Elegí un producto para calcular el precio recomendado.';return;}
  if(p.cost===''||parseAmount(p.cost)<=0){
    if(!promotionPriceTouched)elements.promotionPriceInput.value='';
    elements.promotionCalculation.innerHTML='Para recomendar una oferta que deje ganancia, primero cargá el <strong>costo de compra</strong> de este producto en Productos y precios.';
    return;
  }
  if(!q){elements.promotionCalculation.textContent=`Ingresá cuántos ${p.unit} querés incluir en la oferta.`;return;}
  const recommended=recommendedPromotionPrice(p,q,margin);
  if(!promotionPriceTouched||!elements.promotionPriceInput.value.trim())elements.promotionPriceInput.value=numberFmt(recommended);
  const actualPrice=parseAmount(elements.promotionPriceInput.value),cost=promotionCostTotal(p,q),normal=promotionNormalTotal(p,q),profit=actualPrice-cost,saving=normal-actualPrice,actualMargin=cost>0?profit/cost*100:0;
  const warning=actualPrice<=cost?'<strong class="promo-loss-warning">Esta oferta no deja ganancia. Subí el precio.</strong>':actualPrice<recommended?'<strong class="promo-warning">Deja ganancia, pero queda por debajo de la ganancia que elegiste.</strong>':'<strong class="promo-ok">La oferta conserva ganancia.</strong>';
  elements.promotionCalculation.innerHTML=`<div class="promo-metrics"><span>Costo total <strong>${money(cost)}</strong></span><span>Precio normal <strong>${money(normal)}</strong></span><span>Ganancia estimada <strong class="${profit>0?'promo-saving':'promo-loss-warning'}">${money(profit)}</strong></span></div><div class="promo-recommendation">Precio recomendado: <strong>${money(recommended)}</strong> · Ganancia sobre costo: <strong>${numberFmt(margin)}%</strong> · ${saving>0?`El cliente ahorra ${money(saving)}.`:saving<0?`La oferta queda ${money(Math.abs(saving))} por encima del precio habitual.`:'Sin descuento respecto del precio habitual.'}</div><div class="promo-status-line">${warning}${actualPrice>cost?` <span>Ganancia real: ${numberFmt(actualMargin)}%</span>`:''}</div>`;
}
function renderPromotions(){
  const rows=state.promotions.map(p=>({...p,product:productById(p.productId)})).filter(p=>p.product);
  elements.promotionsTableBody.innerHTML=rows.map(p=>{
    const cost=promotionCostTotal(p.product,p.quantity),profit=p.promoTotalPrice-cost,gain=p.product.cost===''?'Cargar costo':profit<0?`Pérdida ${money(Math.abs(profit))}`:money(profit),perUnit=p.product.cost===''?'—':money(suggestedPrice(p.product)),today=dateToday(),status=p.endDate&&p.endDate<today?'Finalizada':p.startDate&&p.startDate>today?'Programada':'Vigente',period=`${status} · ${p.startDate?formatDate(p.startDate):'Sin inicio'} – ${p.endDate?formatDate(p.endDate):'Sin vencimiento'}`;
    const offerText=`${numberFmt(p.quantity)} ${p.product.unit} x ${money(p.promoTotalPrice)}`;
    return `<tr><td><strong class="product-name">${esc(p.product.name)}</strong></td><td class="suggested-price">${esc(offerText)}</td><td class="numeric">${perUnit} / ${esc(p.product.unit)}</td><td class="numeric ${p.product.cost!==''&&profit>0?'promo-saving':'promo-loss-warning'}">${gain}</td><td><span class="promo-period">${esc(period)}</span></td><td>${actionButtons(p.id,'promotion')}</td></tr>`;
  }).join('');
  elements.emptyPromotions.classList.toggle('hidden',rows.length!==0);elements.promotionsTableBody.closest('.table-scroll').classList.toggle('hidden',rows.length===0);elements.promotionCount.textContent=`${rows.length} ${rows.length===1?'promoción':'promociones'}`;
}
function populatePromotionProducts(selectedId=''){elements.promotionProductSelect.innerHTML='<option value="">Elegir producto…</option>'+state.products.filter(p=>p.category!=='Leña y carbón').sort((a,b)=>a.name.localeCompare(b.name,'es')).map(p=>`<option value="${esc(p.id)}">${esc(p.name)} · ${esc(p.category)}</option>`).join('');elements.promotionProductSelect.value=selectedId;}
function openPromotionDialog(promo=null){
  elements.promotionForm.reset();promotionPriceTouched=!!promo;elements.editingPromotionId.value=promo?.id||'';elements.promotionDialogTitle.textContent=promo?'Modificar promoción':'Nueva promoción';populatePromotionProducts(promo?.productId||'');
  const product=promo?productById(promo.productId):null;elements.promotionQuantityInput.value=promo?numberFmt(promo.quantity):'2';elements.promotionMarginInput.value=String(promo?.promoMargin??defaultPromotionMargin(product));elements.promotionPriceInput.value=promo?numberFmt(promo.promoTotalPrice):'';elements.promotionStartDate.value=promo?.startDate||'';elements.promotionEndDate.value=promo?.endDate||'';
  updatePromotionCalculation();elements.promotionDialog.showModal();
}
function handlePromotionProductChange(){
  const p=productById(elements.promotionProductSelect.value);
  if(!elements.editingPromotionId.value){promotionPriceTouched=false;elements.promotionMarginInput.value=String(defaultPromotionMargin(p));elements.promotionPriceInput.value='';}
  updatePromotionCalculation();
}
function savePromotionForm(event){
  event.preventDefault();const product=productById(elements.promotionProductSelect.value),quantity=parseAmount(elements.promotionQuantityInput.value),price=parseAmount(elements.promotionPriceInput.value),promoMargin=Math.min(1000,parseAmount(elements.promotionMarginInput.value)),start=elements.promotionStartDate.value,end=elements.promotionEndDate.value;
  if(!product){alert('Elegí un producto.');elements.promotionProductSelect.focus();return;}if(product.cost===''||parseAmount(product.cost)<=0){alert('Primero cargá el costo de compra del producto en Productos y precios. Así evitamos publicar una oferta sin saber si deja ganancia.');return;}if(quantity<=0){alert('Ingresá una cantidad mayor que cero.');elements.promotionQuantityInput.focus();return;}if(price<=0){alert('Ingresá el precio total de la promoción.');elements.promotionPriceInput.focus();return;}if(start&&end&&end<start){alert('La fecha de finalización no puede ser anterior al inicio.');return;}
  const cost=promotionCostTotal(product,quantity),recommended=recommendedPromotionPrice(product,quantity,promoMargin);
  if(price<=cost){alert(`El costo total es ${money(cost)}. El precio de oferta tiene que ser mayor para que quede ganancia.`);elements.promotionPriceInput.focus();return;}
  if(price<recommended&&!confirm(`El precio recomendado es ${money(recommended)}. Con ${money(price)} la oferta deja ${money(price-cost)} de ganancia, menos que el objetivo de ${numberFmt(promoMargin)}%. ¿Querés guardarla igualmente?`))return;
  const id=elements.editingPromotionId.value,record={id:id||makeId('promo'),productId:product.id,quantity,promoTotalPrice:price,promoMargin,startDate:start,endDate:end};if(id){const i=state.promotions.findIndex(p=>p.id===id);if(i<0){alert('La promoción ya no está disponible.');return;}state.promotions[i]=record;}else state.promotions.push(record);
  persist();elements.promotionDialog.close();renderPromotions();
}
function deletePromotion(id){const p=state.promotions.find(x=>x.id===id);if(!p)return;if(!confirm('¿Eliminar esta promoción? El producto seguirá en el catálogo.'))return;state.promotions=state.promotions.filter(x=>x.id!==id);persist();renderPromotions();}

const PDF_W = 842, PDF_H = 595;
const CP1252 = new Map([[0x20ac,0x80],[0x201a,0x82],[0x0192,0x83],[0x201e,0x84],[0x2026,0x85],[0x2020,0x86],[0x2021,0x87],[0x02c6,0x88],[0x2030,0x89],[0x0160,0x8a],[0x2039,0x8b],[0x0152,0x8c],[0x017d,0x8e],[0x2018,0x91],[0x2019,0x92],[0x201c,0x93],[0x201d,0x94],[0x2022,0x95],[0x2013,0x96],[0x2014,0x97],[0x02dc,0x98],[0x2122,0x99],[0x0161,0x9a],[0x203a,0x9b],[0x0153,0x9c],[0x017e,0x9e],[0x0178,0x9f]]);
function pdfHex(value) {
  const bytes = [];
  for (const ch of String(value ?? '')) {
    const code = ch.codePointAt(0);
    let byte = code <= 0x7f || (code >= 0xa0 && code <= 0xff) ? code : CP1252.get(code);
    if (byte == null) byte = 0x3f;
    bytes.push(byte.toString(16).padStart(2, '0'));
  }
  return `<${bytes.join('').toUpperCase()}>`;
}
function pdfText(x, y, text, size = 9, color = '303B33', align = 'left', bold = false) {
  const safe = String(text ?? '');
  const estimatedWidth = safe.length * size * (bold ? 0.54 : 0.5);
  const tx = align === 'right' ? x - estimatedWidth : align === 'center' ? x - estimatedWidth / 2 : x;
  const rgb = [0,2,4].map(i => parseInt(color.slice(i, i + 2), 16) / 255).map(n => n.toFixed(3)).join(' ');
  return `BT /${bold ? 'F2' : 'F1'} ${size} Tf ${rgb} rg 1 0 0 1 ${tx.toFixed(2)} ${y.toFixed(2)} Tm ${pdfHex(safe)} Tj ET\n`;
}
function pdfLine(x1, y1, x2, y2, color = 'DCE4DC', width = 0.6) {
  const rgb = [0,2,4].map(i => (parseInt(color.slice(i, i + 2), 16) / 255).toFixed(3)).join(' ');
  return `${rgb} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S\n`;
}
function pdfRect(x, y, w, h, fill = 'F4F7F3', stroke = null) {
  const rgb = [0,2,4].map(i => (parseInt(fill.slice(i, i + 2), 16) / 255).toFixed(3)).join(' ');
  let out = `${rgb} rg ${x} ${y} ${w} ${h} re f\n`;
  if (stroke) {
    const srgb = [0,2,4].map(i => (parseInt(stroke.slice(i, i + 2), 16) / 255).toFixed(3)).join(' ');
    out += `${srgb} RG 0.5 w ${x} ${y} ${w} ${h} re S\n`;
  }
  return out;
}
function wrapPdfText(text, maxChars) {
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  if (!words.length) return ['—'];
  const lines = [];
  let current = '';
  for (const word of words) {
    if (!current) current = word;
    else if ((current + ' ' + word).length <= maxChars) current += ' ' + word;
    else { lines.push(current); current = word; }
  }
  if (current) lines.push(current);
  return lines;
}
function downloadPdfPageStreams(pages,filename,pageWidth,pageHeight){
  const objects=[],pageKids=[];objects[1]='<< /Type /Catalog /Pages 2 0 R >>';objects[3]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';objects[4]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  pages.forEach((pageStream,i)=>{const pageObj=5+i*2,contentObj=pageObj+1;pageKids.push(`${pageObj} 0 R`);objects[pageObj]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObj} 0 R >>`;objects[contentObj]=`<< /Length ${pageStream.length} >>\nstream\n${pageStream}endstream`;});
  objects[2]=`<< /Type /Pages /Kids [${pageKids.join(' ')}] /Count ${pages.length} >>`;let pdf='%PDF-1.4\n%BLUNNO\n';const offsets=[0];for(let i=1;i<objects.length;i++){offsets[i]=pdf.length;pdf+=`${i} 0 obj\n${objects[i]}\nendobj\n`;}const xrefOffset=pdf.length;pdf+=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;for(let i=1;i<objects.length;i++)pdf+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;pdf+=`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  const blob=new Blob([new Uint8Array([...pdf].map(ch=>ch.charCodeAt(0)))],{type:'application/pdf'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
function activePromotionsForProduct(product,today=dateToday()){
  return state.promotions.filter(p=>p.productId===product.id&&isPromotionActive(p,today)).sort((a,b)=>a.quantity-b.quantity);
}
function productPriceListRow(product){
  // La columna de oferta queda vacía para que el personal pueda escribir el precio especial a mano.
  // La tercera columna siempre muestra el precio normal calculado con costo + margen guardados.
  const sale=product.cost===''?'PRECIO PENDIENTE':`${money(suggestedPrice(product))} ${product.unit==='unidad'?'c/u':`x ${product.unit}`}`;
  return [product.name,'',sale];
}
function buildWorkerPricePdf(groups,filename){
  const pageW=595,pageH=842,margin=34,tableW=pageW-margin*2,colWidths=[205,166,156],pages=[];let stream='',y=0,pageNumber=0,currentTitle='';
  const startPage=(groupTitle)=>{
    pageNumber++;currentTitle=groupTitle;stream='';stream+=pdfRect(0,pageH-13,pageW,13,'173F32');stream+=pdfText(margin,pageH-43,'VERDULERÍA BLUNNO',8,'55745C','left',true);stream+=pdfText(pageW-margin,pageH-43,`Fecha: ${formatDate(dateToday())}`,8,'78847A','right');stream+=pdfText(margin,pageH-77,`LISTA DE PRECIOS ${groupTitle}`,17,'1C3024','left',true);stream+=pdfText(margin,pageH-96,'Completá el precio de oferta. La última columna indica el precio normal de venta.',8.5,'78847A');stream+=pdfLine(margin,pageH-108,pageW-margin,pageH-108,'D9E2D8',0.8);y=pageH-121;
    stream+=pdfRect(margin,y-28,tableW,28,'315F45');const heads=['Producto','Precio oferta','Precio x kg / unidad'];let x=margin;heads.forEach((h,i)=>{stream+=pdfText(x+7,y-18,h,9,'FFFFFF','left',true);x+=colWidths[i];});y-=28;stream+=pdfLine(margin,y,pageW-margin,y,'315F45',0.8);
  };
  const endPage=()=>{stream+=pdfLine(margin,34,pageW-margin,34,'DDE4DD',0.55);stream+=pdfText(margin,20,'Planilla para el personal · Verdulería Blunno',7,'889389');stream+=pdfText(pageW-margin,20,`Página ${pageNumber}`,7,'889389','right');pages.push(stream);};
  const addGroup=(group)=>{
    if(!group.products.length)return;
    startPage(group.title);
    group.products.forEach((product,index)=>{
      const values=productPriceListRow(product),lines=values.map((v,i)=>(i===1&&!v)?['']:wrapPdfText(v, i===0?31:i===1?25:23));const count=Math.min(3,Math.max(...lines.map(x=>x.length),1)),height=Math.max(25,count*10+10);
      if(y-height<50){endPage();startPage(group.title);}
      const bottom=y-height;if(index%2===1)stream+=pdfRect(margin,bottom,tableW,height,'F7FAF6');let x=margin;
      lines.forEach((cell,i)=>{cell.slice(0,3).forEach((line,j)=>{stream+=pdfText(x+7,y-15-j*10,line,9,i===2?'24583B':'354239','left',i===2);});x+=colWidths[i];});
      let vx=margin;stream+=pdfLine(margin,bottom,margin,y,'E1E8E0',0.4);for(let i=0;i<2;i++){vx+=colWidths[i];stream+=pdfLine(vx,bottom,vx,y,'E1E8E0',0.4);}stream+=pdfLine(pageW-margin,bottom,pageW-margin,y,'E1E8E0',0.4);stream+=pdfLine(margin,bottom,pageW-margin,bottom,'D5DED5',0.45);y=bottom;
    });
    endPage();
  };
  groups.forEach(addGroup);
  if(!pages.length){startPage('SIN PRODUCTOS');stream+=pdfText(margin,y-35,'No hay productos cargados para esta lista.',10,'4B594E');endPage();}
  downloadPdfPageStreams(pages,filename,pageW,pageH);
}
function workerGroups(products){
  const titles={'Frutas':'DE FRUTAS','Verduras':'DE VERDURAS','Condimentos':'DE CONDIMENTOS','Pollería':'DE POLLERÍA','Leña y carbón':'DE LEÑA Y CARBÓN'};
  return ['Frutas','Verduras','Condimentos','Pollería','Leña y carbón'].map(category=>({title:titles[category],products:products.filter(p=>p.category===category).sort((a,b)=>a.name.localeCompare(b.name,'es'))})).filter(g=>g.products.length);
}
function buildPdf({title, subtitle, columns, rows, filename, summary = ''}) {
  const margin = 30;
  const tableWidth = PDF_W - margin * 2;
  const widths = columns.map(c => c.weight);
  const weightSum = widths.reduce((a,b) => a + b, 0);
  const colWidths = widths.map(w => tableWidth * w / weightSum);
  const pages = [];
  let stream = '';
  let top = 0;
  let pageNumber = 0;
  const startPage = () => {
    pageNumber++;
    stream = '';
    stream += pdfRect(0, PDF_H - 12, PDF_W, 12, '173F32');
    stream += pdfText(margin, 550, 'VERDULERÍA BLUNNO', 8, '55745C', 'left', true);
    stream += pdfText(margin, 526, title, 19, '1C3024', 'left', true);
    stream += pdfText(margin, 508, subtitle || 'Registro de trabajo', 9, '78847A');
    stream += pdfText(PDF_W - margin, 550, `Emitido: ${formatDate(dateToday())}`, 8, '78847A', 'right');
    stream += pdfText(PDF_W - margin, 535, `Responsable: ${currentResponsibleName()}`, 8, '78847A', 'right');
    stream += pdfLine(margin, 494, PDF_W - margin, 494, 'D9E2D8', 0.8);
    top = 482;
    drawHeader();
  };
  const drawHeader = () => {
    const headerHeight = 26;
    const bottom = top - headerHeight;
    stream += pdfRect(margin, bottom, tableWidth, headerHeight, 'EAF1E9');
    let x = margin;
    columns.forEach((col, i) => {
      const w = colWidths[i];
      const labelLines = wrapPdfText(col.label, Math.max(8, Math.floor(w / 5.2))).slice(0, 2);
      labelLines.forEach((line, j) => { stream += pdfText(x + 6, top - 10 - j * 9, line, 7.5, '34513C', 'left', true); });
      x += w;
    });
    top = bottom;
    stream += pdfLine(margin, top, PDF_W - margin, top, 'D6E1D5', 0.6);
  };
  const drawFooter = () => {
    stream += pdfLine(margin, 29, PDF_W - margin, 29, 'DDE4DD', 0.55);
    stream += pdfText(margin, 16, 'Documento generado desde Verdulería Blunno', 7, '889389');
    stream += pdfText(PDF_W - margin, 16, `Página ${pageNumber}`, 7, '889389', 'right');
    pages.push(stream);
  };
  startPage();
  rows.forEach((row, rowIndex) => {
    const cellLines = columns.map((col, i) => wrapPdfText(row[i] ?? '', Math.max(7, Math.floor((colWidths[i] - 12) / 4.5))));
    const lineCount = Math.min(4, Math.max(...cellLines.map(lines => lines.length), 1));
    const rowHeight = Math.max(23, lineCount * 10 + 8);
    if (top - rowHeight < 43) { drawFooter(); startPage(); }
    const bottom = top - rowHeight;
    if (rowIndex % 2 === 1) stream += pdfRect(margin, bottom, tableWidth, rowHeight, 'FAFCF9');
    let x = margin;
    columns.forEach((col, i) => {
      const lines = cellLines[i].slice(0, 4);
      const w = colWidths[i];
      const align = col.align || 'left';
      lines.forEach((line, j) => {
        const tx = align === 'right' ? x + w - 7 : x + 6;
        stream += pdfText(tx, top - 13 - j * 10, line, 7.7, col.emphasis ? '24583B' : '354239', align, !!col.emphasis);
      });
      x += w;
    });
    stream += pdfLine(margin, bottom, PDF_W - margin, bottom, 'E8EDE7', 0.35);
    top = bottom;
  });
  if (summary) {
    const height = 31;
    if (top - height < 43) { drawFooter(); startPage(); }
    stream += pdfRect(margin, top - height, tableWidth, height, 'F0F5EF');
    stream += pdfText(margin + 8, top - 19, summary, 9, '244833', 'left', true);
    top -= height;
  }
  drawFooter();
  const objects = [];
  const pageKids = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  pages.forEach((pageStream, i) => {
    const pageObj = 5 + i * 2;
    const contentObj = pageObj + 1;
    pageKids.push(`${pageObj} 0 R`);
    objects[pageObj] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_W} ${PDF_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObj} 0 R >>`;
    objects[contentObj] = `<< /Length ${pageStream.length} >>\nstream\n${pageStream}endstream`;
  });
  objects[2] = `<< /Type /Pages /Kids [${pageKids.join(' ')}] /Count ${pages.length} >>`;
  let pdf = '%PDF-1.4\n%BLUNNO\n';
  const offsets = [0];
  for (let i = 1; i < objects.length; i++) {
    offsets[i] = pdf.length;
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objects.length; i++) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  const blob = new Blob([new Uint8Array([...pdf].map(ch => ch.charCodeAt(0)))], {type: 'application/pdf'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
function exportAllPdf(){
  const priceGroups=workerGroups(state.products);
  const sections=[];
  priceGroups.forEach(group=>{
    sections.push({
      title:`LISTA DE PRECIOS ${group.title}`,
      subtitle:'Precio normal de venta. La columna Precio oferta queda libre para completar a mano.',
      columns:[{label:'Producto',weight:2.4},{label:'Precio oferta (completar)',weight:1.8},{label:'Precio de venta',weight:1.8}],
      rows:group.products.map(product=>productPriceListRow(product))
    });
  });
  const today=dateToday();
  const active=state.promotions.filter(p=>isPromotionActive(p,today)).map(p=>({promo:p,product:productById(p.productId)})).filter(x=>x.product);
  sections.push({
    title:'PROMOCIONES VIGENTES',subtitle:`Ofertas activas al ${formatDate(today)}`,
    columns:[{label:'Producto',weight:1.5},{label:'Cantidad y precio de oferta',weight:2.1},{label:'Precio normal',weight:1.5},{label:'Ganancia estimada',weight:1.3,align:'right'}],
    rows:active.length?active.map(({promo,product})=>[product.name,`${numberFmt(promo.quantity)} ${product.unit} por ${money(promo.promoTotalPrice)}`,product.cost===''?'Sin costo':`${money(suggestedPrice(product))} x ${product.unit}`,product.cost===''?'—':money(promo.promoTotalPrice-promotionCostTotal(product,promo.quantity))]):[['No hay promociones vigentes','—','—','—']]
  });
  const purchases=[...state.purchases].sort((a,b)=>b.date.localeCompare(a.date));
  const spendTotal=purchases.reduce((sum,p)=>sum+parseAmount(p.total),0);
  sections.push({
    title:'REGISTRO DE COMPRAS Y GASTOS',subtitle:'Todos los gastos registrados a proveedores',
    columns:[{label:'Fecha',weight:1},{label:'Proveedor',weight:2.2},{label:'Responsable',weight:1.5},{label:'Monto',weight:1.2,align:'right'}],
    rows:purchases.length?purchases.map(p=>[formatDate(p.date),p.supplier||'Sin proveedor',p.responsible||'Sin asignar',money(p.total)]):[['—','No hay gastos registrados','—',money(0)]],
    summary:`Registros: ${purchases.length} · Total gastado: ${money(spendTotal)}`
  });
  const supplierRows=supplierSummaryData('').map(r=>[r.name,String(r.count),formatDate(r.lastDate),money(r.total)]);
  const supplierTotal=supplierSummaryData('').reduce((sum,r)=>sum+r.total,0);
  sections.push({
    title:'RESUMEN POR PROVEEDOR',subtitle:'Acumulado histórico de gastos',
    columns:[{label:'Proveedor',weight:2.4},{label:'Registros',weight:1},{label:'Última compra',weight:1.3},{label:'Total gastado',weight:1.4,align:'right'}],
    rows:supplierRows.length?supplierRows:[['No hay proveedores con gastos','0','—',money(0)]],
    summary:`Total histórico por proveedor: ${money(supplierTotal)}`
  });
  buildMultiSectionPdf(sections,`blunno-informe-completo-${today}.pdf`);
}

function buildMultiSectionPdf(sections,filename){
  const pageW=595,pageH=842,margin=34,tableW=pageW-margin*2,pages=[];
  let stream='',y=0,pageNo=0,sectionTitle='';
  const startPage=(title,subtitle)=>{
    pageNo++;sectionTitle=title;stream='';
    stream+=pdfRect(0,pageH-13,pageW,13,'173F32');
    stream+=pdfText(margin,pageH-42,'VERDULERÍA BLUNNO',8,'55745C','left',true);
    stream+=pdfText(pageW-margin,pageH-42,`Fecha: ${formatDate(dateToday())}`,8,'78847A','right');
    stream+=pdfText(margin,pageH-74,title,15,'1C3024','left',true);
    stream+=pdfText(margin,pageH-92,subtitle||'Informe general',8.3,'78847A');
    stream+=pdfLine(margin,pageH-104,pageW-margin,pageH-104,'D9E2D8',0.8);
    y=pageH-117;
  };
  const footer=()=>{stream+=pdfLine(margin,34,pageW-margin,34,'DDE4DD',0.55);stream+=pdfText(margin,20,'Documento de trabajo · Verdulería Blunno',7,'889389');stream+=pdfText(pageW-margin,20,`Página ${pageNo}`,7,'889389','right');pages.push(stream);};
  sections.forEach(section=>{
    const cols=section.columns||[];const weights=cols.map(c=>c.weight||1);const sum=weights.reduce((a,b)=>a+b,0);const widths=weights.map(w=>tableW*w/sum);
    startPage(section.title,section.subtitle);
    stream+=pdfRect(margin,y-26,tableW,26,'315F45');let x=margin;
    cols.forEach((c,i)=>{stream+=pdfText(x+6,y-17,c.label,7.5,'FFFFFF','left',true);x+=widths[i];});
    y-=26;stream+=pdfLine(margin,y,pageW-margin,y,'315F45',0.8);
    (section.rows||[]).forEach((row,index)=>{
      const wrapped=cols.map((c,i)=>String(row[i]??'')===''?['']:wrapPdfText(row[i],Math.max(7,Math.floor((widths[i]-12)/4.35))));
      const lines=Math.min(3,Math.max(...wrapped.map(a=>a.length),1));const h=Math.max(24,lines*10+9);
      if(y-h<54){footer();startPage(section.title,`${section.subtitle||''} (continuación)`);stream+=pdfRect(margin,y-26,tableW,26,'315F45');let hx=margin;cols.forEach((c,i)=>{stream+=pdfText(hx+6,y-17,c.label,7.5,'FFFFFF','left',true);hx+=widths[i];});y-=26;stream+=pdfLine(margin,y,pageW-margin,y,'315F45',0.8);}
      const bottom=y-h;if(index%2===1)stream+=pdfRect(margin,bottom,tableW,h,'F7FAF6');let cx=margin;
      cols.forEach((c,i)=>{const textLines=wrapped[i].slice(0,3);const align=c.align||'left';textLines.forEach((line,j)=>{const tx=align==='right'?cx+widths[i]-6:cx+6;stream+=pdfText(tx,y-15-j*10,line,7.8,c.emphasis?'24583B':'354239',align,!!c.emphasis);});cx+=widths[i];});
      stream+=pdfLine(margin,bottom,pageW-margin,bottom,'D5DED5',0.45);y=bottom;
    });
    if(section.summary){if(y-30<54){footer();startPage(section.title,`${section.subtitle||''} (continuación)`);}stream+=pdfRect(margin,y-28,tableW,28,'F0F5EF');stream+=pdfText(margin+7,y-18,section.summary,8.2,'244833','left',true);y-=28;}
    footer();
  });
  if(!pages.length){startPage('INFORME COMPLETO','No hay información cargada.');stream+=pdfText(margin,y-20,'No hay datos para imprimir.',9,'354239');footer();}
  downloadPdfPageStreams(pages,filename,pageW,pageH);
}

function exportPricesPdf(){
  const list=state.products.filter(p=>p.category!=='Leña y carbón');
  buildWorkerPricePdf(workerGroups(list),`blunno-lista-de-precios-${dateToday()}.pdf`);
}
function exportFirewoodPdf(){
  const list=state.products.filter(p=>p.category==='Leña y carbón');
  buildWorkerPricePdf(workerGroups(list),`blunno-lista-lena-carbon-${dateToday()}.pdf`);
}
function exportPromotionsPdf(){
  const today=dateToday();
  const list=state.promotions.filter(p=>isPromotionActive(p,today)).map(p=>({promo:p,product:productById(p.productId)})).filter(x=>x.product);
  const rows=list.map(({promo,product})=>[
    product.name,
    `${numberFmt(promo.quantity)} ${product.unit} por ${money(promo.promoTotalPrice)}`,
    product.cost===''?'Sin costo cargado':`${money(suggestedPrice(product))} x ${product.unit}`,
    product.cost===''?'—':money(promo.promoTotalPrice-promotionCostTotal(product,promo.quantity)),
    `${promo.startDate?formatDate(promo.startDate):'Sin inicio'} - ${promo.endDate?formatDate(promo.endDate):'Sin vencimiento'}`
  ]);
  if(!rows.length)rows.push(['No hay promociones vigentes','—','—','—','—']);
  buildPdf({title:'Promociones vigentes',subtitle:`Ofertas activas al ${formatDate(today)}`,columns:[{label:'Producto',weight:1.5},{label:'Precio de oferta',weight:1.6},{label:'Precio normal',weight:1.5},{label:'Ganancia estimada',weight:1.2,align:'right'},{label:'Vigencia',weight:1.5}],rows,filename:`blunno-promociones-${today}.pdf`,summary:`Promociones vigentes: ${list.length}`});
}

function exportPurchasesPdf(){
  const month=$('purchaseMonthFilter').value;
  const list=state.purchases.filter(p=>!month||p.date.startsWith(month));
  const rows=list.map(p=>[formatDate(p.date),p.supplier||'Sin proveedor',p.responsible||'Sin asignar',money(p.total)]);
  if(!rows.length)rows.push(['—','Sin registros','—',money(0)]);
  const total=list.reduce((s,p)=>s+parseAmount(p.total),0);
  buildPdf({title:'Registro de gastos a proveedores',subtitle:month?`Gastos del período ${month}`:'Todos los gastos registrados',columns:[{label:'Fecha',weight:1},{label:'Proveedor',weight:2.4},{label:'Responsable',weight:1.6},{label:'Monto',weight:1.2,align:'right',emphasis:true}],rows,filename:`blunno-gastos-proveedores-${month||dateToday()}.pdf`,summary:`Registros: ${list.length} · Total gastado: ${money(total)}`});
}
function exportSuppliersPdf(){
  const month=$('supplierMonthFilter').value,summary=supplierSummaryData(month),rows=summary.map(r=>[r.name,String(r.count),formatDate(r.lastDate),money(r.total)]);if(!rows.length)rows.push(['Sin gastos en este período','0','—',money(0)]);const total=summary.reduce((s,r)=>s+r.total,0);
  buildPdf({title:'Gastos por proveedor',subtitle:month?`Acumulado de proveedores · ${month}`:'Acumulado histórico por proveedor',columns:[{label:'Proveedor',weight:2.6},{label:'Compras',weight:.8,align:'right'},{label:'Última compra',weight:1.2},{label:'Total gastado',weight:1.4,align:'right',emphasis:true}],rows,filename:`blunno-resumen-proveedores-${month||dateToday()}.pdf`,summary:`Proveedores: ${summary.length} · Gasto del período: ${money(total)}`});
}
function downloadFile(filename,content,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
function exportBackup(){const backup={app:'Verdulería Blunno',version:5,exportedAt:new Date().toISOString(),data:state};downloadFile(`respaldo-verduleria-blunno-${dateToday()}.json`,JSON.stringify(backup,null,2),'application/json;charset=utf-8');}
function importBackup(file){
  if(!file)return;const reader=new FileReader();reader.onload=()=>{
    try{const imported=JSON.parse(String(reader.result||'')),incoming=imported?.data||imported;if(!incoming||!Array.isArray(incoming.products)||!Array.isArray(incoming.responsibles)||!Array.isArray(incoming.purchases))throw new Error('Estructura inválida');if(!confirm('Restaurar este respaldo reemplazará los datos actuales de esta página. ¿Querés continuar?'))return;
      const responsibles=incoming.responsibles.map(r=>({id:String(r.id||makeId('resp')),name:cleanName(r.name)})).filter(r=>r.name),purchases=incoming.purchases.map(normalizePurchase),suppliers=Array.isArray(incoming.suppliers)?incoming.suppliers.map(s=>({id:String(s.id||makeId('sup')),name:cleanName(s.name||s)})).filter(s=>s.name):[];
      purchases.forEach(p=>{if(p.supplier&&!sameName(p.supplier,'Sin proveedor cargado')&&!suppliers.some(s=>sameName(s.name,p.supplier)))suppliers.push({id:makeId('sup'),name:p.supplier});});
      const products=incoming.products.map(normalizeProduct),poultryDefaults=freshData().products.filter(p=>p.category==='Pollería');
      poultryDefaults.forEach(defaultProduct=>{if(!products.some(p=>p.category==='Pollería'&&sameName(p.name,defaultProduct.name)))products.push(defaultProduct);});
      state={version:5,responsibles,selectedResponsibleId:responsibles.some(r=>r.id===incoming.selectedResponsibleId)?incoming.selectedResponsibleId:(responsibles[0]?.id||null),products,purchases,suppliers,promotions:Array.isArray(incoming.promotions)?incoming.promotions.map(normalizePromotion).filter(p=>p.productId&&p.promoTotalPrice>0):[]};
      if(!state.products.length)throw new Error('El respaldo no contiene productos');persist();updateResponsiblePicker();renderCategoryFilters();renderResponsibles();refreshSupplierOptions();renderPage();alert('Respaldo restaurado correctamente.');
    }catch(e){alert('No se pudo restaurar el archivo. Verificá que sea un respaldo de Verdulería Blunno.');console.error(e);}finally{$('importBackupInput').value='';}
  };reader.onerror=()=>alert('No se pudo leer el archivo seleccionado.');reader.readAsText(file);
}

// Eventos de interfaz.
document.querySelectorAll('.tab').forEach(tab=>tab.addEventListener('click',()=>setPage(tab.dataset.page)));
elements.categoryFilters.addEventListener('click',event=>{const b=event.target.closest('[data-category]');if(!b)return;activeCategory=b.dataset.category;renderCategoryFilters();renderPriceTable();});
elements.productSearch.addEventListener('input',renderPriceTable);elements.firewoodSearch.addEventListener('input',renderFirewoodTable);
elements.responsibleSelect.addEventListener('change',()=>{state.selectedResponsibleId=elements.responsibleSelect.value||null;persist();updateResponsiblePicker();renderResponsibles();});
elements.manageResponsiblesBtn.addEventListener('click',()=>{editingResponsibleId=null;renderResponsibles();elements.responsiblesDialog.showModal();});
$('closeResponsiblesDialogBtn').addEventListener('click',()=>elements.responsiblesDialog.close());$('doneResponsiblesBtn').addEventListener('click',()=>elements.responsiblesDialog.close());$('addResponsibleBtn').addEventListener('click',addResponsible);elements.newResponsibleName.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addResponsible();}});
elements.responsiblesList.addEventListener('click',e=>{const edit=e.target.closest('[data-edit-responsible]'),del=e.target.closest('[data-delete-responsible]'),save=e.target.closest('[data-save-responsible]'),cancel=e.target.closest('[data-cancel-responsible]');if(edit)beginResponsibleEdit(edit.dataset.editResponsible);if(del)deleteResponsible(del.dataset.deleteResponsible);if(save)saveResponsibleEdit(save.dataset.saveResponsible);if(cancel){editingResponsibleId=null;renderResponsibles();}});
elements.responsiblesList.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('[data-responsible-edit-name]')){e.preventDefault();saveResponsibleEdit(e.target.dataset.responsibleEditName);}if(e.key==='Escape'&&e.target.matches('[data-responsible-edit-name]')){editingResponsibleId=null;renderResponsibles();}});
$('addProductBtn').addEventListener('click',()=>openProductDialog(activeCategory==='Todos'?'Frutas':activeCategory));$('addFirewoodBtn').addEventListener('click',()=>openProductDialog('Leña y carbón'));elements.productForm.addEventListener('submit',saveProductForm);$('cancelProductBtn').addEventListener('click',()=>elements.productDialog.close());$('closeProductDialogBtn').addEventListener('click',()=>elements.productDialog.close());
[elements.priceTableBody,elements.firewoodTableBody].forEach(body=>{body.addEventListener('input',handleProductTableEvent);body.addEventListener('change',handleProductTableEvent);body.addEventListener('click',handleProductTableEvent);});
$('savePurchaseBtn').addEventListener('click',savePurchase);$('cancelEditPurchaseBtn').addEventListener('click',resetPurchaseForm);elements.purchaseDate.addEventListener('change',updatePurchaseDateLabel);
elements.purchaseHistoryBody.addEventListener('click',e=>{const edit=e.target.closest('[data-edit-purchase]'),del=e.target.closest('[data-delete-purchase]');if(edit)editPurchase(edit.dataset.editPurchase);if(del)deletePurchase(del.dataset.deletePurchase);});
$('purchaseMonthFilter').addEventListener('change',()=>{renderPurchaseHistory();});$('supplierMonthFilter').addEventListener('change',renderSupplierSummary);
$('manageSuppliersBtn').addEventListener('click',()=>{editingSupplierId=null;renderSuppliers();elements.suppliersDialog.showModal();});$('closeSuppliersDialogBtn').addEventListener('click',()=>elements.suppliersDialog.close());$('doneSuppliersBtn').addEventListener('click',()=>elements.suppliersDialog.close());$('addSupplierBtn').addEventListener('click',addSupplier);elements.newSupplierName.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addSupplier();}});
elements.suppliersList.addEventListener('click',e=>{const edit=e.target.closest('[data-edit-supplier]'),del=e.target.closest('[data-delete-supplier]'),save=e.target.closest('[data-save-supplier]'),cancel=e.target.closest('[data-cancel-supplier]');if(edit){editingSupplierId=edit.dataset.editSupplier;renderSuppliers();const input=elements.suppliersList.querySelector(`[data-supplier-edit-name="${CSS.escape(editingSupplierId)}"]`);input?.focus();input?.select();}if(del)deleteSupplier(del.dataset.deleteSupplier);if(save)saveSupplierEdit(save.dataset.saveSupplier);if(cancel){editingSupplierId=null;renderSuppliers();}});
elements.suppliersList.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('[data-supplier-edit-name]')){e.preventDefault();saveSupplierEdit(e.target.dataset.supplierEditName);}if(e.key==='Escape'&&e.target.matches('[data-supplier-edit-name]')){editingSupplierId=null;renderSuppliers();}});
$('addPromotionBtn').addEventListener('click',()=>openPromotionDialog());elements.promotionForm.addEventListener('submit',savePromotionForm);$('closePromotionDialogBtn').addEventListener('click',()=>elements.promotionDialog.close());$('cancelPromotionBtn').addEventListener('click',()=>elements.promotionDialog.close());elements.promotionProductSelect.addEventListener('change',handlePromotionProductChange);elements.promotionQuantityInput.addEventListener('input',()=>{promotionPriceTouched=false;updatePromotionCalculation();});elements.promotionMarginInput.addEventListener('input',()=>{promotionPriceTouched=false;updatePromotionCalculation();});elements.promotionPriceInput.addEventListener('input',()=>{promotionPriceTouched=true;updatePromotionCalculation();});
elements.promotionsTableBody.addEventListener('click',e=>{const edit=e.target.closest('[data-edit-promotion]'),del=e.target.closest('[data-delete-promotion]');if(edit){const p=state.promotions.find(x=>x.id===edit.dataset.editPromotion);if(p)openPromotionDialog(p);}if(del)deletePromotion(del.dataset.deletePromotion);});
$('exportAllPdfBtn').addEventListener('click',exportAllPdf);$('exportPricesPdfBtn').addEventListener('click',exportPricesPdf);$('exportFirewoodPdfBtn').addEventListener('click',exportFirewoodPdf);$('exportPromotionsPdfBtn').addEventListener('click',exportPromotionsPdf);$('exportPurchasesPdfBtn').addEventListener('click',exportPurchasesPdf);$('exportSuppliersPdfBtn').addEventListener('click',exportSuppliersPdf);$('exportBackupBtn').addEventListener('click',exportBackup);$('importBackupInput').addEventListener('change',e=>importBackup(e.target.files?.[0]));
let lastCalendarDay=dateToday();
function refreshCalendar(){const now=new Date();$('todayLabel').textContent=now.toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric'});}
function refreshDateSensitiveViews(){
  refreshCalendar();
  const today=dateToday();
  if(today!==lastCalendarDay){
    // Si seguía la fecha automática anterior, avanzamos el formulario al nuevo día.
    // Una fecha elegida manualmente se respeta.
    if(!editingPurchaseId&&elements.purchaseDate.value===lastCalendarDay){elements.purchaseDate.value=today;updatePurchaseDateLabel();}
    lastCalendarDay=today;
    renderPromotions();
    renderPurchaseKpis();
  }
}
refreshCalendar();elements.purchaseDate.value=dateToday();$('supplierMonthFilter').value='';$('purchaseMonthFilter').value='';renderCategoryFilters();updateResponsiblePicker();refreshProductOptions();refreshSupplierOptions();renderPage();
window.addEventListener('focus',refreshDateSensitiveViews);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshDateSensitiveViews();});
window.setInterval(refreshDateSensitiveViews,60000);
window.addEventListener('storage',event=>{if(event.key===STORAGE_KEY&&event.newValue){try{state=loadData();renderCategoryFilters();updateResponsiblePicker();refreshProductOptions();refreshSupplierOptions();renderPage();}catch(e){console.warn('No se pudo actualizar desde otra pestaña.',e);}}});
