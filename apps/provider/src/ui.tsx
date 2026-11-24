import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors } from './theme'

export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

export function Arch() {
  return (
    <View style={styles.archWrap}>
      <View style={styles.arch} />
      <View style={styles.archBase} />
    </View>
  )
}

export function Button({ label, onPress, disabled, tone = 'clay' }: { label: string; onPress: () => void; disabled?: boolean; tone?: 'clay' | 'pine' | 'ghost' }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={[styles.button, tone === 'pine' && styles.pine, tone === 'ghost' && styles.ghost, disabled && styles.disabled]}>
      <Text style={[styles.buttonText, tone === 'ghost' && { color: colors.ink }]}>{label}</Text>
    </Pressable>
  )
}

export function Field({ label, value, onChangeText, placeholder, multiline, keyboardType, returnKeyType, onSubmitEditing }: { label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; multiline?: boolean; keyboardType?: 'default' | 'phone-pad' | 'number-pad'; returnKeyType?: 'done' | 'next' | 'go'; onSubmitEditing?: () => void }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.mute} multiline={multiline} keyboardType={keyboardType} returnKeyType={returnKeyType} onSubmitEditing={onSubmitEditing} blurOnSubmit={!multiline} style={[styles.input, multiline && { minHeight: 96, textAlignVertical: 'top' }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.sand },
  archWrap: { width: 28, height: 22, justifyContent: 'flex-end' },
  arch: { position: 'absolute', top: 0, left: 2, right: 2, height: 16, borderTopLeftRadius: 14, borderTopRightRadius: 14, borderWidth: 2, borderBottomWidth: 0, borderColor: colors.clay },
  archBase: { height: 2, backgroundColor: colors.clay },
  button: { backgroundColor: colors.clay, borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  pine: { backgroundColor: colors.pine },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line },
  disabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontFamily: 'Outfit_500Medium', fontSize: 16 },
  label: { color: colors.mute, fontSize: 13, fontFamily: 'Outfit_500Medium' },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, color: colors.ink, fontFamily: 'Outfit_400Regular', fontSize: 16 },
})
