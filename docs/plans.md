# Organization plans

Stealth keeps the organization plan lifecycle in PostgreSQL and exposes the
effective contract through:

```text
GET /v1/organizations/{organizationID}/plan
```

The endpoint is available to every organization member and returns the plan
key, billing-period dates, server-owned limits, and current resource counts.
It never returns payment-provider identifiers or secrets.

The initial catalog is deliberately small and deterministic:

| Plan | Projects | Members | Databases | Storage buckets | Functions | Sites |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `free` | 3 | 5 | 5 | 10 | 10 | 10 |
| `pro` | 25 | 25 | 50 | 100 | 100 | 100 |
| `enterprise` | unlimited | unlimited | unlimited | unlimited | unlimited | unlimited |

New organizations start on `free`. Project and resource creation checks the
effective limit inside the same PostgreSQL transaction as the insert, so
parallel requests cannot consume the same final slot. Membership acceptance,
Console membership creation, database, Storage bucket, Function, Site, and
project creation all use this boundary. Deletions immediately release the
corresponding slot.

Usage metering for API requests and Function compute remains a separate daily
metering contract. Payment-provider checkout, invoice calculation, plan
upgrades, and downgrades are intentionally not inferred from usage; they need
an explicit billing adapter and operator workflow before being enabled.
