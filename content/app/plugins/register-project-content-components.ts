import { defineAsyncComponent } from 'vue'

type ComponentRegistration = {
    name: string
    aliases: string[]
    loader: () => Promise<any>
}

const componentModules = import.meta.glob('~/components/content/**/*.{vue,ts,js,jsx,tsx}', {
    eager: false
})

const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1)

const toPascalCase = (value: string): string => value
    .split(/[-_/]/g)
    .filter(Boolean)
    .map((segment) => capitalize(segment))
    .join('')

const toKebabCase = (value: string): string => value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase()

const deriveComponentName = (filePath: string): ComponentRegistration | null => {
    const match = filePath.match(/\/components\/content\/(.+)\.(vue|ts|js|jsx|tsx)$/)
    if (!match) {
        return null
    }

    const relativePath = match[1]
    const segments = relativePath.split('/').filter(Boolean)

    if (!segments.length) {
        return null
    }

    const fileName = segments.pop() as string
    const baseName = fileName === 'index' && segments.length ? segments[segments.length - 1] : fileName

    const baseSegments = [...segments, baseName]
    const pascalName = toPascalCase(baseSegments.join('/'))
    const kebabName = toKebabCase(pascalName)
    const baseKebab = toKebabCase(baseName)

    const aliasSet = new Set<string>()
    aliasSet.add(kebabName)
    aliasSet.add(baseKebab)
    aliasSet.delete(pascalName)
    aliasSet.delete(pascalName.toLowerCase())

    return {
        name: pascalName,
        aliases: Array.from(aliasSet).filter(Boolean),
        loader: componentModules[filePath] as () => Promise<any>
    }
}

const registrations: ComponentRegistration[] = Object.keys(componentModules)
    .map((path) => deriveComponentName(path))
    .filter((entry): entry is ComponentRegistration => Boolean(entry))

export default defineNuxtPlugin((nuxtApp) => {
    const { vueApp } = nuxtApp

    for (const registration of registrations) {
        const asyncComponent = defineAsyncComponent(registration.loader)

        if (!vueApp.component(registration.name)) {
            vueApp.component(registration.name, asyncComponent)
        }

        for (const alias of registration.aliases) {
            if (!vueApp.component(alias)) {
                vueApp.component(alias, asyncComponent)
            }
        }
    }
})
