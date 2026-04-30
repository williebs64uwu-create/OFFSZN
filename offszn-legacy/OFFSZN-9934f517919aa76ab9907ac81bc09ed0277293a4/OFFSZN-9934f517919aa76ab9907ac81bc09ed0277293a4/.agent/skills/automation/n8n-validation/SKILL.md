---
name: n8n-validation
description: Expert guidance on interpreting and fixing n8n validation errors. [SAFE]
---

# n8n Validation Expert

Master guide for troubleshooting and fixing n8n workflow errors.

## Error vs. Warning
- **Errors (Must Fix)**: Block workflow activation (e.g., `missing_required`, `invalid_value`, `invalid_expression`).
- **Warnings (Should Fix)**: Recommended but don't block execution (e.g., `best_practice`, `deprecated`).
- **Suggestions (Optional)**: Performance or logic optimizations.

## Iterative Process
Validation is **iterative**. Expect 2-3 cycles of `validate_node` → Fix → `validate_node` again.

## Common Error Types
1. **missing_required**: A mandatory field is empty. Use `get_node` to see the schema.
2. **type_mismatch**: Expected a number but got a string (e.g., `limit: "10"` ❌ vs `limit: 10` ✅).
3. **invalid_expression**: Syntax error in `{{ }}`.
4. **invalid_reference**: Referring to a node that doesn't exist or has a typo.

## Auto-Fix Capabilities
Use `n8n_autofix_workflow` to automatically resolve:
- Missing `=` prefix in expressions.
- Duplicate onError settings.
- Stale connections.
- Outdated node versions.

## Profiles
- **runtime** (Recommended): Standard pre-deployment check.
- **strict**: Extensive check for production, including best practices.
- **ai-friendly**: Reduced noise, more tolerant for AI-generated logic.
