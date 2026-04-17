import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const MACHINE_BOTTOM_ESTIMATE = SCREEN_HEIGHT * 0.75;

const FUNNEL_MOUTH_W = SCREEN_WIDTH;
const FUNNEL_TUBE_W  = 184;
const FUNNEL_SIDE    = Math.floor((SCREEN_WIDTH - FUNNEL_TUBE_W) / 2);

const APP_COLORS = [
  '#e040fb', '#40c4ff', '#69f0ae', '#ffca28',
  '#ff6e40', '#ea80fc', '#ff4081', '#00e5ff',
  '#76ff03', '#ff9100', '#f48fb1', '#80d8ff',
];

const SHAPES = [
  '🎵','🎶','🎸','🎹','🎺','🎻','🥁','🎷','🪗',
  '🎬','🎞️','📽️',
  'π','Ω','Σ','α','φ','β',
  '☯','✦','⬡',
  '🐦','🦋','🌸','🌺','🌻',
  '💡','❤️','💙','💜','💚','💛','🧡',
  '🎲','📦',
].map((label, i) => ({ label, color: APP_COLORS[i % APP_COLORS.length] }));

function FloatingShape({ shape, delay, startX, targetY }) {
  const centerX = SCREEN_WIDTH / 2 - 14;
  const y       = useRef(new Animated.Value(-60)).current;
  const x       = useRef(new Animated.Value(startX)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale   = useRef(new Animated.Value(1)).current;
  const animRef = useRef(null);

  useEffect(() => {
    if (animRef.current) { animRef.current.stop(); animRef.current = null; }
    const duration = 2800 + Math.random() * 1800;
    animRef.current = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(y,       { toValue: targetY, duration, useNativeDriver: true }),
          Animated.timing(x,       { toValue: centerX + (Math.random() - 0.5) * 40, duration, useNativeDriver: true }),
          Animated.timing(scale,   { toValue: 0.35, duration, useNativeDriver: true }),
        ]),
        Animated.timing(opacity, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.parallel([
          Animated.timing(y,     { toValue: -60, duration: 0, useNativeDriver: true }),
          Animated.timing(x,     { toValue: startX, duration: 0, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    animRef.current.start();
    return () => { if (animRef.current) animRef.current.stop(); };
  }, [targetY]);

  return (
    <Animated.Text style={{
      position: 'absolute', fontSize: 26, color: shape.color,
      opacity, transform: [{ translateX: x }, { translateY: y }, { scale }],
    }}>
      {shape.label}
    </Animated.Text>
  );
}

function RotatingGear({ size = 28, speed = 2500, reverse = false }) {
  const rot = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(rot, { toValue: 1, duration: speed, easing: Easing.linear, useNativeDriver: true })
    ).start();
    return () => rot.stopAnimation();
  }, []);
  const rotate = rot.interpolate({ inputRange: [0, 1], outputRange: reverse ? ['360deg', '0deg'] : ['0deg', '360deg'] });
  return <Animated.Text style={{ fontSize: size, transform: [{ rotate }] }}>⚙️</Animated.Text>;
}

function BlinkingLight({ color, interval = 900, delay = 0 }) {
  const op = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(op, { toValue: 0.1, duration: interval * 0.45, useNativeDriver: true }),
      Animated.timing(op, { toValue: 1,   duration: interval * 0.45, useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
  }, []);
  return (
    <Animated.View style={{
      opacity: op, width: 11, height: 11, borderRadius: 6,
      backgroundColor: color, margin: 2,
      shadowColor: color, shadowOpacity: 1, shadowRadius: 5, elevation: 4,
    }} />
  );
}

function MovingPiston({ color = '#8446b0', delay = 0 }) {
  const ty = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(ty, { toValue: -10, duration: 220, easing: Easing.ease, useNativeDriver: true }),
      Animated.timing(ty, { toValue:   3, duration: 220, easing: Easing.ease, useNativeDriver: true }),
      Animated.timing(ty, { toValue:   0, duration: 140, useNativeDriver: true }),
      Animated.delay(400),
    ]));
    anim.start();
    return () => anim.stop();
  }, []);
  return (
    <Animated.View style={{ transform: [{ translateY: ty }], alignItems: 'center' }}>
      <View style={{ width: 7, height: 22, backgroundColor: color, borderRadius: 3 }} />
      <View style={{ width: 15, height: 7, backgroundColor: color, borderRadius: 3, marginTop: -1 }} />
    </Animated.View>
  );
}

function PulseButton({ color, delay = 0 }) {
  const sc = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(sc, { toValue: 0.7, duration: 160, useNativeDriver: true }),
      Animated.timing(sc, { toValue: 1.1, duration: 160, useNativeDriver: true }),
      Animated.timing(sc, { toValue: 1,   duration: 100, useNativeDriver: true }),
      Animated.delay(900 + delay % 400),
    ]));
    anim.start();
    return () => anim.stop();
  }, []);
  return (
    <Animated.View style={{
      transform: [{ scale: sc }], width: 13, height: 13, borderRadius: 7,
      backgroundColor: color, margin: 3,
      shadowColor: color, shadowOpacity: 0.9, shadowRadius: 5, elevation: 4,
    }} />
  );
}

function LiquidDrop({ color, delay = 0 }) {
  const y  = useRef(new Animated.Value(0)).current;
  const op = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(op, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(y,  { toValue: 32, duration: 520, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(350),
          Animated.timing(op, { toValue: 0, duration: 170, useNativeDriver: true }),
        ]),
      ]),
      Animated.timing(y, { toValue: 0, duration: 0, useNativeDriver: true }),
      Animated.delay(500 + delay % 300),
    ]));
    anim.start();
    return () => anim.stop();
  }, [color]);
  return (
    <Animated.View style={{
      width: 8, height: 13, borderRadius: 4,
      backgroundColor: color, opacity: op,
      transform: [{ translateY: y }],
      shadowColor: color, shadowOpacity: 0.8, shadowRadius: 4, elevation: 3,
    }} />
  );
}

// ── Main exported component ───────────────────────────────────────────────────

export function VideoFactoryWaiting({ estimatedSeconds = 180, storyName, title, message }) {
  const [elapsed, setElapsed] = useState(0);
  const [machineBottom, setMachineBottom] = useState(MACHINE_BOTTOM_ESTIMATE);
  const machineBodyRef = useRef(null);

  useEffect(() => {
    const iv = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const onMachineLayout = useCallback(() => {
    machineBodyRef.current?.measureInWindow((_x, y, _w, h) => {
      if (y > 50) setMachineBottom(y + h);
    });
  }, []);

  const progress    = Math.min(elapsed / estimatedSeconds, 0.97);
  const secondsLeft = Math.max(estimatedSeconds - elapsed, 3);
  const minsLeft    = Math.floor(secondsLeft / 60);
  const secsLeft    = secondsLeft % 60;
  const timeLabel   = minsLeft > 0
    ? `~${minsLeft}:${String(secsLeft).padStart(2, '0')} דקות נשארו`
    : `~${secsLeft} שניות נשארו`;
  const pct       = Math.round(progress * 100);
  const fillColor = pct < 35 ? '#8446b0' : pct < 70 ? '#40c4ff' : '#69f0ae';

  const shapeInstances = SHAPES.map((shape, i) => ({
    shape, delay: (i * 380) % 5000,
    startX: 10 + (i % 10) * ((SCREEN_WIDTH - 40) / 10),
  }));

  return (
    <View style={styles.container}>
      {/* Falling shapes — clipped at machine body bottom */}
      <View style={[styles.shapesLayer, { height: machineBottom }]} pointerEvents="none">
        {shapeInstances.map((s, i) => (
          <FloatingShape key={i} shape={s.shape} delay={s.delay} startX={s.startX} targetY={machineBottom} />
        ))}
      </View>

      <Text style={styles.title}>{title || 'מכין את הסרטון שלך'}</Text>
      {storyName ? <Text style={styles.subtitle}>{storyName}</Text> : null}
      {message   ? <Text style={styles.message}>{message}</Text>   : null}

      {/* Machine section */}
      <View style={styles.machineSection}>
        {/* Top funnel */}
        <View style={{ alignItems: 'center' }}>
          <View style={styles.funnelMouth} />
          <View style={{ alignItems: 'center' }}>
            {Array.from({ length: 28 }).map((_, i) => (
              <View key={i} style={{
                width: FUNNEL_MOUTH_W - (FUNNEL_MOUTH_W - FUNNEL_TUBE_W) * (i / 27),
                height: 2, backgroundColor: '#1e1e42',
              }} />
            ))}
          </View>
          <View style={styles.funnelTube} />
        </View>

        {/* Machine body */}
        <View ref={machineBodyRef} style={styles.machineBody} onLayout={onMachineLayout}>
          <View style={styles.machineRow}>
            <RotatingGear size={28} speed={2100} />
            <View style={styles.panel}>
              <BlinkingLight color="#ff4444" interval={700}  delay={0}   />
              <BlinkingLight color="#ffcc00" interval={1050} delay={280} />
              <BlinkingLight color="#44ff88" interval={850}  delay={560} />
              <BlinkingLight color="#44ccff" interval={1200} delay={140} />
              <BlinkingLight color="#ff44ff" interval={950}  delay={420} />
            </View>
            <RotatingGear size={22} speed={1500} reverse />
          </View>
          <View style={styles.machineRow}>
            <MovingPiston color="#8446b0" delay={0}   />
            <MovingPiston color="#40c4ff" delay={180} />
            <RotatingGear size={36} speed={3800} />
            <MovingPiston color="#ff6e40" delay={90}  />
            <MovingPiston color="#69f0ae" delay={270} />
          </View>
          <View style={styles.machineRow}>
            <RotatingGear size={20} speed={1750} />
            <View style={styles.panel}>
              {['#e040fb','#40c4ff','#ff4081','#69f0ae','#ffca28','#ff6e40'].map((c, i) => (
                <PulseButton key={i} color={c} delay={i * 260} />
              ))}
            </View>
            <RotatingGear size={24} speed={2600} reverse />
          </View>
        </View>

        {/* Bottom output + liquid drips */}
        <View style={{ alignItems: 'center' }}>
          <View style={styles.funnelTube} />
          <View style={[styles.outputNozzle, { backgroundColor: fillColor }]} />
          <View style={{ flexDirection: 'row', gap: 5, marginTop: 2 }}>
            {[0, 280, 560].map((d, i) => (
              <LiquidDrop key={i} color={fillColor} delay={d} />
            ))}
          </View>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: fillColor }]} />
        </View>
        <Text style={styles.progressPct}>{pct}%</Text>
      </View>
      <Text style={styles.timeLabel}>{timeLabel}</Text>
      <Text style={styles.hint}>אפשר לסגור את האפליקציה ולקבל התראה כשמוכן</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#080814',
    alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 24, zIndex: 999,
  },
  title:    { color: '#fff', fontSize: 21, fontWeight: '700', textAlign: 'center', marginBottom: 3 },
  subtitle: { color: '#aaa', fontSize: 13, textAlign: 'center', marginBottom: 4 },
  message:  { color: '#40c4ff', fontSize: 14, textAlign: 'center', marginBottom: 4 },
  shapesLayer: {
    position: 'absolute', top: 0, left: 0, right: 0,
    overflow: 'hidden', zIndex: 1,
  },
  machineSection: { alignItems: 'center', zIndex: 5 },
  funnelMouth: {
    width: FUNNEL_MOUTH_W, height: 14, backgroundColor: '#1e1e42',
    borderTopLeftRadius: 7, borderTopRightRadius: 7,
  },
  funnelTube:   { width: FUNNEL_TUBE_W, height: 16, backgroundColor: '#1e1e42' },
  outputNozzle: { width: 16, height: 16, borderRadius: 8, marginTop: 2 },
  machineBody: {
    backgroundColor: 'transparent', borderRadius: 18,
    paddingVertical: 12, paddingHorizontal: 10,
    borderWidth: 2, borderColor: '#8446b0',
    width: SCREEN_WIDTH * 0.82, gap: 12,
  },
  machineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  panel: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#080814', borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 5,
  },
  progressContainer: { marginTop: 14, width: '82%', flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressBar:  { flex: 1, height: 14, backgroundColor: '#1e1e3a', borderRadius: 7, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 7 },
  progressPct:  { color: '#fff', fontSize: 13, fontWeight: '700', minWidth: 40, textAlign: 'right' },
  timeLabel:    { color: '#888', fontSize: 12, marginTop: 7 },
  hint:         { color: '#444', fontSize: 11, marginTop: 12, textAlign: 'center', paddingHorizontal: 28 },
});
