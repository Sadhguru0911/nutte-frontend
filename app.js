/* ======================================
   CATEGORY IMAGE FALLBACKS
   - If backend doesn't return image yet
   - These elegant placeholders prevent broken UI
====================================== */
const DEFAULT_CATEGORY_IMAGE = "https://images.unsplash.com/photo-1601004890684-d8cbf643f5f2";
const DEFAULT_SUBCATEGORY_IMAGE = "https://images.unsplash.com/photo-1587732662419-1fc4ed414a04";

/* ======================================
   LOAD CATEGORIES (WITH IMAGES)
====================================== */
async function loadCategories() {
  const res = await apiCall('/categories');
  const categories = res.categories || [];

  const container = document.getElementById('categoryContainer');

  container.innerHTML = categories.map(cat => `
    <div class="category-card" onclick="selectCategory('${cat.name}')">
       <img src="${cat.image || DEFAULT_CATEGORY_IMAGE}" alt="${cat.name}">
       <div class="category-card-title">${cat.name}</div>
    </div>
  `).join('');
}

/* ======================================
   LOAD SUBCATEGORIES (WITH IMAGES)
====================================== */
async function selectCategory(category) {
  selectedCategory = category;

  document.getElementById('subcategorySection').style.display = 'block';
  document.getElementById('subcategoryTitle').innerText = category;

  const res = await apiCall(`/subcategories/${encodeURIComponent(category)}`);
  const subs = res.subcategories || [];

  const container = document.getElementById('subcategoryContainer');

  container.innerHTML = subs.map(sub => `
    <div class="subcat-card" onclick="selectSubcategory('${category}', '${sub.name}')">
        <img src="${sub.image || DEFAULT_SUBCATEGORY_IMAGE}" alt="${sub.name}">
        <div class="subcat-title">${sub.name}</div>
    </div>
  `).join('');

  scrollToSection('subcategorySection');
}
