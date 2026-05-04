# PayPal Subscriptions & Trials Design

**Goal:** Implement true recurring PayPal subscriptions (mensualidades) with specific logic: Starter Plan = standard recurring, PRO Plan = 7-day trial + recurring. Implement Row Level Security (RLS) in Supabase.

**Architecture:**
1.  **Frontend (Checkout)**: 
    - Replace the current PayPal `Orders API` (one-time payments) with the `Subscriptions API` inside the JS SDK.
    - `paypal.Buttons.createSubscription` will use specific PayPal Plan IDs (created in the PayPal Dashboard).
    - `onApprove` sends the `subscriptionID` to the backend.
2.  **Backend (Node.js)**:
    - Update `subscribePayPalSubscription` to accept the `subscriptionID`.
    - Backend will fetch the subscription details from PayPal (`GET /v1/billing/subscriptions/{id}`) to verify its status and plan.
    - Determine `current_period_end` based on whether it's a trial (7 days) or a standard payment (30 days).
3.  **Database (Supabase)**:
    - Create/Verify RLS on the `subscriptions` table.
    - Policy: Users can only `SELECT` their own subscriptions. Insert/Update operations are strictly reserved for the secure backend (using Service Role).

**Required PayPal Setup (Manual)**:
The admin must create two Subscription Plans in the PayPal Dashboard:
- Plan A (Starter): Monthly billing, $5.00.
- Plan B (PRO): Trial period 7 days at $0.00, then Monthly billing $7.00.
The IDs (e.g., `P-12345...`) will be stored in `.env`.
