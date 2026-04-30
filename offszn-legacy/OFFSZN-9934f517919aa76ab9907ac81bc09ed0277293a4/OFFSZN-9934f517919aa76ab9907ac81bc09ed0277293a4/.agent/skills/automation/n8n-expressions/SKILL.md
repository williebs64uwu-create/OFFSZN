---
name: n8n-expressions
description: Guide for writing correct n8n expressions in {{ }} syntax. [SAFE]
---

# n8n Expression Expert

Master guide for using n8n expressions (`{{ }}`) to pass data between nodes.

## Core Syntax
All dynamic content must be wrapped in double curly braces:
```handlebars
{{ $json.fieldName }}
{{ $node["HTTP Request"].json.data }}
```

## Data Access Sources
1. **$json**: Data from the current node's output.
2. **$node["Node Name"]**: Data from any previous node (case-sensitive).
3. **$now**: Access and format the current date/time (e.g., `{{ $now.toFormat('yyyy-MM-dd') }}`).
4. **$env**: Access environment variables.

## CRITICAL: Webhook Structure
Data from a Webhook node is **NOT** at the root. Access it via `.body`:
- ❌ `{{ $json.email }}`
- ✅ `{{ $json.body.email }}`

## Common Gotchas
- **Quotes**: If a node name or field has spaces, you **must** use bracket notation: `{{ $node["My Node Name"].json['Field Name'] }}`.
- **No Braces in Code**: **NEVER** use `{{ }}` inside a Code node. Use direct JavaScript: `const email = $json.body.email;`.
- **Case Sensitivity**: Node references are case-sensitive. `HTTP Request` is different from `http request`.
