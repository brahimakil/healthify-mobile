import { useTheme } from '@/context/ThemeContext'
import { useAuth } from '@/hooks/useAuth'
import { MainLayout } from '@/layouts/MainLayout'
import { UserService } from '@/services/userService'
import { router } from 'expo-router'
import React, { useEffect, useState } from 'react'
import { Alert, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native'

export default function SettingsScreen() {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [googleApiKey, setGoogleApiKey] = useState('')
  const [isApiKeyVisible, setIsApiKeyVisible] = useState(false)
  const [loading, setLoading] = useState(false)

  // Load saved API key on component mount
  useEffect(() => {
    if (user?.uid) {
      loadApiKey()
    }
  }, [user?.uid])

  const loadApiKey = async () => {
    try {
      setLoading(true)
      console.log('🔑 Loading API key for user:', user?.uid)
      
      if (user?.uid) {
        const userData = await UserService.getUser(user.uid)
        console.log('👤 User data loaded:', {
          hasProfile: !!userData?.profile,
          hasApiKey: !!userData?.profile?.googleApiKey,
          apiKeyLength: userData?.profile?.googleApiKey?.length || 0
        })
        
        if (userData?.profile?.googleApiKey) {
          setGoogleApiKey(userData.profile.googleApiKey)
          console.log('✅ API key loaded from profile')
        } else {
          console.log('⚠️ No API key found in profile')
          setGoogleApiKey('')
        }
      }
    } catch (error) {
      console.error('❌ Error loading API key:', error)
      showAlert('Error', 'Failed to load API key from profile')
    } finally {
      setLoading(false)
    }
  }

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const saveApiKey = async () => {
    try {
      if (!user?.uid) {
        showAlert('Error', 'User not authenticated')
        return
      }

      setLoading(true)
      console.log('💾 Saving API key...', {
        userId: user.uid,
        hasApiKey: !!googleApiKey.trim(),
        apiKeyLength: googleApiKey.trim().length
      })

      if (googleApiKey.trim()) {
        // Save API key to user profile
        await UserService.updateUserProfile(user.uid, {
          googleApiKey: googleApiKey.trim()
        })
        console.log('✅ API key saved to profile')
        showAlert('Success', 'Google API key saved to your profile successfully')
      } else {
        // Remove API key from user profile by setting it to null
        const currentUser = await UserService.getUser(user.uid)
        if (currentUser?.profile) {
          const updatedProfile = { ...currentUser.profile }
          delete updatedProfile.googleApiKey
          
          await UserService.updateUserProfile(user.uid, updatedProfile)
          console.log('✅ API key removed from profile')
          showAlert('Success', 'Google API key removed from your profile')
        }
      }

      // Reload the API key to verify it was saved
      setTimeout(() => {
        loadApiKey()
      }, 1000)

    } catch (error) {
      console.error('❌ Error saving API key:', error)
      showAlert('Error', 'Failed to save API key to your profile')
    } finally {
      setLoading(false)
    }
  }

  const testApiKey = async () => {
    if (!googleApiKey.trim()) {
      showAlert('Error', 'Please enter a Google API key first')
      return
    }

    try {
      setLoading(true)
      console.log('🧪 Testing API key...')
      
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${googleApiKey.trim()}`
      
      const requestBody = {
        contents: [
          {
            parts: [
              {
                text: "Respond with exactly: 'API key works'"
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 10
        }
      }

      console.log('📡 Making API request...')
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      console.log('📡 Response status:', response.status)

      const responseText = await response.text()
      console.log('📡 Response text:', responseText)

      if (response.ok) {
        try {
          const data = JSON.parse(responseText)
          console.log('✅ Parsed response:', data)
          
          if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            const generatedText = data.candidates[0].content.parts[0].text
            showAlert(
              'Success! ✅', 
              `API key is working correctly!\n\nResponse: "${generatedText.trim()}"`
            )
          } else {
            showAlert('Success! ✅', 'API key is valid and working!')
          }
        } catch (parseError) {
          console.error('JSON parse error:', parseError)
          showAlert('Success! ✅', 'API key is working (response received)')
        }
      } else {
        let errorMessage = 'Invalid API key or API request failed'
        
        try {
          const errorData = JSON.parse(responseText)
          if (errorData.error && errorData.error.message) {
            errorMessage = errorData.error.message
          }
        } catch (e) {
          // Use default error message
        }
        
        console.error('❌ API Error:', errorMessage)
        showAlert('Error ❌', `API Test Failed:\n${errorMessage}`)
      }
    } catch (error) {
      console.error('❌ Network/API test error:', error)
      
      let errorMessage = 'Failed to test API key'
      if (error instanceof Error) {
        errorMessage = error.message
      }
      
      showAlert(
        'Error ❌', 
        `Network error occurred:\n${errorMessage}\n\nPlease check your internet connection and try again.`
      )
    } finally {
      setLoading(false)
    }
  }

  const handleNavigate = (route: string) => {
    switch (route) {
      case 'dashboard':
        router.push('/(auth)/dashboard')
        break
      case 'nutrition':
        router.push('/(auth)/nutrition')
        break
      case 'workouts':
        router.push('/(auth)/workouts')
        break
      case 'sleep':
        router.push('/(auth)/sleep')
        break
      case 'hydration':
        router.push('/(auth)/hydration')
        break
      case 'dietitians':
        router.push('/(auth)/dietitians')
        break
      case 'profile':
        router.push('/(auth)/profile')
        break
      default:
        router.push('/(auth)/dashboard')
    }
  }

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      showAlert('Error', 'Failed to sign out. Please try again.')
    }
  }

  return (
    <MainLayout
      title="Settings"
      activeRoute="settings"
      onNavigate={handleNavigate}
      onLogout={handleLogout}
      user={user}
    >
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Theme Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Appearance</Text>
            
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Dark Mode</Text>
                <Text style={[styles.settingDescription, { color: theme.mode === 'dark' ? '#D1D5DB' : '#6B7280' }]}>
                  Toggle between light and dark theme
                </Text>
              </View>
              <Switch
                value={theme.mode === 'dark'}
                onValueChange={toggleTheme}
                trackColor={{ false: '#D1D5DB', true: '#10B981' }}
                thumbColor={theme.mode === 'dark' ? '#FFFFFF' : '#F3F4F6'}
              />
            </View>
          </View>

          {/* API Management Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>AI Configuration</Text>
            
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Google API Key</Text>
                <Text style={[styles.settingDescription, { color: theme.mode === 'dark' ? '#D1D5DB' : '#6B7280' }]}>
                  Enter your Google Gemini API key for AI-powered features
                </Text>
              </View>
            </View>

            <View style={styles.apiKeyContainer}>
              <TextInput
                style={[
                  styles.apiKeyInput,
                  {
                    backgroundColor: theme.mode === 'dark' ? '#374151' : '#F9FAFB',
                    borderColor: theme.mode === 'dark' ? '#4B5563' : '#D1D5DB',
                    color: theme.text,
                  }
                ]}
                placeholder="Enter your Google API key"
                placeholderTextColor={theme.mode === 'dark' ? '#9CA3AF' : '#6B7280'}
                value={googleApiKey}
                onChangeText={setGoogleApiKey}
                secureTextEntry={!isApiKeyVisible}
                multiline={false}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
              
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.toggleButton, { backgroundColor: theme.mode === 'dark' ? '#4B5563' : '#E5E7EB' }]}
                  onPress={() => setIsApiKeyVisible(!isApiKeyVisible)}
                  disabled={loading}
                >
                  <Text style={[styles.actionButtonText, { color: theme.text }]}>
                    {isApiKeyVisible ? 'Hide' : 'Show'}
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionButton, styles.testButton, { opacity: loading ? 0.5 : 1 }]}
                  onPress={testApiKey}
                  disabled={loading}
                >
                  <Text style={styles.testButtonText}>
                    {loading ? 'Testing...' : 'Test'}
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionButton, styles.saveButton, { opacity: loading ? 0.5 : 1 }]}
                  onPress={saveApiKey}
                  disabled={loading}
                >
                  <Text style={styles.saveButtonText}>
                    {loading ? 'Saving...' : 'Save'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.apiKeyInfo}>
              <Text style={[styles.infoText, { color: theme.mode === 'dark' ? '#9CA3AF' : '#6B7280' }]}>
                • Get your API key from Google AI Studio (aistudio.google.com)
              </Text>
              <Text style={[styles.infoText, { color: theme.mode === 'dark' ? '#9CA3AF' : '#6B7280' }]}>
                • Your API key is stored securely in your profile
              </Text>
              <Text style={[styles.infoText, { color: theme.mode === 'dark' ? '#9CA3AF' : '#6B7280' }]}>
                • Required for AI-powered workout and nutrition suggestions
              </Text>
              <Text style={[styles.infoText, { color: theme.mode === 'dark' ? '#9CA3AF' : '#6B7280' }]}>
                • Current status: {googleApiKey.trim() ? '✅ API key configured' : '❌ No API key set'}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </MainLayout>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  apiKeyContainer: {
    marginTop: 12,
  },
  apiKeyInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    fontFamily: 'monospace',
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  toggleButton: {
    // backgroundColor set dynamically
  },
  testButton: {
    backgroundColor: '#3B82F6',
  },
  saveButton: {
    backgroundColor: '#10B981',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  testButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  apiKeyInfo: {
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 8,
  },
  infoText: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 4,
  },
}) 