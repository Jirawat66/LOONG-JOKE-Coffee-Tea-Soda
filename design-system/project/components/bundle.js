/* @ds-bundle: {"format":4,"namespace":"LoongJoke","components":[{"name":"Button"},{"name":"Chip"},{"name":"Stepper"},{"name":"MenuCard"},{"name":"StatusBadge"}]} */
(function () {
  var h = window.React.createElement;

  function cx() {
    return Array.prototype.filter.call(arguments, Boolean).join(' ');
  }

  function omit(obj, keys) {
    var out = {};
    for (var k in obj) if (keys.indexOf(k) < 0) out[k] = obj[k];
    return out;
  }

  function Button(props) {
    var variant = props.variant || 'primary';
    var rest = omit(props, ['variant', 'className', 'children']);
    return h('button', Object.assign({ type: 'button' }, rest, {
      className: cx('lj-btn', 'lj-btn-' + variant, props.className)
    }), props.children);
  }

  function Chip(props) {
    var rest = omit(props, ['selected', 'className', 'children']);
    return h('button', Object.assign({ type: 'button' }, rest, {
      'aria-pressed': props.selected ? 'true' : 'false',
      className: cx('lj-chip', props.className)
    }), props.children);
  }

  function Stepper(props) {
    var min = props.min == null ? 1 : props.min;
    var max = props.max == null ? 20 : props.max;
    var value = props.value == null ? min : props.value;
    var onChange = props.onChange || function () {};
    return h('div', { className: 'lj-stepper', role: 'group', 'aria-label': props.label || 'จำนวน' },
      h('button', { type: 'button', className: 'lj-step-btn', 'aria-label': 'ลดจำนวน', disabled: value <= min, onClick: function () { onChange(value - 1); } }, '−'),
      h('output', { className: 'lj-step-val', 'aria-live': 'polite' }, value),
      h('button', { type: 'button', className: 'lj-step-btn', 'aria-label': 'เพิ่มจำนวน', disabled: value >= max, onClick: function () { onChange(value + 1); } }, '+')
    );
  }

  var STATUS = { 'new': 'ใหม่', making: 'กำลังทำ', done: 'เสร็จแล้ว', out: 'หมด' };

  function StatusBadge(props) {
    var status = props.status || 'new';
    return h('span', { className: 'lj-badge lj-badge-' + status }, props.children || STATUS[status]);
  }

  function MenuCard(props) {
    var available = props.available !== false;
    var initial = (props.name || props.nameTh || '?').trim().charAt(0).toUpperCase();
    var media = props.image
      ? h('img', { src: props.image, alt: '', loading: 'lazy' })
      : h('div', { className: 'lj-card-ph', 'aria-hidden': 'true' }, initial);
    return h('button', {
      type: 'button',
      className: cx('lj-card', props.className),
      'aria-disabled': available ? undefined : 'true',
      onClick: available ? props.onSelect : undefined
    },
      h('div', { className: 'lj-card-media' }, media,
        available ? null : h('span', { className: 'lj-card-out' }, h(StatusBadge, { status: 'out' }))),
      h('span', { className: 'lj-card-name' }, props.name),
      props.nameTh && props.nameTh !== props.name ? h('span', { className: 'lj-card-th' }, props.nameTh) : null,
      h('span', { className: 'lj-card-price' }, props.price + ' ฿')
    );
  }

  window.LoongJoke = Object.assign(window.LoongJoke || {}, {
    Button: Button,
    Chip: Chip,
    Stepper: Stepper,
    MenuCard: MenuCard,
    StatusBadge: StatusBadge
  });
})();
