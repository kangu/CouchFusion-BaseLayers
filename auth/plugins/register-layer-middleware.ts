/*
* This is needed for NuxtJS3 applications which don't pick up middleware files
* from app/middleware, as they are expecting /middleware directly
* */

import { addRouteMiddleware } from '#app'
import auth from '../app/middleware/auth' // path is relative to this plugin file
import userSession from '../app/middleware/userSession.global' // path is relative to this plugin file

export default defineNuxtPlugin(() => {
    addRouteMiddleware('auth', auth)

    // Or, if you want it to run on every route:
    addRouteMiddleware('userSession', userSession, { global: true })
})
