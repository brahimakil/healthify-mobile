import { useRouter } from 'expo-router'
import React from 'react'
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
    ChevronRightIcon,
    DashboardIcon,
    LogoutIcon,
    NutritionIcon,
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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* App Branding */}
      <View style={styles.brandContainer}>
        <View style={styles.logoContainer}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>H</Text>
          </View>
          <View style={styles.brandTextContainer}>
            <Text style={styles.appName}>Healthify</Text>
            <Text style={styles.appTagline}>Health Companion</Text>
          </View>
        </View>
      </View>

      {/* User Profile Section */}
      <View style={styles.userSection}>
        <View style={styles.userInfo}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>
              {userName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.userName} numberOfLines={1}>{userName}</Text>
            <Text style={styles.userEmail} numberOfLines={1}>{userEmail}</Text>
          </View>
        </View>
        <View style={styles.userStats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>7</Text>
            <Text style={styles.statLabel}>Streak</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>85%</Text>
            <Text style={styles.statLabel}>Goals</Text>
          </View>
        </View>
      </View>

      <View style={styles.separator} />

      {/* Navigation Menu */}
      <ScrollView 
        style={styles.menuContainer} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.menuContent}
      >
        <Text style={styles.menuTitle}>Menu</Text>
        {menuItems.map((item) => {
          const IconComponent = item.icon
          const isActive = activeRoute === item.route
          
          return (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.menuItem,
                isActive && styles.menuItemActive
              ]}
              onPress={() => {
                console.log('Menu item clicked:', item.route)
                item.route && onNavigate(item.route)
              }}
              activeOpacity={0.7}
            >
              <View style={styles.menuItemLeft}>
                <View style={[
                  styles.menuIconContainer,
                  isActive && styles.menuIconContainerActive
                ]}>
                  <IconComponent 
                    size={18} 
                    color={isActive ? '#10B981' : '#6B7280'} 
                    strokeWidth={2}
                  />
                </View>
                <View style={styles.menuTextContainer}>
                  <Text style={[
                    styles.menuLabel,
                    isActive && styles.menuLabelActive
                  ]}>
                    {item.label}
                  </Text>
                  <Text style={styles.menuDescription}>
                    {item.description}
                  </Text>
                </View>
              </View>
              <ChevronRightIcon 
                size={14} 
                color={isActive ? '#10B981' : '#D1D5DB'} 
              />
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      <View style={styles.separator} />

      {/* Logout Section */}
      <View style={styles.logoutSection}>
        <TouchableOpacity 
          style={styles.logoutButton} 
          onPress={() => {
            console.log('Logout clicked')
            onLogout()
          }}
          activeOpacity={0.7}
        >
          <View style={styles.logoutIconContainer}>
            <LogoutIcon size={18} color="#EF4444" />
          </View>
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
  brandContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  logoText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  brandTextContainer: {
    flex: 1,
  },
  appName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: -0.5,
  },
  appTagline: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  userSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  userAvatar: {
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
  userAvatarText: {
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
  userStats: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10B981',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 12,
  },
  separator: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 16,
  },
  menuContainer: {
    flex: 1,
  },
  menuContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
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
  menuItemActive: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  menuIconContainerActive: {
    backgroundColor: '#DCFCE7',
  },
  menuTextContainer: {
    flex: 1,
  },
  menuLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 1,
  },
  menuLabelActive: {
    color: '#10B981',
  },
  menuDescription: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  logoutSection: {
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
  logoutIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
    flex: 1,
  },
  menuText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  activeMenuItem: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  activeMenuText: {
    color: '#10B981',
  },
}) 