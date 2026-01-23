import { resolveImageKitUrl, withImageKitTransformations } from '#imagekit/utils/transform'
import { useRuntimeConfig } from '#imports'

const TRANSFORM_ATTR = 'ikTransforms'
const ENDPOINT_ATTR = 'ikEndpoint'

export default defineNuxtPlugin((nuxtApp) => {
  const OBSERVER_KEY = Symbol('lazyBgObserver')
  const SOURCE_KEY = Symbol('lazyBgSource')
  const isClient = typeof window !== 'undefined'
  const runtimeConfig = useRuntimeConfig()
  const defaultEndpoint =
    runtimeConfig.public?.imagekit?.urlEndpoint || runtimeConfig.imagekit?.urlEndpoint

  const setBackground = (el: HTMLElement, url: string) => {
    el.style.backgroundImage = `url("${url}")`
  }

  const computeTargetSrc = (el: HTMLElement, rawSrc?: string | null): string | null => {
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

  const createObserver = (el: HTMLElement, targetSrc: string) => {
    if (!isClient || typeof IntersectionObserver === 'undefined') {
      setBackground(el, targetSrc)
      return null
    }

    const observer = new IntersectionObserver(
      (entries, instance) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return
          }

          setBackground(el, targetSrc)
          instance.unobserve(el)
          instance.disconnect()
        })
      },
      {
        rootMargin: '0px',
        threshold: 0.1,
      },
    )

    observer.observe(el)
    return observer
  }

  nuxtApp.vueApp.directive('lazy-bg', {
    getSSRProps(binding) {
      return {
        'data-lazy-bg': binding.value ?? '',
      }
    },
    mounted(el: HTMLElement, binding) {
      const targetSrc = computeTargetSrc(el, binding.value)
      if (!targetSrc) {
        return
      }

      ;(el as any)[SOURCE_KEY] = targetSrc
      el.setAttribute('data-lazy-bg', targetSrc)

      const observer = createObserver(el, targetSrc)
      if (observer) {
        ;(el as any)[OBSERVER_KEY] = observer
      } else if (!isClient) {
        setBackground(el, targetSrc)
      }
    },
    updated(el: HTMLElement, binding) {
      const nextSrc = computeTargetSrc(el, binding.value)
      if (!nextSrc || nextSrc === (el as any)[SOURCE_KEY]) {
        return
      }

      ;(el as any)[SOURCE_KEY] = nextSrc
      el.setAttribute('data-lazy-bg', nextSrc)

      const existingObserver: IntersectionObserver | undefined = (el as any)[OBSERVER_KEY]
      if (existingObserver) {
        existingObserver.unobserve(el)
        existingObserver.disconnect()
      }

      const observer = createObserver(el, nextSrc)
      if (observer) {
        ;(el as any)[OBSERVER_KEY] = observer
      } else if (!isClient) {
        setBackground(el, nextSrc)
      }
    },
    beforeUnmount(el: HTMLElement) {
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
    },
  })
})
