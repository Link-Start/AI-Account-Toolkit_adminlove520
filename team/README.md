# ChatGPT Team 协议注册机

纯协议注册 ChatGPT Team 子号，支持 Codex OAuth 授权与自动 Token 管理。

## 功能特点

- **纯协议注册**: 通过企业 SSO 流程完成 ChatGPT Web 注册/登录
- **Codex OAuth**: 自动完成 Codex OAuth 流程并保存 Refresh Token
- **Token 续签**: 支持 `--check-tokens` 命令进行 Token 自动续签
- **批量注册**: 支持多线程批量注册
- **动态代理**: 支持代理轮换，防止 Cloudflare 拦截

## 安装依赖

```bash
python -m pip install --upgrade pip
python -m pip install curl_cffi
```

## 配置说明

创建 `ChatGPT_team.config.local.json` 配置文件：

```json
{
  "proxy": "http://127.0.0.1:7890"
}
```

> 如不需要代理，可省略此配置文件。

## 使用方法

### 批量注册

```bash
python ChatGPT_team.py --total 100 --workers 20
```

### Token 续签检查

当 Token 返回 `401` 时，可运行以下命令自动续签：

```bash
python ChatGPT_team.py --check-tokens
```

该命令会：
1. 加载 `chatgpt_sessions/` 中的会话
2. 重新运行 Codex OAuth
3. 覆盖原有的 Token 文件

## 输出文件

- `registered_only.txt` - 成功注册的账号列表
- `register_only_failed.txt` - 注册失败的账号列表
- `chatgpt_sessions/` - ChatGPT 会话存储
- `codex_tokens/` - Codex Refresh Token (CPA 格式)

## 格式转换

默认导出 CPA 格式 Token 到 `codex_tokens/` 目录。

可通过 CPA-Manager-Plus 工具将其转换为 sub2api 格式。

## 注意事项

1. **务必开启动态代理**，否则会被 Cloudflare 拦截
2. Token 可能会在 20+ 请求后 401 掉线，使用 `--check-tokens` 进行续签
3. 可根据需要修改邮箱配置以适配不同注册方式
4. 建议使用 Python 3.10+ 环境

## 相关工具

- [CPA-Manager-Plus](../packages/codex/CPA-Manager-Plus/) - CPA Token 管理工具
- [oai-Team-SSO-OIDC](../packages/openai/oai-Team-SSO-OIDC/) - OpenAI Team SSO OIDC 实现

---

**来源**: 基于 [oai-Team-SSO-OIDC](https://github.com/otso2200/oai-Team-SSO-OIDC) 项目优化
