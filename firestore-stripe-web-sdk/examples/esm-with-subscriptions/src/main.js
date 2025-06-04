import { initializeApp } from "firebase/app";
import {
  getProducts,
  getStripePayments,
  createCheckoutSession,
  onCurrentUserSubscriptionUpdate,
  getCurrentUserSubscriptions,
} from "@invertase/firestore-stripe-payments";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const stripePayments = getStripePayments(app, {
  customersCollection: "test_customers",
  productsCollection: "test_products",
});

async function handleSignIn(email, password) {
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    console.error("Error signing in:", error);
    let errorMessage = "Failed to sign in: ";
    switch (error.code) {
      case "auth/invalid-email":
        errorMessage += "Invalid email address.";
        break;
      case "auth/user-disabled":
        errorMessage += "This account has been disabled.";
        break;
      case "auth/user-not-found":
        errorMessage += "No account found with this email.";
        break;
      case "auth/wrong-password":
        errorMessage += "Incorrect password.";
        break;
      case "auth/too-many-requests":
        errorMessage += "Too many failed attempts. Please try again later.";
        break;
      default:
        errorMessage += error.message;
    }
    alert(errorMessage);
  }
}

async function handleSignUp(email, password) {
  try {
    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters long.");
    }
    await createUserWithEmailAndPassword(auth, email, password);
  } catch (error) {
    console.error("Error signing up:", error);
    let errorMessage = "Failed to sign up: ";
    switch (error.code) {
      case "auth/email-already-in-use":
        errorMessage += "An account already exists with this email.";
        break;
      case "auth/invalid-email":
        errorMessage += "Invalid email address.";
        break;
      case "auth/operation-not-allowed":
        errorMessage +=
          "Email/password accounts are not enabled. Please contact support.";
        break;
      case "auth/weak-password":
        errorMessage += "Password is too weak. Please use a stronger password.";
        break;
      default:
        errorMessage += error.message;
    }
    alert(errorMessage);
  }
}

async function handleSignOut() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out:", error);
    alert(`Failed to sign out: ${error.message}`);
  }
}

function showAuthForm() {
  document.getElementById("app").innerHTML = `
    <div class="container">
      <h1>Welcome to Stripe Payments Demo</h1>
      <div class="auth-container">
        <div class="auth-form">
          <h2>Sign In</h2>
          <form id="signInForm" onsubmit="event.preventDefault(); handleSignInFormSubmit();">
            <input type="email" id="signInEmail" placeholder="Email" required />
            <input type="password" id="signInPassword" placeholder="Password" required minlength="6" />
            <button type="submit">Sign In</button>
          </form>
        </div>
        <div class="auth-form">
          <h2>Sign Up</h2>
          <form id="signUpForm" onsubmit="event.preventDefault(); handleSignUpFormSubmit();">
            <input type="email" id="signUpEmail" placeholder="Email" required />
            <input type="password" id="signUpPassword" placeholder="Password (min 6 characters)" required minlength="6" />
            <button type="submit">Sign Up</button>
          </form>
        </div>
      </div>
    </div>
  `;
}

// Make auth handlers available globally
window.handleSignInFormSubmit = () => {
  const email = document.getElementById("signInEmail").value;
  const password = document.getElementById("signInPassword").value;
  handleSignIn(email, password);
};

window.handleSignUpFormSubmit = () => {
  const email = document.getElementById("signUpEmail").value;
  const password = document.getElementById("signUpPassword").value;
  handleSignUp(email, password);
};

window.handleSignOut = handleSignOut;

async function updateSubscriptionsDisplay() {
  const subscriptionsContainer = document.getElementById("subscriptions");
  if (!subscriptionsContainer) return;

  try {
    const subscriptions = await getCurrentUserSubscriptions(stripePayments);
    const subscriptionsList =
      subscriptions.length > 0
        ? subscriptions
            .map(
              (subscription) => `
              <div class="subscription-card">
                <h4>Subscription ID: ${subscription.id}</h4>
                <p>Status: ${subscription.status}</p>
                <p>Created: ${new Date(
                  subscription.created
                ).toLocaleDateString()}</p>
              </div>
            `
            )
            .join("")
        : '<p class="no-subscriptions">No active subscriptions.</p>';

    subscriptionsContainer.innerHTML = `
      <h2>Your Subscriptions</h2>
      <div class="subscriptions-grid">
        ${subscriptionsList}
      </div>
    `;
  } catch (error) {
    console.error("Error loading subscriptions:", error);
    subscriptionsContainer.innerHTML = `
      <h2>Your Subscriptions</h2>
      <p class="error">Failed to load subscriptions: ${error.message}</p>
    `;
  }
}

async function handleCheckout(priceId) {
  try {
    const session = await createCheckoutSession(stripePayments, {
      price: priceId,
      success_url: window.location.href,
      cancel_url: window.location.href,
    });
    window.location.assign(session.url);
  } catch (error) {
    console.error("Error creating checkout session:", error);
    alert(`Failed to start checkout: ${error.message}`);
  }
}

async function loadProducts() {
  try {
    const products = await getProducts(stripePayments, {
      includePrices: true,
      activeOnly: true,
    });

    const productsList =
      products.length > 0
        ? products
            .map(
              (product) => `
          <div class="product-card">
            <h3>${product.name}</h3>
            ${product.description ? `<p>${product.description}</p>` : ""}
            ${product.active ? '<span class="active">Active</span>' : ""}
            ${
              product.prices && product.prices.length > 0
                ? product.prices
                    .map(
                      (price) => `
                    <div class="price-item">
                      <p>${price.currency.toUpperCase()} ${
                        price.unit_amount / 100
                      }</p>
                      <button onclick="handleCheckout('${
                        price.id
                      }')" class="checkout-button">
                        Subscribe
                      </button>
                    </div>
                  `
                    )
                    .join("")
                : ""
            }
          </div>
        `
            )
            .join("")
        : '<p class="no-products">No products found.</p>';

    document.getElementById("app").innerHTML = `
      <div class="container">
        <div class="header">
          <h1>Stripe Products</h1>
          <button onclick="handleSignOut()" class="sign-out-button">Sign Out</button>
        </div>
        <div class="products-grid">
          ${productsList}
        </div>
        <div id="subscriptions"></div>
      </div>
    `;

    // Load initial subscriptions
    updateSubscriptionsDisplay();
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

window.handleCheckout = handleCheckout;

onAuthStateChanged(auth, (user) => {
  if (user) {
    onCurrentUserSubscriptionUpdate(stripePayments, (snapshot) => {
      for (const change of snapshot.changes) {
        if (change.type === "added") {
          console.log(
            `New subscription added with ID: ${change.subscription.id}`
          );
          updateSubscriptionsDisplay();
        }
      }
    });
    loadProducts();
  } else {
    showAuthForm();
  }
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {});
} else {
  // Auth state listener will handle the initial view
}
