import { Pressable, Text, View } from 'react-native';
import { styles } from '../styles';

export const Header = ({ title, onBack }: { title: string; onBack?: () => void }) => (
  <View style={styles.pageHeader}>{onBack ? <Pressable onPress={onBack} hitSlop={12}><Text style={styles.back}>‹</Text></Pressable> : <View style={{ width: 34 }} />}<Text style={styles.pageTitle}>{title}</Text><View style={{ width: 34 }} /></View>
);
