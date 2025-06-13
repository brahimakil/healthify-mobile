import { router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native'
import { useAuth } from '../hooks/useAuth'

// Add conditional import for DateTimePicker
let DateTimePicker: any = null
if (Platform.OS !== 'web') {
  DateTimePicker = require('@react-native-community/datetimepicker').default
}

export default function Register() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    dateOfBirth: new Date(2000, 0, 1), // Default to Jan 1, 2000
    gender: '',
    height: '',
    weight: '',
    activityLevel: '',
    healthGoals: ''
  })
  const [loading, setLoading] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showGenderPicker, setShowGenderPicker] = useState(false)
  const [showActivityPicker, setShowActivityPicker] = useState(false)
  const [showGoalsPicker, setShowGoalsPicker] = useState(false)
  const { register } = useAuth()
  
  // Reference for web date picker
  const webDatePickerRef = useRef<HTMLInputElement | null>(null)

  // Create web date picker element on mount
  useEffect(() => {
    if (Platform.OS === 'web') {
      // Create the date input element
      const dateInput = document.createElement('input')
      dateInput.type = 'date'
      dateInput.style.display = 'none'
      dateInput.style.position = 'absolute'
      dateInput.style.opacity = '0'
      dateInput.style.height = '0'
      dateInput.style.width = '0'
      dateInput.value = formData.dateOfBirth.toISOString().split('T')[0]
      
      // Add change event listener
      dateInput.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement
        if (target.value) {
          updateField('dateOfBirth', new Date(target.value))
        }
      })
      
      // Add to the DOM
      document.body.appendChild(dateInput)
      webDatePickerRef.current = dateInput
      
      // Cleanup on unmount
      return () => {
        if (webDatePickerRef.current) {
          document.body.removeChild(webDatePickerRef.current)
        }
      }
    }
  }, [])

  // Simplified gender options
  const genderOptions = ['Male', 'Female']
  const activityLevels = ['Sedentary', 'Lightly Active', 'Moderately Active', 'Very Active', 'Extremely Active']
  const healthGoalsOptions = [
    'Lose Weight',
    'Gain Weight', 
    'Improve Fitness',
    'Build Muscle'
  ]

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Update web date picker value if it exists and the field is dateOfBirth
    if (field === 'dateOfBirth' && Platform.OS === 'web' && webDatePickerRef.current) {
      webDatePickerRef.current.value = value.toISOString().split('T')[0]
    }
  }

  const calculateAge = (birthDate: Date) => {
    const today = new Date()
    const age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      return age - 1
    }
    return age
  }

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false)
    if (selectedDate) {
      updateField('dateOfBirth', selectedDate)
    }
  }

  // Handle web date input change
  const handleWebDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      updateField('dateOfBirth', new Date(e.target.value))
    }
  }

  const handleRegister = async () => {
    console.log('Starting registration process...')
    console.log('Form data:', formData)

    // Enhanced validation
    if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.email.trim() || !formData.password) {
      Alert.alert('Error', 'Please fill in all required fields (First Name, Last Name, Email, Password)')
      return
    }

    if (!validateEmail(formData.email)) {
      Alert.alert('Error', 'Please enter a valid email address')
      return
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.alert('Error', 'Passwords do not match')
      return
    }

    if (formData.password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long')
      return
    }

    // Age validation
    const age = calculateAge(formData.dateOfBirth)
    if (age < 13) {
      Alert.alert('Error', 'You must be at least 13 years old to register')
      return
    }

    setLoading(true)
    console.log('Attempting to create account...')
    
    try {
      // Convert date to string for storage
      const userDataForRegistration = {
        ...formData,
        dateOfBirth: formData.dateOfBirth.toISOString().split('T')[0] // YYYY-MM-DD format
      }

      console.log('Calling register function with:', userDataForRegistration)
      
      await register(formData.email.trim().toLowerCase(), formData.password, userDataForRegistration)
      
      console.log('Registration successful!')
      
      Alert.alert(
        'Success!', 
        'Your account has been created successfully. Welcome to Healthify!',
        [{ 
          text: 'OK', 
          onPress: () => {
            console.log('User confirmed success, navigating to dashboard')
            router.replace('/(auth)/dashboard')
          }
        }]
      )
    } catch (error: any) {
      console.error('Registration error:', error)
      console.error('Error code:', error.code)
      console.error('Error message:', error.message)
      
      let errorMessage = 'An error occurred during registration'
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered. Please use a different email or try logging in.'
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address'
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please choose a stronger password.'
      } else if (error.code === 'auth/operation-not-allowed') {
        errorMessage = 'Email registration is not enabled. Please contact support.'
      } else if (error.message) {
        errorMessage = error.message
      }
      
      Alert.alert('Registration Failed', errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const PickerModal = ({ 
    visible, 
    options, 
    onSelect, 
    onClose, 
    title 
  }: {
    visible: boolean
    options: string[]
    onSelect: (value: string) => void
    onClose: () => void
    title: string
  }) => {
    if (!visible) return null

    return (
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{title}</Text>
          <ScrollView style={styles.optionsList}>
            {options.map((option) => (
              <TouchableOpacity
                key={option}
                style={styles.optionItem}
                onPress={() => {
                  onSelect(option)
                  onClose()
                }}
              >
                <Text style={styles.optionText}>{option}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="dark" />
      <TouchableOpacity 
        style={styles.backButton} 
        onPress={() => router.back()}
      >
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>
      
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Join Healthify</Text>
          <Text style={styles.subtitle}>Create your account to start tracking your health</Text>
        </View>

        <View style={styles.form}>
          {/* Personal Information */}
          <Text style={styles.sectionTitle}>Personal Information</Text>
          
          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>First Name *</Text>
              <TextInput
                style={styles.input}
                value={formData.firstName}
                onChangeText={(value) => updateField('firstName', value)}
                placeholder="John"
                placeholderTextColor="#94A3B8"
                autoCapitalize="words"
              />
            </View>
            
            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>Last Name *</Text>
              <TextInput
                style={styles.input}
                value={formData.lastName}
                onChangeText={(value) => updateField('lastName', value)}
                placeholder="Doe"
                placeholderTextColor="#94A3B8"
                autoCapitalize="words"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email *</Text>
            <TextInput
              style={styles.input}
              value={formData.email}
              onChangeText={(value) => updateField('email', value)}
              placeholder="john.doe@example.com"
              placeholderTextColor="#94A3B8"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password *</Text>
            <TextInput
              style={styles.input}
              value={formData.password}
              onChangeText={(value) => updateField('password', value)}
              placeholder="At least 6 characters"
              placeholderTextColor="#94A3B8"
              secureTextEntry
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm Password *</Text>
            <TextInput
              style={styles.input}
              value={formData.confirmPassword}
              onChangeText={(value) => updateField('confirmPassword', value)}
              placeholder="Confirm your password"
              placeholderTextColor="#94A3B8"
              secureTextEntry
            />
          </View>

          {/* Health Information */}
          <Text style={styles.sectionTitle}>Health Profile (Optional)</Text>
          
          {/* Date of Birth with Calendar Picker */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Date of Birth</Text>
            {Platform.OS === 'web' ? (
              // For web, use a direct date input
              <View style={styles.input}>
                <input
                  type="date"
                  value={formData.dateOfBirth.toISOString().split('T')[0]}
                  onChange={handleWebDateChange}
                  style={{
                    border: 'none',
                    backgroundColor: 'transparent',
                    fontSize: '16px',
                    color: '#1F2937',
                    width: '100%',
                    outline: 'none',
                    padding: '0',
                    fontFamily: 'inherit'
                  }}
                />
              </View>
            ) : (
              // For native, use TouchableOpacity to trigger DateTimePicker
              <TouchableOpacity 
                style={styles.input} 
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.inputText}>
                  {formatDate(formData.dateOfBirth)}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* DateTimePicker for native platforms */}
          {Platform.OS !== 'web' && showDatePicker && (
            DateTimePicker && (
              <DateTimePicker
                value={formData.dateOfBirth}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
                maximumDate={new Date()}
                minimumDate={new Date(1900, 0, 1)}
              />
            )
          )}
          
          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>Gender</Text>
              <TouchableOpacity 
                style={styles.input} 
                onPress={() => setShowGenderPicker(true)}
              >
                <Text style={[styles.inputText, !formData.gender && styles.placeholder]}>
                  {formData.gender || 'Select gender'}
                </Text>
              </TouchableOpacity>
            </View>
            
            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>Height (cm)</Text>
              <TextInput
                style={styles.input}
                value={formData.height}
                onChangeText={(value) => updateField('height', value)}
                placeholder="170"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Weight (kg)</Text>
            <TextInput
              style={styles.input}
              value={formData.weight}
              onChangeText={(value) => updateField('weight', value)}
              placeholder="70"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Activity Level</Text>
            <TouchableOpacity 
              style={styles.input} 
              onPress={() => setShowActivityPicker(true)}
            >
              <Text style={[styles.inputText, !formData.activityLevel && styles.placeholder]}>
                {formData.activityLevel || 'Select activity level'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Primary Health Goal</Text>
            <TouchableOpacity 
              style={styles.input} 
              onPress={() => setShowGoalsPicker(true)}
            >
              <Text style={[styles.inputText, !formData.healthGoals && styles.placeholder]}>
                {formData.healthGoals || 'Select your main goal'}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={[styles.button, loading && styles.buttonDisabled]} 
            onPress={handleRegister}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/login')}>
            <Text style={styles.linkText}>Sign In</Text>
          </TouchableOpacity>
        </View>

        {/* Picker Modals */}
        <PickerModal
          visible={showGenderPicker}
          options={genderOptions}
          onSelect={(value) => updateField('gender', value)}
          onClose={() => setShowGenderPicker(false)}
          title="Select Gender"
        />

        <PickerModal
          visible={showActivityPicker}
          options={activityLevels}
          onSelect={(value) => updateField('activityLevel', value)}
          onClose={() => setShowActivityPicker(false)}
          title="Select Activity Level"
        />

        <PickerModal
          visible={showGoalsPicker}
          options={healthGoalsOptions}
          onSelect={(value) => updateField('healthGoals', value)}
          onClose={() => setShowGoalsPicker(false)}
          title="Select Health Goal"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    color: '#0F766E',
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#334155',
    fontSize: 16,
    textAlign: 'center',
  },
  form: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#0F766E',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  inputGroup: {
    marginBottom: 16,
  },
  halfWidth: {
    flex: 1,
  },
  label: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    fontSize: 16,
    color: '#1F2937',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  inputText: {
    fontSize: 16,
    color: '#1F2937',
  },
  placeholder: {
    color: '#94A3B8',
  },
  button: {
    backgroundColor: '#0F766E',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  footerText: {
    color: '#64748B',
    fontSize: 16,
  },
  linkText: {
    color: '#0F766E',
    fontSize: 16,
    fontWeight: '700',
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 24,
    zIndex: 10,
  },
  backButtonText: {
    color: '#0F766E',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxHeight: '60%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  optionsList: {
    maxHeight: 200,
  },
  optionItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  optionText: {
    fontSize: 16,
    color: '#1F2937',
  },
  cancelButton: {
    marginTop: 16,
    paddingVertical: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
  },
  webDatePickerContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    width: '100%',
  },
  webDatePickerLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
})