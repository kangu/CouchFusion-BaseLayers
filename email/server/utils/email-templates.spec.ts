import { describe, expect, it } from 'vitest'
import { extractEditableMjmlTexts } from './email-templates'

describe('extractEditableMjmlTexts', () => {
  it('extracts editable texts and replaces them with distinct placeholders', () => {
    const mjml = `
      <mjml>
        <mj-body>
          <mj-section>
            <mj-column>
              <mj-text>New lite member</mj-text>
              <mj-text>New lite member subscribed</mj-text>
              <mj-text>New Lite member</mj-text>
              <mj-text>Bitvocation</mj-text>
              <mj-text>Total</mj-text>
              <mj-button>View in Admin</mj-button>
            </mj-column>
          </mj-section>
        </mj-body>
      </mjml>
    `

    const result = extractEditableMjmlTexts(mjml)

    expect(result.texts).toEqual([
      'New lite member',
      'New lite member subscribed',
      'New Lite member',
      'Bitvocation',
      'Total',
      'View in Admin'
    ])

    expect(result.transformedMjml).toContain('>[new-lite-member]<')
    expect(result.transformedMjml).toContain('>[new-lite-member-subscribed]<')
    expect(result.transformedMjml).toContain('>[new-lite-member-2]<')
    expect(result.transformedMjml).toContain('>[bitvocation]<')
    expect(result.transformedMjml).toContain('>[total]<')
    expect(result.transformedMjml).toContain('>[view-in-admin]<')
  })

  it('keeps dynamic handlebars segments and replaces only static fragments', () => {
    const mjml = '<mj-text>Hello {{ firstName }}, welcome to Bitvocation</mj-text>'
    const result = extractEditableMjmlTexts(mjml)

    expect(result.texts).toEqual(['Hello', ', welcome to Bitvocation'])
    expect(result.transformedMjml).toBe('<mj-text>[hello]{{ firstName }}[welcome-to-bitvocation]</mj-text>')
  })

  it('uses distinct placeholders for repeated identical text occurrences', () => {
    const mjml = '<mj-text>Bitvocation</mj-text><mj-button>Bitvocation</mj-button>'
    const result = extractEditableMjmlTexts(mjml)

    expect(result.texts).toEqual(['Bitvocation', 'Bitvocation'])
    expect(result.transformedMjml).toContain('<mj-text>[bitvocation]</mj-text>')
    expect(result.transformedMjml).toContain('<mj-button>[bitvocation-2]</mj-button>')
  })

  it('ignores empty and non-alphanumeric text chunks', () => {
    const mjml = '<mj-text>   </mj-text><mj-text>---</mj-text><mj-text>123</mj-text>'
    const result = extractEditableMjmlTexts(mjml)

    expect(result.texts).toEqual(['123'])
    expect(result.transformedMjml).toContain('<mj-text>   </mj-text>')
    expect(result.transformedMjml).toContain('<mj-text>---</mj-text>')
    expect(result.transformedMjml).toContain('<mj-text>[123]</mj-text>')
  })

  it('ignores text content inside mj-style blocks', () => {
    const mjml = `
      <mjml>
        <mj-head>
          <mj-style inline="inline">
            .cta::before { content: "View in Admin"; }
          </mj-style>
        </mj-head>
        <mj-body>
          <mj-section>
            <mj-column>
              <mj-text>View in Admin</mj-text>
            </mj-column>
          </mj-section>
        </mj-body>
      </mjml>
    `

    const result = extractEditableMjmlTexts(mjml)

    expect(result.texts).toEqual(['View in Admin'])
    expect(result.transformedMjml).toContain('content: "View in Admin";')
    expect(result.transformedMjml).toContain('<mj-text>[view-in-admin]</mj-text>')
  })
})
