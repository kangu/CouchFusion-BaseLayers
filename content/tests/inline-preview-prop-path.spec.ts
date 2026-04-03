import { describe, it, expect } from 'vitest'
import { inferPropPathFromPreviewHint } from '../app/utils/inline-preview-prop-path'

describe('inferPropPathFromPreviewHint', () => {
  it('matches an exact text prop', () => {
    const props = {
      title: 'Build with CouchFusion',
      description: 'Ship faster'
    }

    const path = inferPropPathFromPreviewHint(props, {
      text: 'Build with CouchFusion'
    })

    expect(path).toEqual(['title'])
  })

  it('matches nested array item props', () => {
    const props = {
      features: [
        { title: 'Realtime Sync', description: 'Keep data in sync' },
        { title: 'Composable Content', description: 'Visual builder' }
      ]
    }

    const path = inferPropPathFromPreviewHint(props, {
      text: 'Composable Content'
    })

    expect(path).toEqual(['features', 1, 'title'])
  })

  it('prioritizes link/image hints before generic text', () => {
    const props = {
      ctaLabel: 'Read docs',
      ctaLink: '/docs',
      imageSrc: '/images/logo.svg',
      imageAlt: 'CouchFusion logo'
    }

    const linkPath = inferPropPathFromPreviewHint(props, {
      href: '/docs',
      text: 'Read docs'
    })
    const imagePath = inferPropPathFromPreviewHint(props, {
      src: '/images/logo.svg',
      alt: 'CouchFusion logo'
    })

    expect(linkPath).toEqual(['ctaLink'])
    expect(imagePath).toEqual(['imageSrc'])
  })

  it('returns null when no good match exists', () => {
    const props = {
      title: 'Build with CouchFusion'
    }

    const path = inferPropPathFromPreviewHint(props, {
      text: 'Unrelated value'
    })

    expect(path).toBeNull()
  })
})
