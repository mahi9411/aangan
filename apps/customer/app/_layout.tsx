import { Stack } from 'expo-router'
import { useFonts, Fraunces_500Medium, Fraunces_600SemiBold } from '@expo-google-fonts/fraunces'
import { Outfit_400Regular, Outfit_500Medium } from '@expo-google-fonts/outfit'
import { AuthProvider } from '../src/auth'
import { colors } from '../src/theme'

export default function RootLayout() {
  const [ready] = useFonts({ Fraunces_500Medium, Fraunces_600SemiBold, Outfit_400Regular, Outfit_500Medium })
  if (!ready) return null
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.sand } }} />
    </AuthProvider>
  )
}
