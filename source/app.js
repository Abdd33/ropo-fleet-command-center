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
function vehiclesGeo(data, filter) { return collection(data.vehicles.filter(v => matchesVehicle(v, filter)).map(v => ({ type: 'Feature', properties: { id: v.id, color: statusMeta[v.status].color }, geometry: { type: 'Point', coordinates: [v.lng, v.lat] } }))); }
function stationFor(data, s) { return s?.kind === 'station' ? data.stations.find(x => x.id === s.id) : s?.kind === 'bay' ? data.stations.find(x => x.id === data.bays.find(b => b.id === s.id)?.stationId) : undefined; }
function FleetMap({ data, filter, selection, onSelect }) {
    const container = useRef(null), mapRef = useRef(null), latest = useRef({ data, filter, selection, onSelect });
    latest.current = { data, filter, selection, onSelect };
    const [ready, setReady] = useState(false), [fallback, setFallback] = useState(false), [base, setBase] = useState(window.ROPO_CONFIG?.mapStyleUrl ? '在线底图加载中' : '矢量示意');
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
            setBase('SVG · 示意');
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
            setBase(window.ROPO_CONFIG?.mapStyleUrl && map.getStyle().sources && !map.getSource('blocks') ? '在线底图' : '矢量示意');
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
            setBase('SVG · 示意');
        } if (window.ROPO_CONFIG?.mapStyleUrl && !map.getSource('blocks')) {
            setBase('矢量示意');
            map.setStyle(localStyle());
        } });
        map.on('moveend', () => { if (container.current)
            container.current.dataset.zoom = map.getZoom().toFixed(2); });
        map.on('webglcontextlost', () => { setFallback(true); setBase('SVG · 示意'); });
        map.on('click', e => { const fs = map.queryRenderedFeatures(e.point, { layers: ['vehicles', 'stations'].filter(id => !!map.getLayer(id)) }); if (fs[0])
            latest.current.onSelect({ kind: fs[0].layer.id === 'vehicles' ? 'vehicle' : 'station', id: fs[0].properties.id }); });
        map.on('mousemove', e => { const fs = map.queryRenderedFeatures(e.point, { layers: ['vehicles', 'stations'].filter(id => !!map.getLayer(id)) }); map.getCanvas().style.cursor = fs.length ? 'pointer' : ''; setHover(fs[0] ? { id: fs[0].properties.id, x: e.point.x, y: e.point.y } : null); });
        map.on('mouseout', () => setHover(null));
        timeout = setTimeout(() => { if (!map.loaded() && !dead) {
            if (window.ROPO_CONFIG?.mapStyleUrl) {
                setBase('矢量示意');
                map.setStyle(localStyle());
            }
            else {
                setFallback(true);
                setBase('SVG · 示意');
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
                React.createElement("h2", null,
                    "\u5B9E\u65F6\u8FD0\u8425\u5730\u56FE ",
                    React.createElement("span", { className: "muted-label" }, "\u4E0A\u6D77 \u00B7 \u5F20\u6C5F"))),
            React.createElement("span", { className: "map-source", title: "示意坐标，非导航用途" },
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
                
                null)),
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
            null,
            React.createElement("button", { className: "icon-button", "aria-label": "\u53D6\u6D88\u5730\u56FE\u9009\u62E9", onClick: () => onSelect(null) },
                React.createElement(X, { size: 16 }))) : React.createElement(React.Fragment, null,
            React.createElement(MapPin, { size: 18 }),
            React.createElement("span", null, "\u5F20\u6C5F\u8FD0\u8425\u533A"),
            React.createElement("span", { className: "muted" },
                filter === 'all' ? data.vehicles.length : data.vehicles.filter(v => matchesVehicle(v, filter)).length,
                " \u8F86\u53EF\u89C1"),
            null)));
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
        layers.vehicles && data.vehicles.filter(v => matchesVehicle(v, filter)).map(v => React.createElement("g", { key: v.id, role: "button", tabIndex: 0, "aria-label": `地图车辆 ${v.id}`, onClick: () => onSelect({ kind: 'vehicle', id: v.id }), onKeyDown: e => { if (e.key === 'Enter')
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

/* revision-v2 */
// Plain JavaScript components; embedded in index.html, no build/runtime imports.
const h=React.createElement;
const socGroups=[
 {key:'soc-high',label:'80–100%',color:'#79b99e',test:v=>v.soc>=80},
 {key:'soc-mid',label:'50–79%',color:'#9c9be5',test:v=>v.soc>=50&&v.soc<80},
 {key:'soc-low',label:'20–49%',color:'#858f9e',test:v=>v.soc>=20&&v.soc<50},
 {key:'soc-critical',label:'低于20%',color:'#d0ac6d',test:v=>v.soc<20}
];
function matchesVehicle(v,filter){if(filter==='all')return true;if(filter==='abnormal')return ['maintenance','offline'].includes(v.status);const group=socGroups.find(g=>g.key===filter);return group?group.test(v):v.status===filter;}
function capacityHistory(period,data){
 const current=metrics(data).counts,total=data.vehicles.length;
 const length=period==='today'?11:period==='week'?7:30;
 return Array.from({length},(_,i)=>{
   const date=new Date(Date.UTC(2026,10,8-(length-1-i)));
   const latest=i===length-1;
   const charging=4+(i%5),maintenance=4,offline=2;
   const running=Math.round(17+Math.sin(i*.8)*4+i/(length-1)*10);
   return {label:period==='today'?(latest?'10:20':String(i).padStart(2,'0')+':00'):`${date.getUTCMonth()+1}/${String(date.getUTCDate()).padStart(2,'0')}`,total,...(latest?current:{running,idle:total-running-charging-maintenance-offline,charging,maintenance,offline})};
 });
}
function FieldMeter({data,filter,onFilter,onSelect}){
 const[mode,setMode]=useState('status'),[hover,setHover]=useState(null),[tip,setTip]=useState(null);
 const groups=mode==='status'?Object.entries(statusMeta).map(([key,m])=>({key,...m,test:v=>v.status===key})):socGroups;
 const focused=hover||filter,groupFor=v=>groups.find(g=>g.test(v));
 const sorted=[...data.vehicles].sort((a,b)=>groups.indexOf(groupFor(a))-groups.indexOf(groupFor(b))||a.id.localeCompare(b.id));
 function chooseMode(value){setMode(value);setHover(null);setTip(null)}
 return h('section',{className:'field-meter'},
  h('div',{className:'section-heading'},h('h2',null,'车队概况'),h('div',{className:'segmented',role:'group','aria-label':'点阵模式'},['status','soc'].map(value=>h('button',{key:value,'aria-pressed':mode===value,onClick:()=>chooseMode(value),className:mode===value?'active':''},value==='status'?'状态':'电量')))),
  h('div',{className:'field-numbers'},h('button',{className:'field-total',onClick:()=>onFilter('all'),'aria-label':'显示全部50辆车'},h('strong',null,data.vehicles.length),h('span',null,'辆')),h('span',{className:'online-number',title:'在线车辆 / 全部车辆；维护和充电车辆仍计入在线'},'在线率',h('strong',null,metrics(data).onlineRate,h('small',null,'%')))),
  h('div',{className:'vehicle-field',role:'group','aria-label':'50辆车点阵'},sorted.map(v=>{const g=groupFor(v),dim=focused!=='all'&&focused&&!matchesVehicle(v,focused);return h('button',{key:v.id,className:'vehicle-dot'+(dim?' dim':''),'data-vehicle':v.id,'data-category':g.key,style:{'--vehicle-color':g.color},'aria-label':`${v.id} ${statusMeta[v.status].label} 电量${Math.round(v.soc)}%`,onPointerEnter:()=>{setHover(g.key);setTip(`${v.id} · ${Math.round(v.soc)}%`)},onPointerLeave:()=>{setHover(null);setTip(null)},onFocus:()=>{setHover(g.key);setTip(`${v.id} · ${Math.round(v.soc)}%`)},onBlur:()=>{setHover(null);setTip(null)},onClick:()=>onSelect({kind:'vehicle',id:v.id})},h('span'))})),
  h('div',{className:'field-context','aria-live':'polite'},hover?h('span',{role:'tooltip'},groups.find(g=>g.key===hover)?.label,' ',data.vehicles.filter(v=>matchesVehicle(v,hover)).length,' 辆',tip?' · '+tip:''):h('span',null,mode==='status'?'实时状态':'SOC'),filter!=='all'&&h('button',{className:'clear-filter',onClick:()=>onFilter('all'),'aria-label':'清除车辆筛选'},'清除筛选',h(X,{size:12}))),
  h('div',{className:'field-categories'},groups.map(g=>h('button',{key:g.key,className:filter===g.key?'selected':'','aria-pressed':filter===g.key,onPointerEnter:()=>setHover(g.key),onPointerLeave:()=>setHover(null),onFocus:()=>setHover(g.key),onBlur:()=>setHover(null),onClick:()=>onFilter(filter===g.key?'all':g.key),'aria-label':`筛选${g.label}`},h('i',{style:{background:g.color}}),h('span',null,g.label),h('strong',null,data.vehicles.filter(g.test).length)))));
}
function CapacityChart({period,data}){
 const rows=capacityHistory(period,data),[active,setActive]=useState(null);
 useEffect(()=>setActive(null),[period]);
 const kinds=Object.keys(statusMeta),W=900,H=190,left=36,right=12,top=12,bottom=30,plotH=H-top-bottom,slot=(W-left-right)/rows.length,barW=Math.min(43,slot*.68),total=data.vehicles.length;
 return h('div',{className:'capacity-chart','data-total':total},h('svg',{viewBox:`0 0 ${W} ${H}`,preserveAspectRatio:'none',role:'img','aria-label':'各时段运力构成'},
  [0,25,50].map(n=>h('g',{key:n},h('line',{x1:left,x2:W-right,y1:top+plotH*(1-n/total),y2:top+plotH*(1-n/total),stroke:'#292c33',strokeDasharray:'3 5'}),h('text',{x:left-8,y:top+plotH*(1-n/total)+4,textAnchor:'end',fill:'#7f8795',fontSize:10},n))),
  rows.map((row,i)=>{let y=top+plotH;const x=left+i*slot+(slot-barW)/2;return h('g',{key:row.label,className:'capacity-column'+(active===i?' active':''),role:'button',tabIndex:0,'aria-label':`${row.label} 共${row.total}辆 ${kinds.map(k=>statusMeta[k].label+row[k]).join(' ')}`,'data-total':row.total,onPointerEnter:()=>setActive(i),onPointerLeave:()=>setActive(null),onFocus:()=>setActive(i),onBlur:()=>setActive(null),onKeyDown:e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();setActive(current=>((current??i)+(e.key==='ArrowRight'?1:-1)+rows.length)%rows.length)}if(e.key==='Escape')setActive(null)}},
    h('rect',{x:x-5,y:top-4,width:barW+10,height:plotH+8,rx:5,fill:active===i?'#ffffff08':'transparent',stroke:active===i?'#ada5dc':'transparent',strokeWidth:1}),
    ...kinds.map(k=>{const height=row[k]/total*plotH;y-=height;return h('rect',{key:k,x,y:y+.8,width:barW,height:Math.max(1,height-1.6),rx:2,fill:statusMeta[k].color,opacity:active===null||active===i?1:.3})}),
    (rows.length<=12||i%4===0||i===rows.length-1)&&h('text',{x:x+barW/2,y:H-9,textAnchor:'middle',fill:'#7f8795',fontSize:10},row.label));})),
  active!==null&&h('div',{className:'capacity-tooltip',role:'tooltip',style:{left:`${Math.max(2,Math.min(73,active/(rows.length-1)*80))}%`}},h('strong',null,rows[active].label,h('small',null,' / ',rows[active].total,' 辆')),kinds.map(k=>h('span',{key:k},h('i',{style:{background:statusMeta[k].color}}),statusMeta[k].label,h('b',null,rows[active][k])))));
}
const parkingLayouts={S01:{rows:[6,6],skew:28,zone:'A / B'},S02:{rows:[4,4,4],skew:24,zone:'A / B / C'},S03:{rows:[6,6],skew:32,zone:'A / B'}};
function parkingGeometry(stationId){const layout=parkingLayouts[stationId];let index=0;return layout.rows.flatMap((count,row)=>Array.from({length:count},(_,col)=>({number:++index,x:92+col*76+(6-count)*38,y:90+row*194,skew:layout.skew,row})));}
function ParkingCanvas({data,stationId,selection,onSelect}){
 const host=useRef(null),gesture=useRef(null),ignoreClick=useRef(false);
 const[view,setView]=useState({x:0,y:0,scale:1}),[tip,setTip]=useState(null),[dragging,setDragging]=useState(false),[bayFilter,setBayFilter]=useState('all');
 const station=data.stations.find(s=>s.id===stationId),bays=data.bays.filter(b=>b.stationId===stationId),slots=parkingGeometry(stationId),three=parkingLayouts[stationId].rows.length===3;
 const canvasH=three?680:510,canvasW=680;
 const selected=selection?.kind==='bay'?bays.find(b=>b.id===selection.id):selection?.kind==='vehicle'?bays.find(b=>b.vehicleId===selection.id):undefined;
 useEffect(()=>{setView({x:0,y:0,scale:1});setTip(null);setBayFilter('all');gesture.current=null;setDragging(false)},[stationId]);
 const clamp=(next)=>{const limitX=110+(next.scale-1)*210,limitY=90+(next.scale-1)*180;return{...next,x:Math.max(-limitX,Math.min(limitX,next.x)),y:Math.max(-limitY,Math.min(limitY,next.y))}};
 function zoom(delta){setView(v=>clamp({...v,scale:Math.max(.85,Math.min(1.7,+(v.scale+delta).toFixed(2)))}));setTip(null)}
 function reset(){setView({x:0,y:0,scale:1});setTip(null)}
 function pointerDown(e){if(e.button!==0||e.target.closest('button'))return;gesture.current={id:e.pointerId,startX:e.clientX,startY:e.clientY,x:view.x,y:view.y,moved:false,bayId:e.target.closest('[data-bay]')?.getAttribute('data-bay')};ignoreClick.current=false;e.currentTarget.setPointerCapture(e.pointerId)}
 function pointerMove(e){const g=gesture.current;if(!g)return;const dx=e.clientX-g.startX,dy=e.clientY-g.startY;if(Math.hypot(dx,dy)>5){g.moved=true;setDragging(true);setTip(null)}if(g.moved)setView(v=>clamp({...v,x:g.x+dx/(host.current.clientWidth/canvasW),y:g.y+dy/(host.current.clientHeight/canvasH)}))}
 function pointerUp(e){const g=gesture.current;if(!g)return;ignoreClick.current=true;gesture.current=null;setDragging(false);if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);if(!g.moved){if(g.bayId)onSelect(selected?.id===g.bayId?null:{kind:'bay',id:g.bayId});else{onSelect(null);setTip(null)}}}
 function showTip(e,b){if(gesture.current?.moved)return;const r=host.current.getBoundingClientRect();setTip({bay:b,x:Math.max(8,Math.min(r.width-220,e.clientX-r.left+12)),y:Math.max(8,Math.min(r.height-100,e.clientY-r.top+10))})}
 function bayClick(e,b){e.stopPropagation();if(ignoreClick.current){ignoreClick.current=false;return}onSelect(selected?.id===b.id?null:{kind:'bay',id:b.id})}
 const color=b=>b.status==='charging'?'#a7a0db':b.status==='fault'?'#d78390':b.status==='occupied'?'#9ca9ba':b.status==='offline'?'#5d6571':'#638a78';
 function detail(b){const v=data.vehicles.find(v=>v.id===b.vehicleId);return{v,text:v?`${v.id} · ${Math.round(v.soc)}%`:'—',extra:b.status==='charging'?`${b.power} kW · ${b.remaining} 分钟` :bayMeta[b.status].label}}
 return h('section',{className:'parking-section'},
  h('div',{className:'section-heading'},h('h2',null,'充电车位'),h('span',{className:'layout-mark',title:'未提供站点平面图，当前车位排、通道与出入口为示意布局'},'布局示意')),
  h('div',{ref:host,className:'parking-viewport'+(dragging?' dragging':''),'data-view':JSON.stringify(view),'data-station':stationId,onPointerDown:pointerDown,onPointerMove:pointerMove,onPointerUp:pointerUp,onPointerCancel:e=>{gesture.current=null;ignoreClick.current=true;setDragging(false)},onClick:e=>{if(ignoreClick.current){ignoreClick.current=false;return}if(!e.target.closest('[data-bay]')){onSelect(null);setTip(null)}}},
   h('svg',{className:'parking-svg',viewBox:`0 0 ${canvasW} ${canvasH}`,role:'group','aria-label':station.name+'停车场画布',onKeyDown:e=>{if(e.key==='Escape'){onSelect(null);setTip(null)}},'data-layout':'schematic'},
    h('defs',null,h('pattern',{id:'parking-hatch',width:7,height:7,patternUnits:'userSpaceOnUse',patternTransform:'rotate(35)'},h('line',{x1:0,x2:0,y1:0,y2:7,stroke:'#4e5663',strokeWidth:2}))),
    h('g',{transform:`translate(${canvasW/2+view.x} ${canvasH/2+view.y}) scale(${view.scale}) translate(${-canvasW/2} ${-canvasH/2})`},
     h('rect',{x:34,y:32,width:612,height:canvasH-64,rx:15,fill:'#161a1e',stroke:'#2a3137',strokeWidth:1}),
     ...parkingLayouts[stationId].rows.map((n,row)=>h('g',{key:'lane'+row},h('text',{x:56,y:108+row*194,fill:'#5c6672',fontSize:14},String.fromCharCode(65+row)),h('path',{d:`M 62 ${236+row*194} H 606`,stroke:'#333b43',strokeWidth:1,strokeDasharray:'8 10'}),h('path',{d:`M 300 ${230+row*194} l 12 6 -12 6 M 280 ${236+row*194} h32`,fill:'none',stroke:'#6a747e',strokeWidth:2}))),
     h('text',{x:52,y:canvasH-49,fill:'#788d83',fontSize:12},'入口'),h('path',{d:`M 92 ${canvasH-54} h28 l-7 -5 m7 5 -7 5`,fill:'none',stroke:'#788d83',strokeWidth:1.5}),
     h('text',{x:570,y:canvasH-49,fill:'#788d83',fontSize:12},'出口'),h('path',{d:`M 535 ${canvasH-54} h25 l-7 -5 m7 5 -7 5`,fill:'none',stroke:'#788d83',strokeWidth:1.5}),
     ...slots.map(slot=>{const b=bays.find(b=>b.number===slot.number),active=selected?.id===b.id,c=color(b),isDim=bayFilter!=='all'&&bayFilter!==b.status;return h('g',{key:b.id,'data-bay':b.id,role:'button',tabIndex:0,'aria-label':`${station.short} ${b.number}号车位 ${bayMeta[b.status].label}`,'aria-pressed':active,className:'parking-bay'+(active?' selected':'')+(isDim?' dim':''),transform:`translate(${slot.x} ${slot.y})`,onPointerEnter:e=>showTip(e,b),onPointerLeave:()=>setTip(null),onFocus:()=>setTip({bay:b,x:12,y:12}),onBlur:()=>setTip(null),onClick:e=>bayClick(e,b),onKeyDown:e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(active?null:{kind:'bay',id:b.id})}}},
      h('path',{className:'bay-shape',d:`M 0 112 L ${slot.skew} 0 L ${slot.skew+74} 0 L 74 112 Z`,fill:b.status==='charging'?'#9b91cf15':b.status==='fault'?'#d783900c':b.status==='offline'?'url(#parking-hatch)':'transparent',stroke:active?'#d3c9ff':c,strokeWidth:active?2.7:1.5,strokeDasharray:b.status==='offline'?'5 5':undefined}),
      b.status==='charging'?h('path',{d:`M ${slot.skew+27} 32 l-16 24 h16 l-9 25 25-32 h-17 l9-17`,fill:'none',stroke:c,strokeWidth:2.5,strokeLinejoin:'round'}):b.status==='occupied'?h('g',{transform:`translate(${slot.skew+7} 31) rotate(14 18 26)`,stroke:c,strokeWidth:1.8,fill:'#96a5b411'},h('rect',{x:5,y:0,width:24,height:49,rx:7}),h('path',{d:'M 7 12 h20 M 7 36 h20 M 9 17 h16 v15 H9Z',fill:'none'})):b.status==='fault'?h('g',{transform:`translate(${slot.skew+6} 36)`,fill:'none',stroke:c,strokeWidth:2},h('path',{d:'M 21 0 L 41 35 H1 Z',strokeLinejoin:'round'}),h('path',{d:'M21 11v12 M21 28v1'})):b.status==='offline'?h('path',{d:`M ${slot.skew+8} 54 h30`,stroke:c,strokeWidth:2}):null,
      null);
     })
    )),
   h('div',{className:'parking-controls'},h('button',{'aria-label':'放大停车场',onClick:()=>zoom(.15)},h(Plus,{size:15})),h('span',null,Math.round(view.scale*100),'%'),h('button',{'aria-label':'缩小停车场',onClick:()=>zoom(-.15)},h(Minus,{size:15})),h('button',{'aria-label':'重置停车场视图',onClick:reset},h(LocateFixed,{size:15}))),
   tip&&!dragging&&h('div',{className:'parking-tooltip',role:'tooltip',style:{left:tip.x,top:tip.y}},h('strong',null,String(tip.bay.number).padStart(2,'0'),'号 · ',bayMeta[tip.bay.status].label),h('span',null,detail(tip.bay).text),h('small',null,detail(tip.bay).extra))),
  h('div',{className:'parking-legend',role:'group','aria-label':'车位状态筛选'},Object.entries(bayMeta).map(([k,m])=>h('button',{key:k,'aria-pressed':bayFilter===k,className:bayFilter===k?'active':'',onClick:()=>setBayFilter(bayFilter===k?'all':k)},h('i',{className:'load-'+k}),m.label))),
  h('div',{className:'parking-selection','aria-live':'polite'},selected?h(React.Fragment,null,h('strong',null,String(selected.number).padStart(2,'0'),'号位'),h('span',null,detail(selected).text),h('span',null,detail(selected).extra),h('button',{'aria-label':'取消车位选择',onClick:()=>onSelect(null)},h(X,{size:13}))):h(React.Fragment,null,h('span',null,station.name),h('span',null,bays.filter(b=>b.status==='free').length,' 空闲 / ',bays.length))));
}
function TodaySummary({data,onRefresh,refreshedAt}){
 const[pull,setPull]=useState(0),[refreshing,setRefreshing]=useState(false),[fresh,setFresh]=useState(false),drag=useRef(null),distance=useRef(0),timer=useRef(null);
 const d=daily(data),m=metrics(data),cmp=comparison(data),hist=history('today').slice(0,11);
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 function refresh(){if(refreshing)return;setRefreshing(true);onRefresh();setFresh(true);timer.current=setTimeout(()=>{setRefreshing(false);setFresh(false)},450)}
 return h('section',{className:'today-summary'+(fresh?' refreshed':''),'data-refresh-time':refreshedAt.toISOString(),onPointerDown:e=>{if(e.button!==0||e.target.closest('button'))return;drag.current={x:e.clientX,y:e.clientY};distance.current=0;e.currentTarget.setPointerCapture(e.pointerId)},onPointerMove:e=>{if(!drag.current)return;const dx=e.clientX-drag.current.x,dy=e.clientY-drag.current.y;distance.current=Math.abs(dx)>Math.abs(dy)?0:Math.max(0,Math.min(92,dy));setPull(distance.current)},onPointerUp:e=>{if(!drag.current)return;const should=distance.current>=64;drag.current=null;distance.current=0;setPull(0);if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);if(should)refresh()},onPointerCancel:()=>{drag.current=null;distance.current=0;setPull(0)}},
  h('div',{className:'section-heading'},h('h2',null,'今日运营'),h('button',{className:'summary-refresh'+(refreshing?' refreshing':''),'aria-label':'刷新今日运营',title:'刷新订单、里程、利用率及同步时间',disabled:refreshing,onClick:refresh},h(Radio,{size:14}),h('span',null,'刷新'))),
  h('div',{className:'pull-indicator','aria-hidden':true,style:{opacity:pull?1:0,transform:`translateY(${Math.min(16,pull*.2)}px) rotate(${pull*2}deg)`}},h(ArrowDownRight,{size:15})),
  [{label:'累计订单',value:number(d.orders),unit:'单',delta:`+${cmp.orders.toFixed(1)}%`,values:hist.map((p,i)=>i===hist.length-1?d.orders:hist.slice(0,i+1).reduce((a,b)=>a+b.orders,0)),color:'#9c9be5'},
   {label:'运营里程',value:number(d.distance),unit:'km',delta:`+${cmp.distance.toFixed(1)}%`,values:hist.map((p,i)=>i===hist.length-1?d.distance:hist.slice(0,i+1).reduce((a,b)=>a+b.distance,0)),color:'#818d9f'},
   {label:'车辆利用率',value:m.utilization.toFixed(1),unit:'%',delta:`+${cmp.utilization.toFixed(1)}pp`,values:hist.map((p,i)=>i===hist.length-1?m.utilization:p.utilization),color:'#79b99e'}].map(item=>h('div',{className:'today-metric',key:item.label},h('span',{className:'metric-label'},item.label),h('div',{className:'metric-body'},h('strong',null,item.value,h('small',null,item.unit)),h(Spark,{values:item.values,color:item.color})),h('span',{className:'delta',title:'较昨日同期 · 模拟数据'},h(ArrowUpRight,{size:12}),item.delta))),
  h('div',{className:'summary-updated'},h(Clock3,{size:11}),h('span',null,refreshedAt.toLocaleTimeString('zh-CN',{hour12:false})),pull>=64&&h('span',{className:'pull-ready'},'松开刷新')));
}
const number=n=>Math.round(n).toLocaleString('en-US');
function App(){
 const[data,setData]=useState(seed),[paused,setPaused]=useState(false),[now,setNow]=useState(new Date()),[updated,setUpdated]=useState(new Date()),[summaryTime,setSummaryTime]=useState(new Date());
 const[filter,setFilter]=useState('all'),[selection,setSelection]=useState(null),[stationId,setStationId]=useState('S01'),[period,setPeriod]=useState('today'),[chartMode,setChartMode]=useState('capacity'),[selectedMetrics,setSelectedMetrics]=useState(['orders','utilization']),[full,setFull]=useState(false),[notice,setNotice]=useState('');
 const m=metrics(data),station=data.stations.find(s=>s.id===stationId);
 useEffect(()=>{const id=setInterval(()=>setNow(new Date()),1000);const changed=()=>setFull(!!document.fullscreenElement);document.addEventListener('fullscreenchange',changed);return()=>{clearInterval(id);document.removeEventListener('fullscreenchange',changed)}},[]);
 useEffect(()=>{if(paused)return;const id=setInterval(()=>{setData(advance);setUpdated(new Date());setSummaryTime(new Date())},Math.max(1000,window.ROPO_CONFIG?.refreshMs||5000));return()=>clearInterval(id)},[paused]);
 useEffect(()=>{if(!notice)return;const id=setTimeout(()=>setNotice(''),3500);return()=>clearTimeout(id)},[notice]);
 function select(s){setSelection(s);if(s?.kind==='station')setStationId(s.id);if(s?.kind==='bay'){const b=data.bays.find(b=>b.id===s.id);if(b)setStationId(b.stationId)}if(s?.kind==='vehicle'){const v=data.vehicles.find(v=>v.id===s.id);if(v?.stationId)setStationId(v.stationId);if(v&&!matchesVehicle(v,filter))setFilter('all')}}
 function refreshSummary(){setData(s=>({...s,tick:s.tick+6}));setSummaryTime(new Date());setUpdated(new Date())}
 function metricToggle(k){setSelectedMetrics(prev=>prev.includes(k)?prev.length>1?prev.filter(x=>x!==k):prev:prev.length===2?[prev[0],k]:[...prev,k])}
 async function toggleFull(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{setNotice('当前浏览器不允许全屏，请使用 F11。')}}
 return h('div',{className:'dashboard revision-dashboard'},
 h('header',{className:'topbar'},h('a',{className:'brand',href:window.ROPO_CONFIG?.platformUrl||'https://abdd33.github.io/ropo-fleet-linear/#overview',title:'返回 ROPO Fleet 云平台'},h('span',{className:'brand-mark'},'Λ'),h('span',null,'ROPO Fleet',h('small',null,'运营指挥中心'))),h('span',{className:'header-divider'}),h('div',{className:'location'},h(MapPin,{size:15}),h('span',null,'上海',h('i',null,'/'),'张江运营区'),h('span',{className:'env'},'模拟环境')),h('div',{className:'header-end'},h('div',{className:'date-time'},h('span',null,now.toLocaleDateString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit'})),h('strong',null,now.toLocaleTimeString('zh-CN',{hour12:false}))),h('span',{className:'live-state'+(paused?' paused':'')},h('i'),paused?'已暂停':'模拟实时'),h('button',{className:'icon-button','aria-label':paused?'恢复实时刷新':'暂停实时刷新',onClick:()=>setPaused(p=>!p)},h(paused?Play:Pause,{size:16})),h('button',{className:'icon-button','aria-label':full?'退出全屏':'进入全屏',onClick:toggleFull},h(full?Minimize2:Maximize2,{size:17})))),
 h('main',{className:'main-grid'},
  h('aside',{className:'left-column'},h(FieldMeter,{data,filter,onFilter:setFilter,onSelect:select}),h(TodaySummary,{data,onRefresh:refreshSummary,refreshedAt:summaryTime}),h('div',{className:'left-foot'},h(Radio,{size:12}),h('span',null,paused?'已暂停':'5s'),h('span',null,updated.toLocaleTimeString('zh-CN',{hour12:false})))),
  h('div',{className:'center-column'},h(FleetMap,{data,filter,selection,onSelect:select}),h('section',{className:'trend-section'},h('div',{className:'section-heading'},h('div',{className:'chart-mode-tabs',role:'group','aria-label':'运营图表形态'},[{key:'capacity',label:'运力构成'},{key:'trend',label:'运营趋势'}].map(tab=>h('button',{key:tab.key,'aria-pressed':chartMode===tab.key,className:chartMode===tab.key?'active':'',onClick:()=>setChartMode(tab.key)},tab.label))),h('div',{className:'segmented',role:'group','aria-label':'趋势时间范围'},[{key:'today',label:'今日'},{key:'week',label:'近7天'},{key:'month',label:'近30天'}].map(p=>h('button',{key:p.key,'aria-pressed':period===p.key,className:period===p.key?'active':'',onClick:()=>setPeriod(p.key)},p.label)))),
   chartMode==='capacity'?h(React.Fragment,null,h('div',{className:'capacity-legend'},Object.entries(statusMeta).map(([k,value])=>h('span',{key:k},h('i',{style:{background:value.color}}),value.label))),h(CapacityChart,{period,data})):h(React.Fragment,null,h('div',{className:'trend-metrics',title:'最多同时展示两项指标'},Object.keys(metricMeta).map(k=>h('button',{key:k,'aria-pressed':selectedMetrics.includes(k),className:selectedMetrics.includes(k)?'active':'',onClick:()=>metricToggle(k)},h('i',{style:{background:selectedMetrics.includes(k)?selectedMetrics.indexOf(k)===0?'#a3a0e7':'#79b99e':'#494c55'}}),metricMeta[k].label))),h(TrendChart,{period,selected:selectedMetrics,tick:data.tick,utilization:m.utilization})))),
  h('aside',{className:'right-column'},h('section',{className:'charging-section'},h('div',{className:'section-heading'},h('h2',null,'充电资源'),h(Zap,{size:17,className:'muted'})),h('div',{className:'charge-kpis'},[{label:'站点',value:3,unit:'座'},{label:'充电',value:m.counts.charging,unit:'辆'},{label:'空闲车位',value:m.available,unit:'/ 36'}].map(item=>h('div',{key:item.label},h('span',null,item.label),h('strong',{className:item.label==='空闲车位'?'text-green':''},item.value,h('small',null,item.unit))))),h('div',{className:'power-line'},h('span',null,h('i',{className:'dot green'}),'总功率',h('strong',null,m.power,h('small',null,' kW'))),h('span',{title:'充电中的车位数 / 全部36个车位'},'桩利用率 ',h('b',null,m.chargerUtilization.toFixed(1),'%'))),h('div',{className:'station-list'},data.stations.map(s=>{const bs=data.bays.filter(b=>b.stationId===s.id);return h('button',{key:s.id,className:'station-row'+(stationId===s.id?' active':''),'aria-pressed':stationId===s.id,onClick:()=>select({kind:'station',id:s.id})},h('span',null,s.name),h('div',{className:'station-load'},bs.map(b=>h('i',{key:b.id,className:'load-'+b.status}))),h('b',null,bs.filter(b=>b.status==='charging'||b.status==='occupied').length,h('small',null,' / ',bs.length)),h(ChevronRight,{size:12}))}))),h(ParkingCanvas,{data,stationId,selection,onSelect:select}))),
 h('footer',{className:'footer'},h('span',null,h(Activity,{size:11}),'ROPO FLEET'),h('span',null,'模拟场景 · 10:20'),h('span',{className:'footer-status'},h('i',{className:'dot '+(paused?'yellow':'green')}),paused?'已暂停':'数据同步正常')),notice&&h('div',{className:'toast',role:'status'},notice));
}

createRoot(document.getElementById('root')).render(h(App));
}
