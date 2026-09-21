/**
 * app.js - Інтерактивна тактична карта загроз та тривог "Небо Кременчука"
 * Точний візуальний стиль alerts.in.ua + тактичний радар ППО для Кременчука
 * Офіційне відображення тривог та відбоїв у реальному часі
 * АВТОМАТИЧНЕ ЖИВЕ ОНОВЛЕННЯ ТРИВОГ (SSE / POLLING) БЕЗ ПЕРЕЗАВАНТАЖЕННЯ СТОРІНКИ
 */

// ==========================================
// 1. TELEGRAM WEBAPP SDK ІНІЦІАЛІЗАЦІЯ
// ==========================================
const tg = window.Telegram ? window.Telegram.WebApp : null;

if (tg) {
    try {
        tg.ready();
        tg.expand();
        if (tg.colorScheme === 'dark' || tg.themeParams?.bg_color) {
            document.body.setAttribute('data-theme', 'dark');
            if (tg.themeParams?.bg_color) {
                document.documentElement.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color);
            }
            if (tg.themeParams?.text_color) {
                document.documentElement.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color);
            }
        }
    } catch (e) {
        console.warn('Telegram SDK note:', e);
    }
}

function triggerHapticFeedback(type = 'medium') {
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
// 2. КОНФІГУРАЦІЯ ТА КОЛЬОРИ (ALERTS.IN.UA)
// ==========================================
const THREAT_COLORS = {
    DEFAULT: '#1c2638',        // Спокійна область (темний синьо-графітовий)
    DEFAULT_BORDER: '#2c3b54',
    RED: '#581c24',            // Червона тривога (темно-бордовий alerts.in.ua)
    RED_BORDER: '#ef4444',
    YELLOW: '#cda34f',         // Загроза БПЛА (пісочно-жовтий)
    YELLOW_BORDER: '#f59e0b'
};

// Регіони України: координати центрів для підписів та синоніми
const REGION_INFO = {
    'Полтавська': { center: [49.58, 34.55], aliases: ['poltavaoblast', 'Poltava Oblast', 'Полтава', 'Полтавська область', 'Полтавщина'] },
    'Кіровоградська': { center: [48.51, 32.26], aliases: ['kirovohradoblast', 'Kirovohrad Oblast', 'Кропивницький', 'Кіровоградська область', 'Кіровоградщина'] },
    'Дніпропетровська': { center: [48.46, 35.04], aliases: ['dnipropetrovskoblast', 'Dnipropetrovsk Oblast', 'Дніпро', 'Дніпропетровська область', 'Дніпропетровщина'] },
    'Харківська': { center: [49.99, 36.23], aliases: ['kharkivoblast', 'Kharkiv Oblast', 'Харків', 'Харківська область', 'Харківщина'] },
    'Сумська': { center: [50.90, 34.79], aliases: ['sumyoblast', 'Sumy Oblast', 'Суми', 'Сумська область', 'Сумщина'] },
    'Чернігівська': { center: [51.49, 31.28], aliases: ['chernihivoblast', 'Chernihiv Oblast', 'Чернігів', 'Чернігівська область', 'Чернігівщина'] },
    'Київська': { center: [50.25, 30.12], aliases: ['kyivoblast', 'Kyiv Oblast', 'Київська область', 'Київщина'] },
    'м. Київ': { center: [50.45, 30.52], aliases: ['kyiv', 'Kyiv', 'Київ'] },
    'Черкаська': { center: [49.44, 32.05], aliases: ['cherkasyoblast', 'Cherkasy Oblast', 'Черкаси', 'Черкаська область', 'Черкащина'] },
    'Запорізька': { center: [47.50, 35.70], aliases: ['zaporizhiaoblast', 'Zaporizhia Oblast', 'Запоріжжя', 'Запорізька область', 'Запоріжчина'] },
    'Донецька': { center: [48.01, 37.80], aliases: ['donetskoblast', 'Donetsk Oblast', 'Донецьк', 'Донецька область', 'Донеччина'] },
    'Луганська': { center: [48.80, 39.00], aliases: ['luhanskoblast', 'Luhansk Oblast', 'Луганськ', 'Луганська область', 'Луганщина'] },
    'Миколаївська': { center: [47.10, 31.99], aliases: ['mykolaivoblast', 'Mykolaiv Oblast', 'Миколаїв', 'Миколаївська область', 'Миколаївщина'] },
    'Херсонська': { center: [46.63, 33.20], aliases: ['khersonoblast', 'Kherson Oblast', 'Херсон', 'Херсонська область', 'Херсонщина'] },
    'Одеська': { center: [46.80, 30.20], aliases: ['odessaoblast', 'Odessa Oblast', 'Одеса', 'Одеська область', 'Одещина'] },
    'Житомирська': { center: [50.40, 28.65], aliases: ['zhytomyroblast', 'Zhytomyr Oblast', 'Житомир', 'Житомирська область', 'Житомирщина'] },
    'Вінницька': { center: [49.00, 28.50], aliases: ['vinnytsiaoblast', 'Vinnytsia Oblast', 'Вінниця', 'Вінницька область', 'Вінниччина'] },
    'Хмельницька': { center: [49.50, 26.98], aliases: ['khmelnytskyioblast', 'Khmelnytskyi Oblast', 'Хмельницький', 'Хмельницька область', 'Хмельниччина'] },
    'Рівненська': { center: [50.80, 26.25], aliases: ['rivneoblast', 'Rivne Oblast', 'Рівне', 'Рівненська область', 'Рівненщина'] },
    'Волинська': { center: [51.10, 25.00], aliases: ['volynoblast', 'Volyn Oblast', 'Луцьк', 'Волинська область', 'Волинь'] },
    'Львівська': { center: [49.83, 23.90], aliases: ['lvivoblast', 'Lviv Oblast', 'Львів', 'Львівська область', 'Львівщина'] },
    'Тернопільська': { center: [49.55, 25.59], aliases: ['ternopiloblast', 'Ternopil Oblast', 'Тернопіль', 'Тернопільська область', 'Тернопільщина'] },
    'Івано-Франківська': { center: [48.80, 24.71], aliases: ['ivanofrankivskoblast', 'Ivano-Frankivsk Oblast', 'Івано-Франківськ', 'Івано-Франківська область', 'Прикарпаття'] },
    'Закарпатська': { center: [48.50, 23.20], aliases: ['zakarpattiaoblast', 'Zakarpattia Oblast', 'Ужгород', 'Закарпатська область', 'Закарпаття'] },
    'Чернівецька': { center: [48.30, 26.00], aliases: ['chernivtsioblast', 'Chernivtsi Oblast', 'Чернівці', 'Чернівецька область', 'Буковина'] },
    'АР Крим': { center: [45.10, 34.20], aliases: ['autonomousrepublicofcrimea', 'Autonomous Republic of Crimea', 'Крим', 'Автономна Республіка Крим'] },
    'м. Севастополь': { center: [44.60, 33.52], aliases: ['sevastopol', 'Sevastopol', 'Севастополь'] }
};

// Стан мапи
const activeThreats = new Map();
const regionLayers = new Map();
const labelElements = new Map();
const activeVectors = new Map();

// ==========================================
// 3. ІНІЦІАЛІЗАЦІЯ КАРТИ LEAFLET
// ==========================================
const map = L.map('map', {
    center: [48.6, 31.8],
    zoom: 6,
    minZoom: 5,
    maxZoom: 14,
    zoomControl: false,
    attributionControl: false
});

// Додаємо підкладку CartoDB Dark
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
    maxZoom: 19
}).addTo(map);

// Кастомна кнопка геолокації Кременчука
const CenterControl = L.Control.extend({
    options: { position: 'bottomright' },
    onAdd: function() {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
        const button = L.DomUtil.create('a', 'center-btn', container);
        button.innerHTML = '🎯';
        button.title = 'Центрувати на Кременчук';
        button.href = '#';
        button.style.fontSize = '18px';
        button.style.lineHeight = '30px';
        button.style.textAlign = 'center';
        button.style.width = '32px';
        button.style.height = '32px';
        button.style.display = 'block';
        button.style.background = '#151d2a';
        button.style.color = '#fff';
        button.style.border = '1px solid #2c3b54';
        button.style.borderRadius = '6px';
        button.style.cursor = 'pointer';

        L.DomEvent.on(button, 'click', function(e) {
            L.DomEvent.stop(e);
            map.flyTo([49.0700, 33.4200], 10, { duration: 0.8 });
            triggerHapticFeedback('light');
        });
        return container;
    }
});
map.addControl(new CenterControl());

// ==========================================
// 4. ЗАВАНТАЖЕННЯ GEOJSON ОБЛАСТЕЙ УКРАЇНИ
// ==========================================
function findCanonicalRegion(inputName) {
    if (!inputName) return null;
    const clean = inputName.toLowerCase().replace(/область|територіальна громада|громада|район|м./g, '').trim();
    for (const [canonical, data] of Object.entries(REGION_INFO)) {
        const canClean = canonical.toLowerCase().replace(/область|територіальна громада|громада|район|м./g, '').trim();
        if (canClean.includes(clean) || clean.includes(canClean)) {
            return canonical;
        }
        if (data.aliases.some(a => a.toLowerCase().includes(clean) || clean.includes(a.toLowerCase()))) {
            return canonical;
        }
    }
    return null;
}

function getRegionStyle(threatLevel) {
    if (threatLevel === 'red') {
        return {
            fillColor: THREAT_COLORS.RED,
            fillOpacity: 0.78,
            color: THREAT_COLORS.RED_BORDER,
            weight: 1.8,
            opacity: 0.95
        };
    } else if (threatLevel === 'yellow') {
        return {
            fillColor: THREAT_COLORS.YELLOW,
            fillOpacity: 0.75,
            color: THREAT_COLORS.YELLOW_BORDER,
            weight: 1.8,
            opacity: 0.95
        };
    } else {
        return {
            fillColor: THREAT_COLORS.DEFAULT,
            fillOpacity: 0.65,
            color: THREAT_COLORS.DEFAULT_BORDER,
            weight: 1.1,
            opacity: 0.8
        };
    }
}

async function loadUkraineMap() {
    try {
        let geoData = null;
        try {
            const resp = await fetch('ukraine_map.json');
            if (resp.ok) geoData = await resp.json();
        } catch (e) {}

        if (!geoData) {
            const resp2 = await fetch('geojson/ukraine_oblasts.geojson');
            if (resp2.ok) geoData = await resp2.json();
        }

        if (!geoData) {
            console.error('Не знайдено файл геометрії областей');
            return;
        }

        const geoLayer = L.geoJSON(geoData, {
            style: (feature) => {
                const rawName = feature.properties?.name || feature.properties?.NAME_1 || feature.properties?.shapeName || '';
                const canonical = findCanonicalRegion(rawName) || rawName;
                const threat = activeThreats.get(canonical);
                return getRegionStyle(threat);
            },
            onEachFeature: (feature, layer) => {
                const rawName = feature.properties?.name || feature.properties?.NAME_1 || feature.properties?.shapeName || '';
                const canonical = findCanonicalRegion(rawName) || rawName;

                if (canonical) {
                    regionLayers.set(canonical, layer);
                }

                layer.on({
                    mouseover: (e) => {
                        const curThreat = activeThreats.get(canonical);
                        if (!curThreat) {
                            e.target.setStyle({ fillOpacity: 0.85, weight: 1.6, color: '#4a6288' });
                        }
                    },
                    mouseout: (e) => {
                        const curThreat = activeThreats.get(canonical);
                        e.target.setStyle(getRegionStyle(curThreat));
                    },
                    click: (e) => {
                        triggerHapticFeedback('light');
                        showRegionPopup(canonical, e.latlng);
                    }
                });
            }
        }).addTo(map);

        addRegionLabels();
        addKremenchukMarker();

        // Початкова ініціалізація сцени з параметрів посилання
        initActiveCombatScene();

        // Запуск автоматичного живого оновлення
        initLiveAutoUpdates();

    } catch (err) {
        console.error('Помилка завантаження геоданих:', err);
    }
}

// ==========================================
// 5. ПІДПИСИ ОБЛАСТЕЙ ТА МАРКЕР КРЕМЕНЧУКА
// ==========================================
function addRegionLabels() {
    for (const [name, info] of Object.entries(REGION_INFO)) {
        if (!info.center) continue;

        const icon = L.divIcon({
            className: 'region-name-label',
            html: `<span class="label-text" id="label-${encodeURIComponent(name)}">${name}</span>`,
            iconSize: [120, 20],
            iconAnchor: [60, 10]
        });

        const marker = L.marker(info.center, { icon, interactive: false }).addTo(map);
        labelElements.set(name, marker);
    }
}

function addKremenchukMarker() {
    const kremIcon = L.divIcon({
        className: 'kremenchuk-base-pin',
        html: `
            <div class="krem-pulse-ring"></div>
            <div class="krem-center-core"></div>
            <div class="krem-caption">м. Кременчук</div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });

    const marker = L.marker([49.0700, 33.4200], { icon: kremIcon, zIndexOffset: 1000 }).addTo(map);
    marker.on('click', () => {
        triggerHapticFeedback('medium');
        map.flyTo([49.0700, 33.4200], 11, { duration: 0.6 });
        showKremenchukDetails();
    });
}

function showKremenchukDetails() {
    const hasActiveThreat = activeThreats.get('Полтавська') || activeVectors.size > 0;
    const content = `
        <div class="popup-box">
            <div class="popup-title">🛡️ Кременчук — Сектор ППО</div>
            <div class="popup-body">
                ${hasActiveThreat 
                    ? '<span style="color:#ef4444;font-weight:700;">🚨 УВАГА: ЗАГРОЗА ДЛЯ РАЙОНУ!</span><br>Працюють сили ППО та мобільні вогневі групи.' 
                    : '<span style="color:#22c55e;font-weight:700;">🟢 ОБСТАНОВКА СПОКІЙНА</span><br>Прямої загрози для міста наразі не виявлено.'}
                <hr style="border:none;border-top:1px solid #2c3b54;margin:8px 0;">
                <div style="font-size:11px;color:#94a3b8;">Рубежі оборони: Павлиш • Світловодськ • Градизьк • Горішні Плавні</div>
            </div>
        </div>
    `;
    L.popup({ offset: [0, -10], className: 'dark-leaflet-popup' })
        .setLatLng([49.0700, 33.4200])
        .setContent(content)
        .openOn(map);
}

function showRegionPopup(regionName, latlng) {
    const threat = activeThreats.get(regionName);
    const content = `
        <div class="popup-box">
            <div class="popup-title">${regionName} область</div>
            <div class="popup-status ${threat || 'calm'}">
                ${threat === 'red' ? '🚨 ПОВІТРЯНА ТРИВОГА' : (threat === 'yellow' ? '⚠️ ПІДВИЩЕНА НЕБЕЗПЕКА (БПЛА)' : '🟢 СПОКІЙНО')}
            </div>
            <div style="font-size:11px;color:#64748b;margin-top:4px;">
                Офіційний реєстр повітряних тривог України
            </div>
        </div>
    `;
    L.popup({ offset: [0, -5], className: 'dark-leaflet-popup' })
        .setLatLng(latlng)
        .setContent(content)
        .openOn(map);
}

// ==========================================
// 6. КЕРУВАННЯ СТАНОМ ТРИВОГ
// ==========================================
function setRegionThreat(regionName, level = 'red') {
    const canonical = findCanonicalRegion(regionName) || regionName;
    activeThreats.set(canonical, level);

    const layer = regionLayers.get(canonical);
    if (layer) {
        layer.setStyle(getRegionStyle(level));
    }

    const labelMarker = labelElements.get(canonical);
    if (labelMarker) {
        const el = document.getElementById('label-' + encodeURIComponent(canonical));
        if (el) {
            el.className = 'label-text ' + (level ? 'threat-' + level : '');
        }
    }
}

function clearRegionThreat(regionName) {
    const canonical = findCanonicalRegion(regionName) || regionName;
    activeThreats.delete(canonical);

    const layer = regionLayers.get(canonical);
    if (layer) {
        layer.setStyle(getRegionStyle(null));
    }

    const labelMarker = labelElements.get(canonical);
    if (labelMarker) {
        const el = document.getElementById('label-' + encodeURIComponent(canonical));
        if (el) el.className = 'label-text';
    }
}

function clearAllThreats() {
    activeThreats.forEach((_, name) => clearRegionThreat(name));
    activeThreats.clear();
    clearAllVectors();
    updateHeaderStatus();
}

function updateHeaderStatus() {
    const activeBadge = document.getElementById('active-alarms-badge');
    const subtitle = document.getElementById('threat-summary');

    let redCount = 0;
    activeThreats.forEach(lvl => { if (lvl === 'red') redCount++; });

    if (activeBadge) {
        if (redCount > 0) {
            activeBadge.innerText = redCount + ' тривог';
            activeBadge.className = 'header-badge active-alert';
        } else {
            activeBadge.innerText = '0 тривог';
            activeBadge.className = 'header-badge';
        }
    }

    if (subtitle) {
        const poltavaThreat = activeThreats.get('Полтавська');
        if (poltavaThreat === 'red' || activeVectors.size > 0) {
            subtitle.innerText = '🚨 ТРИВОГА ПО РАЙОНУ!';
            subtitle.style.color = '#ef4444';
        } else if (poltavaThreat === 'yellow') {
            subtitle.innerText = '⚠️ Загроза БПЛА поблизу!';
            subtitle.style.color = '#f59e0b';
        } else {
            subtitle.innerText = 'Кременчук та район у нормі';
            subtitle.style.color = '#94a3b8';
        }
    }
}

// ==========================================
// 7. ТАКТИЧНІ ВЕКТОРИ ЦІЛЕЙ (ШАХЕДИ / БАЛІСТИКА)
// ==========================================
function createThreatVector(id, fromLatLng, toLatLng, type = 'shahed', options = {}) {
    removeThreatVector(id);

    const isBallistic = type === 'ballistic';
    const lineColor = isBallistic ? '#ef4444' : '#f59e0b';

    const pathLine = L.polyline([fromLatLng, toLatLng], {
        color: lineColor,
        weight: 3.5,
        opacity: 0.95,
        dashArray: isBallistic ? '4, 8' : '8, 8',
        className: isBallistic ? 'ballistic-anim-line' : 'shahed-anim-line'
    }).addTo(map);

    const iconHtml = isBallistic 
        ? '<div class="missile-marker">🚀</div>'
        : '<div class="shahed-marker">🔻</div>';

    const targetMarker = L.marker(fromLatLng, {
        icon: L.divIcon({
            className: 'live-target-icon',
            html: iconHtml,
            iconSize: [28, 28],
            iconAnchor: [14, 14]
        }),
        zIndexOffset: 999
    }).addTo(map);

    targetMarker.on('click', () => {
        triggerHapticFeedback('medium');
        const popupText = `
            <div class="popup-box">
                <div class="popup-title">${options.label || (isBallistic ? 'Швидкісна ракета' : 'БПЛА Shahed-136')}</div>
                <div class="popup-body">
                    <b>Напрямок:</b> ${options.sector || 'курс на Кременчук'}<br>
                    <b>Швидкість:</b> ${options.speed || (isBallistic ? '~2800 км/год' : '~185 км/год')}<br>
                    <b>Висота:</b> ${options.altitude || (isBallistic ? '12 000 м' : '250 м')}<br>
                    <b>Розрахунковий час:</b> ${options.eta || '~3-5 хв'}
                </div>
            </div>
        `;
        L.popup({ offset: [0, -10], className: 'dark-leaflet-popup' })
            .setLatLng(fromLatLng)
            .setContent(popupText)
            .openOn(map);
    });

    activeVectors.set(id, { line: pathLine, marker: targetMarker });
}

function removeThreatVector(id) {
    const existing = activeVectors.get(id);
    if (existing) {
        if (existing.line) map.removeLayer(existing.line);
        if (existing.marker) map.removeLayer(existing.marker);
        activeVectors.delete(id);
    }
}

function clearAllVectors() {
    activeVectors.forEach((_, id) => removeThreatVector(id));
}

// Отримання параметра запуску
function getActiveParam() {
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.start_param) {
        return window.Telegram.WebApp.initDataUnsafe.start_param;
    }
    const params = new URLSearchParams(window.location.search);
    return params.get('startapp') || params.get('target') || '';
}

// Розбір параметру офіційних тривог: "al_Луганська,Харківська..." або "al_clear"
function decodeAlertsParam(param) {
    if (!param) return null;

    if (param === 'al_clear' || param === 'sp_clear') {
        return { clearAll: true, activeRegions: [] };
    }

    if (param.startsWith('al_') || param.startsWith('al:')) {
        const raw = decodeURIComponent(param.replace(/^(al_|al:)/, ''));
        const regions = raw.split(/[,-]/).map(r => r.trim()).filter(Boolean);
        return { clearAll: false, activeRegions: regions };
    }

    return null;
}

// ==========================================
// 8. ГОЛОВНА ІНІЦІАЛІЗАЦІЯ ОБСТАНОВКИ (ОФІЦІЙНІ ДАНІ)
// ==========================================
function initActiveCombatScene() {
    const param = getActiveParam();
    const alertsData = decodeAlertsParam(param);

    clearAllThreats();

    // 1. Якщо передано список реальних тривог від офіційного джерела
    if (alertsData) {
        if (alertsData.clearAll || alertsData.activeRegions.length === 0) {
            const pillText = document.getElementById('threat-live-text');
            if (pillText) pillText.innerHTML = '🟢 <b>Офіційний відбій!</b> Кременчук та район — небезпека минула';
            updateHeaderStatus();
            return;
        }

        let poltavaHasThreat = false;
        alertsData.activeRegions.forEach(regName => {
            const canonical = findCanonicalRegion(regName) || regName;
            setRegionThreat(canonical, 'red');
            if (canonical === 'Полтавська') poltavaHasThreat = true;
        });

        const pillText = document.getElementById('threat-live-text');
        if (pillText) {
            if (poltavaHasThreat) {
                pillText.innerHTML = '<span style="color:#ef4444">🚨 ПОВІТРЯНА ТРИВОГА:</span> Полтавська область / Кременчук!';
            } else {
                pillText.innerHTML = '🟢 <b>Кременчук: спокійно.</b> Офіційні тривоги: ' + alertsData.activeRegions.slice(0, 3).join(', ');
            }
        }
        updateHeaderStatus();
        return;
    }

    // 2. Якщо це спеціальний вектор цілі (наприклад шахед із Павлиша)
    if (param && (param.startsWith('sh_') || param.startsWith('bal_'))) {
        const isSouth = param.includes('south');
        const fromCoords = isSouth ? [48.45, 32.90] : [49.30, 32.95];
        const isBallistic = param.startsWith('bal_');

        createThreatVector(
            'vector_active_target',
            fromCoords,
            [49.0700, 33.4200],
            isBallistic ? 'ballistic' : 'shahed',
            {
                label: isBallistic ? '🚀 Швидкісна ціль (на місто)' : '🔻 Shahed-136 (курс на Кременчук)',
                speed: isBallistic ? '2800 км/год' : '185 км/год',
                altitude: isBallistic ? '12 000 м' : '230 м',
                eta: isBallistic ? '~1-2 хв' : '~4-6 хв',
                count: '1-2 од.'
            }
        );

        setRegionThreat('Полтавська', isBallistic ? 'red' : 'yellow');
        setRegionThreat('Кіровоградська', isBallistic ? 'red' : 'yellow');

        const pillText = document.getElementById('threat-live-text');
        if (pillText) {
            pillText.innerHTML = isBallistic
                ? '<span style="color:#ef4444">🚨 БАЛІСТИКА:</span> курс на Кременчук! Всі в укриття!'
                : '<span style="color:#f59e0b">⚠️ Загроза БПЛА:</span> Кременчук / Павлиш';
        }
        updateHeaderStatus();
        return;
    }

    // 3. За замовчуванням
    const pillText = document.getElementById('threat-live-text');
    if (pillText) {
        pillText.innerHTML = '🟢 <b>Кременчук та район:</b> спокійно | ППО чергує 24/7';
    }
    updateHeaderStatus();
}

// ==========================================
// 9. АВТОМАТИЧНА СИНХРОНІЗАЦІЯ В РЕАЛЬНОМУ ЧАСІ (LIVE SSE / POLLING)
// ==========================================
const LIVE_CHANNEL = 'nebo_kremenchuk_alerts_live';
let sseConnection = null;
let pollTimer = null;

function applyLiveAlertsUpdate(payload) {
    if (!payload) return;

    // 1. Оновлюємо області
    clearAllThreats();

    const activeList = Array.isArray(payload.activeRegions) ? payload.activeRegions : [];
    let poltavaHasThreat = Boolean(payload.poltavaActive);

    activeList.forEach(regName => {
        const canonical = findCanonicalRegion(regName) || regName;
        setRegionThreat(canonical, 'red');
        if (canonical === 'Полтавська') poltavaHasThreat = true;
    });

    // 2. Динамічний вектор цілі (якщо наявний)
    if (payload.vector && payload.vector.from && payload.vector.to) {
        createThreatVector(
            'vector_live_target',
            payload.vector.from,
            payload.vector.to,
            payload.vector.type || 'shahed',
            payload.vector.meta || {}
        );
        setRegionThreat('Полтавська', payload.vector.type === 'ballistic' ? 'red' : 'yellow');
    } else {
        removeThreatVector('vector_live_target');
    }

    // 3. Оновлення тексту нижньої плашки та тактильного відгуку
    const pillText = document.getElementById('threat-live-text');
    if (pillText) {
        if (payload.vector) {
            pillText.innerHTML = payload.vector.type === 'ballistic'
                ? '<span style="color:#ef4444">🚨 БАЛІСТИКА:</span> курс на Кременчук! Всі в укриття!'
                : `<span style="color:#f59e0b">⚠️ Загроза БПЛА:</span> Кременчук / ${payload.vector.sector || 'Павлиш'}`;
            triggerHapticFeedback('heavy');
        } else if (poltavaHasThreat) {
            pillText.innerHTML = '<span style="color:#ef4444">🚨 ПОВІТРЯНА ТРИВОГА:</span> Полтавська область / Кременчук!';
            triggerHapticFeedback('warning');
        } else if (activeList.length === 0) {
            pillText.innerHTML = '🟢 <b>Офіційний відбій!</b> По всій Україні спокійно';
        } else {
            pillText.innerHTML = '🟢 <b>Кременчук: спокійно.</b> Офіційні тривоги: ' + activeList.slice(0, 3).join(', ');
        }
    }

    updateHeaderStatus();
}

function initLiveAutoUpdates() {
    // 1. Початкове негайне опитування останнього стану
    fetchLiveAlertsOnce();

    // 2. Підключення до Server-Sent Events (миттєве оновлення без перезавантаження)
    try {
        if (window.EventSource) {
            sseConnection = new EventSource(`https://ntfy.sh/${LIVE_CHANNEL}/sse`);

            sseConnection.onmessage = (event) => {
                try {
                    const eventData = JSON.parse(event.data);
                    if (eventData.event === 'message' && eventData.message) {
                        const payload = JSON.parse(eventData.message);
                        applyLiveAlertsUpdate(payload);
                    }
                } catch (e) {
                    console.warn('SSE parse note:', e);
                }
            };

            sseConnection.onerror = () => {
                if (!pollTimer) {
                    pollTimer = setInterval(fetchLiveAlertsOnce, 8000);
                }
            };
        } else {
            pollTimer = setInterval(fetchLiveAlertsOnce, 8000);
        }
    } catch (e) {
        pollTimer = setInterval(fetchLiveAlertsOnce, 8000);
    }
}

function fetchLiveAlertsOnce() {
    fetch(`https://ntfy.sh/${LIVE_CHANNEL}/json?poll=1&since=30m`)
        .then(res => res.text())
        .then(text => {
            const lines = text.trim().split('\n').filter(Boolean);
            if (lines.length === 0) return;
            const lastLine = lines[lines.length - 1];
            const data = JSON.parse(lastLine);
            if (data && data.message) {
                const payload = JSON.parse(data.message);
                applyLiveAlertsUpdate(payload);
            }
        })
        .catch(err => {
            console.warn('Live alerts poll note:', err.message);
        });
}

// ==========================================
// 10. API МЕНЕДЖЕРА КАРТИ
// ==========================================
window.AlertsManager = {
    setThreat: setRegionThreat,
    clearThreat: clearRegionThreat,
    clearAll: clearAllThreats,
    addVector: createThreatVector,
    removeVector: removeThreatVector,
    applyLiveAlerts: applyLiveAlertsUpdate,
    getStatus: () => ({
        threatCount: activeThreats.size,
        threats: Object.fromEntries(activeThreats),
        vectors: Array.from(activeVectors.keys())
    })
};

// ==========================================
// 11. СТАРТ
// ==========================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadUkraineMap);
} else {
    loadUkraineMap();
}
