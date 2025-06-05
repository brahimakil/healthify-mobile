import { router } from 'expo-router'
import { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useAuth } from '../hooks/useAuth'

export default function Index() {
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!loading) {
      if (user) {
        // User is authenticated, go to dashboard
        router.replace('/(auth)/dashboard')
      } else {
        // User is not authenticated, go to onboarding
        router.replace('/onboarding')
      }
    }
  }, [user, loading])

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.appName}>Healthify</Text>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    )
  }

  return null
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  appName: {
    color: '#fff',
    fontSize: 48,
    fontWeight: '700',
    marginBottom: 8,
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
}) 