/* CommunitE - SteviaPlease B1 Frontend JS
   - animated cards, stagger, tilt, responsive stack on mobile
   - cart + checkout + customer lookup
*/

const apiBase = "https://nutte-communite-994718298855.asia-south1.run.app"; // backend base
const DELIVERY_CHARGE = 50;

let cart = [];
let selectedCategory = null;
let selectedSubcategory = null;

/* fallback images */
const DEFAULT_CATEGORY_IMAGE = "https://images.unsplash.com/photo-1503602642458-232111445657?q=80&w=1200&auto=format&fit=crop";
const DEFAULT_SUBCATEGORY_IMAGE = "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?q=80&w=1200&auto=format&fit=crop";
const DEFAULT_PRODUCT_IMAGE = "assets/placeholder.png";

/* helpers */
const $ = id => document.getElementById(id);
const escapeHtml = s => (s||"").toString().replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function sanitizeId(s){ return (s||'').replace(/[^a-z0-9]/gi,'_').toLowerCase(); }
function scrollToSection(id){ const el=$(id); if(el) el.scrollIntoView({behavior:'smooth', block:'start'}); }

/* API */
async function apiCall(endpoint, options = {}) {
  const res = await fetch(`${apiBase}/api${endpoint}`, {
    headers: {'Content-Type':'application/json'},
    ...options
  });
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}

/* boot */
document.addEventListener('DOMContentLoaded', () => {
  bindUI();
  loadCategories();
  initScrollAnimations();
  initTilt();
});

/* UI bind */
function bindUI(){
  $('openCartBtn').addEventListener('click', toggleCart);
  $('closeCartBtn').addEventListener('click', toggleCart);
  $('checkoutBtn').addEventListener('click', proceedToCheckout);
  $('backToCategoriesBtn').addEventListener('click', goBackToCategories);
  $('lookupBtn').addEventListener('click', lookupCustomerFromModal);
  $('closeCustomerModalBtn').addEventListener('click', closeCustomerModal);
  $('customerForm').addEventListener('submit', submitOrder);
}

/* compatibility loader for categories */
async function loadCategories(){
  try {
    const res = await apiCall('/categories');
    let cats = [];
    if (Array.isArray(res)) {
      cats = res.map(c => (typeof c === 'string') ? {name:c, image:DEFAULT_CATEGORY_IMAGE} : {name:c.name || c.title, image:c.image || DEFAULT_CATEGORY_IMAGE});
    } else if (Array.isArray(res.categories)) {
      cats = res.categories.map(c => (typeof c === 'string')? {name:c, image:DEFAULT_CATEGORY_IMAGE} : {name:c.name || c.title, image:c.image || DEFAULT_CATEGORY_IMAGE});
    } else {
      // object values
      cats = Object.values(res).flat().map(c => (typeof c === 'string') ? {name:c, image:DEFAULT_CATEGORY_IMAGE} : {name:c.name || c.title, image:c.image || DEFAULT_CATEGORY_IMAGE});
    }

    if(!cats.length){ $('categoryContainer').innerHTML = `<div style="padding:16px;color:var(--muted)">No categories found</div>`; return; }

    const container = $('categoryContainer');
    container.innerHTML = cats.map((c,i)=>`
      <div class="category-card" style="animation-delay:${i*80}ms" onclick="selectCategory('${escapeHtml(c.name)}')">
        <img src="${escapeHtml(c.image || DEFAULT_CATEGORY_IMAGE)}" alt="${escapeHtml(c.name)}" />
        <div class="category-card-title">${escapeHtml(c.name)}</div>
      </div>
    `).join('');
    container.querySelectorAll('.category-card').forEach(el => observeCard(el));
  } catch(e){
    console.error("loadCategories", e);
    $('categoryContainer').innerHTML = `<div style="padding:16px;color:var(--muted)">Failed to load categories</div>`;
  }
}

/* subcategories */
async function selectCategory(category){
  selectedCategory = category;
  selectedSubcategory = null;
  $('subcategorySection').style.display = 'block';
  $('productSection').style.display = 'none';
  $('subcategoryTitle').innerText = category;
  $('backToCategoriesBtn').style.display = 'inline-flex';
  try {
    const res = await apiCall(`/subcategories/${encodeURIComponent(category)}`);
    let subs = res.subcategories || [];
    if(Array.isArray(res)) subs = res;
    const container = $('subcategoryContainer');
    container.innerHTML = subs.map((s,i) => `
      <div class="subcat-card" style="animation-delay:${i*80}ms" onclick="selectSubcategory('${escapeHtml(category)}','${escapeHtml(typeof s === 'string' ? s : s.name)}')">
        <img src="${escapeHtml(typeof s === 'string' ? DEFAULT_SUBCATEGORY_IMAGE : (s.image || DEFAULT_SUBCATEGORY_IMAGE))}" alt="${escapeHtml(typeof s === 'string' ? s : s.name)}" />
        <div class="subcat-title">${escapeHtml(typeof s === 'string' ? s : s.name)}</div>
      </div>
    `).join('');
    container.querySelectorAll('.subcat-card').forEach(el => observeCard(el));
    scrollToSection('subcategorySection');
  } catch(e){ console.error("selectCategory", e); $('subcategoryContainer').innerHTML=`<div style="padding:16px;color:var(--muted)">No subcategories</div>`;}
}

/* products */
async function selectSubcategory(category, subcat){
  selectedSubcategory = subcat;
  $('productSection').style.display = 'block';
  $('productTitle').innerText = subcat;
  try {
    const res = await apiCall(`/products/${encodeURIComponent(category)}/${encodeURIComponent(subcat)}`);
    const products = res.products || (Array.isArray(res) ? res : []);
    if(products.length===0){ $('productContainer').innerHTML = `<div style="padding:16px;color:var(--muted)">No products found.</div>`; return; }

    const grouped = {};
    products.forEach(p => {
      const key = p.product_name || p['Product Name'];
      if(!grouped[key]) grouped[key] = [];
      grouped[key].push(p);
    });

    const container = $('productContainer');
    container.innerHTML = Object.keys(grouped).map((name,i) => {
      const variants = grouped[name];
      const first = variants[0];
      const id = `prod_${sanitizeId(name)}_${i}`;
      const img = first.image || first.Image || DEFAULT_PRODUCT_IMAGE;
      return `
        <div class="product-card" id="${id}" style="animation-delay:${i*80}ms">
          <img src="${escapeHtml(img)}" alt="${escapeHtml(name)}" />
          <div class="product-title">${escapeHtml(name)}</div>
          <div class="product-desc">${escapeHtml(first.description || first['Product Description'] || '')}</div>

          <div class="controls-row">
            <select class="variant-select" id="variant_${id}" onchange="updateProductDisplay('${id}')">
              ${variants.map(v => {
                const variant = v.variant || v['Variant/Weight'] || 'Default';
                const price = v.price || v['Price (INR)'] || v.Price || 0;
                const vimg = v.image || v.Image || '';
                const desc = v.description || v['Product Description'] || '';
                return `<option value="${escapeHtml(variant)}" data-price="${price}" data-img="${escapeHtml(vimg)}" data-desc="${escapeHtml(desc)}">${escapeHtml(variant)} - ₹${price}</option>`;
              }).join('')}
            </select>

            <div class="qty-control" style="margin-left:8px">
              <button onclick="changeQuantity('${id}', -1)">-</button>
              <input id="qty_${id}" type="number" value="1" min="1" />
              <button onclick="changeQuantity('${id}', 1)">+</button>
            </div>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;">
            <div class="product-price" id="price_${id}">₹${(variants[0].price || variants[0]['Price (INR)'] || 0)}</div>
            <button class="add-btn" onclick="addToCartFromCard('${id}','${escapeHtml(name)}')"><i class="fas fa-cart-plus"></i> Add</button>
          </div>
        </div>
      `;
    }).join('');
    container.querySelectorAll('.product-card').forEach(el => observeCard(el));
    scrollToSection('productSection');
  } catch(e){ console.error("selectSubcategory", e); $('productContainer').innerHTML = `<div style="padding:16px;color:var(--muted)">Error loading products</div>`;}
}

/* update display for variant selection */
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

/* quantity */
function changeQuantity(unique, delta){
  const input = $(`qty_${unique}`);
  if(!input) return;
  let v = parseInt(input.value||'1',10);
  v = Math.max(1, Math.min(99, v + delta));
  input.value = v;
}

/* CART logic */
function addToCartFromCard(uniqueId, productName){
  const select = $(`variant_${uniqueId}`);
  const qty = parseInt($(`qty_${uniqueId}`).value || '1',10);
  const variant = select.value;
  const price = parseFloat(select.options[select.selectedIndex].dataset.price || 0);
  addToCart(productName, variant, price, qty);
  showCartToast(`${qty} x ${productName}`);
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
          <div class="name" style="font-weight:800">${escapeHtml(it.product_name)}</div>
          <button class="close-btn" onclick="removeFromCart(${idx})">&times;</button>
        </div>
        <div class="meta" style="color:var(--muted)">${escapeHtml(it.variant)}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
          <div>
            <button class="btn-secondary" onclick="updateCartQuantity(${idx}, ${it.quantity - 1})">-</button>
            <span style="padding:0 8px;font-weight:700">${it.quantity}</span>
            <button class="btn-secondary" onclick="updateCartQuantity(${idx}, ${it.quantity + 1})">+</button>
          </div>
          <div style="font-weight:900">₹${it.total_price}</div>
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

/* toggle cart (drawer / bottom sheet) */
function toggleCart(){
  const sidebar = $('cartSidebar');
  const overlay = $('overlay');
  const isOpen = sidebar.classList.contains('open');
  sidebar.classList.toggle('open');
  overlay.style.display = isOpen ? "none" : "block";
}

/* checkout flow */
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
}
function closeCustomerModal(){
  $('overlay').style.display = 'none';
  $('customerModal').style.display = 'none';
}

/* customer lookup */
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
    }
  } catch (e) {
    alert('Error looking up customer. Please try again.');
  }
}

/* order submit */
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
      const sidebar = $('cartSidebar');
      if(sidebar.classList.contains('open')) toggleCart();
    } else {
      alert('Could not submit order: ' + (resp.message || 'Unknown error'));
    }
  } catch (e) {
    alert('Error submitting order. Try again later.');
  }
}

/* navigation helpers */
function goBackToCategories(){
  selectedCategory = null;
  selectedSubcategory = null;
  $('subcategorySection').style.display = 'none';
  $('productSection').style.display = 'none';
  $('backToCategoriesBtn').style.display = 'none';
  scrollToSection('categorySection');
}

/* Scroll-trigger observer for staggered entrance */
function initScrollAnimations(){
  const observer = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        entry.target.classList.add('card-animated');
      }
    });
  }, {threshold:0.2});
  window.observeCard = (el) => { observer.observe(el); };
}

/* Observe new cards (used after injecting markup) */
function observeCard(el){ if(window.observeCard) window.observeCard(el); }

/* Tilt/parallax effect (pointer-based) */
function initTilt(){
  let moving = false;
  document.addEventListener('pointermove', (e)=>{
    const targets = document.querySelectorAll('.category-card, .subcat-card, .product-card');
    targets.forEach(el=>{
      const rect = el.getBoundingClientRect();
      if(rect.top < window.innerHeight && rect.bottom > 0){
        const dx = (e.clientX - rect.left) / rect.width - 0.5;
        const dy = (e.clientY - rect.top) / rect.height - 0.5;
        const rotateX = dy * 6;
        const rotateY = dx * -6;
        el.style.transform = `translateY(-6px) scale(1.04) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
      }
    });
  });
  document.addEventListener('pointerleave', ()=>{
    document.querySelectorAll('.category-card, .subcat-card, .product-card').forEach(el=>{
      el.style.transform = '';
    });
  });
}

/* small helpers */
function escapeJs(s){ return (s||'').replace(/'/g,"\\'").replace(/"/g,'\\"'); }
function showCartToast(msg){
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;right:18px;bottom:110px;background:#28a745;color:#fff;padding:12px;border-radius:8px;z-index:2000;box-shadow:0 6px 18px rgba(0,0,0,0.12)';
  document.body.appendChild(t);
  setTimeout(()=>t.remove(),2600);
}
