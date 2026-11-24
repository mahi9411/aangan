import { Tabs } from 'expo-router'
import { colors } from '../../src/theme'

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.clay,
      tabBarInactiveTintColor: colors.mute,
      tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.line },
      tabBarLabelStyle: { fontFamily: 'Outfit_500Medium' },
    }}>
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="bookings" options={{ title: 'Bookings' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  )
}
