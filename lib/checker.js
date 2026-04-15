const fs = require('fs');
const _ = require('lodash');
const log = require('./logger');

/**
 * 读取 JSON 文件，检查 expired_at 状态
 * @param {string} jsonPath - JSON 文件路径
 * @param {string} keyPath - aikey 在 JSON 中的路径
 * @param {number} warningMs - 快过期阈值（毫秒）
 * @param {string} [expiryPath] - 可选的 expired_at 在 JSON 中的路径
 * @returns {{ status: 'expired'|'warning'|'valid', expiredAt: Date, remainMs: number, raw: object }}
 */
function checkExpiry(jsonPath, keyPath, warningMs, expiryPath) {
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`JSON 文件不存在: ${jsonPath}`);
  }

  const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  
  // 确定 expired_at 的路径
  const effectiveExpiryPath = expiryPath || [...keyPath.split('.').slice(0, -1), 'expired_at'].join('.');
  
  // 获取过期时间字符串
  let expiredAtStr = _.get(raw, effectiveExpiryPath);
  if (!expiredAtStr && !expiryPath) {
    // 只有在未指定 expiryPath 时才进行顶级 fallback
    expiredAtStr = _.get(raw, 'expired_at');
  }

  if (!expiredAtStr) {
    const errorPath = expiryPath ? effectiveExpiryPath : `${effectiveExpiryPath} 或顶级 expired_at`;
    throw new Error(`JSON 中未找到过期时间字段（尝试路径: ${errorPath}）`);
  }

  const expiredAt = new Date(expiredAtStr);
  if (isNaN(expiredAt.getTime())) {
    throw new Error(`expired_at 格式无效: ${expiredAtStr}`);
  }

  const now = Date.now();
  const remainMs = expiredAt.getTime() - now;

  let status;
  if (remainMs <= 0) {
    status = 'expired';
    log.warn(`Key 已过期！过期时间: ${expiredAtStr}，已过期 ${formatDuration(-remainMs)}`);
  } else if (remainMs <= warningMs) {
    status = 'warning';
    log.warn(`Key 即将过期！过期时间: ${expiredAtStr}，剩余 ${formatDuration(remainMs)}`);
  } else {
    status = 'valid';
    log.info(`Key 有效，过期时间: ${expiredAtStr}，剩余 ${formatDuration(remainMs)}`);
  }

  return { status, expiredAt, remainMs, raw };
}

function formatDuration(ms) {
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}天`);
  if (hours > 0) parts.push(`${hours}小时`);
  if (mins > 0) parts.push(`${mins}分钟`);
  if (secs > 0 && days === 0) parts.push(`${secs}秒`);
  return parts.join('') || '0秒';
}

module.exports = { checkExpiry };
