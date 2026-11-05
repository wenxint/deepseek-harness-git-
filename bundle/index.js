/**
 * Host half of the Git branch badge.
 *
 * Owns every Git operation the browser half renders. The browser asks over this
 * package's private HTTP route (`POST /x-git-branch/<endpoint>`) carrying
 * Connection's RPC envelope, so the route reuses Connection's browser
 * authentication instead of inventing a second credential.
 */
import { execFile } from 'node:child_process'
import { readdir } from 'node:fs/promises'
import { basename, isAbsolute, relative, resolve as resolvePath } from 'node:path'

/** Private Client-to-Host channel; the browser posts to `/x-git-branch/<endpoint>`. */
const CHANNEL = '/x-git-branch'
const DEFAULT_TIMEOUT_MS = 20_000
const NETWORK_TIMEOUT_MS = 120_000
const MAX_BUFFER = 8 * 1024 * 1024
const MAX_BODY_BYTES = 1024 * 1024
const ENDPOINT_PATTERN = /^[A-Za-z0-9_$.-]+$/
const MAX_DISCOVERY_DEPTH = 3
const MAX_DISCOVERY_DIRECTORIES = 360
const MAX_REPOSITORIES = 60
const DISCOVERY_TTL_MS = 10_000
const SKIPPED_DIRECTORIES = new Set([
  '.git',
  '.next',
  '.nuxt',
  '.output',
  '.turbo',
  '.yarn',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'pods',
  'target',
  'vendor',
])
/** Fallback correlation id for an unparseable request; Connection accepts any string. */
const FALLBACK_RPC_ID = '00000000-0000-4000-8000-000000000000'

/** `webServer` carries the route; `connection` authenticates its requests. */
export const inject = ['connection', 'webServer']

export function apply(ctx, config) {
  const settings = config ?? {}
  const gitPath = typeof settings.gitPath === 'string' && settings.gitPath !== '' ? settings.gitPath : 'git'
  const configuredCwd = typeof settings.defaultCwd === 'string' && settings.defaultCwd !== '' ? settings.defaultCwd : undefined
  const discoveryCache = new Map()

  /** Run one git command; never rejects, so every failure carries its own report. */
  function git(cwd, args, options = {}) {
    const timeout = typeof options.timeout === 'number' ? options.timeout : DEFAULT_TIMEOUT_MS
    return new Promise((resolve) => {
      let settled = false
      const settle = (value) => {
        if (settled) return
        settled = true
        resolve(value)
      }
      try {
        execFile(
          gitPath,
          args,
          {
            cwd,
            timeout,
            maxBuffer: MAX_BUFFER,
            windowsHide: true,
            encoding: 'utf8',
            env: {
              ...process.env,
              // Never block a browser-triggered command on an interactive prompt.
              GIT_TERMINAL_PROMPT: '0',
              GIT_MERGE_AUTOEDIT: 'no',
              GIT_OPTIONAL_LOCKS: '0',
            },
          },
          (error, stdout, stderr) => {
            const out = typeof stdout === 'string' ? stdout : ''
            const err = typeof stderr === 'string' ? stderr : ''
            if (!error) return settle({ ok: true, code: 0, stdout: out, stderr: err })
            settle({
              ok: false,
              code: typeof error.code === 'number' ? error.code : -1,
              timedOut: error.killed === true || error.signal === 'SIGTERM',
              stdout: out,
              stderr: err,
              message: error.message,
            })
          },
        )
      } catch (error) {
        settle({
          ok: false,
          code: -1,
          timedOut: false,
          stdout: '',
          stderr: '',
          message: error instanceof Error ? error.message : String(error),
        })
      }
    })
  }

  function failure(code, message, details) {
    return { ok: false, error: { code, message: String(message ?? ''), details: details ?? {} } }
  }

  function success(value) {
    return { ok: true, value }
  }

  function textOf(result) {
    return (result.stderr || result.stdout || result.message || '').trim()
  }

  /** The Session's effective directory, with an explicit path taking precedence. */
  function resolveCwd(request) {
    const explicit = typeof request?.cwd === 'string' ? request.cwd.trim() : ''
    if (explicit !== '') return isAbsolute(explicit) ? resolvePath(explicit) : undefined
    try {
      const sessions = ctx.get('sessions')
      const workingDirectory = ctx.get('workingDirectory')
      if (sessions !== undefined && workingDirectory !== undefined) {
        const session = typeof request?.sessionId === 'string' ? sessions.get(request.sessionId) : undefined
        if (session !== undefined) {
          const directory = workingDirectory.get(session)
          if (typeof directory === 'string' && isAbsolute(directory)) return resolvePath(directory)
          const headerDirectory = session?.header?.cwd
          if (typeof headerDirectory === 'string' && isAbsolute(headerDirectory)) return resolvePath(headerDirectory)
        }
        if (typeof workingDirectory.defaultDirectory === 'string' && isAbsolute(workingDirectory.defaultDirectory)) {
          return resolvePath(workingDirectory.defaultDirectory)
        }
      }
    } catch (error) {
      ctx.logger?.warn?.(`git-branch-bar: session directory unavailable: ${String(error)}`)
    }
    return configuredCwd
  }

  /**
   * Resolve the real top-level repository for every Git operation. Running
   * against the repository root keeps checkout, merge, and discovery on the
   * same target even when a Session points at a nested directory.
   */
  async function resolveRepository(request) {
    const cwd = resolveCwd(request)
    if (cwd === undefined) {
      return { failure: failure('git/no-directory', 'Cannot determine a working directory for this Session', {}) }
    }
    const root = await git(cwd, ['rev-parse', '--show-toplevel'])
    if (!root.ok) return { cwd }
    const raw = root.stdout.trim()
    if (!isAbsolute(raw)) {
      return { failure: failure('git/bad-repository', 'Git returned an invalid repository root', { cwd, root: raw }) }
    }
    return { cwd, root: resolvePath(raw) }
  }

  function isGitEntry(entry) {
    return entry.name === '.git' && (entry.isDirectory() || entry.isFile() || entry.isSymbolicLink())
  }

  /**
   * Find repositories inside a workspace container such as `~/Desktop/work`.
   * The scan is shallow, skips generated/dependency directories, and caches the
   * result briefly so the 15-second status poll stays cheap.
   */
  async function discoverRepositories(cwd) {
    const start = resolvePath(cwd)
    const cached = discoveryCache.get(start)
    if (cached !== undefined && Date.now() - cached.at < DISCOVERY_TTL_MS) return cached.repositories

    const roots = []
    let visited = 0
    const walk = async (directory, depth) => {
      if (roots.length >= MAX_REPOSITORIES || visited >= MAX_DISCOVERY_DIRECTORIES) return
      visited += 1
      let entries
      try {
        entries = await readdir(directory, { withFileTypes: true })
      } catch {
        return
      }
      if (entries.some(isGitEntry)) {
        roots.push(directory)
        return
      }
      if (depth >= MAX_DISCOVERY_DEPTH) return
      const children = entries
        .filter((entry) => {
          if (!entry.isDirectory()) return false
          const name = entry.name.toLowerCase()
          return !name.startsWith('.') && !SKIPPED_DIRECTORIES.has(name)
        })
        .sort((left, right) => left.name.localeCompare(right.name))
      for (const child of children) {
        await walk(resolvePath(directory, child.name), depth + 1)
        if (roots.length >= MAX_REPOSITORIES || visited >= MAX_DISCOVERY_DIRECTORIES) break
      }
    }
    await walk(start, 0)

    const repositories = await Promise.all(
      [...new Set(roots)].slice(0, MAX_REPOSITORIES).map(async (path) => {
        const current = await git(path, ['branch', '--show-current'], { timeout: 5_000 })
        const branch = current.ok ? current.stdout.trim() : ''
        const relativePath = relative(start, path) || basename(path)
        return {
          path,
          relativePath,
          name: basename(path) || path,
          branch,
          detached: branch === '',
        }
      }),
    )
    repositories.sort((left, right) => left.relativePath.localeCompare(right.relativePath))
    discoveryCache.set(start, { at: Date.now(), repositories })
    return repositories
  }

  /** Reject option-like or malformed refs before they reach a Git command. */
  async function readBranchName(root, request) {
    const name = typeof request?.branch === 'string' ? request.branch.trim() : ''
    if (name === '') return { failure: failure('git/bad-request', 'A branch name is required', {}) }
    const checked = await git(root, ['check-ref-format', '--branch', name])
    if (!checked.ok) {
      return { failure: failure('git/bad-branch', textOf(checked) || 'Invalid branch name', { branch: name }) }
    }
    const source = request?.source === 'remote' || request?.source === 'local' ? request.source : 'auto'
    return { name, source }
  }

  async function hasRef(root, ref) {
    const result = await git(root, ['show-ref', '--verify', '--quiet', ref], { timeout: 5_000 })
    return result.ok
  }

  /** Switch to a local branch without allowing a remote-tracking ref to detach HEAD. */
  async function switchToLocal(root, name) {
    let result = await git(root, ['switch', name])
    if (!result.ok) result = await git(root, ['checkout', name])
    if (!result.ok) return result
    const current = await git(root, ['branch', '--show-current'], { timeout: 5_000 })
    const actual = current.ok ? current.stdout.trim() : ''
    if (actual === '') {
      return {
        ok: false,
        code: -1,
        timedOut: false,
        stdout: result.stdout,
        stderr: 'Git switched to a detached HEAD instead of a local branch',
      }
    }
    return { ...result, branch: actual }
  }

  /** Read one `git status --porcelain=v1 -b` report. */
  function parseStatus(text) {
    const lines = String(text).split('\n')
    const header = lines.length > 0 && lines[0].startsWith('## ') ? lines[0].slice(3).trim() : ''
    const changes = []
    for (const line of lines) {
      if (line === '' || line.startsWith('## ') || line.length < 3) continue
      changes.push({ code: line.slice(0, 2).trim(), path: line.slice(3) })
    }
    const info = { branch: '', detached: false, upstream: null, ahead: 0, behind: 0 }
    if (header !== '') {
      let rest = header
      const tracking = /\[(.+)\]$/.exec(rest)
      if (tracking !== null) {
        rest = rest.slice(0, tracking.index).trim()
        for (const part of tracking[1].split(',')) {
          const value = part.trim()
          const ahead = /^ahead (\d+)$/.exec(value)
          const behind = /^behind (\d+)$/.exec(value)
          if (ahead !== null) info.ahead = Number(ahead[1])
          else if (behind !== null) info.behind = Number(behind[1])
        }
      }
      const noCommits = /^(?:No commits yet|Initial commit) on (.+)$/.exec(rest)
      if (noCommits !== null) {
        info.branch = noCommits[1].trim()
      } else {
        const dots = rest.indexOf('...')
        const left = (dots < 0 ? rest : rest.slice(0, dots)).trim()
        const right = dots < 0 ? '' : rest.slice(dots + 3).trim()
        if (right !== '' && right !== 'gone') info.upstream = right
        const name = left.split(' ')[0]
        if (name === 'HEAD' || name === '') info.detached = true
        else info.branch = name
      }
    }
    return { ...info, changes, changeCount: changes.length }
  }

  async function readStatus(request) {
    const location = await resolveRepository(request)
    if (location.failure !== undefined) return location.failure
    if (location.root === undefined) {
      const repositories = await discoverRepositories(location.cwd)
      return success({ isRepo: false, cwd: location.cwd, repositories })
    }
    const [status, mergeHead] = await Promise.all([
      git(location.root, ['status', '--porcelain=v1', '--branch', '--untracked-files=normal']),
      git(location.root, ['rev-parse', '-q', '--verify', 'MERGE_HEAD'], { timeout: 5_000 }),
    ])
    if (!status.ok) {
      return failure('git/status-failed', textOf(status) || 'git status failed', {
        cwd: location.root,
        exitCode: status.code,
      })
    }
    return success({
      isRepo: true,
      cwd: location.root,
      repoName: basename(location.root) || location.root,
      mergeInProgress: mergeHead.ok,
      ...parseStatus(status.stdout),
    })
  }

  async function readBranches(request) {
    const location = await resolveRepository(request)
    if (location.failure !== undefined) return location.failure
    if (location.root === undefined) {
      return failure('git/not-a-repository', 'The selected directory is not inside a Git repository', {
        cwd: location.cwd,
      })
    }
    const listed = await git(location.root, [
      'for-each-ref',
      '--sort=-committerdate',
      '--format=%(refname)%09%(refname:short)',
      'refs/heads',
      'refs/remotes',
    ])
    if (!listed.ok) {
      return failure('git/branches-failed', textOf(listed) || 'git for-each-ref failed', { cwd: location.root })
    }
    const local = []
    const remote = []
    for (const line of listed.stdout.split('\n')) {
      if (line === '') continue
      const tab = line.indexOf('\t')
      if (tab < 0) continue
      const ref = line.slice(0, tab)
      const short = line.slice(tab + 1)
      if (ref.startsWith('refs/heads/')) local.push(short)
      else if (ref.startsWith('refs/remotes/') && !short.endsWith('/HEAD')) remote.push(short)
    }
    return success({ local, remote })
  }

  /** Switch to a local branch, or create a tracking branch for a remote ref. */
  async function checkout(request) {
    const location = await resolveRepository(request)
    if (location.failure !== undefined) return location.failure
    if (location.root === undefined) {
      return failure('git/not-a-repository', 'The selected directory is not inside a Git repository', {
        cwd: location.cwd,
      })
    }
    const branch = await readBranchName(location.root, request)
    if (branch.failure !== undefined) return branch.failure
    const name = branch.name

    const localRef = `refs/heads/${name}`
    const remoteRef = `refs/remotes/${name}`
    const [isLocal, isRemote] = await Promise.all([
      branch.source === 'remote' ? false : hasRef(location.root, localRef),
      branch.source === 'local' ? false : hasRef(location.root, remoteRef),
    ])

    if (isLocal) {
      const switched = await switchToLocal(location.root, name)
      if (switched.ok) {
        return success({ branch: switched.branch, output: (switched.stdout + switched.stderr).trim() })
      }
      return failure('git/checkout-failed', textOf(switched), { branch: name, cwd: location.root })
    }

    if (!isRemote) {
      return failure('git/branch-not-found', `Branch not found: ${name}`, { branch: name, cwd: location.root })
    }

    const slash = name.indexOf('/')
    const local = slash > 0 ? name.slice(slash + 1) : ''
    if (local === '') {
      return failure('git/bad-remote-branch', `Cannot derive a local branch from ${name}`, { branch: name })
    }
    const localCheck = await git(location.root, ['check-ref-format', '--branch', local])
    if (!localCheck.ok) {
      return failure('git/bad-branch', textOf(localCheck) || 'Invalid local branch name', { branch: name, local })
    }

    if (await hasRef(location.root, `refs/heads/${local}`)) {
      const switched = await switchToLocal(location.root, local)
      if (switched.ok) {
        return success({ branch: switched.branch, output: (switched.stdout + switched.stderr).trim() })
      }
      return failure('git/checkout-failed', textOf(switched), { branch: local, remote: name, cwd: location.root })
    }

    let tracked = await git(location.root, ['switch', '-c', local, '--track', name])
    if (!tracked.ok) tracked = await git(location.root, ['checkout', '-b', local, '--track', name])
    if (tracked.ok) {
      const current = await git(location.root, ['branch', '--show-current'], { timeout: 5_000 })
      const actual = current.ok ? current.stdout.trim() : ''
      if (actual === local) {
        return success({ branch: local, remote: name, output: (tracked.stdout + tracked.stderr).trim() })
      }
      return failure('git/detached-head', 'Git created a detached HEAD instead of a local branch', {
        branch: local,
        remote: name,
        cwd: location.root,
      })
    }
    return failure('git/checkout-failed', textOf(tracked), { branch: local, remote: name, cwd: location.root })
  }

  /** Merge one branch (local or remote-tracking) into the branch currently checked out. */
  async function merge(request) {
    const location = await resolveRepository(request)
    if (location.failure !== undefined) return location.failure
    if (location.root === undefined) {
      return failure('git/not-a-repository', 'The selected directory is not inside a Git repository', {
        cwd: location.cwd,
      })
    }
    const branch = await readBranchName(location.root, request)
    if (branch.failure !== undefined) return branch.failure
    const name = branch.name
    const head = await git(location.root, ['rev-parse', '--abbrev-ref', 'HEAD'])
    if (head.ok && head.stdout.trim() === name) {
      return failure('git/merge-self', 'Cannot merge a branch into itself', { branch: name })
    }
    const result = await git(location.root, ['merge', '--no-edit', name], { timeout: NETWORK_TIMEOUT_MS })
    if (result.ok) return success({ branch: name, output: (result.stdout + result.stderr).trim(), conflict: false })
    const output = textOf(result)
    const conflict = /CONFLICT|Automatic merge failed|fix conflicts/i.test(`${result.stdout}${result.stderr}`)
    return failure(conflict ? 'git/merge-conflict' : 'git/merge-failed', output, {
      branch: name,
      cwd: location.root,
      conflict,
    })
  }

  /** Abort an in-progress merge, restoring the pre-merge working tree. */
  async function mergeAbort(request) {
    const location = await resolveRepository(request)
    if (location.failure !== undefined) return location.failure
    if (location.root === undefined) {
      return failure('git/not-a-repository', 'The selected directory is not inside a Git repository', {
        cwd: location.cwd,
      })
    }
    const result = await git(location.root, ['merge', '--abort'])
    if (!result.ok) {
      return failure('git/merge-abort-failed', textOf(result), { cwd: location.root })
    }
    return success({ output: (result.stdout + result.stderr).trim() })
  }

  const handlers = { status: readStatus, branches: readBranches, checkout, merge, mergeAbort }

  /** Dispatch one endpoint; every outcome is a value, never a rejection. */
  async function dispatch(endpoint, payload) {
    const operation = handlers[endpoint]
    if (operation === undefined) {
      return failure('git/unknown-endpoint', `Unknown endpoint ${JSON.stringify(endpoint)}`, { endpoint })
    }
    try {
      return await operation(payload ?? {})
    } catch (error) {
      ctx.logger?.warn?.(`git-branch-bar: ${endpoint} failed: ${String(error)}`)
      return failure('git/internal-error', error instanceof Error ? error.message : String(error), { endpoint })
    }
  }

  function respond(res, rpcId, result) {
    const body = JSON.stringify({ type: 'server-response', rpcId, result })
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
    res.end(body)
  }

  async function readJson(req) {
    const chunks = []
    let size = 0
    for await (const chunk of req) {
      size += chunk.length
      if (size > MAX_BODY_BYTES) throw new Error('request body too large')
      chunks.push(chunk)
    }
    const text = Buffer.concat(chunks).toString('utf8')
    return text === '' ? undefined : JSON.parse(text)
  }

  /** `POST /x-git-branch/<endpoint>` carrying Connection's RPC envelope. */
  async function routeHandler(req, res) {
    const rejection = ctx.connection.requestRejection({ headers: req.headers })
    if (rejection !== undefined) {
      res.writeHead(rejection)
      res.end(rejection === 401 ? 'unauthorized' : 'forbidden')
      return
    }
    let endpoint = ''
    try {
      endpoint = new URL(req.url ?? '/', 'http://localhost').pathname.slice(CHANNEL.length + 1)
    } catch {
      endpoint = ''
    }
    if (req.method !== 'POST' || endpoint === '' || !ENDPOINT_PATTERN.test(endpoint)) {
      res.writeHead(404)
      res.end('not found')
      return
    }
    const contentType = String(req.headers['content-type'] ?? '').toLowerCase()
    if (!contentType.startsWith('application/json')) {
      res.writeHead(415)
      res.end('content type must be application/json')
      return
    }
    let message
    try {
      message = await readJson(req)
    } catch {
      res.writeHead(400)
      res.end('body is not JSON')
      return
    }
    const rpcId = typeof message?.rpcId === 'string' && message.rpcId !== '' ? message.rpcId : FALLBACK_RPC_ID
    if (message?.type !== 'client-request' || message?.method !== endpoint) {
      respond(res, rpcId, failure('gateway/bad-request', 'invalid client-request envelope', { endpoint }))
      return
    }
    respond(res, rpcId, await dispatch(endpoint, message.payload))
  }

  ctx.effect(
    () => ctx.webServer.register({ kind: 'prefix', path: CHANNEL, handler: routeHandler }),
    'git-branch-bar: rpc route',
  )
}
