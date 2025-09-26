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
    }
    stem: string | null
    _rev?: string
    meta?: Record<string, any>
    extension?: string
    navigation?: boolean
    createdAt?: string | null
    updatedAt?: string | null

    [key: string]: any
}

export interface ContentPageSummary {
    id: string
    path: string
    title: string | null
    seoTitle: string | null
    seoDescription: string | null
    meta: Record<string, any>
    updatedAt: string | null
    document: ContentPageDocument | null
}
