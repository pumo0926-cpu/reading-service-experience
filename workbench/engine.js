(function (root) {
  function parseFields(text, type) {
    const fields = Object.create(null);
    for (const [index, raw] of text.split('\n').entries()) {
      const line = raw.trim();
      if (!line) continue;
      const separator = line.indexOf('=');
      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim();
      if (separator < 0 || !key || !value || Object.hasOwn(fields, key)) {
        throw new Error(type + '第 ' + (index + 1) + ' 行需要唯一且非空的「字段=值」。');
      }
      if (type === '用户属性' && ['场景', '触发事件'].includes(key)) {
        throw new Error('请在样本的独立字段中填写「' + key + '」。');
      }
      fields[key] = value;
    }
    return fields;
  }

  function evaluate(sample, rules) {
    if (!sample.scenario.trim() || !sample.message.trim()) {
      throw new Error('请填写场景名称和本轮用户消息。');
    }
    const context = parseFields(sample.attributes, '用户属性');
    context['场景'] = sample.scenario.trim();
    if (sample.trigger?.trim()) context['触发事件'] = sample.trigger.trim();
    const enabled = rules.filter((rule) => rule.enabled);
    const candidates = enabled.map((rule) => {
      const conditions = parseFields(rule.conditions, '「' + rule.name + '」的条件');
      const entries = Object.entries(conditions);
      if (!rule.name.trim() || !rule.instruction.trim() || !entries.length) {
        throw new Error('启用的规则需要名称、至少一项匹配条件和 AI 指令。');
      }
      return { rule, matches: entries.every(([key, value]) => context[key] === value) };
    });
    const matches = candidates.filter((candidate) => candidate.matches).map(({ rule }) => rule);
    const selected = matches[0];
    if (!selected) return { matches };

    const missing = new Set();
    const reply = selected.reply.replace(/\{\{([^{}]+)\}\}/g, (token, key) => {
      const value = context[key.trim()];
      if (value === undefined) missing.add(key.trim());
      return value ?? token;
    });
    return {
      matches,
      selected,
      request: { channel: 'wechat', instruction: selected.instruction, input: { context, message: sample.message } },
      reply: missing.size ? '' : reply,
      missing: [...missing]
    };
  }

  const engine = { evaluate };
  if (typeof module !== 'undefined') module.exports = engine;
  else root.serviceEngine = engine;
})(globalThis);
