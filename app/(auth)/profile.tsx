import { router } from 'expo-router'
import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { CustomAlert } from '../../components/CustomAlert'
import {
  EditIcon
} from '../../components/icons/IconComponents'
import { ProtectedRoute } from '../../components/ProtectedRoute'
import { useAuth } from '../../hooks/useAuth'
import { useCustomAlert } from '../../hooks/useCustomAlert'
import { MainLayout } from '../../layouts/MainLayout'
import { PlanGenerationService } from '../../services/planGenerationService'
import { UserService } from '../../services/userService'
import { User } from '../../types/user'

export default function Profile() {
  const { user, logout } = useAuth()
  const { alertConfig, visible: alertVisible, showAlert, hideAlert } = useCustomAlert()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userProfile, setUserProfile] = useState<User | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [showHealthGoalPicker, setShowHealthGoalPicker] = useState(false)
  
  const [formData, setFormData] = useState({
    displayName: '',
    age: '',
    height: '',
    currentWeight: '',
    goalWeight: '',
    healthGoals: '',
  })

  // Health goal options (same as registration)
  const healthGoalOptions = [
    'Lose Weight',
    'Gain Weight', 
    'Improve Fitness',
    'Build Muscle'
  ]

  useEffect(() => {
    if (user?.uid) {
      loadUserProfile()
    }
  }, [user?.uid])

  const loadUserProfile = async () => {
    if (!user?.uid) return

    try {
      setLoading(true)
      const userData = await UserService.getUser(user.uid)
      setUserProfile(userData)
      
      // Populate form with current data (including health goals)
      setFormData({
        displayName: userData.displayName || '',
        age: userData.profile?.age?.toString() || '',
        height: userData.profile?.height?.toString() || '',
        currentWeight: userData.profile?.currentWeight?.toString() || '',
        goalWeight: userData.profile?.goalWeight?.toString() || '',
        healthGoals: userData.profile?.healthGoals || '',
      })
    } catch (error) {
      console.error('Failed to load user profile:', error)
      showAlert('Error', 'Failed to load profile data')
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

  const handleSave = async () => {
    console.log('🔄 handleSave called')
    console.log('📊 Current formData:', formData)
    console.log('👤 Current userProfile health goal:', userProfile?.profile?.healthGoals)
    
    if (!user?.uid || !userProfile) {
      console.log('❌ Missing user or userProfile')
      return
    }

    // Check if health goal is changing
    const isHealthGoalChanging = formData.healthGoals !== userProfile.profile?.healthGoals
    console.log('🔄 Is health goal changing?', isHealthGoalChanging)
    console.log('📝 Form health goal:', formData.healthGoals)
    console.log('💾 Stored health goal:', userProfile.profile?.healthGoals)

    if (isHealthGoalChanging) {
      console.log('🚨 Health goal is changing - showing alert')
      
      // If the stored health goal is undefined/empty and we're setting one for the first time,
      // just save it directly without showing the alert
      if (!userProfile.profile?.healthGoals && formData.healthGoals) {
        console.log('🆕 Setting health goal for the first time - saving directly')
        saveProfileNormal()
        return
      }
      
      showAlert(
        'Change Health Plan',
        'Changing your health plan will reset your nutrition, workout, sleep, and hydration goals to match your new plan. Your logged data will be preserved. Do you want to continue?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              console.log('❌ User cancelled health goal change')
            }
          },
          {
            text: 'Continue',
            style: 'destructive',
            onPress: () => {
              console.log('✅ User confirmed health goal change')
              saveProfileWithPlanChange()
            },
          },
        ]
      )
    } else {
      console.log('📝 No health goal change - calling saveProfileNormal')
      saveProfileNormal()
    }
  }

  const saveProfileNormal = async () => {
    console.log('🔄 saveProfileNormal called')
    try {
      setSaving(true)
      console.log('💾 Starting profile save...')
      
      const updatedProfile = {
        ...userProfile!,
        displayName: formData.displayName,
        profile: {
          ...userProfile!.profile,
          age: formData.age ? parseInt(formData.age) : undefined,
          height: formData.height ? parseInt(formData.height) : undefined,
          currentWeight: formData.currentWeight ? parseInt(formData.currentWeight) : undefined,
          goalWeight: formData.goalWeight ? parseInt(formData.goalWeight) : undefined,
          healthGoals: formData.healthGoals,
        }
      }

      console.log('📊 Updated profile object:', updatedProfile)
      console.log('🎯 Health goal in update:', updatedProfile.profile.healthGoals)

      await UserService.updateUser(user!.uid, updatedProfile)
      console.log('✅ UserService.updateUser completed')
      
      setUserProfile(updatedProfile)
      setEditMode(false)
      
      showAlert('Success', 'Profile updated successfully!')
      console.log('✅ Profile save completed successfully')
    } catch (error) {
      console.error('Failed to update profile:', error)
      showAlert('Error', 'Failed to update profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const saveProfileWithPlanChange = async () => {
    try {
      setSaving(true)
      
      // First update the profile
      const updatedProfile = {
        ...userProfile!,
        displayName: formData.displayName,
        profile: {
          ...userProfile!.profile,
          age: formData.age ? parseInt(formData.age) : undefined,
          height: formData.height ? parseInt(formData.height) : undefined,
          currentWeight: formData.currentWeight ? parseInt(formData.currentWeight) : undefined,
          goalWeight: formData.goalWeight ? parseInt(formData.goalWeight) : undefined,
          healthGoals: formData.healthGoals,
        }
      }

      await UserService.updateUser(user!.uid, updatedProfile)
      
      // Switch the health plan
      await PlanGenerationService.switchHealthPlan(user!.uid, formData.healthGoals)
      
      setUserProfile(updatedProfile)
      setEditMode(false)
      
      showAlert('Success', 'Profile and health plan updated successfully!')
    } catch (error) {
      console.error('Failed to update profile with plan change:', error)
      showAlert('Error', 'Failed to update profile and health plan. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    // Reset form data to original values
    setFormData({
      displayName: userProfile?.displayName || '',
      age: userProfile?.profile?.age?.toString() || '',
      height: userProfile?.profile?.height?.toString() || '',
      currentWeight: userProfile?.profile?.currentWeight?.toString() || '',
      goalWeight: userProfile?.profile?.goalWeight?.toString() || '',
      healthGoals: userProfile?.profile?.healthGoals || '',
    })
    setEditMode(false)
  }

  // Health Goal Picker Modal Component
  const HealthGoalPickerModal = () => (
    <Modal
      visible={showHealthGoalPicker}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowHealthGoalPicker(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Select Health Goal</Text>
          <ScrollView style={styles.optionsList}>
            {healthGoalOptions.map((option) => (
              <TouchableOpacity
                key={option}
                style={styles.optionItem}
                onPress={() => {
                  setFormData(prev => ({ ...prev, healthGoals: option }))
                  setShowHealthGoalPicker(false)
                }}
              >
                <Text style={styles.optionText}>{option}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity 
            style={styles.cancelButton} 
            onPress={() => setShowHealthGoalPicker(false)}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )

  if (loading) {
    return (
      <ProtectedRoute>
        <MainLayout
          title="Profile"
          activeRoute="profile"
          onNavigate={handleNavigate}
          onLogout={handleLogout}
          user={user}
        >
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={styles.loadingText}>Loading profile...</Text>
          </View>
        </MainLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <MainLayout
        title="Profile"
        activeRoute="profile"
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        user={user}
      >
        <ScrollView style={styles.container}>
          <View style={styles.profileSection}>
            <View style={styles.profileHeader}>
              <View style={styles.avatarContainer}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {userProfile?.displayName?.charAt(0)?.toUpperCase() || 'U'}
                  </Text>
                </View>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.userName}>{userProfile?.displayName || 'User'}</Text>
                <Text style={styles.userEmail}>{userProfile?.email}</Text>
              </View>
              <TouchableOpacity 
                style={styles.editButton}
                onPress={() => setEditMode(!editMode)}
              >
                <EditIcon size={20} color="#10B981" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Personal Information</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Display Name</Text>
              <TextInput
                style={[styles.input, !editMode && styles.inputDisabled]}
                value={formData.displayName}
                onChangeText={(text) => setFormData(prev => ({ ...prev, displayName: text }))}
                placeholder="Enter your display name"
                editable={editMode}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Age</Text>
              <TextInput
                style={[styles.input, !editMode && styles.inputDisabled]}
                value={formData.age}
                onChangeText={(text) => setFormData(prev => ({ ...prev, age: text }))}
                placeholder="Enter your age"
                keyboardType="numeric"
                editable={editMode}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Height (cm)</Text>
              <TextInput
                style={[styles.input, !editMode && styles.inputDisabled]}
                value={formData.height}
                onChangeText={(text) => setFormData(prev => ({ ...prev, height: text }))}
                placeholder="Enter your height in cm"
                keyboardType="numeric"
                editable={editMode}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Current Weight (kg)</Text>
              <TextInput
                style={[styles.input, !editMode && styles.inputDisabled]}
                value={formData.currentWeight}
                onChangeText={(text) => setFormData(prev => ({ ...prev, currentWeight: text }))}
                placeholder="Enter your current weight"
                keyboardType="numeric"
                editable={editMode}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Goal Weight (kg)</Text>
              <TextInput
                style={[styles.input, !editMode && styles.inputDisabled]}
                value={formData.goalWeight}
                onChangeText={(text) => setFormData(prev => ({ ...prev, goalWeight: text }))}
                placeholder="Enter your goal weight"
                keyboardType="numeric"
                editable={editMode}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Health Goals</Text>
              <TouchableOpacity
                style={[styles.input, styles.pickerInput, !editMode && styles.inputDisabled]}
                onPress={() => editMode && setShowHealthGoalPicker(true)}
                disabled={!editMode}
              >
                <Text style={[styles.pickerText, !formData.healthGoals && styles.placeholderText]}>
                  {formData.healthGoals || 'Select your health goal'}
                </Text>
              </TouchableOpacity>
            </View>

            {editMode && (
              <View style={styles.buttonGroup}>
                <TouchableOpacity 
                  style={styles.cancelButton} 
                  onPress={handleCancel}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.saveButton, saving && styles.saveButtonDisabled]} 
                  onPress={handleSave}
                  disabled={saving}
                >
                  <Text style={styles.saveButtonText}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <HealthGoalPickerModal />
          
          {/* Custom Alert */}
          {alertConfig && (
            <CustomAlert
              visible={alertVisible}
              title={alertConfig.title}
              message={alertConfig.message}
              buttons={alertConfig.buttons}
              onClose={hideAlert}
            />
          )}
        </ScrollView>
      </MainLayout>
    </ProtectedRoute>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#64748B',
  },
  profileSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#64748B',
  },
  editButton: {
    padding: 8,
  },
  formSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
  },
  inputDisabled: {
    backgroundColor: '#F3F4F6',
    color: '#6B7280',
  },
  pickerInput: {
    justifyContent: 'center',
  },
  pickerText: {
    fontSize: 16,
    color: '#1F2937',
  },
  placeholderText: {
    color: '#9CA3AF',
  },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 10,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 10,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  optionsList: {
    maxHeight: 300,
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
}) 