/*
* This is needed for NuxtJS3 applications which don't pick up middleware files
* from app/middleware, as they are expecting /middleware directly
* */

import { addRouteMiddleware } from '#app'
import contentGlobal from '../app/middleware/content.global.ts' // path is relative to this plugin file

export default defineNuxtPlugin(() => {

    // Or, if you want it to run on every route:
    addRouteMiddleware('contentGlobal', contentGlobal, { global: true })
})
