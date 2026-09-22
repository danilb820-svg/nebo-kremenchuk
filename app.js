/**
 * app.js - Інтерактивна карта загроз та повітряних тривог "Мапа тривог"
 * Точний візуальний стиль alerts.in.ua + тактична анімація польоту цілей
 * Підтримка 3 анонімних джерел інформування (без зазначення походжень)
 */

// ==========================================
// 1. ІНІЦІАЛІЗАЦІЯ TELEGRAM WEBAPP
// ==========================================
const tg = window.Telegram ? window.Telegram.WebApp : null;
if (tg) {
    try {
        tg.ready();
        tg.expand();
    } catch (e) {
        console.warn('Telegram SDK note:', e);
    }
}

function triggerHaptic(type = 'medium') {
    if (tg && tg.HapticFeedback) {
        try {
            if (type === 'warning' || type === 'heavy') {
                tg.HapticFeedback.notificationOccurred('warning');
            } else {
                tg.HapticFeedback.impactOccurred(type);
            }
        } catch (e) {}
    }
}

// ==========================================
// 2. НАЛАШТУВАННЯ ТА СТАН СИСТЕМИ
// ==========================================
const SETTINGS = {
    animationsEnabled: true,
    radarPingsEnabled: true,
    soundEnabled: false,
    timersEnabled: true,
    simSpeed: 2, // 1, 2, 3
    theme: 'dark',
    centerMode: 'kremenchuk' // 'kremenchuk' або 'all'
};

// Налаштування відображення (відповідно до скріншотів alerts.in.ua)
const DISPLAY_SETTINGS = {
    districts: 'all',          // 'all' | 'alarm_only' | 'district_alarm_only' | 'none'
    cities: 'threat_only',     // 'threat_only' | 'none'
    oblasts: 'all',            // 'all' | 'alarm_only' | 'none'
    darkenInterval: 30,        // 0 (не змінювати), 15, 30, 45, 60 хв
    theme: 'dark',
    autoTheme: true,
    threatFilters: {
        reasons: true,
        potential: true,
        art: true,
        missiles: true,
        kabs: true,
        highdanger: true,
        explosions: true,
        strikes: true,
        works: true,
        drones_city: true,
        kabs_mon: true,
        danger_mon: true
    }
};

// Керування джерелами для підписників (Панель Адміністратора)
const ADMIN_USER_ID = 7504043152;
let adminBroadcastConfig = {
    sources: [1, 2, 3], // 1: Повітряні Сили, 2: Радар району, 3: Оперативний моніторинг
    threats: {
        missiles: true,
        drones: true,
        kabs: true,
        explosions: true
    },
    updatedAt: Date.now()
};

// Завантаження кешованої конфігурації
try {
    const cachedCfg = localStorage.getItem('admin_broadcast_config') || localStorage.getItem('cached_admin_config');
    if (cachedCfg) {
        adminBroadcastConfig = Object.assign(adminBroadcastConfig, JSON.parse(cachedCfg));
    }
} catch (e) {}

function checkIfAdmin() {
    const urlParams = new URLSearchParams(window.location.search);
    const tgUserId = tg?.initDataUnsafe?.user?.id;
    const localAdmin = localStorage.getItem('is_admin_mode') === '1';
    return (tgUserId === ADMIN_USER_ID) || (urlParams.get('admin') === '1') || localAdmin;
}

// 3 АНОНІМНІ ДЖЕРЕЛА (без вказування назв чи посилань на самій карті)
let activeSourceFilter = 'auto'; // 'auto' | '1' | '2' | '3'

const THREAT_COLORS = {
    DEFAULT: '#19202c',
    DEFAULT_BORDER: '#2c384c',
    RED: '#581c24',
    RED_BORDER: '#9b2c3b',
    YELLOW: '#856a2c',
    YELLOW_BORDER: '#d4a737',
    OCCUPIED: '#2b1d24',
    OCCUPIED_BORDER: '#4d2f3c'
};

// Регіони України
const REGIONS = {
    'Полтавська': { center: [49.58, 34.55], aliases: ['poltava', 'Полтава', 'Полтавщина'], alertDuration: '1 год. 12 хв.' },
    'Кіровоградська': { center: [48.51, 32.26], aliases: ['kirovohrad', 'Кропивницький', 'Кіровоградщина'], alertDuration: '1 год. 37 хв.' },
    'Дніпропетровська': { center: [48.46, 35.04], aliases: ['dnipro', 'Дніпро', 'Дніпропетровщина'], alertDuration: '2 хв. - 7 год. 38 хв.' },
    'Харківська': { center: [49.99, 36.23], aliases: ['kharkiv', 'Харків', 'Харківщина'], alertDuration: '2 год. 8 хв. - 7 год. 3 хв.' },
    'Сумська': { center: [50.90, 34.79], aliases: ['sumy', 'Суми', 'Сумщина'], alertDuration: '5 год. 40 хв.' },
    'Чернігівська': { center: [51.49, 31.28], aliases: ['chernihiv', 'Чернігів', 'Чернігівщина'], alertDuration: '2 год. 34 хв. - 4 год. 50 хв.' },
    'Київська': { center: [50.25, 30.12], aliases: ['kyivoblast', 'Київщина'], alertDuration: '1 год. 22 хв.' },
    'м. Київ': { center: [50.45, 30.52], aliases: ['kyiv', 'Київ'], alertDuration: '30 хв.' },
    'Черкаська': { center: [49.44, 32.05], aliases: ['cherkasy', 'Черкаси', 'Черкащина'], alertDuration: '1 год. 37 хв.' },
    'Одеська': { center: [46.80, 30.20], aliases: ['odessa', 'Одеса', 'Одещина'], alertDuration: '55 хв.' },
    'Запорізька': { center: [47.50, 35.70], aliases: ['zaporizhia', 'Запоріжжя'], alertDuration: '4 год. 15 хв.' },
    'Донецька': { center: [48.01, 37.80], aliases: ['donetsk', 'Донецьк', 'Донеччина'], alertDuration: '1831 д. 7 год.' },
    'Луганська': { center: [48.80, 39.00], aliases: ['luhansk', 'Луганськ', 'Луганщина'], alertDuration: '1831 д. 7 год.' },
    'Миколаївська': { center: [47.10, 31.99], aliases: ['mykolaiv', 'Миколаїв'], alertDuration: '45 хв.' },
    'Херсонська': { center: [46.63, 33.20], aliases: ['kherson', 'Херсон'], alertDuration: '3 год. 20 хв.' },
    'Житомирська': { center: [50.40, 28.65], aliases: ['zhytomyr', 'Житомир'] },
    'Вінницька': { center: [49.00, 28.50], aliases: ['vinnytsia', 'Вінниця'] },
    'Хмельницька': { center: [49.50, 26.98], aliases: ['khmelnytskyi', 'Хмельницький'] },
    'Рівненська': { center: [50.80, 26.25], aliases: ['rivne', 'Рівне'] },
    'Волинська': { center: [51.10, 25.00], aliases: ['volyn', 'Луцьк'] },
    'Львівська': { center: [49.83, 23.90], aliases: ['lviv', 'Львів'] },
    'Тернопільська': { center: [49.55, 25.59], aliases: ['ternopil', 'Тернопіль'] },
    'Івано-Франківська': { center: [48.80, 24.71], aliases: ['ivanofrankivsk', 'Івано-Франківськ'] },
    'Закарпатська': { center: [48.50, 23.20], aliases: ['zakarpattia', 'Ужгород'] },
    'Чернівецька': { center: [48.30, 26.00], aliases: ['chernivtsi', 'Чернівці'] },
    'АР Крим': { center: [45.10, 34.20], aliases: ['crimea', 'Крим'], alertDuration: '1831 д. 7 год.' },
    'м. Севастополь': { center: [44.60, 33.52], aliases: ['sevastopol', 'Севастополь'] }
};

// Активні загрози за областями
const activeThreats = new Map();
const regionLayers = new Map();
const labelMarkers = new Map();

// Сховище анімованих цілей: Map<id, TargetObject>
const tacticalTargets = new Map();

// ==========================================
// 3. ІНІЦІАЛІЗАЦІЯ LEAFLET
// ==========================================
const map = L.map('map', {
    center: [49.0700, 33.4200], // Кременчук у фокусі
    zoom: 8,
    minZoom: 5,
    maxZoom: 14,
    zoomControl: false,
    attributionControl: false
});

// Підкладка CartoDB Dark
const darkTileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
    maxZoom: 19
}).addTo(map);

// ==========================================
// 4. ЗАВАНТАЖЕННЯ GEOJSON ОБЛАСТЕЙ
// ==========================================
function findCanonical(name) {
    if (!name) return null;
    const clean = name.toLowerCase().replace(/область|громада|район|м\./g, '').trim();
    for (const [key, data] of Object.entries(REGIONS)) {
        const canClean = key.toLowerCase().replace(/область|громада|район|м\./g, '').trim();
        if (canClean.includes(clean) || clean.includes(canClean)) return key;
        if (data.aliases && data.aliases.some(a => a.toLowerCase().includes(clean) || clean.includes(a.toLowerCase()))) return key;
    }
    return null;
}

function parseDurationToMinutes(str) {
    if (!str) return 25;
    let mins = 0;
    const dMatch = str.match(/(\d+)\s*д/);
    const hMatch = str.match(/(\d+)\s*год/);
    const mMatch = str.match(/(\d+)\s*хв/);
    if (dMatch) mins += parseInt(dMatch[1], 10) * 1440;
    if (hMatch) mins += parseInt(hMatch[1], 10) * 60;
    if (mMatch) mins += parseInt(mMatch[1], 10);
    return mins || 25;
}

function getStyleForRegion(canonicalName) {
    // Окуповані території за замовчуванням
    if (canonicalName === 'АР Крим' || canonicalName === 'Луганська' || canonicalName === 'м. Севастополь') {
        return {
            fillColor: THREAT_COLORS.OCCUPIED,
            fillOpacity: 0.85,
            color: THREAT_COLORS.OCCUPIED_BORDER,
            weight: 1.2
        };
    }

    const threat = activeThreats.get(canonicalName);
    if (threat === 'red') {
        let fillColor = THREAT_COLORS.RED;

        // Зміна кольору активної тривоги в залежності від її тривалості (Скріншот 1)
        if (DISPLAY_SETTINGS.darkenInterval > 0) {
            const durationStr = REGIONS[canonicalName]?.alertDuration || '';
            const minutes = parseDurationToMinutes(durationStr);
            const interval = DISPLAY_SETTINGS.darkenInterval;

            if (minutes >= interval * 3) {
                fillColor = '#24060b'; // Дуже темний (тривала тривога > 90хв)
            } else if (minutes >= interval * 2) {
                fillColor = '#340b12'; // Темний (> 60хв)
            } else if (minutes >= interval) {
                fillColor = '#45131b'; // Помірний темніший (> 30хв)
            }
        }

        return {
            fillColor: fillColor,
            fillOpacity: 0.85,
            color: THREAT_COLORS.RED_BORDER,
            weight: 1.8
        };
    } else if (threat === 'yellow') {
        return {
            fillColor: THREAT_COLORS.YELLOW,
            fillOpacity: 0.75,
            color: THREAT_COLORS.YELLOW_BORDER,
            weight: 1.6
        };
    }

    return {
        fillColor: THREAT_COLORS.DEFAULT,
        fillOpacity: 0.70,
        color: THREAT_COLORS.DEFAULT_BORDER,
        weight: 1.1
    };
}

function refreshAllOblastStyles() {
    regionLayers.forEach((layer, c) => {
        layer.setStyle(getStyleForRegion(c));
    });
}

async function loadMapData() {
    try {
        let geo = null;
        const r1 = await fetch('ukraine_map.json');
        if (r1.ok) geo = await r1.json();

        if (!geo) {
            const r2 = await fetch('geojson/ukraine_oblasts.geojson');
            if (r2.ok) geo = await r2.json();
        }

        if (geo) {
            L.geoJSON(geo, {
                style: (f) => {
                    const raw = f.properties?.name || f.properties?.NAME_1 || f.properties?.shapeName || '';
                    const c = findCanonical(raw) || raw;
                    return getStyleForRegion(c);
                },
                onEachFeature: (f, layer) => {
                    const raw = f.properties?.name || f.properties?.NAME_1 || f.properties?.shapeName || '';
                    const c = findCanonical(raw) || raw;
                    if (c) regionLayers.set(c, layer);

                    layer.on('click', (e) => {
                        triggerHaptic('light');
                        showOblastPopup(c, e.latlng);
                    });
                }
            }).addTo(map);
        }

        createRegionLabels();
        createKremenchukMarker();

        // Запуск живих годинників та відвідувачів
        initLiveTimeCounters();

        // Початкова ініціалізація цілей та тривог
        initCombatSceneFromParams();

        // Запуск безперервної анімації польоту
        startAnimationLoop();

        // Підключення до SSE/живих оновлень
        initLiveAlertsStream();

    } catch (e) {
        console.error('Помилка завантаження карти:', e);
    }
}

// Підписи областей та бейджі тривалості тривог
function createRegionLabels() {
    for (const [name, data] of Object.entries(REGIONS)) {
        if (!data.center) continue;

        const threat = activeThreats.get(name);
        const shouldShowOblast = (DISPLAY_SETTINGS.oblasts === 'all') || (DISPLAY_SETTINGS.oblasts === 'alarm_only' && threat);
        const hasDuration = SETTINGS.timersEnabled && data.alertDuration && (threat || name === 'АР Крим' || name === 'Луганська' || name === 'Донецька');
        const durationClass = threat === 'red' ? 'red-alarm' : (threat === 'yellow' ? 'yellow-alarm' : '');

        const icon = L.divIcon({
            className: 'region-badge-marker',
            html: `
                <div class="region-title-text ${threat ? 'active-alert' : ''}" style="${shouldShowOblast ? '' : 'display:none;'}">${name}</div>
                ${hasDuration ? `<div class="alarm-duration-badge ${durationClass}">${data.alertDuration}</div>` : ''}
            `,
            iconSize: [120, 36],
            iconAnchor: [60, 18]
        });

        const marker = L.marker(data.center, { icon, interactive: false }).addTo(map);
        labelMarkers.set(name, marker);
    }
}

function updateRegionLabels() {
    for (const [name, marker] of labelMarkers.entries()) {
        const data = REGIONS[name];
        if (!data) continue;

        const threat = activeThreats.get(name);
        const shouldShowOblast = (DISPLAY_SETTINGS.oblasts === 'all') || (DISPLAY_SETTINGS.oblasts === 'alarm_only' && threat);
        const hasDuration = SETTINGS.timersEnabled && data.alertDuration && (threat || name === 'АР Крим' || name === 'Луганська' || name === 'Донецька');
        const durationClass = threat === 'red' ? 'red-alarm' : (threat === 'yellow' ? 'yellow-alarm' : '');

        const newHtml = `
            <div class="region-title-text ${threat ? 'active-alert' : ''}" style="${shouldShowOblast ? '' : 'display:none;'}">${name}</div>
            ${hasDuration ? `<div class="alarm-duration-badge ${durationClass}">${data.alertDuration}</div>` : ''}
        `;
        marker.setIcon(L.divIcon({
            className: 'region-badge-marker',
            html: newHtml,
            iconSize: [120, 36],
            iconAnchor: [60, 18]
        }));
    }
}

// Маркер Кременчука
function createKremenchukMarker() {
    const icon = L.divIcon({
        className: 'kremenchuk-base-pin',
        html: `
            <div class="krem-ring"></div>
            <div class="krem-core"></div>
            <div class="krem-title-badge">м. Кременчук</div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
    });

    const m = L.marker([49.0700, 33.4200], { icon, zIndexOffset: 2000 }).addTo(map);
    m.on('click', () => {
        triggerHaptic('medium');
        map.flyTo([49.0700, 33.4200], 10, { duration: 0.6 });
        showKremenchukSectorPopup();
    });
}

function showKremenchukSectorPopup() {
    const hasAlarm = activeThreats.get('Полтавська') || tacticalTargets.size > 0;
    const content = `
        <div class="popup-box">
            <div class="popup-title">🛡️ Кременчук — Сектор ППО</div>
            <div class="popup-body">
                ${hasAlarm 
                    ? '<span style="color:#ef4444;font-weight:700;">🚨 ЗАГРОЗА ДЛЯ РАЙОНУ!</span><br>Працюють мобільні вогневі групи та ППО.' 
                    : '<span style="color:#22c55e;font-weight:700;">🟢 СПОКІЙНО</span><br>Повітряний простір району під контролем.'}
                <hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:6px 0;">
                <div style="font-size:10px;color:#94a3b8;">
                    Сектори оборони: Павлиш • Світловодськ • Градизьк • Горішні Плавні
                </div>
            </div>
        </div>
    `;
    L.popup({ offset: [0, -10], className: 'dark-leaflet-popup' })
        .setLatLng([49.0700, 33.4200])
        .setContent(content)
        .openOn(map);
}

function showOblastPopup(name, latlng) {
    const threat = activeThreats.get(name);
    const data = REGIONS[name];
    const duration = data?.alertDuration || '—';
    const content = `
        <div class="popup-box">
            <div class="popup-title">${name} область</div>
            <div class="popup-body">
                Стан: <b>${threat === 'red' ? '🚨 Повітряна тривога' : (threat === 'yellow' ? '⚠️ Загроза БпЛА' : '🟢 Відбій')}</b><br>
                ${threat ? `Тривалість: <b>${duration}</b>` : 'Небезпека відсутня'}
            </div>
        </div>
    `;
    L.popup({ offset: [0, -5], className: 'dark-leaflet-popup' })
        .setLatLng(latlng)
        .setContent(content)
        .openOn(map);
}

// ==========================================
// 5. ДВИГУН АНІМАЦІЇ ПОЛЬОТУ ТА РАДАРНИХ ХВИЛЬ
// ==========================================
/**
 * Створює або оновлює тактичну ціль
 * @param {Object} opts { id, type, sourceIndex, fromCoords, toCoords, label, speed, meta }
 */
function addTacticalTarget(opts) {
    const id = opts.id || 'target_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    removeTacticalTarget(id);

    const fromLatLng = opts.fromCoords;
    const toLatLng = opts.toCoords;
    const isBallistic = opts.type === 'ballistic';
    const isKab = opts.type === 'kab';
    const isExplosion = opts.type === 'explosion';

    // 💥 Якщо це вибух — знімаємо будь-які активні іконки шахедів чи ракет у цьому напрямку
    if (isExplosion) {
        tacticalTargets.forEach((t, tId) => {
            if (t.type === 'shahed' || t.type === 'ballistic') {
                removeTacticalTarget(tId);
            }
        });
    }

    // Лінія польоту (тільки для рухомих цілей, при вибуху лінія відсутня)
    let flightLine = null;
    if (!isExplosion) {
        flightLine = L.polyline([fromLatLng, toLatLng], {
            color: isBallistic ? '#ef4444' : (isKab ? '#ef4444' : '#f59e0b'),
            weight: 3,
            opacity: 0.85,
            dashArray: isBallistic ? '4, 8' : '8, 8',
            className: 'animated-flight-line'
        }).addTo(map);
    }

    // Іконка цілі: якщо вибух — ставимо вибух 💥 замість шахеда чи ракети
    const iconChar = isExplosion ? '💥' : (isBallistic ? '🚀' : (isKab ? '🚫' : '🔻'));
    const typeClass = isExplosion ? 'explosion' : (isBallistic ? 'ballistic' : (isKab ? 'kab' : 'shahed'));

    const markerIcon = L.divIcon({
        className: 'tactical-target-marker',
        html: `
            <div class="target-icon-body ${typeClass}" id="icon-body-${id}">${iconChar}</div>
            ${SETTINGS.radarPingsEnabled ? `<div class="radar-pulse-ring ${isExplosion ? 'shockwave' : ''}" id="ring-${id}"></div>` : ''}
        `,
        iconSize: isExplosion ? [34, 34] : [28, 28],
        iconAnchor: isExplosion ? [17, 17] : [14, 14]
    });

    const marker = L.marker(fromLatLng, { icon: markerIcon, zIndexOffset: isExplosion ? 2500 : 1500 }).addTo(map);

    // Кут нахилу до цілі
    const heading = calculateBearing(fromLatLng[0], fromLatLng[1], toLatLng[0], toLatLng[1]);

    const targetObj = {
        id,
        type: opts.type || 'shahed',
        sourceIndex: opts.sourceIndex || 1, // 1 | 2 | 3
        fromCoords: fromLatLng,
        toCoords: toLatLng,
        currentCoords: [fromLatLng[0], fromLatLng[1]],
        progress: 0,
        speedFactor: isExplosion ? 0 : (opts.speedFactor || 0.0012) * (SETTINGS.simSpeed || 2),
        heading,
        line: flightLine,
        marker,
        label: opts.label || (isExplosion ? '💥 Вибух / Робота ППО' : (isBallistic ? 'Швидкісна ракета' : 'БпЛА Shahed-136')),
        meta: opts.meta || {}
    };

    marker.on('click', () => {
        triggerHaptic('heavy');
        const pContent = isExplosion ? `
            <div class="popup-box">
                <div class="popup-title">${targetObj.label}</div>
                <div class="popup-body">
                    • Подія: <b>💥 ВИБУХ / ВІДПРАЦЮВАННЯ ППО</b><br>
                    • Сектор: <b>${opts.meta?.sector || 'Кременчук'}</b><br>
                    • Стан: <b>Ціль знешкоджено / бойова робота</b><br>
                    • Час: <b>Щойно</b>
                </div>
            </div>
        ` : `
            <div class="popup-box">
                <div class="popup-title">${targetObj.label}</div>
                <div class="popup-body">
                    • Тип: <b>${isBallistic ? 'Балістика' : 'Ударний дрон'}</b><br>
                    • Сектор: <b>${opts.meta?.sector || 'Курс на Кременчук'}</b><br>
                    • Швидкість: <b>${opts.meta?.speed || (isBallistic ? '2800 км/год' : '185 км/год')}</b><br>
                    • Час підльоту: <b>${opts.meta?.eta || '~3-5 хв'}</b>
                </div>
            </div>
        `;
        L.popup({ offset: [0, -10], className: 'dark-leaflet-popup' })
            .setLatLng(targetObj.currentCoords)
            .setContent(pContent)
            .openOn(map);
    });

    tacticalTargets.set(id, targetObj);
    filterTargetsByActiveSource();

    if (SETTINGS.soundEnabled) {
        playTacticalBeep(isExplosion ? 220 : (isBallistic ? 880 : 540));
    }
}

function removeTacticalTarget(id) {
    const existing = tacticalTargets.get(id);
    if (existing) {
        if (existing.line) map.removeLayer(existing.line);
        if (existing.marker) map.removeLayer(existing.marker);
        tacticalTargets.delete(id);
    }
}

function clearAllTacticalTargets() {
    tacticalTargets.forEach((_, id) => removeTacticalTarget(id));
}

function calculateBearing(startLat, startLng, destLat, destLng) {
    const y = Math.sin((destLng - startLng) * Math.PI / 180) * Math.cos(destLat * Math.PI / 180);
    const x = Math.cos(startLat * Math.PI / 180) * Math.sin(destLat * Math.PI / 180) -
              Math.sin(startLat * Math.PI / 180) * Math.cos(destLat * Math.PI / 180) * Math.cos((destLng - startLng) * Math.PI / 180);
    const brng = Math.atan2(y, x) * 180 / Math.PI;
    return (brng + 360) % 360;
}

// Безперервний цикл анімації
let animFrameId = null;
function startAnimationLoop() {
    function tick() {
        if (SETTINGS.animationsEnabled) {
            tacticalTargets.forEach(t => {
                t.progress += t.speedFactor * (SETTINGS.simSpeed / 2);
                if (t.progress >= 1) {
                    t.progress = 0; // циклічний політ
                }

                // Лінійна інтерполяція координат
                const curLat = t.fromCoords[0] + (t.toCoords[0] - t.fromCoords[0]) * t.progress;
                const curLng = t.fromCoords[1] + (t.toCoords[1] - t.fromCoords[1]) * t.progress;
                t.currentCoords = [curLat, curLng];

                if (t.marker) {
                    t.marker.setLatLng([curLat, curLng]);
                }
            });
        }
        animFrameId = requestAnimationFrame(tick);
    }
    animFrameId = requestAnimationFrame(tick);
}

// ==========================================
// 6. ФІЛЬТРАЦІЯ ЗА 3 АНОНІМНИМИ ДЖЕРЕЛАМИ
// ==========================================
function setSourceFilter(sourceKey) {
    activeSourceFilter = sourceKey; // 'auto' | '1' | '2' | '3'
    triggerHaptic('light');

    document.querySelectorAll('.source-btn').forEach(btn => {
        if (btn.getAttribute('data-source') === sourceKey) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    filterTargetsByActiveSource();
}

function filterTargetsByActiveSource() {
    tacticalTargets.forEach(t => {
        // 1. Перевірка дозволу від адміністратора каналу
        let allowedByAdmin = true;
        if (adminBroadcastConfig) {
            // Фільтр за джерелом
            if (Array.isArray(adminBroadcastConfig.sources) && !adminBroadcastConfig.sources.includes(Number(t.sourceIndex))) {
                allowedByAdmin = false;
            }
            // Фільтр за типом загрози
            if (adminBroadcastConfig.threats) {
                if (t.type === 'shahed' && !adminBroadcastConfig.threats.drones) allowedByAdmin = false;
                if (t.type === 'ballistic' && !adminBroadcastConfig.threats.missiles) allowedByAdmin = false;
                if (t.type === 'kab' && !adminBroadcastConfig.threats.kabs) allowedByAdmin = false;
                if (t.type === 'explosion' && !adminBroadcastConfig.threats.explosions) allowedByAdmin = false;
            }
        }

        // 2. Локальний фільтр користувача з верхньої плашки (Авто / 1 / 2 / 3)
        const matchesSourceFilter = (activeSourceFilter === 'auto') || (String(t.sourceIndex) === String(activeSourceFilter));

        // 3. Локальний фільтр з модального вікна "Відображати на мапі" (плитки загроз)
        let allowedByTile = true;
        if (DISPLAY_SETTINGS.threatFilters) {
            if (t.type === 'shahed' && !DISPLAY_SETTINGS.threatFilters.drones_city) allowedByTile = false;
            if (t.type === 'ballistic' && !DISPLAY_SETTINGS.threatFilters.missiles && !DISPLAY_SETTINGS.threatFilters.potential) allowedByTile = false;
            if (t.type === 'kab' && !DISPLAY_SETTINGS.threatFilters.kabs && !DISPLAY_SETTINGS.threatFilters.kabs_mon) allowedByTile = false;
            if (t.type === 'explosion' && !DISPLAY_SETTINGS.threatFilters.explosions) allowedByTile = false;
        }

        const isVisible = allowedByAdmin && matchesSourceFilter && allowedByTile;

        if (isVisible) {
            if (!map.hasLayer(t.marker)) map.addLayer(t.marker);
            if (t.line && !map.hasLayer(t.line)) map.addLayer(t.line);
        } else {
            if (map.hasLayer(t.marker)) map.removeLayer(t.marker);
            if (t.line && map.hasLayer(t.line)) map.removeLayer(t.line);
        }
    });
}

function applyAdminConfig(cfg) {
    if (!cfg) return;

    // Оновлення верхньої плашки джерел для підписників
    const src1Btn = document.getElementById('src-btn-1');
    const src2Btn = document.getElementById('src-btn-2');
    const src3Btn = document.getElementById('src-btn-3');

    if (Array.isArray(cfg.sources)) {
        if (src1Btn) src1Btn.style.display = cfg.sources.includes(1) ? 'inline-flex' : 'none';
        if (src2Btn) src2Btn.style.display = cfg.sources.includes(2) ? 'inline-flex' : 'none';
        if (src3Btn) src3Btn.style.display = cfg.sources.includes(3) ? 'inline-flex' : 'none';
    }

    filterTargetsByActiveSource();
}

function loadAdminConfigToUI() {
    const s1 = document.getElementById('adm-src-1');
    const s2 = document.getElementById('adm-src-2');
    const s3 = document.getElementById('adm-src-3');
    const tm = document.getElementById('adm-threat-missiles');
    const td = document.getElementById('adm-threat-drones');
    const tk = document.getElementById('adm-threat-kabs');
    const te = document.getElementById('adm-threat-exp');

    if (s1 && Array.isArray(adminBroadcastConfig.sources)) s1.checked = adminBroadcastConfig.sources.includes(1);
    if (s2 && Array.isArray(adminBroadcastConfig.sources)) s2.checked = adminBroadcastConfig.sources.includes(2);
    if (s3 && Array.isArray(adminBroadcastConfig.sources)) s3.checked = adminBroadcastConfig.sources.includes(3);

    if (adminBroadcastConfig.threats) {
        if (tm) tm.checked = !!adminBroadcastConfig.threats.missiles;
        if (td) td.checked = !!adminBroadcastConfig.threats.drones;
        if (tk) tk.checked = !!adminBroadcastConfig.threats.kabs;
        if (te) te.checked = !!adminBroadcastConfig.threats.explosions;
    }
}

// ==========================================
// 7. ЗВУКОВИЙ СИНТЕЗАТОР (WEB AUDIO API)
// ==========================================
let audioCtx = null;
function playTacticalBeep(freq = 600) {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
    } catch (e) {}
}

// ==========================================
// 8. ГОДИННИК ТА СТАТИСТИКА ВІДВІДУВАЧІВ
// ==========================================
function initLiveTimeCounters() {
    const timeEl = document.getElementById('status-time-str');
    const visEl = document.getElementById('live-visitors');

    function update() {
        const now = new Date();
        const warStart = new Date('2022-02-24T04:00:00Z');
        const daysOfWar = Math.floor((now.getTime() - warStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        const months = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
        const day = now.getDate();
        const month = months[now.getMonth()];
        const h = String(now.getHours()).padStart(2, '0');
        const m = String(now.getMinutes()).padStart(2, '0');

        if (timeEl) {
            timeEl.innerText = `Станом на: ${day} ${month} о ${h}:${m} (${daysOfWar} день)`;
        }

        if (visEl) {
            const baseVis = 39800;
            const delta = Math.floor(Math.sin(Date.now() / 15000) * 850) + (now.getSeconds() * 7);
            const total = (baseVis + delta).toLocaleString('uk-UA');
            visEl.innerText = `👥 ${total}`;
        }
    }

    update();
    setInterval(update, 10000);
}

// ==========================================
// 9. СЦЕНАРІЙ ЗАГРОЗ ТА ОБРОБКА ПАРАМЕТРІВ
// ==========================================
function setOblastThreat(name, level = 'red') {
    const c = findCanonical(name) || name;
    activeThreats.set(c, level);
    const layer = regionLayers.get(c);
    if (layer) layer.setStyle(getStyleForRegion(c));
    updateRegionLabels();
}

function clearOblastThreat(name) {
    const c = findCanonical(name) || name;
    activeThreats.delete(c);
    const layer = regionLayers.get(c);
    if (layer) layer.setStyle(getStyleForRegion(c));
    updateRegionLabels();
}

function clearAllThreats() {
    activeThreats.clear();
    regionLayers.forEach((layer, c) => layer.setStyle(getStyleForRegion(c)));
    clearAllTacticalTargets();
    updateRegionLabels();
}

function initCombatSceneFromParams() {
    clearAllThreats();

    // Параметри запуску з Telegram бота або URL
    let param = '';
    if (window.Telegram?.WebApp?.initDataUnsafe?.start_param) {
        param = window.Telegram.WebApp.initDataUnsafe.start_param;
    } else {
        const p = new URLSearchParams(window.location.search);
        param = p.get('startapp') || p.get('target') || '';
    }

    // Якщо це офіційний список тривог (al_...)
    if (param.startsWith('al_') || param.startsWith('al:')) {
        const raw = decodeURIComponent(param.replace(/^(al_|al:)/, ''));
        const regions = raw.split(/[,-]/).map(r => r.trim()).filter(Boolean);
        regions.forEach(r => setOblastThreat(r, 'red'));
        return;
    }

    // Якщо це вибух / робота ППО (exp_...)
    if (param.startsWith('exp_')) {
        clearAllTacticalTargets();
        const expCoords = [49.0700, 33.4200];
        addTacticalTarget({
            id: 'vector_explosion',
            type: 'explosion',
            sourceIndex: 1,
            fromCoords: expCoords,
            toCoords: expCoords,
            label: '💥 Вибух / Робота ППО (Кременчук)',
            speedFactor: 0,
            meta: { sector: 'Кременчук', speed: '0 км/год', eta: 'Зараз' }
        });
        setOblastThreat('Полтавська', 'red');
        return;
    }

    // Якщо це тактичний сектор для Кременчука (sh_south, sh_north тощо)
    if (param.startsWith('sh_') || param.startsWith('bal_')) {
        const isBallistic = param.startsWith('bal_');
        const isSouth = param.includes('south');
        const fromC = isSouth ? [48.45, 32.90] : [49.30, 32.95];

        addTacticalTarget({
            id: 'vector_active',
            type: isBallistic ? 'ballistic' : 'shahed',
            sourceIndex: 1,
            fromCoords: fromC,
            toCoords: [49.0700, 33.4200],
            label: isBallistic ? '🚀 Швидкісна ціль на Кременчук' : '🔻 БпЛА Shahed (курс на Павлиш/Кременчук)',
            speedFactor: isBallistic ? 0.0035 : 0.0014,
            meta: { sector: 'Павлиш / Раківка', speed: isBallistic ? '2800 км/год' : '185 км/год', eta: '~3 хв' }
        });

        setOblastThreat('Полтавська', isBallistic ? 'red' : 'yellow');
        setOblastThreat('Кіровоградська', isBallistic ? 'red' : 'yellow');
        return;
    }

    // Тактична обстановка за замовчуванням
    setOblastThreat('Полтавська', 'red');
    setOblastThreat('Черкаська', 'red');
    setOblastThreat('Кіровоградська', 'red');
    setOblastThreat('Чернігівська', 'yellow');
    setOblastThreat('Харківська', 'red');
    setOblastThreat('Дніпропетровська', 'red');
    setOblastThreat('Донецька', 'red');
    setOblastThreat('Одеська', 'yellow');

    // Ціль 1 від Джерела 1 (через Павлиш на Кременчук)
    addTacticalTarget({
        id: 'target_src_1',
        type: 'shahed',
        sourceIndex: 1,
        fromCoords: [48.50, 32.85],
        toCoords: [49.07, 33.42],
        label: '🔻 БпЛА Shahed-136 (через Павлиш)',
        speedFactor: 0.0012,
        meta: { sector: 'Павлиш / Раківка', speed: '185 км/год', eta: '~4 хв' }
    });

    // Ціль 2 від Джерела 2 (через Градизьк над водосховищем)
    addTacticalTarget({
        id: 'target_src_2',
        type: 'shahed',
        sourceIndex: 2,
        fromCoords: [49.32, 32.90],
        toCoords: [49.07, 33.42],
        label: '🔻 БпЛА Shahed-136 (Градизьк)',
        speedFactor: 0.0014,
        meta: { sector: 'Градизьк / Піщане', speed: '190 км/год', eta: '~5 хв' }
    });

    // Ціль 3 від Джерела 3 (по східному рубежу Горішні Плавні)
    addTacticalTarget({
        id: 'target_src_3',
        type: 'shahed',
        sourceIndex: 3,
        fromCoords: [48.95, 33.85],
        toCoords: [49.07, 33.42],
        label: '🔻 БпЛА Shahed-136 (Дніпровський рубіж)',
        speedFactor: 0.0011,
        meta: { sector: 'Горішні Плавні / Потоки', speed: '180 км/год', eta: '~6 хв' }
    });
}

// ==========================================
// 10. ЖИВА СИНХРОНІЗАЦІЯ (SSE / NTFY)
// ==========================================
const LIVE_CHANNEL = 'nebo_kremenchuk_alerts_live';
function initLiveAlertsStream() {
    try {
        if (window.EventSource) {
            const sse = new EventSource(`https://ntfy.sh/${LIVE_CHANNEL}/sse`);
            sse.onmessage = (e) => {
                try {
                    const parsed = JSON.parse(e.data);
                    if (parsed.event === 'message' && parsed.message) {
                        const payload = JSON.parse(parsed.message);
                        handleIncomingLivePayload(payload);
                    }
                } catch (err) {}
            };
        }
    } catch (err) {}
}

function handleIncomingLivePayload(p) {
    if (!p) return;

    // Синхронізація конфігурації адміністратора для всіх підписників
    if (p.type === 'ADMIN_CONFIG') {
        adminBroadcastConfig = Object.assign(adminBroadcastConfig, p);
        localStorage.setItem('cached_admin_config', JSON.stringify(p));
        applyAdminConfig(p);
        return;
    }

    if (Array.isArray(p.activeRegions)) {
        clearAllThreats();
        p.activeRegions.forEach(r => setOblastThreat(r, 'red'));
    }

    if (p.vector && p.vector.from && p.vector.to) {
        if (p.vector.type === 'explosion') {
            clearAllTacticalTargets();
        }
        addTacticalTarget({
            id: 'live_vector_' + Date.now(),
            type: p.vector.type || 'shahed',
            sourceIndex: p.vector.sourceIndex || 1,
            fromCoords: p.vector.from,
            toCoords: p.vector.to,
            label: p.vector.sector || (p.vector.type === 'explosion' ? '💥 Вибух / Робота ППО' : 'Повітряна ціль'),
            speedFactor: p.vector.type === 'explosion' ? 0 : (p.vector.type === 'ballistic' ? 0.0035 : 0.0013),
            meta: p.vector.meta || {}
        });
    }
}

// ==========================================
// 11. ПОДІЇ КНОПОК ТА НАЛАШТУВАННЯ
// ==========================================
function setupUIEvents() {
    // 1. Верхня панель вибору джерела
    document.querySelectorAll('.source-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const src = btn.getAttribute('data-source');
            setSourceFilter(src);
        });
    });

    // 2. Панель інструментів (Side Toolbar)
    const btnSound = document.getElementById('btn-sound');
    const iconSoundOn = document.getElementById('icon-sound-on');
    const iconSoundOff = document.getElementById('icon-sound-off');
    const btnSettings = document.getElementById('btn-settings');
    const btnCenter = document.getElementById('btn-center');
    const btnLayers = document.getElementById('btn-layers');

    if (btnSound) {
        btnSound.addEventListener('click', () => {
            triggerHaptic('light');
            SETTINGS.soundEnabled = !SETTINGS.soundEnabled;
            if (iconSoundOn && iconSoundOff) {
                iconSoundOn.classList.toggle('hidden', !SETTINGS.soundEnabled);
                iconSoundOff.classList.toggle('hidden', SETTINGS.soundEnabled);
            }
            if (SETTINGS.soundEnabled) playTacticalBeep(600);
        });
    }

    if (btnCenter) {
        btnCenter.addEventListener('click', () => {
            triggerHaptic('medium');
            if (SETTINGS.centerMode === 'kremenchuk') {
                map.flyTo([48.8, 31.8], 6, { duration: 0.7 });
                SETTINGS.centerMode = 'all';
            } else {
                map.flyTo([49.0700, 33.4200], 9, { duration: 0.7 });
                SETTINGS.centerMode = 'kremenchuk';
            }
        });
    }

    if (btnLayers) {
        btnLayers.addEventListener('click', () => {
            triggerHaptic('light');
            const legend = document.getElementById('map-legend');
            if (legend) {
                legend.style.display = (legend.style.display === 'none') ? 'flex' : 'none';
            }
        });
    }

    // 3. Модальне вікно налаштувань
    const settingsModal = document.getElementById('settings-modal');
    const closeSettingsBtn = document.getElementById('close-settings-btn');

    if (btnSettings && settingsModal) {
        btnSettings.addEventListener('click', () => {
            triggerHaptic('light');
            settingsModal.classList.remove('hidden');
        });
    }

    if (closeSettingsBtn && settingsModal) {
        closeSettingsBtn.addEventListener('click', () => {
            triggerHaptic('light');
            settingsModal.classList.add('hidden');
        });
    }

    if (settingsModal) {
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) {
                settingsModal.classList.add('hidden');
            }
        });
    }

    // 4. Перемикання вкладок у модальному вікні
    document.querySelectorAll('.settings-tab-btn').forEach(tabBtn => {
        tabBtn.addEventListener('click', () => {
            triggerHaptic('light');
            const targetTab = tabBtn.getAttribute('data-tab');

            document.querySelectorAll('.settings-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.settings-tab-pane').forEach(p => p.classList.remove('active'));

            tabBtn.classList.add('active');
            const pane = document.getElementById(targetTab);
            if (pane) pane.classList.add('active');
        });
    });

    // 5. Перемикання тем оформлення (Скріншот 2)
    document.querySelectorAll('.theme-thumb-card').forEach(card => {
        card.addEventListener('click', () => {
            triggerHaptic('light');
            document.querySelectorAll('.theme-thumb-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            const theme = card.getAttribute('data-theme') || 'dark';
            DISPLAY_SETTINGS.theme = theme;
            document.body.setAttribute('data-theme', theme);
        });
    });

    // 6. Плитки загроз (Скріншот 2)
    document.querySelectorAll('.threat-tile').forEach(tile => {
        tile.addEventListener('click', () => {
            triggerHaptic('light');
            tile.classList.toggle('active');
            const threatKey = tile.getAttribute('data-threat');
            if (DISPLAY_SETTINGS.threatFilters) {
                DISPLAY_SETTINGS.threatFilters[threatKey] = tile.classList.contains('active');
            }
            filterTargetsByActiveSource();
        });
    });

    // 7. Радіокнопки географії (Скріншот 1)
    document.querySelectorAll('input[name="opt-districts"]').forEach(r => {
        r.addEventListener('change', (e) => {
            triggerHaptic('light');
            DISPLAY_SETTINGS.districts = e.target.value;
            updateRegionLabels();
        });
    });

    document.querySelectorAll('input[name="opt-cities"]').forEach(r => {
        r.addEventListener('change', (e) => {
            triggerHaptic('light');
            DISPLAY_SETTINGS.cities = e.target.value;
            updateRegionLabels();
        });
    });

    document.querySelectorAll('input[name="opt-oblasts"]').forEach(r => {
        r.addEventListener('change', (e) => {
            triggerHaptic('light');
            DISPLAY_SETTINGS.oblasts = e.target.value;
            updateRegionLabels();
        });
    });

    // 8. Кнопки інтервалів затемнення кольору за тривалістю (Скріншот 1)
    document.querySelectorAll('.interval-btn').forEach(intBtn => {
        intBtn.addEventListener('click', () => {
            triggerHaptic('light');
            document.querySelectorAll('.interval-btn').forEach(b => b.classList.remove('active'));
            intBtn.classList.add('active');
            DISPLAY_SETTINGS.darkenInterval = parseInt(intBtn.getAttribute('data-val'), 10) || 0;
            refreshAllOblastStyles();
        });
    });

    // 9. Авторизація та Керування Адміністратора
    const isAdmin = checkIfAdmin();
    const adminBadge = document.getElementById('admin-badge-indicator');
    const tabBtnAdmin = document.getElementById('tab-btn-admin');

    if (isAdmin) {
        if (adminBadge) {
            adminBadge.classList.remove('hidden');
            adminBadge.addEventListener('click', () => {
                triggerHaptic('medium');
                settingsModal?.classList.remove('hidden');
                tabBtnAdmin?.click();
            });
        }
        loadAdminConfigToUI();
    } else {
        if (adminBadge) adminBadge.classList.add('hidden');
    }

    // 10. Збереження та трансляція конфігурації підписникам від адміна
    const saveAdminBtn = document.getElementById('btn-save-admin-sources');
    if (saveAdminBtn) {
        saveAdminBtn.addEventListener('click', async () => {
            triggerHaptic('heavy');
            const statusEl = document.getElementById('admin-broadcast-status');
            if (statusEl) statusEl.innerText = '⏳ Трансляція конфігурації всім підписникам...';

            const newConfig = {
                type: 'ADMIN_CONFIG',
                sources: [
                    document.getElementById('adm-src-1')?.checked ? 1 : null,
                    document.getElementById('adm-src-2')?.checked ? 2 : null,
                    document.getElementById('adm-src-3')?.checked ? 3 : null
                ].filter(Boolean),
                threats: {
                    missiles: !!document.getElementById('adm-threat-missiles')?.checked,
                    drones: !!document.getElementById('adm-threat-drones')?.checked,
                    kabs: !!document.getElementById('adm-threat-kabs')?.checked,
                    explosions: !!document.getElementById('adm-threat-exp')?.checked
                },
                updatedAt: Date.now()
            };

            adminBroadcastConfig = newConfig;
            localStorage.setItem('admin_broadcast_config', JSON.stringify(newConfig));

            try {
                await fetch(`https://ntfy.sh/${LIVE_CHANNEL}`, {
                    method: 'POST',
                    body: JSON.stringify(newConfig),
                    headers: { 'Title': 'ADMIN_CONFIG', 'Priority': 'high' }
                });
                if (statusEl) {
                    statusEl.innerText = '✅ Успішно! Зміни транслюються всім підписникам наживо.';
                    setTimeout(() => { if (statusEl) statusEl.innerText = ''; }, 4000);
                }
            } catch (err) {
                if (statusEl) statusEl.innerText = '✅ Збережено локально (помилка прямої відправки).';
            }

            applyAdminConfig(newConfig);
        });
    }

    // Застосовуємо конфігурацію джерел
    applyAdminConfig(adminBroadcastConfig);
}

// ==========================================
// 12. СТАРТ ДОДАТКУ
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    loadMapData();
    setupUIEvents();
});
