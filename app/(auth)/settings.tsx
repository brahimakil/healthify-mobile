import { useTheme } from '@/context/ThemeContext'
import { useAuth } from '@/hooks/useAuth'
import { MainLayout } from '@/layouts/MainLayout'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { router } from 'expo-router'
import React, { useEffect, useState } from 'react'
import { Alert, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native'

export default function SettingsScreen() {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [googleApiKey, setGoogleApiKey] = useState('')
  const [isApiKeyVisible, setIsApiKeyVisible] = useState(false)

  // Load saved API key on component mount
  useEffect(() => {
    loadApiKey()
  }, [])

  const loadApiKey = async () => {
    try {
      const savedApiKey = await AsyncStorage.getItem('google_api_key')
      if (savedApiKey) {
        setGoogleApiKey(savedApiKey)
      }
    } catch (error) {
      console.error('Error loading API key:', error)
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
      if (googleApiKey.trim()) {
        await AsyncStorage.setItem('google_api_key', googleApiKey.trim())
        showAlert('Success', 'Google API key saved successfully')
      } else {
        await AsyncStorage.removeItem('google_api_key')
        showAlert('Success', 'Google API key removed')
      }
    } catch (error) {
      console.error('Error saving API key:', error)
      showAlert('Error', 'Failed to save API key')
    }
  }

  const testApiKey = async () => {
    if (!googleApiKey.trim()) {
      showAlert('Error', 'Please enter a Google API key first')
      return
    }

    try {
      console.log('Testing API key...')
      
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

      console.log('Making API request to:', apiUrl.replace(googleApiKey.trim(), 'HIDDEN_KEY'))
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      console.log('Response status:', response.status)
      console.log('Response headers:', response.headers)

      const responseText = await response.text()
      console.log('Response text:', responseText)

      if (response.ok) {
        try {
          const data = JSON.parse(responseText)
          console.log('Parsed response:', data)
          
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
        
        console.error('API Error:', errorMessage)
        showAlert('Error ❌', `API Test Failed:\n${errorMessage}`)
      }
    } catch (error) {
      console.error('Network/API test error:', error)
      
      let errorMessage = 'Failed to test API key'
      if (error instanceof Error) {
        errorMessage = error.message
      }
      
      showAlert(
        'Error ❌', 
        `Network error occurred:\n${errorMessage}\n\nPlease check your internet connection and try again.`
      )
    }
  }

  const handleNavigate = (route: string) => {
    console.log('Navigating to:', route)
    
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
      case 'settings':
        // Already on settings page
        break
      default:
        console.log('Unknown route:', route)
        showAlert('Navigation Error', `Route "${route}" not found`)
    }
  }

  const handleLogout = async () => {
    try {
      console.log('🔄 Logging out...')
      await logout()
      console.log('✅ Logout successful')
    } catch (error) {
      console.error('❌ Logout error:', error)
      showAlert('Error', 'Failed to logout')
    }
  }

  return (
    <MainLayout
      title="Settings"
      activeRoute="settings"
      onNavigate={handleNavigate}
      onLogout={handleLogout}
      user={{
        name: user?.displayName || 'User',
        email: user?.email || '',
        photoURL: user?.photoURL || undefined
      }}
    >
      <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.content}>
          {/* Theme Settings Section */}
          <View style={[styles.section, { borderBottomColor: theme.mode === 'dark' ? '#374151' : '#E5E7EB' }]}>
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
                trackColor={{ false: '#E5E7EB', true: '#10B981' }}
                thumbColor={theme.mode === 'dark' ? '#FFFFFF' : '#F9FAFB'}
              />
            </View>
          </View>

          {/* API Management Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>API Management</Text>
            
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Google API Key</Text>
                <Text style={[styles.settingDescription, { color: theme.mode === 'dark' ? '#D1D5DB' : '#6B7280' }]}>
                  Enter your Google Gemini API key for AI features
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
              />
              
              <View style={styles.apiKeyActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.toggleButton, { backgroundColor: theme.mode === 'dark' ? '#4B5563' : '#E5E7EB' }]}
                  onPress={() => setIsApiKeyVisible(!isApiKeyVisible)}
                >
                  <Text style={[styles.actionButtonText, { color: theme.text }]}>
                    {isApiKeyVisible ? 'Hide' : 'Show'}
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionButton, styles.testButton]}
                  onPress={testApiKey}
                >
                  <Text style={styles.testButtonText}>Test</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionButton, styles.saveButton]}
                  onPress={saveApiKey}
                >
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.apiKeyInfo}>
              <Text style={[styles.infoText, { color: theme.mode === 'dark' ? '#9CA3AF' : '#6B7280' }]}>
                • Get your API key from Google AI Studio
              </Text>
              <Text style={[styles.infoText, { color: theme.mode === 'dark' ? '#9CA3AF' : '#6B7280' }]}>
                • Your API key is stored securely on your device
              </Text>
              <Text style={[styles.infoText, { color: theme.mode === 'dark' ? '#9CA3AF' : '#6B7280' }]}>
                • Required for AI-powered health insights
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
    borderBottomWidth: 1,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    minHeight: 60,
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
  chevron: {
    fontSize: 20,
    fontWeight: '300',
  },
  apiKeyContainer: {
    marginTop: 12,
  },
  apiKeyInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 12,
    minHeight: 44,
  },
  apiKeyActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
  toggleButton: {
    flex: 1,
  },
  testButton: {
    backgroundColor: '#3B82F6',
    flex: 1,
  },
  saveButton: {
    backgroundColor: '#10B981',
    flex: 1,
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
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  infoText: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 4,
  },
}) 