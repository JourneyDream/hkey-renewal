const { execSync } = require('child_process');
const log = require('./logger');

/**
 * 执行续期脚本
 * @param {string} command - shell 命令路径
 * @param {number} timeout - 超时（毫秒）
 * @returns {string} 命令输出
 */
function renew(command, timeout) {
  log.info(`执行续期命令: ${command}`);
  try {
    const output = execSync(command, {
      timeout: timeout,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    log.info('续期命令执行成功');
    if (output.trim()) {
      log.info('续期输出:\n' + output.trim());
    }
    return output;
  } catch (err) {
    log.error(`续期命令执行失败: ${err.message}`);
    if (err.stderr) log.error('stderr:', err.stderr.toString());
    throw err;
  }
}

module.exports = { renew };
