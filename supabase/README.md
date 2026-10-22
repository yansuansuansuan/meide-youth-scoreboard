# 美德少年：在线积分通道（开发分支）

本次改动只负责 **真实保存积分的通道**，不替任何孩子录入积分，也不改变现有首页视觉。

## 状态

- 新后台：`admin-live.html`
- 前台：继续使用 `index.html`
- 数据来源：填写 `supabase-config.js` 之前仍使用旧的静态 JSON；填写后改为读取云端数据库
- 在线保存：管理员登录后，向 `meide_ledger` 写入，数据库触发器同时更新 `meide_public_scores`
- 前台总榜、活动榜和成长档案读取云端积分，并每 20 秒轮询检查变化，切回浏览器标签页也会检查
- 管理员可以新增儿童、创建活动、录入积分、查看最近 30 条流水及撤销错误记录
- 真实的加分原因和操作人只对管理员可见，不放到公开积分表
- 注意：本开发分支尚未接入可用的专用数据库，也未完成实际端到端写入测试

## 启用步骤

1. 在 Supabase 控制台准备一个 **专用于美德少年** 的项目。当前账号中的已有项目处于 INACTIVE 状态，且用途未确认；本分支没有触碰它。项目区域可选择距离用户较近且符合机构数据处理要求的区域。免费项目可能因长期不活跃而暂停。
2. 在 Supabase SQL Editor 执行 [schema.sql](schema.sql)。执行成功后，应出现五张表：`meide_admins`、`meide_children`、`meide_activities`、`meide_ledger`、`meide_public_scores`。
3. 在 Authentication → Users 创建工作人员账号，复制该用户的 UUID。在 SQL Editor 用服务器管理员权限执行：

   ```sql
   insert into public.meide_admins(user_id)
   values ('替换为已创建的登录用户UUID')
   on conflict (user_id) do nothing;
   ```

   禁止把管理员权限交给任意自注册用户。
4. 在项目设置获取 **Project URL** 和 **publishable key**，填入仓库根目录 `supabase-config.js` 的 `url` 和 `publishableKey`。publishable key 可用于前端；**切勿把 secret key / service_role key 填进仓库**。
5. 合并本分支后，打开 `https://yansuansuansuan.github.io/meide-youth-scoreboard/admin-live.html` 登录。初次项目为空，可以先添加孩子和活动，然后再开始正式积分录入。
6. 最后进行真实联调：后台保存一笔经授权的实际积分 → 数据库出现流水 → 公共积分表有对应记录 → 前台总榜/活动榜分数更新 → 撤销后分数恢复。**未完成此验证之前，不应宣布系统已上线。**

## 安全与上线提醒

- 公共页面只读取名字/昵称、活动和公开积分；`reason`、`operator` 只存于受管理员权限保护的 `meide_ledger`。
- `meide_admins` 的成员必须通过受信任的 SQL 后台添加，不能前端注册。
- 所有客户端写入都由 Supabase Auth + 行级权限（RLS）控制，不依赖网页上隐藏按钮或前端口令。
- 不要直接把现有 `data/*.json` 当成真实数据库导入；旧数据是否为真实记录需要工作人员核实。
- 儿童真实姓名公开展示前，需要确认监护人授权与数据保留要求；可优先使用展示昵称。
- 数据库连接一旦启用，前台不会在云端发生故障时悄悄退回旧 JSON 显示过时积分，而是展示加载失败提示。
- 当前只是手工维护的最小可运营通道，后续可添加批量导入、活动报名、多人操作日志等。

## 主要变动

- `supabase/schema.sql`：表结构、管理员白名单、RLS、积分同步触发器
- `supabase-config.js`：云数据库公开连接配置（默认空）
- `cloud-data.js`：公共前台分页获取云端积分
- `admin-live.html` / `admin-live.js`：受权限控制的管理后台
- `index.html` / `app.js`：切换数据来源并轮询榜单变化
