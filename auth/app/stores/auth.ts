import { defineStore } from "pinia";

const extractRawCode = (name: string): string => {
  const index = name.indexOf("-");
  return index === -1 ? name : name.slice(index + 1);
};

export type PowLabStatus = "pending" | "pending_payment" | "active" | "expired";

// Define types for the authentication state
export interface AuthUser {
  _id: string;
  name: string;
  email?: string;
  roles: string[];
  allow_affiliate?: boolean;

  [key: string]: any;
}

export interface AuthSession {
  username: string;
  roles: string[];
}

export interface AdminUserProfile {
  full_name?: string | null;
  telegram_handle?: string | null;
  linkedin_url?: string | null;
  referral_source?: string | null;
  comments?: string | null;

  [key: string]: any;
}

export interface AdminUserDoc {
  _id: string;
  name: string;
  email?: string | null;
  roles?: string[];
  referred_by?: string;
  referral_count?: number | null;
  profile?: AdminUserProfile;
  pow_lab_status?: PowLabStatus | null;
  pow_lab_valid_until?: string | null;
  pow_lab_lite_status?: PowLabStatus | null;
  pow_lab_lite_valid_until?: string | null;
  allow_affiliate?: boolean | null;

  [key: string]: any;
}

export interface AdminUsersState {
  list: AdminUserDoc[];
  total: number;
  prefix: string;
  loading: boolean;
  error: string | null;
  lastFetched: string | null;
}

export interface AdminUsersResponse {
  success: boolean;
  users: AdminUserDoc[];
  total: number;
  prefix: string;
}

export interface AuthState {
  user: AuthUser | null;
  session: AuthSession | null;
  loading: boolean;
  error: string | null;
  sse: {
    connected: boolean;
    lastUserUpdate: string | null;
    connectionCount: number;
  };
  adminUsers: AdminUsersState;
}

export const useAuthStore = defineStore("auth", {
  // State
  state: (): AuthState => ({
    user: null,
    session: null,
    loading: false,
    error: null,
    sse: {
      connected: false,
      lastUserUpdate: null,
      connectionCount: 0,
    },
    adminUsers: {
      list: [],
      total: 0,
      prefix: "",
      loading: false,
      error: null,
      lastFetched: null,
    },
  }),

  // Getters (computed properties)
  getters: {
    /**
     * Check if user is authenticated
     */
    isAuthenticated: (state): boolean => {
      return state.user !== null;
    },

    /**
     * Get user roles for permission checking
     */
    userRoles: (state): string[] => {
      return state.user?.roles || [];
    },

    /**
     * Check if user has a specific role
     */
    hasRole: (state) => {
      return (role: string): boolean => {
        const roles = state.user?.roles || [];
        return roles.includes(role);
      };
    },

    /**
     * Check if user has any of the specified roles
     */
    hasAnyRole: (state) => {
      return (roles: string[]): boolean => {
        const userRoles = state.user?.roles || [];
        return roles.some((role) => userRoles.includes(role));
      };
    },

    /**
     * Check if user has all of the specified roles
     */
    hasAllRoles: (state) => {
      return (roles: string[]): boolean => {
        const userRoles = state.user?.roles || [];
        return roles.every((role) => userRoles.includes(role));
      };
    },

    /**
     * Map of user id to full name (if available)
     */
    userFullNameDirectory: (state): Record<string, string> => {
      const map: Record<string, string> = {};
      const currentUser = state.user;

      if (currentUser?.name) {
        const profile =
          typeof currentUser.profile === "object" ? currentUser.profile : {};
        const fullName =
          profile?.full_name || profile?.fullName || currentUser.full_name;

        if (typeof fullName === "string" && fullName.trim().length > 0) {
          const trimmed = fullName.trim();
          map[currentUser.name] = trimmed;
          map[extractRawCode(currentUser.name)] = trimmed;
        }
      }

      return map;
    },

    /**
     * Get latest admin users list
     */
    adminUsersList: (state): AdminUserDoc[] => {
      return state.adminUsers.list;
    },

    /**
     * Map of admin user ids (and raw codes) to full names when present
     */
    adminUsersDirectory: (state): Record<string, string> => {
      const directory: Record<string, string> = {};

      for (const entry of state.adminUsers.list) {
        if (!entry?.name) {
          continue;
        }

        const fullName = entry?.profile?.full_name;

        if (typeof fullName === "string" && fullName.trim().length > 0) {
          const trimmed = fullName.trim();
          directory[entry.name] = trimmed;
          directory[extractRawCode(entry.name)] = trimmed;
        }
      }

      return directory;
    },
  },

  // Actions (methods)
  actions: {
    /**
     * Fetch user data from the server using the login endpoint
     */
    async fetchUser(): Promise<boolean> {
      this.loading = true;
      this.error = null;

      try {
        // This forwards cookies/headers on SSR automatically
        const $f = useRequestFetch();

        const response = await $f<{ user: AuthUser }>("/api/login", {
          method: "GET",
        });

        this.user = response;
        this.loading = false;

        return response;
      } catch (error: any) {
        // Clear auth state on error
        this.user = null;
        this.loading = false;

        // Only set error for non-401 errors (401 just means not authenticated)
        if (error?.statusCode !== 401) {
          this.error =
            error?.statusMessage ||
            error?.message ||
            "Authentication check failed";
          console.error("Auth fetch error:", error);
        }

        return false;
      }
    },

    /**
     * Fetch all admin users from the backend users endpoint
     */
    async fetchAdminUsers(options: { force?: boolean } = {}): Promise<boolean> {
      // const { force = false } = options

      if (this.adminUsers.loading) {
        return false;
      }

      // if (!force && this.adminUsers.list.length > 0) {
      //     return true
      // }

      this.adminUsers.loading = true;
      this.adminUsers.error = null;

      try {
        const $f = useRequestFetch();

        const response = await $f<AdminUsersResponse>("/api/users", {
          method: "GET",
          headers: {
            "cache-control": "no-cache",
          },
          params: {
            t: Date.now(),
          },
        });

        const list = Array.isArray(response?.users) ? response.users : [];

        this.adminUsers.list = list;
        this.adminUsers.total =
          typeof response?.total === "number" ? response.total : list.length;
        this.adminUsers.prefix =
          typeof response?.prefix === "string" ? response.prefix : "";
        this.adminUsers.lastFetched = new Date().toISOString();

        return true;
      } catch (error: any) {
        console.error("Failed to fetch admin users:", error);
        this.adminUsers.list = [];
        this.adminUsers.total = 0;
        this.adminUsers.prefix = "";
        this.adminUsers.error =
          error?.statusMessage || error?.message || "Failed to load users";

        return false;
      } finally {
        this.adminUsers.loading = false;
      }
    },

    /**
     * Logout user by calling server logout endpoint and clearing local state
     */
    async logout(): Promise<boolean> {
      this.loading = true;
      this.error = null;

      try {
        // Call server logout endpoint
        await $fetch("/api/logout", {
          method: "DELETE",
        });

        // Clear local state regardless of server response for better UX
        this.user = null;
        this.session = null;
        this.error = null;
        this.loading = false;

        return true;
      } catch (error: any) {
        // Still clear local state even if server logout fails
        this.user = null;
        this.session = null;
        this.loading = false;

        // Only log error, don't set it since logout should always succeed locally
        console.warn("Server logout failed, but local state cleared:", error);

        return false;
      }
    },

    /**
     * Clear any authentication errors
     */
    clearError(): void {
      this.error = null;
    },

    /**
     * Set authentication state (useful for SSR hydration)
     */
    setLoggedUser(
      user /*: AuthUser | null, session: AuthSession | null*/,
    ): void {
      this.user = user;
      // this.session = session
      this.error = null;
    },

    /**
     * Set loading state
     */
    setLoading(loading: boolean): void {
      this.loading = loading;
    },

    /**
     * Set error state
     */
    setError(error: string | null): void {
      this.error = error;
    },

    /**
     * Update user data from SSE message
     */
    updateUserFromSSE(userDoc: AuthUser): void {
      if (this.user && userDoc.name === this.user.name) {
        // console.log('[AuthStore] Updating user from SSE:', userDoc.name)

        // Update user data while preserving reactive properties
        this.user = { ...this.user, ...userDoc };
        this.sse.lastUserUpdate = new Date().toISOString();

        // console.log('[AuthStore] User updated from real-time data')
      }
    },

    /**
     * Set SSE connection status
     */
    setSSEStatus(connected: boolean): void {
      const wasConnected = this.sse.connected;
      this.sse.connected = connected;

      if (connected && !wasConnected) {
        this.sse.connectionCount++;
        // console.log('[AuthStore] SSE connected')
      } else if (!connected && wasConnected) {
        // console.log('[AuthStore] SSE disconnected')
      }
    },

    /**
     * Get SSE connection info
     */
    getSSEInfo() {
      return {
        connected: this.sse.connected,
        lastUpdate: this.sse.lastUserUpdate,
        connectionCount: this.sse.connectionCount,
      };
    },
  },

  // SSR hydration
  hydrate(state, initialState) {
    // This method handles state hydration from server to client
    if (initialState) {
      Object.assign(state, initialState);
    }
  },
});
