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
// 2. СТАН ДОДАТКУ ТА КОНФІГУРАЦІЯ
// ==========================================
const THREAT_COLORS = {
    DEFAULT: '#37474F',
    RED: '#E53935',     // Пряма загроза балістики / ракет
    YELLOW: '#FDD835'   // Загроза БПЛА (Шахеди) / тактичної авіації
};

// Стан активних загроз по районах ( district_id -> { threatLevel: 'red'|'yellow', alarmStartTime: timestamp, timerMarker: L.marker } )
const activeThreats = new Map();

// Активні вектори загроз (траєкторії): id -> { polyline: L.polyline, tooltipMarker: L.marker }
const activeVectors = new Map();

// Шар полігонів районів Leaflet: id -> L.Polygon
const districtLayers = new Map();

// ==========================================
// 3. НАЛАШТУВАННЯ КАРТИ LEAFLET.JS
// ==========================================
// Центр карти фокусується на Кременчуці та прилеглих районах Полтавщини і Кіровоградщини
const map = L.map('map', {
    center: [49.0700, 33.4200],
    zoom: 8.2,
    minZoom: 6,
    maxZoom: 14,
    zoomControl: false,
    attributionControl: true
});

// Темний тайловий шар CartoDB Dark Matter
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
}).addTo(map);

// Стиль району за замовчуванням
function getDefaultStyle() {
    return {
        fillColor: THREAT_COLORS.DEFAULT,
        fillOpacity: 0.35,
        color: '#546E7A',
        weight: 1.5,
        opacity: 0.7,
        className: 'district-polygon-default'
    };
}

// ==========================================
// 4. ЗАВАНТАЖЕННЯ МЕЖ РАЙОНІВ (GEOJSON)
// ==========================================
let geoJsonLayerGroup = null;

async function loadDistrictsGeoJSON() {
    try {
        const response = await fetch('geojson/districts.json');
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const geojsonData = await response.json();

        geoJsonLayerGroup = L.geoJSON(geojsonData, {
            style: getDefaultStyle,
            onEachFeature: (feature, layer) => {
                const districtId = feature.properties.id;
                districtLayers.set(districtId, {
                    layer: layer,
                    feature: feature
                });

                // Інтерактивність при кліку або наведенні на район
                layer.on({
                    click: () => {
                        const threat = activeThreats.get(districtId);
                        const statusText = threat 
                            ? (threat.threatLevel === 'red' ? '🚨 Ракетна / Балістична загроза' : '🛵 Загроза ударних БПЛА')
                            : '🟢 Загроз не зафіксовано';
                        
                        layer.bindPopup(`
                            <div style="font-family: inherit; font-size: 12px; color: #fff;">
                                <strong>${feature.properties.name}</strong><br/>
                                <span style="color: #94a3b8;">${feature.properties.region}</span><br/>
                                <div style="margin-top: 5px; font-weight: 600;">${statusText}</div>
                            </div>
                        `, { className: 'custom-popup' }).openPopup();
                    }
                });
            }
        }).addTo(map);

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
function setDistrictThreat(districtId, threatLevel) {
    const districtData = districtLayers.get(districtId);
    if (!districtData) {
        console.warn(`Район ${districtId} не знайдено в GeoJSON`);
        return;
    }

    const { layer, feature } = districtData;
    const center = feature.properties.center || layer.getBounds().getCenter();

    // 1. Оновлення стилю полігону
    if (threatLevel === 'red') {
        layer.setStyle({
            fillColor: THREAT_COLORS.RED,
            fillOpacity: 0.55,
            color: THREAT_COLORS.RED,
            weight: 3.5,
            opacity: 1
        });
        if (layer._path) {
            layer._path.classList.add('pulsing-district-red');
        }
        triggerHapticFeedback('heavy'); // Важкий вібровідгук Telegram
    } else if (threatLevel === 'yellow') {
        layer.setStyle({
            fillColor: THREAT_COLORS.YELLOW,
            fillOpacity: 0.45,
            color: THREAT_COLORS.YELLOW,
            weight: 2.5,
            opacity: 0.95
        });
        if (layer._path) {
            layer._path.classList.remove('pulsing-district-red');
        }
        triggerHapticFeedback('medium'); // Середній вібровідгук Telegram
    } else {
        // Скидання до звичайного статусу
        layer.setStyle(getDefaultStyle());
        if (layer._path) {
            layer._path.classList.remove('pulsing-district-red');
        }
        // Видаляємо маркер таймера якщо існував
        if (activeThreats.has(districtId)) {
            const current = activeThreats.get(districtId);
            if (current.timerMarker) {
                map.removeLayer(current.timerMarker);
            }
            activeThreats.delete(districtId);
        }
        updateHeaderStatus();
        return;
    }

    // 2. Створення або оновлення таймера району
    const startTime = Date.now();
    let existingTimerMarker = null;

    if (activeThreats.has(districtId)) {
        const oldThreat = activeThreats.get(districtId);
        if (oldThreat.timerMarker) {
            map.removeLayer(oldThreat.timerMarker);
        }
    }

    const marker = L.marker([center[0], center[1]], {
        icon: createTimerDivIcon(districtId, feature.properties.name, threatLevel),
        zIndexOffset: 1000
    }).addTo(map);

    activeThreats.set(districtId, {
        threatLevel: threatLevel,
        alarmStartTime: startTime,
        timerMarker: marker
    });

    updateDistrictTimerMarker(districtId);
    updateHeaderStatus();
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
// 9. СИМУЛЯТОР ТРИВОГ (BOTTOM BAR) - ФОКУС КРЕМЕНЧУК
// ==========================================
document.getElementById('btn-ballistika').addEventListener('click', () => {
    // 1. Встановлюємо червону загрозу в Кременчуцький район
    setDistrictThreat('poltava_kremenchuk', 'red');

    // 2. Будуємо тактичний вектор балістичної ракети на Кременчук
    const launchCoords = [51.50, 35.80]; // Район пуску
    const kremenchukCoords = [49.0700, 33.4200]; // Кременчук
    createThreatVector(
        'vector_kremenchuk_ballistic',
        launchCoords,
        kremenchukCoords,
        'ballistic',
        {
            label: '🚀 Балістична ракета (Іскандер-М)',
            speed: '6500 км/год',
            altitude: '45 км',
            eta: '~1.5 хв',
            count: '1 од.'
        }
    );
});

document.getElementById('btn-shahedy').addEventListener('click', () => {
    // 1. Встановлюємо жовту загрозу в Кременчуцький та Олександрійський райони
    setDistrictThreat('poltava_kremenchuk', 'yellow');
    setDistrictThreat('kirovohrad_oleksandriia', 'yellow');

    // 2. Будуємо вектор руху БПЛА з боку Павлиша та Олександрії на Кременчук
    const southLaunch = [47.80, 32.70];
    const kremenchukCoords = [49.0700, 33.4200];
    createThreatVector(
        'vector_kremen_shahed',
        southLaunch,
        kremenchukCoords,
        'shahed',
        {
            label: '🔻 БПЛА Shahed-136 (через Павлиш)',
            speed: '185 км/год',
            altitude: '250 м',
            eta: '~6 хв',
            count: '4 од.'
        }
    );
});

document.getElementById('btn-clear').addEventListener('click', () => {
    // Скидаємо всі активні райони
    const activeIds = Array.from(activeThreats.keys());
    activeIds.forEach(id => setDistrictThreat(id, 'default'));

    // Видаляємо всі вектори
    clearAllVectors();

    if (tg && tg.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred('success');
    }
});

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
