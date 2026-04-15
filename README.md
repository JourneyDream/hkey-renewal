# cert-monitor

监控 JSON 文件中 AI Key 的过期时间，自动续期并更新配置、重启 Docker。

## 安装

```bash
cd /root/cert-monitor
npm install
```

## 配置

编辑 `config.yaml`：

```yaml
json_path: "/path/to/credentials.json"     # 源 JSON 文件
check_interval: 600000                      # 轮询间隔(ms)，默认10分钟
warning_ms: 1800000                         # 快过期阈值(ms)，30分钟
key_path: "aikey"                           # JSON 中 key 的字段路径
renew:
  command: "/path/to/renew.sh"             # 续期脚本
  timeout: 120000
yaml_target:
  path: "/path/to/config.yaml"            # 目标 YAML
  key_path: "services.api.key"            # YAML 中 key 的路径
docker:
  container_name: "my-container"
  restart_timeout: 30
```

## 运行

```bash
# 前台持续轮询
node index.js

# 只检查一次（适合 crontab）
node index.js --once

# 指定自定义配置
node index.js --config /etc/cert-monitor.yaml

# 调试模式
LOG_LEVEL=debug node index.js --once
```

## JSON 格式

```json
{
  "aikey": "sk-xxxxx",
  "expired_at": "2026-04-12T18:30:00+08:00"
}
```

## 执行流程

1. 读取 JSON → 检查 `expired_at`
2. 未过期 → 跳过
3. 已过期 / 距离过期 ≤ 30分钟 → 执行续期脚本
4. 重新读取 JSON → 提取 `aikey`
5. 写入目标 YAML 对应字段
6. `docker restart` 指定容器
