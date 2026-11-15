const ingredients = [
    { id: 'flour', name: 'Мука', emoji: '🌾' },
    { id: 'egg', name: 'Яйцо', emoji: '🥚' },
    { id: 'milk', name: 'Молоко', emoji: '🥛' },
    { id: 'cheese', name: 'Сыр', emoji: '🧀' },
    { id: 'tomato', name: 'Томат', emoji: '🍅' },
    { id: 'meat', name: 'Мясо', emoji: '🥩' },
    { id: 'choco', name: 'Шоколад', emoji: '🍫' },
    { id: 'apple', name: 'Яблоко', emoji: '🍎' }
];

const recipes = [
    { item1: 'flour', item2: 'egg', name: 'Блинчики', emoji: '🥞', price: 15 },
    { item1: 'flour', item2: 'milk', name: 'Хлеб', emoji: '🍞', price: 15 },
    { item1: 'flour', item2: 'cheese', name: 'Пицца', emoji: '🍕', price: 20 },
    { item1: 'flour', item2: 'apple', name: 'Пирог', emoji: '🥧', price: 20 },
    { item1: 'flour', item2: 'choco', name: 'Пончик', emoji: '🍩', price: 20 },
    { item1: 'egg', item2: 'milk', name: 'Омлет', emoji: '🍳', price: 15 },
    { item1: 'meat', item2: 'cheese', name: 'Бургер', emoji: '🍔', price: 25 },
    { item1: 'meat', item2: 'tomato', name: 'Стейк', emoji: '🥘', price: 25 },
    { item1: 'milk', item2: 'choco', name: 'Какао', emoji: '☕', price: 18 },
    { item1: 'egg', item2: 'choco', name: 'Торт', emoji: '🎂', price: 25 }
];

const avatars = ['👩', '👨', '👧', '👦', '👵', '👴', '👱‍♀️', '🧔', '👩‍🦰', '🧑‍🦱'];

let coins = parseInt(localStorage.getItem('cafe_coins')) || 0;
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

const notes = [261.63, 329.63, 392.00, 493.88, 392.00, 329.63];
let step = 0;

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
            playTone(notes[step], 0.35, 'triangle', 0.04);
            step = (step + 1) % notes.length;
        }, 420);
    }
});

function spawnEffect(text, color) {
    const el = document.createElement('div');
    el.className = 'floating-fx';
    el.textContent = text;
    el.style.color = color || '#2ecc71';
    el.style.left = '50%';
    el.style.top = '45%';
    document.body.appendChild(el);
    setTimeout(function() { el.remove(); }, 1000);
}

function initUI() {
    document.getElementById('coins').textContent = coins;

    const dock = document.getElementById('ingredients-dock');
    ingredients.forEach(function(ing) {
        const btn = document.createElement('div');
        btn.className = 'ing-btn';
        btn.innerHTML = '<span class="ing-emoji">' + ing.emoji + '</span><span class="ing-name">' + ing.name + '</span>';
        btn.addEventListener('click', function() { addIng(ing); });
        dock.appendChild(btn);
    });

    const list = document.getElementById('recipe-list');
    recipes.forEach(function(r) {
        const i1 = ingredients.find(function(i) { return i.id === r.item1; });
        const i2 = ingredients.find(function(i) { return i.id === r.item2; });
        const row = document.createElement('div');
        row.className = 'recipe-row';
        row.innerHTML = '<span>' + i1.emoji + ' ' + i1.name + ' + ' + i2.emoji + ' ' + i2.name + '</span><span>➔ ' + r.emoji + ' ' + r.name + ' (+' + r.price + '💰)</span>';
        list.appendChild(row);
    });

    document.getElementById('slot-0').addEventListener('click', function() { removeIng(0); });
    document.getElementById('slot-1').addEventListener('click', function() { removeIng(1); });
    document.getElementById('serve-btn').addEventListener('click', serveDish);
    document.getElementById('open-menu-btn').addEventListener('click', function() { toggleMenu(true); });
    document.getElementById('close-menu-btn').addEventListener('click', function() { toggleMenu(false); });
    document.getElementById('menu-modal').addEventListener('click', function(e) {
        if (e.target === this) toggleMenu(false);
    });
}

function toggleMenu(show) {
    const modal = document.getElementById('menu-modal');
    if (show) modal.classList.add('open');
    else modal.classList.remove('open');
}

function addIng(ing) {
    if (isTransitioning) return;
    initAudio();
    if (selected.length < 2) {
        selected.push(ing);
        playTone(520, 0.08, 'sine', 0.1);
        updateSlots();
    }
}

function removeIng(idx) {
    if (selected.at(idx)) {
        initAudio();
        selected.splice(idx, 1);
        playTone(320, 0.08, 'sine', 0.1);
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

    currentOrder = recipes.at(Math.floor(Math.random() * recipes.length));
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

    clearInterval(gameLoop);
    gameLoop = setInterval(function() {
        if (document.getElementById('menu-modal').classList.contains('open')) return;
        patience -= 0.7;
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
    if (patience > 50) fill.style.backgroundColor = '#4cd137';
    else if (patience > 25) fill.style.backgroundColor = '#fbc531';
    else fill.style.backgroundColor = '#e84118';
}

function customerLeave(isHappy) {
    isTransitioning = true;
    clearInterval(gameLoop);
    const box = document.getElementById('customer-box');
    const msg = document.getElementById('status-msg');

    if (isHappy) {
        const tip = patience > 50 ? 5 : 0;
        const total = currentOrder.price + tip;
        coins += total;
        localStorage.setItem('cafe_coins', coins);
        document.getElementById('coins').textContent = coins;

        box.classList.remove('arrived');
        box.classList.add('leaving-happy');
        msg.textContent = tip > 0 ? 'Отлично! +' + total + '💰 (с чаевыми!)' : 'Спасибо! +' + total + '💰';
        spawnEffect('+' + total + ' 💰', '#27ae60');

        playTone(523.25, 0.12, 'sine', 0.1);
        setTimeout(function() { playTone(659.25, 0.12, 'sine', 0.1); }, 90);
        setTimeout(function() { playTone(783.99, 0.25, 'sine', 0.1); }, 180);
    } else {
        box.classList.remove('arrived');
        box.classList.add('leaving-angry');
        msg.textContent = 'Посетитель не дождался и ушел 😠';
        spawnEffect('Время вышло! 😠', '#e84118');
        playTone(180, 0.3, 'sawtooth', 0.1);
    }

    selected = [];
    updateSlots();
    setTimeout(nextCustomer, 900);
}

function serveDish() {
    if (isTransitioning) return;
    initAudio();
    const msg = document.getElementById('status-msg');

    if (selected.length < 2) {
        msg.textContent = 'Выберите 2 продукта снизу!';
        playTone(200, 0.15, 'sawtooth', 0.08);
        return;
    }

    const firstId = selected.at(0).id;
    const secondId = selected.at(1).id;

    const cooked = recipes.find(function(r) {
        return (r.item1 === firstId && r.item2 === secondId) ||
               (r.item1 === secondId && r.item2 === firstId);
    });

    if (!cooked) {
        msg.textContent = 'Такого блюда нет в меню! Смотрите 📖 Меню';
        spawnEffect('Испорчено! 💥', '#e67e22');
        playTone(160, 0.25, 'sawtooth', 0.1);
        selected = [];
        updateSlots();
        return;
    }

    if (cooked.name === currentOrder.name) {
        customerLeave(true);
    } else {
        msg.textContent = 'Вы приготовили ' + cooked.emoji + ' ' + cooked.name + ', а гость просил ' + currentOrder.emoji + ' ' + currentOrder.name + '!';
        spawnEffect('Не тот заказ! ❌', '#e84118');
        playTone(220, 0.2, 'sawtooth', 0.1);
        selected = [];
        updateSlots();
    }
}

initUI();
setTimeout(nextCustomer, 400);
