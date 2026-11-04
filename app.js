
'use strict';

const SUPABASE_URL = 'https://fdtarpjanwcroknyhlrt.supabase.co';
const KEY = 'sb_publishable_Cd3vBXKHYP2gEsY8lhWDcQ_GUioIZH9';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;',
  '"':'&quot;', "'":'&#39;'
}[c]));
const money = n => 'NT$ ' + Number(n || 0).toLocaleString('zh-TW');

const vendorDefaults = [
  '婚宴飯店／餐廳','婚禮企劃／婚顧','婚禮當日場控',
  '婚禮攝影（婚攝）','婚禮錄影（婚錄）',
  '新娘秘書／造型師','新郎造型','婚紗攝影',
  '婚紗禮服租借','新郎西裝','婚禮主持人',
  '婚禮花藝／佈置','捧花／胸花','燈光音響／投影',
  '婚禮樂團／表演','婚禮喜餅','電子喜帖／紙本喜帖',
  '婚禮小物／伴手禮','婚戒／飾品',
  '婚禮交通／接駁','婚禮印刷／指示牌'
];

const defs = {
  tasks: {
    table:'wedding_tasks', name:'待辦事項', title:'title',
    fields:[
      ['title','待辦事項','text',true],
      ['status','狀態','select',false,['待處理','進行中','已完成']],
      ['due_date','期限','date'],
      ['owner','負責人','text'],
      ['notes','備註','textarea']
    ]
  },
  guests: {
    table:'wedding_guests', name:'賓客', title:'name',
    fields:[
      ['name','賓客姓名','text',true],
      ['side','男方／女方','select',false,['男方','女方','其他']],
      ['party_size','人數','number'],
      ['table_number','桌號','number'],
      ['rsvp','出席狀態','select',false,['待確認','出席','不出席']],
      ['phone','電話','tel'],
      ['notes','備註','textarea']
    ]
  },
  vendors: {
    table:'wedding_vendors', name:'廠商', title:'name',
    fields:[
      ['name','廠商／項目名稱','text',true],
      ['category','類別','text'],
      ['status','狀態','select',false,
        ['未聯絡','詢價中','待簽約','已確定','已完成','不需要']],
      ['amount','總花費（元）','number'],
      ['paid','已付訂金／已付款（元）','number'],
      ['contact','聯絡方式','text'],
      ['notes','備註','textarea']
    ]
  },
  schedule: {
    table:'wedding_schedule', name:'婚禮流程', title:'title',
    fields:[
      ['title','流程名稱','text',true],
      ['start_time','開始時間','time'],
      ['end_time','結束時間','time'],
      ['owner','負責人','text'],
      ['notes','備註','textarea']
    ]
  },
  gifts: {
    table:'wedding_gifts', name:'禮金', title:'guest_name',
    fields:[
      ['guest_name','送禮人','text',true],
      ['amount','金額（元）','number'],
      ['side','男方／女方','select',false,['男方','女方','其他']],
      ['notes','備註','textarea']
    ]
  }
};

let db;
let me = null;
let isAdmin = false;
let tab = 'home';
let rows = {};
let editType = null;
let editId = null;
let search = '';
let vendorFilter = '全部';

function message(s, bad = false) {
  $('#notice').innerHTML = s
    ? `<span class="${bad ? 'error' : ''}">${esc(s)}</span>`
    : '';
}

function err(e) {
  message(e?.message || String(e), true);
}

function val(x) {
  return x == null ? '' : String(x);
}

function fieldHtml(f, rec) {
  const [k,label,type,required,opts] = f;
  const v = val(rec[k]);

  if (type === 'select') {
    return `<label>${esc(label)}<select name="${esc(k)}">
      ${opts.map(o => `<option value="${esc(o)}"
      ${v === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}
      </select></label>`;
  }

  if (type === 'textarea') {
    return `<label>${esc(label)}
      <textarea name="${esc(k)}">${esc(v)}</textarea></label>`;
  }

  return `<label>${esc(label)}
    <input name="${esc(k)}" type="${type}"
    value="${esc(v)}" ${required ? 'required' : ''}
    ${type === 'number' ? 'min="0" step="1"' : ''}>
    </label>`;
}

function openForm(type, id) {
  if (!isAdmin) return;

  editType = type;
  editId = id || null;

  const rec = id
    ? (rows[type] || []).find(x => x.id === id) || {}
    : {};

  $('#dialogTitle').textContent =
    (id ? '編輯' : '新增') + defs[type].name;

  $('#fields').innerHTML =
    defs[type].fields.map(f => fieldHtml(f, rec)).join('');

  $('#delete').hidden = !id;
  $('#dialog').showModal();
}

async function saveForm(e) {
  e.preventDefault();
  if (!isAdmin) return;

  const d = defs[editType];
  const obj = {};

  new FormData($('#recordForm')).forEach((v,k) => {
    const f = d.fields.find(x => x[0] === k);
    obj[k] = f[2] === 'number'
      ? (v === '' ? null : Number(v))
      : (v || null);
  });

  if (editId) obj.id = editId;

  if (
    editType === 'vendors' &&
    Number(obj.paid || 0) > Number(obj.amount || 0)
  ) {
    alert('已付金額不可超過總花費');
    return;
  }

  const {error} = editId
    ? await db.from(d.table).update(obj).eq('id', editId)
    : await db.from(d.table).insert(obj);

  if (error) return err(error);

  $('#dialog').close();
  await load();
}

async function removeForm() {
  if (!isAdmin || !editId ||
      !confirm('確定刪除？此操作無法復原。')) return;

  const {error} = await db.from(defs[editType].table)
    .delete().eq('id', editId);

  if (error) return err(error);

  $('#dialog').close();
  await load();
}

async function load() {
  const keys = Object.keys(defs);

  const results = await Promise.all(
    keys.map(k =>
      db.from(defs[k].table)
        .select('*')
        .order('created_at', {ascending:true})
    )
  );

  const fail = results.find(x => x.error);
  if (fail) return err(fail.error);

  keys.forEach((k,i) => {
    rows[k] = results[i].data || [];
  });

  message('');
  render();
}

function detail(type, x) {
  const fields = defs[type].fields.filter(
    f => f[0] !== defs[type].title
  );

  return fields.map(([k,label]) => {
    if (x[k] === null || x[k] === undefined || x[k] === '')
      return '';

    const value = (k === 'amount' || k === 'paid')
      ? money(x[k])
      : x[k];

    return `<div class="meta">
      <b>${esc(label)}：</b>${esc(value)}
    </div>`;
  }).join('');
}

function rowHtml(type, x) {
  return `<div class="row">
    <div class="row-main">
      <div class="row-title">${esc(x[defs[type].title])}</div>
      ${detail(type,x)}
    </div>
    ${isAdmin
      ? `<button class="outline small"
          data-edit="${type}" data-id="${esc(x.id)}">編輯</button>`
      : ''}
  </div>`;
}

function render() {
  document.querySelectorAll('[data-tab]').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });

  const p = $('#page');

  if (tab === 'home') {
    const days = Math.max(0, Math.ceil(
      (new Date('2027-06-12T12:00:00+08:00') - new Date())
      / 86400000
    ));

    const pending = (rows.tasks || [])
      .filter(x => x.status !== '已完成')
      .slice(0,5);

    p.innerHTML = `
      <div class="panel">
        <div class="muted">OUR BIG DAY</div>
        <div class="stat">距離婚禮還有 ${days} 天</div>
        <p>2027 年 6 月 12 日（六）· 午宴 · 台北艾麗酒店</p>
      </div>
      <div class="panel">
        <h2>近期待辦</h2>
        ${pending.map(x => rowHtml('tasks',x)).join('')
          || '<div class="empty">目前沒有待辦事項</div>'}
        <button class="outline" data-go="tasks">查看所有待辦</button>
      </div>`;

    p.querySelector('[data-go]').onclick =
      () => changeTab('tasks');

    wireEdit();
    return;
  }

  if (tab === 'guests') {
    const g = rows.guests || [];
    const seated = g.filter(x => x.table_number);
    const groups = {};

    seated.forEach(x => {
      (groups[x.table_number] ??= []).push(x);
    });

    p.innerHTML = `
      <div class="toolbar">
        <h2>賓客與桌次</h2>
        ${isAdmin
          ? '<button data-add="guests">＋ 新增賓客</button>'
          : ''}
      </div>
      <div class="panel">
        <p class="muted">已建檔 ${g.length} 筆；
        已安排桌號 ${seated.length} 筆。</p>
        <input type="search" id="guestSearch"
          placeholder="搜尋賓客姓名" value="${esc(search)}">
        <div id="guestList"></div>
      </div>
      <div class="panel">
        <h2>桌次總覽</h2>
        ${Object.entries(groups)
          .sort((a,b) => Number(a[0])-Number(b[0]))
          .map(([n,rs]) => `
            <div class="row">
              <div class="row-main">
                <b>第 ${esc(n)} 桌</b>
                <div class="meta">
                  ${rs.map(r => esc(r.name)).join('、')}
                </div>
              </div>
              <span class="tag">
                ${rs.reduce((s,r) =>
                  s + Number(r.party_size || 1),0)} 人
              </span>
            </div>`).join('')
          || '<div class="empty">尚未安排桌號</div>'}
      </div>`;

    $('#guestSearch').oninput = e => {
      search = e.target.value;
      guestList();
    };

    guestList();
    return;
  }

  if (tab === 'vendors') {
    const v = rows.vendors || [];
    const total = v.reduce(
      (a,x) => a + Number(x.amount || 0),0
    );
    const paid = v.reduce(
      (a,x) => a + Number(x.paid || 0),0
    );

    p.innerHTML = `
      <div class="toolbar">
        <h2>廠商管理</h2>
        ${isAdmin
          ? '<button data-add="vendors">＋ 新增項目</button>'
          : ''}
      </div>
      <div class="panel">
        <div class="vendor-money">
          <div>總花費<b>${money(total)}</b></div>
          <div>已付訂金／款項<b>${money(paid)}</b></div>
          <div>未付尾款<b>${money(total-paid)}</b></div>
        </div>
        <div class="actions">
          ${isAdmin
            ? '<button class="outline" id="addPresets">＋ 加入常見婚禮項目</button>'
            : ''}
          <select class="filter" id="vendorFilter">
            <option>全部</option>
            <option>已確定</option>
            <option>未聯絡</option>
            <option>詢價中</option>
            <option>待簽約</option>
            <option>已完成</option>
            <option>不需要</option>
          </select>
        </div>
        <div id="vendorList"></div>
      </div>`;

    $('#vendorFilter').value = vendorFilter;

    $('#vendorFilter').onchange = e => {
      vendorFilter = e.target.value;
      vendorList();
    };

    if (isAdmin) $('#addPresets').onclick = addPresets;

    vendorList();
    return;
  }

  const d = defs[tab];
  const list = rows[tab] || [];

  p.innerHTML = `
    <div class="toolbar">
      <h2>${esc(d.name)}</h2>
      ${isAdmin
        ? `<button data-add="${tab}">＋ 新增</button>`
        : ''}
    </div>
    <div class="panel">
      ${list.map(x => rowHtml(tab,x)).join('')
        || '<div class="empty">尚無資料</div>'}
    </div>`;

  wireEdit();
}

function guestList() {
  $('#guestList').innerHTML =
    (rows.guests || [])
      .filter(x => x.name?.includes(search))
      .map(x => rowHtml('guests',x))
      .join('')
    || '<div class="empty">沒有符合的賓客</div>';

  wireEdit();
}

function vendorList() {
  $('#vendorList').innerHTML =
    (rows.vendors || [])
      .filter(x =>
        vendorFilter === '全部' ||
        x.status === vendorFilter
      )
      .map(x => rowHtml('vendors',x))
      .join('')
    || '<div class="empty">尚無廠商項目</div>';

  wireEdit();
}

function wireEdit() {
  document.querySelectorAll('[data-edit]').forEach(b => {
    b.onclick = () =>
      openForm(b.dataset.edit,b.dataset.id);
  });
}

function changeTab(t) {
  tab = t;
  search = '';
  render();
  window.scrollTo({top:0,behavior:'smooth'});
}

async function addPresets() {
  if (!isAdmin) return;

  const existing = new Set(
    (rows.vendors || []).map(x => x.name)
  );

  const newNames = vendorDefaults.filter(
    n => !existing.has(n)
  );

  if (!newNames.length) {
    alert('常見項目已全部加入。');
    return;
  }

  if (!confirm(`新增 ${newNames.length} 個常見項目？`))
    return;

  const {error} = await db.from('wedding_vendors')
    .insert(newNames.map(name => ({
      name,
      category:'婚禮常見項目',
      status:'未聯絡',
      amount:0,
      paid:0
    })));

  if (error) return err(error);

  await load();
}

async function verify() {
  const {data:{user},error:userError} =
    await db.auth.getUser();

  if (userError && userError.name !== 'AuthSessionMissingError') {
    console.warn(userError);
  }

  me = user || null;
  isAdmin = false;

  if (me) {
    const {data,error} = await db
      .from('wedding_admins')
      .select('user_id')
      .eq('user_id',me.id)
      .maybeSingle();

    if (error) err(error);
    isAdmin = !!data;
  }

  $('#identity').textContent = isAdmin
    ? `管理員 · ${me.email}`
    : '訪客 · 唯讀模式';

  $('#loginToggle').hidden = isAdmin;
  $('#logout').hidden = !me;
  $('#auth').hidden = true;

  await load();
}

async function init() {
  if (!window.supabase) {
    message('無法載入 Supabase 程式庫。',true);
    return;
  }

  db = window.supabase.createClient(
    SUPABASE_URL,KEY,{
      auth:{
        detectSessionInUrl:true,
        autoRefreshToken:true,
        persistSession:true
      }
    }
  );

  db.auth.onAuthStateChange(event => {
    if (event === 'PASSWORD_RECOVERY') {
      $('#auth').hidden = false;
      $('#passwordSetup').hidden = false;
      message('請設定新密碼。');
    } else if (
      ['SIGNED_IN','SIGNED_OUT','INITIAL_SESSION'].includes(event)
    ) {
      setTimeout(verify,0);
    }
  });

  $('#loginToggle').onclick = () => {
    $('#auth').hidden = !$('#auth').hidden;
  };

  $('#login').onsubmit = async e => {
    e.preventDefault();

    const {error} = await db.auth.signInWithPassword({
      email:$('#email').value.trim(),
      password:$('#password').value
    });

    if (error) err(error);
    else await verify();
  };

  $('#reset').onclick = async () => {
    const email = $('#email').value.trim();

    if (!email) {
      alert('請先輸入 Email');
      return;
    }

    const {error} = await db.auth.resetPasswordForEmail(
      email,{
        redirectTo:location.origin + location.pathname
      }
    );

    if (error) err(error);
    else message('若帳號存在，密碼重設信已送出。');
  };

  $('#setPassword').onclick = async () => {
    const password = $('#newPassword').value;

    if (password.length < 6) {
      alert('密碼至少 6 碼');
      return;
    }

    const {error} = await db.auth.updateUser({password});

    if (error) return err(error);

    $('#passwordSetup').hidden = true;
    await verify();
  };

  $('#logout').onclick = async () => {
    await db.auth.signOut();
    await verify();
  };

  $('#recordForm').onsubmit = saveForm;
  $('#cancel').onclick = () => $('#dialog').close();
  $('#delete').onclick = removeForm;

  $('#tabs').onclick = e => {
    const b = e.target.closest('[data-tab]');
    if (b) changeTab(b.dataset.tab);
  };

  $('#page').onclick = e => {
    const b = e.target.closest('[data-add]');
    if (b) openForm(b.dataset.add);
  };

  await verify();
}

init().catch(err);
