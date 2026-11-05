# Git Branch Badge

在 DeepSeek Harness 窗口右下角显示当前项目所在 Git 分支，并提供切换分支与合并分支。

## 功能

1. **右下角看分支** — 打开项目（Session）后，右下角浮出分支徽标：`⎇ 分支名`，附带 `↑领先 / ↓落后 / ●未提交更改` 计数。
   每 15 秒、窗口重新获得焦点、展开面板和每次操作后刷新。
2. **切换分支** — 点徽标展开面板，点击任意本地分支即切换；点击远程分支（如 `origin/main`）会创建同名跟踪分支并切过去。
   分支较多时，可在列表上方输入分支名实时筛选，本地和远程分支都会按名称匹配，且不区分大小写；清空输入即可恢复完整列表。
3. **合并分支** — 每行分支右侧的「合并」按钮把该分支合并进当前分支（`git merge --no-edit`）。
   合并冲突时面板显示冲突提示与「撤销合并」按钮（`git merge --abort`）。
4. **同步远程代码** — 点面板右上角的同步按钮，从当前分支的上游执行
   `git pull --ff-only --no-rebase`；成功后刷新领先/落后计数。没有上游或已分叉时会显示明确提示。

当前目录不是 Git 仓库时（例如 `work` 这种包含多个仓库的容器目录），徽标变灰并提示「未检测到 Git 仓库」，
面板会自动列出附近最多三层内的子仓库（跳过 `.git`、`node_modules`、构建目录等），点选后徽标跟随该仓库；
也可以直接填一个仓库绝对路径，或随时清除这个自定义路径。

## 实现

- Host（`index.js`）：在 Session 的工作目录里执行 `git`，通过 `POST /x-git-branch/<endpoint>` 暴露
  `status / branches / checkout / merge / mergeAbort`，复用 Connection 的浏览器鉴权
  （`ctx.connection.requestRejection`），响应体是 Connection 的 RPC 信封。
- Client（`client.js`）：在 `shell.overlay` 注册右下角徽标（frame-wide 浮层），面板就在徽标上方；
  通过 `ctx.uiSession.adapter.current` 跟随当前 Session。
- 工作目录解析：`ctx.workingDirectory` 优先，其次 Session header 的 `cwd`；请求体也可显式带仓库路径。
- 所有切换、合并操作都会先解析真实仓库根，并在仓库根执行。

## 配置

插件行可选配置：

| 键 | 默认 | 含义 |
| --- | --- | --- |
| `gitPath` | `git` | git 可执行文件 |
| `defaultCwd` | – | Session 没有目录时的兜底目录 |
