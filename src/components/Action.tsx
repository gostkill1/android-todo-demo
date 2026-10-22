import { Pressable, Text } from 'react-native';
import { styles } from '../styles';

export const Action = ({ label, tone = 'danger', onPress }: { label: string; tone?: 'danger' | 'brand' | 'muted'; onPress: () => void }) => (
  <Pressable onPress={onPress} hitSlop={10} style={styles.action}><Text style={[styles.actionText, tone === 'brand' ? styles.brandText : tone === 'muted' ? styles.mutedActionText : styles.dangerText]}>{label}</Text></Pressable>
);
