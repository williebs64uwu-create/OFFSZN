---
name: n8n-workflow-patterns
description: Proven workflow architectural patterns for n8n. Use when building or designing new workflows. [SAFE]
---

# n8n Workflow Patterns

Build workflows using proven architectural patterns from real-world usage.

## Core Patterns
1. **Webhook Processing**: Receive HTTP requests → Transform → Respond.
   - *Key Gotcha*: Payload is under `$json.body`.
2. **HTTP API Integration**: Trigger → Fetch from REST API → Transform → Store.
3. **Database Operations**: Schedule → ETL (Extract, Transform, Load) → Sync.
4. **AI Agent Workflow**: Trigger → AI Agent (Model + Tools + Memory) → Output.
5. **Scheduled Tasks**: Recurring reports, cleanup, or data fetching.
6. **Batch Processing**: Handle large datasets using `SplitInBatches`.

## Workflow Creation Checklist
- [ ] **Plan**: Identify the pattern and nodes (use `search_nodes`).
- [ ] **Build**: Create workflow and connect nodes.
- [ ] **Configure**: Set credentials and parameters (use `get_node`).
- [ ] **Validate**: Check each node (use `validate_node`) and the whole workflow.
- [ ] **Deploy**: Test with sample data and activate.

## Loop Patterns (SplitInBatches)
- `main[0]` = **Done** (fires once after all items are processed).
- `main[1]` = **Batch** (fires for each batch).
- *Tip*: Always add a **Limit 1** node after the `main[0]` output to aggregate results.
