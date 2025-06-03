import { initializeApp } from "firebase/app";
import {
  getProducts,
  getStripePayments,
} from "@invertase/firestore-stripe-payments";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);

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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadProducts);
} else {
  loadProducts();
}
