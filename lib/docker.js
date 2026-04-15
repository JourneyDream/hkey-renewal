const { execSync } = require('child_process');
const log = require('./logger');

/**
 * 重启 Docker 容器
 * @param {string} containerName - 容器名
 * @param {number} timeout - 超时（秒）
 */
function restartContainer(containerName, timeout) {
  log.info(`重启 Docker 容器: ${containerName}`);
  try {
    const output = execSync(`docker restart ${containerName}`, {
      timeout: timeout * 1000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    log.info(`容器 ${containerName} 重启成功: ${output.trim()}`);
    return output.trim();
  } catch (err) {
    log.error(`容器重启失败: ${err.message}`);
    if (err.stderr) log.error('stderr:', err.stderr.toString());
    throw err;
  }
}

module.exports = { restartContainer };
