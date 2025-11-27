/* =====================================================
   CommunitE — Animated Frontend (Option A2)
   Hero + floating category cards + scroll stagger + tilt
===================================================== */

const apiBase = "https://nutte-communite-994718298855.asia-south1.run.app";
const DELIVERY_CHARGE = 50;

let cart = [];
let selectedCategory = null;
let selectedSubcategory = null;

/* FALLBACK IMAGES */
const DEFAULT_CATEGORY_IMAGE = "https://images.unsplash.com/photo-1503602642458-232111445657";
const DEFAULT_SUBCATEGORY_IMAGE = "https://images.unsplash.com/photo-1501004318641-b39e6451bec6";
const DEFAULT_PRODUCT_IMAGE = "assets/placeholder.png";

/* DOM Helper */
const $ = (id) => document.getElementById(id);
const escapeHtml = (s) => (s||"").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] ));
function sanitizeId(s){ return (s||"").replace(/[^a-z0-9]/gi,'_').toLowerCase(); }
function scrollToSection(id){ const el=$(id); if(el) el.scrollIntoView({behavior:'smooth'}); }

/* API wrapper */
async function apiCall(endpoint, options={}){
  const res = await fetch(`${apiBase}/api${endpoint}`, {
    headers:{'Content-Type':'application/json'},
    ...options
  });
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}

/* =====================================================
   INITIALIZATION
===================================================== */
document.addEventListener("DOMContentLoaded", () => {
  bindUI();
  loadCategories();
  initScrollAnimations();
  initTiltEffects();
});

/* Topbar actions */
function bindUI(){
  $('openCartBtn').onclick = toggleCart;
  $('closeCartBtn').onclick = toggleCart;

  $('checkoutBtn').onclick = proceedToCheckout;
  $('backToCategoriesBtn').onclick = goBackToCategories;

  $('lookupBtn').onclick = lookupCustomerFromModal;
  $('closeCustomerModalBtn').onclick = closeCustomerModal;

  $('customerForm').addEventListener('submit', submitOrder);
}

/* =====================================================
   SCROLL ANIMATION STAGGER
===================================================== */
function initScrollAnimations(){
  const observer = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        entry.target.classList.add("card-animated");
      }
    });
  },{
    threshold:0.2
  });

  // Apply to future nodes dynamically
  window.observeCard = (el) => observer.observe(el);
}

/* =====================================================
   MOBILE TILT EFFECT
===================================================== */
function initTiltEffects(){
  document.addEventListener("pointermove", (e)=>{
    const targets = document.querySelectorAll(".category-card, .subcat-card, .product-card");
    targets.forEach(el=>{
      const rect = el.getBoundingClientRect();
      if(rect.top < window.innerHeight && rect.bottom > 0){
        const dx = (e.clientX - rect.left) / rect.width - 0.5;
        const dy = (e.clientY - rect.top) / rect.height - 0.5;
        const rotateX = dy * 6;
        const rotateY = dx * -6;
        el.style.transform = `translateY(-4px) scale(1.04) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
      }
    });
  });

  document.addEventListener("pointerleave", ()=>{
    const targets = document.querySelectorAll(".category-card, .subcat-card, .product-card");
    targets.forEach(el=>{
      el.style.transform = "";
    });
  });
}

/* =====================================================
   LOAD CATEGORIES
===================================================== */
async function loadCategories(){
  const res = await apiCall('/categories');
  const cats = res.categories || [];
  const container = $('categoryContainer');

  container.innerHTML = cats.map((c,i)=>`
    <div class="category-card" style="animation-delay:${i*80}ms"
      onclick="selectCategory('${escapeHtml(c.name)}')">
      <img src="${c.image || DEFAULT_CATEGORY_IMAGE}">
      <div class="category-card-title">${c.name}</div>
    </div>
  `).join('');

  container.querySelectorAll(".category-card").forEach(el => observeCard(el));
}

/* =====================================================
   LOAD SUBCATEGORIES
===================================================== */
async function selectCategory(category){
  selectedCategory = category;
  $('subcategorySection').style.display='block';
  $('productSection').style.display='none';
  $('subcategoryTitle').innerText = category;
  $('backToCategoriesBtn').style.display='inline-flex';

  const res = await apiCall(`/subcategories/${encodeURIComponent(category)}`);
  const subs = res.subcategories || [];
  const container = $('subcategoryContainer');

  container.innerHTML = subs.map((s,i)=>`
    <div class="subcat-card" style="animation-delay:${i*80}ms"
      onclick="selectSubcategory('${escapeHtml(category)}','${escapeHtml(s.name)}')">
      <img src="${s.image || DEFAULT_SUBCATEGORY_IMAGE}">
      <div class="subcat-title">${s.name}</div>
    </div>
  `).join('');

  container.querySelectorAll(".subcat-card").forEach(el => observeCard(el));
  scrollToSection('subcategorySection');
}

/* =====================================================
   LOAD PRODUCTS
===================================================== */
async function selectSubcategory(category, subcat){
  selectedSubcategory = subcat;
  $('productSection').style.display='block';
  $('productTitle').innerText = subcat;

  const res = await apiCall(`/products/${encodeURIComponent(category)}/${encodeURIComponent(subcat)}`);
  const products = res.products || [];

  const grouped = {};
  products.forEach(p=>{
    if(!grouped[p.product_name]) grouped[p.product_name]=[];
    grouped[p.product_name].push(p);
  });

  const container = $('productContainer');
  const keys = Object.keys(grouped);

  container.innerHTML = keys.map((name,i)=>{
    const variants = grouped[name];
    const first = variants[0];
    const id = `prod_${sanitizeId(name)}_${i}`;
    return `
      <div class="product-card" id="${id}" style="animation-delay:${i*80}ms">
        <img src="${first.image || DEFAULT_PRODUCT_IMAGE}">
        <div class="product-title">${name}</div>
        <div class="product-desc">${escapeHtml(first.description||'')}</div>

        <div class="controls-row">
          <select id="variant_${id}" class="variant-select"
            onchange="updateProductDisplay('${id}')">
            ${variants.map(v=>`
              <option value="${v.variant}" data-price="${v.price}"
                data-img="${v.image||''}" data-desc="${escapeHtml(v.description||'')}">
                ${v.variant} - ₹${v.price}
              </option>
            `).join('')}
          </select>

          <div class="qty-control">
            <button onclick="changeQuantity('${id}',-1)">-</button>
            <input id="qty_${id}" value="1" min="1">
            <button onclick="changeQuantity('${id}',1)">+</button>
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;">
          <div class="product-price" id="price_${id}">₹${variants[0].price}</div>
          <button class="add-btn" onclick="addToCartFromCard('${id}','${escapeHtml(name)}')">
            Add
          </button>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll(".product-card").forEach(el => observeCard(el));

  scrollToSection('productSection');
}

/* update price + image on variant change */
function updateProductDisplay(id){
  const sel = $(`variant_${id}`);
  const opt = sel.options[sel.selectedIndex];
  $(`price_${id}`).innerText = `₹${opt.dataset.price}`;
  const img = opt.dataset.img;
  const desc = opt.dataset.desc;

  if(img) document.querySelector(`#${id} img`).src = img;
  document.querySelector(`#${id} .product-desc`).innerText = desc || "";
}

/* quantity helpers */
function changeQuantity(id,delta){
  const el = $(`qty_${id}`);
  let v = parseInt(el.value||1);
  v = Math.max(1,Math.min(99,v+delta));
  el.value = v;
}

/* =====================================================
   CART + CHECKOUT (unchanged logic)
===================================================== */
function addToCartFromCard(id,name){
  const qty = parseInt($(`qty_${id}`).value||1);
  const sel = $(`variant_${id}`);
  const variant = sel.value;
  const price = parseFloat(sel.options[sel.selectedIndex].dataset.price);
  addToCart(name,variant,price,qty);
  showCartToast(`${qty} x ${name}`);
}

function addToCart(name,variant,price,qty){
  const idx = cart.findIndex(i => i.product_name===name && i.variant===variant);
  if(idx>-1){
    cart[idx].quantity += qty;
    cart[idx].total_price = cart[idx].quantity * cart[idx].price;
  } else {
    cart.push({product_name:name,variant,price,quantity:qty,total_price:price*qty});
  }
  renderCart();
}

function renderCart(){
  $('cartCount').innerText = cart.reduce((t,i)=>t+i.quantity,0);

  if(cart.length===0){
    $('cartContent').innerHTML = `<div class="empty-cart"><p>Your cart is empty</p></div>`;
    $('cartFooter').style.display="none";
    return;
  }

  $('cartContent').innerHTML = cart.map((i,idx)=>`
    <div class="cart-item">
      <div style="display:flex;justify-content:space-between">
        <div class="name">${i.product_name}</div>
        <button onclick="removeFromCart(${idx})">&times;</button>
      </div>
      <div class="meta">${i.variant}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
        <div>
          <button class="btn-secondary" onclick="updateCartQuantity(${idx},${i.quantity-1})">-</button>
          <span style="padding:0 8px;font-weight:700">${i.quantity}</span>
          <button class="btn-secondary" onclick="updateCartQuantity(${idx},${i.quantity+1})">+</button>
        </div>
        <div style="font-weight:800">₹${i.total_price}</div>
      </div>
    </div>
  `).join('');

  $('cartFooter').style.display="block";
  const subtotal = cart.reduce((t,i)=>t+i.total_price,0);
  $('cartSubtotal').innerText=subtotal;
  $('cartTotal').innerText=subtotal+DELIVERY_CHARGE;
}

function removeFromCart(i){ cart.splice(i,1); renderCart(); }
function updateCartQuantity(i,qty){
  if(qty<=0) return removeFromCart(i);
  cart[i].quantity=qty;
  cart[i].total_price=qty*cart[i].price;
  renderCart();
}

function toggleCart(){
  const sidebar = $('cartSidebar');
  const overlay = $('overlay');
  const isOpen = sidebar.classList.contains('open');
  sidebar.classList.toggle('open');
  overlay.style.display = isOpen ? "none" : "block";
}

/* =====================================================
   CHECKOUT
===================================================== */
function proceedToCheckout(){
  if(cart.length===0) return alert("Your cart is empty");
  toggleCart();
  openCustomerModal();
}

function openCustomerModal(){
  $('overlay').style.display="block";
  $('customerModal').style.display="block";
  $('mobileLookupRow').style.display="block";
  $('customerForm').style.display="none";
}

function closeCustomerModal(){
  $('overlay').style.display="none";
  $('customerModal').style.display="none";
}

async function lookupCustomerFromModal(){
  const mobile = $('lookupMobile').value.trim();
  if(!/^\d{10}$/.test(mobile)) return alert("Enter valid mobile");

  const res = await apiCall(`/customer/${mobile}`);

  $('mobileLookupRow').style.display="none";
  $('customerForm').style.display="block";

  if(res.found){
    const c = res.customer;
    $('fullName').value = c.full_name;
    $('mobileNumber').value = c.mobile_number;
    $('email').value = c.email;
    $('aptNumber').value = c.apt_number;
    $('community').value = c.community;
    $('deliveryInstructions').value = c.delivery_instructions || "";
  } else {
    $('mobileNumber').value = mobile;
  }
}

async function submitOrder(e){
  e.preventDefault();

  const payload = {
    customer:{
      full_name:$('fullName').value,
      mobile_number:$('mobileNumber').value,
      email:$('email').value,
      apt_number:$('aptNumber').value,
      community:$('community').value
    },
    cart,
    subtotal:cart.reduce((t,i)=>t+i.total_price,0),
    delivery_charge:DELIVERY_CHARGE,
    total_amount:cart.reduce((t,i)=>t+i.total_price,0) + DELIVERY_CHARGE,
    delivery_instructions:$('deliveryInstructions').value||""
  };

  const r = await apiCall('/submit-order',{method:'POST',body:JSON.stringify(payload)});
  if(r.success){
    alert(`Order placed! ID: ${r.order_id}`);
    cart=[]; renderCart();
    closeCustomerModal();
  } else {
    alert("Failed: "+r.message);
  }
}

/* Toast */
function showCartToast(msg){
  const t=document.createElement("div");
  t.textContent=msg;
  t.style.cssText=`
    position:fixed;right:20px;bottom:120px;
    background:#28a745;color:white;
    padding:12px;border-radius:10px;
    box-shadow:0 6px 20px rgba(0,0,0,.2);
    z-index:2000;font-weight:600;
  `;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(),2200);
}

/* Back nav */
function goBackToCategories(){
  $('subcategorySection').style.display='none';
  $('productSection').style.display='none';
  $('backToCategoriesBtn').style.display='none';
  scrollToSection('categorySection');
}
