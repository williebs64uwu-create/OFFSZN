---
name: n8n-node-config
description: Guidance on configuring n8n nodes, dependencies, and required fields. [SAFE]
---

# n8n Node Configuration

Expert guide for configuring n8n nodes based on resource and operation.

## Key Principles
1. **Operation-Aware**: Fields change based on the selected `operation` (e.g., Slack 'post' needs `channel`, but 'update' needs `messageId`).
2. **Progressive Discovery**: Use `get_node` with `detail: "standard"` first. Only use `"full"` if necessary.
3. **Property Dependencies**: Use `displayOptions` to understand when fields appear (e.g., `sendBody: true` reveals the `body` field).

## Standard Workflow
1. Identify node type and operation.
2. Use `get_node` (standard) to see requirements.
3. Configure required fields.
4. Validate with `validate_node`.
5. Fix errors and iterate until valid.

## Common Patterns
- **HTTP/Database**: Start minimal. Add `authentication`, `method`/`operation`, and then payload fields.
- **Conditional (IF/Switch)**: Structure `conditions` based on the data type (string, number, boolean).
- **Google Sheets**: Avoid `append` with formula columns; use `update` via HTTP Request instead.

## Patching Fields
Use `patchNodeField` in `n8n_update_partial_workflow` for surgical edits (like changing a single JS line) to avoid sending large code blocks.
