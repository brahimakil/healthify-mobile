import { useTheme } from '@/context/ThemeContext'
import { useRouter } from 'expo-router'
import React from 'react'
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  ChevronRightIcon,
  DashboardIcon,
  LogoutIcon,
  NutritionIcon,
  PersonGroupIcon,
  SettingsIcon,
  SleepIcon,
  WaterIcon,
  WorkoutIcon
} from './icons/IconComponents'

interface SidebarProps {
  activeRoute: string
  onNavigate: (route: string) => void
  onLogout: () => void
  userName?: string
  userEmail?: string
  userPhotoURL?: string
}

const { width } = Dimensions.get('window')

const menuItems = [
  { 
    id: 'dashboard', 
    label: 'Dashboard', 
    route: 'dashboard', 
    icon: DashboardIcon,
    description: 'Overview & insights'
  },
  { 
    id: 'nutrition', 
    label: 'Nutrition', 
    route: 'nutrition', 
    icon: NutritionIcon,
    description: 'Track your meals'
  },
  { 
    id: 'workouts', 
    label: 'Workouts', 
    route: 'workouts', 
    icon: WorkoutIcon,
    description: 'Exercise tracking'
  },
  { 
    id: 'sleep', 
    label: 'Sleep', 
    route: 'sleep', 
    icon: SleepIcon,
    description: 'Sleep patterns'
  },
  { 
    id: 'hydration', 
    label: 'Hydration', 
    route: 'hydration', 
    icon: WaterIcon,
    description: 'Water intake'
  },
  { 
    id: 'dietitians', 
    label: 'Dietitians', 
    route: 'dietitians', 
    icon: PersonGroupIcon,
    description: 'System dietitians'
  },
  { 
    id: 'settings', 
    label: 'Settings', 
    route: 'settings', 
    icon: SettingsIcon,
    description: 'App preferences'
  },
]

export const Sidebar: React.FC<SidebarProps> = ({
  activeRoute,
  onNavigate,
  onLogout,
  userName = 'User',
  userEmail = 'user@example.com',
  userPhotoURL
}) => {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const currentPath = activeRoute
  const { theme } = useTheme()

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 20, backgroundColor: theme.background }]}>
        <View style={[styles.userInfo, { borderBottomColor: theme.mode === 'dark' ? '#374151' : '#E5E7EB' }]}>
          <View style={[styles.avatar, { backgroundColor: theme.mode === 'dark' ? '#374151' : '#F3F4F6' }]}>
            <Text style={[styles.avatarText, { color: theme.text }]}>
              {userName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.userDetails}>
            <Text style={[styles.userName, { color: theme.text }]}>{userName}</Text>
            {userEmail && (
              <Text style={[styles.userEmail, { color: theme.mode === 'dark' ? '#9CA3AF' : '#6B7280' }]}>
                {userEmail}
              </Text>
            )}
          </View>
        </View>
      </View>

      <ScrollView style={styles.menuContainer} showsVerticalScrollIndicator={false}>
        {menuItems.map((item) => {
          const isActive = activeRoute === item.id
          const IconComponent = item.icon
          
          return (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.menuItem,
                isActive && { backgroundColor: theme.mode === 'dark' ? '#374151' : '#F3F4F6' }
              ]}
              onPress={() => onNavigate(item.route)}
              activeOpacity={0.7}
            >
              <View style={styles.menuItemContent}>
                <IconComponent 
                  size={20} 
                  color={isActive ? '#10B981' : (theme.mode === 'dark' ? '#9CA3AF' : '#6B7280')} 
                />
                <View style={styles.menuItemText}>
                  <Text style={[
                    styles.menuItemLabel,
                    { color: isActive ? '#10B981' : theme.text }
                  ]}>
                    {item.label}
                  </Text>
                  <Text style={[
                    styles.menuItemDescription,
                    { color: theme.mode === 'dark' ? '#9CA3AF' : '#6B7280' }
                  ]}>
                    {item.description}
                  </Text>
                </View>
              </View>
              <ChevronRightIcon 
                size={16} 
                color={theme.mode === 'dark' ? '#9CA3AF' : '#6B7280'} 
              />
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: theme.mode === 'dark' ? '#374151' : '#E5E7EB' }]}>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={onLogout}
          activeOpacity={0.7}
        >
          <LogoutIcon size={20} color="#EF4444" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRightWidth: 1,
    borderRightColor: '#F3F4F6',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 12,
    color: '#6B7280',
  },
  menuContainer: {
    flex: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 2,
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuItemText: {
    flex: 1,
  },
  menuItemLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 1,
  },
  menuItemDescription: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
    flex: 1,
  },
}) 