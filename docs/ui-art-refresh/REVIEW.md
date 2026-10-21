# 验证与接手说明

## 已验证

- TypeScript 检查：`npx tsc --noEmit`。
- 生产构建：`npm run build`，Next 保持 `15.5.25`。
- 受保护文件检查：prisma、lib、actions、api、cart-store、persist-qty、package.json、package-lock.json、next.config.ts 均未变更。
- AST 比对：改动 TSX 中的 `data-ui`、`href`、form `action`、点击/输入/指针事件处理保持原样。

- 响应式检查：6 个页面 × 3 种语言 × 3 种宽度 = 54 项，全部 HTTP 200、无页面脚本异常、无文档横向溢出。原版 375px 首页与管理端分别溢出至 430px / 465px；新版均为 375px。详见 `responsive-results.json`。

- 购物车冒烟检查：数量从 8 改为 9，独立测试数据库实际存储为 9，刷新后为 9，购物车抽屉同为 9；375px 下抽屉边界为 375×900，当前导航仅一项选中。见 `cart-smoke.json`。

## 环境差异与未完成验收

- 原仓库 `npm ci` 失败：锁文件缺少多平台 optional dependencies。测试使用 `npm install --package-lock=false --no-audit --no-fund`；没有提交依赖文件变更。请在原 Windows 环境复核锁文件一致性。
- 使用独立 SQLite 演示库；没有访问生产数据库。仓库 seed 的用户和币种与交接文档中的线上演示账户不同，截图中的币种完全由已有代码与本地 seed 决定。
- 交接文档列出的 `full-regression.js`、`req-audit.js`、`tier-feedback-e2e.js`、`qty-stepper-e2e.js`、`cart-sync-e2e.js` 不在仓库中，未声称通过这些测试。
- 此批不包含下单、开票、付款、PDF 导出的完整业务回归；WorkBuddy 需在合并前执行原有测试。
- 批发商首页已有中文硬编码库存提示和裸 `next/image`；本批未扩大到这些既有业务/文案问题。
- 本地浏览器缺少完整中文系统字体，中文检查可验证文本与布局边界，但中文字体视觉仍需在目标设备复核。

## 截图

截图来自真实 Next.js 页面与独立 seed 数据。before 对应基线；after 对应本分支。截图是开发环境，可见 Next 开发工具按钮。请同时验收真实手机触屏、安全区、注册流程和长商品名。


| 页面 | 桌面改前 / 改后 | 手机改前 / 改后 |
| --- | --- | --- |
| 首页 | [before](screenshots/before-landing-en-1280.png) / [after](screenshots/after-landing-en-1280.png) | [before](screenshots/before-landing-en-375.png) / [after](screenshots/after-landing-en-375.png) |
| 商品市场 | [before](screenshots/before-retailer-browse-en-1280.png) / [after](screenshots/after-retailer-browse-en-1280.png) | [before](screenshots/before-retailer-browse-en-375.png) / [after](screenshots/after-retailer-browse-en-375.png) |
