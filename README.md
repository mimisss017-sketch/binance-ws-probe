# binance-ws-probe

探测「当前部署出口 IP」能否连上币安合约 WebSocket（`fstream.binance.com`）。
用于筛选免费的 WS 中转容器平台（Galaxy / dcdeploy 等）。

## 接口

| 路径 | 作用 |
|---|---|
| `/probe` | 实测 3 轮 WS 握手 + 收首条 markPrice，返回 `REACHABLE` / `BLOCKED` |
| `/` `/health` | 平台健康检查用，不做探测 |

## 本地验证

```bash
npm install
npm start
# 浏览器打开 http://localhost:3000/probe
```

## 部署到 Galaxy（galaxycloud.app）

1. GitHub 新建仓库，把本目录推上去
2. Dashboard → Create New → Node.js → 连仓库
3. Plan 选 Sandbox（免费），**地区能选就选 eu-west-1（法国）**，选不了说明免费层锁美区
4. Install Command `npm install`，Start Command `npm start`，部署
5. 打开 `https://<app>.sandbox.galaxycloud.app/probe` 看结果

## 部署到 dcdeploy

1. 同一个仓库，Create Service → 连 GitHub
2. 免费版走 Buildpack 自动识别 Node.js，端口环境变量 `PORT=3000`
3. 打开 `https://<app>.dcdeploy.cloud/probe`

## 结果解读

- `verdict: REACHABLE` 且 `step: message` → 该出口能通合约 WS，**中转方案成立**，把 Worker `/ws/mark` 上游指向此服务即可
- `status: 403/451` → 被币安 WAF 拦，此平台此地区放弃
- 三轮全 `error`（超时/DNS）→ 网络层不通，放弃
