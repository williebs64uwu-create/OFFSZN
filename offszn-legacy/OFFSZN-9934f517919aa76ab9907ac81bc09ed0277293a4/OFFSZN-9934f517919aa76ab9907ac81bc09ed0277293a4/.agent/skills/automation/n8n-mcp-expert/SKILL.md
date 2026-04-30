---
name: n8n-mcp-tools-expert
description: Expert guide for using n8n-mcp MCP tools effectively. Use when searching for nodes, validating configurations, or managing workflows. [SAFE]
---

# n8n MCP Tools Expert

Master guide for using n8n-mcp MCP server tools to build workflows.

## Tool Categories
1. **Node Discovery**: `search_nodes`, `get_node`.
2. **Validation**: `validate_node`, `validate_workflow`.
3. **Workflow Management**: `n8n_create_workflow`, `n8n_update_partial_workflow`.
4. **Deploy**: `n8n_deploy_template`.

## Critical Knowledge: nodeType Formats
There are **two different formats** for different tools:

### Format 1: Search/Validate Tools
Use the **SHORT prefix**: `nodes-base.slack`, `nodes-base.httpRequest`.
- **Tools**: `search_nodes`, `get_node`, `validate_node`, `validate_workflow`.

### Format 2: Workflow Tools
Use the **FULL prefix**: `n8n-nodes-base.slack`, `n8n-nodes-base.httpRequest`.
- **Tools**: `n8n_create_workflow`, `n8n_update_partial_workflow`.

## Best Practices
- **Iterative Building**: Don't build workflows in one shot. Build, validate, and activate iteratively.
- **Validation Profiles**: Always use `profile: "runtime"` for standard checks.
- **Smart Parameters**: Use `branch: "true"` for IF nodes and `case: 0` for Switch nodes instead of manual indexes.
- **Intent**: Always include the `intent` parameter in updates for better AI context.
