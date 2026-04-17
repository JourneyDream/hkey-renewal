const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const _ = require('lodash');
const log = require('./lib/logger');
const { checkExpiry } = require('./lib/checker');
const { renew } = require('./lib/renewer');
const { extractKey } = require('./lib/extractor');
const { writeKey, readKey } = require('./lib/yaml_writer');
const { restartContainer } = require('./lib/docker');

// ─── 加载配置 ───────────────────────────────────────────
function loadConfig() {
  const args = process.argv.slice(2);
  let configPath = path.join(__dirname, 'config.yaml');

  const configIdx = args.indexOf('--config');
  if (configIdx !== -1 && args[configIdx + 1]) {
    configPath = args[configIdx + 1];
  }

  if (!fs.existsSync(configPath)) {
    log.error(`配置文件不存在: ${configPath}`);
    process.exit(1);
  }

  const config = yaml.load(fs.readFileSync(configPath, 'utf-8'));
  log.info(`加载配置: ${configPath}`);
  return config;
}

// ─── 核心流程 ──────────────────────────────────────────
async function runOnce(config) {
  const { json_path, warning_ms, key_path, expiry_path, renew: renewCfg, yaml_target, docker: dockerCfg } = config;

  // 1. 判断两边的值是否一样
  const currentJsonKey = extractKey(json_path, key_path);
  const targetKeyValue = currentJsonKey;
  const currentYamlValue = readKey(yaml_target.path, yaml_target.key_path);

  if (currentYamlValue !== targetKeyValue) {
    // 1a. 不一样直接同步
    log.warn('检测到 JSON 中的 Key 与目标 YAML 不一致，优先执行同步...');
    const changed = writeKey(yaml_target.path, yaml_target.key_path, targetKeyValue);
    if (changed) {
      restartContainer(dockerCfg.container_name, dockerCfg.restart_timeout);
    }
    log.info('同步完成 ✅');
    return true;
  }

  // 2. 一样的情况下判断有效期是否要刷新
  const result = checkExpiry(json_path, key_path, warning_ms, expiry_path);

  if (result.status === 'valid') {
    log.info('Key 已同步且有效期正常，无需操作');
    return false;
  }

  // 3. 已过期或即将过期 → 执行续期流程
  log.warn(`Key 状态: ${result.status}，开始续期流程...`);

  // 当处于 warning 状态时，提前 1 小时改写 JSON 中的过期时间字段，强制触发硬续期
  if (result.status === 'warning') {
    const currentExpiry = result.expiredAt;
    const offsetMs = 3600000; // 1 小时
    const newExpiryDate = new Date(currentExpiry.getTime() - offsetMs);
    
    log.info(`[提前续期防护] 正在修改 JSON 的过期时间字段以触发强制续期...`);
    log.info(`原设定过期时间: ${currentExpiry.toISOString()} -> 提前为: ${newExpiryDate.toISOString()}`);
    
    const data = result.raw;
    _.set(data, expiry_path, newExpiryDate.toISOString());
    fs.writeFileSync(json_path, JSON.stringify(data, null, 2));
  }

  renew(renewCfg.command, renewCfg.timeout);

  // 4. 同步新的 key
  const newKey = extractKey(json_path, key_path);
  const changed = writeKey(yaml_target.path, yaml_target.key_path, newKey);

  if (changed) {
    restartContainer(dockerCfg.container_name, dockerCfg.restart_timeout);
  }

  log.info('续期流程完成 ✅');
  return true;
}

// ─── 入口 ──────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const onceMode = args.includes('--once');

  const config = loadConfig();

  if (onceMode) {
    log.info('单次检查模式');
    try {
      await runOnce(config);
    } catch (err) {
      log.error('执行失败:', err.message);
      process.exit(1);
    }
    return;
  }

  // 持续轮询模式
  const interval = config.check_interval || 600000;
  log.info(`启动轮询，间隔 ${interval / 1000} 秒`);

  // 先立即跑一次
  try {
    await runOnce(config);
  } catch (err) {
    log.error('初始检查失败:', err.message);
  }

  // 定时轮询
  setInterval(async () => {
    try {
      await runOnce(config);
    } catch (err) {
      log.error('轮询检查失败:', err.message);
    }
  }, interval);
}

main();
