/* CommunitE — Refined Frontend JS
   Matches new editorial HTML/CSS layout
*/

const apiBase = "https://nutte-communite-994718298855.asia-south1.run.app";
const DELIVERY_CHARGE = 50;
const MEMBERSHIP_PRICES = { monthly: 400, annual: 3999 };

/* UPI — used to build a dynamic pay link/QR so the amount is pre-filled
   instead of the customer having to type it in manually. */
const UPI_VPA = "Mab.037213027680043@axisbank";
const UPI_PAYEE_NAME = "CommunitE";

let cart = [];
let dismissedBanners = new Set(); // banner ids the user has closed for this cart session
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

// Profile / account state — the currently recognized customer, if any
let loggedInCustomer = null; // { mobile, full_name, email, apt_number, community, delivery_instructions }

/* fallback images */
const DEFAULT_CATEGORY_IMAGE = "https://images.unsplash.com/photo-1488459716781-31db52582fe9?q=80&w=800&auto=format&fit=crop";
const DEFAULT_SUBCATEGORY_IMAGE = "https://images.unsplash.com/photo-1490818387583-1baba5e638af?q=80&w=800&auto=format&fit=crop";
const DEFAULT_PRODUCT_IMAGE = "assets/placeholder.png";

/* helpers */
const $ = id => document.getElementById(id);
const escapeHtml = s => (s || "").toString().replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function sanitizeId(s) { return (s || '').replace(/[^a-z0-9]/gi, '_').toLowerCase(); }
function scrollToSection(id) { const el = $(id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
/* Encode category/subcategory names for URLs — preserves / so Flask path: routing works */
function encodeCategory(s) { return (s || '').split('/').map(part => encodeURIComponent(part)).join('/'); }

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
  initProfileFromSavedMobile(); // silently recognize a returning customer, updates nav badge
  checkForSharedTicketLink(); // if opened from a shared Tambola ticket link, show it immediately
  loadFeaturedPartnerOnBoot(); // show the homepage Featured Partner banner if one is set
  // Init ripple on hero cards
  setTimeout(() => {
    document.querySelectorAll('.ripple-card').forEach(card => initRipple(card));
  }, 200);

  // ── SILENT PRICE REFRESH ON TAB FOCUS ──
  // When customer switches back to this tab, silently reload products
  // so they always see current prices without manual refresh
  let lastRefresh = Date.now();
  const MIN_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes minimum between refreshes

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      const timeSinceRefresh = Date.now() - lastRefresh;
      if (timeSinceRefresh > MIN_REFRESH_INTERVAL) {
        silentRefreshProducts();
        lastRefresh = Date.now();
      }
    }
  });

  // Also refresh if window regains focus (e.g. switching from another app)
  window.addEventListener('focus', () => {
    const timeSinceRefresh = Date.now() - lastRefresh;
    if (timeSinceRefresh > MIN_REFRESH_INTERVAL) {
      silentRefreshProducts();
      lastRefresh = Date.now();
    }
  });

  // ── OVERLAY WATCHER ──
  // Every modal/sidebar (cart, customer details, about, reels, membership)
  // shows/hides the same shared #overlay element. Watch it once here so the
  // floating back button and floating cart bar automatically get out of the
  // way whenever any of them is open, instead of needing to be updated in
  // every individual open/close function.
  const overlayEl = $('overlay');
  if (overlayEl) {
    const syncOverlayState = () => {
      const isOpen = overlayEl.style.display !== 'none';
      document.body.classList.toggle('overlay-open', isOpen);
    };
    new MutationObserver(syncOverlayState).observe(overlayEl, { attributes: true, attributeFilter: ['style'] });
    syncOverlayState();
  }

  // Floating cart bar should reflect any cart state already present on load
  updateFloatingCartBar();
});

/* UI bind */
function bindUI() {
  $('openCartBtn').addEventListener('click', toggleCart);
  $('closeCartBtn').addEventListener('click', toggleCart);
  $('checkoutBtn').addEventListener('click', proceedToCheckout);
  $('lookupBtn').addEventListener('click', lookupCustomerFromModal);
  $('closeCustomerModalBtn').addEventListener('click', closeCustomerModal);
  $('overlay').addEventListener('click', () => {
    if ($('cartSidebar').classList.contains('open')) toggleCart();
    if ($('customerModal').style.display !== 'none') closeCustomerModal();
    if ($('aboutModal') && $('aboutModal').style.display !== 'none') closeAbout();
    if ($('reelsModal') && $('reelsModal').style.display !== 'none') closeReels();
    if ($('membershipModal') && $('membershipModal').style.display !== 'none') closeMembershipModal();
    if ($('orderSuccessModal') && $('orderSuccessModal').style.display !== 'none') closeOrderSuccessModal();
    if ($('membershipSuccessModal') && $('membershipSuccessModal').style.display !== 'none') closeMembershipSuccessModal();
    if ($('profileModal') && $('profileModal').style.display !== 'none') closeProfileModal();
    if ($('tambolaModal') && $('tambolaModal').style.display !== 'none') closeTambolaModal();
    if ($('sharedTicketModal') && $('sharedTicketModal').style.display !== 'none') closeSharedTicketModal();
    if ($('partnersModal') && $('partnersModal').style.display !== 'none') closePartnersModal();
    if ($('becomePartnerModal') && $('becomePartnerModal').style.display !== 'none') closeBecomePartnerInfo();
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
      <div class="category-grid-item" style="animation-delay:${i * 50}ms"
           onclick="selectCategory('${escapeHtml(c.name)}', this)">
        <img src="${escapeHtml(c.image)}" alt="${escapeHtml(c.name)}" loading="lazy" onerror="this.onerror=null;this.src='assets/placeholder.png';" />
        <div class="category-grid-label">${escapeHtml(c.name)}</div>
      </div>
    `).join('');

    // Build search index silently in background (single request now)
    setTimeout(() => buildSearchIndex(), 300);
  } catch (e) {
    console.error("loadCategories", e);
    $('categoryContainer').innerHTML = `<div style="padding:20px;color:var(--muted)">Failed to load categories. Please try again.</div>`;
  }
}

/* subcategories — pill strip */
async function selectCategory(category, el) {
  selectedCategory = category;
  selectedSubcategory = null;

  // Highlight active category
  document.querySelectorAll('#categoryContainer .category-grid-item').forEach(i => i.classList.remove('active'));
  if (el) el.classList.add('active');

  // Show back button
  $('backToCategoriesBtn').style.display = 'flex';

  // Hide products, show subcategory section
  $('productSection').style.display = 'none';
  $('subcategoryTitle').innerText = category;
  $('subcategorySection').style.display = 'block';
  $('subcategoryContainer').innerHTML = `<div style="padding:10px;color:var(--muted)">Loading...</div>`;

  // Scroll to subcategories smoothly
  setTimeout(() => $('subcategorySection').scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);

  try {
    const res = await apiCall(`/subcategories/${encodeCategory(category)}`);
    let subs = res.subcategories || [];
    if (Array.isArray(res)) subs = res;

    const container = $('subcategoryContainer');
    container.innerHTML = subs.map((s, i) => {
      const name = typeof s === 'string' ? s : s.name;
      const img  = (typeof s === 'string' ? '' : s.image) || DEFAULT_CATEGORY_IMAGE;
      return `
        <div class="category-grid-item" style="animation-delay:${i * 50}ms"
             onclick="selectSubcategory('${escapeHtml(category)}','${escapeHtml(name)}', this)">
          <img src="${escapeHtml(img)}" alt="${escapeHtml(name)}" loading="lazy" onerror="this.onerror=null;this.src='assets/placeholder.png';" />
          <div class="category-grid-label">${escapeHtml(name)}</div>
        </div>
      `;
    }).join('');
  } catch (e) {
    console.error("selectCategory", e);
    $('subcategoryContainer').innerHTML = `<div style="padding:10px;color:var(--muted)">No subcategories found</div>`;
  }
}

/* Shared card builder — groups a flat product list by name into variants and
   renders the same interactive card markup used everywhere (subcategory
   browsing, theme cards, discount tiles, subcategory rows). */
function buildProductCardsHTML(products, idPrefix) {
  const grouped = {};
  products.forEach(p => {
    const key = p.product_name || p['Product Name'];
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(p);
  });

  return Object.keys(grouped).map((name, i) => {
    const variants = grouped[name];
    const first = variants[0];
    const id = `${idPrefix}_${sanitizeId(name)}_${i}`;
    const img = first.image || first.Image || DEFAULT_PRODUCT_IMAGE;
    const firstPrice = first.price || first['Price (INR)'] || 0;
    const firstMemberPrice = first.member_price || first['Member Price (INR)'] || null;
    const priceHTML = buildPriceHTML(firstPrice, firstMemberPrice, `price_${id}`);

    return `
      <div class="product-card ripple-card" id="${id}" style="animation-delay:${i * 70}ms">
        <div class="product-img-wrap">
          <img src="${escapeHtml(img)}" alt="${escapeHtml(name)}" loading="lazy" onerror="this.onerror=null;this.src='assets/placeholder.png';" />
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
}

/* products */
async function selectSubcategory(category, subcat, el) {
  selectedSubcategory = subcat;

  // Highlight active card
  document.querySelectorAll('#subcategoryContainer .category-grid-item').forEach(p => p.classList.remove('active'));
  if (el) el.classList.add('active');

  $('productSection').style.display = 'block';
  $('productTitle').innerText = subcat;
  $('productFilterLabel').style.display = 'none';
  $('productContainer').innerHTML = `<div style="padding:20px;color:var(--muted)">Loading products...</div>`;

  setTimeout(() => $('productSection').scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  try {
    const res = await apiCall(`/products/${encodeCategory(category)}/${encodeCategory(subcat)}`);
    const products = res.products || (Array.isArray(res) ? res : []);
    if (products.length === 0) {
      $('productContainer').innerHTML = `<div style="padding:20px;color:var(--muted)">No products found.</div>`;
      return;
    }
    const container = $('productContainer');
    container.innerHTML = buildProductCardsHTML(products, 'prod');
    container.querySelectorAll('.product-card').forEach(el => { observeCard(el); initRipple(el); });
    scrollToSection('productSection');
  } catch (e) {
    console.error("selectSubcategory", e);
    $('productContainer').innerHTML = `<div style="padding:20px;color:var(--muted)">Error loading products</div>`;
  }
}

/* Renders any filtered product list (theme cards, discount tiles) into the
   same product grid used for normal subcategory browsing. */
function renderFilteredProducts(title, productList) {
  $('categorySection').scrollIntoView; // no-op guard, kept for clarity
  $('subcategorySection').style.display = 'none';
  $('productSection').style.display = 'block';
  $('productTitle').innerText = title;
  $('productFilterLabel').style.display = 'flex';
  $('backToCategoriesBtn').style.display = 'flex';

  const container = $('productContainer');
  if (!productList.length) {
    container.innerHTML = `<div style="padding:20px;color:var(--muted)">No products found here yet.</div>`;
  } else {
    container.innerHTML = buildProductCardsHTML(productList, 'filt');
    container.querySelectorAll('.product-card').forEach(el => { observeCard(el); initRipple(el); });
  }
  $('productSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  updateFloatingCartBar();
}

/* Dismiss a cart banner — stays hidden until the cart is emptied again */
function dismissBanner(id) {
  dismissedBanners.add(id);
  const el = $(id);
  if (el) el.style.display = 'none';
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
    dismissedBanners.clear(); // fresh cart, banners can show again
    return;
  }

  container.innerHTML = cart.map((it, idx) => `
    <div class="cart-item">
      <div class="cart-item-top">
        <div class="cart-item-name">${escapeHtml(it.product_name)}</div>
        <button class="icon-btn" onclick="removeFromCart(${idx})" style="width:28px;height:28px;font-size:0.85rem">
          <span class="icon-x" aria-hidden="true">&times;</span>
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

  // Show/hide banners (unless the user already dismissed them for this cart)
  if (!isActiveMember && memberSavings > 0) {
    if (memberState.status === 'expired') {
      $('renewalBanner').style.display = dismissedBanners.has('renewalBanner') ? 'none' : 'block';
      $('memberSavingsBanner').style.display = 'none';
      $('renewSavingsAmount').textContent = `₹${memberSavings}`;
    } else {
      $('memberSavingsBanner').style.display = dismissedBanners.has('memberSavingsBanner') ? 'none' : 'block';
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

/* Floating bottom cart bar — mirrors the nav cart count/total */
function updateFloatingCartBar() {
  const bar = $('floatingCartBar');
  if (!bar) return;
  const total = cart.reduce((s, i) => s + i.quantity, 0);
  if (total === 0) {
    bar.style.display = 'none';
    document.body.classList.remove('has-floating-cart');
    return;
  }
  const productItems = cart.filter(i => !i._isMembershipFee);
  const subtotal = productItems.reduce((s, i) => s + i.total_price, 0);
  $('floatingCartCount').textContent = total;
  $('floatingCartTotal').textContent = subtotal;
  bar.style.display = 'flex';
  document.body.classList.add('has-floating-cart');
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

/* Remember the customer's mobile number across visits so returning
   customers don't have to type it every time. */
const SAVED_MOBILE_KEY = 'communite_customer_mobile';
function getSavedMobile() {
  try { return localStorage.getItem(SAVED_MOBILE_KEY) || ''; } catch (e) { return ''; }
}
function saveMobile(mobile) {
  try { localStorage.setItem(SAVED_MOBILE_KEY, mobile); } catch (e) { /* storage unavailable — non-critical */ }
}

function openCustomerModal() {
  $('overlay').style.display = 'block';
  $('customerModal').style.display = 'flex';
  $('customerForm').dataset.isNew = 'false';
  $('mobileLookupRow').style.display = 'block';
  $('customerForm').style.display = 'none';
  $('paymentStep').style.display = 'none';

  // Returning customer convenience — prefill + auto-run the lookup
  const savedMobile = getSavedMobile();
  if (savedMobile) {
    $('lookupMobile').value = savedMobile;
    lookupCustomerFromModal();
  }
}

function closeCustomerModal() {
  $('overlay').style.display = 'none';
  $('customerModal').style.display = 'none';
}

/* customer lookup */
async function lookupCustomerFromModal() {
  const mobile = ($('lookupMobile').value || '').trim();
  if (!/^\d{10}$/.test(mobile)) { alert('Please enter a valid 10-digit mobile number'); return; }
  saveMobile(mobile);
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

/* ============ PROFILE / MY ACCOUNT ============ */

function updateAccountNavLabel() {
  const label = $('accountNavLabel');
  if (loggedInCustomer) {
    const firstName = (loggedInCustomer.full_name || '').split(' ')[0] || 'Account';
    label.textContent = firstName;
  } else {
    label.textContent = 'Login';
  }
}

/* Silent lookup on page load if we already know this device's mobile number.
   Populates memberState + the nav badge without opening any modal. */
async function initProfileFromSavedMobile() {
  const mobile = getSavedMobile();
  if (!mobile) return;
  try {
    const res = await apiCall(`/customer/${mobile}`);
    if (res.found) {
      loggedInCustomer = res.customer;
      applyMembershipStatus(res.customer, mobile);
      updateAccountNavLabel();
    }
  } catch (e) {
    console.warn('Silent profile load failed (non-critical):', e);
  }
}

function openProfileModal() {
  $('overlay').style.display = 'block';
  $('profileModal').style.display = 'flex';
  $('profileModal').setAttribute('aria-hidden', 'false');

  if (loggedInCustomer) {
    renderProfileView(loggedInCustomer);
  } else {
    resetProfileLookup();
    const saved = getSavedMobile();
    if (saved) $('profileMobileInput').value = saved;
  }
}

function closeProfileModal() {
  $('overlay').style.display = 'none';
  $('profileModal').style.display = 'none';
  $('profileModal').setAttribute('aria-hidden', 'true');
}

function resetProfileLookup() {
  $('profileLookupStep').style.display = 'block';
  $('profileNotFoundStep').style.display = 'none';
  $('profileViewStep').style.display = 'none';
  toggleEditAddress(false);
}

async function lookupProfile() {
  const mobile = ($('profileMobileInput').value || '').trim();
  if (!/^\d{10}$/.test(mobile)) { alert('Please enter a valid 10-digit mobile number'); return; }

  try {
    const res = await apiCall(`/customer/${mobile}`);
    if (res.found) {
      saveMobile(mobile);
      loggedInCustomer = res.customer;
      applyMembershipStatus(res.customer, mobile);
      updateAccountNavLabel();
      renderProfileView(res.customer);
    } else {
      $('profileLookupStep').style.display = 'none';
      $('profileNotFoundStep').style.display = 'block';
    }
  } catch (e) {
    alert('Error looking up your account. Please try again.');
  }
}

function renderProfileView(c) {
  $('profileLookupStep').style.display = 'none';
  $('profileNotFoundStep').style.display = 'none';
  $('profileViewStep').style.display = 'block';
  toggleEditAddress(false);

  $('profileName').textContent = c.full_name || '—';
  $('profileMobileDisplay').textContent = c.mobile_number || '—';
  $('profileEmail').textContent = c.email || '—';
  $('profileApt').textContent = c.apt_number || '—';
  $('profileCommunity').textContent = c.community || '—';
  $('profileInstructions').textContent = c.delivery_instructions || '—';

  const status = (c.membership_status || '').toLowerCase();
  const badge = $('profileMemberBadge');
  if (status === 'active') {
    badge.style.display = 'flex';
    badge.className = 'profile-member-badge is-active';
    $('profileMemberText').textContent = `👑 Active Member — valid until ${c.membership_expiry ? formatDate(c.membership_expiry) : '—'}`;
  } else if (status === 'pending') {
    badge.style.display = 'flex';
    badge.className = 'profile-member-badge is-pending';
    $('profileMemberText').textContent = '⏳ Membership pending payment verification';
  } else if (status === 'expired') {
    badge.style.display = 'flex';
    badge.className = 'profile-member-badge is-expired';
    $('profileMemberText').textContent = '⚠️ Membership expired — renew to save again';
  } else {
    badge.style.display = 'none';
  }

  loadMyOrders(c.mobile_number);
}

function toggleEditAddress(editing) {
  $('profileAddressView').style.display = editing ? 'none' : 'block';
  $('editAddressBtn').style.display = editing ? 'none' : 'block';
  $('profileAddressEdit').style.display = editing ? 'block' : 'none';

  if (editing && loggedInCustomer) {
    $('editApt').value = loggedInCustomer.apt_number || '';
    $('editCommunity').value = loggedInCustomer.community || '';
    $('editInstructions').value = loggedInCustomer.delivery_instructions || '';
  }
}

async function saveProfileChanges() {
  if (!loggedInCustomer) return;
  const apt = ($('editApt').value || '').trim();
  const community = ($('editCommunity').value || '').trim();
  const instructions = ($('editInstructions').value || '').trim();

  const btn = $('saveProfileBtn');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    const resp = await apiCall('/update-customer', {
      method: 'POST',
      body: JSON.stringify({
        mobile_number: loggedInCustomer.mobile_number,
        apt_number: apt,
        community: community,
        delivery_instructions: instructions
      })
    });
    if (resp.success) {
      loggedInCustomer = { ...loggedInCustomer, apt_number: apt, community: community, delivery_instructions: instructions };
      renderProfileView(loggedInCustomer);
    } else {
      alert('Could not save changes: ' + (resp.message || 'Please try again'));
    }
  } catch (e) {
    alert('Error saving changes. Please try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

function logoutProfile() {
  try { localStorage.removeItem(SAVED_MOBILE_KEY); } catch (e) { /* non-critical */ }
  loggedInCustomer = null;
  memberState = { isMember: false, status: null, plan: null, expiry: null, name: null, mobile: null };
  updateAccountNavLabel();
  const btn = $('memberLoginBtn');
  btn.classList.remove('is-member');
  $('memberLoginLabel').textContent = 'Join Membership';
  resetProfileLookup();
}


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

  renderUpiQr('upiQrContainer', 'upiPayAppBtn', total, 'CommunitE Order');
}

/* Step 2 → Step 1: back to details */
function backToDetailsStep() {
  $('paymentStep').style.display = 'none';
  $('customerForm').style.display = 'block';
}

/* Final submit with RR number */
let isSubmittingOrder = false; // guards against duplicate orders from double-clicks / slow taps
async function submitOrderWithPayment() {
  if (isSubmittingOrder) return;

  const rrNumber = ($('orderRRNumber').value || '').trim();
  if (!rrNumber) {
    alert('Please enter your UPI Transaction ID / RR Number after making the payment');
    return;
  }
  if (!/^\d{12}$/.test(rrNumber)) {
    alert('UPI Transaction ID / RR Number must be exactly 12 digits');
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

  isSubmittingOrder = true;
  const btn = $('confirmOrderBtn');
  const originalBtnHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Confirming...';

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
      cart = [];
      membershipAddedToCart = false;
      membershipFeeAmount = 0;
      selectedMemberPlan = null;
      updateCartCount();
      renderCart();
      $('customerModal').style.display = 'none'; // overlay stays up for the success modal
      showOrderSuccessModal({
        orderId: resp.order_id,
        deliveryDate: formatDate(resp.delivery_date),
        email
      });
    } else {
      alert('Could not submit order: ' + (resp.message || 'Unknown error'));
    }
  } catch (e) {
    alert('Error submitting order. Please try again.');
  } finally {
    isSubmittingOrder = false;
    btn.disabled = false;
    btn.innerHTML = originalBtnHtml;
  }
}

/* Order success modal — mascot, order id, delivery date, email confirmation */
function showOrderSuccessModal({ orderId, deliveryDate, email }) {
  $('successOrderId').textContent = orderId || '—';
  $('successDeliveryDate').textContent = deliveryDate || '—';
  $('successEmail').textContent = email || '—';
  $('overlay').style.display = 'block';
  $('orderSuccessModal').style.display = 'flex';
  $('orderSuccessModal').setAttribute('aria-hidden', 'false');
}

function closeOrderSuccessModal() {
  $('overlay').style.display = 'none';
  $('orderSuccessModal').style.display = 'none';
  $('orderSuccessModal').setAttribute('aria-hidden', 'true');
}

async function silentRefreshProducts() {
  try {
    const data = await apiCall('/categories');
    const cats = (data.categories || data || []).map(c =>
      typeof c === 'string' ? { name: c, image: DEFAULT_CATEGORY_IMAGE } : { name: c.name, image: c.image || DEFAULT_CATEGORY_IMAGE }
    );
    if (!cats.length) return;

    // If user is on product page, refresh prices silently
    if (selectedCategory && selectedSubcategory && $('productSection').style.display !== 'none') {
      const res = await apiCall(`/products/${encodeCategory(selectedCategory)}/${encodeCategory(selectedSubcategory)}`);
      const products = res.products || (Array.isArray(res) ? res : []);
      if (products.length > 0) renderProducts(products);
    }
  } catch (e) {
    console.warn('Silent refresh failed (non-critical):', e);
  }
}

/* ── CONVEYOR BELT ── */
function buildConveyor(cats) {
  const track = $('conveyorTrack');
  if (!track || !cats.length) return;

  // Duplicate items for seamless infinite loop
  const html = [...cats, ...cats].map(c => `
    <div class="conveyor-item" onclick="openCategoryFromConveyor('${escapeHtml(c.name)}')">
      <img src="${escapeHtml(c.image)}" alt="${escapeHtml(c.name)}" loading="lazy" onerror="this.onerror=null;this.src='assets/placeholder.png';" />
      <div class="conveyor-item-label">${escapeHtml(c.name)}</div>
    </div>
  `).join('');
  track.innerHTML = html;

  // Drag to scroll
  const outer = $('conveyorOuter');
  if (!outer) return;
  let isDragging = false, startX = 0, scrollLeft = 0;
  outer.addEventListener('mousedown', e => {
    isDragging = true;
    startX = e.pageX - outer.offsetLeft;
    scrollLeft = outer.scrollLeft;
  });
  outer.addEventListener('mouseleave', () => isDragging = false);
  outer.addEventListener('mouseup', () => isDragging = false);
  outer.addEventListener('mousemove', e => {
    if (!isDragging) return;
    e.preventDefault();
    outer.scrollLeft = scrollLeft - (e.pageX - outer.offsetLeft - startX);
  });
}

/* Category click — show back button */
function openCategoryFromConveyor(categoryName) {
  $('backToCategoriesBtn').style.display = 'flex';
  selectCategory(categoryName, null);
}

/* ── PRODUCT SEARCH ── */
let allProductsCache = [];  // flat list of all products for search

// Called after categories load — build search index with a single bulk call.
// (Previously this fired one request per category and one per subcategory,
// which could be dozens of sequential round-trips and made both search and
// ordinary category/product browsing feel stuck for minutes.)
async function buildSearchIndex() {
  try {
    const res = await apiCall('/all-products');
    const products = res.products || [];
    allProductsCache = products.map(p => ({
      product_name: p.product_name,
      category: p.category,
      subcategory: p.sub_category,
      variant: p.variant,
      price: p.price,
      member_price: p.member_price || null,
      image: p.image || '',
      description: p.description || '',
      tags: p.tags || [],
      member_discount: (typeof p.member_discount === 'number') ? p.member_discount : null
    }));
    renderThemeCards();
    renderFestiveCards();
    renderSubcategoryRows();
  } catch (e) {
    console.warn('Search index build failed (non-critical):', e);
    allProductsCache = [];
  }
}

function handleSearch() {
  const query = ($('searchInput').value || '').trim().toLowerCase();
  const clearBtn = $('searchClear');
  const resultsBox = $('searchResults');

  clearBtn.style.display = query.length > 0 ? 'block' : 'none';

  if (query.length < 3) {
    resultsBox.style.display = 'none';
    return;
  }

  // Filter products whose name contains the query
  const matches = allProductsCache.filter(p =>
    p.product_name.toLowerCase().includes(query)
  );

  // Deduplicate by product name
  const seen = new Set();
  const unique = matches.filter(p => {
    if (seen.has(p.product_name)) return false;
    seen.add(p.product_name);
    return true;
  });

  if (unique.length === 0) {
    resultsBox.innerHTML = `<div class="search-no-results">No products found for "${escapeHtml(query)}"</div>`;
  } else {
    resultsBox.innerHTML = unique.slice(0, 12).map(p => `
      <div class="search-result-item" onclick="openProductFromSearch('${escapeHtml(p.category)}','${escapeHtml(p.subcategory)}')">
        <div>
          <div class="search-result-name">${escapeHtml(p.product_name)}</div>
          <div class="search-result-cat">${escapeHtml(p.category)} › ${escapeHtml(p.subcategory)}</div>
        </div>
        <div class="search-result-price">₹${p.price}</div>
      </div>
    `).join('');
  }
  resultsBox.style.display = 'block';
}

function clearSearch() {
  $('searchInput').value = '';
  $('searchResults').style.display = 'none';
  $('searchClear').style.display = 'none';
}

async function openProductFromSearch(category, subcategory) {
  clearSearch();
  $('backToCategoriesBtn').style.display = 'flex';
  await selectCategory(category, null);
  await selectSubcategory(category, subcategory, null);
}

/* navigation */
function goBackToCategories() {
  selectedCategory = null;
  selectedSubcategory = null;

  // Clear active states
  document.querySelectorAll('#categoryContainer .category-grid-item').forEach(i => i.classList.remove('active'));
  document.querySelectorAll('#subcategoryContainer .category-grid-item').forEach(p => p.classList.remove('active'));

  // Hide subcategories and products
  $('subcategorySection').style.display = 'none';
  $('productSection').style.display = 'none';
  $('productFilterLabel').style.display = 'none';
  $('backToCategoriesBtn').style.display = 'none';

  // Scroll back to category grid
  const shopEl = $('shopSection');
  if (shopEl) shopEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  renderUpiQr('memberUpiQrContainer', 'memberUpiPayAppBtn', amount, `CommunitE ${planLabel} Membership`);
}

/* Submit membership (standalone — not bundled with order) */
let isSubmittingMembership = false; // guards against duplicate membership requests from double-clicks / slow taps
async function submitMembership() {
  if (isSubmittingMembership) return;

  const rrNumber = ($('memberRRNumber').value || '').trim();
  if (!rrNumber) { alert('Please enter your UPI Transaction ID / RR Number'); return; }
  if (!/^\d{12}$/.test(rrNumber)) { alert('UPI Transaction ID / RR Number must be exactly 12 digits'); return; }

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
  const planLabel = selectedMemberPlan === 'annual' ? 'Annual — ₹3,999/year' : 'Monthly — ₹400/month';

  isSubmittingMembership = true;
  const btn = $('submitMembershipBtn');
  const originalBtnHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

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
      closeMembershipModal();
      showMembershipSuccessModal({ plan: planLabel, amount, email });
    } else {
      alert('Could not submit membership: ' + (resp.message || 'Please try again'));
    }
  } catch(e) {
    alert('Error submitting membership. Please try again.');
  } finally {
    isSubmittingMembership = false;
    btn.disabled = false;
    btn.innerHTML = originalBtnHtml;
  }
}

/* Membership success modal — mirrors the order success modal */
function showMembershipSuccessModal({ plan, amount, email }) {
  $('msPlan').textContent = plan || '—';
  $('msAmount').textContent = amount ? `₹${amount}` : '—';
  $('msEmail').textContent = email || '—';
  $('overlay').style.display = 'block';
  $('membershipSuccessModal').style.display = 'flex';
  $('membershipSuccessModal').setAttribute('aria-hidden', 'false');
}

function closeMembershipSuccessModal() {
  $('overlay').style.display = 'none';
  $('membershipSuccessModal').style.display = 'none';
  $('membershipSuccessModal').setAttribute('aria-hidden', 'true');
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

/* Build a upi://pay deep link with the amount pre-filled, render it as a
   QR code into `containerId`, and point the "Pay via UPI App" button at it.
   note: 'note' becomes the transaction note shown in the customer's UPI app. */
function renderUpiQr(containerId, btnId, amount, note) {
  const upiLink = `upi://pay?pa=${encodeURIComponent(UPI_VPA)}&pn=${encodeURIComponent(UPI_PAYEE_NAME)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note || 'CommunitE Order')}`;

  const container = $(containerId);
  if (container) {
    container.innerHTML = '';
    if (window.QRCode) {
      new QRCode(container, { text: upiLink, width: 160, height: 160, correctLevel: QRCode.CorrectLevel.M });
    } else {
      // QR library failed to load — fall back to a plain link so payment isn't blocked
      container.innerHTML = `<a href="${upiLink}" style="font-size:0.8rem;padding:8px;display:block;">Tap to pay ₹${amount}</a>`;
    }
  }

  const btn = $(btnId);
  if (btn) btn.href = upiLink;

  const amountLabel = $('upiPayAmount');
  if (amountLabel) amountLabel.textContent = amount;
}

/* Copy UPI ID */
function copyUPI() {
  navigator.clipboard.writeText(UPI_VPA).then(() => {
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

/* Init ripple on dynamically added cards */
function initCardRipples(container) {
  container.querySelectorAll('.ripple-card').forEach(card => initRipple(card));
}

/* ============ TAMBOLA: TICKET GENERATOR + NUMBER CALLER ============ */

function openTambolaModal() {
  $('overlay').style.display = 'block';
  $('tambolaModal').style.display = 'flex';
  $('tambolaModal').setAttribute('aria-hidden', 'false');
  if (!callerBoardBuilt) buildCallerBoard();
}

function closeTambolaModal() {
  $('overlay').style.display = 'none';
  $('tambolaModal').style.display = 'none';
  $('tambolaModal').setAttribute('aria-hidden', 'true');
}

function switchTambolaTab(tab) {
  $('tambolaTicketsPanel').style.display = tab === 'tickets' ? 'block' : 'none';
  $('tambolaCallerPanel').style.display = tab === 'caller' ? 'block' : 'none';
  $('tambolaRulesPanel').style.display = tab === 'rules' ? 'block' : 'none';
  $('tambolaTabTicketsBtn').classList.toggle('active', tab === 'tickets');
  $('tambolaTabCallerBtn').classList.toggle('active', tab === 'caller');
  $('tambolaTabRulesBtn').classList.toggle('active', tab === 'rules');
}

/* ---------- Ticket generation ---------- */

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* Builds one valid 3x9 Tambola ticket: 15 numbers total, 5 per row,
   numbers bounded by column decade (col0:1-9, col1:10-19 ... col8:80-90).
   Retries on the rare infeasible random layout. */
function generateOneTicket() {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      // 1) how many numbers per column (1-3 each, summing to 15)
      const colCounts = new Array(9).fill(1);
      let remaining = 15 - 9;
      while (remaining > 0) {
        const c = Math.floor(Math.random() * 9);
        if (colCounts[c] < 3) { colCounts[c]++; remaining--; }
      }

      // 2) assign each column's count to distinct rows, respecting each row's capacity of 5
      const rowCap = [5, 5, 5];
      const grid = [new Array(9).fill(false), new Array(9).fill(false), new Array(9).fill(false)];
      const colOrder = shuffleArray([...Array(9).keys()]);

      for (const c of colOrder) {
        const k = colCounts[c];
        const availableRows = [0, 1, 2].filter(r => rowCap[r] > 0);
        if (availableRows.length < k) throw new Error('retry');
        const chosen = shuffleArray([...availableRows]).slice(0, k);
        chosen.forEach(r => { grid[r][c] = true; rowCap[r]--; });
      }
      if (rowCap[0] !== 0 || rowCap[1] !== 0 || rowCap[2] !== 0) throw new Error('retry');

      // 3) fill in actual numbers per column range
      const ticket = [new Array(9).fill(null), new Array(9).fill(null), new Array(9).fill(null)];
      for (let c = 0; c < 9; c++) {
        const lo = c === 0 ? 1 : c * 10;
        const hi = c === 8 ? 90 : c * 10 + 9;
        const pool = [];
        for (let n = lo; n <= hi; n++) pool.push(n);
        shuffleArray(pool);
        const rowsForCol = [0, 1, 2].filter(r => grid[r][c]);
        const picks = pool.slice(0, rowsForCol.length).sort((a, b) => a - b);
        rowsForCol.forEach((r, i) => { ticket[r][c] = picks[i]; });
      }
      return ticket;
    } catch (e) { continue; }
  }
  return null; // extremely unlikely after 50 attempts
}

function renderTicketCanvas(ticket, label) {
  const cellSize = 46;
  const padTop = 40;
  const canvas = document.createElement('canvas');
  canvas.width = cellSize * 9 + 4;
  canvas.height = cellSize * 3 + padTop + 10;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#2f6b4f';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(label || 'CommunitE Tambola', 4, 24);

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 9; c++) {
      const x = 2 + c * cellSize;
      const y = padTop + r * cellSize;
      ctx.strokeStyle = '#999';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, cellSize, cellSize);
      const val = ticket[r][c];
      if (val === null) {
        ctx.fillStyle = '#efece5';
        ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
      } else {
        ctx.fillStyle = '#1a1a1a';
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(val), x + cellSize / 2, y + cellSize / 2 + 1);
      }
    }
  }
  return canvas;
}

async function shareOrDownloadCanvas(canvas, filename) {
  canvas.toBlob(async (blob) => {
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'CommunitE Tambola Ticket' });
        return;
      } catch (e) { /* user cancelled or share failed — fall through to download */ }
    }
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  }, 'image/png');
}

function generateTambolaTickets() {
  const count = Math.max(1, Math.min(12, parseInt($('ticketCount').value, 10) || 6));
  const names = ($('ticketNames').value || '')
    .split(',').map(n => n.trim()).filter(Boolean);

  const output = $('ticketsOutput');
  output.innerHTML = '';

  for (let i = 0; i < count; i++) {
    const ticket = generateOneTicket();
    if (!ticket) continue;
    const label = names[i] ? `Ticket #${i + 1} — ${names[i]}` : `Ticket #${i + 1}`;

    const card = document.createElement('div');
    card.className = 'ticket-card';
    const canvas = renderTicketCanvas(ticket, label);
    card.appendChild(canvas);

    const actions = document.createElement('div');
    actions.className = 'ticket-card-actions';
    const shareBtn = document.createElement('button');
    shareBtn.className = 'btn-secondary';
    shareBtn.innerHTML = '<i class="fas fa-share-nodes"></i> Share Image';
    shareBtn.onclick = () => shareOrDownloadCanvas(canvas, `tambola-ticket-${i + 1}.png`);
    actions.appendChild(shareBtn);

    const linkBtn = document.createElement('button');
    linkBtn.className = 'btn-secondary';
    linkBtn.innerHTML = '<i class="fas fa-link"></i> Send Tappable Link';
    linkBtn.onclick = () => shareTicketLink(ticket, names[i] || '');
    actions.appendChild(linkBtn);

    card.appendChild(actions);

    output.appendChild(card);
  }
}

/* ---------- Number caller ---------- */

let callerBoardBuilt = false;
let callerRemaining = [];
let callerCalled = [];
let callerVoiceEnabled = true;

/* Traditional Housie calls, given an Indian flavour — cricket, Bollywood,
   Hindi number wordplay. Family-friendly throughout. */
const CALLER_LINES = {
  1: "Kelly's Eye", 2: "One Little Duck", 3: "Cup of Tea", 4: "Knock at the Door",
  5: "Man Alive", 6: "Half a Dozen", 7: "Lucky Seven", 8: "Garden Gate",
  9: "Doctor's Orders", 10: "Cock and Hen", 11: "Legs Eleven", 12: "One Dozen",
  13: "Unlucky for Some", 14: "Valentine's Day", 15: "Young and Keen",
  16: "Sweet Sixteen", 17: "Dancing Queen", 18: "Coming of Age",
  19: "Goodbye Teens", 20: "One Score", 21: "Royal Salute",
  22: "Two Little Ducks", 23: "Thee and Me", 24: "Two Dozen", 25: "Duck and Dive",
  26: "Half a Crown", 27: "Gateway to Heaven", 28: "In a State",
  29: "Rise and Shine", 30: "Blind Thirty", 31: "Get Up and Run",
  32: "Buckle My Shoe", 33: "All the Threes", 34: "Ask for More",
  35: "Jump and Jive", 36: "Three Dozen", 37: "More Than Eleven",
  38: "Christmas Cake", 39: "Steps", 40: "Life Begins", 41: "Time for Fun",
  42: "Winnie the Pooh", 43: "Down on Your Knees", 44: "Droopy Drawers",
  45: "Halfway There", 46: "Up to Tricks", 47: "Four and Seven",
  48: "Four Dozen", 49: "PC — Rise and Shine", 50: "Half a Century",
  51: "Tweak of the Thumb", 52: "Weeks in a Year", 53: "Here to There",
  54: "Clean the Floor", 55: "Snakes Alive", 56: "Was She Worth It",
  57: "Heinz Varieties", 58: "Make Them Wait", 59: "Brighton Line",
  60: "Five Dozen", 61: "Baker's Bun", 62: "Turn the Screw", 63: "Tickle Me",
  64: "Red Raw", 65: "Old Age Pension", 66: "Clickety Click",
  67: "Made in Heaven", 68: "Pick a Tick", 69: "Favourite of Mine",
  70: "Three Score and Ten", 71: "Bang on the Drum", 72: "Six Dozen",
  73: "Queen Bee", 74: "Candy Store", 75: "Strive and Strive",
  76: "Trombones", 77: "Sunset Strip", 78: "Heaven's Gate",
  79: "One More Time", 80: "Eight and Blank", 81: "Stop and Run",
  82: "Straight On Through", 83: "Time for Tea", 84: "Seven Dozen",
  85: "Staying Alive", 86: "Between the Sticks", 87: "Torquay in Devon",
  88: "Two Fat Ladies", 89: "Nearly There", 90: "Top of the Shop"
};

function toggleCallerVoice() {
  callerVoiceEnabled = !callerVoiceEnabled;
  $('callerVoiceToggle').textContent = callerVoiceEnabled ? '🔊 Voice On' : '🔇 Voice Off';
  if (!callerVoiceEnabled && window.speechSynthesis) speechSynthesis.cancel();
}

function speakCalledNumber(num, line) {
  if (!callerVoiceEnabled || !window.speechSynthesis) return;
  try {
    speechSynthesis.cancel(); // don't let announcements pile up if tapped quickly
    const utterance = new SpeechSynthesisUtterance(`${num}! ${line}`);
    utterance.rate = 0.95;
    speechSynthesis.speak(utterance);
  } catch (e) { /* speech not supported — fail silently, line still shows visually */ }
}

function buildCallerBoard() {
  const board = $('callerBoard');
  board.innerHTML = '';
  for (let n = 1; n <= 90; n++) {
    const cell = document.createElement('div');
    cell.className = 'caller-cell';
    cell.id = `callerCell${n}`;
    cell.textContent = n;
    board.appendChild(cell);
  }
  callerBoardBuilt = true;
  newCallerGame();
}

function newCallerGame() {
  callerRemaining = Array.from({ length: 90 }, (_, i) => i + 1);
  callerCalled = [];
  document.querySelectorAll('.caller-cell').forEach(c => c.classList.remove('called'));
  $('callerCurrentNumber').textContent = '—';
  $('callerLineText').textContent = '';
  $('callerStatus').textContent = '0 of 90 numbers called';
  if (window.speechSynthesis) speechSynthesis.cancel();
}

function callNextNumber() {
  if (callerRemaining.length === 0) { alert('All 90 numbers have been called!'); return; }
  const idx = Math.floor(Math.random() * callerRemaining.length);
  const num = callerRemaining.splice(idx, 1)[0];
  callerCalled.push(num);
  const line = CALLER_LINES[num] || '';
  const display = $('callerCurrentNumber');
  display.textContent = num;
  display.classList.remove('pop');
  void display.offsetWidth; // restart animation even if same number is called consecutively
  display.classList.add('pop');
  spawnConfetti(display);
  $('callerLineText').textContent = line;
  $('callerStatus').textContent = `${callerCalled.length} of 90 numbers called`;
  const cell = $(`callerCell${num}`);
  if (cell) cell.classList.add('called');
  speakCalledNumber(num, line);
}

/* Small emoji confetti burst around the caller number display */
function spawnConfetti(anchorEl) {
  const emojis = ['🎉', '✨', '🎊', '⭐'];
  for (let i = 0; i < 6; i++) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    piece.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    const angle = (Math.random() * 360) * (Math.PI / 180);
    const dist = 40 + Math.random() * 30;
    piece.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
    piece.style.setProperty('--rot', `${(Math.random() * 360) - 180}deg`);
    piece.style.left = '50%';
    piece.style.top = '50%';
    anchorEl.appendChild(piece);
    setTimeout(() => piece.remove(), 950);
  }
}

function undoLastCall() {
  if (callerCalled.length === 0) return;
  const num = callerCalled.pop();
  callerRemaining.push(num);
  const cell = $(`callerCell${num}`);
  if (cell) cell.classList.remove('called');
  $('callerCurrentNumber').textContent = callerCalled.length ? callerCalled[callerCalled.length - 1] : '—';
  $('callerStatus').textContent = `${callerCalled.length} of 90 numbers called`;
}

/* ---------- Tappable ticket links (interactive, no backend needed) ---------- */

/* Ticket grid <-> compact URL-safe string. 27 cells, blanks as empty tokens. */
function encodeTicket(ticket) {
  return ticket.flat().map(v => (v === null ? '' : v)).join(',');
}
function decodeTicket(str) {
  const tokens = str.split(',');
  if (tokens.length !== 27) return null;
  const vals = tokens.map(t => (t === '' ? null : parseInt(t, 10)));
  return [vals.slice(0, 9), vals.slice(9, 18), vals.slice(18, 27)];
}

function buildTicketShareUrl(ticket, name) {
  const base = `${location.origin}${location.pathname}`;
  const params = new URLSearchParams();
  params.set('t', encodeTicket(ticket));
  if (name) params.set('n', name);
  return `${base}?${params.toString()}`;
}

async function shareTicketLink(ticket, name) {
  const url = buildTicketShareUrl(ticket, name);
  const shareText = name
    ? `${name}'s CommunitE Tambola ticket — tap to open and cross off numbers as they're called! 🎲`
    : `Your CommunitE Tambola ticket — tap to open and cross off numbers as they're called! 🎲`;

  if (navigator.share) {
    try {
      await navigator.share({ title: 'CommunitE Tambola Ticket', text: shareText, url });
      return;
    } catch (e) { /* user cancelled — fall through to clipboard */ }
  }
  try {
    await navigator.clipboard.writeText(url);
    alert('Link copied! Paste it into WhatsApp to send.');
  } catch (e) {
    prompt('Copy this link to share:', url);
  }
}

/* Renders a tappable grid into `container` — clicking a filled cell toggles a crossed-off look. */
function renderInteractiveTicketGrid(container, ticket) {
  container.innerHTML = '';
  ticket.flat().forEach(val => {
    const cell = document.createElement('div');
    if (val === null) {
      cell.className = 'iticket-cell blank';
    } else {
      cell.className = 'iticket-cell';
      cell.textContent = val;
      cell.onclick = () => cell.classList.toggle('crossed');
    }
    container.appendChild(cell);
  });
}

function closeSharedTicketModal() {
  $('overlay').style.display = 'none';
  $('sharedTicketModal').style.display = 'none';
  $('sharedTicketModal').setAttribute('aria-hidden', 'true');
}

/* Checked once on page load — if this URL was opened from a shared ticket
   link, show the interactive ticket immediately instead of the normal site. */
function checkForSharedTicketLink() {
  const params = new URLSearchParams(location.search);
  const t = params.get('t');
  if (!t) return;
  const ticket = decodeTicket(t);
  if (!ticket) return;
  const name = params.get('n');
  $('sharedTicketTitle').textContent = name ? `🎉 ${name}'s Tambola Ticket` : '🎉 Your Tambola Ticket';
  renderInteractiveTicketGrid($('sharedTicketGrid'), ticket);
  $('overlay').style.display = 'block';
  $('sharedTicketModal').style.display = 'flex';
  $('sharedTicketModal').setAttribute('aria-hidden', 'false');
}

/* ============ MY ORDERS (Profile page) ============ */

async function loadMyOrders(mobile) {
  const list = $('myOrdersList');
  const emptyMsg = $('myOrdersEmptyMsg');
  list.innerHTML = '';
  emptyMsg.style.display = 'none';
  if (!mobile) return;

  try {
    const res = await apiCall(`/customer-orders/${mobile}`);
    if (!res.success || !res.orders || res.orders.length === 0) {
      emptyMsg.style.display = 'block';
      return;
    }
    res.orders.forEach(o => {
      const card = document.createElement('div');
      card.className = 'my-order-card';
      card.innerHTML = `
        <div class="my-order-top">
          <strong>${o.order_id || '—'}</strong>
          <span>₹${o.total_amount || '—'}</span>
        </div>
        <p class="my-order-items">${(o.items || '').replace(/\n/g, '<br>')}</p>
        <p class="my-order-dates">Ordered ${o.timestamp ? formatDate(o.timestamp) : '—'} · Delivery ${o.delivery_date ? formatDate(o.delivery_date) : '—'}</p>
      `;
      list.appendChild(card);
    });
  } catch (e) {
    console.warn('Could not load orders:', e);
    emptyMsg.style.display = 'block';
  }
}

/* ============ COMMUNITY PARTNERS DIRECTORY ============ */

let partnersCache = [];
let featuredPartnerNameForClick = '';

function openPartnersModal() {
  $('overlay').style.display = 'block';
  $('partnersModal').style.display = 'flex';
  $('partnersModal').setAttribute('aria-hidden', 'false');
  showPartnersListView();
  loadPartnersDirectory();
}

function closePartnersModal() {
  $('overlay').style.display = 'none';
  $('partnersModal').style.display = 'none';
  $('partnersModal').setAttribute('aria-hidden', 'true');
}

function showPartnersListView() {
  $('partnersListView').style.display = 'block';
  $('partnerDetailView').style.display = 'none';
}

async function loadPartnersDirectory() {
  const grid = $('partnersGrid');
  const emptyMsg = $('partnersEmptyMsg');
  try {
    const res = await apiCall('/partners');
    if (!res.success || !res.partners || res.partners.length === 0) {
      grid.innerHTML = '';
      emptyMsg.style.display = 'block';
      return;
    }
    partnersCache = res.partners;
    emptyMsg.style.display = 'none';
    grid.innerHTML = '';
    partnersCache.forEach((p, i) => {
      const card = document.createElement('div');
      card.className = 'partner-card';
      card.onclick = () => showPartnerDetail(i);
      card.innerHTML = `
        <div class="partner-card-photo" style="${p.photo_url ? `background-image:url('${p.photo_url}')` : ''}">${p.photo_url ? '' : '🏪'}</div>
        <p class="partner-card-name">${p.vendor_name || 'Vendor'}</p>
        <p class="partner-card-category">${p.category || ''}</p>
      `;
      grid.appendChild(card);
    });
    renderFeaturedPartnerBanner();
  } catch (e) {
    console.warn('Could not load partners:', e);
    emptyMsg.style.display = 'block';
  }
}

function showPartnerDetail(index) {
  const p = partnersCache[index];
  if (!p) return;
  $('partnersListView').style.display = 'none';
  $('partnerDetailView').style.display = 'block';

  const photoEl = $('partnerDetailPhoto');
  photoEl.style.backgroundImage = p.photo_url ? `url('${p.photo_url}')` : '';
  photoEl.textContent = p.photo_url ? '' : '🏪';
  $('partnerDetailName').textContent = p.vendor_name || 'Vendor';
  $('partnerDetailCategory').textContent = p.category || '';
  $('partnerDetailStory').textContent = p.story || '';

  const contactBtn = $('partnerDetailContact');
  contactBtn.href = p.contact_link || '#';
  if ((p.contact_link || '').includes('wa.me') || (p.contact_link || '').includes('whatsapp')) {
    contactBtn.textContent = 'Message on WhatsApp';
  } else if ((p.contact_link || '').includes('instagram')) {
    contactBtn.textContent = 'View on Instagram';
  } else {
    contactBtn.textContent = 'Contact Vendor';
  }
}

function showPartnerDetailByName(name) {
  if (!name) return;
  const idx = partnersCache.findIndex(p => p.vendor_name === name);
  if (idx >= 0) showPartnerDetail(idx);
}

function renderFeaturedPartnerBanner() {
  const featured = partnersCache.find(p => p.featured);
  const banner = $('featuredPartnerBanner');
  if (!featured) { banner.style.display = 'none'; return; }

  featuredPartnerNameForClick = featured.vendor_name;
  $('featuredPartnerName').textContent = featured.vendor_name || 'Vendor';
  $('featuredPartnerCategory').textContent = featured.category || '';
  const photoEl = $('featuredPartnerPhoto');
  photoEl.src = featured.photo_url || '';
  photoEl.style.display = featured.photo_url ? 'block' : 'none';
  banner.style.display = 'flex';
}

/* Load the featured partner (if any) right on page boot, so it shows on the
   homepage without requiring anyone to open the directory first. */
async function loadFeaturedPartnerOnBoot() {
  try {
    const res = await apiCall('/partners');
    if (res.success && res.partners) {
      partnersCache = res.partners;
      renderFeaturedPartnerBanner();
    }
  } catch (e) { /* non-critical */ }
}

/* ---- "Become a partner" shareable application link ---- */
function openBecomePartnerInfo() {
  const url = `${location.origin}${location.pathname.replace(/index\.html$/, '')}apply-vendor.html`;
  $('partnerApplyLinkInput').value = url;
  $('overlay').style.display = 'block';
  $('becomePartnerModal').style.display = 'flex';
  $('becomePartnerModal').setAttribute('aria-hidden', 'false');
}

function closeBecomePartnerInfo() {
  $('overlay').style.display = 'none';
  $('becomePartnerModal').style.display = 'none';
  $('becomePartnerModal').setAttribute('aria-hidden', 'true');
}

async function copyPartnerApplyLink() {
  const url = $('partnerApplyLinkInput').value;
  try {
    await navigator.clipboard.writeText(url);
    alert('Link copied!');
  } catch (e) {
    prompt('Copy this link:', url);
  }
}



const TAG_DISPLAY_MAP = {
  'best seller': { title: '🔥 Best Sellers', color: '#e8395a' },
  'the elite': { title: '💪 Healthy Superpowers', color: '#2d8a5e' },
  'daily handful': { title: '🥜 Daily Handful', color: '#d4a017' },
};
const TAG_FALLBACK_COLORS = ['#5a4fcf', '#e07b00', '#2f9e8f', '#c8395a', '#3d6b52'];
const MEMBER_DISCOUNT_THEME_THRESHOLD = 20;

function renderThemeCards() {
  const row = $('themeCardsRow');
  if (!allProductsCache || allProductsCache.length === 0) { row.innerHTML = ''; return; }

  // Collect unique tags, case-insensitively, preserving a display label
  const tagMap = new Map(); // lowercase key -> original-case label
  allProductsCache.forEach(p => {
    (p.tags || []).forEach(t => {
      const key = t.toLowerCase();
      if (!tagMap.has(key)) tagMap.set(key, t);
    });
  });

  let cardsHTML = '';
  let colorIdx = 0;
  tagMap.forEach((label, key) => {
    const known = TAG_DISPLAY_MAP[key];
    const title = known ? known.title : `✨ ${label}`;
    const color = known ? known.color : TAG_FALLBACK_COLORS[colorIdx++ % TAG_FALLBACK_COLORS.length];
    const matches = allProductsCache.filter(p => (p.tags || []).some(t => t.toLowerCase() === key) && p.image);
    cardsHTML += buildThemeCardHTML(title, color, matches, `filterByTag('${escapeHtml(key)}', '${escapeHtml(title.replace(/'/g, ""))}')`);
  });

  const hasDiscountDeals = allProductsCache.some(p => (p.member_discount || 0) >= MEMBER_DISCOUNT_THEME_THRESHOLD);
  if (hasDiscountDeals) {
    const dealMatches = allProductsCache.filter(p => (p.member_discount || 0) >= MEMBER_DISCOUNT_THEME_THRESHOLD && p.image);
    cardsHTML += buildThemeCardHTML(`⭐ Member Deals ${MEMBER_DISCOUNT_THEME_THRESHOLD}%+ Off`, '#1a5c3a', dealMatches, 'filterByMemberDiscountTheme()');
  }

  row.innerHTML = cardsHTML;
}

/* Builds one theme card with a 2x2 collage of distinct matching product photos
   (deduped by product name) so cards don't all show the same repeated image. */
function buildThemeCardHTML(title, color, matches, onclickCall) {
  const seen = new Set();
  const unique = matches.filter(p => {
    if (seen.has(p.product_name)) return false;
    seen.add(p.product_name);
    return true;
  });
  const photos = shuffleArray([...unique]).slice(0, 4);
  const collageHTML = photos.map(p =>
    `<img class="theme-card-collage-img" src="${escapeHtml(p.image)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'" />`
  ).join('');

  return `
    <div class="theme-card" style="background:${color}" onclick="${onclickCall}">
      <p class="theme-card-title">${escapeHtml(title)}</p>
      <div class="theme-card-collage">${collageHTML}</div>
    </div>`;
}

function filterByTag(tagKey, title) {
  const filtered = allProductsCache.filter(p =>
    (p.tags || []).some(t => t.toLowerCase() === tagKey)
  );
  renderFilteredProducts(title, filtered);
}

/* ============ FESTIVE THEME CARDS (from "Festive - <Name>" tags) ============ */

const FESTIVE_DISPLAY_MAP = {
  'raksha bandhan': { title: '🎗️ Raksha Bandhan', color: '#e85d75', message: 'Sweet gifts for the bond that matters.' },
  'diwali':         { title: '🪔 Diwali',          color: '#e07b00', message: 'Light up your celebrations.' },
  'christmas':      { title: '🎄 Christmas',       color: '#0f4c3a', message: 'Festive treats for the season.' },
  'durga pooja':    { title: '🪘 Durga Pooja',     color: '#b83227', message: 'Celebrate the festival of Shakti.' },
  'new year':       { title: '🎊 New Year',        color: 'var(--rd-purple)', message: 'Sweet beginnings for the year ahead.' },
};
const FESTIVE_FALLBACK_COLORS = ['#a0522d', '#6b8e23', '#8e44ad', '#c0392b', '#16697a'];

function renderFestiveCards() {
  const section = $('festiveCardsSection');
  const row = $('festiveCardsRow');
  if (!allProductsCache || allProductsCache.length === 0) { section.style.display = 'none'; return; }

  // Collect "Festive - <Name>" tags, grouped by the festival name after the hyphen
  const festivalMap = new Map(); // lowercase festival name -> display label
  allProductsCache.forEach(p => {
    (p.tags || []).forEach(t => {
      const match = t.match(/^festive\s*-\s*(.+)$/i);
      if (match) {
        const name = match[1].trim();
        const key = name.toLowerCase();
        if (!festivalMap.has(key)) festivalMap.set(key, name);
      }
    });
  });

  if (festivalMap.size === 0) { section.style.display = 'none'; return; }

  let cardsHTML = '';
  let colorIdx = 0;
  festivalMap.forEach((label, key) => {
    const known = FESTIVE_DISPLAY_MAP[key];
    const title = known ? known.title : `🎉 ${label}`;
    const color = known ? known.color : FESTIVE_FALLBACK_COLORS[colorIdx++ % FESTIVE_FALLBACK_COLORS.length];
    const matches = allProductsCache.filter(p =>
      (p.tags || []).some(t => t.toLowerCase() === `festive - ${key}` || t.toLowerCase() === `festive-${key}`) && p.image
    );
    if (matches.length === 0) return;
    cardsHTML += buildThemeCardHTML(title, color, matches, `filterByFestival('${escapeHtml(key)}', '${escapeHtml(title.replace(/'/g, ""))}')`);
  });

  if (!cardsHTML) { section.style.display = 'none'; return; }
  section.style.display = 'block';
  row.innerHTML = cardsHTML;
}

function filterByFestival(festivalKey, title) {
  const filtered = allProductsCache.filter(p =>
    (p.tags || []).some(t => {
      const m = t.match(/^festive\s*-\s*(.+)$/i);
      return m && m[1].trim().toLowerCase() === festivalKey;
    })
  );
  renderFilteredProducts(title, filtered);
}

function filterByMemberDiscountTheme() {
  const filtered = allProductsCache.filter(p => (p.member_discount || 0) >= MEMBER_DISCOUNT_THEME_THRESHOLD);
  renderFilteredProducts(`⭐ Member Deals ${MEMBER_DISCOUNT_THEME_THRESHOLD}%+ Off`, filtered);
}

/* ============ DISCOUNT TIER TILES ============ */

function filterByDiscountTier(min, max, title) {
  const filtered = allProductsCache.filter(p =>
    typeof p.member_discount === 'number' && p.member_discount >= min && p.member_discount <= max
  );
  renderFilteredProducts(title, filtered);
}

/* ============ SUBCATEGORY ROWS (endless scroll, shuffled) ============ */

function renderSubcategoryRows() {
  const section = $('subcategoryRowsSection');
  if (!allProductsCache || allProductsCache.length === 0) { section.innerHTML = ''; return; }

  const groups = {}; // "category|||subcategory" -> products[]
  allProductsCache.forEach(p => {
    const key = `${p.category}|||${p.subcategory}`;
    if (!groups[key]) groups[key] = { category: p.category, subcategory: p.subcategory, products: [] };
    groups[key].products.push(p);
  });

  const rows = shuffleArray(Object.values(groups));

  section.innerHTML = rows.map((row, rowIdx) => {
    // Pass the full variant list (not de-duped) so the card's variant
    // dropdown, quantity stepper, and Add button all work exactly like
    // the main shop grid.
    const cardsHTML = buildProductCardsHTML(row.products, `subrow${rowIdx}`);
    return `
      <div class="subcategory-row">
        <h3 class="subrow-title">${escapeHtml(row.subcategory)}</h3>
        <div class="subrow-scroll">${cardsHTML}</div>
      </div>`;
  }).join('');

  section.querySelectorAll('.product-card').forEach(el => { observeCard(el); initRipple(el); });
}
