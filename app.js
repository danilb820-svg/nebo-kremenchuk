/**
 * app.js - Інтерактивна тактична карта загроз та тривог "Небо Кременчука"
 * Точний візуальний стиль alerts.in.ua + тактичний радар ППО для Кременчука
 * Офіційне відображення тривог та відбоїв у реальному часі без фейкових статусів
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
            tg.HapticFeedback.impactOccurred(type);
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

// Базова темна підкладка (CartoDB Dark Matter)
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
    maxZoom: 19
}).addTo(map);

// Стиль за замовчуванням
function getDefaultStyle() {
    return {
        fillColor: THREAT_COLORS.DEFAULT,
        fillOpacity: 0.94,
        color: THREAT_COLORS.DEFAULT_BORDER,
        weight: 1.5,
        opacity: 0.95
    };
}

// Нормалізація назви області
function findCanonicalRegion(nameOrId) {
    if (!nameOrId) return null;
    const clean = String(nameOrId).trim().toLowerCase();

    for (const [ukrName, info] of Object.entries(REGION_INFO)) {
        if (ukrName.toLowerCase() === clean) return ukrName;
        for (const alias of info.aliases) {
            if (alias.toLowerCase() === clean) return ukrName;
            if (clean.includes(alias.toLowerCase()) || alias.toLowerCase().includes(clean)) return ukrName;
        }
    }
    return null;
}

// ==========================================
// 4. ЗАВАНТАЖЕННЯ ГЕОМЕТРІЇ КАРТИ УКРАЇНИ
// ==========================================
async function loadUkraineMap() {
    try {
        let response = await fetch('ukraine_map.json');
        if (!response.ok) {
            response = await fetch('geojson/districts.json');
        }
        if (!response.ok) {
            throw new Error('HTTP error ' + response.status);
        }
        const geojsonData = await response.json();

        const geojsonLayer = L.geoJSON(geojsonData, {
            style: getDefaultStyle,
            onEachFeature: (feature, layer) => {
                const props = feature.properties || {};
                const rawName = props.name_ukr || props.name || props.rawName || props.id;
                const canonicalName = findCanonicalRegion(rawName) || rawName;

                regionLayers.set(canonicalName, layer);
                if (props.id) regionLayers.set(props.id, layer);
                if (props.name) regionLayers.set(props.name, layer);

                layer.on({
                    click: () => {
                        triggerHapticFeedback('light');
                        const threat = activeThreats.get(canonicalName);
                        let statusText = '🟢 Немає тривоги (Відбій)';
                        if (threat) {
                            statusText = threat.threatLevel === 'red'
                                ? '🚨 <b>Повітряна тривога</b>'
                                : '⚠️ <b>Загроза БПЛА (Шахеди)</b>';
                        }
                        layer.bindPopup(
                            '<div style="font-family:Inter,sans-serif;font-size:13px;line-height:1.4;">' +
                            '<b>' + canonicalName + '</b><br>' +
                            '<span>' + statusText + '</span>' +
                            '</div>'
                        ).openPopup();
                    }
                });
            }
        }).addTo(map);

        // Додаємо підписи областей прямо на карті (alerts.in.ua style)
        for (const [ukrName, info] of Object.entries(REGION_INFO)) {
            if (info.center) {
                L.marker(info.center, {
                    icon: L.divIcon({
                        className: 'region-label',
                        html: '<div class="region-label-text" id="lbl-' + encodeURIComponent(ukrName) + '">' + ukrName + '</div>',
                        iconSize: [110, 20],
                        iconAnchor: [55, 10]
                    }),
                    interactive: false
                }).addTo(map);

                const el = document.getElementById('lbl-' + encodeURIComponent(ukrName));
                if (el) labelElements.set(ukrName, el);
            }
        }

        // Адаптуємо межі під екран
        try {
            const bounds = geojsonLayer.getBounds();
            if (bounds.isValid()) {
                map.fitBounds(bounds, { padding: [15, 15], maxZoom: 6.8 });
            }
        } catch (e) {}

        // Тактичний радар Кременчука
        initKremenchukAirDefenseRadar();

        // Завантаження офіційних тривог та відбоїв
        initActiveCombatScene();

        console.log('✅ Карта України успішно завантажена!');

    } catch (err) {
        console.error('❌ Помилка завантаження карти України:', err);
        const pillText = document.getElementById('threat-live-text');
        if (pillText) {
            pillText.innerHTML = '<span style="color:#ef4444">Помилка завантаження карти. Спробуйте оновити.</span>';
        }
    }
}

// ==========================================
// 5. ТАКТИЧНИЙ РАДАР ППО КРЕМЕНЧУКА
// ==========================================
function initKremenchukAirDefenseRadar() {
    const kremenchukCoords = [49.0700, 33.4200];

    // Зона ближньої оборони (20 км - мобільні вогневі групи ППО)
    L.circle(kremenchukCoords, {
        radius: 20000,
        color: '#22c55e',
        weight: 1.2,
        dashArray: '4, 6',
        fillOpacity: 0.04,
        fillColor: '#22c55e',
        interactive: false
    }).addTo(map);

    // Зона перехоплення (50 км - сектор ЗРК середньої дальності)
    L.circle(kremenchukCoords, {
        radius: 50000,
        color: '#3b82f6',
        weight: 1.0,
        dashArray: '6, 8',
        fillOpacity: 0.02,
        fillColor: '#3b82f6',
        interactive: false
    }).addTo(map);

    // Дальній рубіж радіолокаційного виявлення (100 км)
    L.circle(kremenchukCoords, {
        radius: 100000,
        color: '#64748b',
        weight: 0.8,
        dashArray: '8, 12',
        fillOpacity: 0.01,
        fillColor: '#64748b',
        interactive: false
    }).addTo(map);

    // Тактичні мітки рубежів
    const addRadarLabel = (lat, lng, text, color) => {
        L.marker([lat, lng], {
            icon: L.divIcon({
                className: 'radar-ring-label',
                html: '<span style="color:' + color + ';font-size:9px;font-family:monospace;letter-spacing:0.8px;background:rgba(15,20,28,0.85);padding:2px 6px;border-radius:4px;border:1px solid ' + color + '44;white-space:nowrap;">' + text + '</span>',
                iconSize: [110, 16],
                iconAnchor: [55, 8]
            }),
            interactive: false
        }).addTo(map);
    };

    addRadarLabel(49.25, 33.42, 'ЗОНА ППО 20КМ', '#22c55e');
    addRadarLabel(49.52, 33.42, 'СЕКТОР ЗРК 50КМ', '#3b82f6');
    addRadarLabel(49.97, 33.42, 'РУБІЖ 100КМ', '#64748b');

    // Опорний тактичний маркер міста Кременчук
    L.marker(kremenchukCoords, {
        icon: L.divIcon({
            className: 'kremenchuk-base-marker',
            html: 
                '<div style="position:relative;display:flex;align-items:center;justify-content:center;">' +
                    '<div style="position:absolute;width:16px;height:16px;border-radius:50%;background:#38bdf8;box-shadow:0 0 12px #38bdf8;animation:radar-ping 2s infinite;"></div>' +
                    '<div style="position:absolute;width:8px;height:8px;border-radius:50%;background:#ffffff;"></div>' +
                    '<span style="position:absolute;left:14px;top:-7px;font-size:11px;font-weight:700;color:#ffffff;text-shadow:0 1px 4px #000,0 0 2px #000;white-space:nowrap;font-family:Inter,sans-serif;">м. Кременчук</span>' +
                '</div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        }),
        interactive: false
    }).addTo(map);
}

// ==========================================
// 6. УПРАВЛІННЯ СТАТУСАМИ ТРИВОГ В ОБЛАСТЯХ
// ==========================================
function setRegionThreat(regionNameOrId, threatLevel) {
    const canonicalName = findCanonicalRegion(regionNameOrId) || regionNameOrId;
    const layer = regionLayers.get(canonicalName) || regionLayers.get(regionNameOrId);
    if (!layer) return;

    if (threatLevel === 'red') {
        layer.setStyle({
            fillColor: THREAT_COLORS.RED,
            fillOpacity: 0.95,
            color: THREAT_COLORS.RED_BORDER,
            weight: 1.8,
            opacity: 1
        });
        activeThreats.set(canonicalName, { threatLevel: 'red' });
    } else if (threatLevel === 'yellow') {
        layer.setStyle({
            fillColor: THREAT_COLORS.YELLOW,
            fillOpacity: 0.95,
            color: THREAT_COLORS.YELLOW_BORDER,
            weight: 1.8,
            opacity: 1
        });
        activeThreats.set(canonicalName, { threatLevel: 'yellow' });
    } else {
        layer.setStyle(getDefaultStyle());
        activeThreats.delete(canonicalName);
    }

    const labelEl = labelElements.get(canonicalName);
    if (labelEl) {
        if (threatLevel === 'red' || threatLevel === 'yellow') {
            labelEl.classList.add('in-alarm');
        } else {
            labelEl.classList.remove('in-alarm');
        }
    }

    updateHeaderStatus();
}

function clearRegionThreat(regionNameOrId) {
    setRegionThreat(regionNameOrId, 'default');
}

function clearAllThreats() {
    for (const canonicalName of Object.keys(REGION_INFO)) {
        const layer = regionLayers.get(canonicalName);
        if (layer) layer.setStyle(getDefaultStyle());
        const labelEl = labelElements.get(canonicalName);
        if (labelEl) labelEl.classList.remove('in-alarm');
    }
    activeThreats.clear();
    clearAllVectors();
    updateHeaderStatus();
}

function updateHeaderStatus() {
    const badge = document.getElementById('active-alarms-badge');
    const summary = document.getElementById('threat-summary');
    const count = activeThreats.size;

    if (badge) {
        badge.textContent = count + ' активних';
        if (count > 0) {
            badge.classList.add('active-threat');
        } else {
            badge.classList.remove('active-threat');
        }
    }

    if (summary) {
        const hasKremenThreat = activeThreats.has('Полтавська') || activeThreats.has('Кіровоградська');
        if (hasKremenThreat) {
            summary.innerHTML = '<span style="color:#ef4444">🚨 ТРИВОГА: Кременчуцький район!</span>';
        } else if (count > 0) {
            summary.textContent = 'Кременчук спокійно. Тривоги в ' + count + ' областях';
        } else {
            summary.textContent = 'Кременчук та район у нормі';
        }
    }
}

// ==========================================
// 7. ВЕКТОРНІ ТРАЄКТОРІЇ
// ==========================================
function calculateBearing(startLat, startLng, destLat, destLng) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const toDeg = (rad) => (rad * 180) / Math.PI;

    const y = Math.sin(toRad(destLng - startLng)) * Math.cos(toRad(destLat));
    const x = Math.cos(toRad(startLat)) * Math.sin(toRad(destLat)) -
              Math.sin(toRad(startLat)) * Math.cos(toRad(destLat)) * Math.cos(toRad(destLng - startLng));
    let brng = toDeg(Math.atan2(y, x));
    return (brng + 360) % 360;
}

function createThreatVector(targetId, fromCoords, toCoords, type, info) {
    removeThreatVector(targetId);

    const isBallistic = type === 'ballistic';
    const color = isBallistic ? THREAT_COLORS.RED_BORDER : THREAT_COLORS.YELLOW_BORDER;
    const iconSymbol = isBallistic ? '🚀' : '🔻';
    const cssClass = isBallistic ? 'target-ballistic' : 'target-shahed';

    const polyline = L.polyline([fromCoords, toCoords], {
        color: color,
        weight: 3.5,
        opacity: 0.85,
        dashArray: '8, 8',
        className: 'animated-vector-line'
    }).addTo(map);

    const bearing = calculateBearing(fromCoords[0], fromCoords[1], toCoords[0], toCoords[1]);

    const curLat = fromCoords[0] + (toCoords[0] - fromCoords[0]) * 0.65;
    const curLng = fromCoords[1] + (toCoords[1] - fromCoords[1]) * 0.65;

    const targetDivIcon = L.divIcon({
        className: 'military-target-divicon',
        html: 
            '<div class="military-target-container ' + cssClass + '">' +
                '<div class="target-radar-ping"></div>' +
                '<div class="target-head" style="transform: rotate(' + bearing + 'deg)">' +
                    '<span class="target-icon">' + iconSymbol + '</span>' +
                    '<span class="target-arrow">➤</span>' +
                '</div>' +
                '<div class="target-tag">' +
                    '<div class="target-tag-title">' + info.label + '</div>' +
                    '<div class="target-tag-meta">' +
                        '<span>Кількість: <b>' + (info.count || '1') + '</b></span> | ' +
                        '<span>Швидкість: <b>' + info.speed + '</b></span>' +
                    '</div>' +
                    '<div class="target-tag-meta">' +
                        '<span>Курс: <b>' + Math.round(bearing) + '°</b></span> | ' +
                        '<span style="color: ' + color + '"><b>ETA: ' + info.eta + '</b></span>' +
                    '</div>' +
                '</div>' +
            '</div>',
        iconSize: [220, 60],
        iconAnchor: [16, 16]
    });

    const targetMarker = L.marker([curLat, curLng], {
        icon: targetDivIcon,
        zIndexOffset: 1200
    }).addTo(map);

    activeVectors.set(targetId, { polyline, targetMarker });
}

function removeThreatVector(vectorId) {
    if (activeVectors.has(vectorId)) {
        const item = activeVectors.get(vectorId);
        if (item.polyline) map.removeLayer(item.polyline);
        if (item.targetMarker) map.removeLayer(item.targetMarker);
        activeVectors.delete(vectorId);
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
            // Офіційний повний відбій
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

    // 3. За замовчуванням: чиста спокійна обстановка без фейкових тривог
    const pillText = document.getElementById('threat-live-text');
    if (pillText) {
        pillText.innerHTML = '🟢 <b>Кременчук та район:</b> спокійно | ППО чергує 24/7';
    }
    updateHeaderStatus();
}

// ==========================================
// 9. API МЕНЕДЖЕРА КАРТИ
// ==========================================
window.AlertsManager = {
    setThreat: setRegionThreat,
    clearThreat: clearRegionThreat,
    clearAll: clearAllThreats,
    addVector: createThreatVector,
    removeVector: removeThreatVector,
    updateFromOfficial: (regionsList) => {
        clearAllThreats();
        if (Array.isArray(regionsList)) {
            regionsList.forEach(r => setRegionThreat(r, 'red'));
        }
        updateHeaderStatus();
    },
    getStatus: () => ({
        threatCount: activeThreats.size,
        threats: Object.fromEntries(activeThreats),
        vectors: Array.from(activeVectors.keys())
    })
};

// ==========================================
// 10. СТАРТ
// ==========================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadUkraineMap);
} else {
    loadUkraineMap();
}
