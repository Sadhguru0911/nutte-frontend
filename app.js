// Chatbot class definition and initialization
class NuttyChatbot {
    constructor() {
	// Setup chatbot state variables
        this.currentStep = 'greeting';
        this.customerType = null;
        this.currentCustomer = null;
        this.cart = [];
        this.selectedCategory = null;
        this.selectedSubCategory = null;
        this.apiBase = "https://nutte-backend.onrender.com"; // Backend API base URL
        this.DELIVERY_CHARGE = 50; // Fixed delivery charge
        
	// Setup event listeners and update cart UI on start
        this.initializeEventListeners();
        this.updateCartDisplay();
    }


 // 👇 Add this inside
   showLandingGreeting() {
        this.addBotMessage(
            "👋 Hi! Welcome to CommunitE. Are you a new customer or a returning customer?",
            `
            <div class="customer-type-buttons">
                <button class="btn btn-primary" id="newCustomerBtn" onclick="window.chatbot.selectCustomerType('new')">
                    🆕 New Customer
                </button>
                <button class="btn btn-secondary" id="returningCustomerBtn" onclick="window.chatbot.selectCustomerType('returning')">
                    🔄 Returning Customer
                </button>
            </div>
            `
        );
    }

    initializeEventListeners() {
	// Send message on Enter key in input
        document.getElementById('messageInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });

       // Submit order on form submit
        document.getElementById('customerForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitOrder();
        });

        // Attach checkout button click event
        document.getElementById('checkoutBtn')?.addEventListener('click', () => {
            this.proceedToCheckout();
        });

        // Update floating cart count on cart changes
        const observer = new MutationObserver(() => {
            const cartCount = document.getElementById('cartCount').textContent;
            document.getElementById('floatingCartCount').textContent = cartCount;
        });
        observer.observe(document.getElementById('cartCount'), { characterData: true, childList: true, subtree: true });
    }

    async apiCall(endpoint, options = {}) {
        // Generic API caller method
        try {
            const response = await fetch(`${this.apiBase}/api${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API call failed:', error);
            this.addBotMessage(`An error occurred: ${error.message}. Please try again.`);
            throw error;
        }
    }

    async selectCustomerType(type) {
        // Set customer type and display input or category options
        this.customerType = type;
        const chatContainer = document.getElementById('chatContainer');
        
        // Remove the initial customer type buttons
        const initialButtons = chatContainer.querySelector('.customer-type-buttons');
        if(initialButtons) {
            initialButtons.remove();
        }

        if (type === 'returning') {
            this.addUserMessage("I'm a returning customer.");
            this.addBotMessage(
                "Great! Please enter your mobile number so I can look up your details.",
                this.createMobileInputForm()
            );
        } else {
            this.addUserMessage("I'm a new customer.");
            this.addBotMessage(
                "Welcome to CommunitE! Let's start by browsing our product categories.",
                await this.createCategoryButtons()
            );
        }
        this.scrollToBottom();
    }

    createMobileInputForm() {
        // Returns HTML input form to collect mobile number from returning customer
        return `
            <div class="mobile-input-form">
                <div class="form-group">
                    <input type="tel" id="mobileInput" placeholder="Enter your mobile number" 
		   	 maxlength="10"
	                 pattern="\\d{10}"
	                 oninput="this.value = this.value.replace(/[^\\d]/g, '')"
        	         title="Enter a 10-digit mobile number"
                         style="width: 100%; padding: 0.75rem; border: 2px solid #e9ecef; border-radius: 12px; margin-bottom: 1rem;">
                    <button class="btn btn-primary" onclick="window.chatbot.lookupCustomer()">
                        <i class="fas fa-search"></i> Look Up
                    </button>
                </div>
            </div>
        `;
    }

    async lookupCustomer() {
        // Lookup existing customer based on mobile number
        const mobileInput = document.getElementById('mobileInput');
        const mobileNumber = mobileInput.value.trim();
        
        if (!mobileNumber) {
            alert('Please enter your mobile number');
            return;
        }

        this.showLoading();
        
        try {
            const response = await this.apiCall(`/customer/${mobileNumber}`);
            
            if (response.found) {
                this.currentCustomer = response.customer;
                this.addBotMessage(
                    `Welcome back, ${response.customer.full_name}! 🎉\n\nI found your details:\n📱 ${response.customer.mobile_number}\n🏠 ${response.customer.apt_number}, ${response.customer.community}\n📧 ${response.customer.email}\n\nLet's start shopping!`,
                    await this.createCategoryButtons()
                );
            } else {
                this.addBotMessage(
                    "I couldn't find your details in our system. Let's proceed as a new customer.",
                    await this.createCategoryButtons()
                );
                this.customerType = 'new';
            }
        } catch (error) {
            this.addBotMessage("Sorry, there was an error looking up your details. Let's proceed as a new customer.");
            this.customerType = 'new';
        } finally {
            this.hideLoading();
            this.scrollToBottom();
        }
    }

    async createCategoryButtons() {
  try {
    const response = await this.apiCall('/categories');
    const categories = response.categories;

    let buttonsHtml = '<div class="slider-container">';
    categories.forEach(category => {
      buttonsHtml += `
        <button class="category-btn" onclick="window.chatbot.selectCategory('${category}')">
          <i class="fas fa-leaf"></i>
          <div style="margin-top: 0.5rem; font-weight: 600;">${category}</div>
        </button>
      `;
    });
    buttonsHtml += '</div>';

    return buttonsHtml;
  } catch (error) {
    return '<p>Sorry, I couldn\'t load the categories. Please try again.</p>';
  }
}


    async selectCategory(category) {
	// Handle category selection and display subcategories
        this.selectedCategory = category;
        this.addUserMessage(`I'd like to browse ${category}`);
        
        this.showLoading();

	// Show the floating "Back to Categories" button
	document.getElementById('backToCategoriesBtn').style.display = 'flex';
        
        try {
            const response = await this.apiCall(`/subcategories/${encodeURIComponent(category)}`);
            const subcategories = response.subcategories;
            
            let buttonsHtml = `
               <button class="back-btn" onclick="window.chatbot.goBackToCategories()">
                   <i class="fas fa-arrow-left"></i> Back to Categories
               </button>
               <div class="slider-container">
            `;
		
            subcategories.forEach(subcategory => {
                buttonsHtml += `
                    <button class="subcategory-btn" onclick="window.chatbot.selectSubCategory('${subcategory}')">
                        <i class="fas fa-tags"></i>
                        <div style="margin-top: 0.5rem; font-weight: 600;">${subcategory}</div>
                    </button>
                `;
            });
            buttonsHtml += '</div>';
            
            this.addBotMessage(
                `Great choice! Here are the ${category} subcategories:`,
                buttonsHtml
            );
        } catch (error) {
            this.addBotMessage("Sorry, I couldn't load the subcategories. Please try again.");
        } finally {
            this.hideLoading();
            this.scrollToBottom();
        }
    }

    async selectSubCategory(subcategory) {
    this.selectedSubCategory = subcategory;
    this.addUserMessage(`Show me ${subcategory}`);
    
    this.showLoading();
    
    try {
        const response = await this.apiCall(`/products/${encodeURIComponent(this.selectedCategory)}/${encodeURIComponent(subcategory)}`);
        const products = response.products;
        
        let productsHtml = `
            <button class="back-btn" onclick="window.chatbot.goBackToSubCategories()">
                <i class="fas fa-arrow-left"></i> Back to ${this.selectedCategory}
            </button>
            <div class="slider-container">
        `;
        
        const groupedProducts = {};
        products.forEach(product => {
            if (!groupedProducts[product.product_name]) {
                groupedProducts[product.product_name] = [];
            }
            groupedProducts[product.product_name].push(product);
        });
        
        Object.keys(groupedProducts).forEach(productName => {
            const variants = groupedProducts[productName];
            const firstVariant = variants[0];
            const uniqueProductId = productName.replace(/[^a-zA-Z0-9]/g, '_');

            productsHtml += `
                <div class="product-card-grouped">
                    <div class="product-top-section">
                        <div class="product-image-container-grouped">
                            <img id="img_${uniqueProductId}" src="${firstVariant.image || 'placeholder.png'}" alt="${productName}" class="product-thumbnail-grouped">
                        </div>
                        <div class="product-header-details">
                            <h3 class="product-title-grouped">${productName}</h3>
                            <a href="#" class="description-link" onclick="event.preventDefault(); window.chatbot.showDescription('${uniqueProductId}')">Description</a>
                        </div>
                    </div>
                    
                    <div class="product-bottom-section">
                        <div class="controls-grid">
                            <select id="variant_${uniqueProductId}" class="variant-select" onchange="window.chatbot.updateProductDisplay('${uniqueProductId}')">
            `;
            
            variants.forEach(variant => {
                productsHtml += `
                    <option value="${variant.variant}" 
                            data-price="${variant.price}"
                            data-image="${variant.image || ''}"
                            data-description="${variant.description || 'No description available.'}">
                        ${variant.variant}
                    </option>
                `;
            });

            productsHtml += `
                            </select>

                            <div id="price_${uniqueProductId}" class="product-price-grouped">₹${firstVariant.price}</div>

                            <div class="quantity-controls">
                                <button class="quantity-btn" onclick="window.chatbot.changeQuantity('qty_${uniqueProductId}', -1)">-</button>
                                <input type="number" class="quantity-input" id="qty_${uniqueProductId}" value="1" min="1">
                                <button class="quantity-btn" onclick="window.chatbot.changeQuantity('qty_${uniqueProductId}', 1)">+</button>
                            </div>
                            
                            <button class="add-to-cart-btn-grouped" onclick="window.chatbot.addToCartFromDropdown('${uniqueProductId}')">
                                <i class="fas fa-cart-plus"></i> Add to Cart
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        
        productsHtml += '</div>';
        
        this.addBotMessage(`Here are our ${subcategory} products:`, productsHtml);
    } catch (error) {
        this.addBotMessage("Sorry, I couldn't load the products. Please try again.");
    } finally {
        this.hideLoading();
        this.scrollToBottom();
    }
}

    addToCartFromDropdown(uniqueProductId) {
        // Extract product variant and quantity from dropdown UI and add to cart
        const variantSelect = document.getElementById(`variant_${uniqueProductId}`);
        const selectedOption = variantSelect.options[variantSelect.selectedIndex];
        const variant = selectedOption.value;
        const price = parseFloat(selectedOption.dataset.price);
        const productName = uniqueProductId.replace(/_/g, ' '); // Convert back to original name

        const qtyInput = document.getElementById(`qty_${uniqueProductId}`);
        const quantity = parseInt(qtyInput.value) || 1;
        
        this.addToCart(productName, variant, price, quantity);
    }

    async goBackToCategories() {
        // Return to category selection and hide back button
        this.selectedCategory = null;
        this.selectedSubCategory = null;
        // Hide the floating back button
        document.getElementById('backToCategoriesBtn').style.display = 'none';
        this.addBotMessage(
            "Let's choose a category:",
            await this.createCategoryButtons()
        );
        this.scrollToBottom();
    }

    async goBackToSubCategories() {
        // Return to subcategory list of the selected category
        this.selectedSubCategory = null;
        // We need to re-select the category to show its subcategories
        this.addUserMessage(`Back to ${this.selectedCategory}`);
        await this.selectCategory(this.selectedCategory);
        this.scrollToBottom();
    }

    changeQuantity(elementId, change) {
        // Adjust quantity input (increment or decrement
        const qtyInput = document.getElementById(elementId);
        if (qtyInput) {
            let currentQty = parseInt(qtyInput.value) || 1;
            currentQty += change;
            if (currentQty < 1) currentQty = 1;
            if (currentQty > 10) currentQty = 10;
            qtyInput.value = currentQty;
        }
    }

    addToCart(productName, variant, price, quantity) {
        // Add product to cart or update existing item
        const existingItemIndex = this.cart.findIndex(item => 
            item.product_name === productName && item.variant === variant
        );
        
        if (existingItemIndex > -1) {
            this.cart[existingItemIndex].quantity += quantity;
            this.cart[existingItemIndex].total_price = this.cart[existingItemIndex].quantity * price;
        } else {
            this.cart.push({
                product_name: productName,
                variant: variant,
                price: price,
                quantity: quantity,
                total_price: quantity * price
            });
        }
        
        this.updateCartDisplay();
        this.showCartNotification(productName, variant, quantity);
    }

    removeFromCart(index) {
        // Remove item from cart at given index
        this.cart.splice(index, 1);
        this.updateCartDisplay();
    }

    updateCartQuantity(index, newQuantity) {
        // Update quantity of product in cart and refresh display
        if (newQuantity <= 0) {
            this.removeFromCart(index);
        } else {
            this.cart[index].quantity = newQuantity;
            this.cart[index].total_price = newQuantity * this.cart[index].price;
            this.updateCartDisplay();
        }
    }

    updateCartDisplay() {
        // Render the cart content and update subtotal, total, UI visibility
        const cartCountElement = document.getElementById('cartCount');
        const floatingCartCountElement = document.getElementById('floatingCartCount');
        const cartContent = document.getElementById('cartContent');
        const cartFooter = document.getElementById('cartFooter');
        const cartSubtotalElement = document.getElementById('cartSubtotal');
        const cartTotalElement = document.getElementById('cartTotal');
        
        const totalItems = this.cart.reduce((sum, item) => sum + item.quantity, 0);
        let subtotalAmount = this.cart.reduce((sum, item) => sum + item.total_price, 0);
        let totalAmount = subtotalAmount;

        if (subtotalAmount > 0) {
            totalAmount += this.DELIVERY_CHARGE;
        }
        
        cartCountElement.textContent = totalItems;
        floatingCartCountElement.textContent = totalItems; // Update floating cart count
        
        if (this.cart.length === 0) {
            cartContent.innerHTML = `
                <div class="empty-cart">
                    <i class="fas fa-shopping-cart"></i>
                    <p>Your cart is empty</p>
                    <small>Add some delicious items to get started!</small>
                </div>
            `;
            cartFooter.style.display = 'none';
        } else {
            let cartHtml = '';
            this.cart.forEach((item, index) => {
                cartHtml += `
                    <div class="cart-item">
                        <div class="cart-item-header">
                            <div class="cart-item-name">${item.product_name}</div>
                            <button class="cart-item-remove" onclick="window.chatbot.removeFromCart(${index})">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <div class="cart-item-details">${item.variant}</div>
                        <div class="cart-item-footer">
                            <div class="cart-item-quantity">
                                <button class="quantity-btn" onclick="window.chatbot.updateCartQuantity(${index}, ${item.quantity - 1})">-</button>
                                <span>${item.quantity}</span>
                                <button class="quantity-btn" onclick="window.chatbot.updateCartQuantity(${index}, ${item.quantity + 1})">+</button>
                            </div>
                            <div class="cart-item-price">₹${item.total_price}</div>
                        </div>
                    </div>
                `;
            });
            
            cartContent.innerHTML = cartHtml;
            cartSubtotalElement.textContent = subtotalAmount;
            cartTotalElement.textContent = totalAmount;
            cartFooter.style.display = 'block';
        }
    }

    showCartNotification(productName, variant, quantity) {
        // Display temporary toast message after product is added
        const message = `Added ${quantity}x ${productName} (${variant}) to cart!`;
        
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 1rem;
            border-radius: 8px;
            z-index: 9999;
            animation: slideInRight 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    toggleCart() {
        // Open or close cart sidebar
        const cartSidebar = document.getElementById('cartSidebar');
        const overlay = document.getElementById('overlay');
        
        cartSidebar.classList.toggle('open');
        overlay.classList.toggle('active');
    }

    proceedToCheckout() {
        // Handle flow to show customer info modal before submitting order
        if (this.cart.length === 0) {
            alert('Your cart is empty!');
            return;
        }
        
        this.toggleCart(); // Close cart
        
        if (this.customerType === 'returning' && this.currentCustomer) {
            this.showCustomerModal(this.currentCustomer);
        } else {
            this.showCustomerModal();
        }
    }

    showCustomerModal(customerData = null) {
        // Display customer info form in modal
        const modal = document.getElementById('customerModal');
        const form = document.getElementById('customerForm');

        if (customerData) {
            form.elements['fullName'].value = customerData.full_name || '';
            form.elements['mobileNumber'].value = customerData.mobile_number || '';
            form.elements['email'].value = customerData.email || '';
            form.elements['aptNumber'].value = customerData.apt_number || '';
            form.elements['community'].value = customerData.community || '';
            form.elements['deliveryInstructions'].value = customerData.delivery_instructions || '';
        } else {
            form.reset(); // Clear form for new customer
        }
        
        modal.classList.add('active');
        document.getElementById('overlay').classList.add('active');
    }

    closeCustomerModal() {
        // Hide customer info modal
        document.getElementById('customerModal').classList.remove('active');
        document.getElementById('overlay').classList.remove('active');
    }

    async submitOrder() {
        // Validate customer form and submit final order to backend
        const form = document.getElementById('customerForm');
        const formData = new FormData(form);
        const customerInfo = Object.fromEntries(formData.entries());

        if (!customerInfo.fullName || !customerInfo.mobileNumber || !customerInfo.email || !customerInfo.aptNumber || !customerInfo.community) {
            alert('Please fill in all required fields.');
            return;
        }

        this.showLoading();

        const orderDetails = {
            customer: {
                full_name: customerInfo.fullName,
                mobile_number: customerInfo.mobileNumber,
                email: customerInfo.email,
                apt_number: customerInfo.aptNumber,
                community: customerInfo.community
            },
            cart: this.cart,
            subtotal: this.cart.reduce((sum, item) => sum + item.total_price, 0),
            delivery_charge: this.DELIVERY_CHARGE,
            total_amount: this.cart.reduce((sum, item) => sum + item.total_price, 0) + this.DELIVERY_CHARGE,
            delivery_note: "* Deliveries beyond 10km from Old Wipro Office, Sarjapur Main Road will be charged based on actuals.",
            delivery_instructions: customerInfo.deliveryInstructions
        };

        try {
            const response = await this.apiCall('/submit-order', {
                method: 'POST',
                body: JSON.stringify(orderDetails)
            });

            if (response.success) {
                this.addBotMessage(
                    `🎉 Order Submitted Successfully! 🎉\n\n` +
                    `🆔 Your Unique Order ID: <strong>${response.order_id}</strong>\n` +
                    `📅 Order Cycle Closes: ${response.order_cycle}\n` +
                    `🚚 Estimated Delivery Date: ${response.delivery_date}\n` +
                    `💰 Total Amount: ₹${response.total_amount}\n\n` +
                    `Your Order:\n` +
                    this.cart.map(item => `${item.product_name} - ${item.variant} x ${item.quantity} = ₹${item.total_price}`).join('\n') +
                    `\n\nDelivery Charge: ₹${this.DELIVERY_CHARGE}\n` +
                    `\n\n${orderDetails.delivery_note}\n\n` +
                    `Thank you for choosing CommunitE! A confirmation email has been sent to you.`,
                    `<button class="btn btn-primary btn-full" onclick="window.chatbot.resetChat()">
                        <i class="fas fa-redo"></i> Place Another Order
                    </button>`
                );
                this.cart = []; // Clear cart after successful order
                this.updateCartDisplay();
                this.closeCustomerModal();
            } else {
                this.addBotMessage(`Sorry, there was an error submitting your order: ${response.message || 'Unknown error'}. Please try again.`);
            }
        } catch (error) {
            // Error is already handled in apiCall
        } finally {
            this.hideLoading();
            this.scrollToBottom();
        }
    }

    resetChat() {
        // This function will reload the page to restart the chat from the beginning.
        window.location.reload();
    }

    addBotMessage(text, buttonsHtml = '') {
        // Add message from bot to chat interface
        const chatContainer = document.getElementById('chatContainer');
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'bot-message');
        messageDiv.innerHTML = `
            <div class="message-avatar">
                <img src="assets/NuttE_edited.png" alt="NuttE">
            </div>
            <div class="message-content">
                <div class="message-text">${text.replace(/\n/g,'<br>')}</div>
                ${buttonsHtml}
            </div>
        `;
        chatContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    addUserMessage(text) {
        // Add user's message to chat interface
        const chatContainer = document.getElementById('chatContainer');
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'user-message');
        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="message-text">${text}</div>
            </div>
            <div class="message-avatar">
                <img src="assets/user-icon.png" alt="User">
            </div>
        `;
        chatContainer.appendChild(messageDiv );
        this.scrollToBottom();
    }


     showDescription(uniqueProductId) {
        const variantSelect = document.getElementById(`variant_${uniqueProductId}`);
        const selectedOption = variantSelect.options[variantSelect.selectedIndex];
        const description = selectedOption.dataset.description || "No description available.";
        const image = selectedOption.dataset.image || "";

        const modal = document.createElement('div');
        modal.classList.add('modal', 'active');
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Product Details</h2>
                    <button class="close-btn" onclick="this.closest('.modal').remove(); document.getElementById('overlay').classList.remove('active');">&times;</button>
                </div>
                <div class="modal-body">
                    ${image ? `<img src="${image}" alt="Product Image" style="max-width:100%; border-radius:8px; margin-bottom:15px;">` : ""}
                    <p>${description}</p>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        document.getElementById('overlay').classList.add('active');
    }

updateProductDisplay(uniqueProductId) {
    const variantSelect = document.getElementById(`variant_${uniqueProductId}`);
    const selectedOption = variantSelect.options[variantSelect.selectedIndex];
    
    // Update the price
    const priceElement = document.getElementById(`price_${uniqueProductId}`);
    priceElement.textContent = `₹${selectedOption.dataset.price}`;
    
    // Update the image
    const imageElement = document.getElementById(`img_${uniqueProductId}`);
    if (selectedOption.dataset.image) {
        imageElement.src = selectedOption.dataset.image;
    }
}




   async sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const text = messageInput.value.trim().toLowerCase();
    if (text) {
        this.addUserMessage(text);
        messageInput.value = '';
        this.scrollToBottom();

        // 👇 Greeting reset
        if (text === "hi" || text === "hello" || text === "hey") {
            this.showLandingGreeting();
            return;
        }

        // 🛒 Catalogue / Prices
        if (text.includes("catalogue") || text.includes("price") || text.includes("cataloge") ||text.includes("rate")) {
            this.addBotMessage("🛒 You can browse our catalogue by clicking categories below.",
        await this.createCategoryButtons());
            return;
        }


        // 🚚 Delivery info
        if (text.includes("delivery")) {
            this.addBotMessage("🚚 We deliver every Thursday. The order cycle closes on Wednesday night.");
            return;
        }

        // 💳 Payment info
        if (text.includes("payment")) {
            this.addBotMessage("💳 We accept UPI, you can please make payment after delivery.");
            return;
        }

        // 📦 Order status
        if (text.includes("order status") || text.includes("order")) {
            this.addBotMessage("📦 Please contact our Team CommunitE on WhatsApp @ 8951048013 to get the details of your order status. 🙏");
            return;
        }

	// 📞 Contact Us
        if (text.includes("contact")) {
            this.addBotMessage("📞 You can reach Team CommunitE on WhatsApp @ <b>8951048013</b>. We’ll be happy to help! 🙏");
            return;
        }

        // 🆘 Help command
        if (text.includes("help")) {
            this.addBotMessage(
                "Hmm, here’s what I can help you with:<br><br>" +
                "🛒 Catalogue & Prices<br>" +
                "🚚 Delivery details<br>" +
                "💳 Payments<br>" +
                "📦 Order status<br>" +
                "📞 Contact Us<br><br>" +
                "👉 Just type what you’d like to know!"
            );
            return;
        }

        // 👇 Fallback
        this.addBotMessage(
            "Hmm, I couldn’t quite get that. You can ask me about:<br><br>" +
            "🛒 Catalogue & Prices<br>" +
            "🚚 Delivery details<br>" +
            "💳 Payments<br>" +
            "📦 Order status<br>" +
            "📞 Contact Us<br><br>" +
            "Or just type <b>Help</b> to see options again."
        );
    }
}



    showLoading() {
        document.getElementById('loading').style.display = 'flex';
    }

    hideLoading() {
        // Hide loading spinner
        document.getElementById('loading').style.display = 'none';
    }

    scrollToBottom() {
        const chatContainer = document.getElementById('chatContainer');
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
}


// Global functions for HTML onclicks
function selectCustomerType(type) {
    chatbot.selectCustomerType(type);
}

function toggleCart() {
    chatbot.toggleCart();
}

function proceedToCheckout() {
    chatbot.proceedToCheckout();
}

function closeCustomerModal() {
    chatbot.closeCustomerModal();
}

function sendMessage() {
    chatbot.sendMessage();
}


// On page load, initialize the chatbot and setup customer type buttons
document.addEventListener("DOMContentLoaded", () => {
window.chatbot = new NuttyChatbot(); // initialize chatbot after DOM is ready

    const returningBtn = document.getElementById("returningCustomerBtn");
    const newBtn = document.getElementById("newCustomerBtn");

    if (returningBtn) {
        returningBtn.addEventListener("click", () => {
            chatbot.selectCustomerType("returning");
        });
    }

    if (newBtn) {
        newBtn.addEventListener("click", () => {
            chatbot.selectCustomerType("new");
        });
    }

	const closeModalBtn = document.getElementById	("closeCustomerModalBtn");
    if (closeModalBtn) {
        closeModalBtn.addEventListener("click", () => {
            chatbot.closeCustomerModal();
        });
    }
});



