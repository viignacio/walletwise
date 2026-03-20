import { Tabs } from 'expo-router'
import { Colors } from '../../../constants/colors'
import Ionicons from '@expo/vector-icons/Ionicons'

type IoniconsName = React.ComponentProps<typeof Ionicons>['name']

function tabIcon(name: IoniconsName, focusedName: IoniconsName) {
  return ({ color, focused }: { color: string; focused: boolean }) => (
    <Ionicons name={focused ? focusedName : name} size={22} color={color} />
  )
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.text.secondary,
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 6,
          height: 64,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        headerStyle: {
          backgroundColor: Colors.white,
        },
        headerTitleStyle: {
          color: Colors.text.primary,
          fontWeight: '700',
          fontSize: 18,
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
