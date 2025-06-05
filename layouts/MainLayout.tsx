import React, { useEffect, useRef, useState } from 'react'
import {
    Animated,
    BackHandler,
    Dimensions,
    Platform,
    StyleSheet,
    TouchableWithoutFeedback,
    View
} from 'react-native'
import { Header } from '../components/Header'
import { Sidebar } from '../components/Sidebar'

interface MainLayoutProps {
  children: React.ReactNode
  title: string
  activeRoute: string
  onNavigate: (route: string) => void
  onLogout: () => void
  user?: {
    name?: string
    email?: string
    photoURL?: string
  }
}

const { width, height } = Dimensions.get('window')

// Responsive sidebar width based on device type
const getSidebarWidth = () => {
  if (Platform.OS === 'web') {
    // For web: use a fixed width that's reasonable
    return Math.min(320, width * 0.4) // Max 320px or 40% of screen, whichever is smaller
  } else {
    // For mobile: much smaller width
    if (width < 400) {
      // Small phones: 75% of screen width
      return width * 0.75
    } else if (width < 500) {
      // Medium phones: 70% of screen width  
      return width * 0.7
    } else {
      // Large phones/tablets: 60% of screen width
      return width * 0.6
    }
  }
}

const SIDEBAR_WIDTH = getSidebarWidth()

export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  title,
  activeRoute,
  onNavigate,
  onLogout,
  user
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current
  const overlayOpacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const backAction = () => {
      if (sidebarOpen) {
        closeSidebar()
        return true
      }
      return false
    }

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction)
    return () => backHandler.remove()
  }, [sidebarOpen])

  const openSidebar = () => {
    console.log('Opening sidebar with width:', SIDEBAR_WIDTH)
    setSidebarOpen(true)
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start()
  }

  const closeSidebar = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -SIDEBAR_WIDTH,
        duration: 250,
        useNativeDriver: false,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: false,
      }),
    ]).start(() => {
      setSidebarOpen(false)
    })
  }

  const handleMenuPress = () => {
    console.log('Menu pressed, sidebar open:', sidebarOpen)
    if (sidebarOpen) {
      closeSidebar()
    } else {
      openSidebar()
    }
  }

  const handleNavigate = (route: string) => {
    onNavigate(route)
    closeSidebar()
  }

  const handleLogout = async () => {
    console.log('MainLayout: Logout requested')
    closeSidebar() // Close sidebar first
    
    // Wait for sidebar to close, then trigger logout
    setTimeout(() => {
      onLogout()
    }, 300)
  }

  return (
    <View style={styles.container}>
      <Header
        title={title}
        onMenuPress={handleMenuPress}
        onLogout={handleLogout}
        userName={user?.name}
        userEmail={user?.email}
        userPhotoURL={user?.photoURL}
      />
      
      <View style={styles.content}>
        {children}
      </View>
      
      {/* Always render sidebar overlay, control visibility with opacity and position */}
      <View style={[styles.sidebarOverlay, { 
        pointerEvents: sidebarOpen ? 'auto' : 'none' 
      }]}>
        {/* Dark overlay background */}
        <TouchableWithoutFeedback onPress={closeSidebar}>
          <Animated.View 
            style={[
              styles.overlay,
              { opacity: overlayOpacity }
            ]} 
          />
        </TouchableWithoutFeedback>
        
        {/* Sidebar Container */}
        <Animated.View 
          style={[
            styles.sidebarContainer,
            {
              left: slideAnim,
              width: SIDEBAR_WIDTH,
            }
          ]}
        >
          <Sidebar
            activeRoute={activeRoute}
            onNavigate={handleNavigate}
            onLogout={handleLogout}
            userName={user?.name}
            userEmail={user?.email}
            userPhotoURL={user?.photoURL}
          />
        </Animated.View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  sidebarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    ...(Platform.OS === 'web' && {
      position: 'fixed' as any,
    }),
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sidebarContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 1001,
    ...(Platform.OS === 'web' && {
      boxShadow: '2px 0 10px rgba(0, 0, 0, 0.25)',
    }),
  },
}) 