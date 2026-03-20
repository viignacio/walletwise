import { Tabs } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../../constants/colors'
import { FontFamily, FontSize, FontWeight } from '../../../constants/typography'
import { Shadows } from '../../../constants/shadows'
import Ionicons from '@expo/vector-icons/Ionicons'

type IoniconsName = React.ComponentProps<typeof Ionicons>['name']

function tabIcon(name: IoniconsName, focusedName: IoniconsName) {
  return ({ color, focused }: { color: string; focused: boolean }) => (
    <Ionicons name={focused ? focusedName : name} size={22} color={color} />
  )
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets()
  const bottomPad = Math.max(insets.bottom, 8)

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.text.secondary,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          paddingBottom: bottomPad,
          paddingTop: 6,
          height: 54 + bottomPad,
          ...Shadows.sm,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: FontWeight.semiBold,
          fontFamily: FontFamily.semiBold,
        },
        headerStyle: {
          backgroundColor: Colors.surface,
        },
        headerTitleStyle: {
          color: Colors.text.primary,
          fontWeight: FontWeight.bold,
          fontFamily: FontFamily.bold,
          fontSize: FontSize.md,
        },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: tabIcon('grid-outline', 'grid'),
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Wallet',
          tabBarIcon: tabIcon('wallet-outline', 'wallet'),
        }}
      />
      <Tabs.Screen
        name="credit"
        options={{
          title: 'Installments',
          tabBarIcon: tabIcon('card-outline', 'card'),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: tabIcon('settings-outline', 'settings'),
        }}
      />
    </Tabs>
  )
}
