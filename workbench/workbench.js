const get = (id) => document.getElementById(id);
const storageKey = 'reading-service-workbench-v1';
const blankSample = () => ({ scenario: '', trigger: '', attributes: '', message: '', pastReply: '', pastResult: '' });
const blankRule = () => ({ name: '', enabled: false, conditions: '', instruction: '', reply: '', expected: '' });
let state = { samples: [blankSample()], rules: [], active: 0 };

try {
  const saved = localStorage.getItem(storageKey);
  if (saved) state = JSON.parse(saved);
} catch {
  get('storage').textContent = '当前浏览器无法读取本地配置。';
}

function save() {
  get('results').hidden = true;
  get('status').textContent = '运行后查看当前配置的对比结果。';
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
    get('storage').textContent = '已保存到当前浏览器。请使用脱敏样本。';
  } catch {
    get('storage').textContent = '浏览器无法保存，当前编辑仅在此页有效。';
  }
}

function node(tag, label, className) {
  const element = document.createElement(tag);
  if (label) element.textContent = label;
  if (className) element.className = className;
  return element;
}

function button(label, callback) {
  const element = node('button', label, 'secondary');
  element.type = 'button';
  element.addEventListener('click', callback);
  return element;
}

function field(record, key, label, placeholder, multiline = false, onChange = save) {
  const wrapper = node('label', label, 'field');
  const input = node(multiline ? 'textarea' : 'input');
  if (multiline) input.rows = 2;
  input.placeholder = placeholder;
  input.value = record[key] ?? '';
  input.addEventListener('input', () => {
    record[key] = input.value;
    onChange();
  });
  wrapper.append(input);
  return wrapper;
}

function renderSamples() {
  get('samples').replaceChildren(...state.samples.map((sample, index) => {
    const item = button('样本 ' + (index + 1) + (sample.scenario ? ' · ' + sample.scenario : ''), () => {
      state.active = index;
      save();
      renderSamples();
      get('fields').querySelector('input').focus();
    });
    item.setAttribute('aria-pressed', String(index === state.active));
    return item;
  }));
  const sample = state.samples[state.active];
  get('fields').replaceChildren(
    field(sample, 'scenario', '场景名称', '输入待验证的场景名称', false, () => {
      const active = get('samples').children[state.active];
      active.textContent = '样本 ' + (state.active + 1) + (sample.scenario ? ' · ' + sample.scenario : '');
      save();
    }),
    field(sample, 'trigger', '触发事件', '选填，可用于控制规则何时生效'),
    field(sample, 'attributes', '用户属性', '每行一个字段=值', true),
    field(sample, 'message', '本轮用户消息', '录入用户在服务开始时发出的消息', true),
    field(sample, 'pastReply', '历史服务回复', '粘贴已脱敏的历史回复', true),
    field(sample, 'pastResult', '历史观察结果', '填写实际观察到的用户反馈或服务结果', true)
  );
}

function renderRules() {
  const rules = get('rules');
  if (!state.rules.length) {
    rules.replaceChildren(node('p', '新增规则后，可填写匹配条件、AI 指令和模拟回复。', 'hint'));
    return;
  }
  rules.replaceChildren(...state.rules.map((rule, index) => {
    const card = node('section', '', 'rule-card');
    const head = node('div', '', 'rule-head');
    const enabled = node('label', '启用规则', 'toggle');
    const checkbox = node('input');
    checkbox.type = 'checkbox';
    checkbox.checked = rule.enabled;
    checkbox.addEventListener('change', () => {
      rule.enabled = checkbox.checked;
      save();
    });
    enabled.prepend(checkbox);
    const up = button('上移', () => {
      state.rules.splice(index, 1);
      state.rules.splice(index - 1, 0, rule);
      save();
      renderRules();
    });
    up.disabled = index === 0;
    head.append(enabled, up);
    card.append(
      head,
      field(rule, 'name', '规则名称', '输入内部可识别的名称'),
      field(rule, 'conditions', '匹配条件', '每行一个字段=值，全部满足才命中', true),
      field(rule, 'instruction', 'AI 服务指令', '填写回复目标、可用信息和服务边界', true),
      field(rule, 'reply', '模拟回复模板', '用 {{字段}} 引用样本属性', true),
      field(rule, 'expected', '预期体验', '填写希望观察到的用户行动或服务结果')
    );
    return card;
  }));
}

get('add-rule').addEventListener('click', () => {
  state.rules.push(blankRule());
  save();
  renderRules();
  get('rules').lastElementChild.querySelector('input:not([type])').focus();
});

get('add-sample').addEventListener('click', () => {
  state.samples.push(blankSample());
  state.active = state.samples.length - 1;
  save();
  renderSamples();
  get('fields').querySelector('input').focus();
});

get('run').addEventListener('click', () => {
  const sample = state.samples[state.active];
  get('results').hidden = true;
  let result;
  try {
    result = serviceEngine.evaluate(sample, state.rules);
  } catch (error) {
    get('status').textContent = error.message;
    return;
  }
  get('question').textContent = sample.scenario + ' · ' + sample.message;
  get('past-reply').textContent = sample.pastReply || '待录入历史回复。';
  get('past-result').textContent = sample.pastResult ? '实际观察 · ' + sample.pastResult : '待录入观察结果。';
  get('new-reply').textContent = result.reply || (
    result.missing?.length ? '样本缺少字段：' + result.missing.join('、') :
    result.selected ? '已生成待接入的 AI 请求，当前规则尚无模拟回复。' : '当前样本未命中规则，等待 B 端补充配置。'
  );
  get('new-result').textContent = result.selected?.expected ? '预期体验 · ' + result.selected.expected : '待填写预期体验。';
  get('request').hidden = !result.selected;
  get('match').textContent = result.selected ? '采用 ' + result.selected.name + '。命中顺序 · ' + result.matches.map((rule) => rule.name).join('、') : '';
  get('payload').textContent = result.request ? JSON.stringify(result.request, null, 2) : '';
  get('status').textContent = result.selected ? '已生成本地模拟结果。' : '未命中已启用规则。';
  get('results').hidden = false;
});

renderRules();
renderSamples();
