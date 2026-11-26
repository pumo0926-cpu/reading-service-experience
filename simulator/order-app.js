const get = (id) => document.getElementById(id);
const workflow = shipmentWorkflow;
const orderName = '阅读全年系统包';
const packageById = {
  first: {
    title: '首月教材包裹',
    books: workflow.order.books.map((book, index) => ({ ...book, image: ['idioms', 'writing'][index] }))
  },
  later: {
    title: '后续教材包裹',
    books: [{ title: '《漫话小古文》', edition: '', quantity: 1, image: 'poems' }]
  }
};
const states = {
  waiting: { title: '待发货', label: '首月教材待发货', description: '暂未生成运单。包裹清单为预计随包裹寄出的教材。' },
  shipped: { title: '已发货', label: '首月教材已发货', description: '包裹已由快递公司揽收。' },
  arrived: { title: '已到驿站', label: '首月教材已到驿站', description: '包裹在示例社区驿站，可以前往取件。' },
  signed: { title: '签收待核实', label: '物流显示已签收', description: '如果您还没有拿到包裹，可以发起核对。' }
};
const shipment = workflow.exampleEvent('shipped');
const station = workflow.exampleEvent('arrived').station;
const screens = { success: '支付结果', guide: '阅读小管家', profile: '我的', orders: '订单列表', details: '订单详情', logistics: '物流详情', chat: '阅读小管家' };
const logisticsChatLabel = '问问物流';
const wechatScenes = {
  firstContact: { title: '场景二｜指导师首联', entry: 'start-first-contact', page: 'shipment.html' },
  askTeacher: { title: '场景三｜直接问指导师', entry: 'start-ask-teacher', page: 'shipment-help.html' },
  changeAddress: { title: '场景四｜微信修改收货地址', entry: 'start-change-address', page: 'shipment-address.html' }
};
const sceneFrames = new Map();
const readingPreviews = [
  {
    question: '孩子如果不愿意读怎么办？',
    prompt: '孩子不肯翻书，或者读了两页就想停，你可以从哪里开始？'
  },
  {
    question: '怎么观测孩子阅读能力提升？',
    prompt: '除了读了多少本书，平时还可以看孩子哪些变化？'
  },
  {
    question: '用的过程中遇到问题应该找谁？',
    prompt: '孩子在使用阅读课程时，有操作或学习上的问题，可以找谁帮忙？'
  }
];
const guideVariants = {
  questions: { label: '方案一 · 问阅读问题', render: renderReadingPreview },
  books: { label: '方案二 · 学实体书用法', render: renderBookGuide },
  'reading-plan': { label: '方案三 · 做首月阅读规划', render: renderReadingPlan }
};
const firstMonthQuestions = [
  '首月教材什么时候发货？',
  '首月包裹里有哪些书？',
  '多久一寄、分几批寄？',
  '包裹到哪了，什么时候能收到？',
  '包裹到了去哪里取？',
  '包裹没收到，或者少了书怎么办？'
];

let status = 'waiting';
let orderFilter = 'all';
let route = { screen: 'success', parcel: 'first' };
let history = [];
let subscription = workflow.createState();
let logisticsDemoResult = '';
let messages = [];
let feedback = [];
let connection = null;
let guideVariant = 'questions';
let previewIndex = 0;
const prefersReducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
let previewPaused = prefersReducedMotion;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function button(text, run, variant = 'secondary') {
  const control = element('button', text, variant);
  control.type = 'button';
  control.addEventListener('click', run);
  return control;
}

function actions(...controls) {
  const row = element('div', '', 'action-row');
  row.append(...controls);
  return row;
}

function card(title) {
  const panel = element('section', '', 'card');
  if (title) panel.append(element('h3', title));
  return panel;
}

function openScreen(screen, parcel = 'first') {
  history.push(route);
  route = { screen, parcel };
  if (screen === 'chat') messages = [];
  render(true);
}

function coverPath(book) {
  return 'assets/cover-' + book.image + '.webp';
}

function cover(book) {
  const image = element('img');
  image.src = coverPath(book);
  image.alt = book.title + book.edition + '的演示封面';
  return image;
}

function showDialog(title, ...children) {
  get('dialog-title').textContent = title;
  get('dialog-body').replaceChildren(...children);
  if (!get('dialog').open) get('dialog').showModal();
}

function showCover(book) {
  showDialog(book.title + book.edition, cover(book), element('p', '演示封面 · ' + book.quantity + ' 本', 'subtle'));
}

function infoFor(parcel) {
  return parcel === 'first' ? states[status] :
    { title: '后续待发', label: '后续教材尚未寄出', description: '这批教材不在首月教材包裹内，暂未生成运单。' };
}

function hasTracking(parcel) {
  return parcel === 'first' && status !== 'waiting';
}

function itemContext(parcel) {
  return packageById[parcel].books.map((book) => book.title + book.edition + ' × ' + book.quantity).join('、');
}

function bookList(parcel, canReport) {
  const list = element('ul', '', 'books');
  for (const book of packageById[parcel].books) {
    const row = element('li');
    const zoom = button('', () => showCover(book), 'cover-button');
    zoom.setAttribute('aria-label', '放大' + book.title + book.edition + '的演示封面');
    zoom.append(cover(book));
    const text = element('div');
    text.append(element('strong', book.title + book.edition), element('p', book.quantity + ' 本 · 演示封面'));
    if (canReport) {
      const prior = feedback.find((entry) => entry.parcel === parcel && entry.book === book.title);
      text.append(prior ? button('查看缺件反馈', () => showReceipt(prior), 'plain') :
        button('这本没收到', () => report(parcel, book), 'plain'));
    }
    row.append(zoom, text);
    list.append(row);
  }
  return list;
}

function renderPackage(parcel) {
  const box = element('section', '', 'package');
  const heading = element('div', '', 'card-heading');
  const info = infoFor(parcel);
  heading.append(element('h4', packageById[parcel].title), element('span', info.title, 'status'));
  const count = packageById[parcel].books.reduce((total, book) => total + book.quantity, 0);
  const bookLabel = hasTracking(parcel) ? '本包裹共 ' : '预计随包裹寄出 ';
  box.append(heading);
  if (hasTracking(parcel)) box.append(element('p', shipment.carrier + ' · ' + shipment.tracking, 'subtle'));
  if (parcel === 'first' && status === 'arrived') box.append(element('p', station + ' · 待取件', 'subtle'));
  box.append(element('p', bookLabel + count + ' 本', 'subtle'),
    bookList(parcel, parcel === 'first' && status === 'signed'));
  const controls = [
    button('查看物流', () => openScreen('logistics', parcel)),
    button(logisticsChatLabel, () => openScreen('chat', parcel))
  ];
  if (parcel === 'first' && status === 'signed') {
    const prior = feedback.find((entry) => entry.parcel === parcel && !entry.book);
    controls.push(prior ? button('查看包裹反馈', () => showReceipt(prior)) :
      button('我没收到', () => openFeedback(parcel)));
  }
  box.append(actions(...controls));
  return box;
}

function renderSuccess() {
  const summary = element('section', '', 'hero');
  summary.append(element('h3', '支付成功'), element('p', orderName));
  let guide;
  if (connection) {
    guide = card('指导师已添加（演示）');
    guide.classList.add('enrollment-guide');
    if (connection.topic === 'books' || connection.topic === 'reading-plan') {
      guide.append(button('查看咨询接续', () => openScreen('guide'), 'primary'));
    } else {
      guide.append(element('p', '本次咨询：' + connection.question, 'subtle'));
    }
  } else {
    guide = guideVariants[guideVariant].render();
  }

  return [summary, guide];
}

function assistantArt(className) {
  const image = element('img', '', className);
  image.src = 'assets/reading-assistant.webp';
  image.alt = '';
  return image;
}

function renderReadingPreview() {
  const guide = card('问问阅读小管家');
  guide.classList.add('reading-preview');
  const conversation = element('div', '', 'preview-frame');
  const message = element('div', '', 'preview-dialogue');
  const text = element('p');
  text.id = 'reading-preview-message';
  message.append(assistantArt('reading-avatar'), text);
  const prompt = button('', () => addInstructor('reading', readingPreviews[previewIndex].question), 'preview-prompt');
  prompt.setAttribute('aria-haspopup', 'dialog');
  const promptLabel = element('span');
  promptLabel.id = 'reading-preview-prompt';
  const send = element('span', '↑', 'preview-send');
  send.setAttribute('aria-hidden', 'true');
  prompt.append(promptLabel, send);
  conversation.append(message, prompt);

  const controls = element('div', '', 'preview-controls');
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', '阅读对话轮播');
  for (const [index, slide] of readingPreviews.entries()) {
    const dot = button('', () => {
      previewIndex = index;
      previewPaused = true;
      updateReadingPreview();
    }, 'preview-dot');
    dot.id = 'reading-slide-' + index;
    dot.setAttribute('aria-label', '预览：' + slide.question);
    controls.append(dot);
  }
  const pause = button('', () => {
    previewPaused = !previewPaused;
    updateReadingPreview();
  }, 'plain preview-pause');
  pause.id = 'reading-preview-pause';
  controls.append(pause);

  const questions = element('div', '', 'action-row preview-questions');
  questions.setAttribute('role', 'group');
  questions.setAttribute('aria-label', '选择一个阅读问题');
  for (const { question } of readingPreviews) {
    const choice = button(question, () => addInstructor('reading', question), 'chip');
    choice.setAttribute('aria-haspopup', 'dialog');
    questions.append(choice);
  }
  guide.append(conversation, controls, questions);
  return guide;
}

function updateReadingPreview() {
  const text = get('reading-preview-message');
  if (!text) return;
  const slide = readingPreviews[previewIndex];
  text.textContent = slide.prompt;
  const prompt = get('reading-preview-prompt');
  prompt.textContent = slide.question;
  prompt.parentElement?.setAttribute('aria-label', '加企微咨询：' + slide.question);
  get('reading-preview-pause').textContent = previewPaused ? '播放轮播' : '暂停轮播';
  readingPreviews.forEach((_, index) => {
    get('reading-slide-' + index).setAttribute('aria-pressed', String(index === previewIndex));
  });
}

function renderBookGuide() {
  const guide = card();
  guide.classList.add('book-guide');
  const text = element('div');
  const questions = element('ul', '', 'book-guide-questions');
  for (const question of ['是学前用还是学后用？', '书必须用吗？', '孩子不喜欢用怎么办？']) {
    questions.append(element('li', question));
  }
  text.append(element('h3', '还不知道书收到后该怎么用？'),
    questions,
    button('加企微查看', () => addInstructor('books'), 'primary'));
  const portrait = element('img', '', 'book-guide-art');
  portrait.src = 'assets/reading-book-guide.png';
  portrait.alt = '阅读管家';
  guide.append(text, portrait);
  return guide;
}

function renderReadingPlan() {
  const guide = card('首月先帮孩子养成阅读习惯');
  guide.classList.add('enrollment-guide');
  const checklist = element('ol', '', 'reading-plan-checklist');
  for (const item of ['固定一个时间', '读后观察引导', '中断怎么办']) {
    checklist.append(element('li', item));
  }
  guide.append(checklist,
    actions(button('找指导师做首月阅读规划', () => addInstructor('reading-plan', '首月阅读规划'), 'primary')));
  return guide;
}

function addInstructor(topic, question = '') {
  const qr = element('img', '', 'teacher-qr');
  qr.src = 'assets/teacher-demo-qr.png';
  qr.alt = '阅读指导师添加演练二维码';
  const guidance = {
    books: '用微信扫码，向指导师了解什么时候用书、是否必须用，以及孩子不喜欢用时怎么办。',
    'reading-plan': '用微信扫码，和指导师一起定阅读时间、聊读后怎么引导，以及中断后怎么接着读。'
  };
  showDialog('企业微信 · 添加指导师',
    element('p', guidance[topic] ?? '用微信扫码，向指导师咨询您选中的问题。'),
    qr,
    ...(question ? [element('p', '咨询主题：' + question, 'subtle')] : []),
    element('p', '演示二维码，仅包含说明文字。', 'subtle'),
    button('模拟添加完成', () => {
      connection = { topic, question };
      get('dialog').close();
      if (topic === 'books' || topic === 'reading-plan') openScreen('guide');
      else render(true);
      get('announcement').textContent = '已完成添加指导师演练。';
    }, 'primary'));
}

function renderGuide() {
  const guide = card('微信接续（演示）');
  guide.classList.add('enrollment-guide');
  const bubble = element('div', '', 'message');
  bubble.append(element('span', '阅读指导师 · 模拟接续'),
    element('p', connection?.topic === 'reading-plan' ?
      '您好，我是阅读指导师扶摇。咱们一起定个首月阅读计划吧。您想先聊哪一件？每天什么时候读、读完怎么跟孩子聊，还是中断后怎么接着读？' :
      '您好，我是阅读指导师。您想先了解什么时候用书、书是不是必须用，还是孩子不喜欢用时怎么做？'));
  guide.append(bubble);
  return [guide];
}

function renderProfile() {
  const preview = (title, text = '此入口为原型演示。') => showDialog(title, element('p', text));
  const tile = (label, icon, run, style = 'profile-tile', caption = '') => {
    const control = button('', run, style);
    const visual = element('span', icon, 'profile-icon');
    visual.setAttribute('aria-hidden', 'true');
    control.append(visual, element('strong', label));
    if (caption) control.append(element('span', caption, 'subtle'));
    return control;
  };
  const shortcuts = element('div', '', 'profile-highlights');
  for (const [label, icon] of [['全部计划', '📘'], ['我的作品', '▶'], ['成长豆', '●']]) {
    shortcuts.append(tile(label, icon, () => preview(label), 'profile-highlight'));
  }

  const services = card();
  const grid = element('div', '', 'profile-services');
  const openOrders = () => {
    orderFilter = 'all';
    openScreen('orders');
  };
  const showSupport = () => preview('客服中心', '4006867000\n周一至周日 09:00～22:00');
  const serviceEntries = [
    ['全部订单', '▤', openOrders],
    ['物流', '🚚', () => openScreen('logistics')],
    ['售后', '↶', () => preview('售后')],
    ['内容兑换', '⇆', () => preview('内容兑换')],
    ['客服中心', '☏', showSupport],
    ['计划调整', '◷', () => preview('计划调整')],
    ['我要投诉', '⚠', () => preview('我要投诉')],
    ['开发票', '▧', openInvoice]
  ];
  grid.append(...serviceEntries.map(([label, icon, run]) => tile(label, icon, run)));
  services.append(grid);

  const shop = card();
  const shopHeading = element('div', '', 'profile-shop-heading');
  shopHeading.append(element('h3', '积分商城'), element('span', '邀好友 赚积分', 'subtle'),
    button('⭐ 0 ›', () => preview('积分商城', '当前积分 0'), 'plain profile-points'));
  const products = element('div', '', 'profile-products');
  for (const [name, icon] of [['口算机（基础…', '🧮'], ['绿豆背包', '🎒'], ['叫叫儿童保温杯', '🧃'], ['叫叫…', '🎁']]) {
    products.append(tile(name, icon, () => preview(name), 'profile-product'));
  }
  shop.append(shopHeading, products);

  const rewards = element('div', '', 'profile-rewards');
  rewards.append(
    tile('分享领积分', '🏅', () => preview('分享领积分', '周周分享领积分，每周最高 1000 积分。'),
      'profile-reward profile-share', '周周分享领积分 · 每周最高1000 ⭐'),
    tile('推荐有礼', '🎁', () => preview('推荐有礼', '可选 10000 积分，推荐朋友，双方都得百元礼。'),
      'profile-reward', '可选10000 ⭐ · 推荐朋友 双方都得百元礼'),
    tile('好友卡', '🎫', () => preview('好友卡', '送好友互动内容和伴读材料，可得 10000 积分。'),
      'profile-reward', '+10000 ⭐ · 送好友互动内容+伴材')
  );

  const support = button('', showSupport, 'plain profile-support');
  support.append(element('span', '☎ 4006867000'), element('span', '周一至周日 09:00～22:00'));
  const tabs = element('nav', '', 'profile-tabs');
  tabs.setAttribute('aria-label', 'App 页面');
  tabs.append(tile('广场', '⌂', () => preview('广场')), tile('学习', '▣', () => preview('学习')));
  const current = element('span', '', 'profile-current-tab');
  current.setAttribute('aria-current', 'page');
  current.append(element('span', '☺', 'profile-icon'), element('strong', '我的'));
  tabs.append(current);
  return [shortcuts, services, shop, rewards, support, tabs];
}

function openInvoice() {
  showDialog('开发票', element('p', orderName + ' · 订单 ' + workflow.order.id),
    element('p', '发票服务入口演示。', 'subtle'));
}

function renderOrders() {
  const filters = element('div', '', 'order-filters');
  filters.setAttribute('role', 'group');
  filters.setAttribute('aria-label', '按订单状态筛选');
  for (const [key, label] of [['all', '全部'], ['unpaid', '待付款'], ['waiting', '待发货'], ['shipped', '已发货']]) {
    const filter = button(label, () => {
      orderFilter = key;
      render();
      get('order-filter-' + key).focus();
    }, 'order-filter');
    filter.id = 'order-filter-' + key;
    filter.setAttribute('aria-pressed', String(orderFilter === key));
    filters.append(filter);
  }
  const fulfillment = status === 'waiting' ? 'waiting' : 'shipped';
  if (orderFilter !== 'all' && orderFilter !== fulfillment) {
    const empty = card();
    empty.append(element('p', '暂无此状态的订单', 'subtle'));
    return [filters, empty];
  }

  const main = card();
  main.classList.add('order-card');
  main.append(element('p', states[status].title, 'order-card-state'));
  const order = button('', () => openScreen('details'), 'order-entry');
  const price = element('span', '', 'order-line-price');
  price.append(element('span', '¥ 1980'), element('span', '×1', 'subtle'));
  order.append(assistantArt('order-entry-image'), element('strong', orderName + '-7阶'), price);

  const total = element('div', '', 'order-card-total');
  total.append(element('span', '退款中', 'order-refund'), element('strong', '共计：¥ 1980'));
  const more = () => showDialog('订单操作',
    button('修改地址', () => openAddressHelp('first')),
    button('开发票', openInvoice),
    button('查看物流', () => { get('dialog').close(); openScreen('logistics'); }));
  const controls = actions(button('更多', more, 'plain'),
    button('订单详情', () => openScreen('details')),
    button(logisticsChatLabel, () => openScreen('chat'), 'primary'));
  controls.classList.add('order-card-actions');
  main.append(order, total, controls);
  if (orderFilter !== 'all') return [filters, main];

  const virtualOrders = Array.from({ length: 2 }, () => {
    const virtual = card();
    virtual.classList.add('order-card');
    const line = element('div', '', 'order-entry');
    const icon = element('span', '⭐', 'virtual-order-image');
    icon.setAttribute('aria-hidden', 'true');
    const credits = element('span', '', 'order-line-price');
    credits.append(element('span', '🟠 25'), element('span', '×1', 'subtle'));
    line.append(icon, element('strong', '复活道具'), credits);
    virtual.append(element('p', '交易完成', 'order-card-state subtle'), line,
      element('p', '共计：🟠 25', 'order-card-total'));
    return virtual;
  });
  return [filters, main, ...virtualOrders];
}

function renderDetails() {
  const summary = element('section', '', 'hero');
  summary.append(element('h3', states[status].title),
    element('p', orderName + ' · 有后续教材待发'));
  const logistics = card('物流与包裹');
  logistics.append(renderPackage('first'), renderPackage('later'));
  const follow = card('物流提醒');
  const active = subscription.authorized.length > 0;
  const reminderActions = actions(button(active ? '修改订阅' : '一键订阅', subscribe));
  if (active || subscription.notices.length) {
    const preview = element('a', '查看微信提醒演示', 'plain wechat-preview');
    preview.href = wechatPreviewUrl();
    reminderActions.append(preview);
  }
  follow.append(element('p', active ? '已选择 ' + subscription.authorized.length + ' 项模拟提醒。' :
    '包裹发货、到站或待取件时，小程序会及时提醒您。', 'subtle'),
    reminderActions);
  const goods = card('订单商品');
  goods.append(element('p', orderName + ' × 1'), element('p', '订单 ' + workflow.order.id, 'subtle'));
  return [summary, logistics, follow, goods];
}

function renderLogistics(parcel) {
  const summary = card(packageById[parcel].title);
  const info = infoFor(parcel);
  summary.append(element('p', info.label), element('p', info.description, 'subtle'));
  if (hasTracking(parcel)) {
    summary.append(element('p', shipment.carrier + ' · ' + shipment.tracking, 'subtle'),
      actions(button('复制运单号', copyTracking)));
  }
  const steps = [info.title, ...(parcel === 'first' && ['arrived', 'signed'].includes(status) ? ['快递已揽收'] : []), '订单支付成功'];
  const timeline = element('ol', '', 'timeline');
  timeline.append(...steps.map((step) => element('li', step)));
  summary.append(timeline, actions(button(logisticsChatLabel, () => openScreen('chat', parcel), 'primary')));
  if (parcel === 'first' && status === 'signed') summary.append(actions(button('我没收到', () => openFeedback(parcel))));
  return [summary];
}

function knownInfo(parcel) {
  const info = infoFor(parcel);
  return info.label + '。' + info.description +
    (hasTracking(parcel) ? '\n' + shipment.carrier + ' · ' + shipment.tracking : '');
}

function addressChangeHelp(parcel) {
  if (parcel === 'first' && status === 'signed') {
    return '这个包裹已显示签收。若要修改以后寄送的地址，请切换到「后续教材包裹」联系阅读指导师核实。';
  }
  if (hasTracking(parcel)) {
    return '这个包裹已经发出。您可以带上订单号和运单号联系阅读指导师，请老师帮您确认还能不能改派。';
  }
  return '这个包裹还没发出。您可以报订单号 ' + workflow.order.id +
    ' 联系阅读指导师，请老师帮您核实能否在发货前修改收货地址。';
}

function answer(parcel, question) {
  if (/(改|更新|换).*地址|地址.*(改|更新|换)/.test(question)) {
    return addressChangeHelp(parcel);
  }
  if (/多久一寄|(多久|多长时间|几个月).*寄一次|分几批|几批寄/.test(question)) {
    return workflow.order.shippingSchedule + '每批的发货时间和包裹进度，可以在订单里查看。';
  }
  if (/(后面|后边|后续|下一批|下个月).*(多久|什么时候|哪天).*(发|寄)/.test(question)) {
    return '后续教材还没寄出，预计发货日期待确认。寄出后，您可以在订单详情的「后续教材包裹」里查看运单。';
  }
  if (/少.?书|少.?本|没收到|没有收到|缺件|寄错/.test(question)) {
    if (parcel === 'first' && status === 'signed') {
      return '请对照首月包裹清单：' + itemContext(parcel) +
        '。点下方「核对包裹或缺件」，可以反馈漏发的书或整个未收到的包裹。';
    }
    return knownInfo(parcel) + (parcel === 'first' ? '\n签收后如有缺件，可在订单详情核对教材清单并反馈。' : '');
  }
  if (/哪些|什么书|有什么|哪几本|包含|清单|几本/.test(question)) {
    return (hasTracking(parcel) ? '这次包裹里有' : '预计随包裹寄出') + ' ' + itemContext(parcel) + '。';
  }
  if (/什么时候.*发货|哪天发货/.test(question)) {
    if (!hasTracking(parcel)) return infoFor(parcel).label + '，预计发货时间待确认。发货后可在订单里查看运单。';
    return knownInfo(parcel);
  }
  if (/什么时候.*(收到|能到)|预计.*到达/.test(question)) {
    if (parcel === 'first' && ['arrived', 'signed'].includes(status)) return knownInfo(parcel);
    return knownInfo(parcel) + '\n预计送达时间待确认。';
  }
  if (/哪里取|去哪.*取/.test(question)) {
    if (parcel === 'first' && ['arrived', 'signed'].includes(status)) return knownInfo(parcel);
    return infoFor(parcel).label + '，取件地点待确认。到站后可在物流详情查看驿站。';
  }
  if (/取件|驿站|单号|物流|到哪|发了|发货|多久|到货/.test(question)) return knownInfo(parcel);
  return '我已带入这笔订单和包裹。当前能确认的是：' + knownInfo(parcel);
}

function ask(question) {
  const text = question.trim();
  if (!text) return;
  messages.push(['家长', text], ['物流助手 · 演示', answer(route.parcel, text)]);
  render();
  get('latest-reply')?.focus();
}

function openAddressHelp(parcel) {
  showDialog('修改收货地址',
    element('p', packageById[parcel].title + ' · 订单 ' + workflow.order.id, 'subtle'),
    element('p', addressChangeHelp(parcel)),
    ...(!connection && !(parcel === 'first' && status === 'signed') ?
      [button('加指导师协助', () => addInstructor('logistics', packageById[parcel].title + '修改收货地址'), 'primary')] : []));
}

function renderChatShortcuts(parcel) {
  const addTeacher = () => {
    if (connection) {
      showDialog('已添加指导师', element('p', '您可以在企业微信联系指导师，报上订单号 ' + workflow.order.id + '。'));
      return;
    }
    addInstructor('logistics', packageById[parcel].title + '物流咨询');
  };
  return [['加指导师', '👤', addTeacher], ['改地址', '📍', () => openAddressHelp(parcel)]].map(([label, symbol, open]) => {
    const control = button('', open, 'chat-shortcut');
    control.setAttribute('aria-haspopup', 'dialog');
    const icon = element('span', symbol, 'chat-shortcut-icon');
    icon.setAttribute('aria-hidden', 'true');
    control.append(icon, element('span', label));
    return control;
  });
}

function renderChat(parcel) {
  const context = card(packageById[parcel].title);
  context.append(element('p', '已关联订单 ' + workflow.order.id, 'subtle'));
  const packageSwitch = actions(...Object.entries(packageById).map(([id, item]) => {
    const option = button(item.title, () => {
      if (id === route.parcel) return;
      openScreen('chat', id);
    }, 'chip');
    option.setAttribute('aria-pressed', String(id === parcel));
    return option;
  }));
  packageSwitch.setAttribute('role', 'group');
  packageSwitch.setAttribute('aria-label', '切换咨询包裹');
  context.append(packageSwitch);
  const conversation = card();
  const log = element('div', '', 'messages');
  log.setAttribute('role', 'log');
  const opening = knownInfo(parcel) + '\n' + (hasTracking(parcel) ? '本包裹：' : '预计随包裹寄出：') + itemContext(parcel);
  for (const [index, [speaker, text]] of [['物流助手 · 演示', opening], ...messages].entries()) {
    const bubble = element('div', '', 'message' + (speaker === '家长' ? ' parent' : ''));
    bubble.append(element('span', speaker), element('p', text));
    if (messages.length && index === messages.length) {
      bubble.id = 'latest-reply';
      bubble.tabIndex = -1;
    }
    log.append(bubble);
  }
  conversation.append(log);
  if (parcel === 'later') {
    conversation.append(actions(...['书发货了吗', '这次会寄哪些书', '修改地址怎么办？', '后面的书多久发？'].map((prompt) =>
      button(prompt, () => ask(prompt), 'chip'))));
  }
  if (parcel === 'first' && status === 'signed') conversation.append(actions(button('核对包裹或缺件', () => report(parcel), 'plain')));
  const form = element('form', '', 'ask-form');
  const input = element('input');
  input.required = true;
  input.maxLength = 200;
  input.placeholder = logisticsChatLabel;
  input.setAttribute('aria-label', input.placeholder);
  const submit = element('button', '发送', 'primary');
  submit.type = 'submit';
  form.append(input, submit);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    ask(input.value);
  });
  conversation.append(form);
  if (parcel === 'later') return [context, conversation];

  const questions = card('首月常见问题');
  const list = element('ul', '', 'quick-questions');
  for (const question of firstMonthQuestions) {
    const item = element('li');
    item.append(button(question, () => ask(question), 'chip'));
    list.append(item);
  }
  questions.append(list);
  return [questions, context, conversation];
}

async function copyTracking() {
  try {
    await navigator.clipboard.writeText(shipment.tracking);
    get('announcement').textContent = '已复制示例运单号。';
  } catch {
    showDialog('运单号', element('p', shipment.tracking), element('p', '可选中上面的运单号手动复制。', 'subtle'));
  }
}

function report(parcel, book) {
  if (!book) {
    showDialog('核对包裹或缺件', element('p', '请选择没有收到的教材。'),
      bookList(parcel, true), button('整个包裹没收到', () => openFeedback(parcel), 'plain'));
    return;
  }
  openFeedback(parcel, book);
}

function showReceipt(record) {
  showDialog('反馈已在本页生成', element('p', record.context),
    ...(record.note ? [element('p', '补充说明：' + record.note)] : []),
    element('p', '本次演练编号 DEMO-' + record.id + ' · 无真实提交', 'subtle'));
}

function openFeedback(parcel, book) {
  const previous = feedback.find((entry) => entry.parcel === parcel && entry.book === book?.title);
  if (previous) {
    showReceipt(previous);
    return;
  }
  const subject = book ? book.title + book.edition : '整个包裹';
  const context = '订单 ' + workflow.order.id + '\n' + packageById[parcel].title + ' · ' + subject +
    (hasTracking(parcel) ? '\n' + shipment.carrier + ' · ' + shipment.tracking : '');
  const label = element('label', '补充说明（选填）');
  const input = element('textarea');
  input.maxLength = 300;
  input.rows = 3;
  label.append(input);
  const submit = button('保存模拟反馈', () => {
    const record = { id: feedback.length + 1, parcel, book: book?.title, context, note: input.value.trim() };
    feedback.push(record);
    showReceipt(record);
    render();
  }, 'primary');
  showDialog(book ? '反馈教材缺件' : '反馈未收到包裹', element('p', context), label, submit);
}

function wechatPreviewUrl() {
  const query = new URLSearchParams(subscription.authorized.map((topic) => ['topic', topic]));
  for (const { type } of subscription.notices) query.append('notice', type);
  if (!query.size && !subscription.phase && status !== 'signed') return 'shipment.html';
  query.set('phase', String(subscription.phase));
  if (status === 'signed') query.set('result', 'signed');
  return 'shipment.html?' + query;
}

function renderWechatNotices() {
  get('logistics-demo-result').textContent = logisticsDemoResult;
  const notices = get('wechat-notices');
  notices.hidden = !subscription.notices.length;
  notices.replaceChildren(...subscription.notices.map((notice) => {
    const message = element('article', '', 'wechat-notice');
    message.append(element('strong', notice.title), element('span', '阅读指导师 · 模拟微信'), element('p', notice.body));
    return message;
  }));
}

function simulateLogistics(key) {
  if (key === 'waiting') {
    status = key;
    subscription = workflow.subscribe(workflow.createState(), subscription.authorized);
    logisticsDemoResult = '已回到待发货，剩余订阅仍可用于后续提醒。';
    return;
  }
  if ((key === 'arrived' || key === 'signed') && subscription.phase === 0) {
    // 跳到后续样本时补齐揽件状态，不补发之前的提醒。
    const preceding = workflow.ingest({ ...subscription, authorized: [] }, workflow.exampleEvent('shipped'));
    subscription = { ...preceding, authorized: subscription.authorized, log: subscription.log };
  }
  if (key === 'signed') {
    status = key;
    logisticsDemoResult = '签收待核实，暂停取件提醒。';
    return;
  }
  if (key === 'reminder' && status === 'signed') {
    logisticsDemoResult = '签收待核实，未发送取件提醒。';
    return;
  }
  if (key !== 'reminder' && subscription.phase >= workflow.events[key].phase) {
    logisticsDemoResult = '已处理该物流节点，未重复发送提醒。';
    return;
  }
  subscription = workflow.ingest(subscription, workflow.exampleEvent(key));
  const { title, result, reason } = subscription.log[subscription.log.length - 1];
  if (key !== 'reminder' && result !== '已拦截') status = key;
  logisticsDemoResult = title + ' · ' + result + '。' + reason;
}

function subscribe() {
  const controls = workflow.topics.map((topic) => {
    const label = element('label', '', 'subscribe-option');
    const input = element('input');
    input.type = 'checkbox';
    input.value = topic;
    input.checked = subscription.authorized.includes(topic);
    label.append(input, element('span', workflow.events[topic].title));
    return { label, input };
  });
  showDialog('订阅小程序物流提醒', element('p', '选择希望收到的通知。此处为本地演练。'),
    ...controls.map((entry) => entry.label),
    button('确认选择', () => {
      subscription = workflow.subscribe({ ...subscription, authorized: [] },
        controls.filter(({ input }) => input.checked).map(({ input }) => input.value));
      logisticsDemoResult = subscription.authorized.length ?
        '已模拟订阅，可触发后续物流提醒。' : '当前无可用的模拟订阅。';
      get('dialog').close();
      render();
    }, 'primary'));
}

const draw = {
  success: renderSuccess, guide: renderGuide, profile: renderProfile, orders: renderOrders, details: renderDetails,
  logistics: renderLogistics, chat: renderChat
};

function renderScenarioPreview(scene) {
  const preview = get('scenario-preview');
  preview.hidden = !scene;
  if (scene && !sceneFrames.has(scene)) {
    const frame = element('iframe', '', 'scenario-frame');
    frame.title = scene.title;
    frame.src = scene.page + '?embed=1';
    sceneFrames.set(scene, frame);
    preview.append(frame);
  }
  for (const [key, entry] of Object.entries(wechatScenes)) {
    const control = get(entry.entry);
    if (route.screen === key) control.setAttribute('aria-current', 'true');
    else control.removeAttribute('aria-current');
    const frame = sceneFrames.get(entry);
    if (frame) frame.hidden = entry !== scene;
  }
}

function render(moveFocus = false) {
  const scene = wechatScenes[route.screen];
  get('screen-title').textContent = scene?.title ?? screens[route.screen];
  if (route.screen === 'profile') get('profile-entry').setAttribute('aria-current', 'page');
  else get('profile-entry').removeAttribute('aria-current');
  get('back').hidden = !history.length;
  const showingChat = route.screen === 'chat';
  const phone = get('phone');
  const screen = get('screen');
  const shortcuts = get('chat-shortcuts');
  phone.classList.toggle('phone-chat', showingChat);
  screen.hidden = Boolean(scene);
  screen.replaceChildren(...(scene ? [] : draw[route.screen](route.parcel)));
  renderScenarioPreview(scene);
  shortcuts.hidden = !showingChat;
  shortcuts.replaceChildren(...(showingChat ? renderChatShortcuts(route.parcel) : []));
  for (const choice of get('teacher-variants').children) {
    choice.setAttribute('aria-pressed', String(choice.dataset.variant === guideVariant));
  }
  for (const choice of get('test-states').children) {
    if (choice.dataset.status !== 'reminder') choice.setAttribute('aria-pressed', String(choice.dataset.status === status));
  }
  renderWechatNotices();
  updateReadingPreview();
  if (moveFocus && (showingChat || scene)) {
    screen.scrollTop = 0;
    get('screen-title').focus({ preventScroll: true });
    phone.scrollIntoView({ block: 'nearest' });
  } else if (moveFocus) {
    get('screen-title').focus();
  }
}

for (const [screen, scene] of Object.entries(wechatScenes)) {
  get(scene.entry).addEventListener('click', (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (route.screen !== screen) openScreen(screen);
  });
}

for (const [key, { label }] of Object.entries(guideVariants)) {
  const choice = button(label, () => {
    if (key === guideVariant && route.screen === 'success' && !connection) return;
    guideVariant = key;
    previewIndex = 0;
    route = { screen: 'success', parcel: 'first' };
    history = [];
    connection = null;
    render(true);
  }, 'chip');
  choice.dataset.variant = key;
  get('teacher-variants').append(choice);
}

setInterval(() => {
  const prompt = get('reading-preview-prompt');
  if (previewPaused || document.hidden || get('dialog').open || !prompt ||
      prompt.parentElement?.matches(':hover, :focus-visible')) return;
  previewIndex = (previewIndex + 1) % readingPreviews.length;
  updateReadingPreview();
}, 5000);

for (const key of ['waiting', 'shipped', 'arrived', 'reminder', 'signed']) {
  const title = states[key]?.title ?? workflow.events[key].title;
  const choice = button(title, () => {
    simulateLogistics(key);
    messages = [];
    render();
  }, 'chip');
  choice.dataset.status = key;
  get('test-states').append(choice);
}
for (const id of ['profile-entry', 'start-logistics-demo']) {
  get(id).addEventListener('click', () => {
    if (route.screen !== 'profile') openScreen('profile');
    else get('screen-title').focus();
  });
}
get('back').addEventListener('click', () => {
  if (!history.length) return;
  route = history.pop();
  if (route.screen === 'chat') messages = [];
  render(true);
});
get('close-dialog').addEventListener('click', () => get('dialog').close());
get('restart').addEventListener('click', () => {
  sceneFrames.clear();
  get('scenario-preview').replaceChildren();
  route = { screen: 'success', parcel: 'first' };
  history = [];
  messages = [];
  feedback = [];
  connection = null;
  previewIndex = 0;
  previewPaused = prefersReducedMotion;
  status = 'waiting';
  orderFilter = 'all';
  subscription = workflow.createState();
  logisticsDemoResult = '';
  render(true);
});

render();
