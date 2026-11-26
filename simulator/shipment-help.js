const get = (id) => document.getElementById(id);
const workflow = shipmentWorkflow;
const { nextEvent, labels, renderNotices } = shipmentView;
const embedded = new URLSearchParams(location.search).get('embed') === '1';
if (embedded) document.documentElement.classList.add('shipment-embedded');
let state = startOrder();
let subscribed = false;
let receipt = '';

function startOrder() {
  return workflow.ingest(workflow.createState(), workflow.exampleEvent('shipped'));
}

function showNext(button) {
  button.hidden = false;
  button.focus();
  if (embedded) {
    const chat = get('wechat-chat');
    chat.scrollTop = button.id === 'show-reply' ? 0 : chat.scrollHeight;
  } else {
    button.scrollIntoView({ block: 'nearest' });
  }
}

get('show-reply').addEventListener('click', () => {
  get('first-reply').textContent = '小林妈妈，书已经寄出啦。我刚帮您看了下，' + state.carrier +
    '已经揽收，运单尾号 ' + state.tracking.slice(-4) +
    '。现在预计明天下午到。您等收到取件消息再过去，免得白跑一趟。';
  get('first-responses').hidden = false;
  get('show-reply').hidden = true;
  get('subscribe-logistics').hidden = false;
  showNext(get('decline-subscription'));
});

function chooseSubscription(accepted) {
  subscribed = accepted;
  if (accepted) state = workflow.subscribe(state, ['arrived', 'reminder']);
  get('confirmed').hidden = !accepted;
  get('declined').hidden = accepted;
  get('subscribe-logistics').hidden = true;
  get('decline-subscription').hidden = true;
  get('arrive').textContent = accepted ? labels[nextEvent(state)] : '第二天，再问指导师';
  showNext(get('arrive'));
}

get('subscribe-logistics').addEventListener('click', () => chooseSubscription(true));
get('decline-subscription').addEventListener('click', () => chooseSubscription(false));

function openCard(view) {
  shipmentView.openCard(get('logistics-card'), state, view, { receipt, confirmReceipt });
}

function updateNotices() {
  renderNotices(get('notifications'), state, receipt, openCard);
}

function confirmReceipt(result) {
  receipt = '已记录（模拟）：' + result;
  openCard('books');
  updateNotices();
  get('card-content').querySelector('.outcome:last-child')?.setAttribute('role', 'status');
}

get('arrive').addEventListener('click', () => {
  state = workflow.ingest(state, workflow.exampleEvent(subscribed ? nextEvent(state) : 'arrived'));
  if (subscribed) {
    updateNotices();
    if (state.phase < 3) {
      get('arrive').textContent = labels[nextEvent(state)];
      showNext(get('arrive'));
      return;
    }
  } else {
    get('second-reply').textContent = '到了，小林妈妈。我刚确认过，书已经在「' + state.station +
      '」了。您下班顺路过去就行，带上驿站短信里的取件码。要是翻不到那条短信，您回我一声，我帮您一起查。';
    get('second-exchange').hidden = false;
  }
  get('arrive').hidden = true;
  showNext(get('replay'));
});

get('replay').addEventListener('click', () => {
  state = startOrder();
  subscribed = false;
  receipt = '';
  updateNotices();
  for (const id of ['first-responses', 'declined', 'confirmed', 'second-exchange', 'replay']) {
    get(id).hidden = true;
  }
  showNext(get('show-reply'));
});
