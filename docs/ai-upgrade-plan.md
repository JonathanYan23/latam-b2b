# Latam B2B —— AI 能力升级完整技术方案（Phase 1）

> 依据《项目背景》需求文档（模块1 商品智能录入 / 模块2 智能搜索与发现 / 模块3 数据与内容标准化）
> 面向零售/批发双门户；Vercel + Neon(pgvector) 免费基础设施；模型全部开源、本地部署、无 API 调用费。
> 状态：方案全文 + 本仓库已落地非推理部分（前端/数据/规则层）；推理服务部署后即刻点亮。

> **✅ 2026-09-08 更新：已接入 SiliconFlow 云 API（零部署方案），AI 识别/向量开箱即用**
> 详见文末「附录 A：SiliconFlow 快速点亮」。自托管推理服务仍为可选项（数据不出第三方时采用）。


---

## 0. 总体架构

```
浏览器（Next.js 15 双门户）
   │  ① 商品图片/报价单/截图  ──上传──▶ POST /api/ai/extract（Vercel Function，代理）
   │  ② 搜索文本（可选语义） ──POST /api/ai/embed──▶ pgvector 相似检索
   ▼
Vercel Serverless（Next.js API/Server Actions）
   │  AI_INFERENCE_URL（私有，Vercel 仅内网/带 Token 网关）
   ▼
推理服务（方案 B：Runpod Serverless / 本地 GPU；方案 A：初期不部署 → 前端自动降级为手动填写+关键词搜索）
   ├─ PaddleOCR：图片/PDF/截图 → 文本行
   ├─ Qwen2.5-7B-Instruct（4bit）：OCR 文本 → 商品字段 JSON / 分类 / 标签
   └─ BGE-M3：商品文本 → 1024 维向量
   ▼
Neon PostgreSQL（pgvector 插件，免费 500MB 内）→ ProductEmbedding(1024) HNSW 索引
```

**约束实现方式**
- 不做多语言：仅按用户当前 UI 语言输入检索，不翻译、不额外做多语言模型。
- 权限/可见性保持现状（现有体系不动）。
- 查重范围 = 当前登录批发商自己名下；严禁跨商家比对、严禁全局索引、严禁泄露他商数据。
- AI 能力全开源免费；界面文案只用「智能识别/自动填写/批量上架/智能搜索」，不出现 OCR/向量/语义/Embedding 等词。

---

## 1. 模块1 · 商品智能录入（批发商端）

### 1.1 交互流程（唯一入口）
1. 商品管理页顶部唯一主按钮 `📷 批量智能上架`（= 现有 `/wholesaler/products/bulk` 统一入口）。
   页面中不再保留单独的「CSV 导入/手动添加/照片」等散入口（CSV 与照片都在此页上传区进入）。
2. 上传区文案：`拖放商品图、报价单、Excel、截图到此处，AI 自动识别并填写商品信息`。
3. 后端逐文件：图片/PDF/截图 → PaddleOCR → Qwen 提取 JSON → 标准化清洗 → 生成草稿行。
4. 草稿行展示：左侧原图预览，右侧字段表单（**全部可编辑**，缺字段显示「待补充」灰字，不阻断）。
5. 字段含：名称/货号(SKU)/条码/描述/公开价/箱规/最小起订量/单位/分类/标签。
6. 查重（商家内部）：与库内+本页草稿两两比对 → 命中行 **橙色边框** + 行内提示
   `⚠ 在您的商品库中发现疑似重复商品：[商品名]` + 选项：
   - `保留两件`（默认，均入库） / `跳过不新增`（取消勾选） / 自行编辑后决定。
   系统不自动删除/合并；不弹窗阻断。
7. 底部唯一按钮 `✅ 确认并批量上架（N）` → 批量写库 → 回商品列表。

### 1.2 数据表
商品表已扩展（已落地）：
```sql
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS barcode TEXT;      -- 条形码（查重键）
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "boxSize" TEXT;    -- 箱规 24瓶/箱（标准化）
```
AI 草稿不需要落库（客户端内存行，提交时批量入库），因此无额外表。
埋点（可选）：`AiExtractLog(id, wholesalerId, fileName, provider, ok, ms)` —— Phase 2 再建。

### 1.3 API（新增）
| Method/Path | 说明 |
|---|---|
| `POST /api/ai/extract` | 入参 FormData(file)；流程 PaddleOCR→Qwen；出参 JSON 商品字段或 `{ok:false}` |
| `POST /api/ai/embed` | 入参 JSON `{text}`；出参 `{embedding:[1024]}`（BGE-M3） |
| `POST /api/ai/similar` | 语义检索：`{text, k, wsOnly?}` → 相似商品 id 列表（cosine < 0.35 视为高相关） |

上述路由仅做鉴权+转发（见 `src/lib/ai.ts` 适配层，Vercel 无 Token 配置时返回 501 或空，界面自动降级）。

### 1.4 服务端调用示例（已内置 `src/lib/ai.ts`）
```ts
import { aiExtractProduct } from "@/lib/ai";
const fields = await aiExtractProduct(ocrText /* PaddleOCR 输出 */);
// fields: { name, sku, barcode, publicPrice, moq, boxSize, description, keywords }
// fields === null → 前端按“手动补填”兜底（现有草稿行即兜底态）
```
查重规则（已内置 `src/lib/normalize.ts`）：
`条码完全一致 || 名称相似度≥85%（归一化 + 二元组 Dice）|| 名称高度相似且价格差<10%` → 疑似重复。
价格参与需草稿行两两价格比较，价格差异判定在提交前 client 完成（草稿行有 price）。

### 1.5 前端页面
- 改造 `/wholesaler/products/bulk`（已落地：标题/提示/入口文案 = 智能上架；查重提示+跳过=已落地）。
- 待推理服务就绪后：上传 handler 先调 `/api/ai/extract` 成功则用 AI 字段填充草稿，失败照旧（文件名兜底名）。

---

## 2. 模块2 · 智能搜索与发现（零售商端）

### 2.1 交互
1. **全站统一顶部搜索框**（已落地：零售门户顶栏常驻，回车 → `/retailer/browse?q=`）；
   占位文案：`搜索商品、品类，直接描述您要的商品…`（已落地）。
2. 市场页（browse）：分类标签顶置（默认「全部」高亮，已有）+ 结果页顶部**唯一排序栏**（已落地：综合推荐/价格从低到高/价格从高到低）。
3. 无结果 → **相似替代推荐**（已落地规则版：无结果时按当前分类/最新展示 6 件，标题 `未找到完全匹配商品，为您推荐相似替代商品`）。
4. 语义层（推理服务就绪后）：
   - 查询→BGE-M3 向量→pgvector `cosine_distance < 0.35` 取 top-N；
   - 排序分 = `0.6*向量分 + 0.25*近90日采购量 + 0.15*库存充足度`；
   - 无语义分时按价格排序降级。

### 2.2 pgvector 设计（Neon 内置）
```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS "ProductEmbedding" (
  "productId" text PRIMARY KEY REFERENCES "Product"(id) ON DELETE CASCADE,
  v vector(1024),                 -- BGE-M3 固定 1024 维
  "updatedAt" timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_embedding_hnsw
  ON "ProductEmbedding" USING hnsw (v vector_cosine_ops);
```
- 体积：1024 维 × float ≈ 4KB/件；10,000 件 ≈ 40MB，远低于 500MB 免费线。
- 写入触发：商品创建/更新后异步（产品变更 → 调 embed → upsert）；巡检任务回填存量。
- 语义查询（Vercel Function 内，全部在 DB 完成，<200ms）：
```sql
SELECT p.id, p.name, 1 - (e.v <=> $1::vector) AS sim
FROM "ProductEmbedding" e JOIN "Product" p ON p.id=e."productId"
WHERE p.active AND 1-(e.v <=> $1::vector) > 0.65
ORDER BY e.v <=> $1::vector LIMIT 24;
```

### 2.3 批发商卡片（本仓库已按 UI 规范落地）
店铺名 / 主营一句话（Business.categorySummary）/ 3–5 张商品预览小图（无价无库存）/ 地址·联系人·进店按钮。

---

## 3. 模块3 · 数据与内容标准化（后台静默）

### 3.1 已落地（`src/lib/normalize.ts` + 三个写入 action）
- 单位统一：500毫升/500 ml/0.5L → 500ml；1L→1000ml（正则链）。
- 条码清洗：仅数字，8–14 位，否则置空。
- 描述/箱规：去重空格、容量归一。
- 保存时机：createProductAction / updateProductAction 自动执行（后台静默）。
- 商品列表顶部轻提示 `✅ 已自动统一商品信息格式`（已落地）。

### 3.2 异常检测（行内 ⚠ + 悬停详情，不弹窗不阻断）
规则（`detectProductIssues` 已提供，UI 待接）：
- 价格偏离同商家同类中位 >10× 或 <1/10；
- 必填缺失（名称 <2 字符）；
- 条码格式错误；
- 起订量 <1。
接入点：商品列表行尾部渲染 ⚠（title=原因），商品保存响应可带回 warning 列表。

### 3.3 每日巡检
Vercel Cron（`vercel.json` 增加 `crons: [{path:"/api/cron/scan", schedule:"0 4 * * *"}]`）：
扫描历史数据（异常统计写入内部日志/提示表），下一迭代启用。

---

## 4. 开源模型选型与部署

| 用途 | 模型 | 部署 | 备注 |
|---|---|---|---|
| OCR（图/PDF/截图/报价单） | PaddleOCR | 推理服务 | 中英数字高识别、CPU 可跑 |
| 属性提取/分类/标签 | Qwen2.5-7B-Instruct（首选）| 推理服务（4-bit/AWQ）| Llama3-8B 备选 |
| 语义向量 | BGE-M3（1024 维）| 推理服务 | 多语检索 |

部署三选一：A 初期不部署（全站降级可用，**本仓库当前即 A**）/ B 推荐：Runpod Serverless 或本地 GPU 单容器，暴露 `/v1/chat/completions` 与 `/v1/embeddings` / C 规模化自建集群。
Vercel 侧仅需要两个环境变量（见 `.env.example`）：
```
AI_INFERENCE_URL=https://<worker>/
AI_TOKEN=xxxx          # 自定
AI_MODEL=qwen2.5-7b-instruct
AI_EMBED_MODEL=bge-m3
```

### 推理服务最小容器示例（worker/Dockerfile）
```dockerfile
FROM ghcr.io/huggingface/text-generation-inference:latest
CMD ["--model-id","Qwen/Qwen2.5-7B-Instruct-GPTQ-Int4","--quantize","gptq"]
# PaddleOCR 建议单独 container：paddleocr serve 或 FastAPI 包一层
```

---

## 5. 测试用例清单（验收）

**模块1 智能录入**
1. 上传 1 张价签图 → 草稿行字段含价格/规格/MOQ 且可编辑（缺字段显示“待补充”）
2. 上传 2 张相同商品图 → 第二条命中橙色查重提示（同 SKU/名称相似）
3. 查重行点「跳过不新增」→ 不创建且不删除库内原商品
4. 勾选全部点「确认并批量上架」→ 写库成功且列表出现，库存/额度校验生效
5. 名称只输入 1 字符 → 提交被拦截提示必填

**模块2 智能搜索**
6. 顶栏搜索「24瓶一箱的矿泉水」→（无语义服务时降级关键词）有结果或出现替代推荐区，不空白不报错
7. 无结果关键词 → 显示 `相似替代` 板块 ≥1 件
8. 排序：价格升/降正确切换；带 q/cat 时排序参数保持
9. 找批发商卡片：显示主营一句话 + ≥3 张商品图（无价无库存），进店按钮可点

**模块3 标准化**
10. 商品编辑把描述写「500毫升/瓶」→ 保存后读取为「500ml/瓶」
11. 条码输入 12 位数字→保存保留；输入字母/超长→自动清洗或置空
12. 价格异常（同类中位 10×）→ 行内 ⚠ 提示（不阻断）

**安全/边界**
13. 批发商 A 上传内容查重不会引用批发商 B 商品（无跨商家数据）
14. 未配置 AI_INFERENCE_URL → 所有 AI 功能页正常可用（手动/关键词兜底）
15. 权限/门户隔离行为与现状完全一致（零回归）

---

## 6. 本仓库 Phase-1 已落地清单（无需推理服务即生效）

| 项 | 文件 |
|---|---|
| Product.barcode / Product.boxSize 字段（本地+Neon+pg schema）| schema.prisma / schema.postgres.prisma |
| 标准化工具库（单位/条码/规格清洗、查重相似度、异常检测）| `src/lib/normalize.ts` |
| AI 推理适配层（chat/embedding/降级 stub）| `src/lib/ai.ts` |
| 创建/更新商品保存时自动标准化 | wholesaler/actions.ts |
| 商品列表「已自动统一商品信息格式」提示 | wholesaler/products/page.tsx |
| 市场页：排序栏（综合/价格↑/↓）| retailer/browse/page.tsx |
| 市场页：无结果「相似替代推荐」| retailer/browse/page.tsx |
| 顶栏全局搜索（零售商门户所有页面）| components/portal-shell.tsx |
| 找批发商卡：主营一句话 + 3-5 图预览（上一迭代）| retailer/discover/page.tsx |
| 批量智能上架入口文案 + 商家内部查重提示（橙色行/跳过不新增）| products/bulk* |
| 店铺资料已移除官网字段（上一迭代）| wholesaler/account/* |

> 后续迭代候选：/api/ai/extract 与 /api/ai/similar 路由、商品列表行内 ⚠、每日巡检 Cron、
> 推理服务 Docker 编排、采购量/相关性权重调参。全部待用户确认后推进。


---

## 附录 A：SiliconFlow 快速点亮（零部署，推荐）

注册 https://cloud.siliconflow.cn → 控制台「API 密钥」→ 创建 `sk-...` Key。
然后在 **本地 `.env.local`** 与 **Vercel 环境变量** 各加一项（代码已就绪，无需改动）：

```bash
SILICONFLOW_API_KEY=sk-xxxx
# 可选覆盖（默认值已可直接用）：
# AI_VISION_MODEL=Qwen/Qwen3-VL-8B-Instruct    # 看图直读（默认）；复杂报价单用 Qwen/Qwen3-VL-32B-Instruct 或 zai-org/GLM-4.5V
# AI_MODEL=deepseek-ai/DeepSeek-V3.1            # 文本字段规范化
# AI_EMBED_MODEL=BAAI/bge-m3                    # 语义向量 1024 维
```

点亮后行为：
- **商品图/报价单上传**（批量智能上架）：`POST /api/ai/extract`（批发商鉴权）→ Qwen2.5-VL
  看图直读 → 回填 名称/货号/价格/MOQ → 行内显示「AI 已自动填写，可修改」，全程可手动改
- **搜索**：向量/embedding 函数就绪（BGE-M3），pgvector 语义检索在 Neon 按需启用
- **降级**：未配置 Key 时 `ENABLED=false`，界面照常手动填写/关键词搜索，无任何报错

费用：约 $0.05 / 百万 token 级；演示与日常使用消耗可忽略（注册通常赠送免费额度）。
