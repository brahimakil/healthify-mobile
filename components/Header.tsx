import { useTheme } from '@/context/ThemeContext'
import { router } from 'expo-router'
import React, { useState } from 'react'
import { Modal, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LogoutIcon, MenuIcon, UserIcon } from './icons/IconComponents'

interface HeaderProps {
  title: string
  onMenuPress: () => void
  onLogout: () => void
  userPhotoURL?: string
  userName?: string
  userEmail?: string
}

export const Header: React.FC<HeaderProps> = ({
  title,
  onMenuPress,
  onLogout,
  userPhotoURL,
  userName = 'User',
  userEmail
}) => {
  const insets = useSafeAreaInsets()
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const { theme } = useTheme()

  const handleProfilePress = () => {
    setShowProfileMenu(true)
  }

  const handleProfileMenuClose = () => {
    setShowProfileMenu(false)
  }

  const handleProfileView = () => {
    setShowProfileMenu(false)
    router.push('/(auth)/profile')
  }

  const handleLogout = () => {
    setShowProfileMenu(false)
    onLogout()
  }

  return (
    <>
      <StatusBar 
        barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} 
        backgroundColor={theme.mode === 'dark' ? '#1F2937' : '#ffffff'} 
      />
      <View style={[
        styles.container, 
        { 
          paddingTop: insets.top, 
          backgroundColor: theme.mode === 'dark' ? '#1F2937' : '#ffffff',
          borderBottomColor: theme.mode === 'dark' ? '#374151' : '#F3F4F6'
        }
      ]}>
        <View style={styles.content}>
          <TouchableOpacity 
            style={[
              styles.menuButton,
              { backgroundColor: theme.mode === 'dark' ? '#374151' : '#F9FAFB' }
            ]} 
            onPress={onMenuPress}
            activeOpacity={0.7}
          >
            <MenuIcon size={24} color={theme.mode === 'dark' ? '#ffffff' : '#1F2937'} />
          </TouchableOpacity>
          
          <View style={styles.titleContainer}>
            <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{title}</Text>
          </View>
          
          <View style={styles.rightSection}>
            <TouchableOpacity 
              style={[styles.avatar, { backgroundColor: theme.mode === 'dark' ? '#374151' : '#F3F4F6' }]} 
              activeOpacity={0.8}
              onPress={handleProfilePress}
            >
              <Text style={[styles.avatarText, { color: theme.text }]}>
                {userName.charAt(0).toUpperCase()}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Profile Menu Modal with theme */}
      <Modal
        visible={showProfileMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={handleProfileMenuClose}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={handleProfileMenuClose}
        >
          <View style={[
            styles.profileMenu, 
            { 
              backgroundColor: theme.background,
              shadowColor: theme.mode === 'dark' ? '#000' : '#000'
            }
          ]}>
            <View style={[
              styles.profileHeader,
              { borderBottomColor: theme.mode === 'dark' ? '#374151' : '#F3F4F6' }
            ]}>
              <View style={styles.profileAvatar}>
                <Text style={styles.profileAvatarText}>
                  {userName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={[styles.profileName, { color: theme.text }]}>{userName}</Text>
                {userEmail && <Text style={[
                  styles.profileEmail, 
                  { color: theme.mode === 'dark' ? '#9CA3AF' : '#6B7280' }
                ]}>{userEmail}</Text>}
              </View>
            </View>
            
            <View style={[
              styles.menuDivider, 
              { backgroundColor: theme.mode === 'dark' ? '#374151' : '#F3F4F6' }
            ]} />
            
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={handleProfileView}
            >
              <UserIcon size={20} color={theme.mode === 'dark' ? '#9CA3AF' : '#6B7280'} />
              <Text style={[
                styles.menuItemText, 
                { color: theme.text }
              ]}>View Profile</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={handleLogout}
            >
              <LogoutIcon size={20} color="#EF4444" />
              <Text style={[styles.menuItemText, { color: '#EF4444' }]}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    zIndex: 10,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    minHeight: 56,
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 80, // Position below header
    paddingRight: 20,
  },
  profileMenu: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    minWidth: 240,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  profileAvatarText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 14,
    color: '#6B7280',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: 12,
  },
}) 