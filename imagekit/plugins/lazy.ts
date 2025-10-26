import { resolveImageKitUrl, withImageKitTransformations } from '#imagekit/utils/transform'
import { useRuntimeConfig } from '#imports'

const PLACEHOLDER_SRC = 'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=' as const
const TRANSFORM_ATTR = 'ikTransforms'
const ENDPOINT_ATTR = 'ikEndpoint'
const IMAGEKIT_EVENT = 'imagekit:transformed'

export default defineNuxtPlugin((nuxtApp) => {
  const OBSERVER_KEY = Symbol('lazyObserver')
  const SOURCE_KEY = Symbol('lazySource')
  const IMAGEKIT_HANDLER_KEY = Symbol('lazyImageKitHandler')
  const isClient = typeof window !== 'undefined'
  const runtimeConfig = useRuntimeConfig()
  const defaultEndpoint =
    runtimeConfig.public?.imagekit?.urlEndpoint || runtimeConfig.imagekit?.urlEndpoint

  const computeTargetSrc = (el: HTMLImageElement, rawSrc?: string | null): string | null => {
    if (!rawSrc) {
      return null
    }

    const endpoint = el.dataset?.[ENDPOINT_ATTR] || defaultEndpoint
    const trimmed = rawSrc.trim()

    if (/^(data:|blob:)/i.test(trimmed)) {
      return trimmed
    }

    const absolute = resolveImageKitUrl(trimmed, endpoint)
    const transforms = el.dataset?.[TRANSFORM_ATTR]

    if (transforms) {
      return withImageKitTransformations(absolute, {
        transformations: transforms,
        endpoint,
      })
    }

    return absolute
  }

  const createObserver = (el: HTMLImageElement, targetSrc: string) => {
    if (!isClient || typeof IntersectionObserver === 'undefined') {
      el.src = targetSrc
      return null
    }

    el.src = PLACEHOLDER_SRC

    const observer = new IntersectionObserver((entries, instance) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return
        }

        const image = new Image()
        image.src = targetSrc

        image.onload = () => {
          el.src = targetSrc
          instance.unobserve(el)
          instance.disconnect()
        }

        image.onerror = () => {
          el.src = PLACEHOLDER_SRC
          instance.unobserve(el)
          instance.disconnect()
        }
      })
    }, {
      rootMargin: '0px',
      threshold: 0.1
    })

    observer.observe(el)
    return observer
  }

  nuxtApp.vueApp.directive('lazy', {
    getSSRProps(binding) {
      return {
        src: PLACEHOLDER_SRC,
        'data-lazy-src': binding.value ?? ''
      }
    },
    mounted(el: HTMLImageElement, binding) {
      const targetSrc = computeTargetSrc(el, binding.value)
      if (!targetSrc) {
        return
      }

      ;(el as any)[SOURCE_KEY] = targetSrc
      el.setAttribute('data-lazy-src', targetSrc)

      const observer = createObserver(el, targetSrc)
      if (observer) {
        ;(el as any)[OBSERVER_KEY] = observer
      }

      const handleImageKitUpdate = (event: Event) => {
        const custom = event as CustomEvent<{ src?: string }>
        const nextSrc = custom.detail?.src
        if (!nextSrc || nextSrc === (el as any)[SOURCE_KEY]) {
          return
        }

        ;(el as any)[SOURCE_KEY] = nextSrc
        el.setAttribute('data-lazy-src', nextSrc)

        const existingObserver: IntersectionObserver | undefined = (el as any)[OBSERVER_KEY]
        if (existingObserver) {
          existingObserver.unobserve(el)
          existingObserver.disconnect()
        }

        const nextObserver = createObserver(el, nextSrc)
        if (nextObserver) {
          ;(el as any)[OBSERVER_KEY] = nextObserver
        } else if (!isClient) {
          el.src = nextSrc
        }
      }

      el.addEventListener(IMAGEKIT_EVENT, handleImageKitUpdate as EventListener)
      ;(el as any)[IMAGEKIT_HANDLER_KEY] = handleImageKitUpdate
    },
    updated(el: HTMLImageElement, binding) {
      const newSrc = computeTargetSrc(el, binding.value)
      if (!newSrc || newSrc === (el as any)[SOURCE_KEY]) {
        return
      }

      ;(el as any)[SOURCE_KEY] = newSrc
      el.setAttribute('data-lazy-src', newSrc)

      const existingObserver: IntersectionObserver | undefined = (el as any)[OBSERVER_KEY]
      if (existingObserver) {
        existingObserver.unobserve(el)
        existingObserver.disconnect()
      }

      const observer = createObserver(el, newSrc)
      if (observer) {
        ;(el as any)[OBSERVER_KEY] = observer
      } else if (!isClient) {
        el.src = newSrc
      }
    },
    beforeUnmount(el: HTMLImageElement) {
      if (!isClient) {
        return
      }

      const observer: IntersectionObserver | undefined = (el as any)[OBSERVER_KEY]
      if (observer) {
        observer.unobserve(el)
        observer.disconnect()
      }
      delete (el as any)[OBSERVER_KEY]
      delete (el as any)[SOURCE_KEY]

      const handler: ((event: Event) => void) | undefined = (el as any)[IMAGEKIT_HANDLER_KEY]
      if (handler) {
        el.removeEventListener(IMAGEKIT_EVENT, handler as EventListener)
        delete (el as any)[IMAGEKIT_HANDLER_KEY]
      }
    }
  })
})
