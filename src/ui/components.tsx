import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import Animated, { Easing, FadeInDown, useAnimatedProps, useAnimatedStyle, useSharedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, scoreColor, space } from './theme';

/* ------------------------------ Texte ------------------------------ */
type Variant = 'display' | 'title' | 'heading' | 'body' | 'caption' | 'label';
const textStyles: Record<Variant, TextStyle> = {
  display: { fontSize: 40, fontWeight: '700', letterSpacing: -1, color: colors.text },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5, color: colors.text },
  heading: { fontSize: 18, fontWeight: '600', color: colors.text },
  body: { fontSize: 15, fontWeight: '400', color: colors.text, lineHeight: 21 },
  caption: { fontSize: 13, fontWeight: '400', color: colors.textSoft, lineHeight: 18 },
  label: { fontSize: 11, fontWeight: '600', color: colors.muted, letterSpacing: 1.2, textTransform: 'uppercase' },
};
export function T({ v = 'body', style, children, ...rest }: { v?: Variant; style?: StyleProp<TextStyle>; children?: React.ReactNode } & React.ComponentProps<typeof Text>) {
  return <Text {...rest} style={[textStyles[v], style]}>{children}</Text>;
}

/* ------------------------------ Écran ------------------------------ */
export function Screen({ title, subtitle, children, scroll = true, back = true, right, padded = true, footer }: {
  title?: string; subtitle?: string; children: React.ReactNode; scroll?: boolean; back?: boolean; right?: React.ReactNode; padded?: boolean; footer?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const head = title ? (
    <View style={styles.head}>
      {back && router.canGoBack() ? (
        <Pressable accessibilityLabel="Retour" hitSlop={12} onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.cream} />
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        <T v="title" numberOfLines={1}>{title}</T>
        {subtitle ? <T v="caption">{subtitle}</T> : null}
      </View>
      {right}
    </View>
  ) : null;
  const body = <View style={{ paddingHorizontal: padded ? space.xl : 0, gap: space.lg }}>{children}</View>;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      {head ? <View style={{ paddingHorizontal: space.xl }}>{head}</View> : null}
      {scroll ? (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120, paddingTop: head ? space.sm : space.lg }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {body}
        </ScrollView>
      ) : <View style={{ flex: 1, paddingTop: head ? space.sm : space.lg }}>{body}</View>}
      {footer ? <View style={{ paddingHorizontal: space.xl, paddingBottom: insets.bottom + space.md, paddingTop: space.sm }}>{footer}</View> : null}
    </View>
  );
}

/* ------------------------------ Cartes ------------------------------ */
export function Card({ children, style, onPress, delay = 0, tone = 'default' }: {
  children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; delay?: number; tone?: 'default' | 'forest' | 'alt';
}) {
  const bg = tone === 'forest' ? colors.forest : tone === 'alt' ? colors.surfaceAlt : colors.surface;
  const inner = <View style={[styles.card, { backgroundColor: bg }, style]}>{children}</View>;
  const entering = FadeInDown.delay(delay).duration(420).easing(Easing.out(Easing.cubic));
  if (!onPress) return <Animated.View entering={entering}>{inner}</Animated.View>;
  return <Animated.View entering={entering}><PressScale onPress={onPress}>{inner}</PressScale></Animated.View>;
}

export function PressScale({ children, onPress, disabled, style, haptic = true }: { children: React.ReactNode; onPress?: () => void; disabled?: boolean; style?: StyleProp<ViewStyle>; haptic?: boolean }) {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable
      disabled={disabled}
      onPressIn={() => { s.value = withSpring(0.97, { damping: 18, stiffness: 300 }); }}
      onPressOut={() => { s.value = withSpring(1, { damping: 14, stiffness: 260 }); }}
      onPress={() => { if (haptic) void Haptics.selectionAsync().catch(() => {}); onPress?.(); }}
    >
      <Animated.View style={[a, style]}>{children}</Animated.View>
    </Pressable>
  );
}

export function Button({ label, onPress, variant = 'primary', loading, disabled, icon, style }: {
  label: string; onPress?: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; loading?: boolean; disabled?: boolean; icon?: keyof typeof Ionicons.glyphMap; style?: StyleProp<ViewStyle>;
}) {
  const bg = variant === 'primary' ? colors.green : variant === 'secondary' ? colors.surfaceAlt : variant === 'danger' ? colors.danger : 'transparent';
  const fg = variant === 'primary' ? '#08140E' : variant === 'danger' ? '#1B0B07' : colors.cream;
  return (
    <PressScale onPress={onPress} disabled={disabled || loading} style={[styles.btn, { backgroundColor: bg, opacity: disabled ? 0.45 : 1, borderWidth: variant === 'ghost' ? 1 : 0, borderColor: colors.border }, style]}>
      {loading ? <ActivityIndicator color={fg} /> : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
          <Text style={{ color: fg, fontSize: 16, fontWeight: '600' }}>{label}</Text>
        </View>
      )}
    </PressScale>
  );
}

export function Chip({ label, active, onPress, color }: { label: string; active?: boolean; onPress?: () => void; color?: string }) {
  return (
    <PressScale onPress={onPress} style={[styles.chip, active && { backgroundColor: colors.forest, borderColor: colors.green }, color ? { borderColor: color } : null]}>
      <Text style={{ color: active ? colors.cream : colors.textSoft, fontSize: 13, fontWeight: '500' }}>{label}</Text>
    </PressScale>
  );
}

export function Field({ label, error, style, ...rest }: TextInputProps & { label?: string; error?: string }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      {label ? <T v="label">{label}</T> : null}
      <TextInput
        placeholderTextColor={colors.muted}
        selectionColor={colors.green}
        {...rest}
        onFocus={(e) => { setFocus(true); rest.onFocus?.(e); }}
        onBlur={(e) => { setFocus(false); rest.onBlur?.(e); }}
        style={[styles.input, focus && { borderColor: colors.green }, error ? { borderColor: colors.danger } : null, style]}
      />
      {error ? <T v="caption" style={{ color: colors.danger }}>{error}</T> : null}
    </View>
  );
}

export function Row({ children, style, gap = space.md }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}
export function Divider() { return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />; }
export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return <Row style={{ justifyContent: 'space-between', marginTop: space.sm }}><T v="label">{children}</T>{right}</Row>;
}
export function Notice({ text, tone = 'info' }: { text: string; tone?: 'info' | 'warn' | 'danger' }) {
  const c = tone === 'danger' ? colors.danger : tone === 'warn' ? colors.warn : colors.greenSoft;
  return (
    <View style={{ flexDirection: 'row', gap: 10, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, borderLeftWidth: 3, borderLeftColor: c }}>
      <Ionicons name={tone === 'info' ? 'information-circle' : 'warning'} size={18} color={c} />
      <T v="caption" style={{ flex: 1, color: colors.textSoft }}>{text}</T>
    </View>
  );
}
export function Empty({ icon = 'leaf-outline', title, text }: { icon?: keyof typeof Ionicons.glyphMap; title: string; text?: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: space.xxl, gap: 8 }}>
      <Ionicons name={icon} size={40} color={colors.muted} />
      <T v="heading">{title}</T>
      {text ? <T v="caption" style={{ textAlign: 'center' }}>{text}</T> : null}
    </View>
  );
}

/* ------------------------- Progression animée ------------------------- */
export function ProgressBar({ value, max = 100, color = colors.green, height = 8, over }: { value: number; max?: number; color?: string; height?: number; over?: boolean }) {
  const w = useSharedValue(0);
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  useEffect(() => { w.value = withTiming(ratio, { duration: 800, easing: Easing.out(Easing.cubic) }); }, [ratio, w]);
  const a = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={{ height, borderRadius: height, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}>
      <Animated.View style={[{ height, borderRadius: height, backgroundColor: over ? colors.warn : color }, a]} />
    </View>
  );
}

/** Compteur animé (interpolation sur ~700 ms). */
export function CountUp({ value, digits = 0, style, suffix = '' }: { value: number; digits?: number; style?: StyleProp<TextStyle>; suffix?: string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current, delta = value - start, t0 = Date.now(), dur = 700;
    let raf = 0;
    const tick = () => {
      const p = Math.min(1, (Date.now() - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      setShown(start + delta * e);
      if (p < 1) raf = requestAnimationFrame(tick); else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <Text style={style}>{shown.toFixed(digits)}{suffix}</Text>;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
/** Anneau de note 0-100 avec animation du tracé. */
export function ScoreRing({ score, size = 96, stroke = 9, label, color }: { score: number | null; size?: number; stroke?: number; label?: string; color?: string }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const p = useSharedValue(0);
  useEffect(() => { p.value = withTiming(score === null ? 0 : score / 100, { duration: 1000, easing: Easing.out(Easing.cubic) }); }, [score, p]);
  const col = color ?? scoreColor(score);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surfaceAlt} strokeWidth={stroke} fill="none" />
        <RingArc size={size} r={r} c={c} stroke={stroke} color={col} progress={p} />
      </Svg>
      <T style={{ fontSize: size * 0.3, fontWeight: '700', color: col }}>{score === null ? '—' : Math.round(score)}</T>
      {label ? <T v="caption" style={{ fontSize: 10, marginTop: -2 }}>{label}</T> : null}
    </View>
  );
}
function RingArc({ size, r, c, stroke, color, progress }: { size: number; r: number; c: number; stroke: number; color: string; progress: SharedValue<number> }) {
  const ap = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - progress.value) }));
  return <AnimatedCircle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${c} ${c}`} animatedProps={ap} />;
}

export function Badge({ text, color = colors.greenSoft }: { text: string; color?: string }) {
  return <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1, borderColor: color }}><Text style={{ color, fontSize: 11, fontWeight: '600' }}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingTop: space.sm },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: radius.lg, padding: space.xl, gap: space.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  btn: { borderRadius: radius.pill, paddingVertical: 16, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', minHeight: 54 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 14, color: colors.text, fontSize: 16 },
});
