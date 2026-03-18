# Remove Boltz Provider from Lightning Layer

## Initial Prompt
Remove the "boltz" provider from the lightning layer.

## Plan
1. Delete boltz provider implementation file
2. Delete boltz webhook handler
3. Remove boltz imports and case from lightning service
4. Remove `BoltzConfig` interface and type unions from types
5. Remove boltz validation from nuxt.config.ts
6. Remove `initializeBoltzWebhook()` from init plugin
7. Remove `by_swap_id` view from design documents
8. Update type unions in utility files and composables

## Implementation Summary

### Files Deleted
| File | Lines | Description |
|------|-------|-------------|
| `providers/boltz.ts` | 256 | Complete Boltz provider implementation with reverse swaps, auto-claim, webhook handling |
| `server/api/webhooks/boltz.post.ts` | 83 | Boltz webhook POST handler endpoint |

### Files Modified

#### 1. `services/lightning.ts`
- Removed import: `createBoltzProvider`
- Removed switch case for `'boltz'` provider

#### 2. `types/lightning.ts`
- Removed `BoltzConfig` interface (apiUrl, network, liquidAddress, etc.)
- Removed boltz fields from `InvoiceResponse`: liquidAddress, swapId, preimage, preimageHash, claimPublicKey, claimPrivateKey, blindingKey, lockupAddress, onchainAmount
- Updated `LightningConfig` type unions:
  - `defaultProvider`: `'strike' \| 'boltz' \| 'alby'` → `'strike' \| 'alby'`
  - `providers.boltz?: BoltzConfig` → removed

#### 3. `nuxt.config.ts`
- Removed boltz configuration documentation from error messages
- Removed boltz provider validation block
- Updated valid options from `'strike' \| 'boltz'` to `'strike' \| 'alby'`

#### 4. `server/plugins/init.ts`
- Removed `initializeBoltzWebhook()` function (60 lines)
- Removed boltz initialization call from provider switch

#### 5. `utils/design-documents.ts`
- Removed `by_swap_id` CouchDB view (for querying Boltz swaps)

#### 6. `utils/lightning.ts`
- Updated `CreateInvoiceOptions.provider`: `'strike' \| 'boltz' \| 'alby'` → `'strike' \| 'alby'`
- Updated `checkLightningInvoiceStatus()` provider param

#### 7. `server/composables/useLightning.ts`
- Updated `PaymentOptions.provider`: `'strike' \| 'boltz'` → `'strike' \| 'alby'`
- Removed `liquidAddress` and `swapId` from `PaymentInfo` interface

#### 8. `server/api/lightning/donation.post.ts`
- Updated provider type in request body: `'strike' \| 'boltz' \| 'alby'` → `'strike' \| 'alby'`

## Impact Assessment

### Runtime Code
- ✅ All boltz runtime code removed
- ✅ No active apps found using boltz provider (verified via grep)
- ✅ Type system updated to exclude boltz

### Database
- Existing boltz invoices in CouchDB remain intact (no migration needed)
- `by_swap_id` view removed from design documents (new dbs won't have it)

### Documentation
- Historical documentation preserved in `layers/lightning/docs/`
- Future PRs should update docs if boltz restoration is needed

### Configuration
- Apps with `lightning.providers.boltz` config will need to remove it
- Valid providers: `strike`, `alby`

## Validation

```bash
# Verify no boltz in runtime code
grep -r "boltz" layers/lightning --include="*.ts" --include="*.vue" | grep -v "docs/"
# Result: No matches (docs excluded)
```

## Notes
- `boltz-core` dependency was dynamically imported - no package.json changes needed
- Strike and Alby providers remain fully functional
- Webhook endpoints: `/api/webhooks/strike` still available, `/api/webhooks/boltz` removed
