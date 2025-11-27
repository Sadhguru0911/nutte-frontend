/* Full frontend JS (Option A) for CommunitE
   - Uses existing backend API (apiBase)
   - Renders hero, categories, subcategories, products
   - Cart + checkout + mobile lookup preserved
*/

const apiBase = "https://nutte-communite-994718298855.asia-south1.run.app"; // your backend base
const DELIVERY_CHARGE = 50;

let cart = [];
let selectedCategory = null;
let selectedSubcategory = null;

/* --- Fallback images in case backend doesn't return images --- */
const DEFAULT_CATEGORY_IMAGE = "https://images.unsplash.com/photo-1508747703725-7191f1cdea6b?q=80&w=1400&auto=format&fit=crop&crop=faces";
const DEFAULT_SUBCATEGORY_IMAGE = "https://images.unsplash.com/photo-1503602642458-232111445657?q=80&w=1200&auto=format&fit=crop&crop=faces";
const DEFAULT_PRODUCT_IMAGE = "assets/placeholder.png";

/* --- Generic API caller --- */
async function apiCall(endpoint, options = {}) {
  try {
    const res = await fetch(`${apiBase}/api${endpoint}`, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || res.statusText);
    }
    return await res.json();
  } catch (err) {
    console.error("API error:", err);
    throw err;
  }
}

/* --- DOM Helper --- */
function $(id){ return document.getElementById(id); }
function escapeHtml(s){ if(s===undefined||s===null) return ''; return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function scrollToSection(id){ const el=$(id); if(el) el.scrollIntoView({behavior:'smooth', block:'start'}); }

/* --- Boot --- */
document.addEventListener("DOMContentLoaded", () => {
  bindUI();
  loadCategories();
});

/* --- Bind top UI actions --- */
function bindUI(){
  $('openCartBtn').addEventListener('click', toggleCart);
  $('closeCartBtn').addEventListener('click', toggleCart);
  $('checkoutBtn').addEventListener('click', proceedToCheckout);
  $('backToCategoriesBtn').addEventListener('click', goBackToCategories);
  $('lookupBtn').addEventListener('click', lookupCustomerFromModal);
  $('closeCustomerModalBtn').addEventListener('click', closeCustomerModal);
  $('customerForm').addEventListener('submit', submitOrder);
}

/* ------------------ CATEGORIES ------------------ */
async function loadCategories(){
  try {
    const res = await apiCall('/categories');
    // Expecting res.categories = [ { name, image? }, ... ]
    const cats = res.categories || [];
    const container = $('categoryContainer');

    if(cats.length === 0){
      container.innerHTML = `<div style="padding:16px;color:var(--muted)">No categories available.</div>`;
      return;
    }

    container.innerHTML = cats.map(c => `
      <div class="category-card" onclick="selectCategory('${escapeHtml(c.name)}')">
        <img src="${escapeHtml(c.image) || DEFAULT_CATEGORY_IMAGE}" alt="${escapeHtml(c.name)}">
        <div class="category-card-title">${escapeHtml(c.name)}</div>
      </div>
    `).join('');
  } catch (e) {
    console.error(e);
    $('categoryContainer').innerHTML = `<div style="padding:16px;color:var(--muted)">Failed to load categories</div>`;
  }
}

async function selectCategory(category){
  selectedCategory = category;
  selectedSubcategory = null;
  $('subcategorySection').style.display = 'block';
  $('productSection').style.display = 'none';
  $('subcategoryTitle').innerText = category;
  $('backToCategoriesBtn').style.display = 'inline-flex';

  try {
    const res = await apiCall(`/subcategories/${encodeURIComponent(category)}`);
    const subs = res.subcategories || [];
    const container = $('subcategoryContainer');

    if(subs.length === 0){
      container.innerHTML = `<div style="padding:16px;color:var(--muted)">No subcategories available.</div>`;
      return;
    }

    container.innerHTML = subs.map(s => `
      <div class="subcat-card" onclick="selectSubcategory('${escapeHtml(category)}','${escapeHtml(s.name)}')">
        <img src="${escapeHtml(s.image) || DEFAULT_SUBCATEGORY_IMAGE}" alt="${escapeHtml(s.name)}" />
        <div class="subcat-title">${escapeHtml(s.name)}</div>
      </div>
    `).join('');
    scrollToSection('subcategorySection');
  } catch (e) {
    console.error(e);
    $('subcategoryContainer').innerHTML = `<div style="padding:16px;color:var(--muted)">Failed to load subcategories</div>`;
  }
}

/* ------------------ PRODUCTS ------------------ */
async function selectSubcategory(category, subcat){
  selectedSubcategory = subcat;
  $('productSection').style.display = 'block';
  $('productTitle').innerText = subcat;

  try {
    const res = await apiCall(`/products/${encodeURIComponent(category)}/${encodeURIComponent(subcat)}`);
    const products = res.products || [];

    if(products.length === 0){
      $('productContainer').innerHTML = `<div style="padding:16px;color:var(--muted)">No products found.</div>`;
      return;
    }

    // Group by product_name
    const grouped = {};
    products.forEach(p => {
      const key = p.product_name;
      if(!grouped[key]) grouped[key] = [];
      grouped[key].push(p);
    });

    const container = $('productContainer');
    container.innerHTML = Object.keys(grouped).map((name, index) => {
      const variants = grouped[name];
      const first = variants[0];
      const unique = `prod_${index}_${sanitizeId(name)}`;
      const img = first.image || DEFAULT_PRODUCT_IMAGE;
      return `
        <div class="product-card" id="${unique}">
          <img src="${escapeHtml(img)}" alt="${escapeHtml(name)}" />
          <div class="product-title">${escapeHtml(name)}</div>
          <div class="product-desc">${escapeHtml(first.description || '')}</div>

          <div class="controls-row">
            <select class="variant-select" id="variant_${unique}" onchange="updateProductDisplay('${unique}')">
              ${variants.map(v => `<option value="${escapeHtml(v.variant)}" data-price="${v.price}" data-img="${escapeHtml(v.image||'')}" data-desc="${escapeHtml(v.description||'')}">${escapeHtml(v.variant)} - ₹${v.price}</option>`).join('')}
            </select>

            <div class="qty-control" style="margin-left:8px">
              <button onclick="changeQuantity('${unique}', -1)">-</button>
              <input id="qty_${unique}" type="number" value="1" min="1" />
              <button onclick="changeQuantity('${unique}', 1)">+</button>
            </div>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;">
            <div class="product-price" id="price_${unique}">₹${variants[0].price}</div>
            <button class="add-btn" onclick="addToCartFromCard('${unique}','${escapeJs(name)}')"><i class="fas fa-cart-plus"></i> Add</button>
          </div>
        </div>
      `;
    }).join('');

    scrollToSection('productSection');
  } catch (e) {
    console.error(e);
    $('productContainer').innerHTML = `<div style="padding:16px;color:var(--muted)">Failed to load products</div>`;
  }
}

function updateProductDisplay(unique){
  const select = $(`variant_${unique}`);
  if(!select) return;
  const opt = select.options[select.selectedIndex];
  const price = opt.dataset.price;
  const img = opt.dataset.img;
  const desc = opt.dataset.desc;

  const priceEl = $(`price_${unique}`);
  if(priceEl) priceEl.textContent = `₹${price}`;

  const imgEl = document.querySelector(`#${unique} img`);
  if(imgEl && img) imgEl.src = img;
  const descEl = document.querySelector(`#${unique} .product-desc`);
  if(descEl) descEl.textContent = desc || '';
}

function changeQuantity(unique, delta){
  const input = $(`qty_${unique}`);
  if(!input) return;
  let v = parseInt(input.value||'1',10);
  v = Math.max(1, Math.min(99, v + delta));
  input.value = v;
}

/* ------------------ CART ------------------ */
function addToCartFromCard(uniqueId, productName){
  const select = $(`variant_${uniqueId}`);
  const qty = parseInt($(`qty_${uniqueId}`).value || '1',10);
  const variant = select.value;
  const price = parseFloat(select.options[select.selectedIndex].dataset.price || 0);

  addToCart(productName, variant, price, qty);
  showCartToast(`${qty} x ${productName} (${variant}) added`);
}

function addToCart(product_name, variant, price, quantity){
  const idx = cart.findIndex(i => i.product_name === product_name && i.variant === variant);
  if(idx > -1){
    cart[idx].quantity += quantity;
    cart[idx].total_price = cart[idx].price * cart[idx].quantity;
  } else {
    cart.push({product_name, variant, price, quantity, total_price: price * quantity});
  }
  renderCart();
}

function removeFromCart(index){
  cart.splice(index,1);
  renderCart();
}

function updateCartQuantity(index, qty){
  if(qty <= 0) return removeFromCart(index);
  cart[index].quantity = qty;
  cart[index].total_price = cart[index].price * qty;
  renderCart();
}

function renderCart(){
  const count = cart.reduce((s,i)=>s+i.quantity,0);
  $('cartCount').textContent = count;
  const container = $('cartContent');
  const footer = $('cartFooter');

  if(cart.length === 0){
    container.innerHTML = `<div class="empty-cart"><i class="fas fa-shopping-cart"></i><p>Your cart is empty</p><small>Add items to get started</small></div>`;
    footer.style.display = 'none';
  } else {
    container.innerHTML = cart.map((it, idx) => `
      <div class="cart-item">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div class="name">${escapeHtml(it.product_name)}</div>
          <button class="close-btn" onclick="removeFromCart(${idx})">&times;</button>
        </div>
        <div class="meta">${escapeHtml(it.variant)}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
          <div>
            <button class="btn-secondary" onclick="updateCartQuantity(${idx}, ${it.quantity - 1})">-</button>
            <span style="padding:0 8px;font-weight:700">${it.quantity}</span>
            <button class="btn-secondary" onclick="updateCartQuantity(${idx}, ${it.quantity + 1})">+</button>
          </div>
          <div style="font-weight:800">₹${it.total_price}</div>
        </div>
      </div>
    `).join('');
    footer.style.display = 'block';
    const subtotal = cart.reduce((s,i)=>s+i.total_price,0);
    const total = subtotal + (subtotal > 0 ? DELIVERY_CHARGE : 0);
    $('cartSubtotal').textContent = subtotal;
    $('cartTotal').textContent = total;
    $('deliveryCharge').textContent = DELIVERY_CHARGE;
  }
}

function toggleCart(){
  const sidebar = $('cartSidebar');
  const overlay = $('overlay');
  if(sidebar.classList.contains('open')){
    sidebar.classList.remove('open');
    overlay.style.display = 'none';
  } else {
    sidebar.classList.add('open');
    overlay.style.display = 'block';
  }
}

/* ------------------ CHECKOUT / CUSTOMER LOOKUP ------------------ */
function proceedToCheckout(){
  if(cart.length === 0){ alert('Your cart is empty!'); return; }
  toggleCart();
  openCustomerModal();
}

function openCustomerModal(){
  $('overlay').style.display = 'block';
  $('customerModal').style.display = 'block';
  $('mobileLookupRow').style.display = 'block';
  $('customerForm').style.display = 'none';
  $('lookupResult').style.display = 'none';
}

function closeCustomerModal(){
  $('overlay').style.display = 'none';
  $('customerModal').style.display = 'none';
}

async function lookupCustomerFromModal(){
  const mobile = ($('lookupMobile').value || '').trim();
  if(!/^\d{10}$/.test(mobile)){ alert('Please enter a valid 10-digit mobile number'); return; }
  try {
    const res = await apiCall(`/customer/${mobile}`);
    if(res.found){
      const c = res.customer;
      $('customerForm').style.display = 'block';
      $('mobileLookupRow').style.display = 'none';
      $('fullName').value = c.full_name || '';
      $('mobileNumber').value = c.mobile_number || '';
      $('email').value = c.email || '';
      $('aptNumber').value = c.apt_number || '';
      $('community').value = c.community || '';
      $('deliveryInstructions').value = c.delivery_instructions || '';
    } else {
      $('customerForm').style.display = 'block';
      $('mobileLookupRow').style.display = 'none';
      $('mobileNumber').value = mobile;
      $('fullName').value = '';
      $('email').value = '';
      $('aptNumber').value = '';
      $('community').value = '';
      $('deliveryInstructions').value = '';
    }
  } catch (e) {
    alert('Error looking up customer. Please try again.');
  }
}

async function submitOrder(e){
  e.preventDefault();
  const fullName = $('fullName').value.trim();
  const mobileNumber = $('mobileNumber').value.trim();
  const email = $('email').value.trim();
  const aptNumber = $('aptNumber').value.trim();
  const community = $('community').value.trim();
  const deliveryInstructions = $('deliveryInstructions').value.trim();

  if(!fullName || !mobileNumber || !email || !aptNumber || !community){ alert('Please fill all required fields'); return; }

  const order = {
    customer: {
      full_name: fullName,
      mobile_number: mobileNumber,
      email: email,
      apt_number: aptNumber,
      community: community
    },
    cart,
    subtotal: cart.reduce((s,i)=>s+i.total_price,0),
    delivery_charge: DELIVERY_CHARGE,
    total_amount: cart.reduce((s,i)=>s+i.total_price,0) + DELIVERY_CHARGE,
    delivery_instructions: deliveryInstructions || ''
  };

  try {
    const resp = await apiCall('/submit-order', {
      method: 'POST',
      body: JSON.stringify(order)
    });

    if(resp.success){
      alert(`Order submitted! Order ID: ${resp.order_id}`);
      cart = [];
      renderCart();
      closeCustomerModal();
      // close cart if open
      const sidebar = $('cartSidebar');
      if(sidebar.classList.contains('open')) toggleCart();
    } else {
      alert('Could not submit order: ' + (resp.message || 'Unknown error'));
    }
  } catch (e) {
    alert('Error submitting order. Try again later.');
  }
}

/* ------------------ NAV helpers ------------------ */
function goBackToCategories(){
  selectedCategory = null;
  selectedSubcategory = null;
  $('subcategorySection').style.display = 'none';
  $('productSection').style.display = 'none';
  $('backToCategoriesBtn').style.display = 'none';
  scrollToSection('categorySection');
}

/* ------------------ small helpers ------------------ */
function sanitizeId(s){ return (s||'').replace(/[^a-z0-9]/gi,'_').toLowerCase(); }
function escapeJs(s){ return (s||'').replace(/'/g,"\\'").replace(/"/g,'\\"'); }

function showCartToast(msg){
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;right:18px;bottom:110px;background:#28a745;color:#fff;padding:12px;border-radius:8px;z-index:2000;box-shadow:0 6px 18px r
