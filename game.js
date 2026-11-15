const allIngredients = [
    { id: 'bun', name: 'Булка', emoji: '🥖' },
    { id: 'sausage', name: 'Сосиска', emoji: '🌭' },
    { id: 'patty', name: 'Котлета', emoji: '🥩' },
    { id: 'cheese', name: 'Сыр', emoji: '🧀' },
    { id: 'salad', name: 'Салат', emoji: '🥬' },
    { id: 'sauce', name: 'Соус', emoji: '🥫' },
    { id: 'potato', name: 'Картофель', emoji: '🥔' },
    { id: 'dough', name: 'Тесто', emoji: '🫓' },
    { id: 'chicken', name: 'Курица', emoji: '🍗' },
    { id: 'choco', name: 'Шоколад', emoji: '🍫' }
];

const allRecipes = [
    { item1: 'bun', item2: 'sausage', name: 'Хот-дог', emoji: '🌭', price: 15 },
    { item1: 'bun', item2: 'patty', name: 'Бургер', emoji: '🍔', price: 20 },
    { item1: 'bun', item2: 'cheese', name: 'Сырный тост', emoji: '🥪', price: 15 },
    { item1: 'patty', item2: 'cheese', name: 'Чизбургер', emoji: '🍔', price: 25 },
    { item1: 'patty', item2: 'salad', name: 'Фитнес-стейк', emoji: '🥗', price: 22 },
    { item1: 'sausage', item2: 'sauce', name: 'Колбаски гриль', emoji: '🍖', price: 18 },
    { item1: 'salad', item2: 'cheese', name: 'Греческий салат', emoji: '🥗', price: 18 },
    { item1: 'bun', item2: 'sauce', name: 'Сэндвич', emoji: '🥪', price: 15 },
    { item1: 'potato', item2: 'sauce', name: 'Картошка фри', emoji: '🍟', price: 28 },
    { item1: 'potato', item2: 'cheese', name: 'Фри с сыром', emoji: '🍟', price: 32 },
    { item1: 'dough', item2: 'cheese', name: 'Пицца 4 сыра', emoji: '🍕', price: 35 },
    { item1: 'dough', item2: 'sauce', name: 'Пепперони', emoji: '🍕', price: 35 },
    { item1: 'chicken', item2: 'sauce', name: 'Острые крылья', emoji: '🍗', price: 38 },
    { item1: 'chicken', item2: 'salad', name: 'Цезарь ролл', emoji: '🌯', price: 36 },
    { item1: 'dough', item2: 'choco', name: 'Пончик', emoji: '🍩', price: 40 },
    { item1: 'bun', item2: 'choco', name: 'Круассан', emoji: '🥐', price: 36 }
];

const avatars = ['🧑', '👩', '👨', '🧔', '👱‍♀️', '👩‍🦰', '🧑‍🦱', '🧢', '🕶️', '🎧'];

let state = JSON.parse(localStorage.getItem('foodtruck_v2')) || {
    coins: 0,
    ordersDone: 0,
    grillLevel: 1,
    neonBought: false,
    signName: 'STREET FOOD',
    unlockedIngs: ['bun', 'sausage', 'patty', 'cheese', 'salad', 'sauce']
};

let selected = [];
let queue = [];
let patience = 100;
let gameLoop = null;
let isTransitioning = false;

if (window.YaGames) {
    YaGames.init().then(function(ysdk) {
        if (ysdk.features && ysdk.features.LoadingAPI) {
            ysdk.features.LoadingAPI.ready();
        }
    }).catch(function() {});
}

function saveGame() {
    localStorage.setItem('foodtruck_v2', JSON.stringify(state));
}

function getLevel() {
    return Math.floor(state.ordersDone / 4) + 1;
}

// Звуки
let audioCtx = null;
let isMusicOn = false;
let musicTimer = null;

function initAudio() {
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) audioCtx = new AudioContext();
    }
}

function playTone(freq, dur, type, vol) {
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

const chillNotes = [220.00, 261.63, 329.63, 392.00, 329.63, 261.63];
let noteIdx = 0;

document.getElementById('music-btn').addEventListener('click', function() {
    initAudio();
    if (isMusicOn) {
        clearInterval(musicTimer);
        isMusicOn = false;
        this.textContent = '🎵 Выкл';
    } else {
        isMusicOn = true;
        this.textContent = '🎵 Вкл';
        musicTimer = setInterval(function() {
            playTone(chillNotes.at(noteIdx), 0.4, 'triangle', 0.04);
            noteIdx = (noteIdx + 1) % chillNotes.length;
        }, 480);
    }
});

function spawnEffect(text, color) {
    const el = document.createElement('div');
    el.className = 'floating-fx';
    el.textContent = text;
    el.style.color = color || '#1dd1a1';
    el.style.left = '35%';
    el.style.top = '45%';
    document.body.appendChild(el);
    setTimeout(function() { el.remove(); }, 1000);
}

function getAvailableRecipes() {
    return allRecipes.filter(function(r) {
        return state.unlockedIngs.includes(r.item1) && state.unlockedIngs.includes(r.item2);
    });
}

// Смена названия на вывеске
function renameSign() {
    if (!state.neonBought) {
        document.getElementById('status-msg').textContent = 'Купите неоновую вывеску в 🛠️ Улучшениях, чтобы менять название!';
        return;
    }
    const newName = prompt('Введите новое название вашего фудтрака (до 18 символов):', state.signName);
    if (newName && newName.trim().length > 0) {
        state.signName = newName.trim().slice(0, 18);
        saveGame();
        renderUI();
    }
}

document.getElementById('neon-sign').addEventListener('click', renameSign);

function renderUI() {
    const lvl = getLevel();
    document.getElementById('coins').textContent = state.coins;
    document.getElementById('level').textContent = lvl;

    // Вывеска по центру
    const signEl = document.getElementById('neon-sign');
    document.getElementById('sign-text').textContent = state.signName;
    if (state.neonBought) {
        signEl.classList.add('bought');
    } else {
        signEl.classList.remove('bought');
    }

    // Нижняя полка продуктов
    const dock = document.getElementById('ingredients-dock');
    dock.innerHTML = '';
    allIngredients.forEach(function(ing) {
        if (!state.unlockedIngs.includes(ing.id)) return;
        const btn = document.createElement('div');
        btn.className = 'ing-btn';
        btn.innerHTML = '<span class="ing-emoji">' + ing.emoji + '</span><span class="ing-name">' + ing.name + '</span>';
        btn.addEventListener('click', function() { addIng(ing); });
        dock.appendChild(btn);
    });

    // Боковая шпаргалка справа (до 10 уровня)
    const sideMenu = document.getElementById('side-menu');
    const sideList = document.getElementById('side-recipe-list');
    const hintStatus = document.getElementById('hint-status');
    sideList.innerHTML = '';

    const oldLock = sideMenu.querySelector('.locked-msg');
    if (oldLock) oldLock.remove();

    if (lvl <= 10) {
        hintStatus.textContent = 'До 10 ур.';
        getAvailableRecipes().forEach(function(r) {
            const i1 = allIngredients.find(function(i) { return i.id === r.item1; });
            const i2 = allIngredients.find(function(i) { return i.id === r.item2; });
            const row = document.createElement('div');
            row.className = 'side-recipe-item';
            row.innerHTML = '<span>' + i1.emoji + '+' + i2.emoji + '</span><span>' + r.emoji + ' ' + r.name + '</span>';
            sideList.appendChild(row);
        });
    } else {
        hintStatus.textContent = '10+ ур.';
        const lockNote = document.createElement('div');
        lockNote.className = 'locked-msg';
        lockNote.textContent = 'Подсказки закрыты! Режим настоящего шефа 🔥';
        sideMenu.appendChild(lockNote);
    }
}

function renderShop() {
    const list = document.getElementById('shop-list');
    list.innerHTML = '';

    // 1. Неоновая вывеска + смена названия
    const neonDiv = document.createElement('div');
    neonDiv.className = 'shop-item';
    neonDiv.innerHTML =
        '<div class="shop-info"><h3>💡 Неоновая вывеска</h3>' +
        '<p>Зажигает вывеску по центру, дает свое название и +30% к терпению гостей</p></div>' +
        '<button class="buy-btn" ' + (!state.neonBought && state.coins < 70 ? 'disabled' : '') + '>' +
        (state.neonBought ? '✏️ Название' : '70 💰') + '</button>';
    neonDiv.querySelector('button').addEventListener('click', function() {
        if (state.neonBought) {
            renameSign();
            renderShop();
        } else if (state.coins >= 70) {
            state.coins -= 70;
            state.neonBought = true;
            saveGame();
            renderUI();
            renderShop();
            playTone(650, 0.25, 'sine', 0.1);
            renameSign();
        }
    });
    list.appendChild(neonDiv);

    // 2. Улучшение гриля
    const grillCost = state.grillLevel * 60;
    const grillDiv = document.createElement('div');
    grillDiv.className = 'shop-item';
    grillDiv.innerHTML =
        '<div class="shop-info"><h3>🔥 Мощный гриль (Ур. ' + state.grillLevel + ')</h3>' +
        '<p>+5💰 к стоимости каждого проданного блюда</p></div>' +
        '<button class="buy-btn" ' + (state.coins < grillCost ? 'disabled' : '') + '>' + grillCost + ' 💰</button>';
    grillDiv.querySelector('button').addEventListener('click', function() {
        if (state.coins >= grillCost) {
            state.coins -= grillCost;
            state.grillLevel += 1;
            saveGame();
            renderUI();
            renderShop();
            playTone(600, 0.2, 'sine', 0.1);
        }
    });
    list.appendChild(grillDiv);

    // 3. Новые продукты
    const unlockItems = [
        { id: 'potato', title: '🥔 Картофель фри', desc: 'Открывает картошку фри и фри с сыром', cost: 50 },
        { id: 'dough', title: '🫓 Тесто для пиццы', desc: 'Открывает пиццу 4 сыра и пепперони', cost: 90 },
        { id: 'chicken', title: '🍗 Курочка гриль', desc: 'Открывает острые крылья и цезарь ролл', cost: 130 },
        { id: 'choco', title: '🍫 Бельгийский шоколад', desc: 'Открывает пончики и круассаны', cost: 170 }
    ];

    unlockItems.forEach(function(u) {
        const isBought = state.unlockedIngs.includes(u.id);
        const div = document.createElement('div');
        div.className = 'shop-item';
        div.innerHTML =
'' + u.title + '' + u.desc + '' +
'<button class="buy-btn" ' + (isBought || state.coins < u.cost ? 'disabled' : '') + '>' +
(isBought ? 'Открыто' : u.cost + ' 💰') + '';
div.querySelector('button').addEventListener('click', function() {
if (!isBought && state.coins >= u.cost) {
state.coins -= u.cost;
state.unlockedIngs.push(u.id);
saveGame();
renderUI();
renderShop();
playTone(700, 0.25, 'sine', 0.1);
}
});
list.appendChild(div);
});
}
// Очередь посетителей
function createCustomerObj() {
const available = getAvailableRecipes();
return {
order: available.at(Math.floor(Math.random() * available.length)),
avatar: avatars.at(Math.floor(Math.random() * avatars.length))
};
}
function fillQueue() {
while (queue.length < 3) {
queue.push(createCustomerObj());
}
}
function renderQueue(leaveStatus) {
const area = document.getElementById('queue-area');
area.innerHTML = '';
queue.forEach(function(cust, index) {
const card = document.createElement('div');
card.className = 'customer-card ' + (index === 0 ? 'active' : 'waiting');
if (index === 0 && leaveStatus === 'happy') card.classList.add('leaving-happy');
if (index === 0 && leaveStatus === 'angry') card.classList.add('leaving-angry');
let barHtml = '';
if (index === 0) {
barHtml = '';
}
card.innerHTML =
'' +
'' + cust.order.emoji + '' +
(index === 0 ? '' + cust.order.name + '' : '') +
barHtml +
'' +
'' + cust.avatar + '';
area.appendChild(card);
});
if (!leaveStatus) updatePatienceBar();
}
function startActiveCustomerTimer() {
isTransitioning = false;
patience = 100;
renderQueue(null);
const drainSpeed = state.neonBought ? 0.35 : 0.52;
clearInterval(gameLoop);
gameLoop = setInterval(function() {
if (document.getElementById('shop-modal').classList.contains('open')) return;
patience -= drainSpeed;
updatePatienceBar();
if (patience <= 0) {
clearInterval(gameLoop);
customerLeave(false);
}
}, 200);
}
function updatePatienceBar() {
const fill = document.getElementById('patience-fill');
if (!fill) return;
fill.style.width = Math.max(0, patience) + '%';
if (patience > 50) fill.style.backgroundColor = '#1dd1a1';
else if (patience > 25) fill.style.backgroundColor = '#feca57';
else fill.style.backgroundColor = '#ee5253';
}
function customerLeave(isHappy) {
isTransitioning = true;
clearInterval(gameLoop);
const msg = document.getElementById('status-msg');
const currentCustomer = queue.at(0);
if (isHappy) {
const grillBonus = (state.grillLevel - 1) * 5;
const tip = patience > 55 ? 5 : 0;
const total = currentCustomer.order.price + grillBonus + tip;
state.coins += total;
state.ordersDone += 1;
saveGame();
renderUI();
renderQueue('happy');
msg.textContent = tip > 0 ? 'Супер! +' + total + '💰 (с чаевыми!)' : 'Отдано! +' + total + '💰';
spawnEffect('+' + total + ' 💰', '#1dd1a1');
playTone(523.25, 0.12, 'sine', 0.1);
setTimeout(function() { playTone(659.25, 0.12, 'sine', 0.1); }, 90);
setTimeout(function() { playTone(783.99, 0.25, 'sine', 0.1); }, 180);
} else {
renderQueue('angry');
msg.textContent = 'Первый гость не дождался! Подошел следующий из очереди 😠';
spawnEffect('Ушел! 😠', '#ee5253');
playTone(180, 0.3, 'sawtooth', 0.1);
}
selected = [];
updateSlots();
setTimeout(function() {
queue.shift();
fillQueue();
startActiveCustomerTimer();
}, 550);
}
function addIng(ing) {
if (isTransitioning) return;
initAudio();
if (selected.length < 2) {
selected.push(ing);
playTone(500, 0.08, 'sine', 0.1);
updateSlots();
}
}
function removeIng(idx) {
if (selected.at(idx)) {
initAudio();
selected.splice(idx, 1);
playTone(300, 0.08, 'sine', 0.1);
updateSlots();
}
}
function updateSlots() {
for (let i = 0; i < 2; i++) {
const slot = document.getElementById('slot-' + i);
const item = selected.at(i);
if (item) {
slot.textContent = item.emoji;
slot.classList.add('filled');
} else {
slot.textContent = '';
slot.classList.remove('filled');
}
}
}
function serveDish() {
if (isTransitioning) return;
initAudio();
const msg = document.getElementById('status-msg');
const currentOrder = queue.at(0).order;
if (selected.length < 2) {
msg.textContent = 'Выберите 2 продукта на прилавок!';
playTone(200, 0.15, 'sawtooth', 0.08);
return;
}
const firstId = selected.at(0).id;
const secondId = selected.at(1).id;
const cooked = allRecipes.find(function(r) {
return (r.item1 === firstId && r.item2 === secondId) ||
(r.item1 === secondId && r.item2 === firstId);
});
if (!cooked) {
msg.textContent = 'Такого блюда нет! Посмотрите 📋 Меню справа';
spawnEffect('Не вышло 💥', '#ff9f43');
playTone(160, 0.25, 'sawtooth', 0.1);
selected = [];
updateSlots();
return;
}
if (cooked.name === currentOrder.name) {
customerLeave(true);
} else {
msg.textContent = 'Вы сделали ' + cooked.name + ', а первый гость ждет ' + currentOrder.name + '!';
spawnEffect('Не тот заказ ❌', '#ee5253');
playTone(220, 0.2, 'sawtooth', 0.1);
selected = [];
updateSlots();
}
}
document.getElementById('slot-0').addEventListener('click', function() { removeIng(0); });
document.getElementById('slot-1').addEventListener('click', function() { removeIng(1); });
document.getElementById('serve-btn').addEventListener('click', serveDish);
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
renderUI();
fillQueue();
startActiveCustomerTimer();
