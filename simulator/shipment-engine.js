(function (root) {
  const books = [
    { title: '《这也叫成语？》', edition: '', quantity: 1 },
    { title: '《创阅拓展》', edition: '上册', quantity: 1 }
  ];
  const order = {
    id: 'DEMO-1101',
    parcelId: 'BOX-01',
    shippingSchedule: '绘本每 3 个月寄一次，一年寄 4 次。',
    books,
    items: books.map(({ title, edition, quantity }) => title + (edition ? edition + ' ' : '') + quantity + ' 本')
  };
  const carrier = '中国邮政';
  const tracking = 'DEMO-TRACK-1101';
  const station = '示例社区驿站';
  const events = {
    shipped: { title: '已发货', phase: 1 },
    arrived: { title: '已到驿站', phase: 2 },
    reminder: { title: '提醒取件', phase: 2 },
    collected: { title: '已取件', phase: 3 }
  };
  const topics = ['shipped', 'arrived', 'reminder'];

  function createState() {
    return { phase: 0, carrier: '', tracking: '', station: '', authorized: [], notices: [], log: [] };
  }

  function subscribe(state, selected) {
    const authorized = [...new Set([...state.authorized, ...selected.filter((topic) => topics.includes(topic))])];
    return { ...state, authorized };
  }

  function exampleEvent(type, fault) {
    return {
      type,
      orderId: fault === 'unlinked' ? 'OTHER-ORDER' : order.id,
      parcelId: order.parcelId,
      carrier,
      tracking: fault === 'tracking' ? '' : tracking,
      station: fault === 'station' ? '' : station,
      waitHours: fault === 'early' ? 6 : 24
    };
  }

  function record(state, event, result, reason) {
    return { ...state, log: [...state.log, { title: events[event.type].title, result, reason }] };
  }

  function ingest(state, event) {
    const stage = events[event.type];
    if (!stage) return state;
    const stop = (reason) => record(state, event, '已拦截', reason);
    if (event.orderId !== order.id || event.parcelId !== order.parcelId) return stop('订单与包裹关联不一致。');
    if (event.type === 'reminder' && state.phase === 3) return stop('包裹已经取件，无需提醒。');
    if (stage.phase < state.phase) return stop('收到早于当前状态的事件，已保留最新状态。');
    if (event.type !== 'reminder' && stage.phase > state.phase + 1) return stop('缺少前序已核验状态。');
    if (!event.carrier || !event.tracking) return stop('快递公司或运单号缺失。');
    if (state.tracking && (state.tracking !== event.tracking || state.carrier !== event.carrier)) return stop('快递公司或单号与已核验的包裹不一致。');
    if (stage.phase === 2 && !event.station) return stop('缺少已确认的驿站信息。');
    if (state.station && event.station && state.station !== event.station) return stop('驿站与已核验的包裹信息不一致。');
    if (event.type === 'reminder' && (state.phase !== 2 || !Number.isFinite(event.waitHours) || event.waitHours < 24)) {
      return stop('需确认已到站、尚未取件，并达到 24 小时提醒条件。');
    }

    const updated = {
      ...state,
      phase: Math.max(state.phase, stage.phase),
      carrier: event.carrier,
      tracking: event.tracking,
      station: stage.phase === 2 ? event.station : state.station
    };
    const verified = '订单与包裹匹配，快递公司、运单号' + (stage.phase === 2 ? '及驿站' : '') + '已核对。';
    if (event.type === 'collected') return record(updated, event, '订单已更新', verified + '停止待取件提醒。');
    if (state.notices.some((notice) => notice.type === event.type)) return record(updated, event, '已去重', '此包裹的同类提醒已模拟推送。');
    if (!state.authorized.includes(event.type)) return record(updated, event, '待订阅', verified + '当前没有该提醒的有效订阅。');

    const messages = {
      shipped: '跟您说一声，孩子第一个月的教材已经寄出啦！这次有' + order.items.join('、') +
        '。等包裹到了，您可以对着清单核一下，少了哪本就跟我说。',
      arrived: '孩子的教材到「' + event.station + '」啦。您方便的时候可以带上取件码，顺路取一下。要是没收到取件码，可以回我，我帮您一起查。',
      reminder: '给您提个醒，孩子的教材到「' + event.station + '」已经满一天了，物流上还显示待取。您方便路过时，记得带回家。要是已经拿到了，这条就不用管啦。'
    };
    const body = [
      messages[event.type],
      '快递：' + event.carrier + ' · ' + event.tracking
    ].join('\n\n');
    return record({
      ...updated,
      authorized: state.authorized.filter((topic) => topic !== event.type),
      notices: [...state.notices, { type: event.type, title: stage.title, body }]
    }, event, '模拟已推送', verified + '已使用本节点的模拟订阅资格。');
  }

  const workflow = { order, events, topics, createState, subscribe, exampleEvent, ingest };
  if (typeof module !== 'undefined') module.exports = workflow;
  else root.shipmentWorkflow = workflow;
})(globalThis);
