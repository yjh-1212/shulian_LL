import type { EChartsOption } from 'echarts';

export type GrainChartKind = 'treemap' | 'heatmap' | 'scatter' | 'waterfall' | 'dumbbell';

/** Annual published statistics. Output: 万吨; area: 万公顷. Missing values remain null. */
export interface GrainChartRow {
  id: string;
  name: string;
  output: number | null;
  area?: number | null;
  previous?: number | null;
  year?: number;
  previousYear?: number;
  color?: string;
  grains?: { name: string; value: number | null; estimated?:boolean; method?:string }[];
}

export interface GrainChartConfig {
  theme?: 'light' | 'dark';
  text: string;
  muted: string;
  primary: string;
  accent: string;
  flow?: boolean;
  chartGrid?: boolean;
  fontSize?: number;
  fontFamily?: string;
}

type Datum = Record<string, any>;
const valid = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const format = (value: unknown, digits = 1) => valid(value)
  ? value.toLocaleString('zh-CN', { maximumFractionDigits: digits }) : '未公布';
const escape = (value: unknown) => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));
const alpha = (color: string, opacity: number) => /^#[\da-f]{6}$/i.test(color)
  ? `rgba(${parseInt(color.slice(1, 3), 16)},${parseInt(color.slice(3, 5), 16)},${parseInt(color.slice(5, 7), 16)},${opacity})` : color;
const rate = (row: GrainChartRow) => valid(row.output) && valid(row.previous) && row.previous > 0
  ? (row.output / row.previous - 1) * 100 : null;

export function grainRowDescription(row: GrainChartRow) {
  const details = [`${row.name}：${row.year ?? '统计期'}产量${format(row.output)}万吨`];
  if (valid(row.area)) details.push(`播种面积${format(row.area)}万公顷`);
  if (valid(row.previous)) details.push(`${row.previousYear ?? '上年'}产量${format(row.previous)}万吨`);
  return details.join('，');
}

/** Five forms encode five different questions; none substitute zero for unpublished data. */
export function createGrainChartOption(
  kind: GrainChartKind,
  rows: GrainChartRow[],
  config: GrainChartConfig,
  selected = '',
  reducedMotion = false,
): EChartsOption {
  const dark = config.theme === 'dark';
  const palette = dark
    ? [config.primary, '#39b4ff', '#9cbbff', config.accent, '#4dd3c2', '#b2a3ff', '#84b8b9']
    : [config.accent, '#4e9c93', '#9e815c', '#de964e', '#77a5ad', '#b9a664', '#a98d7e'];
  const color = (row: GrainChartRow, index: number) => (!dark&&row.color) || palette[index % palette.length];
  const opacity = (id: string) => !selected || selected === id ? 1 : 0.65;
  const fontSize = Math.max(10, Math.min(13, (config.fontSize ?? 13) - 1));
  const common: Datum = {
    backgroundColor: 'transparent',
    color: palette,
    animation: config.flow !== false && !reducedMotion,
    animationDuration: 650,
    animationDurationUpdate: 300,
    textStyle: { color: config.text, fontSize, fontFamily: config.fontFamily || 'Microsoft YaHei, PingFang SC, sans-serif' },
    aria: { enabled: true, decal: { show: false } },
    tooltip: {
      confine: true,
      trigger: 'item',
      backgroundColor: dark ? 'rgba(17,29,42,.97)' : 'rgba(255,253,248,.97)',
      borderColor: alpha(config.primary, 0.35),
      borderWidth: 1,
      padding: [9, 12],
      textStyle: { color: config.text, fontSize: 12, lineHeight: 21 },
      extraCssText: 'box-shadow:0 8px 24px rgba(36,34,20,.12);max-width:320px;',
      formatter: (params: Datum) => {
        const row: GrainChartRow | undefined = params.data?.row;
        if (!row) return escape(params.name ?? '');
        const change = rate(row);
        return `<b>${escape(row.name)}</b><br>${escape(row.year ?? '统计期')}产量　${format(row.output)} 万吨`
          + (valid(row.area) ? `<br>播种面积　${format(row.area)} 万公顷` : '')
          + (valid(row.output) && valid(row.area) && row.area > 0 ? `<br>单位面积产量　${format(row.output / row.area * 1000, 0)} 公斤/公顷` : '')
          + (valid(row.previous) ? `<br>${escape(row.previousYear ?? '上年')}产量　${format(row.previous)} 万吨` : '')
          + (valid(change) ? `<br>同比　${change >= 0 ? '+' : ''}${format(change)}%` : '');
      },
    },
  };
  const axis = {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: config.muted, fontSize, margin: 8 },
    nameTextStyle: { color: config.muted, fontSize: fontSize - 1, padding: [0, 0, 0, 2] },
    splitLine: { show: config.chartGrid !== false, lineStyle: { color: alpha(config.muted, 0.16), type: 'dashed' } },
  };
  const noData = (text: string) => ({
    ...common,
    graphic: [{ type: 'text', left: 'center', top: 'middle', style: { text, fill: config.muted, fontSize: 13, textAlign: 'center', lineHeight: 24 } }],
    series: [],
  } as EChartsOption);

  if (kind === 'treemap') {
    const values = rows.filter(row => valid(row.output) && row.output > 0);
    if (!values.length) return noData('该范围暂无已公布的产量数据');
    const total = values.reduce((sum, row) => sum + row.output!, 0);
    return {
      ...common,
      series: [{
        type: 'treemap', left: 1, right: 1, top: 1, bottom: 1,
        animation: common.animation, animationDuration: common.animationDuration, animationDurationUpdate: common.animationDurationUpdate,
        roam: false, nodeClick: false, breadcrumb: { show: false },
        sort: 'desc', squareRatio: 1.15, visibleMin: 0,
        itemStyle: { borderColor: alpha(config.primary, .14), borderWidth: 2, gapWidth: 4 },
        label: {
          show: true, color: config.text, padding: 2,
          formatter: (params: Datum) => Number(params.value) / total < .06
            ? `{smallName|${params.name.length === 4 ? `${params.name.slice(0, 2)}\n${params.name.slice(2)}` : params.name}}`
            : Number(params.value) / total < .1
            ? `{smallName|${params.name.length === 4 ? `${params.name.slice(0, 2)}\n${params.name.slice(2)}` : params.name}}\n{smallValue|${format(params.value, 0)}}`
            : Number(params.value) / total < .2
            ? `{smallName|${params.name}}\n{smallValue|${Math.round(Number(params.value))}}`
            : `{name|${params.name}}\n{value|${format(params.value)}}{unit| 万吨}\n{share|占比 ${format(Number(params.value) / total * 100)}%}`,
          rich: {
            name: { fontSize: fontSize + 1, fontWeight: 500, color: config.text, lineHeight: 24 },
            value: { fontSize: fontSize + 4, fontWeight: 700, color: config.text, lineHeight: 25 },
            unit: { fontSize: fontSize - 1, color: config.muted },
            share: { fontSize: fontSize - 1, lineHeight: 22, color: config.muted },
            smallName: { fontSize: 10, lineHeight: 16, color: config.text },
            smallValue: { fontSize: fontSize + 2, lineHeight: 18, fontWeight: 600, color: config.text },
          },
        },
        emphasis: { itemStyle: { borderColor: config.primary, borderWidth: 2 }, focus: 'self' },
        data: values.map((row, index) => ({
          id: row.id, name: row.name, value: row.output, row,
          itemStyle: { color: alpha(color(row, index), dark ? .40 : .25), opacity: opacity(row.id), borderColor: selected === row.id ? config.primary : alpha(color(row, index), .5) },
        })),
      }],
    } as EChartsOption;
  }

  if (kind === 'heatmap') {
    const crops = [...new Set(rows.flatMap(row => row.grains?.map(grain => grain.name) ?? []))];
    if (!crops.length || !rows.length) return noData('该范围暂无分品种统计\n未公布的项目保留缺口');
    const known: Datum[] = [], missing: Datum[] = [];
    rows.forEach((row, rowIndex) => crops.forEach((crop, cropIndex) => {
      const grain = row.grains?.find(grain => grain.name === crop),value=grain?.value;
      const datum = { id: row.id, row, crop, estimated:grain?.estimated, method:grain?.method, name: `${row.name} · ${crop}`, value: [cropIndex, rowIndex, value], itemStyle: { opacity: opacity(row.id) } };
      if (valid(value)) known.push(datum);
      else missing.push({ ...datum, value: [cropIndex, rowIndex] });
    }));
    const maximum = Math.max(...known.map(item => item.value[2]), 1);
    return {
      ...common,
      grid: { top: 23, bottom: 35, left: 62, right: 5 },
      xAxis: { ...axis, type: 'category', position: 'top', data: crops, splitArea: { show: false }, splitLine: { show: false }, axisLabel: { ...axis.axisLabel, margin: 9 } },
      yAxis: { ...axis, type: 'category', inverse: true, data: rows.map(row => row.name), splitLine: { show: false }, axisLabel: { ...axis.axisLabel, fontSize: fontSize - 1 } },
      visualMap: {
        min: 0, max: maximum, type: 'continuous', calculable: false, orient: 'horizontal', left: 'center', bottom: 0,
        itemWidth: 8, itemHeight: 100, text: ['高（万吨）', '低'], textGap: 7,
        inRange: { color: dark ? [alpha(config.primary, 0.15), config.primary, '#bcd1ff'] : ['#f6ebd6', '#d4ad69', '#9f7036'] },
        textStyle: { color: config.muted, fontSize: 10 }, seriesIndex: 0,
      },
      tooltip: {
        ...common.tooltip,
        formatter: (params: Datum) => `<b>${escape(params.data.row.name)} · ${escape(params.data.crop)}</b><br>${valid(params.data.value[2]) ? `${params.data.estimated?'≈ ':''}${format(params.data.value[2])} 万吨${params.data.estimated?'（估算）':''}` : '该项未公布'}${params.data.method?`<div style="white-space:normal;max-width:270px">${escape(params.data.method)}</div>`:''}`,
      },
      series: [
        {
          type: 'heatmap', data: known,
          itemStyle: { borderWidth: 3, borderColor: dark ? '#15232c' : '#faf7ed', borderRadius: 3 },
          label: { show: true, color: config.text, fontSize: fontSize - 1, formatter: (params: Datum) => `${params.data.estimated?'≈':''}${format(params.value[2],params.value[2]<100?1:0)}` },
          emphasis: { itemStyle: { borderWidth: 2, borderColor: config.primary } },
        },
        {
          type: 'custom', data: missing, encode: { x: 0, y: 1 },
          renderItem: (_params: unknown, api: any) => {
            const point = api.coord([api.value(0), api.value(1)]), size = api.size([1, 1]);
            return { type: 'group', children: [
              { type: 'rect', shape: { x: point[0] - size[0] / 2 + 2, y: point[1] - size[1] / 2 + 2, width: Math.max(0, size[0] - 4), height: Math.max(0, size[1] - 4), r: 3 }, style: { fill: alpha(config.muted, .07), stroke: alpha(config.muted, .18), lineWidth: 1, lineDash: [3, 2] } },
              { type: 'text', style: { x: point[0], y: point[1], text: '未公布', fill: config.muted, fontSize: fontSize - 2, textAlign: 'center', textVerticalAlign: 'middle' } },
            ] };
          },
        },
      ],
    } as EChartsOption;
  }

  if (kind === 'scatter') {
    const values = rows.filter(row => valid(row.area) && row.area > 0 && valid(row.output));
    if (!values.length) return noData('暂无同口径的播种面积与产量数据');
    const yields = values.map(row => row.output! / row.area! * 1000);
    const minYield = Math.min(...yields), maxYield = Math.max(...yields);
    return {
      ...common,
      grid: { top: 29, bottom: 42, left: 50, right: 21 },
      xAxis: { ...axis, type: 'value', name: '播种面积（万公顷）', nameLocation: 'middle', nameGap: 28, min: 0, splitNumber: 4, axisLabel: { ...axis.axisLabel, formatter: (value: number) => format(value, 0) } },
      yAxis: { ...axis, type: 'value', name: '产量（万吨）', nameLocation: 'end', nameGap: 13, splitNumber: 3, axisLabel: { ...axis.axisLabel, formatter: (value: number) => value >= 1000 ? `${format(value / 1000)}k` : format(value, 0) } },
      series: [{
        type: 'scatter',
        symbolSize: (value: number[]) => 21 + (maxYield > minYield ? (value[2] - minYield) / (maxYield - minYield) * 22 : 12),
        label: { show: true, position: 'top', distance: 5, formatter: '{b}', color: config.text, fontSize: fontSize - 1 },
        labelLayout: { hideOverlap: true },
        data: values.map((row, index) => ({ id: row.id, name: row.name, row, value: [row.area, row.output, row.output! / row.area! * 1000], itemStyle: { color: alpha(color(row, index), .5), borderColor: color(row, index), borderWidth: selected === row.id ? 3 : 1.5, opacity: opacity(row.id), shadowColor: alpha(color(row, index), .14), shadowBlur: 8 } })),
        emphasis: { scale: 1.13, focus: 'self' },
      }],
      graphic: [{ type: 'text', right: 4, top: 0, style: { text: '气泡大小：单产', fill: config.muted, fontSize: 10 } }],
    } as EChartsOption;
  }

  if (kind === 'waterfall') {
    const values = rows.filter(row => valid(row.output) && valid(row.previous));
    if (!values.length) return noData('暂无同口径上年产量\n公布后显示增产贡献');
    let accumulated = 0;
    const stages = values.map(row => {
      const delta = row.output! - row.previous!, start = accumulated;
      accumulated += delta;
      return { row, delta, start, end: accumulated };
    });
    const maxAbsolute = Math.max(...stages.flatMap(stage => [Math.abs(stage.start), Math.abs(stage.end)]), 1);
    const extentStep = 10 ** Math.floor(Math.log10(maxAbsolute));
    const minimum = Math.floor((Math.min(0, ...stages.map(stage => Math.min(stage.start, stage.end))) - (accumulated < 0 ? maxAbsolute * .12 : 0)) / extentStep) * extentStep;
    const maximum = Math.ceil((Math.max(0, ...stages.map(stage => Math.max(stage.start, stage.end))) + maxAbsolute * .2) / extentStep) * extentStep;
    return {
      ...common,
      grid: { top: 26, bottom: 35, left: 37, right: 10 },
      xAxis: { ...axis, type: 'category', data: values.map(row => row.name), splitLine: { show: false }, axisLabel: { ...axis.axisLabel, interval: 0, fontSize: fontSize - 2, formatter: (value: string) => value.length > 3 ? `${value.slice(0, 2)}\n${value.slice(2)}` : value } },
      yAxis: { ...axis, type: 'value', name: '增减产（万吨）', nameGap: 10, splitNumber: 3, min: minimum, max: maximum, axisLabel: { ...axis.axisLabel, formatter: (value: number) => format(value, 0) } },
      tooltip: { ...common.tooltip, formatter: (params: Datum) => `<b>${escape(params.data.row.name)}</b><br>较${escape(params.data.row.previousYear ?? '上年')}增减产　${params.data.delta >= 0 ? '+' : ''}${format(params.data.delta)} 万吨<br>两期均为已公布产量` },
      series: [{
        type: 'custom', encode: { x: 0, y: [1, 2] },
        data: stages.map((stage, index) => ({ id: stage.row.id, name: stage.row.name, row: stage.row, delta: stage.delta, value: [index, stage.start, stage.end] })),
        renderItem: (params: any, api: any) => {
          const stage = stages[params.dataIndex], start = api.coord([api.value(0), api.value(1)]), end = api.coord([api.value(0), api.value(2)]);
          const width = Math.min(api.size([1, 0])[0] * .58, 42), positive = stage.delta >= 0, fill = positive ? config.primary : config.accent;
          return { type: 'group', children: [
            { type: 'rect', shape: { x: start[0] - width / 2, y: Math.min(start[1], end[1]), width, height: Math.max(2, Math.abs(end[1] - start[1])), r: [3, 3, 0, 0] }, style: { fill: alpha(fill, .72), stroke: fill, lineWidth: selected === stage.row.id ? 2 : 1, opacity: opacity(stage.row.id) } },
            { type: 'text', style: { x: end[0], y: positive ? Math.min(start[1], end[1]) - 9 : Math.max(start[1], end[1]) + 12, text: `${positive ? '+' : ''}${format(stage.delta, 0)}`, fill: config.text, fontSize: fontSize - 2, textAlign: 'center', textVerticalAlign: 'middle', opacity: opacity(stage.row.id) } },
            ...(params.dataIndex < stages.length - 1 ? [{ type: 'line', shape: { x1: end[0] + width / 2, y1: end[1], x2: end[0] + api.size([1, 0])[0] - width / 2, y2: end[1] }, style: { stroke: alpha(config.muted, .4), lineWidth: 1, lineDash: [3, 3] }, silent: true }] : []),
          ] };
        },
      }],
      graphic: [{ type: 'text', right: 2, top: 0, style: { text: `合计 ${accumulated >= 0 ? '+' : ''}${format(accumulated)} 万吨`, fill: config.primary, fontSize: 11, fontWeight: 600 } }],
    } as EChartsOption;
  }

  const values = rows.filter(row => valid(row.output) && valid(row.previous) && row.previous > 0);
  if (!values.length) return noData('暂无可比较的两期产量数据');
  const currentYear = values.find(row => row.year)?.year ?? '本年', priorYear = values.find(row => row.previousYear)?.previousYear ?? '上年';
  const indices = values.map(row => row.output! / row.previous! * 100);
  const indexMin = Math.floor(Math.min(100, ...indices) - .8), indexMax = Math.ceil(Math.max(100, ...indices) + .8);
  return {
    ...common,
    grid: { top: 21, bottom: 36, left: 65, right: 48 },
    legend: { data: [String(priorYear), String(currentYear)], bottom: 0, left: 'center', itemWidth: 9, itemHeight: 9, textStyle: { color: config.muted, fontSize: 10 }, selectedMode: false },
    xAxis: { ...axis, type: 'value', min: indexMin, max: indexMax, splitNumber: 3, axisLabel: { ...axis.axisLabel, fontSize: fontSize - 1, formatter: (value: number) => format(value) } },
    yAxis: { ...axis, type: 'category', inverse: true, data: values.map(row => row.name), splitLine: { show: false }, axisLabel: { ...axis.axisLabel, fontSize: fontSize - 1 } },
    series: [
      {
        type: 'custom', silent: true, encode: { x: [1, 2], y: 0 }, data: values.map((row, index) => [index, 100, indices[index]]),
        renderItem: (params: any, api: any) => {
          const start = api.coord([api.value(1), api.value(0)]), end = api.coord([api.value(2), api.value(0)]), row = values[params.dataIndex];
          return { type: 'line', shape: { x1: start[0], y1: start[1], x2: end[0], y2: end[1] }, style: { stroke: config.primary, lineWidth: selected === row.id ? 5 : 3, opacity: opacity(row.id) * .42 } };
        },
      },
      { type: 'scatter', name: String(priorYear), symbol: 'circle', symbolSize: 9, itemStyle: { color: dark ? '#203239' : '#fffcf3', borderColor: config.muted, borderWidth: 1.5 }, data: values.map((row, index) => ({ id: row.id, name: row.name, row, value: [100, index], itemStyle: { opacity: opacity(row.id) } })) },
      { type: 'scatter', name: String(currentYear), symbolSize: 12, itemStyle: { color: config.primary }, label: { show: true, position: 'right', distance: 7, color: config.text, fontSize: fontSize - 1, formatter: (params: Datum) => { const change = rate(params.data.row); return `${change! >= 0 ? '+' : ''}${format(change)}%`; } }, data: values.map((row, index) => ({ id: row.id, name: row.name, row, value: [indices[index], index], itemStyle: { opacity: opacity(row.id), borderColor: selected === row.id ? config.accent : config.primary, borderWidth: selected === row.id ? 2 : 0 } })) },
    ],
    graphic: [{ type: 'text', right: 1, top: 0, style: { text: '产量指数 · 上年=100', fill: config.muted, fontSize: 10 } }],
  } as EChartsOption;
}
