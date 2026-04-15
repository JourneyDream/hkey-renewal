const fs = require('fs');
const yaml = require('js-yaml');
const log = require('./logger');

/**
 * 按路径设置嵌套值，支持数组条件匹配
 *
 * 支持的路径格式:
 *   "key"                              — 顶级字段
 *   "a.b.c"                            — 嵌套对象
 *   "arr[0].key"                       — 数组下标
 *   "arr[name=xxx].key"               — 数组条件匹配 (name 字段 == xxx)
 *   "arr[name=xxx].sub[n=yyy].key"    — 多级条件匹配
 *
 * @param {object} doc - YAML 解析后的对象
 * @param {string} path - 点号分隔的路径
 * @param {*} value - 要设置的值
 */
/**
 * 按路径设置嵌套值，支持数组条件匹配
 *
 * 支持的路径格式:
 *   "key"                              — 顶级字段
 *   "a.b.c"                            — 嵌套对象
 *   "arr[0].key"                       — 数组下标
 *   "arr[name=xxx].key"               — 数组条件匹配 (name 字段 == xxx)
 *   "arr[name=xxx].sub[n=yyy].key"    — 多级条件匹配
 *
 * @param {object} doc - YAML 解析后的对象
 * @param {string} path - 点号分隔的路径
 * @param {*} value - 要设置的值
 */
function setNestedValue(doc, path, value) {
  const segments = parsePath(path);
  let current = doc;

  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];

    if (seg.startsWith('[') && seg.endsWith(']')) {
      const condition = seg.slice(1, -1);
      if (!Array.isArray(current)) {
        throw new Error(`路径 "${seg}" 期望数组，实际是 ${typeof current}`);
      }

      if (/^\d+$/.test(condition)) {
        // 数字索引: [0]
        const index = parseInt(condition, 10);
        if (index < 0 || index >= current.length) {
          throw new Error(`数组索引 ${index} 越界 (长度: ${current.length})`);
        }
        current = current[index];
      } else {
        // 数组条件匹配: [name=xxx]
        const [condKey, condVal] = condition.split('=');
        const found = current.find(item => String(item[condKey]) === condVal);
        if (!found) {
          throw new Error(`未找到匹配 ${seg} 的数组元素`);
        }
        current = found;
      }
    } else {
      if (current[seg] === undefined) {
        current[seg] = {};
      }
      current = current[seg];
    }
  }

  // 最后一段
  const lastSeg = segments[segments.length - 1];
  if (lastSeg.startsWith('[') && lastSeg.endsWith(']')) {
    throw new Error(`路径最后一段不能是数组条件匹配: ${lastSeg}`);
  }
  current[lastSeg] = value;
}

/**
 * 按路径获取嵌套值
 * @param {object} doc 
 * @param {string} path 
 * @returns {*}
 */
function getNestedValue(doc, path) {
  try {
    const segments = parsePath(path);
    let current = doc;

    for (const seg of segments) {
      if (seg.startsWith('[') && seg.endsWith(']')) {
        const condition = seg.slice(1, -1);
        if (!Array.isArray(current)) return undefined;

        if (/^\d+$/.test(condition)) {
          // 数字索引: [0]
          const index = parseInt(condition, 10);
          current = current[index];
        } else {
          // 数组条件匹配: [name=xxx]
          const [condKey, condVal] = condition.split('=');
          const found = current.find(item => String(item[condKey]) === condVal);
          if (!found) return undefined;
          current = found;
        }
      } else {
        if (current === null || typeof current !== 'object' || !(seg in current)) {
          return undefined;
        }
        current = current[seg];
      }
    }
    return current;
  } catch (err) {
    return undefined;
  }
}

/**
 * 将路径字符串解析为段
 * @param {string} path 
 * @returns {string[]}
 */
function parsePath(path) {
  return path.split('.').flatMap(seg => {
    const bracketMatch = seg.match(/^(.+?)(\[.+\])$/);
    if (bracketMatch) return [bracketMatch[1], bracketMatch[2]];
    return [seg];
  });
}

/**
 * 将 key 写入目标 YAML 文件
 * @param {string} yamlPath - YAML 文件路径
 * @param {string} keyPath - YAML 中的字段路径
 * @param {string} keyValue - 要写入的 key 值
 * @returns {boolean} 是否实际上写入了新值（值有变化）
 */
function writeKey(yamlPath, keyPath, keyValue) {
  if (!fs.existsSync(yamlPath)) {
    throw new Error(`YAML 文件不存在: ${yamlPath}`);
  }

  const content = fs.readFileSync(yamlPath, 'utf-8');
  const doc = yaml.load(content);

  const oldValue = getNestedValue(doc, keyPath);
  if (oldValue === keyValue) {
    log.info(`Key 未发生变化，无需更新 YAML: ${yamlPath}`);
    return false;
  }

  setNestedValue(doc, keyPath, keyValue);

  const dumped = yaml.dump(doc, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
  });

  fs.writeFileSync(yamlPath, dumped, 'utf-8');
  log.info(`已将新 key 写入 YAML: ${yamlPath} -> ${keyPath}`);
  return true;
}

/**
 * 从 YAML 文件中读取指定路径的值
 * @param {string} yamlPath 
 * @param {string} keyPath 
 * @returns {*}
 */
function readKey(yamlPath, keyPath) {
  if (!fs.existsSync(yamlPath)) {
    return undefined;
  }
  const content = fs.readFileSync(yamlPath, 'utf-8');
  const doc = yaml.load(content);
  return getNestedValue(doc, keyPath);
}

module.exports = { writeKey, setNestedValue, getNestedValue, readKey };
