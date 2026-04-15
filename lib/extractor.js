const fs = require('fs');
const _ = require('lodash');
const log = require('./logger');

/**
 * 重新读取 JSON，提取 aikey
 * @param {string} jsonPath - JSON 文件路径
 * @param {string} keyPath - key 的路径
 * @returns {string} key 值
 */
function extractKey(jsonPath, keyPath) {
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`JSON 文件不存在: ${jsonPath}`);
  }

  const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const value = _.get(raw, keyPath);

  if (!value || typeof value !== 'string') {
    throw new Error(`未在路径 "${keyPath}" 找到有效的 key 值`);
  }

  log.info(`成功提取 key（长度: ${value.length}）`);
  return value;
}

module.exports = { extractKey };
