# Blink Non-Custodial Lightning Provider

`blink_nc` is a receive-only, mainnet provider for Blink Spark accounts. It creates LNURL-pay invoices from a configured `@blink.sv` Lightning address and reconciles them through LUD-21. CouchFusion receives no API key, wallet ID, seed, balance access, or spending capability.

## CouchDB configuration

```ini
[cf_env_bitvocation]
lightning_default_provider=blink_nc
blink_nc_lightning_address=merchant@blink.sv
blink_nc_reconcile_interval_ms=3000
blink_nc_settlement_grace_ms=120000
blink_nc_max_concurrency=5
```

Only the address is required when `blink_nc` is the default. It must be an exact `username@blink.sv` address.

## Security and settlement

An invoice becomes paid only when `SHA256(preimage)` equals the payment hash decoded from the BOLT11 persisted at creation. Blink's `settled` flag and any BOLT11 returned by verification are not authoritative alone. Verification URLs and preimages remain server-side and are removed from public creation responses.

All requests require HTTPS, reject redirects, accept only `blink.sv` or subdomains, time out after eight seconds, and cap JSON responses at 256 KiB. Logs never print the Lightning address, callback or verification URL, BOLT11, preimage, or raw response.

## Reconciliation and operations

Reconciliation runs immediately at startup and then on the configured interval. It polls young invoices every three seconds, older pending invoices every ten seconds, and settlement grace every thirty seconds. One final strict-proof check runs after grace before expiry. The generic pending-invoice heartbeat skips `blink_nc`.

Version 1 supports one Nitro instance and exposes no `blink_nc` webhook. For staged rollout, configure the address while retaining the current default, restart and confirm the redacted probe, then switch the default. To roll back, restore the previous default but leave the address configured until pending `blink_nc` invoices finish.

## Manual mainnet smoke test

A live test spends sats and requires separate authorization. Use a capped low-value product, verify the browser response excludes internal context, pay from another wallet, and confirm invoice, fulfilment, email, event-log, and SSE effects. Repeat with Nitro stopped during payment and verify restart recovery. Automated mocked tests are not evidence of a live payment.
