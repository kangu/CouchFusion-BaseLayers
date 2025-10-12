import { defineNuxtPlugin, useRuntimeConfig } from '#imports'
import { normalizeTransformInput, resolveImageKitUrl, withImageKitTransformations } from '#imagekit/utils/transform'

const TRANSFORM_DATA_ATTR = 'ikTransforms'
const ENDPOINT_DATA_ATTR = 'ikEndpoint'
const SSR_TRANSFORM_ATTR = 'data-ik-transforms'
const SSR_ENDPOINT_ATTR = 'data-ik-endpoint'

const TRANSFORM_PROP = Symbol('imagekit:transform')
const ENDPOINT_PROP = Symbol('imagekit:endpoint')

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
  const transformed =
    transform && transform.length
      ? withImageKitTransformations(absolute, {
          transformations: transform,
          endpoint,
        })
      : absolute

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
  const runtimeConfig = useRuntimeConfig()
  const endpoint =
    runtimeConfig.public?.imagekit?.urlEndpoint || runtimeConfig.imagekit?.urlEndpoint || undefined

  nuxtApp.vueApp.directive('imagekit', {
    getSSRProps(binding) {
      const transform = normalizeTransformInput(binding.value)
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
      const transform = normalizeTransformInput(binding.value)
      setTransformMeta(el, transform, endpoint)
      applyImmediateTransform(el)
    },
    updated(el, binding) {
      const transform = normalizeTransformInput(binding.value)
      setTransformMeta(el, transform, endpoint)
      applyImmediateTransform(el)
    },
    beforeUnmount(el) {
      setTransformMeta(el, null, undefined)
    },
  })
})
