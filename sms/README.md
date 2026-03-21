# SMS Layer

Shared SMS delivery layer for CouchFusion applications.

## Features

- Provider-based SMS sending (`mock` and `twilio`)
- Twilio Messaging Service SID delivery mode
- App-scoped CouchDB `_config` lookup (`cf_env_[appSlug]`)
- Normalized send result for consuming layers

## Installation

Add the layer to your app's `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  extends: [
    "../../layers/sms",
  ],
});
```

Install dependencies:

```bash
bun install twilio
```

## Configuration

Values are read from CouchDB `_config` section `cf_env_[appSlug]`.

Supported keys:

- `sms_provider` - `mock` (default) or `twilio`
- `twilio_account_sid`
- `twilio_auth_token`
- `twilio_messaging_service_sid`

If `sms_provider=twilio` and credentials are missing, sends fail closed.

## Usage

```ts
import { sendSms } from "#sms/server/utils/sender";

const result = await sendSms({
  to: "+40712345678",
  text: "Maintenance reminder",
});
```

Result shape:

```ts
{
  ok: boolean;
  provider: "mock" | "twilio";
  providerMessageId: string | null;
  errorMessage: string | null;
}
```
