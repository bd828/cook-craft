const trayIngredients = [
    { id: 'sauce', name: 'Чесночный соус', emoji: '🧄', unlocked: true },
    { id: 'meat', name: 'Мясо с вертела', emoji: '🥩', unlocked: true, needsSpit: true },
    { id: 'cucumber', name: 'Огурчики', emoji: '🥒', unlocked: true },
    { id: 'tomato', name: 'Томаты', emoji: '🍅', unlocked: true },
    { id: 'cabbage', name: 'Капуста', emoji: '🥬', unlocked: true },
    { id: 'fries', name: 'Картофель фри', emoji: '🍟', unlocked: true },
    { id: 'cheese', name: 'Сыр Чеддер', emoji: '🧀', unlocked: false },
    { id: 'jalapeno', name: 'Халапеньо', emoji: '🌶️', unlocked: false }
];

const menuTemplates = [
    { title: 'Классическая', req: ['sauce', 'meat', 'cabbage', 'cucumber'], price: 25 },
    { title: 'Сырная', req: ['sauce', 'meat', 'cheese', 'tomato'], price: 35 },
    { title: 'Острая Мексика', req: ['sauce', 'meat', 'jalapeno', 'tomato'], price: 38 },
    { title: 'Сытная с фри', req: ['sauce', 'meat', 'fries', 'cucumber'], price: 30 },
    { title: 'Овощной микс', req: ['sauce', 'cabbage', 'tomato', 'cucumber'], price: 20 },
    { title: 'Мега-Шаурма', req: ['sauce', 'meat', 'cheese', 'fries', 'jalapeno'], price: 50 }
];

const avatars = ['🧔', '👩', '👨', '👱‍♀️', '👩‍🦰', '🧑‍🦱', '🧢', '🕶️', '🎧', '👷'];
const shirtColors = ['#0984e3', '#6c5ce7', '#e17055', '#00b894', '#d63031', '#e84393', '#2d3436'];

let save = JSON.parse(localStorage.getItem('shawarma_save_v1')) || {
    coins: 0,
    sold: 0,
    shopName: 'ШАУРМА 24/7',
    grillSpeed: 1,
    spitCapacity: 5,
    unlockedIds: ['sauce', 'meat', 'cucumber', 'tomato', 'cabbage', 'fries']
};

let meatStock = save.spitCapacity;
let currentLayers = [];
let isWrapped = false;

// Состояние гриля: 'empty' | 'cooking' | 'ready' | 'burned'
let grillState = 'empty';
let grillProgress = 0;
let grillInterval = null;

// Состояние клиента
let currentOrder = null;
let patience = 100;
let customerTimer = null;
let isBusy = false;

if (window.YaGames) {
    YaGames.init().then(function(ysdk) {
        if (ysdk.features && ysdk.features.LoadingAPI) {
            ysdk.features.LoadingAPI.ready();
        }
    }).catch(function() {});
}

function persist() {
    localStorage.setItem('shawarma_save_v1', JSON.stringify(save));
}

// Звуки Web Audio API
let audioCtx = null;
let musicOn = false;
let musicLoop = null;

function initSound() {
    if (!audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) audioCtx = new AC();
    }
}

function beep(freq, dur, type, vol) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol || 0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + dur);
}

const melody = [293.66, 349.23, 440.00, 392.00, 349.23, 329.63];
let noteStep = 0;

document.getElementById('music-btn').addEventListener('click', function() {
    initSound();
    if (musicOn) {
        clearInterval(musicLoop);
        musicOn = false;
        this.textContent = '🎵';
    } else {
        musicOn = true;
        this.textContent = '🔊';
        musicLoop = setInterval(function() {
            beep(melody.at(noteStep), 0.35, 'triangle', 0.04);
            noteStep = (noteStep + 1) % melody.length;
        }, 450);
    }
});

function toast(text) {
    document.getElementById('toast-msg').textContent = text;
}

function showFloatingText(text, color) {
    const el = document.createElement('div');
    el.className = 'float-score';
    el.textContent = text;
    el.style.color = color || '#55efc4';
    document.body.appendChild(el);
    setTimeout(function() { el.remove(); }, 900);
}

// Смена названия ларька по клику на вывеску
document.getElementById('shop-sign').addEventListener('click', function() {
    const name = prompt('Введите название вашей шаурмичной (до 18 букв):', save.shopName);
    if (name && name.trim()) {
        save.shopName = name.trim().slice(0, 18).toUpperCase();
        persist();
        renderHeader();
    }
});

function renderHeader() {
    document.getElementById('coins').textContent = save.coins;
    document.getElementById('sold-count').textContent = save.sold;
    document.getElementById('shop-sign').textContent = save.shopName;
}

function renderTray() {
    const tray = document.getElementById('ingredients-tray');
    tray.innerHTML = '';

    trayIngredients.forEach(function(ing) {
        const isUnlocked = save.unlockedIds.includes(ing.id);
        const card = document.createElement('div');
        card.className = 'ing-card' + (isUnlocked ? '' : ' locked');
        card.innerHTML =
            '<span class="ing-emoji">' + ing.emoji + '</span>' +
            '<span class="ing-title">' + (isUnlocked ? ing.name : '🔒 В ларьке') + '</span>';

        if (isUnlocked) {
            card.addEventListener('click', function() {
                addIngredientToLavash(ing);
            });
        }
        tray.appendChild(card);
    });
}

// Вертел с мясом
function updateSpitVisual() {
    document.getElementById('meat-stock').textContent = meatStock;
    const meatEl = document.getElementById('spit-meat');
    const hintEl = document.getElementById('spit-hint');

    if (meatStock <= 0) {
        meatEl.classList.add('empty');
        hintEl.textContent = 'Нажми: новый вертел';
    } else {
        meatEl.classList.remove('empty');
        const widthPx = 16 + Math.round((meatStock / save.spitCapacity) * 28);
        meatEl.style.width = widthPx + 'px';
        hintEl.textContent = 'Нажми: срезать';
    }
}

document.getElementById('spit-btn').addEventListener('click', function() {
    initSound();
    if (meatStock <= 0) {
        meatStock = save.spitCapacity;
        updateSpitVisual();
        toast('Новый сочный вертел установлен! 🥩');
        beep(440, 0.15, 'sine', 0.1);
        return;
    }

    const meatIng = trayIngredients.find(function(i) { return i.id === 'meat'; });
    if (addIngredientToLavash(meatIng, true)) {
        meatStock -= 1;
        updateSpitVisual();
        beep(600, 0.08, 'sawtooth', 0.07);
    }
});

// Сборка на лаваше
function addIngredientToLavash(ing, fromSpit) {
    initSound();
    if (ing.needsSpit && !fromSpit) {
        toast('Срежьте мясо нажатием на вертел слева! 🔪');
        beep(200, 0.15, 'sawtooth', 0.08);
        return false;
    }

    if (isWrapped) {
        toast('Шаурма уже завернута! Положите её на гриль справа ➡️');
        return false;
    }

    if (currentLayers.length >= 6) {
        toast('Лаваш полон! Нажмите «Завернуть»');
        return false;
    }

    currentLayers.push(ing);
    beep(520, 0.07, 'sine', 0.09);
    renderLavash();
    updateTicketProgress();
    return true;
}

function renderLavash() {
    const wrap = document.getElementById('lavash-area');
    const stack = document.getElementById('layers-stack');
    stack.innerHTML = '';

    if (isWrapped) {
        wrap.classList.add('is-wrapped');
    } else {
        wrap.classList.remove('is-wrapped');
        currentLayers.forEach(function(item) {
            const span = document.createElement('span');
            span.className = 'layer-item';
            span.textContent = item.emoji;
            stack.appendChild(span);
        });
    }
}

document.getElementById('trash-btn').addEventListener('click', function() {
    initSound();
    currentLayers = [];
    isWrapped = false;
    renderLavash();
    updateTicketProgress();
    toast('Лаваш очищен 🗑️');
    beep(250, 0.1, 'sine', 0.08);
});

document.getElementById('wrap-btn').addEventListener('click', function() {
    initSound();
    if (isWrapped) return;
    if (currentLayers.length === 0) {
        toast('Сначала положите начинку на лаваш!');
        return;
    }
    isWrapped = true;
    renderLavash();
    toast('Завернуто! Теперь нажмите на Гриль справа 🔥');
    beep(680, 0.12, 'sine', 0.1);
});

// Контактный гриль
function updateGrillVisual() {
    const vis = document.getElementById('grill-visual');
    const hint = document.getElementById('grill-hint');
    const bar = document.getElementById('grill-progress');

    vis.className = 'grill-visual';
    bar.style.width = Math.min(100, grillProgress) + '%';

    if (grillState === 'empty') {
        hint.textContent = 'Пусто';
        bar.style.backgroundColor = '#fdcb6e';
    } else if (grillState === 'cooking') {
        vis.classList.add('cooking');
        hint.textContent = 'Жарится...';
        bar.style.backgroundColor = '#fdcb6e';
    } else if (grillState === 'ready') {
        vis.classList.add('cooking');
        hint.textContent = 'ГОТОВО! ЖМИ!';
        bar.style.backgroundColor = '#00b894';
    } else if (grillState === 'burned') {
        vis.classList.add('burned');
        hint.textContent = 'СГОРЕЛА! Выкинуть';
        bar.style.backgroundColor = '#d63031';
    }
}

document.getElementById('grill-btn').addEventListener('click', function() {
    initSound();

    // 1. Кладем завернутую шаурму на пустой гриль
    if (grillState === 'empty') {
        if (!isWrapped) {
            toast('Сначала соберите и заверните шаурму на доске!');
            return;
        }
        grillState = 'cooking';
        grillProgress = 0;

        // Очищаем доску под следующий заказ
        const cookedLayers = [...currentLayers];
        currentLayers = [];
        isWrapped = false;
        renderLavash();
        updateTicketProgress();

        toast('Шаурма на гриле! Снимите в зеленой зоне 🔥');
        beep(480, 0.12, 'sine', 0.1);

        const stepSpeed = 2.4 + (save.grillSpeed - 1) * 0.9;
        clearInterval(grillInterval);
        grillInterval = setInterval(function() {
            grillProgress += stepSpeed;
if (grillProgress >= 60 && grillProgress <= 88) {
grillState = 'ready';
} else if (grillProgress > 88) {
grillState = 'burned';
}
if (grillProgress >= 100) {
clearInterval(grillInterval);
}
updateGrillVisual();
}, 100);
this.dataset.cooked = JSON.stringify(cookedLayers.map(function(i) { return i.id; }));
updateGrillVisual();
return;
}
// 2. Если сгорела — выкидываем
if (grillState === 'burned') {
clearInterval(grillInterval);
grillState = 'empty';
grillProgress = 0;
updateGrillVisual();
toast('Сгоревшая шаурма отправлена в мусорку 💀');
beep(160, 0.25, 'sawtooth', 0.1);
return;
}
// 3. Снимаем и отдаем клиенту
if (grillState === 'cooking' || grillState === 'ready') {
const wasPerfect = (grillState === 'ready');
clearInterval(grillInterval);
grillState = 'empty';
grillProgress = 0;
updateGrillVisual();
const cookedIds = JSON.parse(this.dataset.cooked || '[]');
evaluateOrder(cookedIds, wasPerfect);
}
});
// Проверка заказа клиента
function evaluateOrder(cookedIds, wasPerfect) {
if (isBusy || !currentOrder) return;
const reqSorted = [...currentOrder.req].sort().join(',');
const gotSorted = [...cookedIds].sort().join(',');
if (reqSorted === gotSorted) {
const grillBonus = wasPerfect ? 10 : 0;
const tip = patience > 50 ? 5 : 0;
const total = currentOrder.price + grillBonus + tip;
save.coins += total;
save.sold += 1;
persist();
renderHeader();
showFloatingText('+' + total + ' 💰', '#55efc4');
toast(wasPerfect ? 'Идеальная прожарка! +' + total + '💰' : 'Заказ принят! +' + total + '💰');
beep(523.25, 0.12, 'sine', 0.1);
setTimeout(function() { beep(659.25, 0.12, 'sine', 0.1); }, 90);
setTimeout(function() { beep(783.99, 0.25, 'sine', 0.1); }, 180);
dismissCustomer(true);
} else {
showFloatingText('Не тот состав! ❌', '#ff7675');
toast('Клиент недоволен: состав не совпал с чеком!');
beep(200, 0.25, 'sawtooth', 0.1);
}
}
// Клиенты
function spawnCustomer() {
isBusy = false;
const availableMenus = menuTemplates.filter(function(m) {
return m.req.every(function(id) { return save.unlockedIds.includes(id); });
});
currentOrder = availableMenus.at(Math.floor(Math.random() * availableMenus.length));
document.getElementById('cust-avatar').textContent = avatars.at(Math.floor(Math.random() * avatars.length));
document.getElementById('cust-shirt').style.backgroundColor = shirtColors.at(Math.floor(Math.random() * shirtColors.length));
document.getElementById('order-title').textContent = currentOrder.title;
document.getElementById('order-price').textContent = '+' + currentOrder.price + '💰';
updateTicketProgress();
const card = document.getElementById('customer-card');
card.className = 'customer-card';
setTimeout(function() {
card.classList.add('arrived');
}, 50);
patience = 100;
updatePatienceUI();
clearInterval(customerTimer);
customerTimer = setInterval(function() {
if (document.getElementById('shop-modal').classList.contains('open')) return;
patience -= 0.45;
updatePatienceUI();
if (patience <= 0) {
clearInterval(customerTimer);
toast('Клиент устал ждать и ушел 😠');
showFloatingText('Ушел! 😠', '#ff7675');
beep(180, 0.3, 'sawtooth', 0.1);
dismissCustomer(false);
}
}, 200);
}
function updateTicketProgress() {
const box = document.getElementById('order-ings');
box.innerHTML = '';
if (!currentOrder) return;
const addedCounts = {};
currentLayers.forEach(function(item) {
addedCounts[item.id] = (addedCounts[item.id] || 0) + 1;
});
currentOrder.req.forEach(function(reqId) {
const ing = trayIngredients.find(function(i) { return i.id === reqId; });
const chip = document.createElement('div');
const isDone = (addedCounts[reqId] || 0) > 0;
if (isDone) addedCounts[reqId] -= 1;
chip.className = 'ticket-chip' + (isDone ? ' done' : '');
chip.textContent = ing.emoji + ' ' + ing.name.split(' ');
box.appendChild(chip);
});
}
function updatePatienceUI() {
const fill = document.getElementById('patience-fill');
fill.style.width = Math.max(0, patience) + '%';
if (patience > 50) fill.style.backgroundColor = '#00b894';
else if (patience > 25) fill.style.backgroundColor = '#fdcb6e';
else fill.style.backgroundColor = '#d63031';
}
function dismissCustomer(isHappy) {
isBusy = true;
clearInterval(customerTimer);
const card = document.getElementById('customer-card');
card.classList.remove('arrived');
card.classList.add(isHappy ? 'leave-happy' : 'leave-angry');
setTimeout(spawnCustomer, 650);
}
// Магазин улучшений
function renderShop() {
const list = document.getElementById('shop-list');
list.innerHTML = '';
// 1. Ускорение гриля
const grillCost = save.grillSpeed * 75;
const gRow = document.createElement('div');
gRow.className = 'shop-row';
gRow.innerHTML =
'🔥 Мощный гриль (Ур. ' + save.grillSpeed + ')Быстрее запекает шаурму до золотистой корочки' +
'<button class="buy-btn" ' + (save.coins < grillCost ? 'disabled' : '') + '>' + grillCost + ' 💰';
gRow.querySelector('button').addEventListener('click', function() {
if (save.coins >= grillCost) {
save.coins -= grillCost;
save.grillSpeed += 1;
persist();
renderHeader();
renderShop();
beep(650, 0.2, 'sine', 0.1);
}
});
list.appendChild(gRow);
// 2. Большой вертел
const spitCost = save.spitCapacity * 12;
const sRow = document.createElement('div');
sRow.className = 'shop-row';
sRow.innerHTML =
'🥩 Большой вертел (' + save.spitCapacity + ' порций)Увеличивает запас мяса на +3 порции' +
'<button class="buy-btn" ' + (save.coins < spitCost ? 'disabled' : '') + '>' + spitCost + ' 💰';
sRow.querySelector('button').addEventListener('click', function() {
if (save.coins >= spitCost) {
save.coins -= spitCost;
save.spitCapacity += 3;
meatStock = save.spitCapacity;
updateSpitVisual();
persist();
renderHeader();
renderShop();
beep(650, 0.2, 'sine', 0.1);
}
});
list.appendChild(sRow);
// 3. Новые продукты
const extras = [
{ id: 'cheese', title: '🧀 Сыр Чеддер', desc: 'Открывает рецепт «Сырная шаурма» (+35💰)', cost: 60 },
{ id: 'jalapeno', title: '🌶️ Перец Халапеньо', desc: 'Открывает «Острую Мексику» и «Мега-Шаурму» (+50💰)', cost: 110 }
];
extras.forEach(function(item) {
const bought = save.unlockedIds.includes(item.id);
const row = document.createElement('div');
row.className = 'shop-row';
row.innerHTML =
'' + item.title + '' + item.desc + '' +
'<button class="buy-btn" ' + (bought || save.coins < item.cost ? 'disabled' : '') + '>' +
(bought ? 'Открыто' : item.cost + ' 💰') + '';
row.querySelector('button').addEventListener('click', function() {
if (!bought && save.coins >= item.cost) {
save.coins -= item.cost;
save.unlockedIds.push(item.id);
persist();
renderHeader();
renderTray();
renderShop();
beep(700, 0.25, 'sine', 0.1);
}
});
list.appendChild(row);
});
}
document.getElementById('shop-btn').addEventListener('click', function() {
renderShop();
document.getElementById('shop-modal').classList.add('open');
});
document.getElementById('close-shop-btn').addEventListener('click', function() {
document.getElementById('shop-modal').classList.remove('open');
});
document.getElementById('shop-modal').addEventListener('click', function(e) {
if (e.target === this) document.getElementById('shop-modal').classList.remove('open');
});
// Старт игры
renderHeader();
renderTray();
updateSpitVisual();
updateGrillVisual();
spawnCustomer();
