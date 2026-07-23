// =========================================================
// タスク管理アプリ プロトタイプ
// サーバー不要・localStorageのみで動作する動作確認用モックです。
// 本番実装ではなく、docs/requirements.md 一式を再現した検証用コードです。
// =========================================================
'use strict';

// --- 定数 ---

var STORAGE_KEY = 'taskmgmt.prototype.v1';

var STATUS_ORDER = ['todo', 'doing', 'done'];

var STATUS_LABELS = {
  todo: '未着手',
  doing: '作業中',
  done: '完了'
};

var LABEL_COLORS = [
  { key: 'red', hex: '#e74c3c' },
  { key: 'orange', hex: '#e67e22' },
  { key: 'yellow', hex: '#f1c40f' },
  { key: 'green', hex: '#2ecc71' },
  { key: 'blue', hex: '#3498db' },
  { key: 'purple', hex: '#9b59b6' },
  { key: 'pink', hex: '#e84393' },
  { key: 'gray', hex: '#7f8c8d' }
];

// --- グローバル状態 ---
// state: localStorageに保存されるデータ本体（boards / cards / labels）
// ui: 画面の表示状態（保存はしない。リロードのたびに初期化される）

var state = null;

var ui = {
  mode: 'view',          // 'view' | 'search' | 'archive'
  selectedView: 'cross',  // 'cross' | boardId
  mobileActiveStatus: 'todo',
  openCardId: null,
  openCardMenuId: null,
  showLabelPicker: false,
  showLabelCreator: false,
  labelCreatorColor: LABEL_COLORS[0].hex,
  renamingBoardId: null,
  quickAddBoardId: null,   // どのボード(のtodo列)でクイック追加フォームを開いているか
  searchKeyword: '',
  searchLabelIds: [],
  confirmHandler: null
};

var dragCardInfo = null;   // { cardId, sourceStatus, sourceBoardId }
var dragBoardInfo = null;  // { boardId }
var toastTimer = null;

// --- ユーティリティ ---

function pad2(n) {
  return String(n).padStart(2, '0');
}

function dateToStr(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function todayStr() {
  return dateToStr(new Date());
}

function addDaysStr(baseDate, days) {
  var d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + days);
  return dateToStr(d);
}

function formatDateForDisplay(dueDateStr) {
  if (!dueDateStr) return '';
  var parts = dueDateStr.split('-');
  if (parts.length !== 3) return dueDateStr;
  return parts[0] + '/' + parseInt(parts[1], 10) + '/' + parseInt(parts[2], 10);
}

// 期日の強調表示区分を返す（要件5.6）
// 'overdue' = 期限切れ（今日より過去） / 'soon' = 期限間近（前日〜当日） / null = 強調なし
function getDueStatus(dueDateStr) {
  if (!dueDateStr) return null;
  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var parts = dueDateStr.split('-').map(Number);
  var due = new Date(parts[0], parts[1] - 1, parts[2]);
  var diffDays = Math.round((due - today) / 86400000);
  if (diffDays < 0) return 'overdue';
  if (diffDays === 0 || diffDays === 1) return 'soon';
  return null;
}

function escapeHtml(str) {
  var map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(str == null ? '' : str).replace(/[&<>"']/g, function (ch) {
    return map[ch];
  });
}

var uidCounter = 0;
function uid(prefix) {
  uidCounter += 1;
  return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + uidCounter + '_' + Math.random().toString(36).slice(2, 7);
}

// 背景色に応じて読みやすい文字色（白 or 濃紺）を返す
function getContrastTextColor(hex) {
  var c = hex.replace('#', '');
  var r = parseInt(c.substring(0, 2), 16);
  var g = parseInt(c.substring(2, 4), 16);
  var b = parseInt(c.substring(4, 6), 16);
  var luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#172b4d' : '#ffffff';
}

// --- 初期サンプルデータ ---
// docs/requirements/03-screens.md のワイヤーフレームをもとに、
// 「今日」を基準にした相対日付で期限切れ/期限間近の例を再現する。

function createSeedState() {
  var today = todayStr();
  var now = new Date();

  var boards = [
    { id: 'seed-board-work', name: '仕事', position: 0, createdAt: today },
    { id: 'seed-board-home', name: '家事', position: 1, createdAt: today }
  ];

  var labels = [
    { id: 'seed-label-priority', boardId: 'seed-board-work', name: '優先', color: '#e74c3c' },
    { id: 'seed-label-external', boardId: 'seed-board-work', name: '社外', color: '#3498db' }
  ];

  var overdueDate = addDaysStr(now, -2);
  var soonDateTomorrow = addDaysStr(now, 1);
  var soonDateToday = addDaysStr(now, 0);

  var cards = [
    {
      id: 'seed-card-1', boardId: 'seed-board-work', title: '資料作成',
      description: 'A社向け提案資料', dueDate: overdueDate, status: 'todo',
      isArchived: false, position: 0, createdAt: today, updatedAt: today,
      labelIds: ['seed-label-priority', 'seed-label-external']
    },
    {
      id: 'seed-card-2', boardId: 'seed-board-work', title: '関係者へ連絡',
      description: '', dueDate: soonDateTomorrow, status: 'todo',
      isArchived: false, position: 1, createdAt: today, updatedAt: today, labelIds: []
    },
    {
      id: 'seed-card-3', boardId: 'seed-board-work', title: '見積書作成',
      description: '', dueDate: '', status: 'doing',
      isArchived: false, position: 0, createdAt: today, updatedAt: today, labelIds: []
    },
    {
      id: 'seed-card-4', boardId: 'seed-board-work', title: '議事録まとめ',
      description: '', dueDate: '', status: 'done',
      isArchived: false, position: 0, createdAt: today, updatedAt: today, labelIds: []
    },
    {
      id: 'seed-card-5', boardId: 'seed-board-home', title: '皿洗い',
      description: '', dueDate: '', status: 'todo',
      isArchived: false, position: 0, createdAt: today, updatedAt: today, labelIds: []
    },
    {
      id: 'seed-card-6', boardId: 'seed-board-home', title: '郵便局へ行く',
      description: '', dueDate: '', status: 'doing',
      isArchived: false, position: 0, createdAt: today, updatedAt: today, labelIds: []
    },
    {
      id: 'seed-card-7', boardId: 'seed-board-home', title: '買い出し',
      description: '', dueDate: soonDateToday, status: 'done',
      isArchived: false, position: 0, createdAt: today, updatedAt: today, labelIds: []
    },
    {
      id: 'seed-card-8', boardId: 'seed-board-work', title: '打ち合わせメモ整理',
      description: '', dueDate: '', status: 'done',
      isArchived: true, position: 0, createdAt: today, updatedAt: today, labelIds: []
    },
    {
      id: 'seed-card-9', boardId: 'seed-board-home', title: '洗濯',
      description: '', dueDate: '', status: 'done',
      isArchived: true, position: 1, createdAt: today, updatedAt: today, labelIds: []
    }
  ];

  return { boards: boards, cards: cards, labels: labels };
}

// --- 永続化（localStorage） ---
// file:// で開いた際にlocalStorageが使えない環境でもアプリ自体は動くよう、
// 読み書き失敗時はメモリ上のstateのみで動作を継続する（フォールバック）。

function loadState() {
  try {
    var raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.boards) && Array.isArray(parsed.cards) && Array.isArray(parsed.labels)) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('localStorageの読み込みに失敗しました。初期データを使用します。', e);
  }
  return createSeedState();
}

function saveState() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('localStorageへの保存に失敗しました。', e);
    showToast('保存に失敗しました（この端末では変更が保持されない可能性があります）');
  }
}

function resetToSeedData() {
  state = createSeedState();
  ui.mode = 'view';
  ui.selectedView = 'cross';
  ui.openCardId = null;
  ui.openCardMenuId = null;
  ui.renamingBoardId = null;
  ui.quickAddBoardId = null;
  ui.searchKeyword = '';
  ui.searchLabelIds = [];
  saveState();
  renderAll();
  showToast('サンプルデータにリセットしました');
}

// --- 派生データ取得ヘルパー ---

function getBoards() {
  return state.boards.slice().sort(function (a, b) { return a.position - b.position; });
}

function getBoard(boardId) {
  return state.boards.find(function (b) { return b.id === boardId; }) || null;
}

function getLabelsForBoard(boardId) {
  return state.labels.filter(function (l) { return l.boardId === boardId; });
}

function getLabel(labelId) {
  return state.labels.find(function (l) { return l.id === labelId; }) || null;
}

function getCard(cardId) {
  return state.cards.find(function (c) { return c.id === cardId; }) || null;
}

function getActiveCardsForBoard(boardId, status) {
  return state.cards
    .filter(function (c) { return c.boardId === boardId && c.status === status && !c.isArchived; })
    .sort(function (a, b) { return a.position - b.position; });
}

function getArchivedCards() {
  return state.cards
    .filter(function (c) { return c.isArchived; })
    .sort(function (a, b) { return (b.updatedAt || '').localeCompare(a.updatedAt || ''); });
}

function countActiveCardsForBoard(boardId) {
  return state.cards.filter(function (c) { return c.boardId === boardId && !c.isArchived; }).length;
}

// --- 描画: 全体 ---

function renderAll() {
  renderHeader();
  renderMain();
}

function renderHeader() {
  var select = document.getElementById('viewSelect');
  var boards = getBoards();
  var options = ['<option value="cross">すべて</option>'];
  boards.forEach(function (b) {
    options.push('<option value="' + escapeHtml(b.id) + '">' + escapeHtml(b.name) + '</option>');
  });
  select.innerHTML = options.join('');
  // ボード削除等でselectedViewが存在しなくなった場合は横断ビューへフォールバック
  var stillExists = ui.selectedView === 'cross' || getBoard(ui.selectedView);
  if (!stillExists) {
    ui.selectedView = 'cross';
  }
  select.value = ui.selectedView;
}

function renderMain() {
  var mainArea = document.getElementById('mainArea');
  if (ui.mode === 'search') {
    mainArea.innerHTML = buildSearchViewHtml();
    updateSearchResults();
    return;
  }
  if (ui.mode === 'archive') {
    mainArea.innerHTML = buildArchiveViewHtml();
    return;
  }
  if (ui.selectedView === 'cross') {
    mainArea.innerHTML = buildCrossViewHtml();
  } else {
    mainArea.innerHTML = buildKanbanHtml(ui.selectedView);
  }
  applyMobileActiveTab();
}

// スマホ表示のタブ切り替え状態をDOMへ反映する（再描画とは別に呼べる軽量処理）
function applyMobileActiveTab() {
  var cols = document.querySelectorAll('#mainArea .kanban-col');
  cols.forEach(function (col) {
    col.classList.toggle('mobile-active', col.getAttribute('data-status') === ui.mobileActiveStatus);
  });
  var tabs = document.querySelectorAll('#mainArea .mobile-tab');
  tabs.forEach(function (tab) {
    tab.classList.toggle('active', tab.getAttribute('data-status') === ui.mobileActiveStatus);
  });
}

function buildMobileTabsHtml(countsByStatus) {
  var items = STATUS_ORDER.map(function (status) {
    var count = countsByStatus[status] || 0;
    return '<button type="button" class="mobile-tab" data-action="switch-mobile-tab" data-status="' + status + '">' +
      escapeHtml(STATUS_LABELS[status]) + ' (' + count + ')' +
      '</button>';
  });
  return '<div class="mobile-tabs">' + items.join('') + '</div>';
}

// --- 描画: カード（カンバン／横断ビュー／検索結果で共用） ---

function buildCardHtml(card) {
  var dueStatus = getDueStatus(card.dueDate);
  var dueHtml = '';
  if (card.dueDate) {
    var icon = dueStatus === 'overdue' ? '🔴' : (dueStatus === 'soon' ? '🟡' : '');
    var cls = dueStatus ? ' ' + dueStatus : '';
    dueHtml = '<span class="card-due' + cls + '">' + icon + ' ' + escapeHtml(formatDateForDisplay(card.dueDate)) + '</span>';
  }

  var labelsHtml = '';
  if (card.labelIds && card.labelIds.length) {
    labelsHtml = '<div class="card-labels">' + card.labelIds.map(function (lid) {
      var label = getLabel(lid);
      if (!label) return '';
      return '<span class="label-chip" style="background:' + label.color + ';color:' + getContrastTextColor(label.color) + '">' + escapeHtml(label.name) + '</span>';
    }).join('') + '</div>';
  }

  var moveMenuItems = STATUS_ORDER.map(function (s) {
    var isCurrent = s === card.status;
    return '<button type="button" class="card-menu-item' + (isCurrent ? ' active-status' : '') + '" data-action="move-card" data-card-id="' + card.id + '" data-status="' + s + '"' + (isCurrent ? ' disabled' : '') + '>' +
      (isCurrent ? '✓ ' : '') + escapeHtml(STATUS_LABELS[s]) + '</button>';
  }).join('');

  var archiveDisabled = card.status !== 'done';
  var menuHtml = '';
  if (ui.openCardMenuId === card.id) {
    menuHtml = '<div class="card-menu" data-card-menu="' + card.id + '">' +
      '<button type="button" class="card-menu-item" data-action="open-card" data-card-id="' + card.id + '">✏️ 編集</button>' +
      '<div class="card-menu-divider"></div>' +
      '<div class="card-menu-section-label">移動</div>' +
      moveMenuItems +
      '<div class="card-menu-divider"></div>' +
      '<button type="button" class="card-menu-item" data-action="archive-card-quick" data-card-id="' + card.id + '"' +
        (archiveDisabled ? ' disabled title="完了ステータスのカードのみアーカイブできます"' : '') + '>📥 アーカイブ</button>' +
      '<button type="button" class="card-menu-item danger" data-action="delete-card-quick" data-card-id="' + card.id + '">🗑 削除</button>' +
    '</div>';
  }

  var mobileMoveBtnHtml = '<button type="button" class="card-move-btn" data-action="toggle-card-menu" data-card-id="' + card.id + '">移動 ▾</button>';

  return (
    '<div class="card" draggable="true" data-card-id="' + card.id + '" data-action="open-card" data-status="' + card.status + '">' +
      '<button type="button" class="card-menu-btn" data-action="toggle-card-menu" data-card-id="' + card.id + '" title="操作メニュー">⋯</button>' +
      menuHtml +
      '<p class="card-title">' + escapeHtml(card.title) + '</p>' +
      '<div class="card-meta-row">' + dueHtml + '</div>' +
      labelsHtml +
      mobileMoveBtnHtml +
    '</div>'
  );
}

// --- 描画: ボード詳細（カンバン、単一ボード） ---

function buildQuickAddHtml(boardId) {
  if (ui.quickAddBoardId === boardId) {
    return (
      '<div class="quick-add-form">' +
        '<input type="text" class="quick-add-input" id="quickAddInput" data-board-id="' + boardId + '" placeholder="カードのタイトルを入力してEnter" maxlength="200">' +
        '<div class="quick-add-actions">' +
          '<button type="button" class="btn btn-primary btn-sm" data-action="submit-quick-add" data-board-id="' + boardId + '" disabled>追加</button>' +
          '<button type="button" class="btn btn-secondary btn-sm" data-action="cancel-quick-add">キャンセル</button>' +
        '</div>' +
      '</div>'
    );
  }
  return '<button type="button" class="quick-add-toggle" data-action="start-quick-add" data-board-id="' + boardId + '">＋ カードを追加</button>';
}

function buildKanbanHtml(boardId) {
  var board = getBoard(boardId);
  if (!board) {
    return '<p class="empty-hint">ボードが見つかりません。上部のセレクトから別のボードを選択してください。</p>';
  }
  var countsByStatus = {};
  STATUS_ORDER.forEach(function (s) { countsByStatus[s] = getActiveCardsForBoard(boardId, s).length; });

  var colsHtml = STATUS_ORDER.map(function (status) {
    var cards = getActiveCardsForBoard(boardId, status);
    var cardsHtml = cards.map(function (c) { return buildCardHtml(c); }).join('');
    var quickAddHtml = status === 'todo' ? buildQuickAddHtml(boardId) : '';
    return (
      '<div class="kanban-col" data-status="' + status + '">' +
        '<div class="kanban-col-header">' +
          '<span class="kanban-col-title">' + STATUS_LABELS[status] + '</span>' +
          '<span class="kanban-col-count">' + cards.length + '</span>' +
        '</div>' +
        '<div class="card-list" data-dropzone="status" data-status="' + status + '" data-board-id="' + boardId + '">' + cardsHtml + '</div>' +
        quickAddHtml +
      '</div>'
    );
  }).join('');

  return buildMobileTabsHtml(countsByStatus) + '<div class="kanban">' + colsHtml + '</div>';
}

// --- 描画: 横断マージビュー ---

function buildCrossViewHtml() {
  var boards = getBoards();
  if (!boards.length) {
    return '<p class="empty-hint">ボードがありません。⚙（ボード管理）から新しいボードを作成してください。</p>';
  }
  var countsByStatus = {};
  STATUS_ORDER.forEach(function (status) {
    countsByStatus[status] = boards.reduce(function (sum, b) {
      return sum + getActiveCardsForBoard(b.id, status).length;
    }, 0);
  });

  var colsHtml = STATUS_ORDER.map(function (status) {
    var sectionsHtml = boards.map(function (board) {
      var cards = getActiveCardsForBoard(board.id, status);
      var cardsHtml = cards.map(function (c) { return buildCardHtml(c); }).join('');
      var quickAddHtml = status === 'todo' ? buildQuickAddHtml(board.id) : '';
      return (
        '<div class="cross-board-section">' +
          '<p class="cross-board-section-title">▼ ' + escapeHtml(board.name) + '</p>' +
          '<div class="card-list" data-dropzone="status" data-status="' + status + '" data-board-id="' + board.id + '">' + cardsHtml + '</div>' +
          quickAddHtml +
        '</div>'
      );
    }).join('');
    return (
      '<div class="kanban-col" data-status="' + status + '">' +
        '<div class="kanban-col-header">' +
          '<span class="kanban-col-title">' + STATUS_LABELS[status] + '</span>' +
          '<span class="kanban-col-count">' + countsByStatus[status] + '</span>' +
        '</div>' +
        sectionsHtml +
      '</div>'
    );
  }).join('');

  return buildMobileTabsHtml(countsByStatus) + '<div class="kanban">' + colsHtml + '</div>';
}

// --- 描画: 検索結果画面 ---

function buildLabelFilterChipsHtml() {
  // ラベルはボード単位で管理されているため、絞り込み候補もボードごとにグループ化して表示する
  var groupsHtml = getBoards().map(function (board) {
    var labels = getLabelsForBoard(board.id);
    if (!labels.length) return '';
    var chipsHtml = labels.map(function (label) {
      var selected = ui.searchLabelIds.indexOf(label.id) !== -1;
      var styleAttr = selected ? ' style="background:' + label.color + ';color:' + getContrastTextColor(label.color) + ';border-color:' + label.color + ';"' : '';
      return (
        '<button type="button" class="label-filter-chip' + (selected ? ' selected' : '') + '" data-action="toggle-search-label" data-label-id="' + label.id + '"' + styleAttr + '>' +
          escapeHtml(label.name) +
        '</button>'
      );
    }).join('');
    return (
      '<div class="label-filter-group">' +
        '<p class="label-filter-group-title">' + escapeHtml(board.name) + '</p>' +
        '<div class="label-filter-group-chips">' + chipsHtml + '</div>' +
      '</div>'
    );
  }).join('');
  return groupsHtml || '<span class="label-picker-empty">ラベルがまだありません</span>';
}

function buildSearchViewHtml() {
  return (
    '<div class="search-header">' +
      '<button type="button" class="back-link" data-action="close-search">← 戻る</button>' +
      '<h2>🔍 検索</h2>' +
      '<input type="text" id="searchKeywordInput" class="search-keyword-input" placeholder="キーワード（タイトル・説明）" value="' + escapeHtml(ui.searchKeyword) + '">' +
    '</div>' +
    '<div class="label-filter-bar" id="searchLabelFilterBar">' + buildLabelFilterChipsHtml() + '</div>' +
    '<p class="search-count" id="searchCount"></p>' +
    '<div class="search-results" id="searchResultsList"></div>'
  );
}

// 検索キーワード/ラベル絞り込みの結果のみを更新する（検索欄自体は再描画しない＝フォーカスを維持するため）
function updateSearchResults() {
  var countEl = document.getElementById('searchCount');
  var listEl = document.getElementById('searchResultsList');
  if (!countEl || !listEl) return;

  var keyword = ui.searchKeyword.trim().toLowerCase();
  var results = state.cards.filter(function (c) {
    if (c.isArchived) return false;
    if (keyword) {
      var haystack = (c.title + ' ' + (c.description || '')).toLowerCase();
      if (haystack.indexOf(keyword) === -1) return false;
    }
    if (ui.searchLabelIds.length) {
      var hasAll = ui.searchLabelIds.every(function (lid) { return c.labelIds.indexOf(lid) !== -1; });
      if (!hasAll) return false;
    }
    return true;
  }).sort(function (a, b) { return (b.updatedAt || '').localeCompare(a.updatedAt || ''); });

  countEl.textContent = results.length + '件ヒット';
  listEl.innerHTML = results.map(function (c) { return buildSearchResultItemHtml(c); }).join('') ||
    '<p class="empty-hint">条件に一致するカードがありません。</p>';
}

function buildSearchResultItemHtml(card) {
  var board = getBoard(card.boardId);
  var dueStatus = getDueStatus(card.dueDate);
  var dueHtml = '';
  if (card.dueDate) {
    var icon = dueStatus === 'overdue' ? '🔴' : (dueStatus === 'soon' ? '🟡' : '');
    var cls = dueStatus ? ' ' + dueStatus : '';
    dueHtml = '<span class="card-due' + cls + '">' + icon + ' ' + escapeHtml(formatDateForDisplay(card.dueDate)) + '</span>';
  }
  var labelsHtml = card.labelIds.map(function (lid) {
    var label = getLabel(lid);
    if (!label) return '';
    return '<span class="label-chip" style="background:' + label.color + ';color:' + getContrastTextColor(label.color) + '">' + escapeHtml(label.name) + '</span>';
  }).join('');

  return (
    '<div class="search-result-item" data-action="open-card" data-card-id="' + card.id + '">' +
      '<p class="card-title">' + escapeHtml(card.title) + '</p>' +
      '<div class="search-result-meta">' +
        '<span>' + escapeHtml(board ? board.name : '(削除済みボード)') + ' / ' + STATUS_LABELS[card.status] + '</span>' +
        dueHtml + labelsHtml +
      '</div>' +
    '</div>'
  );
}

// --- 描画: アーカイブ画面 ---

function buildArchiveViewHtml() {
  return (
    '<div class="archive-header">' +
      '<button type="button" class="back-link" data-action="close-archive">← 戻る</button>' +
      '<h2>📥 アーカイブ</h2>' +
    '</div>' +
    '<div class="archive-list" id="archiveList">' + buildArchiveListHtml() + '</div>'
  );
}

function buildArchiveListHtml() {
  var cards = getArchivedCards();
  if (!cards.length) {
    return '<p class="empty-hint">アーカイブ済みのカードはありません。</p>';
  }
  return cards.map(function (card) {
    var board = getBoard(card.boardId);
    return (
      '<div class="archive-item">' +
        '<div class="archive-item-info">' +
          '<p class="archive-item-title">' + escapeHtml(card.title) + '</p>' +
          '<p class="archive-item-origin">元: ' + escapeHtml(board ? board.name : '(削除済みボード)') + '</p>' +
        '</div>' +
        '<div class="archive-item-actions">' +
          '<button type="button" class="btn btn-secondary btn-sm" data-action="restore-card" data-card-id="' + card.id + '">復元</button>' +
          '<button type="button" class="btn btn-danger btn-sm" data-action="delete-forever" data-card-id="' + card.id + '">完全削除</button>' +
        '</div>' +
      '</div>'
    );
  }).join('');
}

// --- トースト通知 ---

function showToast(message) {
  var el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function () {
    el.classList.remove('show');
  }, 2200);
}

// --- 汎用確認ダイアログ ---

function showConfirm(message, onConfirm, okLabel) {
  document.getElementById('confirmMessage').textContent = message;
  document.getElementById('confirmOkBtn').textContent = okLabel || '実行';
  ui.confirmHandler = onConfirm;
  document.getElementById('confirmModal').classList.remove('hidden');
}

function closeConfirm() {
  ui.confirmHandler = null;
  document.getElementById('confirmModal').classList.add('hidden');
}

function handleConfirmOk() {
  var handler = ui.confirmHandler;
  closeConfirm();
  if (typeof handler === 'function') handler();
}

// --- ステータス変更の共通処理（D&D／移動メニュー／カード詳細の保存で共用） ---

function moveCardToStatus(card, newStatus) {
  if (card.status === newStatus) return;
  var siblings = state.cards.filter(function (c) {
    return c.id !== card.id && c.boardId === card.boardId && c.status === newStatus && !c.isArchived;
  });
  var maxPos = siblings.reduce(function (max, c) { return Math.max(max, c.position); }, -1);
  card.status = newStatus;
  card.position = maxPos + 1;
  card.updatedAt = todayStr();
}

function handleMoveCardAction(cardId, newStatus) {
  var card = getCard(cardId);
  if (!card) return;
  moveCardToStatus(card, newStatus);
  ui.openCardMenuId = null;
  saveState();
  renderAll();
  showToast(STATUS_LABELS[newStatus] + 'へ移動しました');
}

function toggleCardMenu(cardId) {
  ui.openCardMenuId = (ui.openCardMenuId === cardId) ? null : cardId;
  renderMain();
}

// --- カードのアーカイブ／削除／復元（カード詳細・カードメニュー・アーカイブ画面で共用） ---

function archiveCard(cardId) {
  var card = getCard(cardId);
  if (!card) return;
  if (card.status !== 'done') {
    showToast('完了ステータスのカードのみアーカイブできます');
    return;
  }
  card.isArchived = true;
  card.updatedAt = todayStr();
  ui.openCardMenuId = null;
  if (ui.openCardId === cardId) closeCardModal();
  saveState();
  renderAll();
  showToast('アーカイブしました');
}

function deleteCardById(cardId) {
  var idx = state.cards.findIndex(function (c) { return c.id === cardId; });
  if (idx === -1) return;
  var title = state.cards[idx].title;
  state.cards.splice(idx, 1);
  ui.openCardMenuId = null;
  if (ui.openCardId === cardId) closeCardModal();
  saveState();
  renderAll();
  showToast('「' + title + '」を削除しました');
}

function confirmDeleteCard(cardId) {
  var card = getCard(cardId);
  if (!card) return;
  showConfirm('「' + card.title + '」を完全に削除します。この操作は取り消せません。よろしいですか？', function () {
    deleteCardById(cardId);
  }, '削除する');
}

function confirmDeleteForever(cardId) {
  var card = getCard(cardId);
  if (!card) return;
  showConfirm('「' + card.title + '」をアーカイブから完全に削除します。この操作は取り消せません。よろしいですか？', function () {
    deleteCardById(cardId);
  }, '完全に削除する');
}

function restoreCard(cardId) {
  var card = getCard(cardId);
  if (!card) return;
  card.isArchived = false;
  var siblings = state.cards.filter(function (c) {
    return c.id !== card.id && c.boardId === card.boardId && c.status === card.status && !c.isArchived;
  });
  var maxPos = siblings.reduce(function (max, c) { return Math.max(max, c.position); }, -1);
  card.position = maxPos + 1;
  card.updatedAt = todayStr();
  saveState();
  renderAll();
  showToast('元のボードに復元しました');
}

// --- カード詳細モーダル ---

function openCardModal(cardId) {
  var card = getCard(cardId);
  if (!card) return;
  ui.openCardId = cardId;
  ui.openCardMenuId = null;
  ui.showLabelPicker = false;
  ui.showLabelCreator = false;
  populateCardModal(card);
  document.getElementById('cardModal').classList.remove('hidden');
}

function closeCardModal() {
  ui.openCardId = null;
  ui.showLabelPicker = false;
  ui.showLabelCreator = false;
  document.getElementById('cardModal').classList.add('hidden');
}

function populateCardModal(card) {
  document.getElementById('cardTitleInput').value = card.title;
  document.getElementById('cardStatusSelect').value = card.status;
  document.getElementById('cardDescInput').value = card.description || '';
  document.getElementById('cardDueInput').value = card.dueDate || '';
  updateCardDueIndicator(card.dueDate);
  renderCardLabelsSection(card);

  var board = getBoard(card.boardId);
  document.getElementById('cardMetaInfo').textContent = 'ボード：' + (board ? board.name : '(不明)');

  var archiveBtn = document.getElementById('btnCardArchive');
  var isDone = card.status === 'done';
  archiveBtn.disabled = !isDone;
  archiveBtn.title = isDone ? '' : '完了ステータスのカードのみアーカイブできます';
  archiveBtn.classList.toggle('btn-disabled', !isDone);
}

function updateCardDueIndicator(dueDateStr) {
  var el = document.getElementById('cardDueIndicator');
  var status = getDueStatus(dueDateStr);
  el.classList.remove('overdue', 'soon');
  if (status === 'overdue') {
    el.textContent = '🔴 期限切れ';
    el.classList.add('overdue');
  } else if (status === 'soon') {
    el.textContent = '🟡 期限間近';
    el.classList.add('soon');
  } else {
    el.textContent = '';
  }
}

function saveCardForm(e) {
  if (e) e.preventDefault();
  var card = getCard(ui.openCardId);
  if (!card) return;
  var title = document.getElementById('cardTitleInput').value.trim();
  if (!title) {
    showToast('タイトルを入力してください');
    return;
  }
  card.title = title;
  card.description = document.getElementById('cardDescInput').value;
  card.dueDate = document.getElementById('cardDueInput').value;
  var newStatus = document.getElementById('cardStatusSelect').value;
  if (newStatus !== card.status) {
    moveCardToStatus(card, newStatus);
  } else {
    card.updatedAt = todayStr();
  }
  saveState();
  closeCardModal();
  renderAll();
  showToast('保存しました');
}

// --- カード詳細モーダル内: ラベルの付与・作成 ---

function renderCardLabelsSection(card) {
  if (!card) return;
  var container = document.getElementById('cardLabelsSection');
  container.innerHTML = buildCardLabelsSectionHtml(card);
}

function buildCardLabelsSectionHtml(card) {
  var assignedHtml = card.labelIds.map(function (lid) {
    var label = getLabel(lid);
    if (!label) return '';
    return (
      '<span class="assigned-label-chip" style="background:' + label.color + ';color:' + getContrastTextColor(label.color) + '">' +
        escapeHtml(label.name) +
        '<button type="button" class="assigned-label-remove" data-action="toggle-card-label" data-card-id="' + card.id + '" data-label-id="' + label.id + '" title="外す">×</button>' +
      '</span>'
    );
  }).join('');

  var html = '<div class="assigned-labels">' + assignedHtml + '</div>';
  html += '<button type="button" class="label-add-btn" data-action="toggle-label-picker">＋ ラベルを追加</button>';

  if (ui.showLabelPicker) {
    var boardLabels = getLabelsForBoard(card.boardId);
    var unassigned = boardLabels.filter(function (l) { return card.labelIds.indexOf(l.id) === -1; });
    var listHtml = unassigned.map(function (label) {
      return (
        '<button type="button" class="label-picker-item" data-action="toggle-card-label" data-card-id="' + card.id + '" data-label-id="' + label.id + '" style="background:' + label.color + ';color:' + getContrastTextColor(label.color) + '">' +
          escapeHtml(label.name) +
        '</button>'
      );
    }).join('');

    var creatorHtml;
    if (ui.showLabelCreator) {
      var swatches = LABEL_COLORS.map(function (c) {
        var selected = c.hex === ui.labelCreatorColor;
        return '<button type="button" class="color-swatch' + (selected ? ' selected' : '') + '" data-action="pick-label-color" data-color="' + c.hex + '" style="background:' + c.hex + '" title="' + c.key + '"></button>';
      }).join('');
      creatorHtml = (
        '<div class="label-creator">' +
          '<p class="label-picker-section-title">新しいラベルを作成</p>' +
          '<div class="color-swatch-list">' + swatches + '</div>' +
          '<div class="label-creator-row">' +
            '<input type="text" id="newLabelNameInput" class="form-input" placeholder="ラベル名" maxlength="30">' +
            '<button type="button" class="btn btn-primary btn-sm" data-action="create-label" data-card-id="' + card.id + '">作成</button>' +
          '</div>' +
        '</div>'
      );
    } else {
      creatorHtml = '<button type="button" class="label-add-btn" data-action="toggle-label-creator">＋ 新しいラベルを作成</button>';
    }

    html += (
      '<div class="label-picker">' +
        '<p class="label-picker-section-title">このボードのラベルから選択</p>' +
        (unassigned.length ? '<div class="label-picker-list">' + listHtml + '</div>' : '<p class="label-picker-empty">割り当て可能なラベルがありません</p>') +
        creatorHtml +
      '</div>'
    );
  }

  return html;
}

function toggleCardLabel(cardId, labelId) {
  var card = getCard(cardId);
  if (!card) return;
  var idx = card.labelIds.indexOf(labelId);
  if (idx === -1) {
    card.labelIds.push(labelId);
  } else {
    card.labelIds.splice(idx, 1);
  }
  card.updatedAt = todayStr();
  saveState();
  renderCardLabelsSection(card);
  renderMain();
}

function createLabelForCard(cardId) {
  var card = getCard(cardId);
  if (!card) return;
  var nameInput = document.getElementById('newLabelNameInput');
  var name = nameInput ? nameInput.value.trim() : '';
  if (!name) {
    showToast('ラベル名を入力してください');
    return;
  }
  var label = { id: uid('label'), boardId: card.boardId, name: name, color: ui.labelCreatorColor };
  state.labels.push(label);
  card.labelIds.push(label.id);
  card.updatedAt = todayStr();
  ui.showLabelCreator = false;
  ui.labelCreatorColor = LABEL_COLORS[0].hex;
  saveState();
  renderCardLabelsSection(card);
  renderMain();
  showToast('ラベル「' + name + '」を作成しました');
}

// --- クイック追加（各ボードのtodo列「＋カードを追加」） ---

function startQuickAdd(boardId) {
  ui.quickAddBoardId = boardId;
  renderMain();
  var input = document.getElementById('quickAddInput');
  if (input) input.focus();
}

function cancelQuickAdd() {
  ui.quickAddBoardId = null;
  renderMain();
}

function submitQuickAdd(boardId) {
  var input = document.getElementById('quickAddInput');
  var title = input ? input.value.trim() : '';
  if (!title) {
    showToast('タイトルを入力してください');
    return;
  }
  var siblings = getActiveCardsForBoard(boardId, 'todo');
  var maxPos = siblings.reduce(function (max, c) { return Math.max(max, c.position); }, -1);
  var today = todayStr();
  var card = {
    id: uid('card'), boardId: boardId, title: title, description: '', dueDate: '',
    status: 'todo', isArchived: false, position: maxPos + 1,
    createdAt: today, updatedAt: today, labelIds: []
  };
  state.cards.push(card);
  ui.quickAddBoardId = null;
  saveState();
  renderAll();
  showToast('カードを追加しました');
}

// --- 検索／アーカイブ画面の開閉 ---

function openSearch() {
  ui.mode = 'search';
  ui.openCardMenuId = null;
  renderMain();
}

function closeSearch() {
  ui.mode = 'view';
  renderMain();
}

function openArchive() {
  ui.mode = 'archive';
  ui.openCardMenuId = null;
  renderMain();
}

function closeArchive() {
  ui.mode = 'view';
  renderMain();
}

function toggleSearchLabel(labelId) {
  var idx = ui.searchLabelIds.indexOf(labelId);
  if (idx === -1) {
    ui.searchLabelIds.push(labelId);
  } else {
    ui.searchLabelIds.splice(idx, 1);
  }
  var bar = document.getElementById('searchLabelFilterBar');
  if (bar) bar.innerHTML = buildLabelFilterChipsHtml();
  updateSearchResults();
}

function switchMobileTab(status) {
  ui.mobileActiveStatus = status;
  applyMobileActiveTab();
}

// --- ボード管理モーダル ---

function openBoardManageModal() {
  ui.renamingBoardId = null;
  ui.openCardMenuId = null;
  renderBoardManageList();
  document.getElementById('boardManageModal').classList.remove('hidden');
}

function closeBoardManageModal() {
  ui.renamingBoardId = null;
  document.getElementById('boardManageModal').classList.add('hidden');
  renderAll();
}

function renderBoardManageList() {
  var listEl = document.getElementById('boardManageList');
  var boards = getBoards();
  if (!boards.length) {
    listEl.innerHTML = '<li class="empty-hint">ボードがありません。下のフォームから追加してください。</li>';
    return;
  }
  listEl.innerHTML = boards.map(function (board, index) {
    var isFirst = index === 0;
    var isLast = index === boards.length - 1;
    if (ui.renamingBoardId === board.id) {
      return (
        '<li class="board-row board-row-editing" data-board-id="' + board.id + '">' +
          '<span class="board-row-handle">⠿</span>' +
          '<input type="text" class="form-input board-rename-input" id="boardRenameInput" value="' + escapeHtml(board.name) + '" maxlength="50">' +
          '<span class="board-row-actions">' +
            '<button type="button" class="btn btn-primary btn-sm" data-action="confirm-rename-board" data-board-id="' + board.id + '">保存</button>' +
            '<button type="button" class="btn btn-secondary btn-sm" data-action="cancel-rename-board">キャンセル</button>' +
          '</span>' +
        '</li>'
      );
    }
    return (
      '<li class="board-row" draggable="true" data-board-id="' + board.id + '">' +
        '<span class="board-row-handle" title="ドラッグで並べ替え">⠿</span>' +
        '<span class="board-row-order-btns">' +
          '<button type="button" data-action="board-move-up" data-board-id="' + board.id + '" title="上へ"' + (isFirst ? ' disabled' : '') + '>▲</button>' +
          '<button type="button" data-action="board-move-down" data-board-id="' + board.id + '" title="下へ"' + (isLast ? ' disabled' : '') + '>▼</button>' +
        '</span>' +
        '<span class="board-row-name">' + escapeHtml(board.name) + '</span>' +
        '<span class="board-row-actions">' +
          '<button type="button" class="btn btn-secondary btn-sm" data-action="rename-board" data-board-id="' + board.id + '">改名</button>' +
          '<button type="button" class="btn btn-danger btn-sm" data-action="delete-board" data-board-id="' + board.id + '">削除</button>' +
        '</span>' +
      '</li>'
    );
  }).join('');
}

function addBoard() {
  var input = document.getElementById('newBoardNameInput');
  var name = input.value.trim();
  if (!name) {
    showToast('ボード名を入力してください');
    return;
  }
  var maxPos = state.boards.reduce(function (max, b) { return Math.max(max, b.position); }, -1);
  var board = { id: uid('board'), name: name, position: maxPos + 1, createdAt: todayStr() };
  state.boards.push(board);
  input.value = '';
  saveState();
  renderBoardManageList();
  renderHeader();
  showToast('ボード「' + name + '」を追加しました');
}

function startRenameBoard(boardId) {
  ui.renamingBoardId = boardId;
  renderBoardManageList();
  var input = document.getElementById('boardRenameInput');
  if (input) { input.focus(); input.select(); }
}

function cancelRenameBoard() {
  ui.renamingBoardId = null;
  renderBoardManageList();
}

function confirmRenameBoard(boardId) {
  var input = document.getElementById('boardRenameInput');
  var name = input ? input.value.trim() : '';
  if (!name) {
    showToast('ボード名を入力してください');
    return;
  }
  var board = getBoard(boardId);
  if (board) board.name = name;
  ui.renamingBoardId = null;
  saveState();
  renderBoardManageList();
  renderHeader();
  showToast('ボード名を変更しました');
}

function confirmDeleteBoard(boardId) {
  var board = getBoard(boardId);
  if (!board) return;
  var cardCount = countActiveCardsForBoard(boardId);
  var message = '「' + board.name + '」を削除します。';
  if (cardCount > 0) {
    message += '\nこのボードに含まれる' + cardCount + '件のカードもすべて削除されます。';
  }
  message += '\nよろしいですか？';
  showConfirm(message, function () {
    deleteBoardById(boardId);
  }, '削除する');
}

function deleteBoardById(boardId) {
  var board = getBoard(boardId);
  state.boards = state.boards.filter(function (b) { return b.id !== boardId; });
  state.cards = state.cards.filter(function (c) { return c.boardId !== boardId; });
  state.labels = state.labels.filter(function (l) { return l.boardId !== boardId; });
  if (ui.selectedView === boardId) ui.selectedView = 'cross';
  saveState();
  renderBoardManageList();
  renderAll();
  showToast(board ? '「' + board.name + '」を削除しました' : 'ボードを削除しました');
}

function moveBoardUp(boardId) {
  var boards = getBoards();
  var idx = boards.findIndex(function (b) { return b.id === boardId; });
  if (idx <= 0) return;
  swapBoardPositions(boards[idx], boards[idx - 1]);
}

function moveBoardDown(boardId) {
  var boards = getBoards();
  var idx = boards.findIndex(function (b) { return b.id === boardId; });
  if (idx === -1 || idx >= boards.length - 1) return;
  swapBoardPositions(boards[idx], boards[idx + 1]);
}

function swapBoardPositions(boardA, boardB) {
  var tmp = boardA.position;
  boardA.position = boardB.position;
  boardB.position = tmp;
  saveState();
  renderBoardManageList();
  renderHeader();
}

// --- データリセット ---

function confirmResetData() {
  showConfirm(
    'サンプルデータにリセットします。現在のすべてのボード・カード・ラベルは失われます。よろしいですか？',
    function () { resetToSeedData(); },
    'リセットする'
  );
}

// --- ドラッグ＆ドロップ共通ヘルパー ---
// カード列・ボード一覧の並べ替えの両方で使う「カーソルYから挿入位置を求める」処理。
// (Trelloクローン実装等で広く使われる定番パターン)

function getDragAfterElement(container, y, selector) {
  selector = selector || '.card:not(.dragging)';
  var els = Array.prototype.slice.call(container.querySelectorAll(selector));
  var closest = { offset: Number.NEGATIVE_INFINITY, element: null };
  els.forEach(function (child) {
    var box = child.getBoundingClientRect();
    var offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      closest = { offset: offset, element: child };
    }
  });
  return closest.element;
}

function clearDragIndicators() {
  document.querySelectorAll('.card.drag-over-before, .card.drag-over-after').forEach(function (el) {
    el.classList.remove('drag-over-before', 'drag-over-after');
  });
  document.querySelectorAll('.card-list.drag-over-empty').forEach(function (el) {
    el.classList.remove('drag-over-empty');
  });
  document.querySelectorAll('.board-row.drag-over-before').forEach(function (el) {
    el.classList.remove('drag-over-before');
  });
}

// カードのドロップを確定させる：ドロップ先(status, boardId)へ反映し、並び順(position)を振り直す
function finalizeCardDrop(cardId, dropzone, clientY) {
  var card = getCard(cardId);
  if (!card) return;
  var targetBoardId = dropzone.getAttribute('data-board-id');
  var targetStatus = dropzone.getAttribute('data-status');
  if (targetBoardId !== card.boardId) return; // 別ボードへの移動は不可（安全のため二重チェック）

  var afterElement = getDragAfterElement(dropzone, clientY);
  var siblingIds = Array.prototype.slice.call(dropzone.querySelectorAll('.card'))
    .map(function (el) { return el.getAttribute('data-card-id'); })
    .filter(function (id) { return id !== cardId; });

  var insertIndex = siblingIds.length;
  if (afterElement) {
    var afterId = afterElement.getAttribute('data-card-id');
    var foundIdx = siblingIds.indexOf(afterId);
    if (foundIdx !== -1) insertIndex = foundIdx;
  }
  siblingIds.splice(insertIndex, 0, cardId);

  var changedStatus = targetStatus !== card.status;
  card.status = targetStatus;
  card.updatedAt = todayStr();

  siblingIds.forEach(function (id, index) {
    var c = getCard(id);
    if (c) c.position = index;
  });

  saveState();
  renderAll();
  if (changedStatus) {
    showToast(STATUS_LABELS[targetStatus] + 'へ移動しました');
  }
}

// ボード行のドロップを確定させる：ボード管理モーダル内の並べ替え
function finalizeBoardDrop(boardId, listEl, clientY) {
  var afterElement = getDragAfterElement(listEl, clientY, '.board-row:not(.dragging)');
  var siblingIds = Array.prototype.slice.call(listEl.querySelectorAll('.board-row'))
    .map(function (el) { return el.getAttribute('data-board-id'); })
    .filter(function (id) { return id && id !== boardId; });

  var insertIndex = siblingIds.length;
  if (afterElement) {
    var afterId = afterElement.getAttribute('data-board-id');
    var foundIdx = siblingIds.indexOf(afterId);
    if (foundIdx !== -1) insertIndex = foundIdx;
  }
  siblingIds.splice(insertIndex, 0, boardId);

  siblingIds.forEach(function (id, index) {
    var b = getBoard(id);
    if (b) b.position = index;
  });

  saveState();
  renderBoardManageList();
  renderHeader();
}

// マウスによるD&D本体（HTML5 Drag and Dropイベントをdocumentへ委譲することで、
// 再描画のたびに個別要素へリスナーを張り直す必要をなくしている）
// ※タッチ端末ではHTML5 D&Dの挙動が不安定なため、タッチ操作は各カードの
//   「⋯」/「移動▾」メニューからのステータス変更で代替する（README参照）。
function initDragAndDropHandlers() {
  document.addEventListener('dragstart', function (e) {
    var cardEl = e.target.closest('.card[draggable="true"]');
    if (cardEl) {
      dragCardInfo = { cardId: cardEl.getAttribute('data-card-id') };
      try {
        e.dataTransfer.setData('text/plain', dragCardInfo.cardId);
        e.dataTransfer.effectAllowed = 'move';
      } catch (err) { /* 一部環境でdataTransfer操作が制限されても致命的ではないため無視 */ }
      setTimeout(function () { cardEl.classList.add('dragging'); }, 0);
      return;
    }
    var boardRow = e.target.closest('.board-row[draggable="true"]');
    if (boardRow) {
      dragBoardInfo = { boardId: boardRow.getAttribute('data-board-id') };
      try {
        e.dataTransfer.setData('text/plain', dragBoardInfo.boardId);
        e.dataTransfer.effectAllowed = 'move';
      } catch (err) { /* noop */ }
      setTimeout(function () { boardRow.classList.add('dragging'); }, 0);
    }
  });

  document.addEventListener('dragend', function () {
    document.querySelectorAll('.card.dragging, .board-row.dragging').forEach(function (el) {
      el.classList.remove('dragging');
    });
    clearDragIndicators();
    dragCardInfo = null;
    dragBoardInfo = null;
  });

  document.addEventListener('dragover', function (e) {
    if (dragCardInfo) {
      var dropzone = e.target.closest('.card-list[data-dropzone="status"]');
      if (!dropzone) return;
      var draggedCard = getCard(dragCardInfo.cardId);
      if (!draggedCard) return;
      if (dropzone.getAttribute('data-board-id') !== draggedCard.boardId) return; // 別ボードへはドロップ不可のままにする
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      var afterElement = getDragAfterElement(dropzone, e.clientY);
      clearDragIndicators();
      if (afterElement) {
        afterElement.classList.add('drag-over-before');
      } else {
        dropzone.classList.add('drag-over-empty');
      }
      return;
    }
    if (dragBoardInfo) {
      var listEl = e.target.closest('#boardManageList');
      if (!listEl) return;
      e.preventDefault();
      var afterRow = getDragAfterElement(listEl, e.clientY, '.board-row:not(.dragging)');
      clearDragIndicators();
      if (afterRow) afterRow.classList.add('drag-over-before');
    }
  });

  document.addEventListener('drop', function (e) {
    if (dragCardInfo) {
      var dropzone = e.target.closest('.card-list[data-dropzone="status"]');
      var cardId = dragCardInfo.cardId;
      clearDragIndicators();
      dragCardInfo = null;
      if (!dropzone) return;
      e.preventDefault();
      finalizeCardDrop(cardId, dropzone, e.clientY);
      return;
    }
    if (dragBoardInfo) {
      var listEl = e.target.closest('#boardManageList');
      var boardId = dragBoardInfo.boardId;
      clearDragIndicators();
      dragBoardInfo = null;
      if (!listEl) return;
      e.preventDefault();
      finalizeBoardDrop(boardId, listEl, e.clientY);
    }
  });
}

// --- クリックのイベント委譲（data-action属性で分岐） ---
// 全画面が innerHTML による再描画のため、要素個別ではなくdocument一箇所に
// リスナーを張り、再描画後も張り直し不要にしている。

function initClickDispatcher() {
  document.addEventListener('click', function (e) {
    var actionEl = e.target.closest('[data-action]');
    var clickedInsideMenu = e.target.closest('.card-menu');

    if (!actionEl) {
      if (ui.openCardMenuId && !clickedInsideMenu) {
        ui.openCardMenuId = null;
        renderMain();
      }
      return;
    }

    var action = actionEl.getAttribute('data-action');

    if (action !== 'toggle-card-menu' && !clickedInsideMenu && ui.openCardMenuId) {
      ui.openCardMenuId = null;
    }

    switch (action) {
      case 'open-board-manage-modal': openBoardManageModal(); break;
      case 'close-board-manage-modal': closeBoardManageModal(); break;
      case 'open-search': openSearch(); break;
      case 'close-search': closeSearch(); break;
      case 'open-archive': openArchive(); break;
      case 'close-archive': closeArchive(); break;
      case 'reset-data': confirmResetData(); break;

      case 'close-card-modal': closeCardModal(); break;
      case 'archive-card': archiveCard(ui.openCardId); break;
      case 'delete-card': confirmDeleteCard(ui.openCardId); break;

      case 'open-card': openCardModal(actionEl.getAttribute('data-card-id')); break;
      case 'toggle-card-menu': toggleCardMenu(actionEl.getAttribute('data-card-id')); break;
      case 'move-card': handleMoveCardAction(actionEl.getAttribute('data-card-id'), actionEl.getAttribute('data-status')); break;
      case 'archive-card-quick': archiveCard(actionEl.getAttribute('data-card-id')); break;
      case 'delete-card-quick': confirmDeleteCard(actionEl.getAttribute('data-card-id')); break;

      case 'start-quick-add': startQuickAdd(actionEl.getAttribute('data-board-id')); break;
      case 'submit-quick-add': submitQuickAdd(actionEl.getAttribute('data-board-id')); break;
      case 'cancel-quick-add': cancelQuickAdd(); break;

      case 'switch-mobile-tab': switchMobileTab(actionEl.getAttribute('data-status')); break;

      case 'toggle-search-label': toggleSearchLabel(actionEl.getAttribute('data-label-id')); break;

      case 'restore-card': restoreCard(actionEl.getAttribute('data-card-id')); break;
      case 'delete-forever': confirmDeleteForever(actionEl.getAttribute('data-card-id')); break;

      case 'toggle-card-label': toggleCardLabel(actionEl.getAttribute('data-card-id'), actionEl.getAttribute('data-label-id')); break;
      case 'toggle-label-picker':
        ui.showLabelPicker = !ui.showLabelPicker;
        ui.showLabelCreator = false;
        renderCardLabelsSection(getCard(ui.openCardId));
        break;
      case 'toggle-label-creator':
        ui.showLabelCreator = !ui.showLabelCreator;
        renderCardLabelsSection(getCard(ui.openCardId));
        break;
      case 'pick-label-color':
        ui.labelCreatorColor = actionEl.getAttribute('data-color');
        renderCardLabelsSection(getCard(ui.openCardId));
        break;
      case 'create-label': createLabelForCard(actionEl.getAttribute('data-card-id')); break;

      case 'add-board': addBoard(); break;
      case 'rename-board': startRenameBoard(actionEl.getAttribute('data-board-id')); break;
      case 'confirm-rename-board': confirmRenameBoard(actionEl.getAttribute('data-board-id')); break;
      case 'cancel-rename-board': cancelRenameBoard(); break;
      case 'delete-board': confirmDeleteBoard(actionEl.getAttribute('data-board-id')); break;
      case 'board-move-up': moveBoardUp(actionEl.getAttribute('data-board-id')); break;
      case 'board-move-down': moveBoardDown(actionEl.getAttribute('data-board-id')); break;

      case 'confirm-cancel': closeConfirm(); break;
      case 'confirm-ok': handleConfirmOk(); break;

      default: break;
    }
  });
}

// --- フォーム関連（select変更／テキスト入力／Enterキー／背景クリックで閉じる） ---

function initFormHandlers() {
  document.getElementById('viewSelect').addEventListener('change', function (e) {
    ui.selectedView = e.target.value;
    ui.mode = 'view';
    ui.mobileActiveStatus = 'todo';
    renderMain();
  });

  document.getElementById('cardForm').addEventListener('submit', saveCardForm);

  document.getElementById('cardDueInput').addEventListener('input', function (e) {
    updateCardDueIndicator(e.target.value);
  });

  // 検索キーワードは入力のたびに絞り込み結果のみ更新する（入力欄自体は再描画しない＝フォーカス維持のため）
  document.addEventListener('input', function (e) {
    if (e.target && e.target.id === 'searchKeywordInput') {
      ui.searchKeyword = e.target.value;
      updateSearchResults();
    }
    // クイック追加：タイトルが空の間は「追加」ボタンを無効化する
    if (e.target && e.target.id === 'quickAddInput') {
      var form = e.target.closest('.quick-add-form');
      var submitBtn = form ? form.querySelector('[data-action="submit-quick-add"]') : null;
      if (submitBtn) submitBtn.disabled = !e.target.value.trim();
    }
  });

  // Enterキーでの簡易送信（クイック追加／ボード追加／ボード改名／ラベル作成）
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (!document.getElementById('confirmModal').classList.contains('hidden')) {
        closeConfirm();
      } else if (!document.getElementById('cardModal').classList.contains('hidden')) {
        closeCardModal();
      } else if (!document.getElementById('boardManageModal').classList.contains('hidden')) {
        closeBoardManageModal();
      }
      return;
    }
    if (e.key !== 'Enter') return;
    if (!e.target || !e.target.id) return;

    if (e.target.id === 'quickAddInput') {
      e.preventDefault();
      submitQuickAdd(e.target.getAttribute('data-board-id'));
    } else if (e.target.id === 'newBoardNameInput') {
      e.preventDefault();
      addBoard();
    } else if (e.target.id === 'boardRenameInput') {
      e.preventDefault();
      var row = e.target.closest('.board-row');
      var boardId = row ? row.getAttribute('data-board-id') : null;
      if (boardId) confirmRenameBoard(boardId);
    } else if (e.target.id === 'newLabelNameInput') {
      e.preventDefault();
      if (ui.openCardId) createLabelForCard(ui.openCardId);
    }
  });

  // モーダルの背景（オーバーレイ）クリックで閉じる
  document.getElementById('confirmModal').addEventListener('click', function (e) {
    if (e.target.id === 'confirmModal') closeConfirm();
  });
  document.getElementById('cardModal').addEventListener('click', function (e) {
    if (e.target.id === 'cardModal') closeCardModal();
  });
  document.getElementById('boardManageModal').addEventListener('click', function (e) {
    if (e.target.id === 'boardManageModal') closeBoardManageModal();
  });
}

// --- 初期化 ---

function init() {
  state = loadState();
  initDragAndDropHandlers();
  initClickDispatcher();
  initFormHandlers();
  renderAll();
}

document.addEventListener('DOMContentLoaded', init);

// === END OF FILE ===
