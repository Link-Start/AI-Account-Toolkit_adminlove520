# [「来不及解释了快上车」浏览器插件操作说明]

## [1. 插件安装与无痕模式授权]

### [第一步：加载插件]

1. 打开 Chrome 浏览器，在地址栏输入 `chrome://extensions/` 并回车。
2. 在右上角开启 **「开发者模式」**。
3. 点击左上角的 **「加载已解压的扩展程序」**。
4. 选择本项目根文件夹 `chatgpt-workspace-joiner`。  

[![01-load-extension](https://cdn3.ldstatic.com/original/4X/d/5/1/d51019e352c63068934a712f190cb96c8ce7ec5b.svg)](https://cdn3.ldstatic.com/original/4X/d/5/1/d51019e352c63068934a712f190cb96c8ce7ec5b.svg)

### [第二步：开启无痕模式使用权限 (关键步骤]
为确保「打开并登录」功能在无痕窗口中能自动填充邮箱，请进行以下设置：

1. 

在插件卡片上点击 **「详细信息」**。

2. 

往下拉找到 **「在无痕模式下允许」** 选项，将其**开启（变绿 / 变蓝）**。
[![02-allow-incognito](https://cdn3.ldstatic.com/original/4X/f/a/4/fa4425ea5c57e21612f13cf8a1043af63b639461.svg)](https://cdn3.ldstatic.com/original/4X/f/a/4/fa4425ea5c57e21612f13cf8a1043af63b639461.svg) 界面版面结构介绍

## [2. 功能一：已上车车队管理与安全下车]

打开 `chatgpt.com` 页面并成功登录后，插件会在顶部自动抓取到您的当前主账号，并在最上方渲染出您已加入的团队列表。

### [操作步骤：]

1. 

打开侧边栏，插件自动读取登录态并拉取车队列表（包含**序号、空间名称、人数、空间 ID**）。

2. 

如需手动更新列表，点击右上角 **「刷新列表」**。

3. 

**安全下车**：在对应空间右侧点击 **「下车」** 按钮，系统会提示您确认，点击确认后，后台将自动切换到该空间，并发送注销请求退出该工作空间。成功后列表自动更新。

[![04-workspace-management](https://cdn3.ldstatic.com/original/4X/8/3/9/8396f54db6654041c69ff776adafb077bc1a6d8f.svg)](https://cdn3.ldstatic.com/original/4X/8/3/9/8396f54db6654041c69ff776adafb077bc1a6d8f.svg)

## [3. 功能二：批量自助上车（开车）]

通过该功能，您只需输入一个或多个母号空间 ID，即可实现一键自动申请加入，且在加入成功后**全自动完成 Token 交换并获取 workspace 专属凭证**。

### [操作步骤：]

1. 

**输入 ID**：在「母号 Workspace ID」文本框中填入母号空间 ID。支持一行一个或使用逗号分隔。

2. 

**选择格式**：在「凭证输出格式」中选择您想要的格式：

- **CPA JSON** (用于自建面板)
- **sub2api** (全套配置 Bundle)
- **原始 JSON** (原始 Session 信息)

3. 

**开车**：点击下方的红色 **「开车」** 按钮。

4. 

**复制**：运行结束后，凭证卡片会自动弹出并高亮展示，直接点击 **「复制凭证」** 按钮即可（若为多空间，将以 JSONL 格式或合并的 accounts 数组提供，方便直接导入）。

[![05-batch-join-credentials](https://cdn3.ldstatic.com/original/4X/a/d/b/adb9050322e09199ebdd220dbd5bf1b776b2b525.svg)](https://cdn3.ldstatic.com/original/4X/a/d/b/adb9050322e09199ebdd220dbd5bf1b776b2b525.svg)

## [4. 功能三：Gmail 别名生成与无痕一键自动登录]

针对需要批量登录别名子账号的用户，插件提供了极速别名生成，并实现了主窗口不退登、无痕窗口一键自动填入的完美体验。

### [操作步骤：]

1. **切换 Tab**：点击插件上方的 **「Gmail 别名」**。
2. **输入基础账号**：在「基础 GMAIL 账号」中只输入您的账号前缀（例如 `yourname`，无需输入 `@gmail.com`）。
3. **配置参数**：

- 填写自定义前缀（可选，留空则完全随机）。
- 选择生成的字符规则（字母、数字、点`.`）和生成数量。

4. **生成别名**：点击 **「生成别名邮箱」**，结果会在下方列表呈现。
5. **快捷无痕登录 (超赞功能 ![:glowing_star:](https://cdn.ldstatic.com/images/emoji/twitter/glowing_star.png?v=15))**：

- 点击生成的别名邮箱右侧的 **「无痕登录图标（![:door:](https://cdn.ldstatic.com/images/emoji/twitter/door.png?v=15)➔）」**。
- 浏览器会自动打开一个干净的**无痕模式窗口**并加载 GPT 登录页。
- 输入框出现后，邮箱地址将**在 1 秒内自动填入**，您无需做任何复制粘贴动作，直接输入验证码即可登录！[![06-gmail-alias-login](https://cdn3.ldstatic.com/original/4X/b/9/9/b99b3c7a341823bbb694e78557098989ebe2b631.svg)](https://cdn3.ldstatic.com/original/4X/b/9/9/b99b3c7a341823bbb694e78557098989ebe2b631.svg)

