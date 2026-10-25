import {it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
const require=createRequire(new URL('../../node_modules/nuxt/package.json',import.meta.url))
const {parse,compileTemplate}=require('@vue/compiler-sfc')
for(const file of ['login-ui/app/pages/login.vue','admin/app/layouts/admin-workspace.vue','admin/app/pages/admin/index.vue','datasync/app/pages/datasync.vue']) {
 it(`compiles the ${file} template`,()=>{
  const filename=new URL('../../src/features/'+file,import.meta.url).pathname
  const {descriptor,errors}=parse(readFileSync(filename,'utf8'),{filename})
  expect(errors).toEqual([])
  const result=compileTemplate({id:'core-test',source:descriptor.template.content,filename,compilerOptions:{expressionPlugins:['typescript']}})
  expect(result.errors).toEqual([])
 })
}
