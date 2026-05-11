import { defineNuxtPlugin, useRuntimeConfig } from '#imports'
import {
  extractImageKitTransformations,
  mergeImageKitTransformations,
  normalizeTransformInput,
  resolveImageKitUrl,
  withImageKitTransformations,
} from '#imagekit/utils/transform'

const TRANSFORM_DATA_ATTR = 'ikTransforms'
const ENDPOINT_DATA_ATTR = 'ikEndpoint'
const SSR_TRANSFORM_ATTR = 'data-ik-transforms'
const SSR_ENDPOINT_ATTR = 'data-ik-endpoint'

const TRANSFORM_PROP = Symbol('imagekit:transform')
const ENDPOINT_PROP = Symbol('imagekit:endpoint')

type TransformInput = string | string[] | null | undefined

const toTransformInput = (value: unknown): TransformInput => {
  if (value === null || value === undefined) {
    return undefined
  }
  if (Array.isArray(value)) {
    return value.map((entry) => `${entry ?? ''}`)
  }
  if (typeof value === 'string') {
    return value
  }
  return `${value}`
}

const resolveBindingTransform = (value: unknown): string | null => {
  // Tuple syntax: [fixedTransforms, dynamicTransforms]
  if (Array.isArray(value) && value.length === 2) {
    const [fixed, dynamic] = value
    return mergeImageKitTransformations(
      toTransformInput(fixed),
      toTransformInput(dynamic),
    )
  }
  return normalizeTransformInput(toTransformInput(value))
}

const setTransformMeta = (el: HTMLImageElement, transform: string | null, endpoint: string | undefined) => {
  if (transform) {
    el.dataset[TRANSFORM_DATA_ATTR] = transform
    ;(el as any)[TRANSFORM_PROP] = transform
  } else {
    delete el.dataset[TRANSFORM_DATA_ATTR]
    delete (el as any)[TRANSFORM_PROP]
  }

  if (endpoint) {
    el.dataset[ENDPOINT_DATA_ATTR] = endpoint
    ;(el as any)[ENDPOINT_PROP] = endpoint
  } else {
    delete el.dataset[ENDPOINT_DATA_ATTR]
    delete (el as any)[ENDPOINT_PROP]
  }
}

const applyImmediateTransform = (el: HTMLImageElement) => {
  const transform = (el as any)[TRANSFORM_PROP] as string | undefined
  const endpoint = (el as any)[ENDPOINT_PROP] as string | undefined

  const candidateSrc = el.getAttribute('data-lazy-src') || el.getAttribute('src')

  if (!candidateSrc) {
    return
  }

  const absolute = resolveImageKitUrl(candidateSrc, endpoint)
  const sourceWithTransforms = extractImageKitTransformations(absolute, endpoint)
  const mergedTransforms = mergeImageKitTransformations(
    sourceWithTransforms.transformations,
    transform,
  )
  const transformed = mergedTransforms
    ? withImageKitTransformations(sourceWithTransforms.source, {
        transformations: mergedTransforms,
        endpoint,
      })
    : sourceWithTransforms.source

  if (el.getAttribute('data-lazy-src')) {
    el.setAttribute('data-lazy-src', transformed)
    el.dispatchEvent(
      new CustomEvent('imagekit:transformed', {
        detail: { src: transformed },
      }),
    )
  } else {
    el.src = transformed
  }
}

export default defineNuxtPlugin((nuxtApp) => {
  if (nuxtApp.vueApp.directive('imagekit')) {
    return
  }

  const runtimeConfig = useRuntimeConfig()
  const endpoint =
    runtimeConfig.public?.imagekit?.urlEndpoint || runtimeConfig.imagekit?.urlEndpoint || undefined

  nuxtApp.vueApp.directive('imagekit', {
    getSSRProps(binding) {
      const transform = resolveBindingTransform(binding.value)
      if (!transform) {
        return {}
      }
      const attrs: Record<string, string> = {
        [SSR_TRANSFORM_ATTR]: transform,
      }
      if (endpoint) {
        attrs[SSR_ENDPOINT_ATTR] = endpoint
      }
      return attrs
    },
    mounted(el, binding) {
      const transform = resolveBindingTransform(binding.value)
      setTransformMeta(el, transform, endpoint)
      applyImmediateTransform(el)
    },
    updated(el, binding) {
      const transform = resolveBindingTransform(binding.value)
      setTransformMeta(el, transform, endpoint)
      applyImmediateTransform(el)
    },
    beforeUnmount(el) {
      setTransformMeta(el, null, undefined)
    },
  })
})
