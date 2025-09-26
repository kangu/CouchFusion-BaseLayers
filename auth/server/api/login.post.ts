import {defineEventHandler, readBody, createError} from "h3"
import { getDocument } from '#database/utils/couchdb'

// Helper function so not to import anything external
function isValidEmail (email) {
    // simple RFC 5322-ish check — good enough for most APIs
    return typeof email === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
}

export default defineEventHandler(async (event) => {
    const body = await readBody(event)

    if (!body || !isValidEmail(body.email)) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Invalid input: "email" must be an email address',
        })
    }

    const affiliateCode = typeof body.affiliateCode === 'string'
        ? body.affiliateCode.trim()
        : ''

    const config = useRuntimeConfig()
    const dbLoginPrefix = config.dbLoginPrefix;
    const DB = `${dbLoginPrefix}-logins`

    // Validate required runtime config
    if (!config.dbLoginPrefix) {
        throw createError({
            statusCode: 500,
            statusMessage: 'Server configuration error: dbLoginPrefix is required but not configured'
        })
    }

    // record timestamp with expiration of 60 minutes
    const timestamp = new Date()
    const expireTimestamp = new Date(timestamp);
    expireTimestamp.setMinutes(expireTimestamp.getMinutes() + 60);

    let validatedAffiliateCode: string | undefined

    if (affiliateCode) {
        const affiliateDocumentId = `org.couchdb.user:${dbLoginPrefix}${affiliateCode}`
        const affiliateDocument = await getDocument('_users', affiliateDocumentId)

        if (!affiliateDocument) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Invalid affiliate code'
            })
        }

        validatedAffiliateCode = affiliateCode
    }

    // generate unique login token and save to couch
    const uniqueCode = [...Array(6)]
        .map(() => String.fromCharCode(65 + Math.random() * 26 | 0))
        .join('')
    const doc = {
        _id: body.email + '--' + uniqueCode,
        funnel: body.funnel,
        timestamp: timestamp.toISOString(),
        expires: expireTimestamp.toISOString(),
        used: false,
        /* these are used by the cli watcher to ensure it can build up the email template request */
        email: body.email,
        code: uniqueCode
    }

    if (validatedAffiliateCode) {
        doc.affiliate_friend_code = validatedAffiliateCode
    }
    // persist token document to couchdb
    const resp = await $fetch(`http://localhost:5984/${DB}`, {
        method: 'POST',
        body: JSON.stringify(doc)
    })
    console.log('Saved token document', resp)

    // send out the corresponding email
    // email is now sent through couchdb-monitor watching login tokens being created
    /*const respEmail = await $fetch(`http://localhost:5984/${process.env.SIGNIN_TEMPLATE}`, {
        method: 'POST',
        body: JSON.stringify({
            magic_link_url : `${process.env.SIGNUP_URL}${body.email}/${uniqueCode}`,
            user_email: body.email,
            email: body.email
        }),
        headers: {
            'Authorization': `Basic ${process.env.COUCHDB_ADMIN_AUTH}`,
        }
    })
    console.log('Resp', respEmail)*/
    // buildTemplate(process.env.TEMPLATE_SIGNUP || 'template_bv_login', { magic_link_url: process.env.SIGNUP_URL || 'bv.com/confirm-email', user_email: body.email })

    return {success: true/*, doc, resp*/}
})
