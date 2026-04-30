---
name: n8n-javascript
description: Best practices for writing JavaScript in n8n Code nodes. [SAFE]
---

# n8n JavaScript Expert

Expert guidance for writing custom logic in n8n Code nodes.

## Return Format (REQUIRED)
Always return an array of objects with a `json` key:
```javascript
return [{
  json: {
    result: "success",
    data: myData
  }
}];
```

## Data Access Patterns
1. **$input.all()**: Get all input items (best for "Run Once for All Items").
2. **$input.first().json**: Get the first item's JSON data.
3. **$json.body**: Access data from a **Webhook** node (data is always nested).
4. **$node["Node Name"].first().json**: Access data from an earlier node.

## Built-in Helpers
- **DateTime**: Use Luxon for date manipulation (e.g., `DateTime.now().plus({ days: 1 })`).
- **$helpers.httpRequest**: Make external API calls directly from code.
- **$jmespath**: Query complex JSON structures.

## Best Practices
- **Try-Catch**: Wrap code in blocks to handle errors gracefully.
- **Floating Point**: Round currency values to avoid noise (e.g., `Math.round(val * 100) / 100`).
- **Static Data**: Use `$getWorkflowStaticData('global')` to persist data across loop iterations.
- **Safe Navigation**: Use optional chaining `const val = item.json?.user?.email;`.
