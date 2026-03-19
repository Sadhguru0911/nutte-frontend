/* CommunitE — Refined Frontend JS
   Matches new editorial HTML/CSS layout
*/

const apiBase = "https://nutte-communite-994718298855.asia-south1.run.app";
const DELIVERY_CHARGE = 50;
const MEMBERSHIP_PRICES = { monthly: 400, annual: 3999 };

let cart = [];
let selectedCategory = null;
let selectedSubcategory = null;

// Membership state
let memberState = {
  isMember: false,
  status: null,        // 'active' | 'pending' | 'expired' | null
  plan: null,          // 'monthly' | 'annual'
  expiry: null,
  name: null,
  mobile: null
};
let selectedMemberPlan = null;   // 'monthly' | 'annual'
let membershipAddedToCart = false;
let membershipFeeAmount = 0;

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
  const closeAboutBtn = document.getElementById('closeAboutBtn');
  if (closeAboutBtn) closeAboutBtn.addEventListener('click', closeAbout);
  const closeReelsBtn = document.getElementById('closeReelsBtn');
  if (closeReelsBtn) closeReelsBtn.addEventListener('click', closeReels);
  const closeMembershipBtn = document.getElementById('closeMembershipBtn');
  if (closeMembershipBtn) closeMembershipBtn.addEventListener('click', closeMembershipModal);
});

/* UI bind */
function bindUI() {
  $('openCartBtn').addEventListener('click', toggleCart);
  $('closeCartBtn').addEventListener('click', toggleCart);
  $('checkoutBtn').addEventListener('click', proceedToCheckout);
  $('backToCategoriesBtn').addEventListener('click', goBackToCategories);
  $('lookupBtn').addEventListener('click', lookupCustomerFromModal);
  $('closeCustomerModalBtn').addEventListener('click', closeCustomerModal);
  $('overlay').addEventListener('click', () => {
    if ($('cartSidebar').classList.contains('open')) toggleCart();
    if ($('customerModal').style.display !== 'none') closeCustomerModal();
    if ($('aboutModal') && $('aboutModal').style.display !== 'none') closeAbout();
    if ($('reelsModal') && $('reelsModal').style.display !== 'none') closeReels();
    if ($('membershipModal') && $('membershipModal').style.display !== 'none') closeMembershipModal();
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
      <div class="category-card ripple-card" style="animation-delay:${i * 70}ms" onclick="selectCategory('${escapeHtml(c.name)}')">
        <img src="${escapeHtml(c.image)}" alt="${escapeHtml(c.name)}" loading="lazy" />
        <div class="category-card-title">${escapeHtml(c.name)}</div>
        <canvas class="ripple-canvas"></canvas>
      </div>
    `).join('');
    container.querySelectorAll('.category-card').forEach(el => { observeCard(el); initRipple(el); });
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
        <div class="subcat-card ripple-card" style="animation-delay:${i * 70}ms" onclick="selectSubcategory('${escapeHtml(category)}','${escapeHtml(name)}')">
          <img src="${escapeHtml(img)}" alt="${escapeHtml(name)}" loading="lazy" />
          <div class="subcat-title">${escapeHtml(name)}</div>
          <canvas class="ripple-canvas"></canvas>
        </div>
      `;
    }).join('');
    container.querySelectorAll('.subcat-card').forEach(el => { observeCard(el); initRipple(el); });
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
      const firstMemberPrice = first.member_price || first['Member Price (INR)'] || null;

      const priceHTML = buildPriceHTML(firstPrice, firstMemberPrice, `price_${id}`);

      return `
        <div class="product-card ripple-card" id="${id}" style="animation-delay:${i * 70}ms">
          <div class="product-img-wrap">
            <img src="${escapeHtml(img)}" alt="${escapeHtml(name)}" loading="lazy" />
            <canvas class="ripple-canvas"></canvas>
          </div>
          <div class="product-card-body">
            <div class="product-title">${escapeHtml(name)}</div>
            <div class="product-desc">${escapeHtml(first.description || first['Product Description'] || '')}</div>
            <div class="controls-row">
              <select class="variant-select" id="variant_${id}" onchange="updateProductDisplay('${id}')">
                ${variants.map(v => {
                  const variant = v.variant || v['Variant/Weight'] || 'Default';
                  const price = v.price || v['Price (INR)'] || v.Price || 0;
                  const memberPrice = v.member_price || v['Member Price (INR)'] || '';
                  const vimg = v.image || v.Image || '';
                  const desc = v.description || v['Product Description'] || '';
                  return `<option value="${escapeHtml(variant)}" data-price="${price}" data-member-price="${memberPrice}" data-img="${escapeHtml(vimg)}" data-desc="${escapeHtml(desc)}">${escapeHtml(variant)} — ₹${price}</option>`;
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
            <div id="price_${id}">${priceHTML}</div>
            <button class="add-btn" onclick="addToCartFromCard('${id}','${escapeHtml(name)}')">
              <i class="fas fa-cart-plus"></i> Add
            </button>
          </div>
        </div>
      `;
    }).join('');
    container.querySelectorAll('.product-card').forEach(el => { observeCard(el); initRipple(el); });
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
  const memberPrice = opt.dataset.memberPrice || '';
  const img = opt.dataset.img;
  const desc = opt.dataset.desc;
  const priceEl = $(`price_${unique}`);
  if (priceEl) priceEl.innerHTML = buildPriceHTML(price, memberPrice, `price_${unique}`);
  const imgEl = document.querySelector(`#${unique} img`);
  if (imgEl && img) imgEl.src = img;
  const descEl = document.querySelector(`#${unique} .product-desc`);
  if (descEl && desc !== undefined) descEl.textContent = desc;
}

/* Build price HTML — shows dual price or single */
function buildPriceHTML(regularPrice, memberPrice, id) {
  const reg = parseFloat(regularPrice) || 0;
  const mem = parseFloat(memberPrice) || 0;
  if (mem > 0 && mem < reg) {
    // Always show both prices; if active member highlight member price
    return `<div class="product-price-wrap">
      <span class="product-price--regular">₹${reg}</span>
      <span class="product-price--member">₹${mem} <span class="member-tag">⭐ Member</span></span>
    </div>`;
  }
  return `<span class="product-price--single">₹${reg}</span>`;
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
  const regularPrice = parseFloat(opt.dataset.price) || 0;
  const memberPrice = parseFloat(opt.dataset.memberPrice) || 0;

  // Use member price if active/pending member AND member price exists
  const isActiveMember = memberState.status === 'active' || memberState.status === 'pending' || membershipAddedToCart;
  const effectivePrice = (isActiveMember && memberPrice > 0 && memberPrice < regularPrice) ? memberPrice : regularPrice;

  const qty = parseInt(qtyInput.value || '1', 10);
  const existing = cart.find(i => i.product_name === productName && i.variant === variant);
  if (existing) {
    existing.quantity += qty;
    existing.total_price = existing.quantity * existing.unit_price;
  } else {
    cart.push({
      product_name: productName,
      variant,
      quantity: qty,
      unit_price: effectivePrice,
      regular_price: regularPrice,
      member_price: memberPrice || regularPrice,
      total_price: qty * effectivePrice
    });
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
        <small>Add some items to get started</small>
      </div>`;
    footer.style.display = 'none';
    $('memberSavingsBanner').style.display = 'none';
    $('renewalBanner').style.display = 'none';
    return;
  }

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

  // Calculate subtotal (excluding membership fee)
  const productItems = cart.filter(i => !i._isMembershipFee);
  const subtotal = productItems.reduce((s, i) => s + i.total_price, 0);

  // Calculate potential member savings (for non-members)
  const isActiveMember = memberState.status === 'active' || memberState.status === 'pending' || membershipAddedToCart;
  const memberSavings = productItems.reduce((s, i) => {
    if (i.member_price && i.regular_price && i.member_price < i.regular_price) {
      return s + ((i.regular_price - i.member_price) * i.quantity);
    }
    return s;
  }, 0);

  // Show/hide banners
  if (!isActiveMember && memberSavings > 0) {
    if (memberState.status === 'expired') {
      $('renewalBanner').style.display = 'block';
      $('memberSavingsBanner').style.display = 'none';
      $('renewSavingsAmount').textContent = `₹${memberSavings}`;
    } else {
      $('memberSavingsBanner').style.display = 'block';
      $('renewalBanner').style.display = 'none';
      $('savingsAmount').textContent = `₹${memberSavings}`;
    }
  } else {
    $('memberSavingsBanner').style.display = 'none';
    $('renewalBanner').style.display = 'none';
  }

  // Membership fee row
  if (membershipAddedToCart && membershipFeeAmount > 0) {
    $('membershipFeeRow').style.display = 'flex';
    $('membershipFeeAmount').textContent = membershipFeeAmount;
    $('membershipPlanLabel').textContent = selectedMemberPlan === 'annual' ? 'Annual' : 'Monthly';
  } else {
    $('membershipFeeRow').style.display = 'none';
  }

  const totalWithMembership = subtotal + membershipFeeAmount + DELIVERY_CHARGE;
  $('cartSubtotal').textContent = subtotal;
  $('cartTotal').textContent = totalWithMembership;
  $('deliveryCharge').textContent = DELIVERY_CHARGE;
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
  $('customerForm').dataset.isNew = 'false';
  $('mobileLookupRow').style.display = 'block';
  $('customerForm').style.display = 'none';
  $('paymentStep').style.display = 'none';
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

      // Check membership status from customer data
      applyMembershipStatus(c, mobile);
    } else {
      $('mobileNumber').value = mobile;
      $('customerForm').dataset.isNew = 'true';
    }
  } catch (e) {
    alert('Error looking up customer. Please try again.');
  }
}

/* Apply membership state from customer record */
function applyMembershipStatus(customer, mobile) {
  const status = (customer.membership_status || '').toLowerCase();
  const plan = (customer.membership_plan || '').toLowerCase();
  const expiry = customer.membership_expiry || null;

  memberState = {
    isMember: status === 'active',
    status: status || null,
    plan,
    expiry,
    name: customer.full_name,
    mobile
  };

  // Update nav member button
  const btn = $('memberLoginBtn');
  if (status === 'active') {
    btn.classList.add('is-member');
    $('memberLoginLabel').textContent = '⭐ Member';
  } else if (status === 'expired') {
    btn.classList.remove('is-member');
    $('memberLoginLabel').textContent = 'Renew';
  }

  // Re-render cart to apply correct prices
  if (status === 'active' || status === 'pending') {
    // Switch all cart items to member price
    cart = cart.map(item => {
      if (item.member_price && item.member_price < item.regular_price) {
        return { ...item, unit_price: item.member_price, total_price: item.quantity * item.member_price };
      }
      return item;
    });
  }
  renderCart();
}

/* Step 1 → Step 2: validate details, show payment */
function goToPaymentStep() {
  const fullName = $('fullName').value.trim();
  const mobileNumber = $('mobileNumber').value.trim();
  const email = $('email').value.trim();
  const aptNumber = $('aptNumber').value.trim();
  const community = $('community').value.trim();

  if (!fullName || !mobileNumber || !email || !aptNumber || !community) {
    alert('Please fill all required fields before proceeding to payment');
    return;
  }

  // Calculate amounts to show in payment step
  const productItems = cart.filter(i => !i._isMembershipFee);
  const subtotal = productItems.reduce((s, i) => s + i.total_price, 0);
  const total = subtotal + membershipFeeAmount + DELIVERY_CHARGE;

  $('oasSubtotal').textContent = subtotal;
  $('oasTotal').textContent = total;

  if (membershipAddedToCart && membershipFeeAmount > 0) {
    $('oasMemberRow').style.display = 'flex';
    $('oasMemberFee').textContent = membershipFeeAmount;
    $('oasMemberPlan').textContent = selectedMemberPlan === 'annual' ? 'Annual' : 'Monthly';
  } else {
    $('oasMemberRow').style.display = 'none';
  }

  $('customerForm').style.display = 'none';
  $('paymentStep').style.display = 'block';
  $('orderRRNumber').value = '';
}

/* Step 2 → Step 1: back to details */
function backToDetailsStep() {
  $('paymentStep').style.display = 'none';
  $('customerForm').style.display = 'block';
}

/* Final submit with RR number */
async function submitOrderWithPayment() {
  const rrNumber = ($('orderRRNumber').value || '').trim();
  if (!rrNumber) {
    alert('Please enter your UPI Transaction ID / RR Number after making the payment');
    return;
  }

  const fullName = $('fullName').value.trim();
  const mobileNumber = $('mobileNumber').value.trim();
  const email = $('email').value.trim();
  const aptNumber = $('aptNumber').value.trim();
  const community = $('community').value.trim();
  const deliveryInstructions = $('deliveryInstructions').value.trim();

  const productItems = cart.filter(i => !i._isMembershipFee);
  const subtotal = productItems.reduce((s, i) => s + i.total_price, 0);

  const order = {
    customer: { full_name: fullName, mobile_number: mobileNumber, email, apt_number: aptNumber, community },
    cart: productItems,
    subtotal,
    delivery_charge: DELIVERY_CHARGE,
    total_amount: subtotal + membershipFeeAmount + DELIVERY_CHARGE,
    delivery_instructions: deliveryInstructions || '',
    upi_rr_number: rrNumber,
    is_member: memberState.status === 'active' || memberState.status === 'pending' || membershipAddedToCart,
    membership_plan: membershipAddedToCart ? selectedMemberPlan : null,
    membership_fee: membershipAddedToCart ? membershipFeeAmount : 0
  };

  try {
    const resp = await apiCall('/submit-order', { method: 'POST', body: JSON.stringify(order) });
    if (resp.success) {
      // Save new customer if first time
      if ($('customerForm').dataset.isNew === 'true') {
        try {
          await apiCall('/new-customer', {
            method: 'POST',
            body: JSON.stringify({ full_name: fullName, mobile_number: mobileNumber, email, apt_number: aptNumber, community, delivery_instructions: deliveryInstructions || '' })
          });
          delete $('customerForm').dataset.isNew;
        } catch (saveErr) {
          console.warn('Customer save failed (non-critical):', saveErr);
        }
      }
      // Save membership if bundled
      if (membershipAddedToCart) {
        try {
          await apiCall('/join-member', {
            method: 'POST',
            body: JSON.stringify({
              mobile_number: mobileNumber,
              full_name: fullName,
              email,
              plan: selectedMemberPlan,
              amount_paid: membershipFeeAmount,
              rr_number: rrNumber
            })
          });
        } catch (memErr) {
          console.warn('Membership save failed (non-critical):', memErr);
        }
      }
      alert(`✅ Order confirmed! Order ID: ${resp.order_id}\n\nWe'll verify your payment and process your order shortly.`);
      cart = [];
      membershipAddedToCart = false;
      membershipFeeAmount = 0;
      selectedMemberPlan = null;
      updateCartCount();
      renderCart();
      closeCustomerModal();
    } else {
      alert('Could not submit order: ' + (resp.message || 'Unknown error'));
    }
  } catch (e) {
    alert('Error submitting order. Please try again.');
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

/* ── Reels modal ── */
async function openReels() {
  $('overlay').style.display = 'block';
  $('reelsModal').style.display = 'flex';
  $('reelsModal').setAttribute('aria-hidden', 'false');
  await loadReels();
}

async function loadReels() {
  const strip = $('reelsStrip');
  if (!strip || strip.dataset.loaded === 'true') return;
  try {
    const res = await fetch('reels.txt?nocache=' + Date.now());
    const text = await res.text();

    // Parse: strip comment lines, then split by each <blockquote> block
    // Works regardless of spacing between embeds
    const lines = text.split('\n').filter(l => !l.trim().startsWith('#'));
    const cleaned = lines.join('\n');

    // Extract each blockquote (one per reel) — ignore the duplicate <script> tags
    const blockquotes = [...cleaned.matchAll(/<blockquote[\s\S]*?<\/blockquote>/gi)].map(m => m[0]);

    if (blockquotes.length === 0) {
      strip.innerHTML = `<div class="reel-placeholder reel-item"><i class="fab fa-instagram"></i><p>No reels yet.<br>Add embed codes to reels.txt</p></div>`;
      return;
    }

    // Add the embed script once at the end
    strip.innerHTML = blockquotes.map(embed => `
      <div class="reel-item">${embed}</div>
    `).join('');

    // Load Instagram embed script if not already loaded
    if (!window.instgrm) {
      const s = document.createElement('script');
      s.src = 'https://www.instagram.com/embed.js';
      s.async = true;
      document.body.appendChild(s);
    } else {
      window.instgrm.Embeds.process();
    }

    strip.dataset.loaded = 'true';
  } catch(e) {
    console.error('Could not load reels.txt', e);
    strip.innerHTML = `<div class="reel-placeholder reel-item"><i class="fab fa-instagram"></i><p>Could not load reels.</p></div>`;
  }
}

function closeReels() {
  $('overlay').style.display = 'none';
  $('reelsModal').style.display = 'none';
  $('reelsModal').setAttribute('aria-hidden', 'true');
}

function scrollReels(direction) {
  const strip = $('reelsStrip');
  if (strip) strip.scrollBy({ left: direction * 260, behavior: 'smooth' });
}

/* ══════════════════════════════════════════
   MEMBERSHIP MODAL FUNCTIONS
   ══════════════════════════════════════════ */

function openMembershipModal() {
  resetMembershipModal();
  $('overlay').style.display = 'block';
  $('membershipModal').style.display = 'flex';
  $('membershipModal').setAttribute('aria-hidden', 'false');

  // If already active member — go straight to step 3
  if (memberState.status === 'active') {
    showMemberStep(3);
    $('memberActiveName').textContent = `Welcome back, ${memberState.name || 'Member'}!`;
    $('memberActivePlan').textContent = memberState.plan === 'annual' ? 'Annual ₹3,999/yr' : 'Monthly ₹400/mo';
    $('memberActiveExpiry').textContent = memberState.expiry ? formatDate(memberState.expiry) : '—';
  }
}

function closeMembershipModal() {
  $('overlay').style.display = 'none';
  $('membershipModal').style.display = 'none';
  $('membershipModal').setAttribute('aria-hidden', 'true');
}

/* Called from cart savings banner */
function openMembershipInCart() {
  closeSidebar();
  openMembershipModal();
}

function closeSidebar() {
  const sidebar = $('cartSidebar');
  if (sidebar.classList.contains('open')) {
    sidebar.classList.remove('open');
    $('overlay').style.display = 'none';
  }
}

/* Nav member login button */
function openMemberLogin() {
  if (memberState.status === 'active') {
    openMembershipModal(); // shows active card
  } else {
    openMembershipModal(); // shows join flow
  }
}

function resetMembershipModal() {
  showMemberStep(1);
  selectedMemberPlan = null;
  document.querySelectorAll('.member-plan').forEach(p => p.classList.remove('selected'));
  $('memberCustomerConfirm').style.display = 'none';
  $('memberNewForm').style.display = 'none';
  $('memberMobileRow').style.display = 'block';
  $('memberMobile').value = '';
  $('memberRRNumber').value = '';
}

function showMemberStep(n) {
  [1, 2, 3].forEach(i => {
    const el = $(`memberStep${i}`);
    if (el) el.style.display = i === n ? 'block' : 'none';
  });
}

/* Plan selection */
function selectPlan(plan) {
  selectedMemberPlan = plan;
  document.querySelectorAll('.member-plan').forEach(p => p.classList.remove('selected'));
  $(`plan${plan.charAt(0).toUpperCase() + plan.slice(1)}`).classList.add('selected');
}

/* Lookup customer in membership modal */
async function lookupMemberCustomer() {
  const mobile = ($('memberMobile').value || '').trim();
  if (!/^\d{10}$/.test(mobile)) { alert('Please enter a valid 10-digit mobile number'); return; }
  if (!selectedMemberPlan) { alert('Please select a plan first'); return; }

  try {
    const res = await apiCall(`/customer/${mobile}`);
    if (res.found) {
      const c = res.customer;

      // Already active member?
      if ((c.membership_status || '').toLowerCase() === 'active') {
        memberState = { isMember: true, status: 'active', plan: c.membership_plan, expiry: c.membership_expiry, name: c.full_name, mobile };
        showMemberStep(3);
        $('memberActiveName').textContent = `You're already a member, ${c.full_name}!`;
        $('memberActivePlan').textContent = c.membership_plan === 'annual' ? 'Annual ₹3,999/yr' : 'Monthly ₹400/mo';
        $('memberActiveExpiry').textContent = c.membership_expiry ? formatDate(c.membership_expiry) : '—';
        return;
      }

      // Existing customer, not yet a member — confirm details
      $('memberConfirmName').textContent = c.full_name;
      $('memberConfirmDetails').textContent = `${c.community || ''} · ${c.apt_number || ''}`;
      $('memberMobileRow').style.display = 'none';
      $('memberCustomerConfirm').style.display = 'block';

      // Store for payment step
      $('memberCustomerConfirm').dataset.mobile = mobile;
      $('memberCustomerConfirm').dataset.name = c.full_name;
      $('memberCustomerConfirm').dataset.email = c.email || '';
    } else {
      // New customer — show form
      $('memberMobileRow').style.display = 'none';
      $('memberNewForm').style.display = 'block';
      $('memberNewForm').dataset.mobile = mobile;
    }
  } catch(e) {
    alert('Error looking up customer. Please try again.');
  }
}

/* Proceed to payment step */
function goToMemberPayment() {
  if (!selectedMemberPlan) { alert('Please select a plan first'); return; }

  const amount = MEMBERSHIP_PRICES[selectedMemberPlan];
  const planLabel = selectedMemberPlan === 'annual' ? 'Annual — ₹3,999/year' : 'Monthly — ₹400/month';

  $('paymentPlanLabel').textContent = planLabel;
  $('paymentAmount').textContent = `₹${amount}`;
  $('upiExactAmount').textContent = `₹${amount}`;

  showMemberStep(2);
}

/* Submit membership (standalone — not bundled with order) */
async function submitMembership() {
  const rrNumber = ($('memberRRNumber').value || '').trim();
  if (!rrNumber) { alert('Please enter your UPI Transaction ID / RR Number'); return; }

  // Get customer details from whichever path we came through
  let mobile, name, email, apt, community;
  const confirmCard = $('memberCustomerConfirm');
  const newForm = $('memberNewForm');

  if (confirmCard.style.display !== 'none') {
    mobile = confirmCard.dataset.mobile;
    name = confirmCard.dataset.name;
    email = confirmCard.dataset.email;
  } else if (newForm.style.display !== 'none') {
    mobile = newForm.dataset.mobile;
    name = ($('memberFullName').value || '').trim();
    email = ($('memberEmail').value || '').trim();
    apt = ($('memberApt').value || '').trim();
    community = ($('memberCommunity').value || '').trim();
    if (!name || !email) { alert('Please fill your name and email'); return; }
  }

  const amount = MEMBERSHIP_PRICES[selectedMemberPlan];

  try {
    const resp = await apiCall('/join-member', {
      method: 'POST',
      body: JSON.stringify({
        mobile_number: mobile,
        full_name: name,
        email,
        apt_number: apt || '',
        community: community || '',
        plan: selectedMemberPlan,
        amount_paid: amount,
        rr_number: rrNumber
      })
    });

    if (resp.success) {
      alert(`✅ Membership request submitted! We'll activate your membership after verifying payment. Thank you!`);
      closeMembershipModal();
    } else {
      alert('Could not submit membership: ' + (resp.message || 'Please try again'));
    }
  } catch(e) {
    alert('Error submitting membership. Please try again.');
  }
}

/* Add membership fee to cart and switch prices */
function addMembershipToCart(plan) {
  if (membershipAddedToCart) return; // already added

  selectedMemberPlan = plan;
  membershipFeeAmount = MEMBERSHIP_PRICES[plan];
  membershipAddedToCart = true;

  // Switch all cart items to member prices
  cart = cart.map(item => {
    if (item.member_price && item.member_price < item.regular_price) {
      return { ...item, unit_price: item.member_price, total_price: item.quantity * item.member_price };
    }
    return item;
  });

  renderCart();
  showCartToast(`🌟 Member pricing applied! ₹${membershipFeeAmount} membership fee added.`);
}

/* Copy UPI ID */
function copyUPI() {
  navigator.clipboard.writeText('Mab.037213027680043@axisbank').then(() => {
    showCartToast('UPI ID copied!');
  });
}

/* Format date helper */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch(e) { return dateStr; }
}

/* ═══════════════════════════════════════════════════
   WATER RIPPLE ENGINE
   Canvas-based 2D wave simulation — no WebGL needed,
   runs on CPU with ImageData for broad compatibility.
   Each ripple-card gets its own isolated simulation.
═══════════════════════════════════════════════════ */

function initRipple(card) {
  const canvas = card.querySelector('.ripple-canvas');
  if (!canvas || canvas._rippleInit) return;
  canvas._rippleInit = true;

  const ctx = canvas.getContext('2d');
  let W, H, cur, prev, rippling = false, animId;

  function resize() {
    W = canvas.width  = card.offsetWidth;
    H = canvas.height = card.offsetHeight;
    cur  = new Float32Array(W * H);
    prev = new Float32Array(W * H);
  }

  resize();
  new ResizeObserver(resize).observe(card);

  /* Drop a ripple at (x,y) with radius r and strength s */
  function drop(x, y, r, s) {
    const px = Math.floor(x), py = Math.floor(y);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx*dx + dy*dy <= r*r) {
          const nx = px+dx, ny = py+dy;
          if (nx>=0 && nx<W && ny>=0 && ny<H)
            cur[ny*W+nx] += s;
        }
      }
    }
  }

  /* Wave propagation step */
  function step() {
    for (let y = 1; y < H-1; y++) {
      for (let x = 1; x < W-1; x++) {
        const i = y*W+x;
        cur[i] = (
          prev[(y-1)*W+x] + prev[(y+1)*W+x] +
          prev[y*W+(x-1)] + prev[y*W+(x+1)]
        ) * 0.5 - cur[i];
        cur[i] *= 0.985; // damping
      }
    }
    [cur, prev] = [prev, cur];
  }

  /* Render distortion onto canvas */
  function render() {
    const img = ctx.createImageData(W, H);
    const d   = img.data;
    let hasEnergy = false;

    for (let y = 1; y < H-1; y++) {
      for (let x = 1; x < W-1; x++) {
        const i   = y*W+x;
        const val = prev[i];
        if (Math.abs(val) > 0.01) hasEnergy = true;

        // Displacement vector from wave gradient
        const dx = Math.floor(prev[y*W+(x+1)] - prev[y*W+(x-1)]);
        const dy = Math.floor(prev[(y+1)*W+x] - prev[(y-1)*W+x]);

        // Source pixel with displacement (clamped)
        const sx = Math.min(W-1, Math.max(0, x + dx));
        const sy = Math.min(H-1, Math.max(0, y + dy));

        const pi = (y*W+x)*4;
        const si = (sy*W+sx)*4;

        // Ripple overlay — semi-transparent white shimmer
        const shimmer = Math.min(255, Math.abs(val) * 3);
        d[pi]   = shimmer;
        d[pi+1] = shimmer;
        d[pi+2] = shimmer;
        d[pi+3] = Math.min(80, shimmer * 0.8);
      }
    }

    ctx.clearRect(0, 0, W, H);
    ctx.putImageData(img, 0, 0);

    if (!hasEnergy) {
      rippling = false;
      cancelAnimationFrame(animId);
    } else {
      animId = requestAnimationFrame(loop);
    }
  }

  function loop() { step(); render(); }

  function startRipple() {
    if (!rippling) {
      rippling = true;
      animId = requestAnimationFrame(loop);
    }
  }

  /* Mouse / touch events */
  card.addEventListener('mousemove', e => {
    const r = card.getBoundingClientRect();
    drop(e.clientX - r.left, e.clientY - r.top, 6, 180);
    startRipple();
  });

  card.addEventListener('mouseenter', e => {
    const r = card.getBoundingClientRect();
    drop(e.clientX - r.left, e.clientY - r.top, 10, 220);
    startRipple();
  });

  card.addEventListener('click', e => {
    const r = card.getBoundingClientRect();
    drop(e.clientX - r.left, e.clientY - r.top, 18, 400);
    startRipple();
  });

  card.addEventListener('touchmove', e => {
    const r = card.getBoundingClientRect();
    const t = e.touches[0];
    drop(t.clientX - r.left, t.clientY - r.top, 8, 200);
    startRipple();
  }, { passive: true });
}

/* Init ripple on all hero cards after DOM is ready */
function initHeroRipples() {
  document.querySelectorAll('.ripple-card').forEach(card => initRipple(card));
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(initHeroRipples, 100);
});
