# Credit Audit & Professional Expiration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Implement a secure credit audit for active subscribers and a professional automatic downgrade system for expired plans, reflected in a premium Dashboard UI.
**Architecture:** Supabase (PostgreSQL) + Express.js Backend + Vanilla JS Frontend.
**Tech Stack:** SQL, Node.js, HTML/CSS/JS.
---

### Task 1: SQL Credit Audit
**Goal:** Equalize `reward_balance` for current active subscribers.

**Files:**
- Manual SQL Execution (Supabase)

- [ ] **Step 1: Verify current state**
```sql
SELECT p.id, p.email, p.plan, p.reward_balance, s.status, s.current_period_end
FROM public.profiles p
JOIN public.subscriptions s ON p.id = s.user_id
WHERE s.status = 'active' AND p.plan != 'free';
```

- [ ] **Step 2: Run Audit Update**
```sql
-- Starter users to 60 if they have less
UPDATE public.profiles p
SET reward_balance = 60
FROM public.subscriptions s
WHERE p.id = s.user_id 
  AND s.status = 'active' 
  AND p.plan = 'starter'
  AND p.reward_balance < 60;

-- PRO users to 100 if they have less
UPDATE public.profiles p
SET reward_balance = 100
FROM public.subscriptions s
WHERE p.id = s.user_id 
  AND s.status = 'active' 
  AND p.plan = 'pro'
  AND p.reward_balance < 100;
```

### Task 2: Backend Expiration Trigger
**Goal:** Automatically downgrade users in the DB when they query their status if their plan has expired.

**Files:**
- [MODIFY] [SubscriptionController.js](file:///c:/Users/Willie/Desktop/OFFSZN/server/src/infrastructure/http/controllers/SubscriptionController.js)

- [ ] **Step 1: Update getSubscriptionStatus logic**
Inject the expiration check block before returning the status.
```javascript
// Check for expiration
const now = new Date();
if (subscription && subscription.status === 'active' && new Date(subscription.current_period_end) < now) {
    // Perform Downgrade
    await supabase.from('subscriptions').update({ status: 'expired' }).eq('id', subscription.id);
    await supabase.from('profiles').update({ 
        plan: 'free',
        reward_balance: Math.min(profile.reward_balance, 30) // Reset to 30 if higher
    }).eq('id', userId);
}
```

### Task 3: Dashboard UI - Credits Balance Card
**Goal:** Add a premium card to show reward_balance in the dashboard.

**Files:**
- [MODIFY] [dashboard.html](file:///c:/Users/Willie/Desktop/OFFSZN/cuenta/dashboard.html)

- [ ] **Step 1: Inject the HTML template**
Find `bento-stats-grid` and add:
```html
<div class="stat-card premium-card" id="credits-balance-card">
    <div class="stat-header">
        <i class="fas fa-gem"></i>
        <span>Créditos Disponibles</span>
    </div>
    <div class="stat-value" id="dashboard-reward-balance">--</div>
    <div class="stat-footer">Plan: <span id="dashboard-current-plan">...</span></div>
</div>
```

### Task 4: Dashboard UI - Subscription Status & CTA
**Goal:** Reveal the status card and add "Resubscribe" logic for expired/free users.

**Files:**
- [MODIFY] [dashboard.html](file:///c:/Users/Willie/Desktop/OFFSZN/cuenta/dashboard.html)

- [ ] **Step 1: Update loadSubscriptionStatus UI logic**
```javascript
function updateSubscriptionUI(data) {
    const card = document.getElementById('subscription-status-card');
    card.style.display = 'flex';
    // If plan is free or expired, show CTA
    if (data.plan === 'free') {
        const ctaBtn = document.createElement('a');
        ctaBtn.href = '/precios';
        ctaBtn.className = 'btn-renew';
        ctaBtn.textContent = 'Subir de Nivel';
        card.appendChild(ctaBtn);
    }
}
```

### Task 5: Frontend Utility Sync
**Goal:** Ensure `auth-utils.js` catches these changes.

**Files:**
- [MODIFY] [auth-utils.js](file:///c:/Users/Willie/Desktop/OFFSZN/script/auth-utils.js)

- [ ] **Step 1: Enhance getUserPlanData**
Add `reward_balance` and `nickname` to the profile fetch logic.
