const fs = require("node:fs")
const path = require("node:path")
const { pathToFileURL } = require("node:url")

function registerPackagedFrontendProtocol({ protocol, net, frontendRoot }) {
  protocol.handle("app", (request) => {
    const url = new URL(request.url)
    const filePath = resolveFrontendFile(frontendRoot, decodeURIComponent(url.pathname || "/"))
    return net.fetch(pathToFileURL(filePath).toString())
  })
}

function resolveFrontendFile(frontendRoot, requestPath) {
  const normalizedPath = requestPath.replace(/^\/+/, "").replace(/\//g, path.sep)
  const candidates = []
  if (!normalizedPath || normalizedPath === "index.html") {
    candidates.push(path.join(frontendRoot, "index.html"))
  } else {
    candidates.push(path.join(frontendRoot, normalizedPath))
    if (!path.extname(normalizedPath)) {
      candidates.push(path.join(frontendRoot, `${normalizedPath}.html`))
      candidates.push(path.join(frontendRoot, normalizedPath, "index.html"))
    }
  }
  const resolvedRoot = path.resolve(frontendRoot)
  const found = candidates.find((candidate) => {
    const resolved = path.resolve(candidate)
    return resolved.startsWith(resolvedRoot) && fs.existsSync(resolved) && fs.statSync(resolved).isFile()
  })
  return found || path.join(frontendRoot, "index.html")
}

module.exports = {
  registerPackagedFrontendProtocol,
  resolveFrontendFile,
}
