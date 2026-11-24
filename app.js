'use strict';

// Verdulería Blunno · versión local/offline. Conserva compatibilidad con la V1.
const STORAGE_KEY = 'verduleria-blunno-data-v1';
const UNIT_OPTIONS = ['kg', 'unidad', 'atado', 'bolsa', 'paquete', 'cajón', 'tonelada'];
const CATEGORIES = ['Frutas', 'Verduras', 'Condimentos', 'Leña y carbón'];
const DEFAULT_CATALOG = [
  ['Banana','Frutas','kg'],['Manzana roja','Frutas','kg'],['Manzana verde','Frutas','kg'],['Naranja','Frutas','kg'],['Mandarina','Frutas','kg'],['Pera','Frutas','kg'],['Durazno','Frutas','kg'],['Ciruela','Frutas','kg'],['Uva','Frutas','kg'],['Limón','Frutas','kg'],['Pomelo','Frutas','kg'],['Palta','Frutas','kg'],['Kiwi','Frutas','kg'],['Frutilla','Frutas','kg'],['Melón','Frutas','unidad'],['Sandía','Frutas','unidad'],['Ananá','Frutas','unidad'],
  ['Papa','Verduras','kg'],['Cebolla','Verduras','kg'],['Cebolla morada','Verduras','kg'],['Zanahoria','Verduras','kg'],['Tomate','Verduras','kg'],['Tomate perita','Verduras','kg'],['Lechuga','Verduras','unidad'],['Acelga','Verduras','atado'],['Espinaca','Verduras','atado'],['Zapallito','Verduras','kg'],['Zucchini','Verduras','kg'],['Zapallo','Verduras','kg'],['Calabaza','Verduras','kg'],['Berenjena','Verduras','kg'],['Morrón rojo','Verduras','kg'],['Morrón verde','Verduras','kg'],['Ajo','Verduras','unidad'],['Batata','Verduras','kg'],['Choclo','Verduras','unidad'],['Pepino','Verduras','kg'],['Brócoli','Verduras','kg'],['Coliflor','Verduras','unidad'],
  ['Perejil','Condimentos','atado'],['Cilantro','Condimentos','atado'],['Laurel','Condimentos','paquete'],['Orégano','Condimentos','paquete'],['Ají molido','Condimentos','paquete'],['Pimentón','Condimentos','paquete'],['Comino','Condimentos','paquete'],['Provenzal','Condimentos','paquete'],['Pimienta','Condimentos','paquete'],
  ['Leña','Leña y carbón','bolsa'],['Leña por kilo','Leña y carbón','kg'],['Carbón','Leña y carbón','bolsa'],['Carbón 3 kg','Leña y carbón','bolsa'],['Carbón 5 kg','Leña y carbón','bolsa'],['Carbón 10 kg','Leña y carbón','bolsa']
];

const makeId = (prefix = 'id') => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const clone = value => JSON.parse(JSON.stringify(value));
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

function parseAmount(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.max(0, value) : 0;
  let s = String(value ?? '').trim().replace(/\s/g, '').replace(/\$/g, '').replace(/[^\d,.-]/g, '');
  if (!s || s === '-' || s === ',' || s === '.') return 0;
  const comma = s.lastIndexOf(',');
  const dot = s.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) {
    // En formato argentino, el último separador suele ser el decimal: 1.234,56.
    if (comma > dot) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (comma >= 0) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (dot >= 0) {
    const parts = s.split('.');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) s = parts.join('');
  }
  const n = Number(s);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}
const money = value => '$ ' + new Intl.NumberFormat('es-AR', {minimumFractionDigits: 0, maximumFractionDigits: 2}).format(Number.isFinite(Number(value)) ? Number(value) : 0);
const numberFmt = value => new Intl.NumberFormat('es-AR', {maximumFractionDigits: 2}).format(Number(value) || 0);
const dateToday = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const formatDate = value => {
  if (!value) return '—';
  const d = new Date(`${value}T12:00:00`);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-AR');
};
const currentResponsibleName = () => state.responsibles.find(r => r.id === state.selectedResponsibleId)?.name || 'Sin asignar';

function freshData() {
  return {
    version: 2,
    responsibles: ['Luz','Flor','Agus','Nico'].map(name => ({id: makeId('resp'), name})),
    selectedResponsibleId: null,
    products: DEFAULT_CATALOG.map(([name, category, unit]) => ({id: makeId('prod'), name, category, unit, cost: '', margin: 40})),
    purchases: [],
    promotions: []
  };
}
function normalizeProduct(p) {
  const category = CATEGORIES.includes(p.category) ? p.category : 'Verduras';
  return {
    id: String(p.id || makeId('prod')),
    name: String(p.name || 'Producto').trim() || 'Producto',
    category,
    unit: UNIT_OPTIONS.includes(p.unit) ? p.unit : 'kg',
    cost: p.cost === '' || p.cost == null ? '' : parseAmount(p.cost),
    margin: Math.min(1000, parseAmount(p.margin ?? 40))
  };
}
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshData();
    const saved = JSON.parse(raw);
    if (!saved || !Array.isArray(saved.products) || !Array.isArray(saved.responsibles) || !Array.isArray(saved.purchases)) return freshData();
    const base = freshData();
    const responsibles = saved.responsibles.map(r => ({id: String(r.id || makeId('resp')), name: String(r.name || '').trim()})).filter(r => r.name);
    const purchases = saved.purchases.map(p => ({
      id: String(p.id || makeId('buy')),
      date: String(p.date || dateToday()),
      responsible: String(p.responsible || 'Sin asignar'),
      lines: Array.isArray(p.lines) ? p.lines.map(l => ({
        productId: String(l.productId || ''), productName: String(l.productName || 'Producto'),
        quantity: parseAmount(l.quantity), unit: UNIT_OPTIONS.includes(l.unit) ? l.unit : 'kg',
        unitCost: parseAmount(l.unitCost), subtotal: parseAmount(l.subtotal)
      })) : [],
      total: parseAmount(p.total)
    }));
    const promotions = Array.isArray(saved.promotions) ? saved.promotions.map(p => ({
      id: String(p.id || makeId('promo')), productId: String(p.productId || ''),
      promoPrice: parseAmount(p.promoPrice), startDate: String(p.startDate || ''), endDate: String(p.endDate || '')
    })).filter(p => p.productId && p.promoPrice > 0) : [];
    const selectedResponsibleId = responsibles.some(r => r.id === saved.selectedResponsibleId) ? saved.selectedResponsibleId : (responsibles[0]?.id || null);
    return {
      version: 2,
      responsibles,
      selectedResponsibleId,
      products: saved.products.length ? saved.products.map(normalizeProduct) : base.products,
      purchases,
      promotions
    };
  } catch (error) {
    console.warn('No se pudieron leer los datos guardados; se inicia una planilla nueva.', error);
    return freshData();
  }
}

let state = loadData();
if (!state.selectedResponsibleId && state.responsibles.length) state.selectedResponsibleId = state.responsibles[0].id;
let activePage = 'prices';
let activeCategory = 'Todos';
let purchaseLines = [];
let editingResponsibleId = null;
let saveStatusTimer = null;

const elements = {
  responsibleSelect: $('responsibleSelect'), manageResponsiblesBtn: $('manageResponsiblesBtn'),
  pageTitle: $('pageTitle'), pageSubtitle: $('pageSubtitle'), todayLabel: $('todayLabel'),
  pricesPage: $('pricesPage'), purchasesPage: $('purchasesPage'), firewoodPage: $('firewoodPage'), promotionsPage: $('promotionsPage'),
  priceTableBody: $('priceTableBody'), firewoodTableBody: $('firewoodTableBody'), promotionsTableBody: $('promotionsTableBody'),
  productCount: $('productCount'), firewoodCount: $('firewoodCount'), promotionCount: $('promotionCount'),
  emptyProducts: $('emptyProducts'), emptyFirewood: $('emptyFirewood'), emptyPromotions: $('emptyPromotions'),
  productSearch: $('productSearch'), firewoodSearch: $('firewoodSearch'), categoryFilters: $('categoryFilters'),
  productDialog: $('productDialog'), productForm: $('productForm'), productDialogTitle: $('productDialogTitle'), editingProductId: $('editingProductId'),
  newProductName: $('newProductName'), newProductCategory: $('newProductCategory'), newProductUnit: $('newProductUnit'), newProductCost: $('newProductCost'), newProductMargin: $('newProductMargin'),
  responsiblesDialog: $('responsiblesDialog'), responsiblesList: $('responsiblesList'), newResponsibleName: $('newResponsibleName'),
  purchaseDate: $('purchaseDate'), purchaseDateBadge: $('purchaseDateBadge'), purchaseResponsible: $('purchaseResponsible'), purchaseLinesBody: $('purchaseLinesBody'), purchaseTotal: $('purchaseTotal'),
  purchaseFeedback: $('purchaseFeedback'), purchaseHistoryBody: $('purchaseHistoryBody'), emptyPurchases: $('emptyPurchases'), purchaseCount: $('purchaseCount'),
  promotionDialog: $('promotionDialog'), promotionForm: $('promotionForm'), promotionDialogTitle: $('promotionDialogTitle'), editingPromotionId: $('editingPromotionId'),
  promotionProductSelect: $('promotionProductSelect'), promotionPriceInput: $('promotionPriceInput'), promotionStartDate: $('promotionStartDate'), promotionEndDate: $('promotionEndDate'), promotionFormHint: $('promotionFormHint')
};

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    document.querySelectorAll('.save-status').forEach(el => el.textContent = 'Cambios guardados');
    clearTimeout(saveStatusTimer);
    saveStatusTimer = setTimeout(() => document.querySelectorAll('.save-status').forEach(el => el.textContent = 'Guardado automático activado'), 1500);
    return true;
  } catch (error) {
    console.error('Error al guardar:', error);
    alert('No se pudieron guardar los cambios en este navegador. Descargá un respaldo y comprobá el espacio disponible.');
    return false;
  }
}
function productById(id) { return state.products.find(p => p.id === id) || null; }
function suggestedPrice(product) { return parseAmount(product.cost) * (1 + parseAmount(product.margin) / 100); }
function updateResponsiblePicker() {
  const selected = currentResponsibleName();
  elements.responsibleSelect.innerHTML = state.responsibles.length
    ? state.responsibles.map(r => `<option value="${esc(r.id)}" ${r.id === state.selectedResponsibleId ? 'selected' : ''}>${esc(r.name)}</option>`).join('')
    : '<option value="">Sin responsables cargados</option>';
  elements.responsibleSelect.disabled = !state.responsibles.length;
  elements.purchaseResponsible.textContent = selected;
}
function updatePurchaseDateLabel() {
  elements.purchaseDateBadge.textContent = formatDate(elements.purchaseDate.value);
}
function unitOptions(selected) { return UNIT_OPTIONS.map(u => `<option value="${esc(u)}" ${u === selected ? 'selected' : ''}>${esc(u)}</option>`).join(''); }
function actionButtons(id, type = 'product') {
  const attrEdit = type === 'promotion' ? 'data-edit-promotion' : 'data-edit-product';
  const attrDelete = type === 'promotion' ? 'data-delete-promotion' : 'data-delete-product';
  return `<div class="row-actions"><button class="row-edit" type="button" ${attrEdit}="${esc(id)}">Modificar</button><button class="row-delete" type="button" ${attrDelete}="${esc(id)}" aria-label="Eliminar" title="Eliminar">×</button></div>`;
}
function productRow(product, inFirewood = false) {
  const cost = product.cost === '' ? '' : parseAmount(product.cost);
  const price = suggestedPrice(product);
  const profit = price - parseAmount(product.cost);
  if (inFirewood) {
    return `<tr data-product-row="${esc(product.id)}">
      <td><span class="product-name">${esc(product.name)}</span></td>
      <td><select class="unit-select" data-field="unit" data-id="${esc(product.id)}" aria-label="Unidad de ${esc(product.name)}">${unitOptions(product.unit)}</select></td>
      <td class="numeric"><input class="table-input" type="text" inputmode="decimal" placeholder="Ingresar costo" aria-label="Costo de ${esc(product.name)}" data-field="cost" data-id="${esc(product.id)}" value="${cost === '' ? '' : esc(cost)}"></td>
      <td class="numeric"><input class="table-input percent" type="text" inputmode="decimal" aria-label="Ganancia de ${esc(product.name)}" data-field="margin" data-id="${esc(product.id)}" value="${esc(product.margin)}"></td>
      <td class="numeric suggested-price" data-price="${esc(product.id)}">${cost === '' ? '—' : money(price)}</td>
      <td class="numeric profit-value" data-profit="${esc(product.id)}">${cost === '' ? '—' : money(profit)}</td>
      <td>${actionButtons(product.id)}</td>
    </tr>`;
  }
  return `<tr data-product-row="${esc(product.id)}">
    <td><span class="product-name">${esc(product.name)}</span></td>
    <td><span class="product-category">${esc(product.category)}</span></td>
    <td><select class="unit-select" data-field="unit" data-id="${esc(product.id)}" aria-label="Unidad de ${esc(product.name)}">${unitOptions(product.unit)}</select></td>
    <td class="numeric"><input class="table-input" type="text" inputmode="decimal" placeholder="Ingresar costo" aria-label="Costo de ${esc(product.name)}" data-field="cost" data-id="${esc(product.id)}" value="${cost === '' ? '' : esc(cost)}"></td>
    <td class="numeric"><input class="table-input percent" type="text" inputmode="decimal" aria-label="Ganancia de ${esc(product.name)}" data-field="margin" data-id="${esc(product.id)}" value="${esc(product.margin)}"></td>
    <td class="numeric suggested-price" data-price="${esc(product.id)}">${cost === '' ? '—' : money(price)}</td>
    <td class="numeric profit-value" data-profit="${esc(product.id)}">${cost === '' ? '—' : money(profit)}</td>
    <td>${actionButtons(product.id)}</td>
  </tr>`;
}
function renderPriceTable() {
  const query = elements.productSearch.value.trim().toLocaleLowerCase('es');
  const products = state.products.filter(p => ['Frutas','Verduras','Condimentos'].includes(p.category)
    && (activeCategory === 'Todos' || p.category === activeCategory)
    && p.name.toLocaleLowerCase('es').includes(query));
  elements.priceTableBody.innerHTML = products.map(p => productRow(p)).join('');
  elements.emptyProducts.classList.toggle('hidden', products.length !== 0);
  $('priceTableScroll').classList.toggle('hidden', products.length === 0);
  elements.productCount.textContent = `${products.length} ${products.length === 1 ? 'producto' : 'productos'}`;
}
function renderFirewoodTable() {
  const query = elements.firewoodSearch.value.trim().toLocaleLowerCase('es');
  const products = state.products.filter(p => p.category === 'Leña y carbón' && p.name.toLocaleLowerCase('es').includes(query));
  elements.firewoodTableBody.innerHTML = products.map(p => productRow(p, true)).join('');
  elements.emptyFirewood.classList.toggle('hidden', products.length !== 0);
  elements.firewoodTableBody.closest('.table-scroll').classList.toggle('hidden', products.length === 0);
  elements.firewoodCount.textContent = `${products.length} ${products.length === 1 ? 'producto' : 'productos'}`;
}
function renderPage() {
  const config = {
    prices: ['Precios de productos', 'Costos, ganancias y precios de venta en un solo lugar.'],
    purchases: ['Compras', 'Registrá lo que entra y consultá el historial cuando lo necesites.'],
    firewood: ['Leña y carbón', 'Una lista independiente para sus costos y precios de venta.'],
    promotions: ['Promociones', 'Organizá las ofertas usando los productos de tu catálogo.']
  }[activePage];
  elements.pageTitle.textContent = config[0];
  elements.pageSubtitle.textContent = config[1];
  elements.pricesPage.classList.toggle('hidden', activePage !== 'prices');
  elements.purchasesPage.classList.toggle('hidden', activePage !== 'purchases');
  elements.firewoodPage.classList.toggle('hidden', activePage !== 'firewood');
  elements.promotionsPage.classList.toggle('hidden', activePage !== 'promotions');
  document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.page === activePage));
  updateResponsiblePicker();
  if (activePage === 'prices') renderPriceTable();
  if (activePage === 'purchases') { renderPurchaseLines(); renderPurchaseHistory(); updatePurchaseDateLabel(); }
  if (activePage === 'firewood') renderFirewoodTable();
  if (activePage === 'promotions') renderPromotions();
}
function setPage(page) {
  if (!['prices','purchases','firewood','promotions'].includes(page)) return;
  activePage = page;
  renderPage();
  window.scrollTo({top: 0, behavior: 'smooth'});
}
function updateRowCalculation(id) {
  const product = productById(id);
  if (!product) return;
  const priceCell = document.querySelector(`[data-price="${CSS.escape(id)}"]`);
  const profitCell = document.querySelector(`[data-profit="${CSS.escape(id)}"]`);
  if (priceCell) priceCell.textContent = product.cost === '' ? '—' : money(suggestedPrice(product));
  if (profitCell) profitCell.textContent = product.cost === '' ? '—' : money(suggestedPrice(product) - parseAmount(product.cost));
  if (activePage === 'promotions') renderPromotions();
}

// Alta y edición de productos: una sola ventana completa, con todos los campos editables.
function openProductDialog(category = 'Frutas', product = null) {
  elements.productForm.reset();
  elements.editingProductId.value = product?.id || '';
  elements.productDialogTitle.textContent = product ? 'Modificar producto' : 'Agregar producto';
  elements.newProductName.value = product?.name || '';
  elements.newProductCategory.value = product?.category || category;
  elements.newProductUnit.value = product?.unit || (category === 'Leña y carbón' ? 'bolsa' : 'kg');
  elements.newProductCost.value = product?.cost === '' || product?.cost == null ? '' : numberFmt(product.cost);
  elements.newProductMargin.value = String(product?.margin ?? 40);
  elements.productDialog.showModal();
  setTimeout(() => elements.newProductName.focus(), 50);
}
function saveProductForm(event) {
  event.preventDefault();
  const name = elements.newProductName.value.trim();
  const category = elements.newProductCategory.value;
  const unit = elements.newProductUnit.value;
  const costText = elements.newProductCost.value.trim();
  const marginText = elements.newProductMargin.value.trim();
  const margin = parseAmount(marginText);
  if (!name) { elements.newProductName.focus(); alert('Ingresá el nombre del producto.'); return; }
  if (!CATEGORIES.includes(category) || !UNIT_OPTIONS.includes(unit)) { alert('Revisá la categoría y la unidad.'); return; }
  if (margin > 1000) { alert('La ganancia no puede superar el 1000%.'); return; }
  const duplicate = state.products.find(p => p.name.toLocaleLowerCase('es') === name.toLocaleLowerCase('es') && p.category === category && p.id !== elements.editingProductId.value);
  if (duplicate) { alert('Ya existe un producto con ese nombre en esta categoría.'); return; }
  const editingId = elements.editingProductId.value;
  const next = {name, category, unit, cost: costText === '' ? '' : parseAmount(costText), margin};
  if (editingId) {
    const product = productById(editingId);
    if (!product) { alert('Ese producto ya no está en la lista.'); return; }
    Object.assign(product, next);
  } else {
    state.products.push({id: makeId('prod'), ...next});
  }
  persist();
  elements.productDialog.close();
  renderPriceTable(); renderFirewoodTable(); renderPromotions();
}
function deleteProduct(id) {
  const product = productById(id);
  if (!product) return;
  const hasPromo = state.promotions.some(p => p.productId === id);
  const extra = hasPromo ? ' También se quitará su promoción asociada.' : '';
  if (!confirm(`¿Eliminar “${product.name}” de la lista? Las compras ya guardadas conservarán sus datos.${extra}`)) return;
  state.products = state.products.filter(p => p.id !== id);
  state.promotions = state.promotions.filter(p => p.productId !== id);
  persist(); renderPriceTable(); renderFirewoodTable(); renderPromotions();
}

// Responsables: administración dentro del mismo cuadro, sin ventanas superpuestas.
function renderResponsibles() {
  elements.responsiblesList.innerHTML = state.responsibles.length ? state.responsibles.map(r => {
    if (editingResponsibleId === r.id) {
      return `<div class="responsible-item" data-responsible-item="${esc(r.id)}"><div class="responsible-edit"><input type="text" maxlength="40" value="${esc(r.name)}" data-responsible-edit-name="${esc(r.id)}" aria-label="Nuevo nombre para ${esc(r.name)}"><div class="responsible-actions"><button type="button" data-save-responsible="${esc(r.id)}">Guardar</button><button type="button" data-cancel-responsible="${esc(r.id)}">Cancelar</button></div></div></div>`;
    }
    const current = r.id === state.selectedResponsibleId ? '<span class="current-responsible-tag">En uso</span>' : '';
    return `<div class="responsible-item" data-responsible-item="${esc(r.id)}"><div class="responsible-name"><strong>${esc(r.name)}</strong>${current}</div><div class="responsible-actions"><button type="button" data-edit-responsible="${esc(r.id)}">Modificar</button><button class="delete" type="button" data-delete-responsible="${esc(r.id)}">Eliminar</button></div></div>`;
  }).join('') : '<div class="empty-responsibles">No hay responsables cargados. Agregá uno arriba para poder asignar las compras.</div>';
}
function addResponsible() {
  const name = elements.newResponsibleName.value.trim();
  if (!name) { elements.newResponsibleName.focus(); return; }
  if (state.responsibles.some(r => r.name.toLocaleLowerCase('es') === name.toLocaleLowerCase('es'))) { alert('Ese responsable ya está en la lista.'); return; }
  const responsible = {id: makeId('resp'), name};
  state.responsibles.push(responsible);
  state.selectedResponsibleId = responsible.id;
  elements.newResponsibleName.value = '';
  editingResponsibleId = null;
  persist(); updateResponsiblePicker(); renderResponsibles();
  elements.newResponsibleName.focus();
}
function beginResponsibleEdit(id) {
  if (!state.responsibles.some(r => r.id === id)) return;
  editingResponsibleId = id;
  renderResponsibles();
  const input = elements.responsiblesList.querySelector(`[data-responsible-edit-name="${CSS.escape(id)}"]`);
  input?.focus(); input?.select();
}
function saveResponsibleEdit(id) {
  const responsible = state.responsibles.find(r => r.id === id);
  const input = elements.responsiblesList.querySelector(`[data-responsible-edit-name="${CSS.escape(id)}"]`);
  const name = input?.value.trim() || '';
  if (!responsible || !name) { input?.focus(); return; }
  if (state.responsibles.some(r => r.id !== id && r.name.toLocaleLowerCase('es') === name.toLocaleLowerCase('es'))) { alert('Ya existe un responsable con ese nombre.'); input?.focus(); return; }
  responsible.name = name;
  editingResponsibleId = null;
  persist(); updateResponsiblePicker(); renderResponsibles();
}
function deleteResponsible(id) {
  const responsible = state.responsibles.find(r => r.id === id);
  if (!responsible) return;
  if (!confirm(`¿Eliminar a ${responsible.name} de la lista de responsables? El historial de compras conservará el nombre registrado.`)) return;
  state.responsibles = state.responsibles.filter(r => r.id !== id);
  if (state.selectedResponsibleId === id) state.selectedResponsibleId = state.responsibles[0]?.id || null;
  if (editingResponsibleId === id) editingResponsibleId = null;
  persist(); updateResponsiblePicker(); renderResponsibles();
}

// Compras: cada renglón empieza vacío, y se valida solamente al guardar.
function newPurchaseLine() {
  purchaseLines.push({key: makeId('line'), productId: '', quantity: '', unit: '', unitCost: ''});
  renderPurchaseLines();
}
function renderPurchaseLines() {
  if (!purchaseLines.length) {
    elements.purchaseLinesBody.innerHTML = '<tr><td colspan="6" class="muted">Agregá un renglón para comenzar la compra.</td></tr>';
  } else {
    const options = state.products.map(p => `<option value="${esc(p.id)}">${esc(p.name)} · ${esc(p.category)}</option>`).join('');
    elements.purchaseLinesBody.innerHTML = purchaseLines.map(line => {
      const subtotal = parseAmount(line.quantity) * parseAmount(line.unitCost);
      return `<tr data-line="${esc(line.key)}">
        <td><select class="purchase-product" data-line-field="productId" data-key="${esc(line.key)}"><option value="">Elegir producto…</option>${options}</select></td>
        <td class="numeric"><input class="purchase-number" type="text" inputmode="decimal" placeholder="Cantidad" data-line-field="quantity" data-key="${esc(line.key)}" value="${esc(line.quantity)}" aria-label="Cantidad"></td>
        <td class="purchase-unit" data-line-unit="${esc(line.key)}">${esc(line.unit || '—')}</td>
        <td class="numeric"><input class="purchase-number" type="text" inputmode="decimal" placeholder="Costo unitario" data-line-field="unitCost" data-key="${esc(line.key)}" value="${esc(line.unitCost)}" aria-label="Costo unitario"></td>
        <td class="numeric purchase-subtotal" data-line-subtotal="${esc(line.key)}">${money(subtotal)}</td>
        <td><div class="row-actions"><button class="row-delete" type="button" data-remove-line="${esc(line.key)}" aria-label="Quitar renglón" title="Quitar">×</button></div></td>
      </tr>`;
    }).join('');
    purchaseLines.forEach(line => {
      const select = elements.purchaseLinesBody.querySelector(`.purchase-product[data-key="${CSS.escape(line.key)}"]`);
      if (select) select.value = line.productId;
    });
  }
  updatePurchaseTotal();
}
function updatePurchaseTotal() {
  const total = purchaseLines.reduce((sum, line) => sum + parseAmount(line.quantity) * parseAmount(line.unitCost), 0);
  elements.purchaseTotal.textContent = money(total);
}
function updatePurchaseLine(key, field, value) {
  const line = purchaseLines.find(l => l.key === key);
  if (!line) return;
  line[field] = value;
  if (field === 'productId') {
    const product = productById(value);
    line.unit = product?.unit || '';
    line.unitCost = product && product.cost !== '' ? String(product.cost) : '';
    renderPurchaseLines();
    return;
  }
  const subtotal = parseAmount(line.quantity) * parseAmount(line.unitCost);
  const cell = elements.purchaseLinesBody.querySelector(`[data-line-subtotal="${CSS.escape(key)}"]`);
  if (cell) cell.textContent = money(subtotal);
  updatePurchaseTotal();
}
function setPurchaseFeedback(message, isError = false) {
  elements.purchaseFeedback.textContent = message;
  elements.purchaseFeedback.classList.toggle('error', isError);
}
function savePurchase() {
  if (!elements.purchaseDate.value) { setPurchaseFeedback('Ingresá la fecha de la compra.', true); elements.purchaseDate.focus(); return; }
  const populated = purchaseLines.filter(line => line.productId || String(line.quantity).trim() || String(line.unitCost).trim());
  if (!populated.length) { setPurchaseFeedback('Agregá al menos un producto para guardar la compra.', true); return; }
  const lines = [];
  for (let index = 0; index < populated.length; index++) {
    const line = populated[index];
    const product = productById(line.productId);
    const quantity = parseAmount(line.quantity);
    const unitCost = parseAmount(line.unitCost);
    if (!product) { setPurchaseFeedback(`En el renglón ${index + 1}, elegí un producto de la lista.`, true); return; }
    if (quantity <= 0) { setPurchaseFeedback(`En ${product.name}, ingresá una cantidad mayor que cero.`, true); return; }
    if (unitCost <= 0) { setPurchaseFeedback(`En ${product.name}, ingresá un costo unitario mayor que cero.`, true); return; }
    lines.push({productId: product.id, productName: product.name, quantity, unit: line.unit || product.unit, unitCost, subtotal: quantity * unitCost});
  }
  const total = lines.reduce((sum, line) => sum + line.subtotal, 0);
  state.purchases.unshift({id: makeId('buy'), date: elements.purchaseDate.value, responsible: currentResponsibleName(), lines, total});
  // La compra actualiza el costo habitual de los productos elegidos.
  lines.forEach(line => { const product = productById(line.productId); if (product) product.cost = line.unitCost; });
  if (!persist()) return;
  purchaseLines = [{key: makeId('line'), productId: '', quantity: '', unit: '', unitCost: ''}];
  renderPurchaseLines(); renderPurchaseHistory(); renderPriceTable(); renderFirewoodTable(); renderPromotions();
  setPurchaseFeedback('Compra guardada correctamente. Los costos de los productos se actualizaron.');
}
function renderPurchaseHistory() {
  elements.purchaseHistoryBody.innerHTML = state.purchases.map(p => {
    const detail = p.lines.map(l => `${l.productName} × ${numberFmt(l.quantity)} ${l.unit} · ${money(l.unitCost)}`).join('  |  ');
    return `<tr><td>${esc(formatDate(p.date))}</td><td>${esc(p.responsible)}</td><td><span class="history-detail">${esc(detail)}</span></td><td class="numeric history-total">${money(p.total)}</td><td><div class="row-actions"><button class="row-delete" type="button" data-delete-purchase="${esc(p.id)}" aria-label="Eliminar compra" title="Eliminar compra">×</button></div></td></tr>`;
  }).join('');
  elements.emptyPurchases.classList.toggle('hidden', state.purchases.length !== 0);
  elements.purchaseHistoryBody.closest('.table-scroll').classList.toggle('hidden', state.purchases.length === 0);
  elements.purchaseCount.textContent = `${state.purchases.length} ${state.purchases.length === 1 ? 'compra registrada' : 'compras registradas'}`;
}
function deletePurchase(id) {
  const purchase = state.purchases.find(p => p.id === id);
  if (!purchase) return;
  if (!confirm('¿Eliminar esta compra del historial? Los costos actuales de los productos no se modificarán.')) return;
  state.purchases = state.purchases.filter(p => p.id !== id);
  persist(); renderPurchaseHistory();
}

// Promociones: utiliza los productos existentes del catálogo principal.
function renderPromotions() {
  const promotions = state.promotions.map(p => ({...p, product: productById(p.productId)})).filter(p => p.product);
  elements.promotionsTableBody.innerHTML = promotions.map(p => {
    const normalPrice = suggestedPrice(p.product);
    const saving = Math.max(0, normalPrice - p.promoPrice);
    const period = p.startDate || p.endDate
      ? `${p.startDate ? formatDate(p.startDate) : 'Sin inicio'} – ${p.endDate ? formatDate(p.endDate) : 'Sin vencimiento'}`
      : 'Sin fecha definida';
    return `<tr><td><span class="product-name">${esc(p.product.name)}</span></td><td class="numeric">${p.product.cost === '' ? '—' : money(normalPrice)}</td><td class="numeric suggested-price">${money(p.promoPrice)}</td><td class="numeric promo-saving">${money(saving)}</td><td><span class="promo-period">${esc(period)}</span></td><td>${actionButtons(p.id, 'promotion')}</td></tr>`;
  }).join('');
  elements.emptyPromotions.classList.toggle('hidden', promotions.length !== 0);
  elements.promotionsTableBody.closest('.table-scroll').classList.toggle('hidden', promotions.length === 0);
  elements.promotionCount.textContent = `${promotions.length} ${promotions.length === 1 ? 'promoción' : 'promociones'}`;
}
function populatePromotionProducts(selectedId = '') {
  const currentPromotion = elements.editingPromotionId.value;
  const used = new Set(state.promotions.filter(p => p.id !== currentPromotion).map(p => p.productId));
  const available = state.products.filter(p => !used.has(p.id) || p.id === selectedId);
  elements.promotionProductSelect.innerHTML = '<option value="">Elegir producto…</option>' + available.map(p => `<option value="${esc(p.id)}">${esc(p.name)} · ${esc(p.category)}</option>`).join('');
  elements.promotionProductSelect.value = selectedId;
}
function openPromotionDialog(promotion = null) {
  elements.promotionForm.reset();
  elements.editingPromotionId.value = promotion?.id || '';
  elements.promotionDialogTitle.textContent = promotion ? 'Modificar promoción' : 'Nueva promoción';
  populatePromotionProducts(promotion?.productId || '');
  elements.promotionPriceInput.value = promotion ? numberFmt(promotion.promoPrice) : '';
  elements.promotionStartDate.value = promotion?.startDate || '';
  elements.promotionEndDate.value = promotion?.endDate || '';
  elements.promotionFormHint.textContent = 'El ahorro se calcula comparando el precio habitual con el precio promocional.';
  elements.promotionDialog.showModal();
  setTimeout(() => elements.promotionProductSelect.focus(), 50);
}
function savePromotionForm(event) {
  event.preventDefault();
  const productId = elements.promotionProductSelect.value;
  const product = productById(productId);
  const promoPrice = parseAmount(elements.promotionPriceInput.value);
  const startDate = elements.promotionStartDate.value;
  const endDate = elements.promotionEndDate.value;
  if (!product) { alert('Elegí un producto del catálogo.'); elements.promotionProductSelect.focus(); return; }
  if (promoPrice <= 0) { alert('Ingresá un precio promocional mayor que cero.'); elements.promotionPriceInput.focus(); return; }
  if (startDate && endDate && endDate < startDate) { alert('La fecha “Hasta” no puede ser anterior a “Desde”.'); elements.promotionEndDate.focus(); return; }
  const id = elements.editingPromotionId.value;
  if (id) {
    const existing = state.promotions.find(p => p.id === id);
    if (!existing) { alert('La promoción ya no está disponible.'); return; }
    Object.assign(existing, {productId, promoPrice, startDate, endDate});
  } else {
    if (state.promotions.some(p => p.productId === productId)) { alert('Ese producto ya tiene una promoción. Modificá la promoción existente.'); return; }
    state.promotions.push({id: makeId('promo'), productId, promoPrice, startDate, endDate});
  }
  persist(); elements.promotionDialog.close(); renderPromotions();
}
function deletePromotion(id) {
  const promo = state.promotions.find(p => p.id === id);
  const product = promo ? productById(promo.productId) : null;
  if (!promo) return;
  if (!confirm(`¿Eliminar la promoción${product ? ` de ${product.name}` : ''}? El producto seguirá en el catálogo.`)) return;
  state.promotions = state.promotions.filter(p => p.id !== id);
  persist(); renderPromotions();
}

// Exportación PDF propia, sin librerías externas ni conexión a internet.
// Genera un PDF real para descargar; funciona también cuando la página está abierta sin conexión.
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
function exportPricesPdf() {
  const products = state.products.filter(p => ['Frutas','Verduras','Condimentos'].includes(p.category));
  const rows = products.map(p => [p.name, p.category, p.unit, p.cost === '' ? 'Sin costo' : money(p.cost), `${numberFmt(p.margin)} %`, p.cost === '' ? '—' : money(suggestedPrice(p)), p.cost === '' ? '—' : money(suggestedPrice(p) - parseAmount(p.cost))]);
  if (!rows.length) rows.push(['Sin productos cargados','','','','','','']);
  buildPdf({title:'Lista de frutas, verduras y condimentos',subtitle:'Planilla completa de costos, ganancias y precios de venta',columns:[
    {label:'Producto',weight:2.05},{label:'Categoría',weight:1.05},{label:'Unidad',weight:.65},{label:'Costo de compra',weight:1.05,align:'right'},{label:'Ganancia sobre costo',weight:1.0,align:'right'},{label:'Precio de venta',weight:1.1,align:'right',emphasis:true},{label:'Ganancia',weight:.9,align:'right'}
  ],rows,filename:`blunno-productos-${dateToday()}.pdf`,summary:`Productos incluidos: ${products.length}`});
}
function exportFirewoodPdf() {
  const products = state.products.filter(p => p.category === 'Leña y carbón');
  const rows = products.map(p => [p.name,p.unit,p.cost === '' ? 'Sin costo' : money(p.cost),`${numberFmt(p.margin)} %`,p.cost === '' ? '—' : money(suggestedPrice(p)),p.cost === '' ? '—' : money(suggestedPrice(p) - parseAmount(p.cost))]);
  if (!rows.length) rows.push(['Sin productos cargados','','','','','']);
  buildPdf({title:'Leña y carbón',subtitle:'Planilla de costos, ganancias y precios de venta',columns:[
    {label:'Producto',weight:2.2},{label:'Unidad',weight:.8},{label:'Costo de compra',weight:1.2,align:'right'},{label:'Ganancia sobre costo',weight:1.1,align:'right'},{label:'Precio de venta',weight:1.2,align:'right',emphasis:true},{label:'Ganancia',weight:1,align:'right'}
  ],rows,filename:`blunno-lena-carbon-${dateToday()}.pdf`,summary:`Productos incluidos: ${products.length}`});
}
function exportPurchasesPdf() {
  const rows = state.purchases.map(p => {
    const detail = p.lines.map(l => `${l.productName} x ${numberFmt(l.quantity)} ${l.unit} a ${money(l.unitCost)}`).join(' | ');
    return [formatDate(p.date),p.responsible,detail,money(p.total)];
  });
  if (!rows.length) rows.push(['—','—','Todavía no hay compras registradas','—']);
  const grandTotal = state.purchases.reduce((sum,p) => sum + parseAmount(p.total),0);
  buildPdf({title:'Historial de compras',subtitle:'Detalle de compras registradas y responsables',columns:[
    {label:'Fecha',weight:1.0},{label:'Responsable',weight:1.1},{label:'Detalle de productos',weight:4.1},{label:'Total de compra',weight:1.15,align:'right',emphasis:true}
  ],rows,filename:`blunno-compras-${dateToday()}.pdf`,summary:`Compras registradas: ${state.purchases.length}    ·    Total acumulado: ${money(grandTotal)}`});
}
function exportPromotionsPdf() {
  const rows = state.promotions.map(p => {
    const product = productById(p.productId);
    if (!product) return null;
    const normal = product.cost === '' ? 0 : suggestedPrice(product);
    const period = p.startDate || p.endDate ? `${p.startDate ? formatDate(p.startDate) : 'Sin inicio'} al ${p.endDate ? formatDate(p.endDate) : 'Sin vencimiento'}` : 'Sin fecha definida';
    return [product.name,normal ? money(normal) : 'Sin costo',money(p.promoPrice),normal ? money(Math.max(0,normal-p.promoPrice)) : '—',period];
  }).filter(Boolean);
  if (!rows.length) rows.push(['Sin promociones','','','','']);
  buildPdf({title:'Promociones',subtitle:'Listado de productos con precio promocional y período de vigencia',columns:[
    {label:'Producto',weight:1.8},{label:'Precio habitual',weight:1.15,align:'right'},{label:'Precio promocional',weight:1.25,align:'right',emphasis:true},{label:'Ahorro',weight:.85,align:'right'},{label:'Vigencia',weight:1.8}
  ],rows,filename:`blunno-promociones-${dateToday()}.pdf`,summary:`Promociones cargadas: ${rows[0]?.[0] === 'Sin promociones' ? 0 : rows.length}`});
}

// Respaldo JSON: incluye absolutamente todos los datos editables.
function downloadFile(filename, content, type) {
  const blob = new Blob([content], {type});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
function exportBackup() {
  const backup = {app: 'Verdulería Blunno', version: 2, exportedAt: new Date().toISOString(), data: state};
  downloadFile(`respaldo-verduleria-blunno-${dateToday()}.json`, JSON.stringify(backup, null, 2), 'application/json;charset=utf-8');
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
      const normalizedResponsibles = incoming.responsibles.map(r => ({id: String(r.id || makeId('resp')), name: String(r.name || '').trim()})).filter(r => r.name);
      const normalized = {
        version: 2,
        responsibles: normalizedResponsibles,
        selectedResponsibleId: normalizedResponsibles.some(r => r.id === incoming.selectedResponsibleId) ? incoming.selectedResponsibleId : (normalizedResponsibles[0]?.id || null),
        products: incoming.products.map(normalizeProduct),
        purchases: incoming.purchases.map(p => ({id:String(p.id || makeId('buy')),date:String(p.date || dateToday()),responsible:String(p.responsible || 'Sin asignar'),lines:Array.isArray(p.lines)?p.lines.map(l=>({productId:String(l.productId || ''),productName:String(l.productName || 'Producto'),quantity:parseAmount(l.quantity),unit:UNIT_OPTIONS.includes(l.unit)?l.unit:'kg',unitCost:parseAmount(l.unitCost),subtotal:parseAmount(l.subtotal)})):[],total:parseAmount(p.total)})),
        promotions: Array.isArray(incoming.promotions) ? incoming.promotions.map(p => ({id:String(p.id || makeId('promo')),productId:String(p.productId || ''),promoPrice:parseAmount(p.promoPrice),startDate:String(p.startDate || ''),endDate:String(p.endDate || '')})).filter(p => p.productId && p.promoPrice > 0) : []
      };
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

// Eventos generales
function handleProductTableEvent(event) {
  const target = event.target;
  const edit = target.closest('[data-edit-product]');
  const del = target.closest('[data-delete-product]');
  if (edit) { const product = productById(edit.dataset.editProduct); if (product) openProductDialog(product.category, product); return; }
  if (del) { deleteProduct(del.dataset.deleteProduct); return; }
  const field = target.dataset.field;
  const id = target.dataset.id;
  if (!field || !id) return;
  const product = productById(id);
  if (!product) return;
  if (field === 'unit') product.unit = target.value;
  if (field === 'cost') product.cost = target.value.trim() === '' ? '' : parseAmount(target.value);
  if (field === 'margin') product.margin = Math.min(1000, parseAmount(target.value));
  updateRowCalculation(id);
  if (event.type === 'change') persist();
}

document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => setPage(tab.dataset.page)));
elements.categoryFilters.addEventListener('click', event => {
  const button = event.target.closest('[data-category]');
  if (!button) return;
  activeCategory = button.dataset.category;
  elements.categoryFilters.querySelectorAll('.filter-chip').forEach(chip => chip.classList.toggle('active', chip === button));
  renderPriceTable();
});
elements.productSearch.addEventListener('input', renderPriceTable);
elements.firewoodSearch.addEventListener('input', renderFirewoodTable);
elements.responsibleSelect.addEventListener('change', () => {
  state.selectedResponsibleId = elements.responsibleSelect.value || null;
  persist(); updateResponsiblePicker();
});
elements.manageResponsiblesBtn.addEventListener('click', () => { editingResponsibleId = null; renderResponsibles(); elements.responsiblesDialog.showModal(); });
$('closeResponsiblesDialogBtn').addEventListener('click', () => elements.responsiblesDialog.close());
$('doneResponsiblesBtn').addEventListener('click', () => elements.responsiblesDialog.close());
$('addResponsibleBtn').addEventListener('click', addResponsible);
elements.newResponsibleName.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); addResponsible(); } });
elements.responsiblesList.addEventListener('click', event => {
  const edit = event.target.closest('[data-edit-responsible]');
  const del = event.target.closest('[data-delete-responsible]');
  const save = event.target.closest('[data-save-responsible]');
  const cancel = event.target.closest('[data-cancel-responsible]');
  if (edit) beginResponsibleEdit(edit.dataset.editResponsible);
  if (del) deleteResponsible(del.dataset.deleteResponsible);
  if (save) saveResponsibleEdit(save.dataset.saveResponsible);
  if (cancel) { editingResponsibleId = null; renderResponsibles(); }
});
elements.responsiblesList.addEventListener('keydown', event => {
  if (event.key === 'Enter' && event.target.matches('[data-responsible-edit-name]')) {
    event.preventDefault(); saveResponsibleEdit(event.target.dataset.responsibleEditName);
  }
  if (event.key === 'Escape' && event.target.matches('[data-responsible-edit-name]')) { editingResponsibleId = null; renderResponsibles(); }
});

$('addProductBtn').addEventListener('click', () => openProductDialog(activeCategory === 'Todos' ? 'Frutas' : activeCategory));
$('addFirewoodBtn').addEventListener('click', () => openProductDialog('Leña y carbón'));
elements.productForm.addEventListener('submit', saveProductForm);
$('cancelProductBtn').addEventListener('click', () => elements.productDialog.close());
$('closeProductDialogBtn').addEventListener('click', () => elements.productDialog.close());
elements.priceTableBody.addEventListener('input', handleProductTableEvent);
elements.priceTableBody.addEventListener('change', handleProductTableEvent);
elements.priceTableBody.addEventListener('click', handleProductTableEvent);
elements.firewoodTableBody.addEventListener('input', handleProductTableEvent);
elements.firewoodTableBody.addEventListener('change', handleProductTableEvent);
elements.firewoodTableBody.addEventListener('click', handleProductTableEvent);

$('addPurchaseLineBtn').addEventListener('click', newPurchaseLine);
elements.purchaseLinesBody.addEventListener('change', event => {
  const field = event.target.dataset.lineField;
  const key = event.target.dataset.key;
  if (field && key) updatePurchaseLine(key, field, event.target.value);
});
elements.purchaseLinesBody.addEventListener('input', event => {
  const field = event.target.dataset.lineField;
  const key = event.target.dataset.key;
  if (field && key && field !== 'productId') updatePurchaseLine(key, field, event.target.value);
});
elements.purchaseLinesBody.addEventListener('click', event => {
  const remove = event.target.closest('[data-remove-line]');
  if (!remove) return;
  purchaseLines = purchaseLines.filter(line => line.key !== remove.dataset.removeLine);
  renderPurchaseLines();
});
$('savePurchaseBtn').addEventListener('click', savePurchase);
elements.purchaseDate.addEventListener('change', updatePurchaseDateLabel);
elements.purchaseHistoryBody.addEventListener('click', event => { const del = event.target.closest('[data-delete-purchase]'); if (del) deletePurchase(del.dataset.deletePurchase); });

$('addPromotionBtn').addEventListener('click', () => openPromotionDialog());
elements.promotionForm.addEventListener('submit', savePromotionForm);
$('closePromotionDialogBtn').addEventListener('click', () => elements.promotionDialog.close());
$('cancelPromotionBtn').addEventListener('click', () => elements.promotionDialog.close());
elements.promotionsTableBody.addEventListener('click', event => {
  const edit = event.target.closest('[data-edit-promotion]');
  const del = event.target.closest('[data-delete-promotion]');
  if (edit) { const promo = state.promotions.find(p => p.id === edit.dataset.editPromotion); if (promo) openPromotionDialog(promo); }
  if (del) deletePromotion(del.dataset.deletePromotion);
});

$('exportPricesPdfBtn').addEventListener('click', exportPricesPdf);
$('exportPurchasesPdfBtn').addEventListener('click', exportPurchasesPdf);
$('exportFirewoodPdfBtn').addEventListener('click', exportFirewoodPdf);
$('exportPromotionsPdfBtn').addEventListener('click', exportPromotionsPdf);
$('exportBackupBtn').addEventListener('click', exportBackup);
$('importBackupInput').addEventListener('change', event => importBackup(event.target.files?.[0]));

// Inicio
$('todayLabel').textContent = new Date().toLocaleDateString('es-AR', {day:'2-digit', month:'short', year:'numeric'});
elements.purchaseDate.value = dateToday();
purchaseLines = [{key: makeId('line'), productId: '', quantity: '', unit: '', unitCost: ''}];
updateResponsiblePicker();
renderPage();
