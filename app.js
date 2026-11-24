'use strict';

const STORAGE_KEY = 'verduleria-blunno-data-v1';
const UNIT_OPTIONS = ['kg', 'unidad', 'atado', 'bolsa', 'paquete', 'cajón', 'tonelada'];
const DEFAULT_CATALOG = [
  ['Banana','Frutas','kg'],['Manzana roja','Frutas','kg'],['Manzana verde','Frutas','kg'],['Naranja','Frutas','kg'],['Mandarina','Frutas','kg'],['Pera','Frutas','kg'],['Durazno','Frutas','kg'],['Ciruela','Frutas','kg'],['Uva','Frutas','kg'],['Limón','Frutas','kg'],['Pomelo','Frutas','kg'],['Palta','Frutas','kg'],['Kiwi','Frutas','kg'],['Frutilla','Frutas','kg'],['Melón','Frutas','unidad'],['Sandía','Frutas','unidad'],['Ananá','Frutas','unidad'],
  ['Papa','Verduras','kg'],['Cebolla','Verduras','kg'],['Cebolla morada','Verduras','kg'],['Zanahoria','Verduras','kg'],['Tomate','Verduras','kg'],['Tomate perita','Verduras','kg'],['Lechuga','Verduras','unidad'],['Acelga','Verduras','atado'],['Espinaca','Verduras','atado'],['Zapallito','Verduras','kg'],['Zucchini','Verduras','kg'],['Zapallo','Verduras','kg'],['Calabaza','Verduras','kg'],['Berenjena','Verduras','kg'],['Morrón rojo','Verduras','kg'],['Morrón verde','Verduras','kg'],['Ajo','Verduras','unidad'],['Batata','Verduras','kg'],['Choclo','Verduras','unidad'],['Pepino','Verduras','kg'],['Brócoli','Verduras','kg'],['Coliflor','Verduras','unidad'],
  ['Perejil','Condimentos','atado'],['Cilantro','Condimentos','atado'],['Laurel','Condimentos','paquete'],['Orégano','Condimentos','paquete'],['Ají molido','Condimentos','paquete'],['Pimentón','Condimentos','paquete'],['Comino','Condimentos','paquete'],['Provenzal','Condimentos','paquete'],['Pimienta','Condimentos','paquete'],
  ['Leña','Leña y carbón','bolsa'],['Leña por kilo','Leña y carbón','kg'],['Carbón','Leña y carbón','bolsa'],['Carbón 3 kg','Leña y carbón','bolsa'],['Carbón 5 kg','Leña y carbón','bolsa'],['Carbón 10 kg','Leña y carbón','bolsa']
];

const makeId = (prefix='id') => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const clone = value => JSON.parse(JSON.stringify(value));
const money = value => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '$ 0';
  return '$ ' + new Intl.NumberFormat('es-AR', {maximumFractionDigits: 2, minimumFractionDigits: 0}).format(n);
};
const parseAmount = value => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  let s = String(value ?? '').trim().replace(/\s/g, '').replace(/\$/g, '');
  if (!s) return 0;
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
};
const dateToday = () => {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0,10);
};
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

function freshData() {
  return {
    version: 1,
    responsibles: ['Luz','Flor','Agus','Nico'].map(name => ({id:makeId('resp'), name})),
    selectedResponsibleId: null,
    products: DEFAULT_CATALOG.map(([name,category,unit]) => ({id:makeId('prod'), name, category, unit, cost:'', margin:40})),
    purchases: []
  };
}
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshData();
    const saved = JSON.parse(raw);
    if (!saved || !Array.isArray(saved.products) || !Array.isArray(saved.responsibles) || !Array.isArray(saved.purchases)) return freshData();
    const base = freshData();
    const data = {
      version: 1,
      responsibles: saved.responsibles.map(r => ({id:String(r.id || makeId('resp')), name:String(r.name || '').trim()})).filter(r => r.name),
      selectedResponsibleId: saved.selectedResponsibleId || null,
      products: saved.products.map(p => ({id:String(p.id || makeId('prod')), name:String(p.name || 'Producto'), category:['Frutas','Verduras','Condimentos','Leña y carbón'].includes(p.category) ? p.category : 'Verduras', unit:UNIT_OPTIONS.includes(p.unit) ? p.unit : 'kg', cost:p.cost === '' || p.cost == null ? '' : parseAmount(p.cost), margin:Math.max(0, Math.min(1000, parseAmount(p.margin ?? 40)))})),
      purchases: saved.purchases.map(p => ({id:String(p.id || makeId('buy')), date:String(p.date || dateToday()), responsible:String(p.responsible || 'Sin asignar'), lines:Array.isArray(p.lines) ? p.lines.map(l => ({productName:String(l.productName || 'Producto'), quantity:parseAmount(l.quantity), unit:UNIT_OPTIONS.includes(l.unit) ? l.unit : 'kg', unitCost:parseAmount(l.unitCost), subtotal:parseAmount(l.subtotal)})) : [], total:parseAmount(p.total)}))
    };
    if (!data.selectedResponsibleId || !data.responsibles.some(r => r.id === data.selectedResponsibleId)) data.selectedResponsibleId = data.responsibles[0]?.id || null;
    if (!data.products.length) data.products = base.products;
    return data;
  } catch (error) {
    console.warn('No se pudieron leer los datos guardados.', error);
    return freshData();
  }
}

let state = loadData();
if (!state.selectedResponsibleId && state.responsibles.length) state.selectedResponsibleId = state.responsibles[0].id;
let activePage = 'prices';
let activeCategory = 'Todos';
let purchaseLines = [];
let saveStatusTimer = null;

const $ = id => document.getElementById(id);
const elements = {
  responsibleSelect:$('responsibleSelect'), manageResponsiblesBtn:$('manageResponsiblesBtn'),
  pageTitle:$('pageTitle'), pageSubtitle:$('pageSubtitle'), headingActions:$('headingActions'),
  pricesPage:$('pricesPage'), purchasesPage:$('purchasesPage'), firewoodPage:$('firewoodPage'),
  priceTableBody:$('priceTableBody'), firewoodTableBody:$('firewoodTableBody'),
  productCount:$('productCount'), firewoodCount:$('firewoodCount'), emptyProducts:$('emptyProducts'), emptyFirewood:$('emptyFirewood'),
  productSearch:$('productSearch'), firewoodSearch:$('firewoodSearch'), categoryFilters:$('categoryFilters'),
  productDialog:$('productDialog'), productForm:$('productForm'), productDialogTitle:$('productDialogTitle'),
  editingProductId:$('editingProductId'), newProductName:$('newProductName'), newProductCategory:$('newProductCategory'), newProductUnit:$('newProductUnit'),
  responsiblesDialog:$('responsiblesDialog'), responsiblesList:$('responsiblesList'), newResponsibleName:$('newResponsibleName'),
  editResponsibleDialog:$('editResponsibleDialog'), editResponsibleId:$('editResponsibleId'), editResponsibleName:$('editResponsibleName'),
  purchaseDate:$('purchaseDate'), purchaseResponsible:$('purchaseResponsible'), purchaseLinesBody:$('purchaseLinesBody'), purchaseTotal:$('purchaseTotal'),
  purchaseFeedback:$('purchaseFeedback'), purchaseHistoryBody:$('purchaseHistoryBody'), emptyPurchases:$('emptyPurchases')
};

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    const status = document.querySelector('.save-status');
    if (status) {
      status.textContent = 'Cambios guardados';
      clearTimeout(saveStatusTimer);
      saveStatusTimer = setTimeout(() => document.querySelectorAll('.save-status').forEach(el => el.textContent = 'Cambios guardados automáticamente'), 1600);
    }
  } catch (error) {
    alert('No se pudieron guardar los cambios en este navegador. Descargá un respaldo y liberá espacio antes de seguir.');
    console.error(error);
  }
}
function currentResponsible() { return state.responsibles.find(r => r.id === state.selectedResponsibleId) || null; }
function productById(id) { return state.products.find(p => p.id === id); }
function suggestedPrice(product) {
  const cost = parseAmount(product.cost);
  const margin = parseAmount(product.margin);
  return cost > 0 ? cost * (1 + margin / 100) : 0;
}
function updateResponsiblePicker() {
  const selected = currentResponsible();
  elements.responsibleSelect.innerHTML = state.responsibles.length
    ? state.responsibles.map(r => `<option value="${esc(r.id)}" ${r.id === selected?.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')
    : '<option value="">Sin responsables</option>';
  elements.responsibleSelect.disabled = !state.responsibles.length;
  elements.purchaseResponsible.textContent = selected?.name || 'Sin asignar';
}
function unitOptions(selected) { return UNIT_OPTIONS.map(u => `<option value="${esc(u)}" ${u === selected ? 'selected' : ''}>${esc(u)}</option>`).join(''); }
function productRow(product, inFirewood=false) {
  const price = suggestedPrice(product);
  const profit = price - parseAmount(product.cost);
  const categoryLine = inFirewood ? '' : `<span class="product-category">${esc(product.category)}</span>`;
  return `<tr data-product-row="${esc(product.id)}">
    <td><span class="product-name">${esc(product.name)}</span>${categoryLine}</td>
    <td><select class="unit-select" data-field="unit" data-id="${esc(product.id)}" aria-label="Unidad de ${esc(product.name)}">${unitOptions(product.unit)}</select></td>
    <td class="numeric"><input class="table-input" type="text" inputmode="decimal" placeholder="0,00" aria-label="Costo de ${esc(product.name)}" data-field="cost" data-id="${esc(product.id)}" value="${product.cost === '' ? '' : esc(product.cost)}"></td>
    <td class="numeric"><input class="table-input percent" type="text" inputmode="decimal" aria-label="Porcentaje de ganancia para ${esc(product.name)}" data-field="margin" data-id="${esc(product.id)}" value="${esc(product.margin)}"></td>
    <td class="numeric suggested-price" data-price="${esc(product.id)}">${product.cost === '' ? '—' : money(price)}</td>
    <td class="numeric profit-value" data-profit="${esc(product.id)}">${product.cost === '' ? '—' : money(profit)}</td>
    <td><div class="row-actions"><button class="row-edit" type="button" data-edit-product="${esc(product.id)}">Editar</button><button class="row-action" type="button" data-delete-product="${esc(product.id)}" aria-label="Eliminar ${esc(product.name)}" title="Eliminar">×</button></div></td>
  </tr>`;
}
function renderPriceTable() {
  const query = elements.productSearch.value.trim().toLocaleLowerCase('es');
  const products = state.products.filter(p => ['Frutas','Verduras','Condimentos'].includes(p.category) && (activeCategory === 'Todos' || p.category === activeCategory) && p.name.toLocaleLowerCase('es').includes(query));
  elements.priceTableBody.innerHTML = products.map(p => productRow(p)).join('');
  elements.emptyProducts.classList.toggle('hidden', products.length !== 0);
  elements.productCount.textContent = `${products.length} ${products.length === 1 ? 'producto' : 'productos'}`;
  elements.priceTableBody.closest('.table-scroll').classList.toggle('hidden', products.length === 0);
}
function renderFirewoodTable() {
  const query = elements.firewoodSearch.value.trim().toLocaleLowerCase('es');
  const products = state.products.filter(p => p.category === 'Leña y carbón' && p.name.toLocaleLowerCase('es').includes(query));
  elements.firewoodTableBody.innerHTML = products.map(p => productRow(p, true)).join('');
  elements.emptyFirewood.classList.toggle('hidden', products.length !== 0);
  elements.firewoodCount.textContent = `${products.length} ${products.length === 1 ? 'producto' : 'productos'}`;
  elements.firewoodTableBody.closest('.table-scroll').classList.toggle('hidden', products.length === 0);
}
function renderPage() {
  const config = {
    prices:['Precios de productos','Cargá costos y definí la ganancia para calcular el precio de venta.'],
    purchases:['Compras','Armá una planilla de compra y consultá el historial.'],
    firewood:['Leña y carbón','Una planilla separada para estos productos.']
  }[activePage];
  elements.pageTitle.textContent = config[0];
  elements.pageSubtitle.textContent = config[1];
  elements.pricesPage.classList.toggle('hidden', activePage !== 'prices');
  elements.purchasesPage.classList.toggle('hidden', activePage !== 'purchases');
  elements.firewoodPage.classList.toggle('hidden', activePage !== 'firewood');
  document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.page === activePage));
  elements.headingActions.innerHTML = activePage === 'purchases' ? '' : '';
  if (activePage === 'prices') renderPriceTable();
  if (activePage === 'purchases') { renderPurchaseLines(); renderPurchaseHistory(); }
  if (activePage === 'firewood') renderFirewoodTable();
}
function setPage(page) { activePage = page; renderPage(); }
function updateRowCalculation(id) {
  const product = productById(id);
  if (!product) return;
  const priceCell = document.querySelector(`[data-price="${CSS.escape(id)}"]`);
  const profitCell = document.querySelector(`[data-profit="${CSS.escape(id)}"]`);
  if (priceCell) priceCell.textContent = product.cost === '' ? '—' : money(suggestedPrice(product));
  if (profitCell) profitCell.textContent = product.cost === '' ? '—' : money(suggestedPrice(product) - parseAmount(product.cost));
}
function openProductDialog(category='Frutas', product=null) {
  elements.productForm.reset();
  elements.editingProductId.value = product?.id || '';
  elements.productDialogTitle.textContent = product ? 'Editar producto' : 'Agregar producto';
  elements.newProductName.value = product?.name || '';
  elements.newProductCategory.value = product?.category || category;
  elements.newProductUnit.value = product?.unit || (category === 'Leña y carbón' ? 'bolsa' : 'kg');
  elements.productDialog.showModal();
  setTimeout(() => elements.newProductName.focus(), 30);
}
function saveProductForm(event) {
  if (event.submitter?.value === 'cancel') { event.preventDefault(); elements.productDialog.close(); return; }
  event.preventDefault();
  const name = elements.newProductName.value.trim();
  const category = elements.newProductCategory.value;
  const unit = elements.newProductUnit.value;
  if (!name) return;
  const duplicate = state.products.find(p => p.name.toLocaleLowerCase('es') === name.toLocaleLowerCase('es') && p.category === category && p.id !== elements.editingProductId.value);
  if (duplicate) { alert('Ya existe un producto con ese nombre en esta categoría.'); return; }
  const editingId = elements.editingProductId.value;
  if (editingId) {
    const product = productById(editingId);
    if (product) Object.assign(product, {name, category, unit});
  } else {
    state.products.push({id:makeId('prod'), name, category, unit, cost:'', margin:40});
  }
  persist();
  elements.productDialog.close();
  renderPriceTable(); renderFirewoodTable();
}
function deleteProduct(id) {
  const product = productById(id);
  if (!product) return;
  if (!confirm(`¿Eliminar "${product.name}" de la lista de productos? Las compras ya guardadas no se modifican.`)) return;
  state.products = state.products.filter(p => p.id !== id);
  persist(); renderPriceTable(); renderFirewoodTable();
}

function renderResponsibles() {
  elements.responsiblesList.innerHTML = state.responsibles.length ? state.responsibles.map(r => `<div class="responsible-item"><strong>${esc(r.name)}</strong><div class="responsible-actions"><button type="button" data-edit-responsible="${esc(r.id)}">Modificar</button><button class="delete" type="button" data-delete-responsible="${esc(r.id)}">Eliminar</button></div></div>`).join('') : '<p class="muted">Todavía no hay responsables. Podés agregar uno arriba.</p>';
}
function addResponsible() {
  const name = elements.newResponsibleName.value.trim();
  if (!name) { elements.newResponsibleName.focus(); return; }
  if (state.responsibles.some(r => r.name.toLocaleLowerCase('es') === name.toLocaleLowerCase('es'))) { alert('Ese responsable ya está en la lista.'); return; }
  const responsible = {id:makeId('resp'), name};
  state.responsibles.push(responsible);
  state.selectedResponsibleId = responsible.id;
  elements.newResponsibleName.value = '';
  persist(); updateResponsiblePicker(); renderResponsibles();
}
function openEditResponsible(id) {
  const responsible = state.responsibles.find(r => r.id === id);
  if (!responsible) return;
  elements.editResponsibleId.value = id;
  elements.editResponsibleName.value = responsible.name;
  elements.editResponsibleDialog.showModal();
  setTimeout(() => elements.editResponsibleName.focus(), 30);
}
function saveResponsibleEdit(event) {
  if (event.submitter?.value === 'cancel') { event.preventDefault(); elements.editResponsibleDialog.close(); return; }
  event.preventDefault();
  const id = elements.editResponsibleId.value;
  const name = elements.editResponsibleName.value.trim();
  const responsible = state.responsibles.find(r => r.id === id);
  if (!responsible || !name) return;
  if (state.responsibles.some(r => r.id !== id && r.name.toLocaleLowerCase('es') === name.toLocaleLowerCase('es'))) { alert('Ya existe un responsable con ese nombre.'); return; }
  responsible.name = name;
  persist(); updateResponsiblePicker(); renderResponsibles(); elements.editResponsibleDialog.close();
}
function deleteResponsible(id) {
  const responsible = state.responsibles.find(r => r.id === id);
  if (!responsible) return;
  if (!confirm(`¿Eliminar a ${responsible.name} de la lista de responsables? El historial de compras conserva el nombre registrado.`)) return;
  state.responsibles = state.responsibles.filter(r => r.id !== id);
  if (state.selectedResponsibleId === id) state.selectedResponsibleId = state.responsibles[0]?.id || null;
  persist(); updateResponsiblePicker(); renderResponsibles();
}

function newPurchaseLine() {
  const firstProduct = state.products.find(p => p.category !== 'Leña y carbón') || state.products[0];
  purchaseLines.push({key:makeId('line'), productId:firstProduct?.id || '', quantity:'', unit:firstProduct?.unit || 'kg', unitCost:firstProduct?.cost === '' ? '' : String(firstProduct.cost)});
  renderPurchaseLines();
}
function renderPurchaseLines() {
  if (!purchaseLines.length) {
    elements.purchaseLinesBody.innerHTML = '<tr><td colspan="6" class="muted">Agregá un renglón para comenzar la compra.</td></tr>';
  } else {
    const options = state.products.map(p => `<option value="${esc(p.id)}">${esc(p.name)} · ${esc(p.category)}</option>`).join('');
    elements.purchaseLinesBody.innerHTML = purchaseLines.map(line => {
      const p = productById(line.productId);
      const subtotal = parseAmount(line.quantity) * parseAmount(line.unitCost);
      return `<tr data-line="${esc(line.key)}"><td><select class="purchase-product" data-line-field="productId" data-key="${esc(line.key)}"><option value="">Elegir producto</option>${options}</select></td><td class="numeric"><input class="purchase-number" type="text" inputmode="decimal" placeholder="0" data-line-field="quantity" data-key="${esc(line.key)}" value="${esc(line.quantity)}" aria-label="Cantidad"></td><td class="purchase-unit" data-line-unit="${esc(line.key)}">${esc(line.unit || p?.unit || '—')}</td><td class="numeric"><input class="purchase-number" type="text" inputmode="decimal" placeholder="0,00" data-line-field="unitCost" data-key="${esc(line.key)}" value="${esc(line.unitCost)}" aria-label="Costo unitario"></td><td class="numeric purchase-subtotal" data-line-subtotal="${esc(line.key)}">${money(subtotal)}</td><td><button class="row-action" type="button" data-remove-line="${esc(line.key)}" aria-label="Quitar renglón">×</button></td></tr>`;
    }).join('');
    purchaseLines.forEach(line => {
      const select = document.querySelector(`.purchase-product[data-key="${CSS.escape(line.key)}"]`);
      if (select) select.value = line.productId;
    });
  }
  const total = purchaseLines.reduce((sum, line) => sum + parseAmount(line.quantity) * parseAmount(line.unitCost), 0);
  elements.purchaseTotal.textContent = money(total);
}
function updatePurchaseLine(key, field, value) {
  const line = purchaseLines.find(l => l.key === key);
  if (!line) return;
  line[field] = value;
  if (field === 'productId') {
    const product = productById(value);
    if (product) {
      line.unit = product.unit;
      line.unitCost = product.cost === '' ? '' : String(product.cost);
    }
    renderPurchaseLines();
    return;
  }
  const subtotal = parseAmount(line.quantity) * parseAmount(line.unitCost);
  const cell = document.querySelector(`[data-line-subtotal="${CSS.escape(key)}"]`);
  if (cell) cell.textContent = money(subtotal);
  const total = purchaseLines.reduce((sum, l) => sum + parseAmount(l.quantity) * parseAmount(l.unitCost), 0);
  elements.purchaseTotal.textContent = money(total);
}
function savePurchase() {
  if (!purchaseLines.length) { alert('Agregá al menos un producto a la compra.'); return; }
  const lines = [];
  for (const line of purchaseLines) {
    if (!line.productId || !productById(line.productId)) { alert('Elegí un producto en cada renglón.'); return; }
    const quantity = parseAmount(line.quantity);
    const unitCost = parseAmount(line.unitCost);
    if (quantity <= 0) { alert('La cantidad debe ser mayor que cero.'); return; }
    if (unitCost <= 0) { alert('Ingresá un costo unitario mayor que cero.'); return; }
    const product = productById(line.productId);
    lines.push({productId:product.id, productName:product.name, quantity, unit:line.unit || product.unit, unitCost, subtotal:quantity * unitCost});
  }
  const total = lines.reduce((sum, line) => sum + line.subtotal, 0);
  const responsible = currentResponsible()?.name || 'Sin asignar';
  state.purchases.unshift({id:makeId('buy'), date:elements.purchaseDate.value || dateToday(), responsible, lines, total});
  // El costo unitario de la compra pasa a ser el último costo registrado para ese producto.
  lines.forEach(line => { const product = productById(line.productId); if (product) product.cost = String(line.unitCost); });
  persist();
  purchaseLines = [];
  newPurchaseLine();
  elements.purchaseFeedback.textContent = 'Compra guardada. Se actualizaron los costos de los productos incluidos.';
  renderPurchaseHistory(); renderPriceTable(); renderFirewoodTable();
}
function renderPurchaseHistory() {
  elements.purchaseHistoryBody.innerHTML = state.purchases.map(p => {
    const detail = p.lines.map(l => `${l.productName} × ${new Intl.NumberFormat('es-AR',{maximumFractionDigits:2}).format(l.quantity)} ${l.unit}`).join(', ');
    const date = p.date ? new Date(`${p.date}T12:00:00`).toLocaleDateString('es-AR') : '—';
    return `<tr><td>${esc(date)}</td><td>${esc(p.responsible)}</td><td><span class="history-detail">${esc(detail)}</span></td><td class="numeric suggested-price">${money(p.total)}</td><td><button type="button" class="row-action" data-delete-purchase="${esc(p.id)}" aria-label="Eliminar compra" title="Eliminar compra">×</button></td></tr>`;
  }).join('');
  elements.emptyPurchases.classList.toggle('hidden', state.purchases.length !== 0);
  elements.purchaseHistoryBody.closest('.table-scroll').classList.toggle('hidden', state.purchases.length === 0);
}
function deletePurchase(id) {
  if (!confirm('¿Eliminar esta compra del historial? Esta acción no cambia los costos actuales de los productos.')) return;
  state.purchases = state.purchases.filter(p => p.id !== id);
  persist(); renderPurchaseHistory();
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], {type});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportBackup() {
  const backup = {app:'Verdulería Blunno', exportedAt:new Date().toISOString(), data:state};
  downloadFile(`respaldo-verduleria-blunno-${dateToday()}.json`, JSON.stringify(backup,null,2), 'application/json;charset=utf-8');
}
function importBackup(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(String(reader.result || ''));
      const incoming = imported?.data || imported;
      if (!incoming || !Array.isArray(incoming.products) || !Array.isArray(incoming.responsibles) || !Array.isArray(incoming.purchases)) throw new Error('Estructura inválida');
      if (!confirm('Restaurar este respaldo reemplazará los datos actuales de esta página. ¿Querés continuar?')) return;
      const normalized = {
        version:1,
        responsibles:incoming.responsibles.map(r => ({id:String(r.id || makeId('resp')),name:String(r.name || '').trim()})).filter(r => r.name),
        products:incoming.products.map(p => ({id:String(p.id || makeId('prod')),name:String(p.name || 'Producto'),category:['Frutas','Verduras','Condimentos','Leña y carbón'].includes(p.category)?p.category:'Verduras',unit:UNIT_OPTIONS.includes(p.unit)?p.unit:'kg',cost:p.cost === '' || p.cost == null ? '' : parseAmount(p.cost),margin:Math.min(1000,parseAmount(p.margin ?? 40))})),
        purchases:incoming.purchases.map(p => ({id:String(p.id || makeId('buy')),date:String(p.date || dateToday()),responsible:String(p.responsible || 'Sin asignar'),lines:Array.isArray(p.lines)?p.lines.map(l=>({productId:String(l.productId || ''),productName:String(l.productName || 'Producto'),quantity:parseAmount(l.quantity),unit:UNIT_OPTIONS.includes(l.unit)?l.unit:'kg',unitCost:parseAmount(l.unitCost),subtotal:parseAmount(l.subtotal)})):[],total:parseAmount(p.total)})),
        selectedResponsibleId:incoming.selectedResponsibleId || null
      };
      if (!normalized.selectedResponsibleId || !normalized.responsibles.some(r => r.id === normalized.selectedResponsibleId)) normalized.selectedResponsibleId = normalized.responsibles[0]?.id || null;
      if (!normalized.products.length) throw new Error('El respaldo no contiene productos');
      state = normalized; persist();
      updateResponsiblePicker(); renderResponsibles(); renderPage();
      alert('Respaldo restaurado correctamente.');
    } catch (error) {
      alert('No se pudo restaurar el archivo. Verificá que sea un respaldo de Verdulería Blunno.');
      console.error(error);
    } finally { $('importBackupInput').value = ''; }
  };
  reader.onerror = () => alert('No se pudo leer el archivo seleccionado.');
  reader.readAsText(file);
}
function exportPurchasesCsv() {
  if (!state.purchases.length) { alert('Todavía no hay compras para exportar.'); return; }
  const rows = [['Fecha','Responsable','Producto','Cantidad','Unidad','Costo unitario','Subtotal','Total de compra']];
  state.purchases.forEach(p => p.lines.forEach(line => rows.push([p.date,p.responsible,line.productName,line.quantity,line.unit,line.unitCost,line.subtotal,p.total])));
  const csv = '\uFEFF' + rows.map(row => row.map(v => `"${String(v ?? '').replace(/"/g,'""')}"`).join(';')).join('\r\n');
  downloadFile(`compras-verduleria-blunno-${dateToday()}.csv`, csv, 'text/csv;charset=utf-8');
}

// Navegación y filtros
 document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => setPage(tab.dataset.page)));
elements.categoryFilters.addEventListener('click', event => {
  const button = event.target.closest('[data-category]'); if (!button) return;
  activeCategory = button.dataset.category;
  elements.categoryFilters.querySelectorAll('.filter-chip').forEach(chip => chip.classList.toggle('active', chip === button));
  renderPriceTable();
});
elements.productSearch.addEventListener('input', renderPriceTable);
elements.firewoodSearch.addEventListener('input', renderFirewoodTable);
elements.responsibleSelect.addEventListener('change', () => { state.selectedResponsibleId = elements.responsibleSelect.value || null; persist(); updateResponsiblePicker(); });
elements.manageResponsiblesBtn.addEventListener('click', () => { renderResponsibles(); elements.responsiblesDialog.showModal(); });
$('addProductBtn').addEventListener('click', () => openProductDialog(activeCategory === 'Todos' ? 'Frutas' : activeCategory));
$('addFirewoodBtn').addEventListener('click', () => openProductDialog('Leña y carbón'));
elements.productForm.addEventListener('submit', saveProductForm);
$('cancelProductBtn').addEventListener('click', () => elements.productDialog.close());
$('addResponsibleBtn').addEventListener('click', addResponsible);
elements.newResponsibleName.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); addResponsible(); } });
elements.responsiblesList.addEventListener('click', event => {
  const edit = event.target.closest('[data-edit-responsible]'); const del = event.target.closest('[data-delete-responsible]');
  if (edit) openEditResponsible(edit.dataset.editResponsible);
  if (del) deleteResponsible(del.dataset.deleteResponsible);
});
elements.editResponsibleForm.addEventListener('submit', saveResponsibleEdit);
$('cancelEditResponsibleBtn').addEventListener('click', () => elements.editResponsibleDialog.close());

// Cambios en las planillas de precios
function handleProductTableEvent(event) {
  const target = event.target;
  const edit = target.closest('[data-edit-product]'); const del = target.closest('[data-delete-product]');
  if (edit) { const product = productById(edit.dataset.editProduct); if (product) openProductDialog(product.category, product); return; }
  if (del) { deleteProduct(del.dataset.deleteProduct); return; }
  const field = target.dataset.field; const id = target.dataset.id;
  if (!field || !id) return;
  const product = productById(id); if (!product) return;
  if (field === 'unit') product.unit = target.value;
  if (field === 'cost') product.cost = target.value.trim() === '' ? '' : parseAmount(target.value);
  if (field === 'margin') product.margin = Math.min(1000, parseAmount(target.value));
  updateRowCalculation(id); persist();
}
elements.priceTableBody.addEventListener('input', handleProductTableEvent);
elements.priceTableBody.addEventListener('change', handleProductTableEvent);
elements.priceTableBody.addEventListener('click', handleProductTableEvent);
elements.firewoodTableBody.addEventListener('input', handleProductTableEvent);
elements.firewoodTableBody.addEventListener('change', handleProductTableEvent);
elements.firewoodTableBody.addEventListener('click', handleProductTableEvent);

// Planilla de compras
$('addPurchaseLineBtn').addEventListener('click', newPurchaseLine);
elements.purchaseLinesBody.addEventListener('change', event => {
  const field = event.target.dataset.lineField; const key = event.target.dataset.key;
  if (field && key) updatePurchaseLine(key, field, event.target.value);
});
elements.purchaseLinesBody.addEventListener('input', event => {
  const field = event.target.dataset.lineField; const key = event.target.dataset.key;
  if (field && key && field !== 'productId') updatePurchaseLine(key, field, event.target.value);
});
elements.purchaseLinesBody.addEventListener('click', event => {
  const remove = event.target.closest('[data-remove-line]');
  if (!remove) return;
  purchaseLines = purchaseLines.filter(line => line.key !== remove.dataset.removeLine);
  renderPurchaseLines();
});
$('savePurchaseBtn').addEventListener('click', savePurchase);
elements.purchaseHistoryBody.addEventListener('click', event => { const del = event.target.closest('[data-delete-purchase]'); if (del) deletePurchase(del.dataset.deletePurchase); });
$('exportPurchasesBtn').addEventListener('click', exportPurchasesCsv);
$('exportBackupBtn').addEventListener('click', exportBackup);
$('importBackupInput').addEventListener('change', event => importBackup(event.target.files?.[0]));

// Inicio
$('purchaseDate').value = dateToday();
updateResponsiblePicker();
newPurchaseLine();
renderPage();
