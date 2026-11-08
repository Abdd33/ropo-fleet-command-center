# ROPO Fleet 运营指挥中心 · CDN 双击版

**此版本需要联网加载 CDN。解压后直接双击根目录 `index.html`，使用 Chrome 或 Edge 打开。无需安装环境、无需构建、无需本地服务器。**

请先将压缩包完整解压，再打开 HTML；不要在压缩软件的预览窗口内运行。

## 保留的界面与功能

沿用上一版页面结构、配色、CSS、模拟数据与 React 组件；本次仅改变依赖和文件加载方式。

- 三栏运营概况、MapLibre 地图、ECharts 趋势、充电站与车位矩阵、异常事件。
- 车辆筛选、图层开关、缩放与复位、车辆提示和选择、站点/车位/异常定位。
- 今日/近7天/近30天趋势切换及最多两项指标切换。
- 车位 Hover 与键盘聚焦提示、车位状态筛选。
- 暂停/恢复模拟更新、实时日期时钟、全屏/退出全屏。
- 原有1920×1080、1366×768、2560×1440响应式样式。

全屏需要由用户点击按钮触发。如果浏览器策略拒绝请求，页面会给出F11提示。

## 文件和加载方式

`index.html` 已内嵌全部业务 JavaScript、模拟数据、示意地图数据与页面CSS；它本身即可运行，不会读取本地JSON、图片、字体或JavaScript模块。`source/` 仅是便于查看的普通JavaScript和CSS副本，不是入口的运行依赖；实际入口代码位于HTML内。

依赖使用固定版本的普通CDN脚本：

| 依赖 | 版本 |
|---|---|
| React / ReactDOM | 18.3.1 UMD |
| MapLibre GL JS / CSS | 5.14.0 浏览器分发版 |
| ECharts | 6.0.0 |
| Lucide React | 0.468.0 UMD |

主CDN为jsDelivr，失败时尝试UNPKG。为支持普通script和file协议，React与MapLibre采用提供完整浏览器分发文件的版本；业务组件与视觉保持不变。TS/TSX已预先转为普通JavaScript，没有浏览器运行时TS编译器，也没有任何编译命令需要执行。

MapLibre使用浏览器分发版内部的Blob Worker，不加载本地 `.mjs` Worker。底图仍是内嵌GeoJSON矢量示意图，不依赖地图Key，不声称真实在线地图或导航精度。若地图引擎或WebGL不可用，显示已有SVG示意图降级。

首次打开请等待CDN加载完成。若网络无法连接两个CDN，页面会显示加载失败与“重新加载”按钮；保持联网后重试即可。

## 验证范围

已检查所有内嵌脚本能按普通JavaScript解析，确认无本地ES Module import、require、本地Worker路径和本地fetch。已实际下载固定CDN文件，验证React、ReactDOM、Lucide、ECharts、MapLibre均暴露所需浏览器全局API。页面CSS与上一版逐字一致。

**直接双击运行的浏览器实测尚未完成：自动化浏览器的URL安全策略只允许http/https，拒绝file协议，并禁止绕过。这里没有把服务器验证冒充本地文件验证。请在本机直接双击 `index.html` 确认运行结果。**

检查记录见 `verification/static-checks.json`。上一版浏览器交互验收不能替代此版本的file协议实测。
