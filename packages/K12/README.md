# 🎓 K12 教育工具集

> K12 相关 AI 账号注册与管理自动化工具集合

---

## 📖 目录

- [📂 子模块列表](#-子模块列表)
- [🔗 相关资源](#-相关资源)
- [🚀 快速开始](#-快速开始)
- [📝 K12 使用教程](#-k12-使用教程)

---

## 📂 子模块列表

### K12-Space-Automation

| 项目 | 描述 |
| :--- | :--- |
| **[K12-Space-Automation](K12-Space-Automation/)** | K12 Space 自动化管理工具 |

**仓库地址**: https://github.com/BFanSYe/K12-Space-Automation

---

### chatgpt-register-sub2api

| 项目 | 描述 |
| :--- | :--- |
| **[chatgpt-register-sub2api](chatgpt-register-sub2api/)** | ChatGPT 注册转 sub2api 工具 |

**仓库地址**: https://github.com/akihitohyh/chatgpt-register-sub2api

---

## 🔗 相关资源

### K12 Gmail 服务

| 资源名称 | 链接 |
| :--- | :--- |
| **K12 Gmail 服务** | https://gmail-k12.duckdns.org/ |
| **ChatGPT K12 教师计划** | https://chatgpt.com/zh-Hans-CN/plans/k12-teachers/ |

---

## 📝 K12 使用教程

### 什么是 K12？

**K12**（Kindergarten through 12th Grade）是美国/加拿大基础教育的统称，指从幼儿园（5-6 岁）到高中毕业（17-18 岁）的 13 年教育体系。

### K12 工作流程

```
1. 注册 Gmail/Outlook 教育别名账户
   ↓
2. 使用别名账户注册 ChatGPT
   ↓
3. 找到对应 K12 组，使用自动进组链接
   ↓
4. 邮箱收到邀请邮件，点击确认加入
   ↓
5. 左下角切换工作区到 K12
   ↓
6. 根据教程转换为 CPA 或 sub2api 格式
```

### 注意事项

- **后端接口无鉴权**：可以加入其他 K12 组，所有 K12 组均可互访
- **邮箱别名**：Gmail 支持 `username+alias@gmail.com` 格式创建多个别名
- **教育认证**：部分功能需要 K12 教育机构认证

---

## 🚀 快速开始

### 克隆本仓库

```bash
git clone --recurse-submodules https://github.com/adminlove520/AI-Account-Toolkit.git
```

### 更新子模块

```bash
git submodule update --init --recursive
```

### 单独更新某个子模块

```bash
git submodule update --init --recursive packages/K12/K12-Space-Automation
git submodule update --init --recursive packages/K12/chatgpt-register-sub2api
```

---

**最后更新**: 2026-07-08
