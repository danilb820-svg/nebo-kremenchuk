/**
 * app.js - Інтерактивна карта загроз та тривог (Полтавська та Кіровоградська області)
 * Для Telegram Mini App (TMA)
 */

// ==========================================
// 1. ІНІЦІАЛІЗАЦІЯ TELEGRAM WEBAPP SDK
// ==========================================
const tg = window.Telegram ? window.Telegram.WebApp : null;

if (tg) {
    tg.ready();
    tg.expand(); // Розгортаємо на весь екран

    // Підлаштування під кольори теми Telegram
    if (tg.colorScheme === 'dark' || tg.themeParams?.bg_color) {
        document.body.setAttribute('data-theme', 'dark');
        if (tg.themeParams?.bg_color) {
            document.documentElement.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color);
        }
        if (tg.themeParams?.text_color) {
            document.documentElement.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color);
        }
    }
}

/**
 * Виклик Haptic Feedback (вібровідгук Telegram)
 * @param {'heavy' | 'medium' | 'light'} type
 */
function triggerHapticFeedback(type = 'medium') {
    if (tg && tg.HapticFeedback) {
        tg.HapticFeedback.impactOccurred(type);
    }
}

// ==========================================
// 2. СТАН ДОДАТКУ ТА КОНФІГУРАЦІЯ (СТИЛЬ ALERTS.IN.UA)
// ==========================================
const THREAT_COLORS = {
    DEFAULT: '#1c2638',        // Спокійні області (темно-синій)
    DEFAULT_BORDER: '#283548',
    RED: '#5c1922',            // Червоний рівень (бордовий з alerts.in.ua)
    RED_BORDER: '#b91c1c',
    YELLOW: '#c99e46',         // Жовтий рівень (пісочний з alerts.in.ua)
    YELLOW_BORDER: '#d97706'
};

// Стан активних загроз по областях/районах
const activeThreats = new Map();
const activeVectors = new Map();
const regionLayers = new Map();

// Центри областей для відображення назв та таймерів
const REGION_CENTERS = {
    'Полтавська': [49.58, 34.55],
    'Кіровоградська': [48.51, 32.26],
    'Дніпропетровська': [48.46, 35.04],
    'Харківська': [49.99, 36.23],
    'Сумська': [50.90, 34.79],
    'Чернігівська': [51.49, 31.28],
    'Київська': [50.45, 30.52],
    'Черкаська': [49.44, 32.05],
    'Запорізька': [47.83, 35.13],
    'Донецька': [48.01, 37.80],
    'Луганська': [48.57, 39.30],
    'Миколаївська': [46.97, 31.99],
    'Херсонська': [46.63, 32.61],
    'Одеська': [46.48, 30.72],
    'Житомирська': [50.25, 28.65],
    'Вінницька': [49.23, 28.46],
    'Хмельницька': [49.42, 26.98],
    'Рівненська': [50.61, 26.25],
    'Волинська': [50.74, 25.32],
    'Львівська': [49.83, 24.02],
    'Тернопільська': [49.55, 25.59],
    'Івано-Франківська': [48.92, 24.71],
    'Закарпатська': [48.62, 22.28],
    'Чернівецька': [48.29, 25.93],
    'Автономна Республіка Крим': [45.34, 34.49]
};

// ==========================================
// 3. НАЛАШТУВАННЯ КАРТИ LEAFLET.JS (МАСШТАБ ТА ПОЗИЦІЯ)
// ==========================================
const map = L.map('map', {
    center: [48.7, 32.8],
    zoom: 6.8,
    minZoom: 5.5,
    maxZoom: 12,
    zoomControl: false,
    attributionControl: false
});

// Стиль області за замовчуванням (alerts.in.ua)
function getDefaultStyle() {
    return {
        fillColor: THREAT_COLORS.DEFAULT,
        fillOpacity: 0.95,
        color: THREAT_COLORS.DEFAULT_BORDER,
        weight: 1.2,
        opacity: 0.85
    };
}

// ==========================================
// 4. ЗАВАНТАЖЕННЯ МЕЖ ОБЛАСТЕЙ УКРАЇНИ
// ==========================================
async function loadDistrictsGeoJSON() {
    try {
        let response = await fetch('ukraine_map.json');
        if (!response.ok) {
            response = await fetch('geojson/districts.json');
        }
        const geojsonData = await response.json();

        L.geoJSON(geojsonData, {
            style: getDefaultStyle,
            onEachFeature: (feature, layer) => {
                const name = feature.properties.name;
                const regId = feature.properties.id || name;
                regionLayers.set(name, layer);

                // Додаємо підпис назви області прямо поверх карти
                const center = REGION_CENTERS[name];
                if (center) {
                    L.marker(center, {
                        icon: L.divIcon({
                            className: 'region-label',
                            html: `<div class="region-label-text" id="lbl-${regId}">${name}</div>`,
                            iconSize: [120, 20]
                        }),
                        interactive: false
                    }).addTo(map);
                }

                layer.on({
                    click: () => {
                        const threat = activeThreats.get(name);
                        const status = threat 
                            ? (threat.threatLevel === 'red' ? '🚨 Повітряна тривога' : '🛵 Загроза БПЛА')
                            : '🟢 Немає тривоги';
                        layer.bindPopup(`<b>${name} область</b><br>${status}`).openPopup();
                    }
                });
            }
        }).addTo(map);

        // Додаємо орієнтир Кременчука з військовими радіусами
        const kremenchukCoords = [49.0700, 33.4200];
        L.circle(kremenchukCoords, {
            radius: 25000,
            color: '#10b981',
            weight: 1.2,
            dashArray: '4, 4',
            fillOpacity: 0.05,
            fillColor: '#10b981',
            interactive: false
        }).addTo(map);

        // Автоматично ініціалізуємо активну бойову обстановку як на вашому скріншоті
        initActiveCombatScene();

    } catch (err) {
        console.error('Помилка завантаження карти України:', err);
    }
}

        // 5. ДОДАВАННЯ РАДІУСІВ ЗОНИ ППО ТА СЕКТОРІВ ОГЛЯДУ (ЯК НА ВІЙСЬКОВИХ РАДАРАХ)
        const kremenchukCoords = [49.0700, 33.4200];

        // Зона ближньої оборони (20 км - мобільні групи ППО)
        L.circle(kremenchukCoords, {
            radius: 20000,
            color: '#22c55e',
            weight: 1.2,
            dashArray: '4, 6',
            fillOpacity: 0.04,
            fillColor: '#22c55e',
            interactive: false
        }).addTo(map);

        // Зона перехоплення (50 км - ЗРК середньої дальності)
        L.circle(kremenchukCoords, {
            radius: 50000,
            color: '#3b82f6',
            weight: 1,
            dashArray: '6, 8',
            fillOpacity: 0.02,
            fillColor: '#3b82f6',
            interactive: false
        }).addTo(map);

        // Дальня зона виявлення РЛС (100 км)
        L.circle(kremenchukCoords, {
            radius: 100000,
            color: '#64748b',
            weight: 0.8,
            dashArray: '8, 12',
            fillOpacity: 0.01,
            fillColor: '#64748b',
            interactive: false
        }).addTo(map);

        // Мітки радіусів ППО
        const addRadarLabel = (lat, lng, text, color) => {
            L.marker([lat, lng], {
                icon: L.divIcon({
                    className: 'radar-ring-label',
                    html: `<span style="color:${color};font-size:9px;font-family:'JetBrains Mono',monospace;letter-spacing:1px;background:rgba(15,20,28,0.8);padding:2px 5px;border-radius:4px;border:1px solid ${color}44;">${text}</span>`,
                    iconSize: [80, 16]
                }),
                interactive: false
            }).addTo(map);
        };

        addRadarLabel(49.25, 33.42, 'ЗОНА ППО 20КМ', '#22c55e');
        addRadarLabel(49.52, 33.42, 'СЕКТОР ЗРК 50КМ', '#3b82f6');
        addRadarLabel(49.95, 33.42, 'ДАЛЬНІЙ РУБІЖ 100КМ', '#64748b');

        // Автоматично ініціалізуємо активну бойову обстановку над Кременчуком
        initActiveCombatScene();

    } catch (err) {
        console.error('Помилка завантаження geojson/districts.json:', err);
    }
}

// ==========================================
// 5. ДИНАМІЧНІ ТАЙМЕРИ ТРИВОГИ (DivIcon)
// ==========================================
function formatElapsedTime(secondsTotal) {
    const hours = Math.floor(secondsTotal / 3600);
    const minutes = Math.floor((secondsTotal % 3600) / 60);
    const seconds = secondsTotal % 60;

    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function updateDistrictTimerMarker(districtId) {
    const threat = activeThreats.get(districtId);
    if (!threat || !threat.timerMarker) return;

    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - threat.alarmStartTime) / 1000));
    const timeFormatted = formatElapsedTime(elapsedSeconds);

    const el = document.getElementById(`timer-val-${districtId}`);
    if (el) {
        el.textContent = `⏱ ${timeFormatted}`;
    }
}

function createTimerDivIcon(districtId, districtName, threatLevel) {
    const cssModifier = threatLevel === 'red' ? 'threat-red' : 'threat-yellow';
    return L.divIcon({
        className: 'alarm-timer-divicon',
        html: `
            <div class="alarm-timer-marker ${cssModifier}">
                <div class="timer-district-name">${districtName}</div>
                <div class="timer-counter" id="timer-val-${districtId}">⏱ 00:00:00</div>
            </div>
        `,
        iconSize: [110, 42],
        iconAnchor: [55, 21]
    });
}

// Глобальний тікер оновлення таймерів щосекунди
setInterval(() => {
    activeThreats.forEach((threat, districtId) => {
        updateDistrictTimerMarker(districtId);
    });
}, 1000);

// ==========================================
// 6. УПРАВЛІННЯ СТАТУСАМИ ЗАГРОЗ ТА ПОЛІГОНАМИ
// ==========================================
function setRegionThreat(regionName, threatLevel) {
    const layer = regionLayers.get(regionName);
    if (!layer) return;

    if (threatLevel === 'red') {
        layer.setStyle({
            fillColor: THREAT_COLORS.RED,
            fillOpacity: 0.95,
            color: THREAT_COLORS.RED_BORDER,
            weight: 1.5,
            opacity: 1
        });
    } else if (threatLevel === 'yellow') {
        layer.setStyle({
            fillColor: THREAT_COLORS.YELLOW,
            fillOpacity: 0.95,
            color: THREAT_COLORS.YELLOW_BORDER,
            weight: 1.5,
            opacity: 1
        });
    } else {
        layer.setStyle(getDefaultStyle());
    }

    activeThreats.set(regionName, { threatLevel });
}

// 9. АКТИВНА ОБСТАНОВКА 1-В-1 ЯК НА ВАШОМУ СКРІНШОТІ ALERTS.IN.UA
function initActiveCombatScene() {
    // Жовтий рівень (загроза БПЛА): Полтавська, Кіровоградська, Дніпропетровська, Сумська, Житомирська
    const yellowRegions = ['Полтавська', 'Кіровоградська', 'Дніпропетровська', 'Сумська', 'Житомирська'];
    yellowRegions.forEach(reg => setRegionThreat(reg, 'yellow'));

    // Червоний/Бордовий рівень (ракетна небезпека / тривога): Харківська, Запорізька, Донецька, Луганська, Чернігівська, Крим
    const redRegions = ['Чернігівська', 'Харківська', 'Запорізька', 'Донецька', 'Луганська', 'Автономна Республіка Крим'];
    redRegions.forEach(reg => setRegionThreat(reg, 'red'));

    // Траєкторія руху дронів на Кременчук (з курсом та параметрами)
    const southLaunch = [47.90, 32.80];
    const kremenchukCoords = [49.0700, 33.4200];
    createThreatVector(
        'vector_kremen_shahed',
        southLaunch,
        kremenchukCoords,
        'shahed',
        {
            label: '🔻 БПЛА Shahed-136 (курс на Кременчук)',
            speed: '185 км/год',
            altitude: '220 м',
            eta: '~4 хв',
            count: '2 од.'
        }
    );

    const pillText = document.getElementById('threat-live-text');
    if (pillText) {
        pillText.innerHTML = `<span style="color:#f59e0b">⚠️ Загроза БПЛА:</span> Полтавська / Кременчук | ППО чергує 24/7`;
    }
}

// ==========================================
// 7. ВЕКТОРНІ ТРАЄКТОРІЇ ТА РУХОМІ ЦІЛІ (БПЛА / РАКЕТИ)
// ==========================================

// Обчислення азимуту (кут повороту іконки від точки A до B)
function calculateBearing(startLat, startLng, destLat, destLng) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const toDeg = (rad) => (rad * 180) / Math.PI;

    const y = Math.sin(toRad(destLng - startLng)) * Math.cos(toRad(destLat));
    const x = Math.cos(toRad(startLat)) * Math.sin(toRad(destLat)) -
              Math.sin(toRad(startLat)) * Math.cos(toRad(destLat)) * Math.cos(toRad(destLng - startLng));
    let brng = toDeg(Math.atan2(y, x));
    return (brng + 360) % 360;
}

/**
 * Створити ціль з напрямком, вектором та інформаційною панеллю
 * @param {string} targetId
 * @param {[number, number]} fromCoords - [lat, lng]
 * @param {[number, number]} toCoords - [lat, lng]
 * @param {'ballistic' | 'shahed'} type
 * @param {object} info - { label: string, speed: string, altitude: string, eta: string, count: string }
 */
function createThreatVector(targetId, fromCoords, toCoords, type, info) {
    removeThreatVector(targetId);

    const isBallistic = type === 'ballistic';
    const color = isBallistic ? THREAT_COLORS.RED : THREAT_COLORS.YELLOW;
    const iconSymbol = isBallistic ? '🚀' : '🔻';
    const cssClass = isBallistic ? 'target-ballistic' : 'target-shahed';

    // 1. Пунктирна лінія польоту з анімацією
    const polyline = L.polyline([fromCoords, toCoords], {
        color: color,
        weight: 3.5,
        opacity: 0.85,
        dashArray: '10, 10',
        className: 'animated-vector-line'
    }).addTo(map);

    // 2. Кут напрямку
    const bearing = calculateBearing(fromCoords[0], fromCoords[1], toCoords[0], toCoords[1]);

    // Позиція цілі (розраховуємо положення цілі, наприклад 65% шляху до точки ураження/міста)
    const curLat = fromCoords[0] + (toCoords[0] - fromCoords[0]) * 0.65;
    const curLng = fromCoords[1] + (toCoords[1] - fromCoords[1]) * 0.65;

    // 3. Кастомний динамічний маркер цілі з курсором напрямку та плашкою характеристик
    const targetDivIcon = L.divIcon({
        className: 'military-target-divicon',
        html: `
            <div class="military-target-container ${cssClass}">
                <div class="target-radar-ping"></div>
                <div class="target-head" style="transform: rotate(${bearing}deg)">
                    <span class="target-icon">${iconSymbol}</span>
                    <span class="target-arrow">➤</span>
                </div>
                <div class="target-tag">
                    <div class="target-tag-title">${info.label}</div>
                    <div class="target-tag-meta">
                        <span>Кількість: <b>${info.count || '1'}</b></span> |
                        <span>Швидкість: <b>${info.speed}</b></span>
                    </div>
                    <div class="target-tag-meta">
                        <span>Курс: <b>${Math.round(bearing)}°</b></span> |
                        <span style="color: ${color}"><b>ETA: ${info.eta}</b></span>
                    </div>
                </div>
            </div>
        `,
        iconSize: [220, 60],
        iconAnchor: [30, 30]
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

// ==========================================
// 8. ОНОВЛЕННЯ ШАПКИ СТАТУСУ
// ==========================================
function updateHeaderStatus() {
    const badge = document.getElementById('active-alarms-badge');
    const summary = document.getElementById('threat-summary');
    const count = activeThreats.size;

    badge.textContent = `${count} активних`;
    if (count > 0) {
        badge.classList.add('active-threat');
        summary.textContent = `Увага! Активні загрози в областях`;
    } else {
        badge.classList.remove('active-threat');
        summary.textContent = `Всі райони в нормі`;
    }
}

// ==========================================
// 9. АВТОНОМНИЙ РЕЖИМ БОЙОВОГО МОНІТОРИНГУ (МАПА ТРИВОГ)
// ==========================================
function initActiveCombatScene() {
    // Встановлюємо активний статус загрози для Кременчуцького району
    setDistrictThreat('poltava_kremenchuk', 'yellow');
    setDistrictThreat('kirovohrad_oleksandriia', 'yellow');

    // Відображаємо ціль: БПЛА Shahed-136, що йде курсом через Павлиш на Кременчук
    const southLaunch = [47.80, 32.70];
    const kremenchukCoords = [49.0700, 33.4200];
    createThreatVector(
        'vector_kremen_shahed',
        southLaunch,
        kremenchukCoords,
        'shahed',
        {
            label: '🔻 БПЛА Shahed-136 (курс на місто)',
            speed: '185 км/год',
            altitude: '220 м',
            eta: '~4 хв',
            count: '2 од.'
        }
    );

    const pillText = document.getElementById('threat-live-text');
    if (pillText) {
        pillText.innerHTML = `<span style="color:#f59e0b">⚠️ Загроза БПЛА:</span> Кременчук / Павлиш (2 борти)`;
    }
}

// ==========================================
// 10. ТОЧКИ ПІДКЛЮЧЕННЯ РЕАЛЬНОГО API / WEBSOCKET
// ==========================================
/**
 * 🛰️ WebSocket Підключення (Приклад інтеграції з сервером сповіщень)
 *
 * function initWebSocketAlerts() {
 *     const socket = new WebSocket('wss://api.your-threat-monitor.ua/ws/alerts');
 *     
 *     socket.onopen = () => {
 *         console.log('З\'єднано з сервером моніторингу загроз');
 *     };
 *     
 *     socket.onmessage = (event) => {
 *         const data = JSON.parse(event.data);
 *         // Формат data: { districtId: 'poltava_poltavsky', threatLevel: 'red' | 'yellow' | 'default' }
 *         if (data.type === 'ALERT_UPDATE') {
 *             setDistrictThreat(data.districtId, data.threatLevel);
 *         } else if (data.type === 'TARGET_VECTOR') {
 *             createThreatVector(data.id, data.from, data.to, data.targetType, data.description);
 *         } else if (data.type === 'CLEAR_VECTOR') {
 *             removeThreatVector(data.id);
 *         }
 *     };
 *     
 *     socket.onerror = (error) => console.error('WebSocket Error:', error);
 *     socket.onclose = () => {
 *         // Reconnect через 5 секунд
 *         setTimeout(initWebSocketAlerts, 5000);
 *     };
 * }
 */

/**
 * 📡 REST API Polling (Опитування бекенду кожні 5-10 секунд)
 * 
 * async function pollAlertsStatus() {
 *     try {
 *         const res = await fetch('https://api.your-threat-monitor.ua/v1/active-alerts');
 *         const alerts = await res.json();
 *         alerts.forEach(item => {
 *             setDistrictThreat(item.districtId, item.threatLevel);
 *         });
 *     } catch (err) {
 *         console.error('Помилка опитування API загроз:', err);
 *     }
 * }
 * // setInterval(pollAlertsStatus, 10000);
 */

// Запуск завантаження карти
document.addEventListener('DOMContentLoaded', () => {
    loadDistrictsGeoJSON();
});
