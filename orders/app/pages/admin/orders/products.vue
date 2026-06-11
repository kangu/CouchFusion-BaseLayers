<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'

definePageMeta({
  middleware: ['admin-auth'],
  layout: 'admin-workspace',
})

type ProductStatus = 'draft' | 'active' | 'archived'

interface OrdersProduct {
  _id: string
  _rev?: string
  name: string
  slug: string
  description: string
  priceRon: number
  currency: 'RON'
  stock: number
  status: ProductStatus
  tags: string[]
  image: string
  imageImagekitTransforms: string[]
  sortOrder: number
  featured: boolean
  createdAt: string
  updatedAt: string
}

interface ProductsResponse {
  success: boolean
  products: OrdersProduct[]
}

const defaultAdminLabels = {
  ordersSectionLabel: 'Orders',
  productsTitle: 'Products',
  totalSuffix: 'total',
  activeSuffix: 'active',
  catalogTitle: 'Catalog',
  loadingProducts: 'Loading products...',
  emptyProducts: 'No products yet.',
  productColumn: 'Product',
  priceColumn: 'Price',
  stockColumn: 'Stock',
  statusColumn: 'Status',
  actionsColumn: 'Actions',
  editButton: 'Edit',
  archiveButton: 'Archive',
  newProductTitle: 'New product',
  editProductTitle: 'Edit product',
  resetButton: 'Reset',
  nameLabel: 'Name',
  slugLabel: 'Slug',
  descriptionLabel: 'Description',
  priceRonLabel: 'Price RON',
  stockLabel: 'Stock',
  statusLabel: 'Status',
  draftStatus: 'Draft',
  activeStatus: 'Active',
  archivedStatus: 'Archived',
  sortOrderLabel: 'Sort order',
  imageUrlLabel: 'Image URL',
  tagsLabel: 'Tags',
  imagekitTransformsLabel: 'ImageKit transforms',
  featuredLabel: 'Featured',
  createProductButton: 'Create product',
  saveProductButton: 'Save product',
  savingLabel: 'Saving...',
  productCreatedNotice: 'Product created.',
  productUpdatedNotice: 'Product updated.',
  productArchivedNotice: 'Product archived.',
  loadProductsError: 'Unable to load products.',
  saveProductError: 'Unable to save product.',
  archiveProductError: 'Unable to archive product.',
}

type AdminLabels = typeof defaultAdminLabels

interface AdminLabelsResponse {
  success: boolean
  labels: Partial<AdminLabels>
}

const products = ref<OrdersProduct[]>([])
const selectedProductId = ref<string | null>(null)
const isLoading = ref(false)
const isSaving = ref(false)
const notice = ref<string | null>(null)
const errorMessage = ref<string | null>(null)
const labels = ref<AdminLabels>({ ...defaultAdminLabels })

const form = reactive({
  name: '',
  slug: '',
  description: '',
  priceRon: 0,
  stock: 0,
  status: 'draft' as ProductStatus,
  tags: '',
  image: '',
  imageImagekitTransforms: '',
  sortOrder: 0,
  featured: false,
})

const selectedProduct = computed(() => {
  return products.value.find((product) => product._id === selectedProductId.value) ?? null
})

const activeCount = computed(() => {
  return products.value.filter((product) => product.status === 'active').length
})

const loadAdminLabels = async () => {
  try {
    const response = await $fetch<AdminLabelsResponse>('/api/orders/settings/admin-labels')
    labels.value = {
      ...defaultAdminLabels,
      ...(response.labels ?? {}),
    }
  } catch {
    labels.value = { ...defaultAdminLabels }
  }
}

const resetForm = () => {
  selectedProductId.value = null
  Object.assign(form, {
    name: '',
    slug: '',
    description: '',
    priceRon: 0,
    stock: 0,
    status: 'draft',
    tags: '',
    image: '',
    imageImagekitTransforms: '',
    sortOrder: 0,
    featured: false,
  })
}

const editProduct = (product: OrdersProduct) => {
  selectedProductId.value = product._id
  Object.assign(form, {
    name: product.name,
    slug: product.slug,
    description: product.description,
    priceRon: product.priceRon,
    stock: product.stock,
    status: product.status,
    tags: product.tags.join(', '),
    image: product.image,
    imageImagekitTransforms: product.imageImagekitTransforms.join(', '),
    sortOrder: product.sortOrder,
    featured: product.featured,
  })
}

const loadProducts = async () => {
  isLoading.value = true
  errorMessage.value = null

  try {
    const response = await $fetch<ProductsResponse>('/api/orders/products')
    products.value = response.products ?? []
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || error?.message || labels.value.loadProductsError
  } finally {
    isLoading.value = false
  }
}

const saveProduct = async () => {
  isSaving.value = true
  notice.value = null
  errorMessage.value = null

  const payload = {
    ...form,
    tags: form.tags,
    imageImagekitTransforms: form.imageImagekitTransforms,
  }

  try {
    if (selectedProduct.value) {
      await $fetch(`/api/orders/products/${encodeURIComponent(selectedProduct.value._id)}`, {
        method: 'PUT',
        body: payload,
      })
      notice.value = labels.value.productUpdatedNotice
    } else {
      await $fetch('/api/orders/products', {
        method: 'POST',
        body: payload,
      })
      notice.value = labels.value.productCreatedNotice
    }

    await loadProducts()
    resetForm()
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || error?.message || labels.value.saveProductError
  } finally {
    isSaving.value = false
  }
}

const archiveProduct = async (product: OrdersProduct) => {
  isSaving.value = true
  notice.value = null
  errorMessage.value = null

  try {
    await $fetch(`/api/orders/products/${encodeURIComponent(product._id)}`, {
      method: 'DELETE',
    })
    notice.value = labels.value.productArchivedNotice
    await loadProducts()
    if (selectedProductId.value === product._id) {
      resetForm()
    }
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || error?.message || labels.value.archiveProductError
  } finally {
    isSaving.value = false
  }
}

onMounted(() => {
  loadAdminLabels()
  loadProducts()
})
</script>

<template>
  <main class="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
    <div class="mx-auto max-w-7xl space-y-6">
      <header class="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p class="text-sm font-semibold uppercase tracking-wide text-slate-500">{{ labels.ordersSectionLabel }}</p>
          <h1 class="mt-1 text-3xl font-semibold tracking-tight">{{ labels.productsTitle }}</h1>
        </div>
        <div class="flex gap-3 text-sm">
          <span class="rounded-md border border-slate-200 bg-white px-3 py-2">{{ products.length }} {{ labels.totalSuffix }}</span>
          <span class="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">{{ activeCount }} {{ labels.activeSuffix }}</span>
        </div>
      </header>

      <p v-if="notice" class="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{{ notice }}</p>
      <p v-if="errorMessage" class="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{{ errorMessage }}</p>

      <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section class="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div class="border-b border-slate-200 px-4 py-3">
            <h2 class="font-semibold">{{ labels.catalogTitle }}</h2>
          </div>

          <div v-if="isLoading" class="px-4 py-8 text-sm text-slate-500">{{ labels.loadingProducts }}</div>
          <div v-else-if="!products.length" class="px-4 py-8 text-sm text-slate-500">{{ labels.emptyProducts }}</div>
          <div v-else class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-200 text-sm">
              <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th class="px-4 py-3">{{ labels.productColumn }}</th>
                  <th class="px-4 py-3">{{ labels.priceColumn }}</th>
                  <th class="px-4 py-3">{{ labels.stockColumn }}</th>
                  <th class="px-4 py-3">{{ labels.statusColumn }}</th>
                  <th class="px-4 py-3 text-right">{{ labels.actionsColumn }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="product in products" :key="product._id">
                  <td class="px-4 py-3">
                    <div class="font-medium">{{ product.name }}</div>
                    <div class="text-xs text-slate-500">{{ product.slug }}</div>
                  </td>
                  <td class="px-4 py-3">{{ product.priceRon }} {{ product.currency }}</td>
                  <td class="px-4 py-3">{{ product.stock }}</td>
                  <td class="px-4 py-3">
                    <span class="rounded-md px-2 py-1 text-xs font-medium" :class="{
                      'bg-emerald-50 text-emerald-700': product.status === 'active',
                      'bg-amber-50 text-amber-700': product.status === 'draft',
                      'bg-slate-100 text-slate-600': product.status === 'archived'
                    }">
                      {{ product.status }}
                    </span>
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex justify-end gap-2">
                      <button type="button" class="rounded-md border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50" @click="editProduct(product)">{{ labels.editButton }}</button>
                      <button type="button" class="rounded-md border border-rose-200 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-50" :disabled="isSaving || product.status === 'archived'" @click="archiveProduct(product)">{{ labels.archiveButton }}</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <aside class="rounded-lg border border-slate-200 bg-white">
          <div class="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 class="font-semibold">{{ selectedProduct ? labels.editProductTitle : labels.newProductTitle }}</h2>
            <button type="button" class="rounded-md border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50" @click="resetForm">{{ labels.resetButton }}</button>
          </div>

          <form class="space-y-4 p-4" @submit.prevent="saveProduct">
            <label class="block text-sm font-medium">
              {{ labels.nameLabel }}
              <input v-model="form.name" required class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" type="text">
            </label>

            <label class="block text-sm font-medium">
              {{ labels.slugLabel }}
              <input v-model="form.slug" :disabled="Boolean(selectedProduct)" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-100" type="text" placeholder="generated-from-name">
            </label>

            <label class="block text-sm font-medium">
              {{ labels.descriptionLabel }}
              <textarea v-model="form.description" class="mt-1 min-h-28 w-full rounded-md border border-slate-300 px-3 py-2" />
            </label>

            <div class="grid grid-cols-2 gap-3">
              <label class="block text-sm font-medium">
                {{ labels.priceRonLabel }}
                <input v-model.number="form.priceRon" min="0" step="0.01" required class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" type="number">
              </label>
              <label class="block text-sm font-medium">
                {{ labels.stockLabel }}
                <input v-model.number="form.stock" min="0" required class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" type="number">
              </label>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <label class="block text-sm font-medium">
                {{ labels.statusLabel }}
                <select v-model="form.status" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2">
                  <option value="draft">{{ labels.draftStatus }}</option>
                  <option value="active">{{ labels.activeStatus }}</option>
                  <option value="archived">{{ labels.archivedStatus }}</option>
                </select>
              </label>
              <label class="block text-sm font-medium">
                {{ labels.sortOrderLabel }}
                <input v-model.number="form.sortOrder" min="0" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" type="number">
              </label>
            </div>

            <label class="block text-sm font-medium">
              {{ labels.imageUrlLabel }}
              <input v-model="form.image" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" type="text">
            </label>

            <label class="block text-sm font-medium">
              {{ labels.tagsLabel }}
              <input v-model="form.tags" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" type="text" placeholder="bracelet, cats, sparkly">
            </label>

            <label class="block text-sm font-medium">
              {{ labels.imagekitTransformsLabel }}
              <input v-model="form.imageImagekitTransforms" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" type="text" placeholder="w-900, h-700, fo-auto">
            </label>

            <label class="flex items-center gap-2 text-sm font-medium">
              <input v-model="form.featured" type="checkbox" class="h-4 w-4 rounded border-slate-300">
              {{ labels.featuredLabel }}
            </label>

            <button type="submit" class="w-full rounded-md bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60" :disabled="isSaving">
              {{ isSaving ? labels.savingLabel : selectedProduct ? labels.saveProductButton : labels.createProductButton }}
            </button>
          </form>
        </aside>
      </div>
    </div>
  </main>
</template>
