const get = (id) => document.getElementById(id);
const { element, action } = shipmentView;
const { id: orderId } = shipmentWorkflow.order;
const embedded = new URLSearchParams(location.search).get('embed') === '1';
if (embedded) document.documentElement.classList.add('shipment-embedded');

const originalAddress = '杭州 · 春和小区';
const cases = {
  temporary: {
    shipped: false,
    destination: '合肥 · 桂花里小区',
    question: '扶摇老师，我们这阵子回老家了。这箱绘本能改到合肥吗？过段时间就回杭州。',
    replies: ['可以呀，我刚看过，这箱还没发。点下面的卡片选「只改这一箱」，后面的绘本就还寄杭州。保存前，两边的地址都能看清楚。']
  },
  ongoing: {
    shipped: true,
    destination: '杭州 · 听雨小区',
    question: '扶摇老师，我们搬家了。以后的绘本都能寄到新家吗？我怕又发到原来的住处。',
    replies: [
      '可以，我帮您看下。',
      '这箱已经寄出，这次来不及改了。可以点下面的卡片把后续批次改到新家，保存前会写清楚哪些包裹会用新地址。'
    ]
  }
};
const chat = get('wechat-chat');
const dialog = get('address-card');
const form = get('address-form');
const verification = get('verify-shipment');
let scenario;
let saved;

function message(speaker, text, fromParent = false) {
  const bubble = element('div', '', fromParent ? 'message parent' : 'message');
  bubble.append(element('span', speaker, 'speaker'), element('p', text, 'bubble'));
  return bubble;
}

function destinations(scope) {
  return {
    current: scenario.shipped ? originalAddress : scenario.destination,
    future: scope === 'ongoing' ? scenario.destination : originalAddress
  };
}

function showDestinations(list, addresses) {
  list.replaceChildren(
    element('dt', scenario.shipped ? '本箱（已发货）' : '本箱（待发货）'), element('dd', addresses.current),
    element('dt', '后续未发货批次'), element('dd', addresses.future)
  );
}

function previewAddresses() {
  showDestinations(get('address-preview'), destinations(form.elements.scope.value));
}

function scrollToLatest() {
  if (embedded) chat.scrollTop = chat.scrollHeight;
  else chat.lastElementChild?.scrollIntoView({ block: 'nearest' });
}

function openCard(key) {
  get('scope-temporary').disabled = scenario.shipped;
  get('scope-' + key).checked = true;
  get('address-status').textContent = scenario.shipped ? '本箱已发货，这次保存会更新后续未发货的批次。' : '本箱尚未发货，可以在寄出前修改地址。';
  get('new-address').textContent = '新地址（演示） · ' + scenario.destination;
  previewAddresses();
  dialog.showModal();
}

function start(key) {
  scenario = cases[key];
  saved = null;
  verification.hidden = true;
  const card = action('打开小程序 · 修改收货地址', () => openCard(key));
  card.setAttribute('aria-haspopup', 'dialog');
  chat.replaceChildren(message('小林妈妈', scenario.question, true),
    ...scenario.replies.map((reply) => message('指导师扶摇', reply)), card);
  card.focus();
  if (embedded) chat.scrollTop = 0;
}

get('address-order').textContent = '已关联订单 ' + orderId;
for (const key of Object.keys(cases)) get(key).addEventListener('click', () => start(key));
form.addEventListener('change', previewAddresses);
form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (saved) return;
  const scope = form.elements.scope.value;
  if (scope !== 'ongoing' && (scope !== 'temporary' || scenario.shipped)) return;
  saved = destinations(scope);
  dialog.close();
  chat.lastElementChild.remove();
  const receipt = element('dl', '', 'outcome address-receipt');
  showDestinations(receipt, saved);
  chat.append(message('小林妈妈', '我确认好了。', true), element('p', '收货地址已更新（模拟）', 'app-update'),
    receipt, message('指导师扶摇', scope === 'temporary' ?
      '改好了，这箱寄合肥。等后面的绘本发货，还是寄您原来的杭州地址。' :
      (scenario.shipped ? '后续还没发货的绘本都改到新家了。这箱已经出发，仍按原地址派送。' : '改好了，这箱和后续还没发货的绘本都会寄到新地址。')));
  verification.textContent = scenario.shipped ? '模拟下一批发货核对' : '模拟本箱发货核对';
  verification.hidden = false;
  verification.focus();
  scrollToLatest();
});

verification.addEventListener('click', () => {
  if (!saved || verification.hidden) return;
  const parcel = scenario.shipped ? '下一批绘本' : '本箱绘本';
  const destination = scenario.shipped ? saved.future : saved.current;
  chat.append(element('p', '模拟发货核对', 'app-update'),
    message('指导师扶摇', '小林妈妈，' + parcel + '寄出啦。我帮您核对了，收货地是「' + destination + '」。'));
  verification.hidden = true;
  get(scenario.shipped ? 'ongoing' : 'temporary').focus({ preventScroll: true });
  scrollToLatest();
});

chat.append(element('p', '选一个情境，看看指导师怎样帮家长改地址。', 'eyebrow'));
