(function (root) {
  const workflow = root.shipmentWorkflow;
  const labels = { shipped: '模拟发货通知', arrived: '模拟到驿站通知', reminder: '模拟取件提醒', collected: '模拟已取件' };

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function action(label, handler) {
    const button = element('button', label, 'secondary');
    button.type = 'button';
    button.addEventListener('click', handler);
    return button;
  }

  function openCard(dialog, state, view, { receipt, confirmReceipt, reportIssue, signedPending = false }) {
    const content = dialog.querySelector('#card-content');
    content.replaceChildren();
    const titles = { subscription: '首月教材物流', shipment: '物流和本箱书单', pickup: '驿站取件信息', books: '核对收到的书' };
    dialog.querySelector('#card-title').textContent = titles[view];
    const status = signedPending ? '签收待核实' :
      ['支付成功 · 待发货', '已发货', '已到驿站 · 待取件', '已取件'][state.phase];
    content.append(element('p', '订单 ' + workflow.order.id + ' · 首月教材', 'eyebrow'),
      element('p', status, 'outcome'));
    if (state.tracking) {
      content.append(element('p', [state.carrier, state.tracking, state.station].filter(Boolean).join(' · '), 'promise'));
    }

    if (view === 'pickup') {
      content.append(element('p', '请以驿站短信或快递渠道提供的取件信息为准。', 'promise'));
    } else {
      content.append(element('h3', state.phase ? '本箱实际书单' : '预计随包裹寄出', 'promise'));
      const list = element('ul', '', 'shipment-books');
      for (const [index, book] of workflow.order.books.entries()) {
        const item = element('li');
        const cover = element('img');
        cover.src = 'assets/cover-' + ['idioms', 'writing'][index] + '.webp';
        cover.alt = book.title + '演示封面';
        const info = element('div');
        const name = workflow.order.items[index];
        info.append(element('strong', name));
        if (view === 'books' && state.phase === 3 && !receipt) {
          if (reportIssue) {
            const title = book.title + book.edition;
            info.append(action('少了', () => reportIssue('missing', title)),
              action('寄错了', () => reportIssue('wrong', title)),
              action('破损', () => reportIssue('damaged', title)));
          } else {
            info.append(action('少了', () => confirmReceipt(name + ' · 缺少')),
              action('寄错了', () => confirmReceipt(name + ' · 寄错')));
          }
        }
        item.append(cover, info);
        list.append(item);
      }
      content.append(list);
      if (view === 'books') {
        if (receipt) content.append(element('p', receipt, 'outcome'));
        else if (state.phase === 3) content.append(action('都收到了', () => confirmReceipt('两本教材都收到了')));
        else content.append(element('p', '取件后可以在这里确认实物或反馈问题。', 'promise'));
      }
    }
    if (!dialog.open) dialog.showModal();
  }

  function nextEvent(state, signedPending = false) {
    if (state.phase < 2) return state.phase === 0 ? 'shipped' : 'arrived';
    if (!signedPending && state.authorized.includes('reminder') &&
        !state.notices.some((notice) => notice.type === 'reminder')) return 'reminder';
    return 'collected';
  }

  function renderNotices(container, state, receipt, openCard) {
    const notices = state.notices.map((notice) => {
      const titles = { shipped: '教材已发出', arrived: '教材已到驿站', reminder: '教材待取提醒' };
      const copy = {
        shipped: '您的首月教材已由' + state.carrier + '揽收，运单尾号 ' + state.tracking.slice(-4) + '。\n这一箱有' + workflow.order.items.join('、') + '。',
        arrived: '您的首月教材已到「' + state.station + '」，现在可以取件。',
        reminder: '您的教材还在「' + state.station + '」。方便时记得取一下。拿到后可以按封面、册次和数量核对。'
      };
      const view = element('article', '', 'shipment-notice');
      view.append(element('h3', titles[notice.type], 'app-update'),
        element('div', '首月教材物流 · 小程序服务通知', 'speaker'), element('p', copy[notice.type], 'bubble'));
      view.append(notice.type === 'shipped'
        ? action('查看物流和本箱书单', () => openCard('shipment'))
        : action('查看驿站和取件信息', () => openCard('pickup')));
      if (notice.type === 'reminder') view.append(action('核对收到的书', () => openCard('books')));
      return view;
    });
    if (state.phase === 3) {
      const collected = element('article', '', 'shipment-notice');
      collected.append(element('h3', '已取件', 'app-update'), action('核对收到的书', () => openCard('books')));
      if (receipt) collected.append(element('p', receipt, 'outcome'));
      notices.push(collected);
    }
    container.replaceChildren(...notices);
  }

  root.shipmentView = { element, action, openCard, nextEvent, labels, renderNotices };
})(globalThis);
