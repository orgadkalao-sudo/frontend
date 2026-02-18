// ==========================================
// SNEAKERS PRO - MAIN JAVASCRIPT
// ==========================================

// ==========================================
// CONFIGURATION TMONEY PERSONNEL
// ==========================================

// REMPLACEZ CES VALEURS PAR VOS VRAIES INFOS
const TMONEY_CONFIG = {
    // Votre numéro Tmoney personnel (reçoit les paiements)
    MERCHANT_PHONE: '93469090', // ← REMPLACEZ par votre numéro sans le 228
    
    // Votre nom qui apparaîtra sur le reçu client
    MERCHANT_NAME: 'SNEAKER PRO',
    
    // Mode: 'auto' (tente USSD push) ou 'manual' (client compose)
    MODE: 'manual', // ← Pour compte perso, utilisez 'manual'
    
    // Codes USSD par opérateur
    USSD_CODES: {
        tmoney: '*145*2*{{montant}}*{{numero}}#', // Transfert Tmoney
        flooz: '*155*2*{{montant}}*{{numero}}#'    // Transfert Flooz
    }
};

// URL de votre backend (à créer sur Render/Railway/Heroku)
const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000' 
    : 'https://snk7s3v.onrender.com'; // ← REMPLACEZ par votre URL

// ==============================
// DONNÉES STORE
// ==============================

const Store = {
    products: [
        { id: 1, name: "Nike Air Max 90", category: "sport", price: 45000, stock: 15, emoji: "👟", description: "Baskets sport confort" },
        { id: 2, name: "Mocassin Cuir", category: "homme", price: 35000, stock: 10, emoji: "👞", description: "Style classe" },
        { id: 3, name: "Escarpins", category: "sandales", price: 28000, stock: 12, emoji: "👞", description: "Élégance totale" }
    ],

    cart: [],
    orders: [],
    settings: {
        name: "Sneakers Pro",
        phone: "+22800000000",
        deliveryFee: 2000
    }
};


// ==============================
// AFFICHAGE PRODUITS
// ==============================

function renderProducts() {
    const grid = document.getElementById("productsGrid");
    if (!grid) return;

    grid.innerHTML = Store.products.map(p => `
        <div class="product-card">
            <div class="product-img">${p.emoji}</div>
            <h3>${p.name}</h3>
            <p>${formatPrice(p.price)}</p>
            <button onclick="addToCart(${p.id})">Ajouter au panier</button>
        </div>
    `).join("");
}


// ==============================
// PANIER
// ==============================

function addToCart(id) {
    const product = Store.products.find(p => p.id === id);
    if (!product) return;

    const existing = Store.cart.find(i => i.id === id);

    if (existing) {
        existing.quantity++;
    } else {
        Store.cart.push({ ...product, quantity: 1 });
    }

    updateCart();
    showToast("Produit ajouté");
}

function updateCart() {
    const container = document.getElementById("cartItems");
    if (!container) return;

    if (Store.cart.length === 0) {
        container.innerHTML = "<p>Panier vide</p>";
        updateCartTotal();
        return;
    }

    container.innerHTML = Store.cart.map(item => `
        <div class="cart-item">
            <span>${item.name}</span>
            <span>${item.quantity}</span>
            <button onclick="updateQuantity(${item.id},1)">+</button>
            <button onclick="updateQuantity(${item.id},-1)">-</button>
        </div>
    `).join("");

    updateCartTotal();
}

function updateQuantity(id, change) {
    const item = Store.cart.find(i => i.id === id);
    if (!item) return;

    item.quantity += change;

    if (item.quantity <= 0) {
        removeFromCart(id);
    } else {
        updateCart();
    }
}

function removeFromCart(id) {
    Store.cart = Store.cart.filter(i => i.id !== id);
    updateCart();
}

function updateCartTotal() {
    const total = Store.cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const el = document.getElementById("cartTotal");
    if (el) el.textContent = formatPrice(total);
}


// ==============================
// AFFICHAGE PANIER
// ==============================

function toggleCart() {
    document.getElementById("cartSidebar")?.classList.toggle("active");
    document.getElementById("overlay")?.classList.toggle("active");
}


// ==============================
// PAIEMENT TMONEY PERSONNEL
// ==============================

function processPayment() {
    const phoneInput = document.getElementById('phoneNumber');
    const btn = document.querySelector('.confirm-payment');
    
    // Récupération et nettoyage du numéro client
    let clientPhone = phoneInput.value.trim().replace(/\s/g, '');
    
    // Validation stricte numéro togolais
    if (!validateTogoPhone(clientPhone)) {
        alert('❌ Numéro invalide\nFormat: XXXXXXXX ou XXXXXXXX (8 chiffres)');
        phoneInput.focus();
        return;
    }
    
    // Format complet avec indicatif
    clientPhone = '228' + clientPhone;
    
    // Calcul total
    const totalAmount = Store.cart.reduce(
        (sum, item) => sum + (item.price * item.quantity), 
        0
    );
    
    // Générer code de confirmation unique
    const confirmationCode = generateConfirmationCode();
    
    // Créer la commande
    const order = {
        id: 'CMD' + Date.now(),
        items: [...Store.cart],
        total: totalAmount,
        clientPhone: clientPhone,
        merchantPhone: '228' + TMONEY_CONFIG.MERCHANT_PHONE,
        confirmationCode: confirmationCode,
        status: 'en_attente',
        date: new Date().toISOString(),
        paymentMethod: selectedPaymentMethod
    };
    
    // Sauvegarder en localStorage (en attendant confirmation)
    savePendingOrder(order);
    
    // Afficher instructions selon le mode
    if (TMONEY_CONFIG.MODE === 'manual') {
        showManualPaymentInstructions(order, totalAmount, confirmationCode);
    } else {
        initiateAutoPayment(order, totalAmount, btn);
    }
}

// NOUVELLE FONCTION - Validation numéro Togo
function validateTogoPhone(phone) {
    // Enlève tous les caractères non numériques
    const cleaned = phone.replace(/\D/g, '');
    
    // Vérifie format: commence par 90,91,92,93,70,71,72,73 et a 8 chiffres
    const regex = /^(90|91|92|93|70|71|72|73)\d{6}$/;
    
    return regex.test(cleaned);
}

// NOUVELLE FONCTION - Générer code confirmation
function generateConfirmationCode() {
    // Code à 6 chiffres aléatoire
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// NOUVELLE FONCTION - Sauvegarder commande en attente
function savePendingOrder(order) {
    let pendingOrders = JSON.parse(localStorage.getItem('sneaker_pending_orders') || '[]');
    pendingOrders.push(order);
    localStorage.setItem('sneaker_pending_orders', JSON.stringify(pendingOrders));
}

// NOUVELLE FONCTION - Afficher instructions manuelles
function showManualPaymentInstructions(order, amount, code) {
    const modal = document.getElementById('paymentModal');
    const ussdCode = selectedPaymentMethod === 'tmoney' 
        ? TMONEY_CONFIG.USSD_CODES.tmoney
            .replace('{{montant}}', amount)
            .replace('{{numero}}', TMONEY_CONFIG.MERCHANT_PHONE)
        : TMONEY_CONFIG.USSD_CODES.flooz
            .replace('{{montant}}', amount)
            .replace('{{numero}}', TMONEY_CONFIG.MERCHANT_PHONE);
    
    // Remplacer le contenu du modal par instructions
    modal.querySelector('.payment-content').innerHTML = `
        <div class="manual-payment-instructions" style="padding: 30px; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 20px;">📱</div>
            <h3 style="margin-bottom: 20px; color: var(--dark);">Effectuez le transfert</h3>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 12px; margin-bottom: 20px; text-align: left;">
                <p style="margin-bottom: 15px;"><strong>Étapes:</strong></p>
                <ol style="padding-left: 20px; line-height: 2;">
                    <li>Composez: <code style="background: white; padding: 2px 8px; border-radius: 4px; font-size: 16px;">${ussdCode}</code></li>
                    <li>Entrez votre PIN</li>
                    <li>Confirmez le transfert de <strong>${formatPrice(amount)}</strong></li>
                </ol>
            </div>
            
            <div style="background: var(--primary); color: white; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                <p style="margin-bottom: 10px; font-size: 14px;">Code de confirmation:</p>
                <div style="font-size: 32px; font-weight: 800; letter-spacing: 4px;">${code}</div>
                <p style="margin-top: 10px; font-size: 12px; opacity: 0.9;">Envoyez ce code par WhatsApp après paiement</p>
            </div>
            
            <a href="https://wa.me/228${TMONEY_CONFIG.MERCHANT_PHONE}?text=Confirmation%20Sneaker%20Pro%0ACommande:%20${order.id}%0ACode:%20${code}%0AMontant:%20${amount}%20FCFA" 
               target="_blank"
               style="display: inline-flex; align-items: center; gap: 10px; background: #25D366; color: white; padding: 15px 30px; border-radius: 30px; text-decoration: none; font-weight: 600; margin-bottom: 15px;">
                <i class="fab fa-whatsapp"></i> Confirmer sur WhatsApp
            </a>
            
            <div style="display: flex; gap: 10px; justify-content: center;">
                <button onclick="cancelManualPayment()" class="btn btn-secondary" style="padding: 10px 20px;">Annuler</button>
                <button onclick="markAsPaid('${order.id}')" class="btn btn-primary" style="padding: 10px 20px;">J'ai payé</button>
            </div>
            
            <p style="margin-top: 20px; font-size: 12px; color: #6c757d;">
                <i class="fas fa-clock"></i> Cette commande expire dans 30 minutes
            </p>
        </div>
    `;
}

// NOUVELLE FONCTION - Marquer comme payé (simulation confirmation)
function markAsPaid(orderId) {
    const pendingOrders = JSON.parse(localStorage.getItem('sneaker_pending_orders') || '[]');
    const orderIndex = pendingOrders.findIndex(o => o.id === orderId);
    
    if (orderIndex > -1) {
        // Mettre à jour le statut
        pendingOrders[orderIndex].status = 'payee_manuelle';
        pendingOrders[orderIndex].paidAt = new Date().toISOString();
        
        localStorage.setItem('sneaker_pending_orders', JSON.stringify(pendingOrders));
        
        // Ajouter aux commandes confirmées
        Store.orders.push(pendingOrders[orderIndex]);
        
        // Vider le panier
        Store.cart = [];
        updateCart();
        
        // Fermer modal et afficher succès
        document.getElementById('paymentModal').classList.remove('active');
        document.getElementById('successMessage').classList.add('active');
        
        // Mettre à jour stats admin
        updateAdminStats();
        
        // Restaurer le modal pour prochain usage
        setTimeout(() => restorePaymentModal(), 1000);
    }
}

// NOUVELLE FONCTION - Annuler paiement manuel
function cancelManualPayment() {
    document.getElementById('paymentModal').classList.remove('active');
    restorePaymentModal();
}

// NOUVELLE FONCTION - Restaurer modal original
function restorePaymentModal() {
    const modalContent = document.querySelector('.payment-content');
    // Recharger la page ou restaurer le HTML original
    location.reload(); // Simple solution
}

// NOUVELLE FONCTION - Paiement auto (si disponible)
async function initiateAutoPayment(order, amount, btn) {
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connexion...';
    btn.disabled = true;
    
    try {
        // Appel API vers votre backend
        const response = await fetch(`${API_BASE_URL}/api/payment/initiate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: amount,
                clientPhone: order.clientPhone,
                merchantPhone: order.merchantPhone,
                orderId: order.id,
                method: selectedPaymentMethod
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Attendre confirmation via webhook ou polling
            startPaymentPolling(order.id);
        } else {
            throw new Error(data.message || 'Erreur initiation');
        }
        
    } catch (error) {
        console.error('Payment error:', error);
        // Fallback vers mode manuel
        showManualPaymentInstructions(order, amount, order.confirmationCode);
    }
}

// NOUVELLE FONCTION - Polling statut paiement
function startPaymentPolling(orderId) {
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes
    
    const checkStatus = async () => {
        attempts++;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/payment/status/${orderId}`);
            const data = await response.json();
            
            if (data.status === 'completed') {
                // Paiement reçu!
                Store.cart = [];
                updateCart();
                document.getElementById('paymentModal').classList.remove('active');
                document.getElementById('successMessage').classList.add('active');
                updateAdminStats();
                return;
            }
            
            if (attempts < maxAttempts) {
                setTimeout(checkStatus, 5000); // Vérifier toutes les 5s
            } else {
                // Délai dépassé, passer en mode manuel
                const order = JSON.parse(localStorage.getItem('sneaker_pending_orders') || '[]')
                    .find(o => o.id === orderId);
                if (order) {
                    showManualPaymentInstructions(order, order.total, order.confirmationCode);
                }
            }
            
        } catch (error) {
            if (attempts < maxAttempts) {
                setTimeout(checkStatus, 5000);
            }
        }
    };
    
    checkStatus();
}


// ==============================
// ADMIN
// ==============================

function loginAdmin() {
    const user = document.getElementById("adminUser").value;
    const pass = document.getElementById("adminPass").value;

    if (user === "sneaker pro" && pass === "sneaker pro 228") {
        document.getElementById("adminPanel").classList.add("active");
        updateAdminStats();
        showToast("Bienvenue Admin");
    } else {
        alert("Identifiants incorrects");
    }
}

function logoutAdmin() {
    document.getElementById("adminPanel").classList.remove("active");
    document.getElementById("adminLoginModal").classList.add("active");
    showToast("Déconnecté");
}

function showAdminTab(tab) {
    document.querySelectorAll(".admin-tab").forEach(t => t.classList.add("hidden"));
    document.getElementById("admin-" + tab).classList.remove("hidden");

    document.querySelectorAll(".admin-nav a").forEach(a => a.classList.remove("active"));
    document.querySelector(`.admin-nav a[onclick="showAdminTab('${tab}')"]`).classList.add("active");
}

function updateAdminStats() {
    const totalSales = Store.orders.reduce((s, o) => s + o.total, 0);

    document.getElementById("totalSales").textContent = formatPrice(totalSales);
    document.getElementById("totalOrders").textContent = Store.orders.length;
}


// ==============================
// UTILITAIRES
// ==============================

function formatPrice(price) {
    return price.toLocaleString("fr-FR") + " FCFA";
}

function showToast(message, type = "success") {

    const toast = document.createElement("div");
    toast.textContent = message;

    toast.style.position = "fixed";
    toast.style.bottom = "20px";
    toast.style.left = "50%";
    toast.style.transform = "translateX(-50%)";
    toast.style.background = type === "error" ? "#e63946" : "#2a9d8f";
    toast.style.color = "white";
    toast.style.padding = "12px 25px";
    toast.style.borderRadius = "30px";
    toast.style.zIndex = "9999";

    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 3000);
}


// ==============================
// INIT
// ==============================

document.addEventListener("DOMContentLoaded", () => {
    renderProducts();
    updateCart();
});