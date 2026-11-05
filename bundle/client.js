/**
 * Client half of the Git branch badge.
 *
 * Renders a status chip in the bottom-right corner of the frame with the branch
 * currently checked out for the open project, and a panel for switching
 * branches and merging one branch into the current one.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-plugin-git-branch',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NS = 'gitBranchBar'
    const CHANNEL = '/x-git-branch'
    const PKG = '@local/dsh-plugin-git-branch'
    const CSS_TAG = '@local/dsh-plugin-git-branch/git-branch-bar.css'
    const POLL_MS = 15000
    const CWD_STORAGE_PREFIX = 'dsh.gitBranchBar.cwd:'

    const zh = {
      'chip.title': 'Git 分支 · 点击切换或合并',
      'chip.ahead': '领先 {count} 个提交',
      'chip.behind': '落后 {count} 个提交',
      'chip.dirty': '{count} 个未提交的更改',
      'chip.noRepo': '未检测到 Git 仓库',
      'chip.loading': '正在读取分支',
      'chip.error': '分支读取失败',
      'chip.noSession': '未打开项目',
      'panel.title': 'Git 分支',
      'panel.sync': '同步远程代码',
      'panel.close': '关闭',
      'panel.detached': '分离头指针',
      'panel.loading': '读取中…',
      'panel.noSession': '打开一个项目后会显示当前分支。',
      'section.switch': '切换分支',
      'section.merge': '合并到当前分支',
      'repo.placeholder': '仓库绝对路径，例如 /Users/me/project',
      'repo.open': '打开',
      'repo.clear': '清除自定义仓库路径',
      'repo.choose': '选择项目中的仓库',
      'repo.more': '只显示前 {count} 个仓库',
      'branch.local': '本地分支',
      'branch.remote': '远程分支',
      'branch.merge': '合并',
      'branch.merging': '合并中…',
      'branch.empty': '没有可用的分支',
      'branch.filter': '筛选分支',
      'branch.filterPlaceholder': '输入分支名筛选…',
      'branch.filterClear': '清空筛选',
      'branch.filterEmpty': '没有匹配的分支',
      'feedback.merged': '已把 {branch} 合并到 {current}',
      'feedback.switched': '已切换到 {branch}',
      'feedback.synced': '已同步 {branch}（{upstream}）',
      'feedback.abort': '撤销合并',
      'feedback.failed': '操作失败',
      'error.detachedHead': '当前处于分离头指针，无法同步远程代码。',
      'error.noUpstream': '当前分支没有设置远程跟踪分支，无法同步。',
      'error.syncDiverged': '本地分支与远程已经分叉，请先手动合并或变基。',
      'error.syncFailed': '同步远程代码失败，请检查网络或 Git 凭据。',
      'error.mergeConflict': '合并产生冲突，请解决冲突或撤销合并。',
      'panel.notRepo': '当前目录不在 Git 仓库中，因此读不到分支。',
      'panel.readError': '无法读取当前项目的 Git 状态。',
    }

    const en = {
      'chip.title': 'Git branch · click to switch or merge',
      'chip.ahead': '{count} commits ahead',
      'chip.behind': '{count} commits behind',
      'chip.dirty': '{count} uncommitted changes',
      'chip.noRepo': 'No Git repository',
      'chip.loading': 'Reading branch',
      'chip.error': 'Could not read branch',
      'chip.noSession': 'No project open',
      'panel.title': 'Git branch',
      'panel.sync': 'Sync remote changes',
      'panel.close': 'Close',
      'panel.detached': 'Detached HEAD',
      'panel.loading': 'Loading…',
      'panel.noSession': 'Open a project to see its current branch.',
      'section.switch': 'Switch branch',
      'section.merge': 'Merge into current branch',
      'repo.placeholder': 'Absolute repository path, e.g. /Users/me/project',
      'repo.open': 'Open',
      'repo.clear': 'Clear custom repository path',
      'repo.choose': 'Choose a repository in this project',
      'repo.more': 'Only the first {count} repositories are shown',
      'branch.local': 'Local',
      'branch.remote': 'Remote',
      'branch.merge': 'Merge',
      'branch.merging': 'Merging…',
      'branch.empty': 'No branches available',
      'branch.filter': 'Filter branches',
      'branch.filterPlaceholder': 'Filter by branch name…',
      'branch.filterClear': 'Clear filter',
      'branch.filterEmpty': 'No matching branches',
      'feedback.merged': 'Merged {branch} into {current}',
      'feedback.switched': 'Switched to {branch}',
      'feedback.synced': 'Synced {branch} from {upstream}',
      'feedback.abort': 'Abort merge',
      'feedback.failed': 'Action failed',
      'error.detachedHead': 'Cannot sync remote changes while HEAD is detached.',
      'error.noUpstream': 'The current branch has no upstream configured, so it cannot be synced.',
      'error.syncDiverged': 'This branch has diverged from its upstream. Merge or rebase it manually first.',
      'error.syncFailed': 'Could not sync remote changes. Check the network and Git credentials.',
      'error.mergeConflict': 'The merge has conflicts. Resolve them or abort the merge.',
      'panel.notRepo': 'This directory is not inside a Git repository, so no branch is available.',
      'panel.readError': 'The Git state for this project could not be read.',
    }

    const CSS = [
      '.gbb-root{position:fixed;right:16px;bottom:16px;z-index:1100;display:flex;flex-direction:column;align-items:flex-end;pointer-events:none}',
      '.gbb-chip{pointer-events:auto;display:inline-flex;align-items:center;gap:6px;box-sizing:border-box;max-width:min(52vw,360px);padding:5px 11px 5px 9px;border:.5px solid var(--dsw-alias-border-l1);border-radius:999px;background:var(--dsw-specific-menu);-webkit-backdrop-filter:var(--dsw-menu-backdrop-filter);backdrop-filter:var(--dsw-menu-backdrop-filter);box-shadow:var(--dsw-elevation-soft);color:var(--dsw-alias-label-secondary);font-family:inherit;font-size:12px;line-height:18px;cursor:pointer;transition:background-color .12s,color .12s,border-color .12s}',
      '.gbb-chip:hover{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary)}',
      '.gbb-chip[aria-expanded="true"]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary)}',
      '.gbb-chip:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:2px}',
      '.gbb-chip svg{flex:none;width:13px;height:13px;color:var(--dsw-alias-label-tertiary)}',
      '.gbb-chip-branch{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500;color:var(--dsw-alias-label-primary)}',
      '.gbb-chip-meta{display:inline-flex;align-items:center;gap:5px;flex:none;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;font-size:11px}',
      '.gbb-chip-meta svg{width:10px;height:10px}',
      '.gbb-chip-dirty{color:var(--dsw-alias-state-warn-primary);display:inline-flex;align-items:center;gap:3px}',
      '.gbb-chip-muted .gbb-chip-branch{color:var(--dsw-alias-label-tertiary);font-weight:400}',
      '.gbb-chip-dirty svg{width:7px;height:7px;color:currentColor}',
      '.gbb-panel{pointer-events:auto;position:absolute;right:0;bottom:calc(100% + 8px);display:flex;flex-direction:column;box-sizing:border-box;width:min(340px,calc(100vw - 32px));max-height:min(64vh,560px);overflow:hidden;border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg);background:var(--dsw-specific-menu);-webkit-backdrop-filter:var(--dsw-menu-backdrop-filter);backdrop-filter:var(--dsw-menu-backdrop-filter);box-shadow:var(--dsw-elevation-prominent);color:var(--dsw-alias-label-secondary);font-family:inherit;font-size:12px;line-height:18px;cursor:default}',
      '.gbb-head{display:flex;align-items:flex-start;gap:6px;padding:10px 8px 8px 12px;flex:none}',
      '.gbb-head-main{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}',
      '.gbb-head-title{display:flex;align-items:center;gap:6px;color:var(--dsw-alias-label-primary);font-size:13px;font-weight:500;line-height:20px}',
      '.gbb-head-title svg{flex:none;width:14px;height:14px;color:var(--dsw-alias-label-tertiary)}',
      '.gbb-head-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.gbb-head-meta{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}',
      '.gbb-badge{flex:none;padding:0 5px;border-radius:999px;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:16px;font-variant-numeric:tabular-nums}',
      '.gbb-icon-btn{display:grid;place-items:center;flex:none;width:24px;height:24px;padding:0;border:none;border-radius:999px;background:0 0;color:var(--dsw-alias-label-tertiary);cursor:pointer}',
      '.gbb-icon-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}',
      '.gbb-icon-btn:disabled{opacity:.45;cursor:default}',
      '.gbb-icon-btn svg{width:13px;height:13px}',
      '.gbb-spin{animation:gbb-rotate 1s linear infinite}',
      '@keyframes gbb-rotate{to{transform:rotate(360deg)}}',
      '.gbb-feedback{display:flex;align-items:center;gap:8px;margin:0 12px 8px;padding:5px 8px;border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);font-size:11px;line-height:16px;flex:none}',
      '.gbb-feedback-text{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;white-space:pre-wrap}',
      '.gbb-feedback-error{color:var(--dsw-alias-state-error-primary)}',
      '.gbb-body{display:flex;flex-direction:column;min-height:0;overflow-y:auto;padding-bottom:6px}',
      '.gbb-search{display:flex;align-items:center;gap:6px;box-sizing:border-box;height:30px;margin:0 12px 6px;padding:0 5px 0 8px;border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-base);flex:none}',
      '.gbb-search:focus-within{border-color:var(--dsw-alias-brand-primary)}',
      '.gbb-search > svg{flex:none;width:13px;height:13px;color:var(--dsw-alias-label-tertiary)}',
      '.gbb-search-input{box-sizing:border-box;flex:1;min-width:0;height:100%;padding:0;border:none;background:0 0;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;outline:none}',
      '.gbb-search-input::placeholder{color:var(--dsw-alias-label-tertiary);opacity:1}',
      '.gbb-search-clear{display:grid;place-items:center;flex:none;width:20px;height:20px;padding:0;border:none;border-radius:999px;background:0 0;color:var(--dsw-alias-label-tertiary);cursor:pointer}',
      '.gbb-search-clear:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}',
      '.gbb-search-clear svg{width:11px;height:11px}',
      '.gbb-section-head{display:flex;align-items:center;gap:6px;padding:4px 12px;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}',
      '.gbb-group{display:flex;flex-direction:column}',
      '.gbb-group-head{padding:4px 12px 2px;color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:16px;text-transform:none}',
      '.gbb-row{display:flex;align-items:center;gap:6px;width:100%;box-sizing:border-box;padding:2px 8px 2px 6px;color:var(--dsw-alias-label-primary);font:inherit;border-radius:0}',
      '.gbb-row:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}',
      '.gbb-row svg{flex:none;width:13px;height:13px}',
      '.gbb-row-main{display:flex;align-items:center;gap:8px;min-width:0;flex:1;padding:2px 0 2px 6px;border:none;background:0 0;color:inherit;font:inherit;text-align:left;cursor:pointer}',
      '.gbb-row-main:disabled{cursor:default}',
      '.gbb-row-mark{display:grid;place-items:center;flex:none;width:13px;color:var(--dsw-alias-state-success-primary)}',
      '.gbb-row-mark svg{width:13px;height:13px}',
      '.gbb-row-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.gbb-row-remote .gbb-row-label{color:var(--dsw-alias-label-secondary)}',
      '.gbb-row-current .gbb-row-label{color:var(--dsw-alias-label-primary);font-weight:500}',
      '.gbb-repo-row{display:flex;align-items:center;gap:8px;width:calc(100% - 24px);box-sizing:border-box;margin:1px 12px;padding:6px 8px;border:none;border-radius:var(--dsw-radius-sm);background:0 0;color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer}',
      '.gbb-repo-row:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.gbb-repo-row svg{flex:none;width:13px;height:13px;color:var(--dsw-alias-label-tertiary)}',
      '.gbb-repo-main{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1}',
      '.gbb-repo-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:17px}',
      '.gbb-repo-path{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:15px}',
      '.gbb-repo-branch{flex:none;max-width:38%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary);font-size:11px}',
      '.gbb-mini{padding:1px 8px;border:.5px solid var(--dsw-alias-border-l2);border-radius:999px;background:0 0;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;line-height:18px;cursor:pointer}',
      '.gbb-mini:hover:not(:disabled){border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}',
      '.gbb-mini:disabled{opacity:.45;cursor:default}',
      '.gbb-hint{padding:6px 12px;color:var(--dsw-alias-label-tertiary);font-size:11px}',
      '.gbb-sep{margin:4px 0;border-top:.5px solid var(--dsw-alias-border-l1)}',
      '.gbb-input-row{display:flex;align-items:center;gap:6px;padding:2px 12px 6px}',
      '.gbb-input{box-sizing:border-box;flex:1;min-width:0;padding:5px 8px;border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;outline:none}',
      '.gbb-input:focus{border-color:var(--dsw-alias-brand-primary)}',
      '.gbb-btn{flex:none;padding:4px 10px;border:none;border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-brand-primary);color:#fff;font:inherit;font-size:12px;line-height:18px;cursor:pointer}',
      '.gbb-btn:disabled{opacity:.45;cursor:default}',
      '.gbb-text-btn{align-self:flex-start;margin:2px 12px 4px;padding:0;border:none;background:0 0;color:var(--dsw-alias-brand-primary);font:inherit;font-size:11px;cursor:pointer}',
      '.gbb-text-btn:hover{text-decoration:underline}',
    ].join('\n')

    function svg(size, children) {
      return h(
        'svg',
        {
          viewBox: '0 0 16 16',
          width: size,
          height: size,
          'aria-hidden': true,
          focusable: 'false',
          style: { display: 'block' },
        },
        children,
      )
    }

    const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' }

    const icons = {
      branch(size) {
        return svg(size ?? 13, [
          h('circle', { key: 'a', cx: 4, cy: 3.6, r: 1.7, ...stroke }),
          h('circle', { key: 'b', cx: 12, cy: 3.6, r: 1.7, ...stroke }),
          h('circle', { key: 'c', cx: 4, cy: 12.4, r: 1.7, ...stroke }),
          h('path', { key: 'd', d: 'M4 5.5v5.2M12 5.5v1.4a3.3 3.3 0 0 1-3.3 3.3H4', ...stroke }),
        ])
      },
      up(size) {
        return svg(size ?? 10, h('path', { d: 'M8 12.5V4M8 4 5 7M8 4l3 3', ...stroke, strokeWidth: 1.6 }))
      },
      down(size) {
        return svg(size ?? 10, h('path', { d: 'M8 3.5V12M8 12 5 9M8 12l3-3', ...stroke, strokeWidth: 1.6 }))
      },
      dot(size) {
        return svg(size ?? 7, h('circle', { cx: 8, cy: 8, r: 4.2, fill: 'currentColor' }))
      },
      check(size) {
        return svg(size ?? 13, h('path', { d: 'M3.5 8.5 6.5 11.5 12.5 4.5', ...stroke, strokeWidth: 1.8 }))
      },
      refresh(size) {
        return svg(size ?? 13, h('path', { d: 'M13.2 8a5.2 5.2 0 1 1-1.7-3.85M13.4 2.6v2.9h-2.9', ...stroke }))
      },
      pull(size) {
        return svg(size ?? 13, [
          h('path', { key: 'a', d: 'M8 2.5v7M5 6.5 8 9.5l3-3', ...stroke }),
          h('path', { key: 'b', d: 'M3 12.5h10', ...stroke }),
        ])
      },
      search(size) {
        return svg(size ?? 13, [
          h('circle', { key: 'a', cx: 7, cy: 7, r: 4.2, ...stroke }),
          h('path', { key: 'b', d: 'm10.2 10.2 3 3', ...stroke }),
        ])
      },
      merge(size) {
        return svg(size ?? 13, [
          h('path', { key: 'a', d: 'M11.5 13V7.5A3.5 3.5 0 0 0 8 4H4.6', ...stroke }),
          h('path', { key: 'b', d: 'M6.8 1.8 4.2 4l2.6 2.2', ...stroke }),
        ])
      },
      close(size) {
        return svg(size ?? 12, h('path', { d: 'M4 4l8 8M12 4l-8 8', ...stroke, strokeWidth: 1.6 }))
      },
    }

    function interpolate(template, params) {
      if (params === undefined) return template
      return template.replace(/\{(\w+)\}/g, (match, key) => (key in params ? String(params[key]) : match))
    }

    /** The active UI language, read from the document the locale service maintains. */
    function detectLocale() {
      try {
        const lang = (document.documentElement.getAttribute('lang') ?? navigator.language ?? 'en').toLowerCase()
        return lang.startsWith('zh') ? 'zh' : 'en'
      } catch {
        return 'en'
      }
    }

    /**
     * Translate through the host seat when it knows the key, and through this
     * package's own dictionaries otherwise, so the UI never shows a raw key.
     */
    function makeTranslator(hostT) {
      return (key, params) => {
        if (typeof hostT === 'function') {
          const value = hostT(key, params)
          if (typeof value === 'string' && value !== key) return value
        }
        const dictionaries = detectLocale() === 'zh' ? zh : en
        return interpolate(dictionaries[key] ?? zh[key] ?? key, params)
      }
    }

    function readStoredCwd(sessionId) {
      if (typeof sessionId !== 'string' || sessionId === '') return ''
      try {
        return window.localStorage.getItem(CWD_STORAGE_PREFIX + sessionId) ?? ''
      } catch {
        return ''
      }
    }

    function storeCwd(sessionId, cwd) {
      if (typeof sessionId !== 'string' || sessionId === '') return
      try {
        if (cwd === '') window.localStorage.removeItem(CWD_STORAGE_PREFIX + sessionId)
        else window.localStorage.setItem(CWD_STORAGE_PREFIX + sessionId, cwd)
      } catch {
        /* storage may be unavailable; the value still lives in component state */
      }
    }

    /** The Session whose project the frame-wide badge follows. */
    function createSessionStore() {
      let sessionId = ''
      const listeners = new Set()
      return {
        get() {
          return sessionId
        },
        subscribe(listener) {
          listeners.add(listener)
          return () => {
            listeners.delete(listener)
          }
        },
        set(next) {
          if (next === sessionId) return
          sessionId = next
          for (const listener of [...listeners]) listener()
        },
      }
    }

    function createBadge(ctx, store) {
      const call = async (endpoint, payload) => {
        const connection = ctx.get('connection')
        if (connection === undefined || connection.rpc === undefined) {
          return { ok: false, error: { code: 'connection/unavailable', message: 'Connection service is unavailable', details: {} } }
        }
        return await connection.rpc.call(CHANNEL, endpoint, payload ?? null)
      }

      function GitBranchBadge(props) {
        const t = makeTranslator(props.t)
        const [sessionId, setSessionId] = React.useState(store.get())
        const [status, setStatus] = React.useState(null)
        const [overrideCwd, setOverrideCwd] = React.useState(() => readStoredCwd(sessionId))
        const [repoDraft, setRepoDraft] = React.useState('')
        const [branchFilter, setBranchFilter] = React.useState('')
        const [error, setError] = React.useState(null)
        const [branches, setBranches] = React.useState(null)
        const [open, setOpen] = React.useState(false)
        const [busy, setBusy] = React.useState('')
        const [feedback, setFeedback] = React.useState(null)
        const [conflict, setConflict] = React.useState(false)

        const rootRef = React.useRef(null)
        const filterRef = React.useRef(null)
        const sessionRef = React.useRef(sessionId)
        const overrideRef = React.useRef(overrideCwd)
        sessionRef.current = sessionId
        overrideRef.current = overrideCwd

        /** Every request targets the Session directory unless the user picked a repository. */
        const requestBase = React.useCallback(
          () => ({ sessionId: sessionRef.current, cwd: overrideRef.current === '' ? undefined : overrideRef.current }),
          [],
        )

        React.useEffect(() => {
          // Read on subscription so a Session change before mount is not missed.
          const sync = () => setSessionId(store.get())
          sync()
          return store.subscribe(sync)
        }, [])

        const refresh = React.useCallback(async () => {
          const current = sessionRef.current
          if (current === '') {
            setStatus(null)
            setError(null)
            return
          }
          try {
            const result = await call('status', requestBase())
            if (result.ok) {
              setStatus(result.value)
              setError(null)
            } else {
              setError(result.error)
            }
          } catch (failure) {
            setError({ code: 'transport', message: failure instanceof Error ? failure.message : String(failure) })
          }
        }, [requestBase])

        const loadBranches = React.useCallback(async () => {
          const current = sessionRef.current
          if (current === '') return
          try {
            const result = await call('branches', requestBase())
            if (result.ok) setBranches(result.value)
          } catch {
            /* the panel still switches on the status' current branch */
          }
        }, [requestBase])

        // Adopt the repository this Session's project was pointed at last time.
        React.useEffect(() => {
          const stored = readStoredCwd(sessionId)
          overrideRef.current = stored
          setOverrideCwd(stored)
        }, [sessionId])

        React.useEffect(() => {
          setStatus(null)
          setBranches(null)
          setBranchFilter('')
          setFeedback(null)
          setConflict(false)
          if (sessionId === '') return undefined
          void refresh()
          const timer = window.setInterval(() => {
            if (document.visibilityState !== 'hidden') void refresh()
          }, POLL_MS)
          const onFocus = () => {
            void refresh()
          }
          window.addEventListener('focus', onFocus)
          return () => {
            window.clearInterval(timer)
            window.removeEventListener('focus', onFocus)
          }
        }, [sessionId, refresh, overrideCwd])

        React.useEffect(() => {
          if (!open || status?.isRepo !== true) return undefined
          const frame = window.requestAnimationFrame(() => filterRef.current?.focus())
          return () => window.cancelAnimationFrame(frame)
        }, [open, status?.isRepo])

        React.useEffect(() => {
          if (!open) return undefined
          const onPointerDown = (event) => {
            const target = event.target
            if (!(target instanceof Node)) return
            if (rootRef.current !== null && rootRef.current.contains(target)) return
            setOpen(false)
          }
          const onKeyDown = (event) => {
            if (event.key !== 'Escape') return
            event.stopPropagation()
            setOpen(false)
          }
          document.addEventListener('mousedown', onPointerDown, true)
          document.addEventListener('keydown', onKeyDown, true)
          void refresh()
          return () => {
            document.removeEventListener('mousedown', onPointerDown, true)
            document.removeEventListener('keydown', onKeyDown, true)
          }
        }, [open, refresh])

        React.useEffect(() => {
          if (!open || status?.isRepo !== true) return
          void loadBranches()
        }, [open, status?.isRepo, status?.cwd, loadBranches])

        React.useEffect(() => {
          if (feedback === null) return undefined
          const timer = window.setTimeout(() => setFeedback(null), 5000)
          return () => {
            window.clearTimeout(timer)
          }
        }, [feedback])

        const run = async (key, endpoint, payload, describe) => {
          if (busy !== '') return
          setBusy(key)
          setFeedback(null)
          try {
            const result = await call(endpoint, { ...requestBase(), ...payload })
            if (result.ok) {
              setConflict(false)
              setFeedback({ kind: 'ok', text: describe(result.value) })
              setBranches(null)
              await refresh()
              await loadBranches()
            } else if (result.error?.code === 'git/merge-conflict') {
              setConflict(true)
              setFeedback({ kind: 'error', text: `${t('error.mergeConflict')}\n${result.error.message}` })
              await refresh()
            } else {
              const error = result.error
              const translated =
                error?.code === 'git/detached-head'
                  ? t('error.detachedHead')
                  : error?.code === 'git/no-upstream'
                    ? t('error.noUpstream')
                    : error?.code === 'git/sync-diverged'
                      ? t('error.syncDiverged')
                      : error?.code === 'git/sync-failed'
                        ? t('error.syncFailed')
                        : ''
              setFeedback({ kind: 'error', text: translated || error?.message || t('feedback.failed') })
            }
          } catch (failure) {
            setFeedback({ kind: 'error', text: failure instanceof Error ? failure.message : String(failure) })
          } finally {
            setBusy('')
          }
        }

        const selectRepo = (value) => {
          const next = value.trim()
          storeCwd(sessionId, next)
          overrideRef.current = next
          setOverrideCwd(next)
          setRepoDraft(next)
          setStatus(null)
          setBranches(null)
          setBranchFilter('')
          setError(null)
          void refresh()
        }

        const applyRepo = () => selectRepo(repoDraft)

        const isRepo = status?.isRepo === true
        const loading = sessionId !== '' && status === null && error === null
        const readError = sessionId !== '' && status === null && error !== null
        const branch = !isRepo || status?.detached ? '' : status.branch || ''
        const currentName =
          sessionId === ''
            ? t('chip.noSession')
            : readError
              ? t('chip.error')
              : loading
                ? t('chip.loading')
                : !isRepo
                  ? t('chip.noRepo')
                  : status.detached
                    ? t('panel.detached')
                    : branch || 'HEAD'
        const ahead = Number(status?.ahead) || 0
        const behind = Number(status?.behind) || 0
        const dirty = Number(status?.changeCount) || 0
        const allLocal = branches === null || !Array.isArray(branches.local) ? [] : branches.local
        const allRemote = branches === null || !Array.isArray(branches.remote) ? [] : branches.remote
        const normalizedFilter = branchFilter.trim().toLocaleLowerCase()
        const matchesFilter = (name) =>
          normalizedFilter === '' || String(name).toLocaleLowerCase().includes(normalizedFilter)
        const local = allLocal.filter(matchesFilter)
        const remote = allRemote.filter(matchesFilter)
        const repositories = status !== null && status.isRepo !== true && Array.isArray(status.repositories) ? status.repositories : []
        const mergeConflict = conflict || status?.mergeInProgress === true

        const chip = h(
          'button',
          {
            type: 'button',
            className: `gbb-chip${isRepo ? '' : ' gbb-chip-muted'}`,
            'aria-haspopup': 'dialog',
            'aria-expanded': open,
            'aria-label': t('panel.title'),
            title: readError ? error.message || t('panel.readError') : t('chip.title'),
            onClick: () => {
              setOpen((value) => {
                if (!value) setRepoDraft(overrideRef.current)
                return !value
              })
            },
          },
          icons.branch(13),
          h('span', { className: 'gbb-chip-branch' }, currentName),
          isRepo && (ahead > 0 || behind > 0 || dirty > 0)
            ? h(
                'span',
                { className: 'gbb-chip-meta' },
                behind > 0 ? h('span', { title: t('chip.behind', { count: behind }) }, String(behind), icons.down(10)) : null,
                ahead > 0 ? h('span', { title: t('chip.ahead', { count: ahead }) }, String(ahead), icons.up(10)) : null,
                dirty > 0
                  ? h('span', { className: 'gbb-chip-dirty', title: t('chip.dirty', { count: dirty }) }, icons.dot(7), String(dirty))
                  : null,
              )
            : null,
        )

        const rows = []
        const branchRow = (name, kind) => {
          const isCurrent = !status.detached && name === branch
          const key = `${kind}:${name}`
          return h(
            'div',
            {
              key,
              className: `gbb-row gbb-row-${kind}${isCurrent ? ' gbb-row-current' : ''}`,
            },
            h(
              'button',
              {
                type: 'button',
                className: 'gbb-row-main',
                disabled: isCurrent || busy !== '',
                title: isCurrent ? name : `${t('section.switch')}: ${name}`,
                onClick: () => {
                  if (isCurrent || busy !== '') return
                  void run('checkout', 'checkout', { branch: name, source: kind }, (value) =>
                    t('feedback.switched', { branch: value.branch || name }),
                  )
                },
              },
              h('span', { className: 'gbb-row-mark' }, isCurrent ? icons.check(13) : null),
              h('span', { className: 'gbb-row-label' }, name),
            ),
            isCurrent
              ? null
              : h(
                  'button',
                  {
                    type: 'button',
                    className: 'gbb-mini',
                    disabled: busy !== '',
                    title: t('section.merge'),
                    onClick: () => {
                      void run('merge', 'merge', { branch: name }, () =>
                        t('feedback.merged', { branch: name, current: currentName }),
                      )
                    },
                  },
                  busy === 'merge' ? t('branch.merging') : t('branch.merge'),
                ),
          )
        }

        const repositoryRow = (repository) => {
          const path = typeof repository.path === 'string' ? repository.path : ''
          const name = typeof repository.name === 'string' && repository.name !== '' ? repository.name : path
          const relativePath = typeof repository.relativePath === 'string' && repository.relativePath !== '' ? repository.relativePath : path
          const repositoryBranch = typeof repository.branch === 'string' && repository.branch !== '' ? repository.branch : t('panel.detached')
          return h(
            'button',
            {
              key: `repo:${path}`,
              type: 'button',
              className: 'gbb-repo-row',
              title: path,
              onClick: () => selectRepo(path),
            },
            icons.branch(13),
            h(
              'span',
              { className: 'gbb-repo-main' },
              h('span', { className: 'gbb-repo-name' }, name),
              h('span', { className: 'gbb-repo-path' }, relativePath),
            ),
            h('span', { className: 'gbb-repo-branch' }, repositoryBranch),
          )
        }

        if (sessionId === '') {
          rows.push(h('div', { key: 'no-session', className: 'gbb-hint' }, t('panel.noSession')))
        } else if (readError) {
          rows.push(h('div', { key: 'read-error', className: 'gbb-hint' }, error.message || t('panel.readError')))
        } else if (loading) {
          rows.push(h('div', { key: 'loading', className: 'gbb-hint' }, t('panel.loading')))
        } else if (!isRepo) {
          rows.push(h('div', { key: 'norepo', className: 'gbb-hint' }, t('panel.notRepo')))
          if (repositories.length > 0) {
            rows.push(h('div', { key: 'repo-choose', className: 'gbb-section-head' }, t('repo.choose')))
            rows.push(...repositories.slice(0, 40).map(repositoryRow))
            if (repositories.length > 40) {
              rows.push(h('div', { key: 'repo-more', className: 'gbb-hint' }, t('repo.more', { count: 40 })))
            }
          }
          rows.push(
            h(
              'div',
              { key: 'repo-input', className: 'gbb-input-row' },
              h('input', {
                className: 'gbb-input',
                value: repoDraft,
                placeholder: t('repo.placeholder'),
                spellCheck: false,
                onChange: (event) => setRepoDraft(event.target.value),
                onKeyDown: (event) => {
                  if (event.key === 'Enter') applyRepo()
                },
              }),
              h('button', { type: 'button', className: 'gbb-btn', onClick: applyRepo }, t('repo.open')),
            ),
          )
        } else if (branches === null) {
          rows.push(h('div', { key: 'loading', className: 'gbb-hint' }, t('panel.loading')))
        } else if (local.length === 0 && remote.length === 0) {
          rows.push(
            h(
              'div',
              { key: 'empty', className: 'gbb-hint' },
              allLocal.length === 0 && allRemote.length === 0 ? t('branch.empty') : t('branch.filterEmpty'),
            ),
          )
        } else {
          if (local.length > 0) {
            rows.push(
              h(
                'div',
                { key: 'local', className: 'gbb-group' },
                h('div', { className: 'gbb-group-head' }, t('branch.local')),
                ...local.map((name) => branchRow(name, 'local')),
              ),
            )
          }
          if (remote.length > 0) {
            rows.push(h('div', { key: 'sep', className: 'gbb-sep' }))
            rows.push(
              h(
                'div',
                { key: 'remote', className: 'gbb-group' },
                h('div', { className: 'gbb-group-head' }, t('branch.remote')),
                ...remote.slice(0, 40).map((name) => branchRow(name, 'remote')),
              ),
            )
          }
        }

        if (overrideCwd !== '') {
          rows.push(
            h(
              'button',
              {
                key: 'clear-override',
                type: 'button',
                className: 'gbb-text-btn',
                onClick: () => {
                  storeCwd(sessionId, '')
                  overrideRef.current = ''
                  setOverrideCwd('')
                  setRepoDraft('')
                  setStatus(null)
                  setBranches(null)
                  setBranchFilter('')
                  setError(null)
                  void refresh()
                },
              },
              t('repo.clear'),
            ),
          )
        }

        const panel = h(
          'div',
          { className: 'gbb-panel', role: 'dialog', 'aria-label': t('panel.title') },
          h(
            'div',
            { className: 'gbb-head' },
            h(
              'div',
              { className: 'gbb-head-main' },
              h(
                'div',
                { className: 'gbb-head-title' },
                icons.branch(14),
                h('span', { className: 'gbb-head-name' }, currentName),
                ahead > 0 ? h('span', { className: 'gbb-badge' }, `↑${ahead}`) : null,
                behind > 0 ? h('span', { className: 'gbb-badge' }, `↓${behind}`) : null,
                dirty > 0 ? h('span', { className: 'gbb-badge' }, `●${dirty}`) : null,
              ),
              h(
                'div',
                { className: 'gbb-head-meta', title: status?.cwd ?? '' },
                status === null
                  ? readError
                    ? error.message || t('panel.readError')
                    : sessionId === ''
                      ? t('panel.noSession')
                      : t('panel.loading')
                  : isRepo
                    ? `${status.repoName} · ${status.cwd}`
                    : status.cwd,
              ),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'gbb-icon-btn',
                title: t('panel.sync'),
                'aria-label': t('panel.sync'),
                disabled: busy !== '' || sessionId === '',
                onClick: () =>
                  void run('sync', 'sync', {}, (value) =>
                    t('feedback.synced', { branch: value.branch, upstream: value.upstream }),
                  ),
              },
              h('span', { className: busy === 'sync' ? 'gbb-spin' : undefined }, icons.pull(13)),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'gbb-icon-btn',
                title: t('panel.close'),
                'aria-label': t('panel.close'),
                onClick: () => setOpen(false),
              },
              icons.close(12),
            ),
          ),
          feedback !== null || mergeConflict
            ? h(
                'div',
                {
                  className: `gbb-feedback${feedback?.kind === 'error' || mergeConflict ? ' gbb-feedback-error' : ''}`,
                },
                h('span', { className: 'gbb-feedback-text' }, feedback?.text ?? t('error.mergeConflict')),
                mergeConflict
                  ? h(
                      'button',
                      {
                        type: 'button',
                        className: 'gbb-mini',
                        disabled: busy !== '',
                        onClick: () => void run('abort', 'mergeAbort', {}, () => t('feedback.abort')),
                      },
                      t('feedback.abort'),
                    )
                  : null,
              )
            : null,
          isRepo && branches !== null
            ? h(
                'label',
                { className: 'gbb-search' },
                icons.search(13),
                h('input', {
                  ref: filterRef,
                  type: 'text',
                  className: 'gbb-search-input',
                  value: branchFilter,
                  placeholder: t('branch.filterPlaceholder'),
                  'aria-label': t('branch.filter'),
                  autoComplete: 'off',
                  spellCheck: false,
                  onChange: (event) => setBranchFilter(event.target.value),
                }),
                branchFilter === ''
                  ? null
                  : h(
                      'button',
                      {
                        type: 'button',
                        className: 'gbb-search-clear',
                        title: t('branch.filterClear'),
                        'aria-label': t('branch.filterClear'),
                        onClick: (event) => {
                          event.preventDefault()
                          setBranchFilter('')
                          filterRef.current?.focus()
                        },
                      },
                      icons.close(11),
                    ),
              )
            : null,
          h(
            'div',
            { className: 'gbb-body' },
            isRepo ? h('div', { className: 'gbb-section-head' }, t('section.switch'), ' · ', t('section.merge')) : null,
            ...rows,
          ),
        )

        return h('div', { className: 'gbb-root', ref: rootRef }, open ? panel : null, chip)
      }

      return { GitBranchBadge }
    }

    return {
      inject: ['slots', 'uiSession'],
      apply(ctx) {
        ctx.effect(() => {
          if (document.querySelector(`style[data-plugin-css="${CSS_TAG}"]`) !== null) return () => {}
          const tag = document.createElement('style')
          tag.dataset.plugin = PKG
          tag.dataset.pluginCss = CSS_TAG
          tag.textContent = CSS
          document.head.appendChild(tag)
          return () => {
            tag.remove()
          }
        }, 'git-branch-bar: styles')

        // Register the dictionaries once the locale service is live. The components
        // also carry their own copy, so a late or absent service cannot blank the UI.
        ctx.inject(['locale'], (scope) => {
          scope.effect(() => scope.locale.register(NS, { zh, en }), 'git-branch-bar: dictionaries')
        })

        const store = createSessionStore()
        ctx.effect(() => {
          const current = ctx.uiSession.adapter.current
          const sync = () => {
            const key = current.getSnapshot().key
            store.set(typeof key === 'string' ? key : '')
          }
          const unsubscribe = current.subscribe(sync)
          sync()
          return () => {
            unsubscribe()
          }
        }, 'git-branch-bar: active Session')

        const { GitBranchBadge } = createBadge(ctx, store)

        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register({ name: 'shell.overlay', id: 'git-branch-badge', order: 20, locale: NS }, GitBranchBadge),
        )
      },
    }
  },
})
