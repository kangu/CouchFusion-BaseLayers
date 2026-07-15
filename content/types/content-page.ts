export type ContentPagePublicationState = 'published' | 'draft'

export interface ContentRouteAccessPolicy {
    mode: 'entry-session'
    allowedFrom: string[]
    redirectTo: string
}

export interface ContentPageDocument {
    _id: string
    title: string | null
    layout?: {
        spacing?: string | null

        [key: string]: any
    } | null
    body: {
        type: 'minimal'
        value: any[]
    }
    path: string
    seo: {
        title: string | null
        description: string | null
        image?: string | null
    }
    stem: string | null
    _rev?: string
    meta?: Record<string, any>
    extension?: string
    navigation?: boolean
    publicationState?: ContentPagePublicationState
    createdAt?: string | null
    updatedAt?: string | null

    [key: string]: any
}

export interface ContentPageLocalizationSummary {
    locale: string
    defaultLocale: string
    masterId: string
    hasLocaleDocument: boolean
    missingLocalizedCount: number
    updatedAtByLocale: Record<string, string>
    availableLocales?: string[]
    missingLocales?: string[]
}

export interface ContentPageSummary {
    id: string
    path: string
    title: string | null
    seoTitle: string | null
    seoDescription: string | null
    seoImage: string | null
    publicationState: ContentPagePublicationState
    meta: Record<string, any>
    updatedAt: string | null
    document: ContentPageDocument | null
    localization?: ContentPageLocalizationSummary | null
}

export interface ContentPageHistoryEntry {
    id: string
    path: string
    locale?: string | null
    title: string | null
    timestamp: string
    document: ContentPageDocument
}
