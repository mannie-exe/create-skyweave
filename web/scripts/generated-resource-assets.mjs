import fs from 'node:fs/promises'
import path from 'node:path'

// Vite's public-file index is created before authoring jobs add new hashed assets.
// Serve only these generated resource formats; no arbitrary file paths are accepted.
export function generatedResourceAssets(web) {
  return async (req, res, next) => {
    const pathname = (req.url ?? '').split('?')[0]
    if (
      !['GET', 'HEAD'].includes(req.method) ||
      !/^\/generated\/(objects\/(index\.json|previews\/[a-f0-9]{64}\.json|textures\/[a-f0-9]{64}\.png)|texture-resources\/(index\.json|[a-z0-9_-]+\.png))$/.test(
        pathname,
      )
    )
      return next()
    try {
      const file = path.join(await fs.realpath(web), 'public', pathname)
      if ((await fs.realpath(file)) !== file)
        throw new Error('Generated resource symlinks are not supported')
      const stat = await fs.stat(file)
      if (!stat.isFile() || stat.size > 8 * 1024 * 1024)
        throw new Error('Invalid generated resource size')
      res.writeHead(200, {
        'Content-Type': file.endsWith('.png')
          ? 'image/png'
          : 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      })
      res.end(req.method === 'HEAD' ? undefined : await fs.readFile(file))
    } catch (error) {
      res.writeHead(error.code === 'ENOENT' ? 404 : 400, {
        'Content-Type': 'text/plain',
      })
      res.end(
        error.code === 'ENOENT' ? 'Generated preview not found' : error.message,
      )
    }
  }
}
