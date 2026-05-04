# PayPal Recurring Trials Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Implement PayPal recurring subscriptions (Starter = Monthly, PRO = 7 Day Trial + Monthly) and enforce RLS on the subscriptions table.
**Architecture:** Frontend JS SDK using `createSubscription` -> Backend validation -> Supabase RLS policies.
**Tech Stack:** Node.js, Express, PayPal SDK, Supabase, Vanilla JS.

---

### Task 1: Enforce Row Level Security (RLS) on Subscriptions
**Files:**
- Create `server/migrations/subscriptions_rls.sql`
- [ ] **Step 1: Write the migration**
  Write SQL to enable RLS on `subscriptions` table and add a SELECT policy for authenticated users (`auth.uid() = user_id`).
- [ ] **Step 2: Apply migration**
  Execute the SQL using the Supabase MCP or pgAdmin.

### Task 2: Refactor Backend Subscription Controller
**Files:**
- Modify `server/src/infrastructure/http/controllers/SubscriptionController.js`
- [ ] **Step 1: Modify `subscribePayPalSubscription`**
  Update the logic to handle recurring and trial logic. It should fetch subscription details using PayPal API to verify legitimacy.
- [ ] **Step 2: Remove old Orders restrictions**
  Remove the `interval !== 'annual'` restriction so monthly recurring is allowed. Ensure `current_period_end` is calculated correctly for 7-day trials.

### Task 3: Refactor Frontend Checkout
**Files:**
- Modify `cuenta/checkout.html`
- [ ] **Step 1: Implement `createSubscription`**
  Replace `createOrder` inside `paypal.Buttons` with `createSubscription: (data, actions) => actions.subscription.create({ plan_id: config.PAYPAL_PLAN_ID })`.
- [ ] **Step 2: Handle `onApprove`**
  Send the `subscriptionID` to `/api/subscriptions/paypal/subscribe`.

### Task 4: Environment Config
**Files:**
- Modify `.env` and `env.js`
- [ ] **Step 1: Add PayPal Plan Variables**
  Define `PAYPAL_PLAN_STARTER_ID` and `PAYPAL_PLAN_PRO_TRIAL_ID`.
