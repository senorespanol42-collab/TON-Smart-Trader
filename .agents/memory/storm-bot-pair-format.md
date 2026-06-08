---
name: Storm Bot pair format
description: Trading pair format convention for Storm Bot frontend/backend — use slash not hyphen
---

The backend STORM_PAIRS array uses slash format: "TON/USDT", "BTC/USDT", "ETH/USDT".
The frontend must pass the same format. Using "TON-USDT" (hyphen) causes 404s on all analysis endpoints.

**Why:** The backend validates the pair against STORM_PAIRS and returns 404 if not found. URL encoding of "/" is handled automatically by fetch.

**How to apply:** Any hardcoded pair string in frontend pages (analysis.tsx, dashboard.tsx, config.tsx) must use the slash format "TON/USDT", never hyphen "TON-USDT".
