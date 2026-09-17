# EVO v1.0.0-alpha.2 Validation

Reset and deploy:

```bash
docker compose down -v
docker compose up -d --build
```

Run the integrated semantic validation:

```bash
docker compose exec api node dist/scripts/validate-demo.js
```

Expected result contains:

```text
status: PASS
inventoryQuantity: 8
inventoryValue: 80
cogs: 20
valuationPostingCount >= 1
replayDeterministic: true
```

The validation also uses Project, Department, Profit Center and Cost Center dimensions and verifies the full replay digest after rebuilding cost and valuation using pinned versions.
