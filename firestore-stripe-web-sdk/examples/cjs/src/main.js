const { initializeApp } = require("firebase/app");
const { getFirestore } = require("firebase/firestore");
const { getAuth } = require("firebase/auth");
const {
  getProducts,
  getStripePayments,
} = require("@invertase/firestore-stripe-payments");

// Firebase config
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Stripe Payments
const stripePayments = getStripePayments(app, {
  customersCollection: "customers",
  productsCollection: "products",
});

async function loadProducts() {
  try {
    const products = await getProducts(stripePayments);

    const productsList =
      products.length > 0
        ? products
            .map(
              (product) => `
          <div class="product-card">
            <h3>${product.name}</h3>
            ${product.description ? `<p>${product.description}</p>` : ""}
            ${product.active ? '<span class="active">Active</span>' : ""}
          </div>
        `
            )
            .join("")
        : '<p class="no-products">No products found.</p>';

    document.getElementById("app").innerHTML = `
      <div class="container">
        <h1>Stripe Products</h1>
        <div class="products-grid">
          ${productsList}
        </div>
      </div>
    `;
  } catch (error) {
    console.error("Error loading products:", error);

    document.getElementById("app").innerHTML = `
      <div class="container">
        <h1 class="error">Error</h1>
        <p>Failed to load products: ${error.message}</p>
      </div>
    `;
  }
}

// Load products when page is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadProducts);
} else {
  loadProducts();
}
