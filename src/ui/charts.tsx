import React from 'react';
import { View } from 'react-native';
import Svg, { Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { colors } from './theme';
import { T } from './components';

/** Histogramme simple (une barre par jour) avec ligne d'objectif facultative. */
export function BarChart({ data, height = 120, goal, color = colors.green }: { data: Array<{ label: string; value: number }>; height?: number; goal?: number; color?: string }) {
  const W = 320, pad = 4;
  const max = Math.max(1, goal ?? 0, ...data.map((d) => d.value));
  const bw = data.length ? Math.max(2, (W - pad * 2) / data.length - 3) : 0;
  return (
    <View>
      <Svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none">
        {goal ? <Line x1={0} x2={W} y1={height - (goal / max) * (height - 16)} y2={height - (goal / max) * (height - 16)} stroke={colors.beige} strokeDasharray="4 4" strokeWidth={1} /> : null}
        {data.map((d, i) => {
          const h = (d.value / max) * (height - 16);
          return <Rect key={i} x={pad + i * ((W - pad * 2) / data.length)} y={height - h} width={bw} height={Math.max(1, h)} rx={3} fill={color} opacity={d.value > 0 ? 1 : 0.25} />;
        })}
      </Svg>
      {data.length > 1 ? <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><T v="caption" style={{ fontSize: 10 }}>{data[0].label}</T><T v="caption" style={{ fontSize: 10 }}>{data[data.length - 1].label}</T></View> : null}
    </View>
  );
}

/** Courbe 0-100 (notes) ; les jours sans donnée (null) interrompent la ligne. */
export function LineChart({ data, height = 110, color = colors.greenSoft }: { data: Array<number | null>; height?: number; color?: string }) {
  const W = 320;
  const pts: string[][] = []; let cur: string[] = [];
  data.forEach((v, i) => {
    if (v === null) { if (cur.length) pts.push(cur); cur = []; return; }
    cur.push(`${data.length > 1 ? (i / (data.length - 1)) * (W - 8) + 4 : W / 2},${height - 6 - (v / 100) * (height - 12)}`);
  });
  if (cur.length) pts.push(cur);
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none">
      {[0, 50, 100].map((g) => <Line key={g} x1={0} x2={W} y1={height - 6 - (g / 100) * (height - 12)} y2={height - 6 - (g / 100) * (height - 12)} stroke={colors.border} strokeWidth={0.5} />)}
      {pts.map((p, i) => p.length === 1
        ? <Rect key={i} x={Number(p[0].split(',')[0]) - 2} y={Number(p[0].split(',')[1]) - 2} width={4} height={4} fill={color} />
        : <Polyline key={i} points={p.join(' ')} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />)}
      <SvgText x={2} y={10} fill={colors.muted} fontSize={9}>100</SvgText>
    </Svg>
  );
}
