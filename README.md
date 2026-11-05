# DeepSeek Harness Git Branch

DeepSeek Harness 的 Git 分支管理插件，在页面右下角显示当前项目分支，并支持切换和合并分支。

## 功能

- 右下角显示当前分支、领先/落后提交数和未提交更改数。
- 展开面板切换本地分支，或从远程分支创建同名本地分支。
- 本地分支列表显示相对上游分支的落后与领先提交数。
- 输入分支名实时筛选本地与远程分支，支持大小写不敏感匹配。
- 将指定分支合并到当前分支，并在冲突时提供撤销合并操作。
- 从当前分支的远程上游快进同步最新代码。

## 目录

```text
bundle/  插件运行时文件
tools/   本地调试与打包辅助脚本
```

插件配置和实现说明见 [bundle/README.md](bundle/README.md)。

## 安装

将 `bundle/` 目录作为本地插件加载，并在 DeepSeek Harness 的 Profile 中注册
`@local/dsh-plugin-git-branch`。重新启动 Harness 后打开任意项目，即可在右下角看到分支徽标。

## 开发检查

```bash
node --check bundle/client.js
node --check bundle/index.js
```
