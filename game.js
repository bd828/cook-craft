const allIngredients = [
    { id: 'bun', name: 'Булка', emoji: '🥖', unlocked: true },
    { id: 'sausage', name: 'Сосиска', emoji: '🌭', unlocked: true },
    { id: 'patty', name: 'Котлета', emoji: '🥩', unlocked: true },
    { id: 'cheese', name: 'Сыр', emoji: '🧀', unlocked: true },
    { id: 'tomato', name: 'Томат', emoji: '🍅', unlocked: false },
    { id: 'potato', name: 'Картофель', emoji: '🥔', unlocked: false },
    { id: 'dough', name: 'Тесто', emoji: '🫓', unlocked: false },
    { id: 'choco', name: 'Шоколад', emoji: '🍫', unlocked: false }
];

const allRecipes = [
    { item1: 'bun', item2: 'sausage', name: 'Хот-дог', emoji: '🌭', price: 15 },
    { item1: 'bun', item2: 'patty', name: 'Бургер', emoji: '🍔', price: 20 },
    { item1: 'bun', item2: 'cheese', name: 'Тост с сыром', emoji: '🥪', price: 15 },
    { item1: 'patty', item2: 'cheese', name: 'Чизбургер', emoji: '🍔', price: 25 },
    { item1: 'patty', item2: 'tomato', name: 'Стейк-салат', emoji: '🥗', price: 30 },
    { item1: 'potato', item2: 'cheese', name: 'Фри с сыром', emoji: '🍟', price: 28 },
    { item1: 'dough', item2: 'cheese', name: 'Пицца', emoji: '🍕', price: 35 },
    { item1: 'dough', item2: 'tomato', name: 'Маргарита', emoji: '🍕', price: 32 },
    { item1: 'dough', item2: 'choco', name: 'Пончик', emoji: '🍩', price: 35 },
    { item1: 'bun', item2: 'choco', name: 'Круассан', emoji: '🥐', price: 30 }
];

const avatars = ['🧑', '👩', '👨', '🧔', '👱‍♀️', '👩‍🦰', '🧑‍🦱', '🧢', '🕶️', '🎧'];

let state = JSON.parse(localStorage.getItem('foodtruck_save')) || {
    coins: 0,
    ordersDone: 0,
    grillLevel: 1,
    neonBought: false,
    unlockedIngs: ['bun', 'sausage', 'patty', 'cheese']
};

let selected = [];
let currentOrder = null;
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
    localStorage.setItem('foodtruck_save', JSON.stringify(state));
}

function getLevel() {
    return Math.floor(state.ordersDone / 3) + 1;
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
    el.style.left = '45%';
    el.style.top = '42%';
    document.body.appendChild(el);
    setTimeout(function() { el.remove(); }, 1000);
}

function getAvailableRecipes() {
    return allRecipes.filter(function(r) {
        return state.unlockedIngs.includes(r.item1) && state.unlockedIngs.includes(r.item2);
    });
}

function renderUI() {
    const lvl = getLevel();
    document.getElementById('coins').textContent = state.coins;
    document.getElementById('level').textContent = lvl;

    if (state.neonBought) {
        document.getElementById('neon-decor').classList.add('active');
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

    // Боковая шпаргалка (работает до 10 уровня)
    const sideMenu = document.getElementById('side-menu');
    const sideList = document.getElementById('side-recipe-list');
    const hintStatus = document.getElementById('hint-status');
    sideList.innerHTML = '';

    if (lvl <= 10) {
        sideMenu.classList.remove('locked');
        hintStatus.textContent = 'Активна (до 10 ур.)';
        getAvailableRecipes().forEach(function(r) {
            const i1 = allIngredients.find(function(i) { return i.id === r.item1; });
            const i2 = allIngredients.find(function(i) { return i.id === r.item2; });
            const row = document.createElement('div');
            row.className = 'side-recipe-item';
            row.innerHTML = '<span>' + i1.emoji + '+' + i2.emoji + '</span><span>' + r.emoji + ' ' + r.name + '</span>';
            sideList.appendChild(row);
        });
    } else {
        sideMenu.classList.add('locked');
        hintStatus.textContent = 'Режим Шефа (10+ ур.)';
        const lockNote = document.createElement('div');
        lockNote.className = 'locked-msg';
        lockNote.textContent = 'Подсказки отключены! Готовьте по памяти 🔥';
        sideMenu.appendChild(lockNote);
    }
}

function renderShop() {
    const list = document.getElementById('shop-list');
    list.innerHTML = '';

    // 1. Улучшение гриля
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

    // 2. Неоновая вывеска
    const neonDiv = document.createElement('div');
    neonDiv.className = 'shop-item';
    neonDiv.innerHTML =
        '<div class="shop-info"><h3>💡 Неоновая вывеска</h3>' +
        '<p>Гости ждут на 30% дольше и любуются улицей</p></div>' +
        '<button class="buy-btn" ' + (state.neonBought || state.coins < 90 ? 'disabled' : '') + '>' +
        (state.neonBought ? 'Куплено' : '90 💰') + '</button>';
    neonDiv.querySelector('button').addEventListener('click', function() {
        if (!state.neonBought && state.coins >= 90) {
            state.coins -= 90;
            state.neonBought = true;
            saveGame();
            renderUI();
            renderShop();
            playTone(650, 0.2, 'sine', 0.1);
        }
    });
    list.appendChild(neonDiv);

    // 3. Новые продукты
    const unlockItems = [
        { id: 'tomato', title: '🍅 Свежие томаты', desc: 'Открывает стейк-салат', cost: 50 },
        { id: 'potato', title: '🥔 Картофель фри', desc: 'Открывает фри с сыром', cost: 80 },
        { id: 'dough', title: '🫓 Тесто для пиццы', desc: 'Открывает пиццу', cost: 120 },
        { id: 'choco', title: '🍫 Бельгийский шоколад', desc: 'Открывает десерты', cost: 160 }
    ];

    unlockItems.forEach(function(u) {
        const isBought = state.unlockedIngs.includes(u.id);
        const div = document.createElement('div');
        div.className = 'shop-item';
        div.innerHTML =
            '<div class="shop-info"><h3>' + u.title + '</h3><p>' + u.desc + '</p></div>' +
            '<button class="buy-btn" ' + (isBought || state.coins < u.cost ? 'disabled' : '') + '>' +
            (isBought ? 'Открыто' : u.cost + ' 💰') + '</button>';
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

function nextCustomer() {
    isTransitioning = false;
const box = document.getElementById('customer-box');
box.className = 'customer-wrapper';
const available = getAvailableRecipes();
currentOrder = available.at(Math.floor(Math.random() * available.length));
const avatar = avatars.at(Math.floor(Math.random() * avatars.length));
document.getElementById('customer-avatar').textContent = avatar;
document.getElementById('order-emoji').textContent = currentOrder.emoji;
document.getElementById('order-name').textContent = currentOrder.name;
patience = 100;
updatePatienceBar();
setTimeout(function() {
box.classList.add('arrived');
playTone(440, 0.1, 'sine', 0.05);
}, 50);
const drainSpeed = state.neonBought ? 0.45 : 0.65;
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
fill.style.width = Math.max(0, patience) + '%';
if (patience > 50) fill.style.backgroundColor = '#1dd1a1';
else if (patience > 25) fill.style.backgroundColor = '#feca57';
else fill.style.backgroundColor = '#ee5253';
}
function customerLeave(isHappy) {
isTransitioning = true;
clearInterval(gameLoop);
const box = document.getElementById('customer-box');
const msg = document.getElementById('status-msg');
if (isHappy) {
const grillBonus = (state.grillLevel - 1) * 5;
const tip = patience > 55 ? 5 : 0;
const total = currentOrder.price + grillBonus + tip;
state.coins += total;
state.ordersDone += 1;
saveGame();
renderUI();
box.classList.remove('arrived');
box.classList.add('leaving-happy');
msg.textContent = tip > 0 ? 'Вкуснотища! +' + total + '💰 (чаевые!)' : 'Заказ выдан! +' + total + '💰';
spawnEffect('+' + total + ' 💰', '#1dd1a1');
playTone(523.25, 0.12, 'sine', 0.1);
setTimeout(function() { playTone(659.25, 0.12, 'sine', 0.1); }, 90);
setTimeout(function() { playTone(783.99, 0.25, 'sine', 0.1); }, 180);
} else {
box.classList.remove('arrived');
box.classList.add('leaving-angry');
msg.textContent = 'Клиент не дождался и ушел в соседнее кафе 😠';
spawnEffect('Ушел! 😠', '#ee5253');
playTone(180, 0.3, 'sawtooth', 0.1);
}
selected = [];
updateSlots();
setTimeout(nextCustomer, 850);
}
function serveDish() {
if (isTransitioning) return;
initAudio();
const msg = document.getElementById('status-msg');
if (selected.length < 2) {
msg.textContent = 'Положите 2 продукта на прилавок!';
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
msg.textContent = 'Продукты не сочетаются! Гляньте шпаргалку справа';
spawnEffect('Не вышло 💥', '#ff9f43');
playTone(160, 0.25, 'sawtooth', 0.1);
selected = [];
updateSlots();
return;
}
if (cooked.name === currentOrder.name) {
customerLeave(true);
} else {
msg.textContent = 'Получился ' + cooked.name + ', а гость заказывал ' + currentOrder.name + '!';
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
setTimeout(nextCustomer, 400);
