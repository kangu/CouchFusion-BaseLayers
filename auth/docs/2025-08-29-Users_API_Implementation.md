# Users API Implementation

## Initial Prompt
Implement in the auth module a server API route for /api/users.get.ts where the backend does an allDocs query to the _users db in CouchDB with startkey as runtimeconfig.dbLoginPrefix and endkey as "${dbLoginPrefix}\uFFFF".

## Implementation Summary

I have successfully implemented a server API route for `/api/users.get.ts` that queries the `_users` database in CouchDB using the configured `dbLoginPrefix`. Here's what was completed:

### 1. **Users API Endpoint** (`layers/auth/server/api/users.get.ts`)
- Created GET endpoint at `/api/users` for retrieving users by prefix
- Uses `getAllDocs()` function to query CouchDB's `_users` database
- Implements key range filtering with `startkey` and `endkey` parameters:
  - `startkey`: `org.couchdb.user:${dbLoginPrefix}`
  - `endkey`: `org.couchdb.user:${dbLoginPrefix}\uFFFF`
- Includes `include_docs: true` to return full user documents
- Filters sensitive user data (passwords, salts, keys) for security
- Provides comprehensive error handling and logging
- Returns structured response with user count and metadata

### 2. **Documentation** (`layers/auth/docs/couchdb_users_api.md`)
- Complete API documentation with endpoint details and usage examples
- Security considerations and data filtering explanation
- Response format specifications and error handling
- Frontend integration examples with Vue.js/Nuxt
- Performance notes and testing guidelines

### 3. **Key Features Implemented**
- **Prefix-based Filtering**: Uses runtime config `dbLoginPrefix` (e.g., 'bv-') to filter users
- **Security**: Automatically excludes sensitive fields like passwords and cryptographic keys
- **Error Handling**: Comprehensive error responses for various failure scenarios
- **Logging**: Console logging for debugging and monitoring
- **Validation**: Checks for required runtime configuration

The implementation follows the existing codebase patterns and provides a secure, efficient way to retrieve users matching the configured prefix from the CouchDB `_users` database.

## Documentation Overview

The Users API endpoint (`/api/users`) provides administrative access to retrieve users from CouchDB's `_users` database filtered by a configurable username prefix. This is essential for user management interfaces and administrative dashboards.

### Architecture

The implementation uses a three-layer architecture:

1. **API Layer** (`users.get.ts`): Handles HTTP requests, validation, and response formatting
2. **Database Layer** (`couchdb.ts`): Provides the `getAllDocs()` function for CouchDB queries
3. **Configuration Layer**: Uses Nuxt's runtime config for the `dbLoginPrefix` setting

### Key Range Query Strategy

CouchDB user documents follow the ID pattern `org.couchdb.user:username`. The endpoint uses efficient key range queries:

```typescript
const startkey = `org.couchdb.user:${dbLoginPrefix}`
const endkey = `org.couchdb.user:${dbLoginPrefix}\uFFFF`
```

This approach leverages CouchDB's sorted key structure to efficiently retrieve only users whose usernames begin with the configured prefix.

## Implementation Examples

### Basic Usage

```typescript
// Fetch all users with configured prefix
const response = await $fetch('/api/users')

console.log(`Found ${response.total} users`)
response.users.forEach(user => {
  console.log(`${user.name}: ${user.email}`)
})
```

### Vue Component Integration

```vue
<template>
  <div class="users-dashboard">
    <h2>User Management ({{ users?.total || 0 }} users)</h2>
    
    <div v-if="pending" class="loading">
      Loading users...
    </div>
    
    <div v-else-if="error" class="error">
      Failed to load users: {{ error.statusMessage }}
    </div>
    
    <div v-else class="users-list">
      <div v-for="user in users?.users" :key="user.id" class="user-card">
        <h3>{{ user.name }}</h3>
        <p>Email: {{ user.email }}</p>
        <p>Roles: {{ user.roles.join(', ') || 'None' }}</p>
        <p v-if="user.funnel">Source: {{ user.funnel }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
// Fetch users with reactive state management
const { data: users, pending, error, refresh } = await useFetch('/api/users')

// Optional: Auto-refresh every 30 seconds
const interval = setInterval(() => {
  if (!pending.value) {
    refresh()
  }
}, 30000)

// Cleanup interval on component unmount
onUnmounted(() => {
  clearInterval(interval)
})
</script>
```

### Advanced Filtering and Search

```vue
<script setup>
const { data: allUsers } = await useFetch('/api/users')

// Client-side filtering for search functionality
const searchQuery = ref('')
const selectedRole = ref('')

const filteredUsers = computed(() => {
  if (!allUsers.value?.users) return []
  
  return allUsers.value.users.filter(user => {
    const matchesSearch = !searchQuery.value || 
      user.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.value.toLowerCase())
    
    const matchesRole = !selectedRole.value || 
      user.roles.includes(selectedRole.value)
    
    return matchesSearch && matchesRole
  })
})
</script>
```

### Admin Actions Integration

```typescript
// Example: Building admin functionality around the users endpoint
class UserManager {
  async getAllUsers() {
    const response = await $fetch('/api/users')
    return response.users
  }

  async getUsersByRole(role: string) {
    const users = await this.getAllUsers()
    return users.filter(user => user.roles.includes(role))
  }

  async getUserStats() {
    const users = await this.getAllUsers()
    return {
      total: users.length,
      byRole: this.groupByRoles(users),
      recent: users.slice(0, 10) // Assuming newest first
    }
  }

  private groupByRoles(users: any[]) {
    const roleCount: Record<string, number> = {}
    users.forEach(user => {
      user.roles.forEach((role: string) => {
        roleCount[role] = (roleCount[role] || 0) + 1
      })
    })
    return roleCount
  }
}
```

### Error Handling Best Practices

```typescript
// Robust error handling for production use
async function fetchUsersWithRetry(maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await $fetch('/api/users')
      return response
    } catch (error: any) {
      console.warn(`Users fetch attempt ${attempt} failed:`, error.statusMessage)
      
      if (attempt === maxRetries) {
        // Final attempt failed
        throw new Error(`Failed to fetch users after ${maxRetries} attempts`)
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
    }
  }
}
```

This implementation provides a solid foundation for user management features while maintaining security, performance, and reliability standards.