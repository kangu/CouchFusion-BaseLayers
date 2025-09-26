# CouchDB Users API Endpoint

## Overview

The Users API endpoint provides access to retrieve all users from the CouchDB `_users` database that match the configured login prefix. This endpoint is useful for administrative purposes, user management interfaces, and analytics.

## Endpoint Details

- **URL**: `/api/users`
- **Method**: `GET`
- **Authentication**: Inherits from server configuration
- **Database**: CouchDB `_users`

## Configuration

The endpoint uses the `dbLoginPrefix` from the runtime configuration to filter users:

```typescript
// nuxt.config.ts
runtimeConfig: {
  dbLoginPrefix: 'bv-'  // Example prefix
}
```

## Query Logic

The endpoint performs a key range query on the `_users` database:

- **Start Key**: `org.couchdb.user:${dbLoginPrefix}`
- **End Key**: `org.couchdb.user:${dbLoginPrefix}\uFFFF`
- **Include Docs**: `true` (returns full user documents)

### Key Range Explanation

CouchDB user documents have IDs in the format `org.couchdb.user:username`. By using:
- `startkey`: `org.couchdb.user:bv-` 
- `endkey`: `org.couchdb.user:bv-\uFFFF`

We capture all users whose usernames start with the configured prefix. The `\uFFFF` character ensures we get all possible characters that could follow the prefix.

## Response Format

### Success Response (200)

```json
{
  "success": true,
  "users": [
    {
      "id": "org.couchdb.user:bv-ABC12345",
      "name": "bv-ABC12345", 
      "email": "user@example.com",
      "roles": ["user"],
      "type": "user",
      "funnel": "registration"
    }
  ],
  "total": 1,
  "prefix": "bv-"
}
```

### Error Responses

**Configuration Error (500)**
```json
{
  "statusCode": 500,
  "statusMessage": "Server configuration error: dbLoginPrefix is required but not configured"
}
```

**Database Not Found (404)**
```json
{
  "statusCode": 404,
  "statusMessage": "Users database not found or not accessible"
}
```

**Database Query Error (500)**
```json
{
  "statusCode": 500,
  "statusMessage": "Database query failed"
}
```

## Security Considerations

### Data Filtering
The endpoint automatically filters sensitive user information:

**Included Fields:**
- `id` - Document ID
- `name` - Username
- `email` - User email address
- `roles` - User roles array
- `type` - Document type ('user')
- `funnel` - Custom tracking field (if present)

**Excluded Fields:**
- `password` - User password
- `derived_key` - Password derivation key
- `salt` - Password salt
- `iterations` - PBKDF2 iterations
- `password_scheme` - Password hashing scheme
- `_rev` - CouchDB revision

### Access Control
Consider implementing additional authentication/authorization checks based on your security requirements:

```typescript
// Example: Check if user has admin role
const currentUser = await getCurrentUser(event)
if (!currentUser?.roles.includes('admin')) {
  throw createError({
    statusCode: 403,
    statusMessage: 'Access denied'
  })
}
```

## Usage Examples

### Frontend/Client Usage

```typescript
// Fetch all users with the configured prefix
const response = await $fetch('/api/users')

if (response.success) {
  console.log(`Found ${response.total} users:`)
  response.users.forEach(user => {
    console.log(`- ${user.name} (${user.email})`)
  })
}
```

### With Error Handling

```typescript
try {
  const response = await $fetch('/api/users')
  // Process users
  const users = response.users
} catch (error) {
  console.error('Failed to fetch users:', error.statusMessage)
}
```

### Admin Dashboard Integration

```vue
<template>
  <div>
    <h2>Users ({{ usersData?.total || 0 }})</h2>
    <div v-if="pending">Loading users...</div>
    <div v-else-if="error">Error: {{ error.statusMessage }}</div>
    <ul v-else>
      <li v-for="user in usersData?.users" :key="user.id">
        {{ user.name }} - {{ user.email }}
        <span v-if="user.roles.length">({{ user.roles.join(', ') }})</span>
      </li>
    </ul>
  </div>
</template>

<script setup>
const { data: usersData, pending, error } = await useFetch('/api/users')
</script>
```

## Testing

### Manual Testing

```bash
# Test the endpoint directly
curl http://localhost:3000/api/users

# With authentication headers if needed
curl -H "Cookie: AuthSession=your_session_cookie" \
     http://localhost:3000/api/users
```

### Expected Behavior

1. **With Prefix 'bv-'**: Returns only users with usernames starting with 'bv-'
2. **No Matching Users**: Returns empty array with `total: 0`
3. **Database Issues**: Returns appropriate error with status code
4. **Missing Config**: Returns 500 error with configuration message

## Performance Notes

- Uses CouchDB's efficient key range queries
- Includes only necessary document fields in response
- Filters sensitive data server-side
- Scales well with large user databases due to key-based filtering

## Related Endpoints

- `POST /api/login` - User authentication
- `DELETE /api/logout` - User logout
- `POST /api/login-verify` - Login token verification