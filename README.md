# DeepSeek Harness Git Branch

DeepSeek Harness 的 Git 分支管理插件。打开项目后，在页面右下角显示当前分支，并支持切换、合并、筛选和同步远程代码。

## 功能

- 右下角显示当前分支、领先/落后提交数和未提交更改数。
- 展开面板切换本地分支，或从远程分支创建同名本地分支。
- 本地分支列表显示相对上游分支的落后与领先提交数。
- 输入分支名实时筛选本地与远程分支，支持大小写不敏感匹配。
- 将指定分支合并到当前分支，并在冲突时提供撤销合并操作。
- 从当前分支的远程上游快进同步最新代码。

## 市场安装

普通用户不需要克隆仓库或编辑 Profile。把下面的市场索引地址添加到 DeepSeek Harness：

1. 打开「插件」页面，进入「发现」。
2. 点击「索引源」，在索引地址输入框中填入：

   ```text
   https://cdn.jsdelivr.net/gh/wenxint/deepseek-harness-git-@main/index.json
   ```

3. 返回发现页，找到「Git 分支徽标」并点击安装。
4. 安装完成后重启 DeepSeek Harness，再打开一个 Git 项目。

如果 jsDelivr 无法访问，可以改用 GitHub 原始索引：

```text
https://raw.githubusercontent.com/wenxint/deepseek-harness-git-/main/index.json
```

仓库根地址本身不是市场索引，直接填入
`https://github.com/wenxint/deepseek-harness-git-` 不会出现插件。

当前插件要求 DeepSeek Harness `>=0.2.1-rc.5 <0.3.0`，电脑上需要可用的 `git` 命令。
市场索引会把安装固定到一个 Git 提交，索引更新后重新安装即可获取新版本。

## 目录

```text
bundle/  插件运行时文件
tools/   本地调试与打包辅助脚本
index.json  插件市场索引
```

插件配置和实现说明见 [bundle/README.md](bundle/README.md)。

## 本地开发安装

开发者可以直接将 `bundle/` 目录作为本地插件加载，并在 DeepSeek Harness 的 Profile 中注册
`@local/dsh-plugin-git-branch`。只注册仓库根目录不会生效，因为真正的组合包清单位于 `bundle/package.json`。
重新启动 Harness 后打开任意项目，即可在右下角看到分支徽标。

## 开发检查

```bash
node --check bundle/client.js
node --check bundle/index.js
```

发布新版本时，先更新 `bundle/package.json` 的版本并提交，再把该提交的完整 SHA 写入
`index.json` 的 `versions[0].source.commit`。不要把索引指向会继续移动的分支名。

## 信任说明

插件会以当前用户权限在本机执行 `git status`、`git branch`、`git checkout`、
`git merge` 和 `git pull --ff-only --no-rebase`。只应从可信索引安装，并在操作前确认仓库没有需要保留的未提交更改。
