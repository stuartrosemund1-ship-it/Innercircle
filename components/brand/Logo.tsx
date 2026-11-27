import Svg, { Circle, Path } from 'react-native-svg';

export function Logo({ size = 72, light = false }: { size?: number; light?: boolean }) {
  const ring = light ? '#FFFFFF' : '#5B4BDF';
  const soft = light ? 'rgba(255,255,255,0.35)' : '#EDE9FF';
  const accent = light ? '#E0F7F4' : '#0D9488';
  return (
    <Svg width={size} height={size} viewBox="0 0 72 72" accessibilityLabel="LifeCircle">
      <Circle cx="36" cy="36" r="34" fill={soft} />
      <Circle cx="36" cy="36" r="22" fill="none" stroke={ring} strokeWidth="3" />
      <Circle cx="27" cy="34" r="7" fill={ring} />
      <Circle cx="45" cy="34" r="7" fill={ring} opacity={0.85} />
      <Path d="M22 48c3.5 6 9 9 14 9s10.5-3 14-9" fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" />
    </Svg>
  );
}
