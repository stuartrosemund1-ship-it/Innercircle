import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { colors, typography } from '@/constants/theme';

export function NotificationBell() {
  const { user } = useAuth();
  const router = useRouter();
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = () => {
      api.listNotifications(user.id).then((items) => {
        if (!cancelled) setCount(items.filter((item) => !item.read_at).length);
      }).catch(() => { if (!cancelled) setCount(0); });
    };
    load();
    const unsubscribe = api.subscribe(load);
    return () => { cancelled = true; unsubscribe(); };
  }, [user]);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={count ? `Notifications, ${count} unread` : 'Notifications'} onPress={() => router.push('/(tabs)/activity')} style={styles.button}>
      <FontAwesome name="bell-o" size={20} color={colors.brand.purple} />
      {count > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{count > 9 ? '9+' : String(count)}</Text></View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { marginRight: 16, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 0, right: 0, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.brand.teal, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { ...typography.caption, color: colors.text.inverse, fontSize: 10, lineHeight: 12 },
});
