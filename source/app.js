function startRopo(){
'use strict';
const {useEffect,useRef,useState,useMemo}=window.React;
const {createRoot}=window.ReactDOM;
const {Plus,Minus,LocateFixed,Route,Flame,Scan,CarFront,MapPin,Zap,X,Layers,Activity,ArrowDownRight,ArrowUpRight,ArrowUpLeft,ArrowRight,BatteryCharging,BatteryLow,Check,ChevronDown,ChevronRight,Clock3,Expand,Maximize2,Minimize2,Pause,Play,PlugZap,Radio,ShieldCheck,TriangleAlert,Unplug,WifiOff}=window.LucideReact;
const echarts=window.echarts, maplibregl=window.maplibregl;

/* model.js — plain browser JavaScript */
const statusMeta = { running: { label: '运营中', color: '#9c9be5' }, idle: { label: '空闲待客', color: '#78ba9c' }, charging: { label: '充电中', color: '#b0b8c5' }, maintenance: { label: '维护中', color: '#d0ac6d' }, offline: { label: '离线', color: '#e0808b' } };
const bayMeta = { free: { label: '空闲', symbol: '○' }, charging: { label: '充电', symbol: 'ϟ' }, occupied: { label: '占用', symbol: 'P' }, fault: { label: '故障', symbol: '!' }, offline: { label: '离线', symbol: '—' } };
const stations = [{ id: 'S01', name: '张江运营中心', short: '张江中心', lng: 121.603, lat: 31.202, capacity: 12 }, { id: 'S02', name: '金科路补能站', short: '金科路站', lng: 121.589, lat: 31.181, capacity: 12 }, { id: 'S03', name: '科学城南区站', short: '科学城站', lng: 121.626, lat: 31.174, capacity: 12 }];
const fraction = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
function seed() {
    const vehicles = Array.from({ length: 50 }, (_, i) => { const status = i < 28 ? 'running' : i < 38 ? 'idle' : i < 44 ? 'charging' : i < 48 ? 'maintenance' : 'offline'; return { id: `RT-${String(i + 1).padStart(3, '0')}`, status, soc: 35 + Math.floor(fraction(i + 1) * 58), lng: 121.568 + fraction(i + 3) * .071, lat: 31.164 + fraction(i + 73) * .048, speed: status === 'running' ? 22 + Math.floor(fraction(i + 4) * 20) : 0, task: status === 'running' ? `接送任务 T-${String(108 + i).padStart(4, '0')}` : status === 'charging' ? '回场补能' : status === 'idle' ? '区域巡游待命' : status === 'offline' ? '等待通信恢复' : '计划维保' }; });
    vehicles[7].soc = 16;
    const bays = stations.flatMap((s, si) => Array.from({ length: s.capacity }, (_, i) => { const status = i < 2 ? 'charging' : i === 2 ? 'occupied' : i === 9 ? 'fault' : i === 10 && si < 2 ? 'offline' : 'free'; const v = status === 'charging' ? vehicles[38 + si * 2 + i] : status === 'occupied' ? vehicles[35 + si] : undefined; if (v) {
        v.stationId = s.id;
        v.bayId = `${s.id}-${i + 1}`;
        v.lng = s.lng + (i - .5) * .0007;
        v.lat = s.lat;
        if (status === 'charging')
            v.soc = 42 + si * 12 + i * 9;
    } return { id: `${s.id}-${i + 1}`, stationId: s.id, number: i + 1, status, vehicleId: v?.id, power: status === 'charging' ? 78 + si * 12 + i * 8 : 0, remaining: status === 'charging' ? 18 + si * 7 + i * 9 : 0 }; }));
    return { vehicles, stations, bays, tick: 0, events: [{ id: 'E1', severity: 'error', title: '车辆通信离线', object: 'RT-049', time: '10:19:32', status: '待处理', vehicleId: 'RT-049' }, { id: 'E2', severity: 'error', title: '充电桩连接故障', object: '金科路 · 10号位', time: '10:18:46', status: '待处理', stationId: 'S02', bayId: 'S02-10' }, { id: 'E3', severity: 'warning', title: '车辆低电量 · 16%', object: 'RT-008', time: '10:17:25', status: '已关注', vehicleId: 'RT-008' }, { id: 'E4', severity: 'warning', title: '路线偏离待核验', object: 'RT-021', time: '10:16:08', status: '核验中', vehicleId: 'RT-021' }, { id: 'E5', severity: 'error', title: '车辆通信离线', object: 'RT-050', time: '10:14:52', status: '处理中', vehicleId: 'RT-050' }] };
}
function advance(s) { return { ...s, tick: s.tick + 1, vehicles: s.vehicles.map((v, i) => v.status === 'running' ? { ...v, lng: v.lng + Math.cos(i + s.tick * .07) * .000055, lat: v.lat + Math.sin(i + s.tick * .07) * .000035, speed: 22 + ((i + s.tick) % 19) } : v.status === 'charging' ? { ...v, soc: Math.min(98, v.soc + .08) } : v) }; }
function metrics(s) { const counts = Object.fromEntries(Object.keys(statusMeta).map(k => [k, s.vehicles.filter(v => v.status === k).length])); const charging = s.bays.filter(b => b.status === 'charging'); return { counts, total: s.vehicles.length, onlineRate: (s.vehicles.length - counts.offline) / s.vehicles.length * 100, available: s.bays.filter(b => b.status === 'free').length, power: charging.reduce((a, b) => a + b.power, 0), chargerUtilization: charging.length / s.bays.length * 100, utilization: counts.running / (s.vehicles.length - counts.offline) * 100 }; }
function history(period) { const length = period === 'today' ? 24 : period === 'week' ? 7 : 30; return Array.from({ length }, (_, i) => { const n = period === 'today' ? Math.round(18 + 55 * Math.exp(-(((i - 9) / 2.7) ** 2)) + 78 * Math.exp(-(((i - 18) / 2.8) ** 2)) + fraction(i + 4) * 12) : Math.round(1030 + fraction(i + 15) * 420); const date = new Date(Date.UTC(2026, 10, 8 - (length - 1 - i))); const current = period !== 'today' && i === length - 1 ? history('today').slice(0, 11) : null; return { label: period === 'today' ? `${String(i).padStart(2, '0')}:00` : `${date.getUTCMonth() + 1}/${String(date.getUTCDate()).padStart(2, '0')}`, orders: current ? current.reduce((a, b) => a + b.orders, 0) : n, utilization: current ? Number((28 / 48 * 100).toFixed(1)) : Math.round(36 + n / (period === 'today' ? 2.1 : 32)), distance: current ? current.reduce((a, b) => a + b.distance, 0) : Math.round(n * 7.6), revenue: current ? current.reduce((a, b) => a + b.revenue, 0) : Math.round(n * 24.8) }; }); }
function daily(s) { const h = history('today').slice(0, 11); return { orders: h.reduce((a, b) => a + b.orders, 0) + Math.floor(s.tick / 6), distance: h.reduce((a, b) => a + b.distance, 0) + Math.floor(s.tick * 1.6), revenue: h.reduce((a, b) => a + b.revenue, 0) + Math.floor(s.tick / 6) * 25 }; }
function comparison(s) { const d = daily(s), m = metrics(s); const previous = { orders: 441, distance: 3484, utilization: 55.1 }; return { orders: (d.orders - previous.orders) / previous.orders * 100, distance: (d.distance - previous.distance) / previous.distance * 100, utilization: m.utilization - previous.utilization }; }


/* geo.js — plain browser JavaScript */
// Locally generated schematic coordinates. Not a surveyed road network.
const bounds = [121.555, 31.153, 121.65, 31.223];
const feature = (type, coordinates, properties = {}) => ({ type: 'Feature', geometry: { type, coordinates }, properties });
function localGeography() {
    const roads = [], blocks = [], parks = [], labels = [];
    const names = ['祖冲之路', '高科中路', '碧波路', '科苑路', '金科路', '张东路'];
    for (let i = 0; i < 14; i++) {
        const x = 121.55 + i * .008;
        roads.push(feature('LineString', [[x, 31.15], [x + .008, 31.23]], { major: i % 3 === 0 }));
    }
    for (let j = 0; j < 13; j++) {
        const y = 31.15 + j * .006;
        roads.push(feature('LineString', [[121.55, y], [121.66, y + .004]], { major: j % 3 === 0 }));
    }
    for (let i = 0; i < 13; i++)
        for (let j = 0; j < 12; j++) {
            const x = 121.551 + i * .008 + j * .0006, y = 31.151 + j * .006;
            const poly = [[[x, y], [x + .0055, y + .0002], [x + .0059, y + .0038], [x + .0004, y + .0036], [x, y]]];
            (i % 4 === 1 && j % 3 === 1 ? parks : blocks).push(feature('Polygon', poly));
        }
    names.forEach((name, i) => labels.push(feature('Point', [121.568 + i * .012, 31.21 - (i % 3) * .017], { name })));
    const river = [[[121.63, 31.15], [121.631, 31.17], [121.623, 31.19], [121.627, 31.205], [121.625, 31.23], [121.629, 31.23], [121.631, 31.205], [121.627, 31.19], [121.635, 31.17], [121.634, 31.15], [121.63, 31.15]]];
    const fc = (features) => ({ type: 'FeatureCollection', features });
    return { roads: fc(roads), blocks: fc(blocks), parks: fc(parks), water: fc([feature('Polygon', river)]), labels: fc(labels) };
}
function localStyle() { const g = localGeography(); return { version: 8, sources: Object.fromEntries(Object.entries(g).map(([k, data]) => [k, { type: 'geojson', data }])), layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#15181b' } }, { id: 'blocks', type: 'fill', source: 'blocks', paint: { 'fill-color': '#1e2226', 'fill-outline-color': '#25292d' } }, { id: 'parks', type: 'fill', source: 'parks', paint: { 'fill-color': '#202f29', 'fill-opacity': .7 } }, { id: 'water', type: 'fill', source: 'water', paint: { 'fill-color': '#202c35' } }, { id: 'road-casing', type: 'line', source: 'roads', paint: { 'line-color': '#30353b', 'line-width': ['case', ['get', 'major'], 6, 3] } }, { id: 'roads', type: 'line', source: 'roads', paint: { 'line-color': ['case', ['get', 'major'], '#40454d', '#292e34'], 'line-width': ['case', ['get', 'major'], 2, 1] } }] }; }


/* Charts.js — plain browser JavaScript */
const metricMeta = { orders: { label: '订单量', unit: '单' }, utilization: { label: '车辆利用率', unit: '%' }, distance: { label: '运营里程', unit: 'km' }, revenue: { label: '运营收入', unit: '元' } };
function Spark({ values, color = '#9c9be5' }) { const max = Math.max(...values), min = Math.min(...values); return React.createElement("svg", { className: "spark", viewBox: "0 0 100 30", preserveAspectRatio: "none", "aria-hidden": "true" },
    React.createElement("path", { d: values.map((n, i) => `${i ? 'L' : 'M'}${i / (values.length - 1) * 100},${27 - (n - min) / (max - min || 1) * 23}`).join(' '), fill: "none", stroke: color, strokeWidth: "1.6", vectorEffect: "non-scaling-stroke" })); }
function TrendChart({ period, selected, tick, utilization }) {
    const el = useRef(null);
    const chart = useRef(null);
    useEffect(() => { if (!el.current)
        return; const c = echarts.init(el.current, undefined, { renderer: 'canvas' }); chart.current = c; const observer = new ResizeObserver(() => c.resize()); observer.observe(el.current); return () => { observer.disconnect(); c.dispose(); chart.current = null; }; }, []);
    useEffect(() => { const data = history(period); const today = period === 'today'; const shown = (today ? data.slice(0, 11) : data).map(p => ({ ...p })); if (today)
        shown[shown.length - 1].label = '10:20'; const colors = ['#a3a0e7', '#79b99e']; chart.current?.setOption({ animationDuration: 180, backgroundColor: 'transparent', textStyle: { fontFamily: 'Inter, Segoe UI, Microsoft YaHei, sans-serif' }, grid: { left: 46, right: 48, top: 24, bottom: 30 }, tooltip: { trigger: 'axis', backgroundColor: '#202226', borderColor: '#3a3d44', textStyle: { color: '#e8e9ed', fontSize: 12 }, padding: 12, confine: true, axisPointer: { type: 'line', lineStyle: { color: '#656772', type: 'dashed' } }, valueFormatter: (n) => Number(n).toLocaleString('zh-CN') }, xAxis: { type: 'category', data: shown.map(p => p.label), boundaryGap: false, axisLine: { lineStyle: { color: '#303238' } }, axisTick: { show: false }, axisLabel: { color: '#7f838e', fontSize: 11, hideOverlap: true, interval: today ? 1 : 'auto' } }, yAxis: selected.map((m, i) => ({ type: 'value', name: metricMeta[m].unit, position: i ? 'right' : 'left', min: 0, max: m === 'utilization' ? 100 : undefined, nameTextStyle: { color: '#8f939d', padding: [0, 0, 0, 8], fontSize: 11 }, splitNumber: 3, axisLabel: { color: '#7f838e', fontSize: 10 }, splitLine: { show: i === 0, lineStyle: { color: '#25282e', type: 'dashed' } } })), series: selected.map((m, i) => ({ name: metricMeta[m].label, type: 'line', yAxisIndex: i, data: shown.map((p, j) => j === shown.length - 1 ? (m === 'utilization' ? Number(utilization.toFixed(1)) : m === 'orders' ? p[m] + Math.floor(tick / 6) : m === 'distance' ? p[m] + Math.floor(tick * 1.6) : p[m] + Math.floor(tick / 6) * 25) : p[m]), smooth: .25, showSymbol: false, symbolSize: 6, lineStyle: { width: 2, color: colors[i] }, itemStyle: { color: colors[i] }, areaStyle: i === 0 ? { color: '#9c9be5', opacity: .055 } : undefined })) }, true); }, [period, selected, tick, utilization]);
    return React.createElement("div", { ref: el, className: "trend-chart", role: "img", "aria-label": `${period === 'today' ? '今日' : period === 'week' ? '近7天' : '近30天'}${selected.map(m => metricMeta[m].label).join('与')}趋势，模拟数据` });
}


/* Map.js — plain browser JavaScript */
const collection = (features) => ({ type: 'FeatureCollection', features });
function vehiclesGeo(data, filter) { return collection(data.vehicles.filter(v => filter === 'all' || (filter === 'abnormal' ? ['offline', 'maintenance'].includes(v.status) : v.status === filter)).map(v => ({ type: 'Feature', properties: { id: v.id, color: statusMeta[v.status].color }, geometry: { type: 'Point', coordinates: [v.lng, v.lat] } }))); }
function stationFor(data, s) { return s?.kind === 'station' ? data.stations.find(x => x.id === s.id) : s?.kind === 'bay' ? data.stations.find(x => x.id === data.bays.find(b => b.id === s.id)?.stationId) : undefined; }
function FleetMap({ data, filter, selection, onSelect }) {
    const container = useRef(null), mapRef = useRef(null), latest = useRef({ data, filter, selection, onSelect });
    latest.current = { data, filter, selection, onSelect };
    const [ready, setReady] = useState(false), [fallback, setFallback] = useState(false), [base, setBase] = useState(window.ROPO_CONFIG?.mapStyleUrl ? '在线底图加载中' : '本地矢量示意图');
    const [layers, setLayers] = useState({ vehicles: true, route: false, heat: false, fence: true });
    const [hover, setHover] = useState(null);
    const [zoom, setZoom] = useState(1);
    useEffect(() => {
        if (!container.current)
            return;
        let map;
        let dead = false;
        try {
            map = new maplibregl.Map({ container: container.current, style: window.ROPO_CONFIG?.mapStyleUrl || localStyle(), center: [121.604, 31.189], zoom: 12.7, attributionControl: false, canvasContextAttributes: { antialias: true }, maxZoom: 17, minZoom: 10 });
            mapRef.current = map;
        }
        catch {
            setFallback(true);
            setBase('本地示意图 · WebGL 不可用');
            return;
        }
        let timeout;
        const add = () => {
            if (dead)
                return;
            const d = latest.current.data;
            if (!map.getSource('fleet')) {
                map.addSource('fleet', { type: 'geojson', data: vehiclesGeo(d, latest.current.filter) });
                map.addSource('stations', { type: 'geojson', data: collection(d.stations.map(s => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.lng, s.lat] }, properties: { id: s.id } }))) });
                map.addSource('route', { type: 'geojson', data: collection([]) });
                map.addSource('demand', { type: 'geojson', data: collection(Array.from({ length: 120 }, (_, i) => ({ type: 'Feature', properties: { weight: .4 + (i % 6) / 10 }, geometry: { type: 'Point', coordinates: [121.578 + (i % 3) * .02 + Math.sin(i * 7.3) * .008, 31.18 + (i % 2) * .018 + Math.cos(i * 3.1) * .006] } }))) });
                map.addSource('fence', { type: 'geojson', data: collection([{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[121.564, 31.16], [121.642, 31.163], [121.644, 31.217], [121.565, 31.215], [121.564, 31.16]]] } }]) });
                map.addLayer({ id: 'fence-fill', type: 'fill', source: 'fence', paint: { 'fill-color': '#9993d5', 'fill-opacity': .025 } });
                map.addLayer({ id: 'fence-line', type: 'line', source: 'fence', paint: { 'line-color': '#9894c3', 'line-opacity': .5, 'line-width': 1, 'line-dasharray': [4, 4] } });
                map.addLayer({ id: 'heat', type: 'heatmap', source: 'demand', layout: { visibility: 'none' }, paint: { 'heatmap-weight': ['get', 'weight'], 'heatmap-radius': 38, 'heatmap-opacity': .35, 'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(128,119,185,0)', .4, '#70698e', .8, '#a697c6', 1, '#d1c3dc'] } });
                map.addLayer({ id: 'route-line', type: 'line', source: 'route', layout: { visibility: 'none', 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#b1a9ed', 'line-width': 3, 'line-dasharray': [2, 2] } });
                map.addLayer({ id: 'vehicle-halo', type: 'circle', source: 'fleet', paint: { 'circle-radius': ['case', ['==', ['get', 'id'], ''], 11, 0], 'circle-color': '#aaa3f1', 'circle-opacity': .18 } });
                map.addLayer({ id: 'vehicles', type: 'circle', source: 'fleet', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3, 14, 5, 17, 8], 'circle-color': ['get', 'color'], 'circle-stroke-color': '#17191c', 'circle-stroke-width': 2 } });
                map.addLayer({ id: 'station-halo', type: 'circle', source: 'stations', paint: { 'circle-radius': 14, 'circle-color': '#96c7ab', 'circle-opacity': .13 } });
                map.addLayer({ id: 'stations', type: 'circle', source: 'stations', paint: { 'circle-radius': 7, 'circle-color': '#78ba9c', 'circle-stroke-color': '#d0e3d8', 'circle-stroke-width': 1.5 } });
            }
            if (!document.querySelector('.station-map-label'))
                d.stations.forEach(s => { const el = document.createElement('button'); el.className = 'station-map-label'; el.textContent = s.short; el.setAttribute('aria-label', `地图站点 ${s.name}`); el.onclick = e => { e.stopPropagation(); latest.current.onSelect({ kind: 'station', id: s.id }); }; new maplibregl.Marker({ element: el, anchor: 'top', offset: [0, 16] }).setLngLat([s.lng, s.lat]).addTo(map); });
            map.fitBounds([[121.558, 31.156], [121.646, 31.22]], { padding: 22, duration: 0 });
            setReady(true);
            setBase(window.ROPO_CONFIG?.mapStyleUrl && map.getStyle().sources && !map.getSource('blocks') ? '在线底图' : '本地矢量示意图');
            if (timeout)
                clearTimeout(timeout);
        };
        map.on('idle', () => { if (container.current) {
            container.current.dataset.renderedVehicles = String(map.queryRenderedFeatures({ layers: map.getLayer('vehicles') ? ['vehicles'] : [] }).length);
        } });
        map.on('load', add);
        map.on('style.load', () => { if (!map.getSource('fleet'))
            add(); });
        map.on('error', e => { console.error('ROPO_MAP_ERROR: ' + e.error?.message); if (/worker/i.test(e.error?.message || '')) {
            setFallback(true);
            setBase('本地示意图 · 地图引擎降级');
        } if (window.ROPO_CONFIG?.mapStyleUrl && !map.getSource('blocks')) {
            setBase('在线底图不可用 · 本地示意图');
            map.setStyle(localStyle());
        } });
        map.on('moveend', () => { if (container.current)
            container.current.dataset.zoom = map.getZoom().toFixed(2); });
        map.on('webglcontextlost', () => { setFallback(true); setBase('本地示意图 · 图形上下文丢失'); });
        map.on('click', e => { const fs = map.queryRenderedFeatures(e.point, { layers: ['vehicles', 'stations'].filter(id => !!map.getLayer(id)) }); if (fs[0])
            latest.current.onSelect({ kind: fs[0].layer.id === 'vehicles' ? 'vehicle' : 'station', id: fs[0].properties.id }); });
        map.on('mousemove', e => { const fs = map.queryRenderedFeatures(e.point, { layers: ['vehicles', 'stations'].filter(id => !!map.getLayer(id)) }); map.getCanvas().style.cursor = fs.length ? 'pointer' : ''; setHover(fs[0] ? { id: fs[0].properties.id, x: e.point.x, y: e.point.y } : null); });
        map.on('mouseout', () => setHover(null));
        timeout = setTimeout(() => { if (!map.loaded() && !dead) {
            if (window.ROPO_CONFIG?.mapStyleUrl) {
                setBase('底图超时 · 本地示意图');
                map.setStyle(localStyle());
            }
            else {
                setFallback(true);
                setBase('本地示意图 · 地图引擎降级');
            }
        } }, 8000);
        const ro = new ResizeObserver(() => map.resize());
        ro.observe(container.current);
        return () => { dead = true; clearTimeout(timeout); ro.disconnect(); map.remove(); mapRef.current = null; };
    }, []);
    useEffect(() => { const map = mapRef.current; if (!ready || !map)
        return; map.getSource('fleet')?.setData(vehiclesGeo(data, filter)); }, [data, filter, ready]);
    useEffect(() => { const map = mapRef.current; if (!ready || !map)
        return; if (container.current)
        container.current.dataset.layers = JSON.stringify(layers); for (const [key, ids] of Object.entries({ vehicles: ['vehicles', 'vehicle-halo'], route: ['route-line'], heat: ['heat'], fence: ['fence-line', 'fence-fill'] }))
        for (const id of ids)
            if (map.getLayer(id))
                map.setLayoutProperty(id, 'visibility', layers[key] ? 'visible' : 'none'); }, [layers, ready]);
    useEffect(() => { const map = mapRef.current; if (!ready || !map)
        return; const v = selection?.kind === 'vehicle' ? data.vehicles.find(v => v.id === selection.id) : undefined; const s = stationFor(data, selection); map.setPaintProperty('station-halo', 'circle-radius', ['case', ['==', ['get', 'id'], s?.id || ''], 22, 14]); map.setPaintProperty('vehicle-halo', 'circle-radius', ['case', ['==', ['get', 'id'], v?.id || ''], 12, 0]); const target = v || s; if (target)
        map.easeTo({ center: [target.lng, target.lat], duration: 220 }); const routeVehicle = v || data.vehicles[0]; map.getSource('route')?.setData(collection([{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[routeVehicle.lng, routeVehicle.lat], [routeVehicle.lng + .004, routeVehicle.lat + .003], [routeVehicle.lng + .008, routeVehicle.lat + .005]] } }])); }, [selection, ready]);
    const vehicle = selection?.kind === 'vehicle' ? data.vehicles.find(v => v.id === selection.id) : undefined;
    const station = stationFor(data, selection);
    const hv = hover ? data.vehicles.find(v => v.id === hover.id) : undefined;
    const hs = hover ? data.stations.find(s => s.id === hover.id) : undefined;
    function reset() { mapRef.current?.fitBounds([[121.558, 31.156], [121.646, 31.22]], { padding: 22, duration: 220 }); setZoom(1); onSelect(null); }
    return React.createElement("div", { className: "map-module" },
        React.createElement("div", { className: "section-heading" },
            React.createElement("div", null,
                React.createElement("span", { className: "section-kicker" }, "LIVE OPERATIONS"),
                React.createElement("h2", null,
                    "\u5B9E\u65F6\u8FD0\u8425\u5730\u56FE ",
                    React.createElement("span", { className: "muted-label" }, "\u4E0A\u6D77 \u00B7 \u5F20\u6C5F"))),
            React.createElement("span", { className: "map-source" },
                React.createElement("span", { className: "dot" }),
                base)),
        React.createElement("div", { className: "map-stage" },
            React.createElement("div", { className: "map-canvas", style: { visibility: fallback ? 'hidden' : 'visible' }, ref: container }),
            fallback && React.createElement(Schematic, { data, filter, selection, onSelect, layers, zoom }),
            React.createElement("div", { className: "map-toolbar", "aria-label": "\u5730\u56FE\u56FE\u5C42" }, [{ key: 'vehicles', icon: CarFront, label: '车辆' }, { key: 'route', icon: Route, label: '路线' }, { key: 'heat', icon: Flame, label: '订单热力' }, { key: 'fence', icon: Scan, label: '围栏' }].map(({ key, icon: Icon, label }) => React.createElement("button", { key: key, "aria-pressed": layers[key], onClick: () => setLayers(l => ({ ...l, [key]: !l[key] })), className: layers[key] ? 'active' : '' },
                React.createElement(Icon, { size: 14 }),
                React.createElement("span", null, label)))),
            React.createElement("div", { className: "map-controls" },
                React.createElement("button", { "aria-label": "\u653E\u5927\u5730\u56FE", onClick: () => { mapRef.current?.zoomIn({ duration: 180 }); setZoom(z => Math.min(2, z + .15)); } },
                    React.createElement(Plus, null)),
                React.createElement("button", { "aria-label": "\u7F29\u5C0F\u5730\u56FE", onClick: () => { mapRef.current?.zoomOut({ duration: 180 }); setZoom(z => Math.max(.7, z - .15)); } },
                    React.createElement(Minus, null)),
                React.createElement("button", { "aria-label": "\u91CD\u7F6E\u5730\u56FE\u89C6\u91CE", onClick: reset },
                    React.createElement(LocateFixed, null))),
            React.createElement("div", { className: "map-place place-a" }, "\u5F20\u6C5F\u9AD8\u79D1\u6280\u56ED\u533A"),
            React.createElement("div", { className: "map-place place-b" }, "\u4E0A\u6D77\u79D1\u6280\u5927\u5B66"),
            React.createElement("div", { className: "map-place place-c" }, "\u6D66\u4E1C\u65B0\u533A"),
            fallback && React.createElement("div", { className: "station-labels" }, data.stations.map(s => React.createElement("button", { key: s.id, style: { left: `${(s.lng - bounds[0]) / (bounds[2] - bounds[0]) * 100}%`, top: `${(bounds[3] - s.lat) / (bounds[3] - bounds[1]) * 100}%` }, onClick: () => onSelect({ kind: 'station', id: s.id }) },
                React.createElement(Zap, { size: 11 }),
                s.short))),
            hover && (hv || hs) && React.createElement("div", { className: "map-tooltip", role: "tooltip", style: { left: Math.max(8, Math.min(hover.x + 14, (container.current?.clientWidth || 600) - 210)), top: Math.max(60, Math.min(hover.y - 85, (container.current?.clientHeight || 400) - 90)) } },
                React.createElement("strong", null, hv?.id || hs?.name),
                React.createElement("span", null, hv ? `${statusMeta[hv.status].label} · SOC ${Math.round(hv.soc)}%` : `${data.bays.filter(b => b.stationId === hs.id && b.status === 'free').length} 个空闲车位`),
                React.createElement("small", null, hv?.task || '点击查看站点车位')),
            !ready && !fallback && React.createElement("div", { className: "map-loading" },
                React.createElement(Layers, { size: 22 }),
                "\u6B63\u5728\u521D\u59CB\u5316\u77E2\u91CF\u5730\u56FE"),
            React.createElement("div", { className: "map-legend" },
                Object.entries(statusMeta).map(([k, m]) => React.createElement("span", { key: k },
                    React.createElement("i", { style: { background: m.color } }),
                    m.label)),
                React.createElement("span", { className: "map-attribution" }, "\u793A\u610F\u4F4D\u7F6E \u00B7 \u975E\u5BFC\u822A\u7528\u9014"))),
        React.createElement("div", { className: "map-selection" }, vehicle ? React.createElement(React.Fragment, null,
            React.createElement("span", { className: "selection-icon" },
                React.createElement(CarFront, { size: 19 })),
            React.createElement("div", null,
                React.createElement("strong", null, vehicle.id),
                React.createElement("span", null,
                    statusMeta[vehicle.status].label,
                    " \u00B7 ",
                    vehicle.task)),
            React.createElement("div", { className: "selection-data" },
                React.createElement("span", null,
                    "SOC ",
                    React.createElement("b", null,
                        Math.round(vehicle.soc),
                        "%")),
                React.createElement("span", null,
                    "\u901F\u5EA6 ",
                    React.createElement("b", null,
                        vehicle.speed,
                        " ",
                        React.createElement("small", null, "km/h")))),
            React.createElement("button", { className: "icon-button", "aria-label": "\u53D6\u6D88\u5730\u56FE\u9009\u62E9", onClick: () => onSelect(null) },
                React.createElement(X, { size: 16 }))) : station ? React.createElement(React.Fragment, null,
            React.createElement("span", { className: "selection-icon" },
                React.createElement(Zap, { size: 19 })),
            React.createElement("div", null,
                React.createElement("strong", null, station.name),
                React.createElement("span", null,
                    selection?.kind === 'bay' ? `${data.bays.find(b => b.id === selection.id)?.number} 号车位 · ` : '',
                    station.capacity,
                    " \u4E2A\u8F66\u4F4D \u00B7 ",
                    data.bays.filter(b => b.stationId === station.id && b.status === 'free').length,
                    " \u4E2A\u7A7A\u95F2")),
            React.createElement("span", { className: "selection-tag" }, "\u5DF2\u8054\u52A8\u8F66\u4F4D\u77E9\u9635"),
            React.createElement("button", { className: "icon-button", "aria-label": "\u53D6\u6D88\u5730\u56FE\u9009\u62E9", onClick: () => onSelect(null) },
                React.createElement(X, { size: 16 }))) : React.createElement(React.Fragment, null,
            React.createElement(MapPin, { size: 18 }),
            React.createElement("span", null, "\u5F20\u6C5F\u8FD0\u8425\u533A"),
            React.createElement("span", { className: "muted" },
                filter === 'all' ? data.vehicles.length : data.vehicles.filter(v => filter === 'abnormal' ? ['offline', 'maintenance'].includes(v.status) : v.status === filter).length,
                " \u8F86\u53EF\u89C1"),
            React.createElement("span", { className: "selection-hint" }, "\u9009\u62E9\u8F66\u8F86\u3001\u7AD9\u70B9\u6216\u5F02\u5E38\u4E8B\u4EF6\u67E5\u770B\u8BE6\u60C5"))));
}
function Schematic({ data, filter, selection, onSelect, layers, zoom }) { const g = localGeography(); const xy = (p) => [(p[0] - bounds[0]) / (bounds[2] - bounds[0]) * 1000, (bounds[3] - p[1]) / (bounds[3] - bounds[1]) * 700]; const path = (f) => f.geometry.coordinates[0].map((p, i) => `${i ? 'L' : 'M'}${xy(p).join(',')}`).join(' ') + 'Z'; return React.createElement("svg", { className: "schematic", viewBox: "0 0 1000 700", preserveAspectRatio: "none", "aria-label": "\u672C\u5730\u8FD0\u8425\u533A\u57DF\u793A\u610F\u56FE" },
    React.createElement("g", { style: { transform: `scale(${zoom})`, transformOrigin: 'center' } },
        React.createElement("rect", { width: "1000", height: "700", fill: "#15181b" }),
        g.blocks.features.map((f, i) => React.createElement("path", { key: i, d: path(f), fill: "#1f2428", stroke: "#272c30" })),
        g.parks.features.map((f, i) => React.createElement("path", { key: i, d: path(f), fill: "#25372d" })),
        g.water.features.map((f, i) => React.createElement("path", { key: i, d: path(f), fill: "#28343e" })),
        g.roads.features.map((f, i) => React.createElement("polyline", { key: i, points: f.geometry.coordinates.map((p) => xy(p).join(',')).join(' '), stroke: f.properties.major ? '#42474f' : '#30363c', fill: "none", strokeWidth: f.properties.major ? 3 : 1 })),
        layers.fence && React.createElement("rect", { x: "90", y: "65", width: "820", height: "570", rx: "24", fill: "#aaa0de03", stroke: "#9b97c1", strokeOpacity: ".4", strokeDasharray: "6 8" }),
        layers.heat && data.vehicles.filter(v => v.status === 'running').slice(0, 8).map(v => React.createElement("circle", { key: v.id, cx: xy([v.lng, v.lat])[0], cy: xy([v.lng, v.lat])[1], r: "55", fill: "#9d86b3", opacity: ".12" })),
        layers.route && React.createElement("polyline", { points: "200,420 330,420 400,300 550,210", fill: "none", stroke: "#afa3df", strokeWidth: "3", strokeDasharray: "7 5" }),
        layers.vehicles && data.vehicles.filter(v => filter === 'all' || (filter === 'abnormal' ? ['maintenance', 'offline'].includes(v.status) : v.status === filter)).map(v => React.createElement("g", { key: v.id, role: "button", tabIndex: 0, "aria-label": `地图车辆 ${v.id}`, onClick: () => onSelect({ kind: 'vehicle', id: v.id }), onKeyDown: e => { if (e.key === 'Enter')
                onSelect({ kind: 'vehicle', id: v.id }); } },
            React.createElement("circle", { cx: xy([v.lng, v.lat])[0], cy: xy([v.lng, v.lat])[1], r: selection?.id === v.id ? 11 : 6, fill: statusMeta[v.status].color, stroke: "#16181c", strokeWidth: "2" }),
            React.createElement("title", null,
                v.id,
                " \u00B7 ",
                Math.round(v.soc),
                "% \u00B7 ",
                statusMeta[v.status].label,
                " \u00B7 ",
                v.task))),
        data.stations.map(s => React.createElement("g", { key: s.id, role: "button", tabIndex: 0, "aria-label": `地图站点 ${s.name}`, onClick: () => onSelect({ kind: 'station', id: s.id }), onKeyDown: e => { if (e.key === 'Enter')
                onSelect({ kind: 'station', id: s.id }); } },
            React.createElement("rect", { x: xy([s.lng, s.lat])[0] - 10, y: xy([s.lng, s.lat])[1] - 10, width: "20", height: "20", rx: "5", fill: "#78ba9c", stroke: "#c0d9cd" }),
            React.createElement("title", null, s.name))))); }


/* main.js — plain browser JavaScript */
const number = (n) => Math.round(n).toLocaleString('en-US');
function App() {
    const [data, setData] = useState(seed);
    const [paused, setPaused] = useState(false);
    const [now, setNow] = useState(new Date());
    const [updated, setUpdated] = useState(new Date());
    const [filter, setFilter] = useState('all');
    const [selection, setSelection] = useState(null);
    const [stationId, setStationId] = useState('S01');
    const [period, setPeriod] = useState('today');
    const [selectedMetrics, setSelectedMetrics] = useState(['orders', 'utilization']);
    const [eventFilter, setEventFilter] = useState('all');
    const [bayFilter, setBayFilter] = useState('all');
    const [full, setFull] = useState(false);
    const [notice, setNotice] = useState('');
    const [bayTip, setBayTip] = useState(null);
    const m = metrics(data), d = daily(data), cmp = comparison(data), station = data.stations.find(s => s.id === stationId);
    const bays = data.bays.filter(b => b.stationId === stationId);
    const events = data.events.filter(e => eventFilter === 'all' || e.severity === eventFilter).sort((a, b) => (a.severity === 'error' ? 0 : 1) - (b.severity === 'error' ? 0 : 1) || b.time.localeCompare(a.time));
    useEffect(() => { const timer = setInterval(() => setNow(new Date()), 1000); const fs = () => setFull(!!document.fullscreenElement); document.addEventListener('fullscreenchange', fs); return () => { clearInterval(timer); document.removeEventListener('fullscreenchange', fs); }; }, []);
    useEffect(() => { if (paused)
        return; const id = setInterval(() => { setData(advance); setUpdated(new Date()); }, Math.max(1000, window.ROPO_CONFIG?.refreshMs || 5000)); return () => clearInterval(id); }, [paused]);
    useEffect(() => { if (!notice)
        return; const id = setTimeout(() => setNotice(''), 4000); return () => clearTimeout(id); }, [notice]);
    function select(s) { setSelection(s); setBayTip(null); if (s?.kind === 'station')
        setStationId(s.id); if (s?.kind === 'bay') {
        const b = data.bays.find(b => b.id === s.id);
        if (b)
            setStationId(b.stationId);
    } if (s?.kind === 'vehicle') {
        const v = data.vehicles.find(v => v.id === s.id);
        if (v?.stationId)
            setStationId(v.stationId);
        if (filter !== 'all' && filter !== v?.status)
            setFilter('all');
    } }
    function selectEvent(e) { if (e.vehicleId)
        select({ kind: 'vehicle', id: e.vehicleId });
    else if (e.bayId)
        select({ kind: 'bay', id: e.bayId });
    else if (e.stationId)
        select({ kind: 'station', id: e.stationId }); }
    function metricToggle(k) { setSelectedMetrics(prev => prev.includes(k) ? prev.length > 1 ? prev.filter(x => x !== k) : prev : prev.length === 2 ? [prev[0], k] : [...prev, k]); }
    async function toggleFull() { try {
        if (document.fullscreenElement)
            await document.exitFullscreen();
        else
            await document.documentElement.requestFullscreen();
    }
    catch {
        setNotice('当前浏览器不允许全屏，请使用 F11。');
    } }
    const hist = useMemo(() => history('today').slice(0, 11), []);
    const health = [{ label: '80–100%', n: data.vehicles.filter(v => v.soc >= 80).length, color: '#79b99e' }, { label: '50–79%', n: data.vehicles.filter(v => v.soc >= 50 && v.soc < 80).length, color: '#9996ca' }, { label: '20–49%', n: data.vehicles.filter(v => v.soc >= 20 && v.soc < 50).length, color: '#767e8b' }, { label: '低于20%', n: data.vehicles.filter(v => v.soc < 20).length, color: '#d0ac6d' }];
    return React.createElement("div", { className: "dashboard" },
        React.createElement("header", { className: "topbar" },
            React.createElement("a", { className: "brand", href: window.ROPO_CONFIG?.platformUrl || 'https://abdd33.github.io/ropo-fleet-linear/#overview', title: "\u8FD4\u56DE ROPO Fleet \u4E91\u5E73\u53F0" },
                React.createElement("span", { className: "brand-mark" }, "\u039B"),
                React.createElement("span", null,
                    "ROPO Fleet",
                    React.createElement("small", null, "\u8FD0\u8425\u6307\u6325\u4E2D\u5FC3"))),
            React.createElement("span", { className: "header-divider" }),
            React.createElement("div", { className: "location" },
                React.createElement(MapPin, { size: 15 }),
                React.createElement("span", null,
                    "\u4E0A\u6D77 ",
                    React.createElement("i", null, "/"),
                    " \u5F20\u6C5F\u8FD0\u8425\u533A"),
                React.createElement("span", { className: "env" }, "\u6A21\u62DF\u73AF\u5883")),
            React.createElement("div", { className: "header-end" },
                React.createElement("div", { className: "date-time" },
                    React.createElement("span", null,
                        now.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }),
                        " ",
                        React.createElement("small", null, ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()])),
                    React.createElement("strong", null, now.toLocaleTimeString('zh-CN', { hour12: false }))),
                React.createElement("span", { className: `live-state ${paused ? 'paused' : ''}` },
                    React.createElement("i", null),
                    paused ? '更新已暂停' : '模拟实时'),
                React.createElement("button", { className: "icon-button", onClick: () => setPaused(v => !v), "aria-label": paused ? '恢复实时刷新' : '暂停实时刷新', title: paused ? '恢复实时刷新' : '暂停实时刷新' }, paused ? React.createElement(Play, { size: 16 }) : React.createElement(Pause, { size: 16 })),
                React.createElement("button", { className: "icon-button", "aria-label": full ? '退出全屏' : '进入全屏', title: full ? '退出全屏' : '进入全屏', onClick: toggleFull }, full ? React.createElement(Minimize2, { size: 17 }) : React.createElement(Maximize2, { size: 17 })))),
        React.createElement("main", { className: "main-grid" },
            React.createElement("aside", { className: "left-column" },
                React.createElement("section", { className: "fleet-overview" },
                    React.createElement("div", { className: "section-heading" },
                        React.createElement("div", null,
                            React.createElement("span", { className: "section-kicker" }, "FLEET OVERVIEW"),
                            React.createElement("h2", null, "\u8F66\u961F\u8FD0\u8425\u6982\u51B5")),
                        React.createElement(CarFront, { size: 18, className: "muted" })),
                    React.createElement("button", { className: `fleet-total ${filter === 'all' ? 'selected' : ''}`, "aria-pressed": filter === 'all', onClick: () => setFilter('all') },
                        React.createElement("span", null,
                            "\u8F66\u961F\u603B\u89C4\u6A21 ",
                            React.createElement("small", null, "\u5168\u90E8\u8F66\u8F86")),
                        React.createElement("div", null,
                            React.createElement("strong", null, m.total),
                            React.createElement("span", null, "\u8F86"),
                            React.createElement(Spark, { values: [42, 42, 44, 44, 44, 46, 46, 48, 48, 50, 50] }))),
                    React.createElement("div", { className: "fleet-status-grid" }, ['running', 'idle', 'charging', 'abnormal'].map(k => { const meta = k === 'abnormal' ? { label: '离线 / 维护', color: '#d0ac6d' } : statusMeta[k]; const count = k === 'abnormal' ? m.counts.offline + m.counts.maintenance : m.counts[k]; return React.createElement("button", { key: k, className: `stat-cell ${filter === k ? 'selected' : ''}`, "aria-pressed": filter === k, onClick: () => setFilter(filter === k ? 'all' : k) },
                        React.createElement("span", null,
                            React.createElement("i", { className: "dot", style: { background: meta.color } }),
                            meta.label,
                            React.createElement(ChevronRight, { size: 12 })),
                        React.createElement("strong", null,
                            count,
                            React.createElement("small", null, "\u8F86")),
                        React.createElement("div", { className: "mini-bar" },
                            React.createElement("i", { style: { width: `${count / m.total * 100}%`, background: meta.color } }))); })),
                    React.createElement("div", { className: "service-state" },
                        React.createElement("div", { className: "subheading" },
                            React.createElement("h3", null, "\u5F53\u524D\u670D\u52A1\u72B6\u6001"),
                            React.createElement("span", null,
                                m.total,
                                " \u8F86")),
                        React.createElement("div", { className: "stacked-bar" }, Object.entries(statusMeta).map(([k, meta]) => React.createElement("button", { key: k, title: `${meta.label} ${m.counts[k]} 辆`, "aria-label": `筛选${meta.label}`, onClick: () => setFilter(k), style: { width: `${m.counts[k] / m.total * 100}%`, background: meta.color } }))),
                        React.createElement("div", { className: "status-legend" }, Object.entries(statusMeta).map(([k, meta]) => React.createElement("span", { key: k },
                            React.createElement("i", { style: { background: meta.color } }),
                            meta.label,
                            React.createElement("b", null, m.counts[k])))))),
                React.createElement("section", { className: "online-section" },
                    React.createElement("div", { className: "online-ring", role: "img", "aria-label": `车辆在线率 ${m.onlineRate}%` },
                        React.createElement("svg", { viewBox: "0 0 100 100" },
                            React.createElement("circle", { cx: "50", cy: "50", r: "42", fill: "none", stroke: "#2b2e34", strokeWidth: "5" }),
                            React.createElement("circle", { cx: "50", cy: "50", r: "42", fill: "none", stroke: "#79b99e", strokeWidth: "5", strokeLinecap: "round", strokeDasharray: `${m.onlineRate / 100 * 264} 264`, transform: "rotate(-90 50 50)" })),
                        React.createElement("div", null,
                            React.createElement("strong", null,
                                m.onlineRate,
                                React.createElement("small", null, "%")),
                            React.createElement("span", null, "\u8F66\u8F86\u5728\u7EBF\u7387"))),
                    React.createElement("div", { className: "online-info" },
                        React.createElement("span", null,
                            React.createElement("i", { className: "dot green" }),
                            "\u5728\u7EBF\u8F66\u8F86 ",
                            React.createElement("b", null, m.total - m.counts.offline)),
                        React.createElement("span", null,
                            React.createElement("i", { className: "dot red" }),
                            "\u79BB\u7EBF\u8F66\u8F86 ",
                            React.createElement("b", null, m.counts.offline)),
                        React.createElement("small", null,
                            React.createElement(ShieldCheck, { size: 12 }),
                            " \u5728\u7EBF\u542B\u5145\u7535\u53CA\u7EF4\u62A4\u8F66\u8F86"))),
                React.createElement("section", { className: "efficiency" },
                    React.createElement("div", { className: "subheading" },
                        React.createElement("h2", null, "\u4ECA\u65E5\u8FD0\u8425"),
                        React.createElement("span", null, "\u8F83\u6628\u65E5\u540C\u671F")),
                    [{ label: '累计订单', value: number(d.orders), unit: '单', delta: `+${cmp.orders.toFixed(1)}%`, values: hist.map((p, i) => i === hist.length - 1 ? d.orders : hist.slice(0, i + 1).reduce((a, b) => a + b.orders, 0)), color: '#9c9be5' }, { label: '运营里程', value: number(d.distance), unit: 'km', delta: `+${cmp.distance.toFixed(1)}%`, values: hist.map((p, i) => i === hist.length - 1 ? d.distance : hist.slice(0, i + 1).reduce((a, b) => a + b.distance, 0)), color: '#818d9f' }, { label: '车辆利用率', value: m.utilization.toFixed(1), unit: '%', delta: `+${cmp.utilization.toFixed(1)}pp`, values: hist.map((p, i) => i === hist.length - 1 ? m.utilization : p.utilization), color: '#79b99e' }].map(x => React.createElement("div", { className: "efficiency-row", key: x.label },
                        React.createElement("span", { className: "metric-label" }, x.label),
                        React.createElement("div", { className: "metric-body" },
                            React.createElement("strong", null,
                                x.value,
                                React.createElement("small", null, x.unit)),
                            React.createElement(Spark, { values: x.values, color: x.color })),
                        React.createElement("span", { className: "delta" },
                            React.createElement(ArrowUpRight, { size: 12 }),
                            x.delta)))),
                React.createElement("section", { className: "battery-section" },
                    React.createElement("div", { className: "subheading" },
                        React.createElement("h3", null,
                            React.createElement(BatteryCharging, { size: 14 }),
                            "\u8F66\u961F\u7535\u91CF\u5206\u5E03"),
                        React.createElement("span", null, "SOC")),
                    React.createElement("div", { className: "battery-bars" }, health.map(h => React.createElement("div", { key: h.label },
                        React.createElement("span", null, h.label),
                        React.createElement("div", null,
                            React.createElement("i", { style: { width: `${h.n / m.total * 100}%`, background: h.color } })),
                        React.createElement("b", null, h.n))))),
                React.createElement("div", { className: "left-foot" },
                    React.createElement(Radio, { size: 12 }),
                    React.createElement("span", null, paused ? '刷新已暂停' : `${(window.ROPO_CONFIG?.refreshMs || 5000) / 1000}s 更新`),
                    React.createElement("span", null,
                        "\u540C\u6B65 ",
                        updated.toLocaleTimeString('zh-CN', { hour12: false })))),
            React.createElement("div", { className: "center-column" },
                React.createElement(FleetMap, { data, filter, selection, onSelect: select }),
                React.createElement("section", { className: "trend-section" },
                    React.createElement("div", { className: "section-heading" },
                        React.createElement("div", null,
                            React.createElement("span", { className: "section-kicker" }, "OPERATIONAL PERFORMANCE"),
                            React.createElement("h2", null, "\u8FD0\u8425\u8D8B\u52BF")),
                        React.createElement("div", { className: "segmented", "aria-label": "\u8D8B\u52BF\u65F6\u95F4\u8303\u56F4" }, [{ key: 'today', label: '今日' }, { key: 'week', label: '近7天' }, { key: 'month', label: '近30天' }].map(p => React.createElement("button", { key: p.key, "aria-pressed": period === p.key, className: period === p.key ? 'active' : '', onClick: () => setPeriod(p.key) }, p.label)))),
                    React.createElement("div", { className: "trend-metrics" },
                        Object.keys(metricMeta).map(k => React.createElement("button", { key: k, "aria-pressed": selectedMetrics.includes(k), onClick: () => metricToggle(k), className: selectedMetrics.includes(k) ? 'active' : '' },
                            React.createElement("i", { style: { background: selectedMetrics.includes(k) ? selectedMetrics.indexOf(k) === 0 ? '#a3a0e7' : '#79b99e' : '#494c55' } }),
                            metricMeta[k].label)),
                        React.createElement("small", null,
                            "\u6700\u591A\u4E24\u9879 \u00B7 ",
                            period === 'today' ? '截至 10:20' : '模拟历史')),
                    React.createElement(TrendChart, { period: period, selected: selectedMetrics, tick: data.tick, utilization: m.utilization }))),
            React.createElement("aside", { className: "right-column" },
                React.createElement("section", { className: "charging-section" },
                    React.createElement("div", { className: "section-heading" },
                        React.createElement("div", null,
                            React.createElement("span", { className: "section-kicker" }, "ENERGY & INFRASTRUCTURE"),
                            React.createElement("h2", null, "\u5145\u7535\u8D44\u6E90")),
                        React.createElement(Zap, { size: 18, className: "muted" })),
                    React.createElement("div", { className: "charge-kpis" },
                        React.createElement("div", null,
                            React.createElement("span", null, "\u5145\u7535\u7AD9"),
                            React.createElement("strong", null,
                                "3",
                                React.createElement("small", null, "\u5EA7"))),
                        React.createElement("div", null,
                            React.createElement("span", null, "\u5145\u7535\u8F66\u8F86"),
                            React.createElement("strong", null,
                                m.counts.charging,
                                React.createElement("small", null, "\u8F86"))),
                        React.createElement("div", null,
                            React.createElement("span", null, "\u7A7A\u95F2\u8F66\u4F4D"),
                            React.createElement("strong", { className: "text-green" },
                                m.available,
                                React.createElement("small", null,
                                    "/ ",
                                    data.bays.length)))),
                    React.createElement("div", { className: "power-line" },
                        React.createElement("span", null,
                            React.createElement("i", { className: "dot green" }),
                            "\u603B\u5145\u7535\u529F\u7387 ",
                            React.createElement("strong", null,
                                m.power,
                                React.createElement("small", null, " kW"))),
                        React.createElement("span", null,
                            "\u6869\u5229\u7528\u7387 ",
                            React.createElement("b", null,
                                m.chargerUtilization.toFixed(1),
                                "%"))),
                    React.createElement("div", { className: "station-list" }, data.stations.map(s => { const bs = data.bays.filter(b => b.stationId === s.id); const used = bs.filter(b => ['charging', 'occupied'].includes(b.status)).length; return React.createElement("button", { key: s.id, className: `station-row ${stationId === s.id ? 'active' : ''}`, "aria-pressed": stationId === s.id, onClick: () => select({ kind: 'station', id: s.id }) },
                        React.createElement("span", null, s.name),
                        React.createElement("div", { className: "station-load" }, bs.map(b => React.createElement("i", { key: b.id, className: `load-${b.status}` }))),
                        React.createElement("b", null,
                            used,
                            React.createElement("small", null,
                                " / ",
                                s.capacity)),
                        React.createElement(ChevronRight, { size: 12 })); }))),
                React.createElement("section", { className: "bays-section" },
                    React.createElement("div", { className: "subheading" },
                        React.createElement("h2", null, "\u5145\u7535\u8F66\u4F4D"),
                        React.createElement("label", { className: "station-select" },
                            React.createElement("select", { "aria-label": "\u9009\u62E9\u5145\u7535\u7AD9", value: stationId, onChange: e => select({ kind: 'station', id: e.target.value }) }, data.stations.map(s => React.createElement("option", { key: s.id, value: s.id }, s.short))),
                            React.createElement(ChevronDown, { size: 12 }))),
                    React.createElement("div", { className: "bay-matrix" }, bays.map(b => { const v = data.vehicles.find(v => v.id === b.vehicleId); const dim = bayFilter !== 'all' && bayFilter !== b.status; const active = selection?.id === b.id || selection?.kind === 'vehicle' && selection.id === b.vehicleId; return React.createElement("button", { key: b.id, className: `bay bay-${b.status} ${active ? 'selected' : ''} ${dim ? 'dim' : ''}`, "aria-label": `${station.short} ${b.number}号车位 ${bayMeta[b.status].label}${v ? ` ${v.id} 电量${Math.round(v.soc)}%` : ''}`, "aria-pressed": !!active, onClick: () => select({ kind: 'bay', id: b.id }), onMouseEnter: () => setBayTip(b), onMouseLeave: () => setBayTip(null), onFocus: () => setBayTip(b), onBlur: () => setBayTip(null) },
                        React.createElement("span", { className: "bay-number" }, String(b.number).padStart(2, '0')),
                        b.status === 'charging' ? React.createElement(Zap, { size: 15 }) : b.status === 'fault' ? React.createElement(TriangleAlert, { size: 15 }) : b.status === 'offline' ? React.createElement(Unplug, { size: 15 }) : b.status === 'occupied' ? React.createElement(CarFront, { size: 15 }) : React.createElement("span", { className: "empty-bay-mark" }),
                        React.createElement("span", { className: "bay-value" }, v && b.status === 'charging' ? `${Math.round(v.soc)}%` : bayMeta[b.status].label),
                        v && b.status === 'charging' && React.createElement("i", { className: "bay-progress", style: { width: `${v.soc}%` } })); })),
                    React.createElement("div", { className: "bay-legend", "aria-label": "\u7B5B\u9009\u8F66\u4F4D\u72B6\u6001" }, Object.entries(bayMeta).map(([k, v]) => React.createElement("button", { key: k, "aria-pressed": bayFilter === k, className: bayFilter === k ? 'active' : '', onClick: () => setBayFilter(bayFilter === k ? 'all' : k) },
                        React.createElement("i", { className: `load-${k}` }),
                        v.label))),
                    React.createElement("div", { className: `bay-detail ${bayTip ? 'visible' : ''}`, "aria-live": "polite" }, bayTip ? React.createElement(React.Fragment, null,
                        React.createElement("strong", null,
                            String(bayTip.number).padStart(2, '0'),
                            "\u53F7 \u00B7 ",
                            bayMeta[bayTip.status].label),
                        React.createElement("span", null, bayTip.vehicleId ? (bayTip.status === 'charging' ? `${bayTip.vehicleId} · ${Math.round(data.vehicles.find(v => v.id === bayTip.vehicleId)?.soc || 0)}% · ${bayTip.power}kW · ${bayTip.remaining}min` : `${bayTip.vehicleId} · 已停放 / 未充电`) : bayTip.status === 'free' ? '可停放 / 可补能' : bayTip.status === 'occupied' ? '车位已占用 · 未充电' : bayTip.status === 'fault' ? '连接故障 · 待处理' : '设备离线 · 等待恢复')) : React.createElement(React.Fragment, null,
                        React.createElement("span", null, station.name),
                        React.createElement("span", null,
                            bays.filter(b => b.status === 'free').length,
                            " \u7A7A\u95F2 \u00B7 ",
                            bays.filter(b => b.status === 'charging').length,
                            " \u5145\u7535")))),
                React.createElement("section", { className: "events-section" },
                    React.createElement("div", { className: "section-heading" },
                        React.createElement("h2", null,
                            "\u5F02\u5E38\u4E8B\u4EF6 ",
                            React.createElement("span", { className: "count-badge" }, data.events.length)),
                        React.createElement("div", { className: "segmented compact", "aria-label": "\u5F02\u5E38\u7B5B\u9009" },
                            React.createElement("button", { className: eventFilter === 'all' ? 'active' : '', "aria-pressed": eventFilter === 'all', onClick: () => setEventFilter('all') }, "\u5168\u90E8"),
                            React.createElement("button", { className: eventFilter === 'error' ? 'active' : '', "aria-pressed": eventFilter === 'error', onClick: () => setEventFilter('error') }, "\u5F02\u5E38"),
                            React.createElement("button", { className: eventFilter === 'warning' ? 'active' : '', "aria-pressed": eventFilter === 'warning', onClick: () => setEventFilter('warning') }, "\u5173\u6CE8"))),
                    React.createElement("div", { className: "event-list" }, events.length ? events.map(e => React.createElement("button", { key: e.id, className: `event-row ${e.severity} ${(!!selection && (selection.id === e.vehicleId || selection.id === e.bayId)) ? 'selected' : ''}`, onClick: () => selectEvent(e) },
                        React.createElement("span", { className: "event-icon" }, e.title.includes('离线') ? React.createElement(WifiOff, { size: 14 }) : e.title.includes('充电') ? React.createElement(PlugZap, { size: 14 }) : e.title.includes('电量') ? React.createElement(BatteryLow, { size: 14 }) : React.createElement(TriangleAlert, { size: 14 })),
                        React.createElement("span", { className: "event-content" },
                            React.createElement("strong", null, e.title),
                            React.createElement("small", null,
                                e.object,
                                React.createElement("i", null, "\u00B7"),
                                e.time)),
                        React.createElement("span", { className: "event-status" },
                            e.status,
                            React.createElement(ChevronRight, { size: 11 })))) : React.createElement("div", { className: "empty-state" },
                        React.createElement(Check, { size: 20 }),
                        "\u6682\u65E0\u5F02\u5E38\u4E8B\u4EF6")),
                    React.createElement("div", { className: "events-foot" },
                        React.createElement("span", null,
                            React.createElement(ShieldCheck, { size: 12 }),
                            "\u6309\u4F18\u5148\u7EA7\u6392\u5E8F"),
                        React.createElement("span", null,
                            "\u5F02\u5E38 ",
                            data.events.filter(e => e.severity === 'error').length,
                            " \u00B7 \u5173\u6CE8 ",
                            data.events.filter(e => e.severity === 'warning').length))))),
        React.createElement("footer", { className: "footer" },
            React.createElement("span", null,
                React.createElement(Activity, { size: 11 }),
                " ROPO FLEET ",
                React.createElement("i", null, "/"),
                " OPERATIONS CENTER"),
            React.createElement("span", null,
                "\u6A21\u62DF\u6570\u636E \u00B7 50 \u8F86\u8F66 / 3 \u4E2A\u7AD9\u70B9 ",
                React.createElement("i", null, "\u00B7"),
                " \u573A\u666F\u65F6\u95F4 10:20"),
            React.createElement("span", { className: "footer-status" },
                React.createElement("i", { className: `dot ${paused ? 'yellow' : 'green'}` }),
                paused ? '已暂停' : '数据链路正常 · 本地模拟')),
        notice && React.createElement("div", { role: "status", className: "toast" }, notice));
}
createRoot(document.getElementById('root')).render(React.createElement(App, null));

}
