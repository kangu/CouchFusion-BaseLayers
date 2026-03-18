import type { Ref } from 'vue'

interface EmailTemplate {
  _id: string
  _rev?: string
  subject?: string
  mjml?: string
  html?: string
  params?: string[]
  [key: string]: unknown
}

interface TemplatesResponse {
  success: boolean
  templates: EmailTemplate[]
  total: number
}

interface TemplateResponse {
  success: boolean
  template: EmailTemplate
}

interface CreateTemplatePayload {
  id: string
  subject?: string
  mjml?: string
  html?: string
}

interface UpdateTemplatePayload {
  _id: string
  _rev: string
  subject?: string
  mjml?: string
  html?: string
  params?: string[]
}

/**
 * Composable for email template CRUD operations
 */
export const useEmailTemplates = () => {
  const { $fetch } = useNuxtApp()
  
  /**
   * Fetch all email templates
   */
  const fetchTemplates = async (): Promise<TemplatesResponse> => {
    const response = await $fetch<TemplatesResponse>('/api/email-templates', {
      credentials: 'include'
    })
    return response
  }
  
  /**
   * Fetch a single email template by ID
   */
  const fetchTemplate = async (id: string): Promise<TemplateResponse> => {
    const response = await $fetch<TemplateResponse>(
      `/api/email-templates/${encodeURIComponent(id)}`,
      { credentials: 'include' }
    )
    return response
  }
  
  /**
   * Create a new email template
   */
  const createTemplate = async (payload: CreateTemplatePayload): Promise<TemplateResponse> => {
    const response = await $fetch<TemplateResponse>('/api/email-templates', {
      method: 'POST',
      body: payload,
      credentials: 'include'
    })
    return response
  }
  
  /**
   * Update an existing email template
   */
  const updateTemplate = async (id: string, payload: UpdateTemplatePayload): Promise<TemplateResponse> => {
    const response = await $fetch<TemplateResponse>(
      `/api/email-templates/${encodeURIComponent(id)}`,
      {
        method: 'PUT',
        body: payload,
        credentials: 'include'
      }
    )
    return response
  }
  
  return {
    fetchTemplates,
    fetchTemplate,
    createTemplate,
    updateTemplate
  }
}
