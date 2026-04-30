---
name: n8n-python
description: Guidance for writing Python code in n8n Code nodes. Use when requested or for specific statistical tasks. [SAFE]
---

# n8n Python Expert

Expert guidance for writing custom logic in n8n Python Code nodes.

## ⚠️ JavaScript First Recommendation
Use **JavaScript for 95% of use cases**. Only use Python when specifically requested or for Python-specific standard library capabilities (like `statistics` or `hashlib`).

## CRITICAL: No External Libraries
You **cannot** import external packages like `requests`, `pandas`, or `numpy`. Only the Python Standard Library is available.

## Return Format (REQUIRED)
Always return a list of dictionaries with a `"json"` key:
```python
return [{
    "json": {
        "result": "success",
        "data": my_data
    }
}]
```

## Data Access Patterns (Python Beta)
1. **_input.all()**: Get all input items.
2. **_json["body"]**: Access data from a **Webhook** node.
3. **_node["Node Name"].first()["json"]**: Access data from an earlier node.
4. **_now**: Built-in datetime object for the current time.

## Best Practices
- **Safe Access**: Always use `.get()` to avoid KeyErrors (e.g., `item["json"].get("field", "default")`).
- **List Comprehensions**: Use for efficient filtering and mapping.
- **Statistics**: Use the `statistics` module (built-in) for mean, median, etc.
