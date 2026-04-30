# Smart Payment Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Centralize payment method eligibility logic (PayPal vs Yape) in `CartManager` to prevent race conditions and enforce priority rules.
**Architecture:** `CartManager` performs pre-verification of all producers. `CheckoutManager` acts as a synchronous consumer of the calculated availability state.
**Tech Stack:** JavaScript (ES6+), Supabase Client.
---

### Task 1: Enhance CartManager Verification
Migrate Yape verification logic from `checkout.js` to `cart.js` and calculate global eligibility.

**Files:**
- Modify [cart.js](file:///c:/Users/Willie/Desktop/OFFSZN/script/cart.js)

- [ ] **Step 1: Update `verifyCart()` to fetch Yape data**
    - Include `yape_phone` and `is_verified` in `users` query.
    - Query `phone_verifications` for the set of producer IDs.
- [ ] **Step 2: Calculate `paymentEligibility`**
    - `allHavePayPal`: Every producer has `paypal_email` or `payment_methods.paypal`.
    - `allHaveYape`: Every producer has `yape_phone`, `is_verified`, and a record in `phone_verifications`.
    - `preferred`: If `allHaveYape` is true, default to 'yape', otherwise 'paypal'.
- [ ] **Step 3: Update State**
    - Set `this.state.paymentEligibility = { paypal: allHavePayPal, yape: allHaveYape, preferred: ... }`.

### Task 2: Simplify CheckoutManager
Remove redundant async checks and bind UI to the pre-calculated `CartManager` state.

**Files:**
- Modify [checkout.js](file:///c:/Users/Willie/Desktop/OFFSZN/script/checkout.js)

- [ ] **Step 1: Delete `checkYapeAvailability()`**
    - Remove the entire method and its calls in `init()` and the `cart-updated` listener.
- [ ] **Step 2: Update `updatePayPalButtonsVisibility()`**
    - Read `window.CartManager.state.paymentEligibility`.
    - Set `display: block/none` for `#method-paypal` and `#method-yape` based on the status.
- [ ] **Step 3: Auto-toggle Preferred Method**
    - In the `cart-updated` listener, after updating visibility, call `this.togglePaymentMethod(eligibility.preferred)` to ensure the user sees the best option by default.

### Task 3: Verification
Ensure the logic works for mixed-producer baskets.

**Files:**
- N/A

- [ ] **Step 1: Scenario - Mixed Producers**
    - Cart with Producer A (PayPal+Yape) and Producer B (PayPal Only).
    - **Expected:** Yape method hidden, PayPal shown.
- [ ] **Step 2: Scenario - All Yape**
    - Cart with Producer A (Yape) and Producer C (Yape).
    - **Expected:** Both show, Yape selected by default.
- [ ] **Step 3: Scenario - Missing PayPal**
    - Any producer missing PayPal blocks the PayPal method (already implemented, verify it still blocks).
