const get = (id) => document.getElementById(id);
const workflow = shipmentWorkflow;
const { element, action, nextEvent, labels, renderNotices } = shipmentView;
const query = new URLSearchParams(location.search);
const embedded = query.get('embed') === '1';
if (embedded) document.documentElement.classList.add('shipment-embedded');
const parentNickname = '小林妈妈';
const introductionRounds = [
  [
    '小林妈妈您好，我是阅读指导师扶摇。咱们马上就要开启第一个月的阅读旅程啦！这个月先帮小林慢慢养成阅读习惯，叫叫和我都会陪着他。',
    '孩子一般多久有时间可以完成阅读哈',
    '扶摇老师好。晚饭后有一会儿，那时候我也在家。'
  ],
  [
    '晚饭后就挺合适。可以等他收好碗筷，您提醒一句「到阅读时间啦」。头一次带他找一下叫叫 App 的「学习」入口，之后让他自己点进去。',
    '行。他第一次自己读，我需要一直坐在旁边吗？'
  ],
  [
    '您可以在旁边忙自己的事，让小林跟着 App 里的课程读。他找不到下一步时，您再搭把手就行。',
    '好，那就先定在晚饭后。他读完了我该问点什么？'
  ],
  [
    '您可以先看看他读完是什么反应。比如他还惦记着故事里的人物，或者跑来跟您说了一句，这时候就顺着他聊。',
    '他喜欢小动物，看到有意思的可能会喊我过去。'
  ],
  [
    '那您就问一句「今天哪儿最有意思？」他要是说小兔子好笑，您就接一句「它做了什么呀？」聊一两句就够了。',
    '那他要是只说「好看」，就没下文了呢？'
  ],
  [
    '那就接一句「听起来你挺喜欢的」，等他想说了再聊。过几天您可以留意一下，他会不会自己想起来去读，或者主动来跟您讲点什么。',
    '好，这样聊起来轻松。要是哪天回来晚了，漏了一天怎么办？'
  ],
  [
    '偶尔漏一天很正常。那天先休息，第二天晚饭后回到原来的时间，让小林打开 App 接着读。',
    '那第二天还是照平常的量读就行？'
  ],
  [
    '对，照平常的节奏就行。要是连着几次晚饭后都排不开，您跟我说一声，我们一起看看换到哪个时段更容易坚持。',
    '明白。我周三下班常常比较晚，可以让他洗漱完再读一会儿吗？'
  ],
  [
    '可以呀，洗漱完还有空就试试。咱们先按这个安排试一周，您看看小林哪天最愿意自己打开 App，有变化随时跟我说。',
    '行，就先这么试一周。'
  ],
  [
    '对了，小林妈妈，和您说下咱们的绘本邮寄安排。' + workflow.order.shippingSchedule +
      '您可以点下面的小程序卡片订阅物流提醒。发货、到驿站或需要取件时，微信会及时通知您。',
    '那我点进去选一下，之后等微信提醒就好了。'
  ]
];
const phaseParam = query.get('phase');
const appPhase = ['0', '1', '2', '3'].includes(phaseParam) ? Number(phaseParam) : null;
let state = restoreAppState();
let signedPending = appPhase !== null && appPhase < 3 && query.get('result') === 'signed';
const subscriptionForm = get('subscription');
const dialog = get('logistics-card');
let subscribed = state.authorized.length > 0 || state.notices.length > 0;
let receipt = '';
let elapsedDays = 6;
let replacementBook = '';
if (appPhase !== null || state.authorized.length) {
  for (const input of subscriptionForm.querySelectorAll('input[name="topic"]')) {
    input.checked = state.authorized.includes(input.value);
  }
}

function restoreAppState() {
  let restored = workflow.createState();
  if (appPhase !== null) {
    const notices = new Set(query.getAll('notice').filter((type) => workflow.topics.includes(type)));
    for (const [type, event] of Object.entries(workflow.events)) {
      const sent = notices.has(type);
      if (event.phase > appPhase || (type === 'reminder' && !sent)) continue;
      const priorLog = restored.log;
      if (sent) restored = workflow.subscribe(restored, [type]);
      restored = workflow.ingest(restored, workflow.exampleEvent(type));
      // Baseline events establish the current phase without creating new notices or audit entries.
      if (!sent) restored = { ...restored, log: priorLog };
    }
  }
  return workflow.subscribe(restored, query.getAll('topic'));
}

function message(speaker, text) {
  const view = element('div', '', speaker === parentNickname ? 'message parent' : 'message');
  view.append(element('span', speaker, 'speaker'), element('p', text, 'bubble'));
  return view;
}

function openCard(view) {
  subscriptionForm.hidden = view !== 'subscription';
  shipmentView.openCard(dialog, state, view, { receipt, confirmReceipt, reportIssue, signedPending });
}

function confirmReceipt(result) {
  receipt = '已记录（模拟）：' + result;
  openCard('books');
  render();
  get('card-content').querySelector('.outcome:last-child')?.setAttribute('role', 'status');
}

const invitation = get('invitation');
const advance = get('advance');
const simulateDelay = get('simulate-delay');
const replay = get('replay');
const delayStatus = get('delay-status');
const delayNotifications = get('delay-notifications');
const afterSales = get('after-sales');
const replacementUpdate = get('replacement-update');
const subscribeEntry = action('', () => openCard('subscription'));
subscribeEntry.classList.add('wechat-program-card');
subscribeEntry.setAttribute('aria-haspopup', 'dialog');
subscribeEntry.append(element('span', '家长端小程序', 'speaker'),
  element('strong', '首月教材物流'), element('span', '订阅发货、到驿站和取件提醒'));
const followup = element('div', '', 'shipment-followup');
followup.append(
  element('p', '已订阅首月教材物流提醒', 'app-update shipment-subscription-confirmation'),
  message(parentNickname, '点好了，上面写着订阅成功。'),
  message('指导师扶摇', '好，这张卡已经关联您刚买的那一单。之后想看看寄到哪儿了，回来点开就行。'),
  message(parentNickname, '那这次寄的是哪几本呀？我怕到时候拿错。'),
  message('指导师扶摇', '预计是《这也叫成语？》和《创阅拓展》上册，各一本。等书发出去，卡片上会更新实际装箱书单，收到就能照着核对。'),
  message(parentNickname, '行，那我等微信提醒就好。')
);
function reportIssue(type, book) {
  if (state.phase !== 3 || receipt) return;
  const reports = {
    missing: {
      label: '少书',
      question: '老师，书收到啦，我照书单看了下，箱子里少了' + book + '。',
      reply: '我看到您刚核对的书单了，这本确实在本箱清单里。我帮您登记补寄，先按这单的收货地址寄，可以吗？',
      next: '可以，还是原来的地址。'
    },
    wrong: {
      label: '寄错',
      question: '老师，我收到的封面和书单对不上，应该是' + book + '，箱子里是另一本。',
      reply: '让您多核对了一遍。我会对着这单的书名和册次查。您拍一张收到的书封面就行，我这边帮您处理。',
      next: '这本的封面我发您了。［演示图片］'
    },
    damaged: {
      label: '破损',
      question: '老师，' + book + '收到时有几页破了，孩子翻起来有点费劲。',
      reply: '拆开就发现破了，确实糟心。您方便的话拍一下破的那几页，一张能看清就行，我帮您登记换一本新的。',
      next: '行，我拍了破的那页。［演示图片］'
    }
  };
  const report = reports[type];
  replacementBook = book;
  receipt = '已登记（模拟）：' + book + ' · ' + report.label;
  dialog.close();
  afterSales.replaceChildren(
    message(parentNickname, report.question),
    message('指导师扶摇', report.reply),
    message(parentNickname, report.next),
    message('指导师扶摇', '帮您安排了免费补寄，会按这单的地址寄出。' +
      (type === 'wrong' ? '寄错的那本先放在家里就好，您不用先跑一趟寄回。' : '') +
      '耽误您和小林用书了，我另外送小林 20 雪豆。补寄发出后，我在这条微信里把运单告诉您。'),
    element('p', '补寄已登记 · 20 雪豆到账（模拟）', 'app-update'),
    message(parentNickname, '好，谢谢老师。那我等您消息。')
  );
  replacementUpdate.hidden = false;
  render();
  replacementUpdate.focus({ preventScroll: true });
  if (embedded) scrollChat('end');
  else afterSales.scrollIntoView({ block: 'nearest' });
}

replacementUpdate.addEventListener('click', () => {
  if (!replacementBook || replacementUpdate.hidden) return;
  afterSales.append(
    message('指导师扶摇', '小林妈妈，补寄的' + replacementBook + '已经发出啦。示例运单号是 DEMO-RESEND-1101。收到后您看一眼，有问题直接回我就好。'),
    message(parentNickname, '好的，这次我拿到就核对一下。')
  );
  replacementUpdate.hidden = true;
  advance.focus({ preventScroll: true });
  if (embedded) scrollChat('end');
  else afterSales.lastElementChild.scrollIntoView({ block: 'nearest' });
});

function renderIntroduction() {
  const turns = introductionRounds.flatMap((round) => [
    ...round.slice(0, -1).map((text) => message('指导师扶摇', text)),
    message(parentNickname, round.at(-1))
  ]);
  invitation.replaceChildren(...turns.slice(0, -1), subscribeEntry, turns.at(-1), followup);
}

advance.addEventListener('click', () => {
  if (state.phase === 3) {
    openCard('books');
    return;
  }
  const event = nextEvent(state, signedPending);
  state = workflow.ingest(state, workflow.exampleEvent(event));
  if (event === 'shipped' && state.phase === 1 && elapsedDays === 7) elapsedDays = 8;
  if (state.phase === 3) signedPending = false;
  render();
  if (embedded) scrollChat('end');
  else advance.scrollIntoView({ block: 'nearest' });
});

simulateDelay.addEventListener('click', () => {
  if (state.phase !== 0 || elapsedDays >= 7) return;
  elapsedDays = 7;
  const reminder = state.authorized.includes('shipped') ? '发货后，微信会及时提醒您。' :
    '您可以订阅发货提醒，寄出后微信会及时通知您。';
  const notice = message('指导师扶摇',
    '小林妈妈，和您说一声，我刚查了一下，首月绘本还没有发货记录。您别担心，最近订单有些多，仓库同事正在加紧备货，预计这两天就会发出。' + reminder);
  notice.classList.add('shipment-followup');
  notice.append(action('查看教材物流', () => openCard('shipment')));
  delayNotifications.append(notice);
  render();
  advance.focus({ preventScroll: true });
  if (embedded) scrollChat('end');
  else notice.scrollIntoView({ block: 'nearest' });
});

replay.addEventListener('click', () => {
  state = workflow.createState();
  signedPending = false;
  subscribed = false;
  receipt = '';
  elapsedDays = 6;
  replacementBook = '';
  delayNotifications.replaceChildren();
  afterSales.replaceChildren();
  replacementUpdate.hidden = true;
  get('subscription-error').hidden = true;
  subscriptionForm.reset();
  render();
  subscribeEntry.focus();
  if (embedded) scrollChat('end');
});

subscriptionForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const topics = new FormData(event.currentTarget).getAll('topic');
  if (!topics.length) {
    get('subscription-error').hidden = false;
    return;
  }
  get('subscription-error').hidden = true;
  state = workflow.subscribe(state, topics);
  subscribed = true;
  dialog.close();
  render();
  advance.focus();
  if (embedded) scrollChat('end');
});

function scrollChat(position) {
  const chat = get('wechat-chat');
  chat.scrollTop = position === 'end' ? chat.scrollHeight : 0;
}

function render() {
  followup.hidden = !subscribed;
  simulateDelay.hidden = elapsedDays >= 7 || state.phase !== 0;
  replay.hidden = state.phase === 0 && elapsedDays < 7;
  delayStatus.textContent = '模拟时间 · 首购已满 ' + elapsedDays + ' 天 · ' +
    (state.phase === 0 ? '暂无发货记录' : '已有发货记录');
  const event = nextEvent(state, signedPending);
  if (state.phase === 3) {
    advance.textContent = '核对收到的书';
  } else if (event === 'shipped') {
    advance.textContent = elapsedDays >= 7 ? '模拟后续发货' : '模拟 7 天内发货';
  } else {
    advance.textContent = labels[event];
  }
  renderNotices(get('notifications'), state, receipt, openCard);
}

renderIntroduction();
render();
