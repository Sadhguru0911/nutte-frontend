/* CommunitE — Refined Frontend JS
   Matches new editorial HTML/CSS layout
*/

const apiBase = "https://nutte-communite-994718298855.asia-south1.run.app";
const DELIVERY_CHARGE = 50;

let cart = [];
let selectedCategory = null;
let selectedSubcategory = null;

/* fallback images */
const DEFAULT_CATEGORY_IMAGE = "https://images.unsplash.com/photo-1488459716781-31db52582fe9?q=80&w=800&auto=format&fit=crop";
const DEFAULT_SUBCATEGORY_IMAGE = "https://images.unsplash.com/photo-1490818387583-1baba5e638af?q=80&w=800&auto=format&fit=crop";
const DEFAULT_PRODUCT_IMAGE = "assets/placeholder.png";

/* helpers */
const $ = id => document.getElementById(id);
const escapeHtml = s => (s || "").toString().replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function sanitizeId(s) { return (s || '').replace(/[^a-z0-9]/gi, '_').toLowerCase(); }
function scrollToSection(id) { const el = $(id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }

/* API */
async function apiCall(endpoint, options = {}) {
  const res = await fetch(`${apiBase}/api${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/* boot */
document.addEventListener('DOMContentLoaded', () => {
  bindUI();
  loadCategories();
  initScrollAnimations();
  // About modal close button
  const closeAboutBtn = document.getElementById('closeAboutBtn');
  if (closeAboutBtn) closeAboutBtn.addEventListener('click', closeAbout);
});

/* UI bind */
function bindUI() {
  $('openCartBtn').addEventListener('click', toggleCart);
  $('closeCartBtn').addEventListener('click', toggleCart);
  $('checkoutBtn').addEventListener('click', proceedToCheckout);
  $('backToCategoriesBtn').addEventListener('click', goBackToCategories);
  $('lookupBtn').addEventListener('click', lookupCustomerFromModal);
  $('closeCustomerModalBtn').addEventListener('click', closeCustomerModal);
  $('customerForm').addEventListener('submit', submitOrder);
  $('overlay').addEventListener('click', () => {
    if ($('cartSidebar').classList.contains('open')) toggleCart();
    if ($('customerModal').style.display !== 'none') closeCustomerModal();
    if ($('aboutModal') && $('aboutModal').style.display !== 'none') closeAbout();
  });
}

/* categories */
async function loadCategories() {
  try {
    const res = await apiCall('/categories');
    let cats = [];
    if (Array.isArray(res)) {
      cats = res.map(c => (typeof c === 'string') ? { name: c, image: DEFAULT_CATEGORY_IMAGE } : { name: c.name || c.title, image: c.image || DEFAULT_CATEGORY_IMAGE });
    } else if (Array.isArray(res.categories)) {
      cats = res.categories.map(c => (typeof c === 'string') ? { name: c, image: DEFAULT_CATEGORY_IMAGE } : { name: c.name || c.title, image: c.image || DEFAULT_CATEGORY_IMAGE });
    } else {
      cats = Object.values(res).flat().map(c => (typeof c === 'string') ? { name: c, image: DEFAULT_CATEGORY_IMAGE } : { name: c.name || c.title, image: c.image || DEFAULT_CATEGORY_IMAGE });
    }

    if (!cats.length) {
      $('categoryContainer').innerHTML = `<div style="padding:20px;color:var(--muted)">No categories found</div>`;
      return;
    }

    const container = $('categoryContainer');
    container.innerHTML = cats.map((c, i) => `
      <div class="category-card" style="animation-delay:${i * 70}ms" onclick="selectCategory('${escapeHtml(c.name)}')">
        <img src="${escapeHtml(c.image)}" alt="${escapeHtml(c.name)}" loading="lazy" />
        <div class="category-card-title">${escapeHtml(c.name)}</div>
      </div>
    `).join('');
    container.querySelectorAll('.category-card').forEach(el => observeCard(el));
  } catch (e) {
    console.error("loadCategories", e);
    $('categoryContainer').innerHTML = `<div style="padding:20px;color:var(--muted)">Failed to load categories. Please try again.</div>`;
  }
}

/* subcategories */
async function selectCategory(category) {
  selectedCategory = category;
  selectedSubcategory = null;
  $('subcategorySection').style.display = 'block';
  $('productSection').style.display = 'none';
  $('subcategoryTitle').innerText = category;
  $('backToCategoriesBtn').style.display = 'inline-flex';
  try {
    const res = await apiCall(`/subcategories/${encodeURIComponent(category)}`);
    let subs = res.subcategories || [];
    if (Array.isArray(res)) subs = res;
    const container = $('subcategoryContainer');
    container.innerHTML = subs.map((s, i) => {
      const name = typeof s === 'string' ? s : s.name;
      const img = typeof s === 'string' ? DEFAULT_SUBCATEGORY_IMAGE : (s.image || DEFAULT_SUBCATEGORY_IMAGE);
      return `
        <div class="subcat-card" style="animation-delay:${i * 70}ms" onclick="selectSubcategory('${escapeHtml(category)}','${escapeHtml(name)}')">
          <img src="${escapeHtml(img)}" alt="${escapeHtml(name)}" loading="lazy" />
          <div class="subcat-title">${escapeHtml(name)}</div>
        </div>
      `;
    }).join('');
    container.querySelectorAll('.subcat-card').forEach(el => observeCard(el));
    scrollToSection('subcategorySection');
  } catch (e) {
    console.error("selectCategory", e);
    $('subcategoryContainer').innerHTML = `<div style="padding:20px;color:var(--muted)">No subcategories found</div>`;
  }
}

/* products */
async function selectSubcategory(category, subcat) {
  selectedSubcategory = subcat;
  $('productSection').style.display = 'block';
  $('productTitle').innerText = subcat;
  try {
    const res = await apiCall(`/products/${encodeURIComponent(category)}/${encodeURIComponent(subcat)}`);
    const products = res.products || (Array.isArray(res) ? res : []);
    if (products.length === 0) {
      $('productContainer').innerHTML = `<div style="padding:20px;color:var(--muted)">No products found.</div>`;
      return;
    }

    const grouped = {};
    products.forEach(p => {
      const key = p.product_name || p['Product Name'];
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(p);
    });

    const container = $('productContainer');
    container.innerHTML = Object.keys(grouped).map((name, i) => {
      const variants = grouped[name];
      const first = variants[0];
      const id = `prod_${sanitizeId(name)}_${i}`;
      const img = first.image || first.Image || DEFAULT_PRODUCT_IMAGE;
      const firstPrice = first.price || first['Price (INR)'] || 0;

      return `
        <div class="product-card" id="${id}" style="animation-delay:${i * 70}ms">
          <img src="${escapeHtml(img)}" alt="${escapeHtml(name)}" loading="lazy" />
          <div class="product-card-body">
            <div class="product-title">${escapeHtml(name)}</div>
            <div class="product-desc">${escapeHtml(first.description || first['Product Description'] || '')}</div>
            <div class="controls-row">
              <select class="variant-select" id="variant_${id}" onchange="updateProductDisplay('${id}')">
                ${variants.map(v => {
                  const variant = v.variant || v['Variant/Weight'] || 'Default';
                  const price = v.price || v['Price (INR)'] || v.Price || 0;
                  const vimg = v.image || v.Image || '';
                  const desc = v.description || v['Product Description'] || '';
                  return `<option value="${escapeHtml(variant)}" data-price="${price}" data-img="${escapeHtml(vimg)}" data-desc="${escapeHtml(desc)}">${escapeHtml(variant)} — ₹${price}</option>`;
                }).join('')}
              </select>
              <div class="qty-control">
                <button onclick="changeQuantity('${id}', -1)">−</button>
                <input id="qty_${id}" type="number" value="1" min="1" />
                <button onclick="changeQuantity('${id}', 1)">+</button>
              </div>
            </div>
          </div>
          <div class="product-card-footer">
            <div class="product-price" id="price_${id}">₹${firstPrice}</div>
            <button class="add-btn" onclick="addToCartFromCard('${id}','${escapeHtml(name)}')">
              <i class="fas fa-cart-plus"></i> Add
            </button>
          </div>
        </div>
      `;
    }).join('');
    container.querySelectorAll('.product-card').forEach(el => observeCard(el));
    scrollToSection('productSection');
  } catch (e) {
    console.error("selectSubcategory", e);
    $('productContainer').innerHTML = `<div style="padding:20px;color:var(--muted)">Error loading products</div>`;
  }
}

/* update display for variant selection */
function updateProductDisplay(unique) {
  const select = $(`variant_${unique}`);
  if (!select) return;
  const opt = select.options[select.selectedIndex];
  const price = opt.dataset.price;
  const img = opt.dataset.img;
  const desc = opt.dataset.desc;
  const priceEl = $(`price_${unique}`);
  if (priceEl) priceEl.textContent = `₹${price}`;
  const imgEl = document.querySelector(`#${unique} img`);
  if (imgEl && img) imgEl.src = img;
  const descEl = document.querySelector(`#${unique} .product-desc`);
  if (descEl && desc !== undefined) descEl.textContent = desc;
}

/* quantity */
function changeQuantity(unique, delta) {
  const input = $(`qty_${unique}`);
  if (!input) return;
  let v = parseInt(input.value || '1', 10);
  v = Math.max(1, Math.min(99, v + delta));
  input.value = v;
}

/* add to cart */
function addToCartFromCard(unique, productName) {
  const select = $(`variant_${unique}`);
  const qtyInput = $(`qty_${unique}`);
  if (!select || !qtyInput) return;
  const opt = select.options[select.selectedIndex];
  const variant = opt.value;
  const price = parseFloat(opt.dataset.price) || 0;
  const qty = parseInt(qtyInput.value || '1', 10);

  const existing = cart.find(i => i.product_name === productName && i.variant === variant);
  if (existing) {
    existing.quantity += qty;
    existing.total_price = existing.quantity * existing.unit_price;
  } else {
    cart.push({ product_name: productName, variant, quantity: qty, unit_price: price, total_price: qty * price });
  }
  updateCartCount();
  renderCart();
  showCartToast(`${productName} added to cart!`);
}

function updateCartCount() {
  const total = cart.reduce((s, i) => s + i.quantity, 0);
  $('cartCount').textContent = total;
}

/* render cart */
function renderCart() {
  const container = $('cartContent');
  const footer = $('cartFooter');

  if (cart.length === 0) {
    container.innerHTML = `
      <div class="empty-cart">
        <i class="fas fa-shopping-bag"></i>
        <p>Your cart is empty</p>
        <small>Add some tasty items to get started</small>
      </div>`;
    footer.style.display = 'none';
  } else {
    container.innerHTML = cart.map((it, idx) => `
      <div class="cart-item">
        <div class="cart-item-top">
          <div class="cart-item-name">${escapeHtml(it.product_name)}</div>
          <button class="icon-btn" onclick="removeFromCart(${idx})" style="width:28px;height:28px;font-size:0.85rem">
            <i class="fas fa-xmark"></i>
          </button>
        </div>
        <div class="cart-item-meta">${escapeHtml(it.variant)}</div>
        <div class="cart-item-bottom">
          <div class="cart-qty-group">
            <button onclick="updateCartQuantity(${idx}, ${it.quantity - 1})">−</button>
            <span>${it.quantity}</span>
            <button onclick="updateCartQuantity(${idx}, ${it.quantity + 1})">+</button>
          </div>
          <div class="cart-item-price">₹${it.total_price}</div>
        </div>
      </div>
    `).join('');
    footer.style.display = 'block';
    const subtotal = cart.reduce((s, i) => s + i.total_price, 0);
    const total = subtotal + DELIVERY_CHARGE;
    $('cartSubtotal').textContent = subtotal;
    $('cartTotal').textContent = total;
    $('deliveryCharge').textContent = DELIVERY_CHARGE;
  }
}

function removeFromCart(idx) {
  cart.splice(idx, 1);
  updateCartCount();
  renderCart();
}

function updateCartQuantity(idx, qty) {
  if (qty < 1) { removeFromCart(idx); return; }
  cart[idx].quantity = qty;
  cart[idx].total_price = qty * cart[idx].unit_price;
  updateCartCount();
  renderCart();
}

/* toggle cart */
function toggleCart() {
  const sidebar = $('cartSidebar');
  const overlay = $('overlay');
  const isOpen = sidebar.classList.contains('open');
  sidebar.classList.toggle('open');
  overlay.style.display = isOpen ? 'none' : 'block';
  sidebar.setAttribute('aria-hidden', isOpen ? 'true' : 'false');
}

/* checkout flow */
function proceedToCheckout() {
  if (cart.length === 0) { alert('Your cart is empty!'); return; }
  toggleCart();
  openCustomerModal();
}

function openCustomerModal() {
  $('overlay').style.display = 'block';
  $('customerModal').style.display = 'flex';
  $('mobileLookupRow').style.display = 'block';
  $('customerForm').style.display = 'none';
}

function closeCustomerModal() {
  $('overlay').style.display = 'none';
  $('customerModal').style.display = 'none';
}

/* customer lookup */
async function lookupCustomerFromModal() {
  const mobile = ($('lookupMobile').value || '').trim();
  if (!/^\d{10}$/.test(mobile)) { alert('Please enter a valid 10-digit mobile number'); return; }
  try {
    const res = await apiCall(`/customer/${mobile}`);
    $('mobileLookupRow').style.display = 'none';
    $('customerForm').style.display = 'block';
    if (res.found) {
      const c = res.customer;
      $('fullName').value = c.full_name || '';
      $('mobileNumber').value = c.mobile_number || '';
      $('email').value = c.email || '';
      $('aptNumber').value = c.apt_number || '';
      $('community').value = c.community || '';
      $('deliveryInstructions').value = c.delivery_instructions || '';
    } else {
      $('mobileNumber').value = mobile;
    }
  } catch (e) {
    alert('Error looking up customer. Please try again.');
  }
}

/* order submit */
async function submitOrder(e) {
  e.preventDefault();
  const fullName = $('fullName').value.trim();
  const mobileNumber = $('mobileNumber').value.trim();
  const email = $('email').value.trim();
  const aptNumber = $('aptNumber').value.trim();
  const community = $('community').value.trim();
  const deliveryInstructions = $('deliveryInstructions').value.trim();

  if (!fullName || !mobileNumber || !email || !aptNumber || !community) {
    alert('Please fill all required fields');
    return;
  }

  const subtotal = cart.reduce((s, i) => s + i.total_price, 0);
  const order = {
    customer: { full_name: fullName, mobile_number: mobileNumber, email, apt_number: aptNumber, community },
    cart,
    subtotal,
    delivery_charge: DELIVERY_CHARGE,
    total_amount: subtotal + DELIVERY_CHARGE,
    delivery_instructions: deliveryInstructions || ''
  };

  try {
    const resp = await apiCall('/submit-order', { method: 'POST', body: JSON.stringify(order) });
    if (resp.success) {
      alert(`Order submitted! Order ID: ${resp.order_id}`);
      cart = [];
      updateCartCount();
      renderCart();
      closeCustomerModal();
    } else {
      alert('Could not submit order: ' + (resp.message || 'Unknown error'));
    }
  } catch (e) {
    alert('Error submitting order. Try again later.');
  }
}

/* navigation */
function goBackToCategories() {
  selectedCategory = null;
  selectedSubcategory = null;
  $('subcategorySection').style.display = 'none';
  $('productSection').style.display = 'none';
  $('backToCategoriesBtn').style.display = 'none';
  scrollToSection('categorySection');
}

/* scroll-triggered card animations */
function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('card-animated');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  window.observeCard = (el) => observer.observe(el);
}

function observeCard(el) { if (window.observeCard) window.observeCard(el); }

/* toast notification */
function showCartToast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;right:20px;bottom:90px;background:var(--green);color:#fff;padding:12px 20px;border-radius:999px;z-index:9999;font-weight:600;font-size:0.88rem;box-shadow:0 8px 24px rgba(0,0,0,0.14);animation:fadeUp 0.3s ease';
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}

/* ── About modal ── */
function openAbout() {
  $('overlay').style.display = 'block';
  $('aboutModal').style.display = 'flex';
  $('aboutModal').setAttribute('aria-hidden', 'false');
}

function closeAbout() {
  $('overlay').style.display = 'none';
  $('aboutModal').style.display = 'none';
  $('aboutModal').setAttribute('aria-hidden', 'true');
}
