'use strict';

// Verdulería Blunno V3 — planilla local con catálogo, promociones por cantidad y control de proveedores.
const STORAGE_KEY = 'verduleria-blunno-data-v1';
const UNIT_OPTIONS = ['kg','unidad','atado','bolsa','bolsón','paquete','cajón','maple','docena','bandeja','litro','tonelada'];
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
  return {version:3,responsibles,selectedResponsibleId:responsibles[0]?.id || null,products:DEFAULT_CATALOG.map(([name,category,unit])=>({id:makeId('prod'),name:cleanName(name),category,unit,cost:'',margin:40})),purchases:[],suppliers:[],promotions:[]};
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
  return {id:String(p.id || makeId('promo')),productId:String(p.productId || ''),quantity, promoTotalPrice:parseAmount(p.promoTotalPrice ?? p.promoPrice),startDate:String(p.startDate || ''),endDate:String(p.endDate || '')};
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
    return {version:3,responsibles,selectedResponsibleId,products,purchases,suppliers,promotions:Array.isArray(saved.promotions)?saved.promotions.map(normalizePromotion).filter(p=>p.productId && p.promoTotalPrice>0):[]};
  } catch (e) { console.warn('No se pudieron leer los datos guardados. Se abre una planilla nueva.',e); return freshData(); }
}
let state = loadData();
let activePage = 'prices';
let activeCategory = 'Todos';
let purchaseLines = [];
let editingResponsibleId = null;
let editingSupplierId = null;
let editingPurchaseId = null;
let saveStatusTimer = null;

const elements = {
  responsibleSelect:$('responsibleSelect'),manageResponsiblesBtn:$('manageResponsiblesBtn'),pageTitle:$('pageTitle'),pageSubtitle:$('pageSubtitle'),todayLabel:$('todayLabel'),
  pricesPage:$('pricesPage'),purchasesPage:$('purchasesPage'),firewoodPage:$('firewoodPage'),promotionsPage:$('promotionsPage'),
  priceTableBody:$('priceTableBody'),firewoodTableBody:$('firewoodTableBody'),promotionsTableBody:$('promotionsTableBody'),productCount:$('productCount'),firewoodCount:$('firewoodCount'),promotionCount:$('promotionCount'),
  emptyProducts:$('emptyProducts'),emptyFirewood:$('emptyFirewood'),emptyPromotions:$('emptyPromotions'),productSearch:$('productSearch'),firewoodSearch:$('firewoodSearch'),categoryFilters:$('categoryFilters'),
  productDialog:$('productDialog'),productForm:$('productForm'),productDialogTitle:$('productDialogTitle'),editingProductId:$('editingProductId'),newProductName:$('newProductName'),newProductCategory:$('newProductCategory'),newProductUnit:$('newProductUnit'),newProductCost:$('newProductCost'),newProductMargin:$('newProductMargin'),
  responsiblesDialog:$('responsiblesDialog'),responsiblesList:$('responsiblesList'),newResponsibleName:$('newResponsibleName'),
  purchaseDate:$('purchaseDate'),purchaseDateBadge:$('purchaseDateBadge'),purchaseFormTitle:$('purchaseFormTitle'),purchaseSupplier:$('purchaseSupplier'),purchaseResponsible:$('purchaseResponsible'),purchaseLinesBody:$('purchaseLinesBody'),purchaseTotal:$('purchaseTotal'),purchaseFeedback:$('purchaseFeedback'),purchaseHistoryBody:$('purchaseHistoryBody'),emptyPurchases:$('emptyPurchases'),purchaseCount:$('purchaseCount'),
  promotionDialog:$('promotionDialog'),promotionForm:$('promotionForm'),promotionDialogTitle:$('promotionDialogTitle'),editingPromotionId:$('editingPromotionId'),promotionProductSelect:$('promotionProductSelect'),promotionQuantityInput:$('promotionQuantityInput'),promotionUnitLabel:$('promotionUnitLabel'),promotionPriceInput:$('promotionPriceInput'),promotionCalculation:$('promotionCalculation'),promotionStartDate:$('promotionStartDate'),promotionEndDate:$('promotionEndDate'),
  suppliersDialog:$('suppliersDialog'),suppliersList:$('suppliersList'),newSupplierName:$('newSupplierName')
};
function persist() {
  try {
    state.version=3;
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
function productRow(product,inFirewood=false) {
  const cost=product.cost===''?'':parseAmount(product.cost), price=suggestedPrice(product), profit=price-parseAmount(product.cost);
  if (inFirewood) return `<tr data-product-row="${esc(product.id)}"><td><span class="product-name">${esc(product.name)}</span></td><td><input class="table-input unit-text-input" type="text" maxlength="24" value="${esc(product.unit)}" data-field="unit" data-id="${esc(product.id)}" aria-label="Unidad de ${esc(product.name)}"></td><td class="numeric"><input class="table-input" type="text" inputmode="decimal" placeholder="Ingresar costo" aria-label="Costo de ${esc(product.name)}" data-field="cost" data-id="${esc(product.id)}" value="${cost===''?'':esc(numberFmt(cost))}"></td><td class="numeric"><input class="table-input percent" type="text" inputmode="decimal" aria-label="Ganancia de ${esc(product.name)}" data-field="margin" data-id="${esc(product.id)}" value="${esc(product.margin)}"></td><td class="numeric suggested-price" data-price="${esc(product.id)}">${cost===''?'—':money(price)}</td><td class="numeric profit-value" data-profit="${esc(product.id)}">${cost===''?'—':money(profit)}</td><td>${actionButtons(product.id)}</td></tr>`;
  return `<tr data-product-row="${esc(product.id)}"><td><span class="product-name">${esc(product.name)}</span></td><td><span class="product-category">${esc(product.category)}</span></td><td><input class="table-input unit-text-input" type="text" maxlength="24" value="${esc(product.unit)}" data-field="unit" data-id="${esc(product.id)}" aria-label="Unidad de ${esc(product.name)}"></td><td class="numeric"><input class="table-input" type="text" inputmode="decimal" placeholder="Ingresar costo" aria-label="Costo de ${esc(product.name)}" data-field="cost" data-id="${esc(product.id)}" value="${cost===''?'':esc(numberFmt(cost))}"></td><td class="numeric"><input class="table-input percent" type="text" inputmode="decimal" aria-label="Ganancia de ${esc(product.name)}" data-field="margin" data-id="${esc(product.id)}" value="${esc(product.margin)}"></td><td class="numeric suggested-price" data-price="${esc(product.id)}">${cost===''?'—':money(price)}</td><td class="numeric profit-value" data-profit="${esc(product.id)}">${cost===''?'—':money(profit)}</td><td>${actionButtons(product.id)}</td></tr>`;
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
  if(activePage==='prices')renderPriceTable(); if(activePage==='firewood')renderFirewoodTable(); if(activePage==='promotions')renderPromotions(); if(activePage==='purchases'){renderPurchaseLines();renderPurchaseHistory();renderSupplierSummary();renderPurchaseKpis();updatePurchaseDateLabel();refreshSupplierOptions();}
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
  elements.newProductName.value=product?.name||''; elements.newProductCategory.value=product?.category||category; elements.newProductUnit.value=product?.unit||(category==='Leña y carbón'?'bolsa':'kg');
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
  updateRowCalculation(id); if(event.type==='change'){persist();if(field==='unit'){renderPurchaseLines();renderPromotions();}}
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
function newPurchaseLine(){purchaseLines.push({key:makeId('line'),productId:'',productName:'',quantity:'',unit:'',unitCost:'',unitAuto:false,unitCostAuto:false});renderPurchaseLines();}
function renderPurchaseLines(){
  if(!purchaseLines.length){elements.purchaseLinesBody.innerHTML='<tr><td colspan="6" class="muted">Agregá un renglón para comenzar la compra.</td></tr>';}
  else elements.purchaseLinesBody.innerHTML=purchaseLines.map(line=>{
    const subtotal=parseAmount(line.quantity)*parseAmount(line.unitCost),unit=line.unit||'kg';
    return `<tr data-line="${esc(line.key)}"><td><input class="purchase-product-input" type="text" list="productOptions" data-line-field="productName" data-key="${esc(line.key)}" value="${esc(line.productName)}" placeholder="Producto o detalle" aria-label="Producto o detalle"></td><td class="numeric"><input class="purchase-number" type="text" inputmode="decimal" placeholder="Cantidad" data-line-field="quantity" data-key="${esc(line.key)}" value="${esc(line.quantity)}" aria-label="Cantidad"></td><td><input class="purchase-unit-input" type="text" list="unitOptions" maxlength="24" placeholder="kg, bolsón…" data-line-field="unit" data-key="${esc(line.key)}" value="${esc(line.unit)}" aria-label="Unidad de compra"></td><td class="numeric"><label class="purchase-cost-field"><span data-cost-label="${esc(line.key)}">Costo por ${esc(unit)}</span><input class="purchase-number" type="text" inputmode="decimal" placeholder="Costo" data-line-field="unitCost" data-key="${esc(line.key)}" value="${esc(line.unitCost)}" aria-label="Costo por ${esc(unit)}"></label></td><td class="numeric purchase-subtotal" data-line-subtotal="${esc(line.key)}">${money(subtotal)}</td><td><div class="row-actions"><button class="row-delete" type="button" data-remove-line="${esc(line.key)}" aria-label="Quitar renglón" title="Quitar">×</button></div></td></tr>`;
  }).join('');
  updatePurchaseTotal();
}
function updatePurchaseTotal(){const total=purchaseLines.reduce((s,l)=>s+parseAmount(l.quantity)*parseAmount(l.unitCost),0);elements.purchaseTotal.textContent=money(total);}
function updatePurchaseLine(key,field,value){
  const line=purchaseLines.find(l=>l.key===key);if(!line)return;
  const row=elements.purchaseLinesBody.querySelector(`[data-line="${CSS.escape(key)}"]`);
  line[field]=value;
  if(field==='productName'){
    const match=state.products.find(p=>sameName(p.name,value));
    line.productId=match?.id||'';
    if(line.unitCostAuto){line.unitCost='';line.unitCostAuto=false;}
    if(line.unitAuto){line.unit=match?.unit||'';line.unitAuto=!!match;}
    else if(!line.unit&&match){line.unit=match.unit;line.unitAuto=true;}
    // Solo sugiere el costo guardado cuando la unidad de compra coincide exactamente.
    if(match&&line.unit===match.unit&&match.cost!==''&&!line.unitCost){line.unitCost=String(match.cost);line.unitCostAuto=true;}
    const unitInput=row?.querySelector('[data-line-field="unit"]');
    const costInput=row?.querySelector('[data-line-field="unitCost"]');
    const label=row?.querySelector(`[data-cost-label="${CSS.escape(key)}"]`);
    if(unitInput)unitInput.value=line.unit;
    if(costInput)costInput.value=line.unitCost;
    if(label)label.textContent=`Costo por ${line.unit||'unidad'}`;
    if(costInput)costInput.setAttribute('aria-label',`Costo por ${line.unit||'unidad'}`);
  }
  if(field==='unit'){
    line.unitAuto=false;
    const selected=line.productId?productById(line.productId):null;
    if(line.unitCostAuto&&selected&&cleanName(value)!==selected.unit){line.unitCost='';line.unitCostAuto=false;const costInput=row?.querySelector('[data-line-field="unitCost"]');if(costInput)costInput.value='';}
    const label=row?.querySelector(`[data-cost-label="${CSS.escape(key)}"]`);
    const costInput=row?.querySelector('[data-line-field="unitCost"]');
    if(label)label.textContent=`Costo por ${cleanName(value)||'unidad'}`;
    if(costInput)costInput.setAttribute('aria-label',`Costo por ${cleanName(value)||'unidad'}`);
  }
  if(field==='unitCost')line.unitCostAuto=false;
  const subtotal=elements.purchaseLinesBody.querySelector(`[data-line-subtotal="${CSS.escape(key)}"]`);
  if(subtotal)subtotal.textContent=money(parseAmount(line.quantity)*parseAmount(line.unitCost));
  updatePurchaseTotal();
}
function setPurchaseFeedback(message,isError=false){elements.purchaseFeedback.textContent=message;elements.purchaseFeedback.classList.toggle('error',isError);}
function resetPurchaseForm(){editingPurchaseId=null;elements.purchaseFormTitle.textContent='Detalle de compra';$('savePurchaseBtn').innerHTML='Guardar compra <span aria-hidden="true">→</span>';$('cancelEditPurchaseBtn').classList.add('hidden');elements.purchaseDate.value=dateToday();elements.purchaseSupplier.value='';purchaseLines=[{key:makeId('line'),productId:'',productName:'',quantity:'',unit:'',unitCost:'',unitAuto:false,unitCostAuto:false}];renderPurchaseLines();updatePurchaseDateLabel();setPurchaseFeedback('Elegí un proveedor, completá los renglones y guardá.');}
function savePurchase(){
  const date=elements.purchaseDate.value,supplier=cleanName(elements.purchaseSupplier.value);
  if(!date){setPurchaseFeedback('Ingresá la fecha de la compra.',true);elements.purchaseDate.focus();return;}
  if(!supplier){setPurchaseFeedback('Ingresá o seleccioná el proveedor.',true);elements.purchaseSupplier.focus();return;}
  const populated=purchaseLines.filter(l=>l.productName.trim()||String(l.quantity).trim()||String(l.unitCost).trim());
  if(!populated.length){setPurchaseFeedback('Agregá al menos un producto o detalle.',true);return;}
  const lines=[];
  for(let i=0;i<populated.length;i++){
    const l=populated[i],name=cleanName(l.productName),quantity=parseAmount(l.quantity),unit=cleanName(l.unit),unitCost=parseAmount(l.unitCost);
    if(!name){setPurchaseFeedback(`En el renglón ${i+1}, ingresá el producto o detalle.`,true);return;}
    if(quantity<=0){setPurchaseFeedback(`En ${name}, ingresá una cantidad mayor que cero.`,true);return;}
    if(!unit){setPurchaseFeedback(`En ${name}, indicá la unidad: kg, bolsón, cajón, unidad, etc.`,true);return;}
    if(unitCost<=0){setPurchaseFeedback(`En ${name}, ingresá el costo por ${unit}.`,true);return;}
    const p=state.products.find(x=>sameName(x.name,name));
    lines.push({productId:p?.id||'',productName:p?.name||name,quantity,unit,unitCost,subtotal:quantity*unitCost});
  }
  const total=lines.reduce((s,l)=>s+l.subtotal,0);
  const old=editingPurchaseId?state.purchases.find(p=>p.id===editingPurchaseId):null;
  const record={id:editingPurchaseId||makeId('buy'),date,supplier,responsible:currentResponsibleName(),responsibleId:state.selectedResponsibleId||'',lines,total};
  if(old){Object.assign(old,record);}else state.purchases.unshift(record);
  addSupplierName(supplier);
  // Actualiza el costo del catálogo únicamente si la unidad coincide con la unidad de venta del producto.
  lines.forEach(l=>{const p=productById(l.productId);if(p&&sameName(p.unit,l.unit))p.cost=l.unitCost;});
  if(!persist())return;
  resetPurchaseForm();refreshSupplierOptions();renderPurchaseHistory();renderSupplierSummary();renderPurchaseKpis();renderSuppliers();renderPriceTable();renderFirewoodTable();renderPromotions();
  setPurchaseFeedback(old?'Compra modificada y guardada.':'Compra guardada correctamente. Se actualizó el historial del proveedor.');
}
function editPurchase(id){
  const p=state.purchases.find(x=>x.id===id);if(!p)return;editingPurchaseId=id;elements.purchaseFormTitle.textContent='Modificar compra';$('savePurchaseBtn').innerHTML='Guardar cambios <span aria-hidden="true">→</span>';$('cancelEditPurchaseBtn').classList.remove('hidden');elements.purchaseDate.value=p.date;elements.purchaseSupplier.value=p.supplier||'';
  const responsible=state.responsibles.find(r=>r.id===p.responsibleId||sameName(r.name,p.responsible));if(responsible){state.selectedResponsibleId=responsible.id;elements.responsibleSelect.value=responsible.id;persist();updateResponsiblePicker();}
  purchaseLines=p.lines.map(l=>({key:makeId('line'),productId:l.productId||'',productName:l.productName||'',quantity:String(l.quantity),unit:l.unit||'kg',unitCost:String(l.unitCost)}));if(!purchaseLines.length)purchaseLines=[{key:makeId('line'),productId:'',productName:'',quantity:'',unit:'',unitCost:'',unitAuto:false,unitCostAuto:false}];
  renderPurchaseLines();updatePurchaseDateLabel();setPurchaseFeedback(`Editando compra del ${formatDate(p.date)} a ${p.supplier}.`);window.scrollTo({top:$('purchasesPage').offsetTop,behavior:'smooth'});
}
function renderPurchaseHistory(){
  const month=$('purchaseMonthFilter').value;const list=state.purchases.filter(p=>!month||p.date.startsWith(month));
  elements.purchaseHistoryBody.innerHTML=list.map(p=>{const detail=p.lines.map(l=>`${l.productName} × ${numberFmt(l.quantity)} ${l.unit} · ${money(l.unitCost)}/${l.unit}`).join(' | ');return `<tr><td>${formatDate(p.date)}</td><td>${esc(p.supplier||'—')}</td><td>${esc(p.responsible)}</td><td><span class="history-detail">${esc(detail)}</span></td><td class="numeric history-total">${money(p.total)}</td><td><div class="row-actions"><button class="row-edit" type="button" data-edit-purchase="${esc(p.id)}">Modificar</button><button class="row-delete" type="button" data-delete-purchase="${esc(p.id)}" aria-label="Eliminar compra">×</button></div></td></tr>`;}).join('');
  elements.emptyPurchases.classList.toggle('hidden',list.length!==0);elements.purchaseHistoryBody.closest('.table-scroll').classList.toggle('hidden',list.length===0);elements.purchaseCount.textContent=`${list.length} ${list.length===1?'compra registrada':'compras registradas'}`;
}
function deletePurchase(id){const p=state.purchases.find(x=>x.id===id);if(!p)return;if(!confirm(`¿Eliminar la compra de ${p.supplier} del ${formatDate(p.date)}? El registro se quitará del total de ese proveedor.`))return;state.purchases=state.purchases.filter(x=>x.id!==id);if(editingPurchaseId===id)resetPurchaseForm();persist();renderPurchaseHistory();renderSupplierSummary();renderPurchaseKpis();renderSuppliers();}

// Promociones: cantidad mínima por un precio total (ej.: 2 kg por $ 1.800).
function promotionNormalTotal(product,quantity){return suggestedPrice(product)*quantity;}
function updatePromotionCalculation(){
  const p=productById(elements.promotionProductSelect.value),q=parseAmount(elements.promotionQuantityInput.value),offer=parseAmount(elements.promotionPriceInput.value);
  elements.promotionUnitLabel.textContent=p?.unit||'—';
  if(!p){elements.promotionCalculation.textContent='Elegí un producto para calcular el ahorro.';return;}
  if(!q||!offer){elements.promotionCalculation.textContent=`La oferta será por ${q?numberFmt(q):'…'} ${p.unit}. Completá cantidad y precio total.`;return;}
  const normal=promotionNormalTotal(p,q),saving=normal-offer,perUnit=offer/q;
  if(normal>0)elements.promotionCalculation.innerHTML=`Precio habitual por ${numberFmt(q)} ${esc(p.unit)}: <strong>${money(normal)}</strong><br>Precio por ${p.unit} en la oferta: <strong>${money(perUnit)}</strong> · ${saving>0?`Ahorro para el cliente: <strong class="promo-saving">${money(saving)}</strong>`:`La oferta no queda por debajo del precio habitual.`}`;
  else elements.promotionCalculation.textContent='Cargá el costo y la ganancia del producto para calcular el ahorro frente al precio habitual.';
}
function renderPromotions(){
  const rows=state.promotions.map(p=>({...p,product:productById(p.productId)})).filter(p=>p.product);
  elements.promotionsTableBody.innerHTML=rows.map(p=>{
    const normal=promotionNormalTotal(p.product,p.quantity),saving=Math.max(0,normal-p.promoTotalPrice),today=dateToday(),status=p.endDate&&p.endDate<today?'Finalizada':p.startDate&&p.startDate>today?'Programada':'Vigente',period=`${status} · ${p.startDate?formatDate(p.startDate):'Sin inicio'} – ${p.endDate?formatDate(p.endDate):'Sin vencimiento'}`;
    return `<tr><td><strong class="product-name">${esc(p.product.name)}</strong></td><td>${numberFmt(p.quantity)} ${esc(p.product.unit)}</td><td class="numeric">${normal>0?money(normal):'—'}</td><td class="numeric suggested-price">${money(p.promoTotalPrice)}</td><td class="numeric promo-saving">${normal>0?money(saving):'—'}</td><td><span class="promo-period">${esc(period)}</span></td><td>${actionButtons(p.id,'promotion')}</td></tr>`;
  }).join('');
  elements.emptyPromotions.classList.toggle('hidden',rows.length!==0);elements.promotionsTableBody.closest('.table-scroll').classList.toggle('hidden',rows.length===0);elements.promotionCount.textContent=`${rows.length} ${rows.length===1?'promoción':'promociones'}`;
}
function populatePromotionProducts(selectedId=''){elements.promotionProductSelect.innerHTML='<option value="">Elegir producto…</option>'+state.products.filter(p=>p.category!=='Leña y carbón').sort((a,b)=>a.name.localeCompare(b.name,'es')).map(p=>`<option value="${esc(p.id)}">${esc(p.name)} · ${esc(p.category)}</option>`).join('');elements.promotionProductSelect.value=selectedId;}
function openPromotionDialog(promo=null){
  elements.promotionForm.reset();elements.editingPromotionId.value=promo?.id||'';elements.promotionDialogTitle.textContent=promo?'Modificar promoción':'Nueva promoción';populatePromotionProducts(promo?.productId||'');elements.promotionQuantityInput.value=promo?numberFmt(promo.quantity):'2';elements.promotionPriceInput.value=promo?numberFmt(promo.promoTotalPrice):'';elements.promotionStartDate.value=promo?.startDate||'';elements.promotionEndDate.value=promo?.endDate||'';updatePromotionCalculation();elements.promotionDialog.showModal();
}
function savePromotionForm(event){
  event.preventDefault();const product=productById(elements.promotionProductSelect.value),quantity=parseAmount(elements.promotionQuantityInput.value),price=parseAmount(elements.promotionPriceInput.value),start=elements.promotionStartDate.value,end=elements.promotionEndDate.value;
  if(!product){alert('Elegí un producto.');elements.promotionProductSelect.focus();return;}if(quantity<=0){alert('Ingresá una cantidad mayor que cero.');elements.promotionQuantityInput.focus();return;}if(price<=0){alert('Ingresá el precio total de la promoción.');elements.promotionPriceInput.focus();return;}if(start&&end&&end<start){alert('La fecha de finalización no puede ser anterior al inicio.');return;}
  const id=elements.editingPromotionId.value,record={id:id||makeId('promo'),productId:product.id,quantity,promoTotalPrice:price,startDate:start,endDate:end};if(id){const i=state.promotions.findIndex(p=>p.id===id);if(i<0){alert('La promoción ya no está disponible.');return;}state.promotions[i]=record;}else state.promotions.push(record);
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
function exportPricesPdf(){
  const list=state.products.filter(p=>p.category!=='Leña y carbón').sort((a,b)=>CATEGORIES.indexOf(a.category)-CATEGORIES.indexOf(b.category)||a.name.localeCompare(b.name,'es'));
  const rows=list.map(p=>[p.name,p.category,p.unit,p.cost===''?'Sin costo':money(p.cost),`${numberFmt(p.margin)} %`,p.cost===''?'—':money(suggestedPrice(p)),p.cost===''?'—':money(suggestedPrice(p)-parseAmount(p.cost))]);
  if(!rows.length)rows.push(['Sin productos cargados','','','','','','']);
  buildPdf({title:'Productos y precios',subtitle:'Frutas, verduras, condimentos y pollería · costos, márgenes y precios sugeridos',columns:[{label:'Producto',weight:2.0},{label:'Categoría',weight:1.05},{label:'Unidad',weight:.65},{label:'Costo compra',weight:1.0,align:'right'},{label:'Ganancia costo',weight:.9,align:'right'},{label:'Precio venta',weight:1.05,align:'right',emphasis:true},{label:'Ganancia',weight:.9,align:'right'}],rows,filename:`blunno-productos-${dateToday()}.pdf`,summary:`Productos en catálogo: ${list.length}`});
}
function exportFirewoodPdf(){
  const list=state.products.filter(p=>p.category==='Leña y carbón');const rows=list.map(p=>[p.name,p.unit,p.cost===''?'Sin costo':money(p.cost),`${numberFmt(p.margin)} %`,p.cost===''?'—':money(suggestedPrice(p)),p.cost===''?'—':money(suggestedPrice(p)-parseAmount(p.cost))]);if(!rows.length)rows.push(['Sin productos cargados','','','','','']);
  buildPdf({title:'Leña y carbón',subtitle:'Planilla de costos, ganancias y precios de venta',columns:[{label:'Producto',weight:2.2},{label:'Unidad',weight:.8},{label:'Costo compra',weight:1.2,align:'right'},{label:'Ganancia costo',weight:1.1,align:'right'},{label:'Precio venta',weight:1.2,align:'right',emphasis:true},{label:'Ganancia',weight:1,align:'right'}],rows,filename:`blunno-lena-carbon-${dateToday()}.pdf`,summary:`Productos incluidos: ${list.length}`});
}
function exportPromotionsPdf(){
  const list=state.promotions.map(p=>({...p,product:productById(p.productId)})).filter(p=>p.product);const rows=list.map(p=>{const normal=promotionNormalTotal(p.product,p.quantity),period=p.startDate||p.endDate?`${p.startDate?formatDate(p.startDate):'Sin inicio'} a ${p.endDate?formatDate(p.endDate):'Sin vencimiento'}`:'Sin fecha';return [p.product.name,`${numberFmt(p.quantity)} ${p.product.unit}`,normal>0?money(normal):'—',money(p.promoTotalPrice),normal>0?money(Math.max(0,normal-p.promoTotalPrice)):'—',period];});if(!rows.length)rows.push(['Sin promociones','','','','','']);
  buildPdf({title:'Promociones por cantidad',subtitle:'Ofertas por cantidad mínima y precio total',columns:[{label:'Producto',weight:1.7},{label:'Cantidad',weight:.9},{label:'Precio habitual total',weight:1.25,align:'right'},{label:'Precio oferta',weight:1.15,align:'right',emphasis:true},{label:'Ahorro',weight:.9,align:'right'},{label:'Vigencia',weight:1.6}],rows,filename:`blunno-promociones-${dateToday()}.pdf`,summary:`Promociones cargadas: ${list.length}`});
}
function exportPurchasesPdf(){
  const month=$('purchaseMonthFilter').value,list=state.purchases.filter(p=>!month||p.date.startsWith(month));const rows=list.map(p=>[formatDate(p.date),p.supplier||'Sin proveedor',p.responsible,p.lines.map(l=>`${l.productName} × ${numberFmt(l.quantity)} ${l.unit} a ${money(l.unitCost)}/${l.unit}`).join(' | '),money(p.total)]);if(!rows.length)rows.push(['—','—','—','No hay compras en este período','—']);
  const total=list.reduce((s,p)=>s+parseAmount(p.total),0);buildPdf({title:'Historial de compras',subtitle:month?`Compras del período ${month}`:'Compras registradas a todos los proveedores',columns:[{label:'Fecha',weight:.9},{label:'Proveedor',weight:1.3},{label:'Responsable',weight:1.0},{label:'Detalle y costo por unidad',weight:3.5},{label:'Total',weight:1,align:'right',emphasis:true}],rows,filename:`blunno-compras-${month||dateToday()}.pdf`,summary:`Registros: ${list.length} · Gasto total: ${money(total)}`});
}
function exportSuppliersPdf(){
  const month=$('supplierMonthFilter').value,summary=supplierSummaryData(month),rows=summary.map(r=>[r.name,String(r.count),formatDate(r.lastDate),money(r.total)]);if(!rows.length)rows.push(['Sin gastos en este período','0','—',money(0)]);const total=summary.reduce((s,r)=>s+r.total,0);
  buildPdf({title:'Gastos por proveedor',subtitle:month?`Acumulado de proveedores · ${month}`:'Acumulado histórico por proveedor',columns:[{label:'Proveedor',weight:2.6},{label:'Compras',weight:.8,align:'right'},{label:'Última compra',weight:1.2},{label:'Total gastado',weight:1.4,align:'right',emphasis:true}],rows,filename:`blunno-gastos-proveedores-${month||dateToday()}.pdf`,summary:`Proveedores: ${summary.length} · Gasto del período: ${money(total)}`});
}
function downloadFile(filename,content,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
function exportBackup(){const backup={app:'Verdulería Blunno',version:3,exportedAt:new Date().toISOString(),data:state};downloadFile(`respaldo-verduleria-blunno-${dateToday()}.json`,JSON.stringify(backup,null,2),'application/json;charset=utf-8');}
function importBackup(file){
  if(!file)return;const reader=new FileReader();reader.onload=()=>{
    try{const imported=JSON.parse(String(reader.result||'')),incoming=imported?.data||imported;if(!incoming||!Array.isArray(incoming.products)||!Array.isArray(incoming.responsibles)||!Array.isArray(incoming.purchases))throw new Error('Estructura inválida');if(!confirm('Restaurar este respaldo reemplazará los datos actuales de esta página. ¿Querés continuar?'))return;
      const responsibles=incoming.responsibles.map(r=>({id:String(r.id||makeId('resp')),name:cleanName(r.name)})).filter(r=>r.name),purchases=incoming.purchases.map(normalizePurchase),suppliers=Array.isArray(incoming.suppliers)?incoming.suppliers.map(s=>({id:String(s.id||makeId('sup')),name:cleanName(s.name||s)})).filter(s=>s.name):[];
      purchases.forEach(p=>{if(p.supplier&&!sameName(p.supplier,'Sin proveedor cargado')&&!suppliers.some(s=>sameName(s.name,p.supplier)))suppliers.push({id:makeId('sup'),name:p.supplier});});
      const products=incoming.products.map(normalizeProduct),poultryDefaults=freshData().products.filter(p=>p.category==='Pollería');
      poultryDefaults.forEach(defaultProduct=>{if(!products.some(p=>p.category==='Pollería'&&sameName(p.name,defaultProduct.name)))products.push(defaultProduct);});
      state={version:3,responsibles,selectedResponsibleId:responsibles.some(r=>r.id===incoming.selectedResponsibleId)?incoming.selectedResponsibleId:(responsibles[0]?.id||null),products,purchases,suppliers,promotions:Array.isArray(incoming.promotions)?incoming.promotions.map(normalizePromotion).filter(p=>p.productId&&p.promoTotalPrice>0):[]};
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
$('addPurchaseLineBtn').addEventListener('click',newPurchaseLine);
elements.purchaseLinesBody.addEventListener('input',e=>{const f=e.target.dataset.lineField,k=e.target.dataset.key;if(f&&k)updatePurchaseLine(k,f,e.target.value);});
elements.purchaseLinesBody.addEventListener('change',e=>{const f=e.target.dataset.lineField,k=e.target.dataset.key;if(f&&k)updatePurchaseLine(k,f,e.target.value);});
elements.purchaseLinesBody.addEventListener('click',e=>{const b=e.target.closest('[data-remove-line]');if(!b)return;purchaseLines=purchaseLines.filter(l=>l.key!==b.dataset.removeLine);renderPurchaseLines();});
$('savePurchaseBtn').addEventListener('click',savePurchase);$('cancelEditPurchaseBtn').addEventListener('click',resetPurchaseForm);elements.purchaseDate.addEventListener('change',updatePurchaseDateLabel);
elements.purchaseHistoryBody.addEventListener('click',e=>{const edit=e.target.closest('[data-edit-purchase]'),del=e.target.closest('[data-delete-purchase]');if(edit)editPurchase(edit.dataset.editPurchase);if(del)deletePurchase(del.dataset.deletePurchase);});
$('purchaseMonthFilter').addEventListener('change',()=>{renderPurchaseHistory();});$('supplierMonthFilter').addEventListener('change',renderSupplierSummary);
$('manageSuppliersBtn').addEventListener('click',()=>{editingSupplierId=null;renderSuppliers();elements.suppliersDialog.showModal();});$('closeSuppliersDialogBtn').addEventListener('click',()=>elements.suppliersDialog.close());$('doneSuppliersBtn').addEventListener('click',()=>elements.suppliersDialog.close());$('addSupplierBtn').addEventListener('click',addSupplier);elements.newSupplierName.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addSupplier();}});
elements.suppliersList.addEventListener('click',e=>{const edit=e.target.closest('[data-edit-supplier]'),del=e.target.closest('[data-delete-supplier]'),save=e.target.closest('[data-save-supplier]'),cancel=e.target.closest('[data-cancel-supplier]');if(edit){editingSupplierId=edit.dataset.editSupplier;renderSuppliers();const input=elements.suppliersList.querySelector(`[data-supplier-edit-name="${CSS.escape(editingSupplierId)}"]`);input?.focus();input?.select();}if(del)deleteSupplier(del.dataset.deleteSupplier);if(save)saveSupplierEdit(save.dataset.saveSupplier);if(cancel){editingSupplierId=null;renderSuppliers();}});
elements.suppliersList.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('[data-supplier-edit-name]')){e.preventDefault();saveSupplierEdit(e.target.dataset.supplierEditName);}if(e.key==='Escape'&&e.target.matches('[data-supplier-edit-name]')){editingSupplierId=null;renderSuppliers();}});
$('addPromotionBtn').addEventListener('click',()=>openPromotionDialog());elements.promotionForm.addEventListener('submit',savePromotionForm);$('closePromotionDialogBtn').addEventListener('click',()=>elements.promotionDialog.close());$('cancelPromotionBtn').addEventListener('click',()=>elements.promotionDialog.close());elements.promotionProductSelect.addEventListener('change',updatePromotionCalculation);elements.promotionQuantityInput.addEventListener('input',updatePromotionCalculation);elements.promotionPriceInput.addEventListener('input',updatePromotionCalculation);
elements.promotionsTableBody.addEventListener('click',e=>{const edit=e.target.closest('[data-edit-promotion]'),del=e.target.closest('[data-delete-promotion]');if(edit){const p=state.promotions.find(x=>x.id===edit.dataset.editPromotion);if(p)openPromotionDialog(p);}if(del)deletePromotion(del.dataset.deletePromotion);});
$('exportPricesPdfBtn').addEventListener('click',exportPricesPdf);$('exportFirewoodPdfBtn').addEventListener('click',exportFirewoodPdf);$('exportPromotionsPdfBtn').addEventListener('click',exportPromotionsPdf);$('exportPurchasesPdfBtn').addEventListener('click',exportPurchasesPdf);$('exportSuppliersPdfBtn').addEventListener('click',exportSuppliersPdf);$('exportBackupBtn').addEventListener('click',exportBackup);$('importBackupInput').addEventListener('change',e=>importBackup(e.target.files?.[0]));
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
refreshCalendar();elements.purchaseDate.value=dateToday();$('supplierMonthFilter').value='';$('purchaseMonthFilter').value='';purchaseLines=[{key:makeId('line'),productId:'',productName:'',quantity:'',unit:'',unitCost:'',unitAuto:false,unitCostAuto:false}];renderCategoryFilters();updateResponsiblePicker();refreshProductOptions();refreshSupplierOptions();renderPage();
window.addEventListener('focus',refreshDateSensitiveViews);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshDateSensitiveViews();});
window.setInterval(refreshDateSensitiveViews,60000);
window.addEventListener('storage',event=>{if(event.key===STORAGE_KEY&&event.newValue){try{state=loadData();renderCategoryFilters();updateResponsiblePicker();refreshProductOptions();refreshSupplierOptions();renderPage();}catch(e){console.warn('No se pudo actualizar desde otra pestaña.',e);}}});
