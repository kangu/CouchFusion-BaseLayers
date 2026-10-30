import fs from 'node:fs/promises'

/**
 * Read a component source file together with its stats.
 *
 * Returns `null` when the file disappeared between directory listing and reading
 * (ENOENT/ENOTDIR). That happens when a component is deleted while the watcher is
 * already regenerating; the deleted file must simply drop out of the registry
 * instead of failing the whole run. Any other error is rethrown.
 *
 * @param {string} file Absolute path to the `.vue` file.
 * @param {{ readFile?: typeof fs.readFile, stat?: typeof fs.stat }} [io] Injectable fs for tests.
 * @returns {Promise<{ source: string, stats: import('node:fs').Stats } | null>}
 */
export const readComponentSource = async (file, io = {}) => {
  const readFile = io.readFile ?? fs.readFile
  const stat = io.stat ?? fs.stat
  try {
    const source = await readFile(file, 'utf8')
    const stats = await stat(file)
    return { source, stats }
  } catch (error) {
    if (error && (error.code === 'ENOENT' || error.code === 'ENOTDIR')) {
      return null
    }
    throw error
  }
}
