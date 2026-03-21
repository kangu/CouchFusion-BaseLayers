# Email Layer

Shared email template management functionality for CouchFusion applications.

## Features

- Email template CRUD operations
- MJML compilation with live preview
- Dynamic placeholder detection
- Theme-neutral UI components
- Automatic admin navigation registration
- Fallback toast notifications
- Automatic prefix handling (server-side only)

## Installation

Add the layer to your app's `nuxt.config.ts`:

```typescript
export default defineNuxtConfig({
  extends: [
    "../../layers/email",
    // ... other layers
  ],
});
```

Install required dependencies:

```bash
bun install mjml-browser codejar prismjs
```

## Configuration

The layer automatically configures itself using your app's runtime config:

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  runtimeConfig: {
    dbLoginPrefix: "your-app-prefix", // Used for template ID prefix: template_your-app-prefix_
    public: {
      // Optional: used only for display purposes
      appSlug: "your-app-prefix",
    },
  },
});
```

## Template ID Format

Templates are stored in CouchDB with a prefix based on `dbLoginPrefix`:

**Storage Format (Server-side):**
- Bitvocation: `template_bitvocation_welcome`
- Gas-Maintenance: `template_gas-_welcome`

**Display Format (Client-side):**
- User sees: `welcome`
- User types: `welcome` (not the full ID)

The prefix is automatically added server-side when creating templates and stripped when returning data to the client.

## Database

Templates are stored in the shared `email-sender` CouchDB database with app-specific prefixes:

- Bitvocation: `template_bitvocation_*`
- Gas-Maintenance: `template_gas-*`

## Navigation

The layer automatically registers an "Email > Templates" link in the admin sidebar for users with the `admin` role.

## Usage

Once installed, navigate to `/admin/email-templates` in your application.

### Creating Templates

1. Click "New template"
2. Enter a **name** (e.g., `welcome`, `reminder`, `newsletter`)
3. The server automatically adds the prefix: `template_gas-_welcome`
4. Fill in subject, MJML/HTML content
5. Save

### Template Document Structure

```typescript
{
  _id: "template_gas-_welcome",  // Stored with prefix
  _rev: "...",
  subject: "Welcome to Our App",
  mjml: "<mjml>...</mjml>", // MJML source (optional)
  html: "<html>...</html>", // Compiled HTML
  params: ["userName", "companyName"] // Auto-extracted placeholders
}
```

### Placeholders

Use `{{variableName}}` syntax in your MJML/HTML templates. Placeholders are automatically detected and listed in the editor.

### Editable Text Extraction (MJML)

Server utility `extractEditableMjmlTexts(mjml)` can scan raw MJML and:
- return extracted editable text fragments in encounter order,
- return transformed MJML with each extracted text replaced by a distinct placeholder like `[new-lite-member]`.

This intentionally avoids `{{ }}` placeholders, which remain reserved for dynamic runtime replacements.

## API Endpoints

- `GET /api/email-templates` - List all templates (returns stripped names)
- `POST /api/email-templates` - Create new template (send name, server adds prefix)
- `GET /api/email-templates/:name` - Get single template by name (not full ID)
- `PUT /api/email-templates/:name` - Update template (send stripped name)

### API Usage Examples

**Create Template:**
```typescript
// Client sends:
POST /api/email-templates
{
  "name": "welcome",  // Just the name, no prefix
  "subject": "Welcome!",
  "mjml": "<mjml>...</mjml>"
}

// Server stores: _id = "template_gas-_welcome"
```

**List Templates:**
```typescript
// Server returns:
{
  "success": true,
  "templates": [
    {
      "_id": "welcome",  // Stripped name
      "subject": "Welcome!",
      ...
    }
  ]
}
```

## Dependencies

- `codejar` - Lightweight editable code surface
- `prismjs` - Syntax highlighting for MJML/HTML editing
- `mjml-browser` - Client-side MJML compilation

## Toast Notifications

The layer attempts to use your app's `useToast()` composable. If not available, it falls back to an internal toast implementation.

To provide your own toast, ensure `useToast` is available in your app:

```typescript
// app/composables/useToast.ts
export const useToast = () => {
  // Your toast implementation
}
```

## Styling

The layer uses theme-neutral Tailwind classes (blue accent color). Override by targeting layer classes in your app's CSS.

Key classes:
- `.bg-blue-600` - Primary buttons
- `.text-blue-600` - Links
- `.focus:ring-blue-500` - Focus states

## Migration from Bitvocation

If you're migrating from the old Bitvocation email template system:

1. Templates with `template_bv_*` IDs remain accessible
2. New templates use the `template_${dbLoginPrefix}_` format
3. The UI now shows only the template name (without prefix)
4. All existing functionality remains the same
