<script setup lang="ts">
import { reactive, ref, watch } from "vue";
import { storeToRefs } from "pinia";

definePageMeta({
    layout: false,
});

const authStore = useAuthStore();
const { isAuthenticated, loading } = storeToRefs(authStore);
const router = useRouter();

const form = reactive({
    username: "",
    password: "",
});

const isSubmitting = ref(false);
const errorMessage = ref<string | null>(null);
const successMessage = ref<string | null>(null);

watch(
    isAuthenticated,
    async (loggedIn) => {
        if (loggedIn) {
            await router.push("/builder");
        }
    },
    { immediate: true },
);

const handleSubmit = async () => {
    if (isSubmitting.value) {
        return;
    }

    errorMessage.value = null;
    successMessage.value = null;

    const username = form.username.trim();
    const password = form.password;

    if (!username || !password) {
        errorMessage.value = "Please enter both username and password.";
        return;
    }

    isSubmitting.value = true;

    try {
        const response = await $fetch<{ success: boolean }>(
            "/api/login-with-password",
            {
                method: "POST",
                body: {
                    username,
                    password,
                },
            },
        );

        if (!response?.success) {
            throw createError({
                statusCode: 401,
                statusMessage: "Invalid credentials",
            });
        }

        await authStore.fetchUser();
        successMessage.value = "Login successful. Redirecting…";
        await router.push("/builder");
    } catch (error: any) {
        console.error("Login failed:", error);
        errorMessage.value =
            error?.data?.message ||
            error?.statusMessage ||
            "Unable to sign in. Please try again.";
    } finally {
        isSubmitting.value = false;
    }
};

useHead(() => ({
    title: "Sign in",
    meta: [
        {
            name: "description",
            content: "Sign in to manage Radustanciu content.",
        },
    ],
}));
</script>

<template>
    <main class="login-page">
        <section class="login-card">
            <header class="login-header">
                <h1>Radustanciu Studio</h1>
                <p>Sign in with your editor credentials.</p>
            </header>
            <form class="login-form" @submit.prevent="handleSubmit">
                <label class="input-group">
                    <span>Username</span>
                    <input
                        v-model="form.username"
                        type="text"
                        autocomplete="username"
                        placeholder="you@example.com"
                        :disabled="isSubmitting"
                        required
                    />
                </label>

                <label class="input-group">
                    <span>Password</span>
                    <input
                        v-model="form.password"
                        type="password"
                        autocomplete="current-password"
                        placeholder="••••••••"
                        :disabled="isSubmitting"
                        required
                    />
                </label>

                <button
                    class="login-button"
                    type="submit"
                    :disabled="isSubmitting || loading"
                >
                    <span v-if="isSubmitting">Signing in…</span>
                    <span v-else>Sign in</span>
                </button>
            </form>

            <p v-if="errorMessage" class="feedback error">
                {{ errorMessage }}
            </p>

            <p v-if="successMessage" class="feedback success">
                {{ successMessage }}
            </p>
        </section>
    </main>
</template>

<style scoped>
.login-page {
    min-height: 100vh;
    display: grid;
    place-items: center;
    background: radial-gradient(circle at top, #f3f4f6, #e5e7eb);
    padding: 32px 16px;
}

.login-card {
    width: min(420px, 100%);
    padding: 32px;
    border-radius: 16px;
    background: white;
    box-shadow:
        0 10px 30px rgba(15, 23, 42, 0.08),
        0 2px 6px rgba(15, 23, 42, 0.04);
    display: grid;
    gap: 24px;
}

.login-header h1 {
    font-size: 1.75rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    margin-bottom: 8px;
}

.login-header p {
    color: #6b7280;
    font-size: 0.95rem;
}

.login-form {
    display: grid;
    gap: 16px;
}

.input-group {
    display: grid;
    gap: 8px;
    font-weight: 500;
    color: #374151;
}

.input-group input {
    width: 100%;
    padding: 12px 14px;
    border-radius: 10px;
    border: 1px solid #d1d5db;
    font-size: 0.95rem;
    transition:
        border-color 0.2s ease,
        box-shadow 0.2s ease;
}

.input-group input:focus {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
}

.input-group input:disabled {
    background: #f9fafb;
    cursor: not-allowed;
}

.login-button {
    width: 100%;
    padding: 12px 14px;
    border-radius: 10px;
    border: none;
    font-weight: 600;
    font-size: 1rem;
    color: white;
    background: linear-gradient(135deg, #2563eb, #7c3aed);
    cursor: pointer;
    transition:
        transform 0.1s ease,
        box-shadow 0.2s ease,
        opacity 0.2s ease;
}

.login-button:hover:enabled {
    transform: translateY(-1px);
    box-shadow: 0 12px 20px rgba(79, 70, 229, 0.18);
}

.login-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.feedback {
    font-size: 0.9rem;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid transparent;
}

.feedback.error {
    color: #b91c1c;
    background: rgba(248, 113, 113, 0.12);
    border-color: rgba(248, 113, 113, 0.4);
}

.feedback.success {
    color: #047857;
    background: rgba(52, 211, 153, 0.12);
    border-color: rgba(52, 211, 153, 0.4);
}

@media (max-width: 480px) {
    .login-card {
        padding: 24px;
        border-radius: 12px;
    }

    .login-header h1 {
        font-size: 1.5rem;
    }
}
</style>
