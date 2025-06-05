import { router } from 'expo-router'
import React, { useEffect, useState } from 'react'
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native'
import {
    EditIcon
} from '../../components/icons/IconComponents'
import { ProtectedRoute } from '../../components/ProtectedRoute'
import { useAuth } from '../../hooks/useAuth'
import { MainLayout } from '../../layouts/MainLayout'
import { PlanGenerationService } from '../../services/planGenerationService'
import { UserService } from '../../services/userService'
import { User } from '../../types/user'

export default function Profile() {
  const { user, logout } = useAuth()
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
      Alert.alert('Error', 'Failed to load profile data')
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
      Alert.alert('Error', 'Failed to sign out. Please try again.')
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
      
      Alert.alert(
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
      
      Alert.alert('Success', 'Profile updated successfully!')
      console.log('✅ Profile save completed successfully')
    } catch (error) {
      console.error('Failed to update profile:', error)
      Alert.alert('Error', 'Failed to update profile. Please try again.')
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
      
      Alert.alert('Success', 'Profile and health plan updated successfully!')
    } catch (error) {
      console.error('Failed to update profile with plan change:', error)
      Alert.alert('Error', 'Failed to update profile and health plan. Please try again.')
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
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
          {/* Profile Header */}
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(userProfile?.displayName || 'User').charAt(0).toUpperCase()}
                </Text>
              </View>
            </View>
            <Text style={styles.userName}>{userProfile?.displayName || 'User'}</Text>
            <Text style={styles.userEmail}>{userProfile?.email}</Text>
            
            {!editMode && (
              <TouchableOpacity 
                style={styles.editButton}
                onPress={() => setEditMode(true)}
              >
                <EditIcon size={16} color="#10B981" />
                <Text style={styles.editButtonText}>Edit Profile</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Profile Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personal Information</Text>
            
            <View style={styles.infoCard}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Display Name</Text>
                {editMode ? (
                  <TextInput
                    style={styles.input}
                    value={formData.displayName}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, displayName: text }))}
                    placeholder="Enter your name"
                  />
                ) : (
                  <Text style={styles.infoValue}>{userProfile?.displayName || 'Not set'}</Text>
                )}
              </View>

              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Age</Text>
                {editMode ? (
                  <TextInput
                    style={styles.input}
                    value={formData.age}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, age: text }))}
                    placeholder="Enter your age"
                    keyboardType="numeric"
                  />
                ) : (
                  <Text style={styles.infoValue}>
                    {userProfile?.profile?.age ? `${userProfile.profile.age} years` : 'Not set'}
                  </Text>
                )}
              </View>

              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Height</Text>
                {editMode ? (
                  <TextInput
                    style={styles.input}
                    value={formData.height}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, height: text }))}
                    placeholder="Enter height in cm"
                    keyboardType="numeric"
                  />
                ) : (
                  <Text style={styles.infoValue}>
                    {userProfile?.profile?.height ? `${userProfile.profile.height} cm` : 'Not set'}
                  </Text>
                )}
              </View>

              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Current Weight</Text>
                {editMode ? (
                  <TextInput
                    style={styles.input}
                    value={formData.currentWeight}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, currentWeight: text }))}
                    placeholder="Enter weight in kg"
                    keyboardType="numeric"
                  />
                ) : (
                  <Text style={styles.infoValue}>
                    {userProfile?.profile?.currentWeight ? `${userProfile.profile.currentWeight} kg` : 'Not set'}
                  </Text>
                )}
              </View>

              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Goal Weight</Text>
                {editMode ? (
                  <TextInput
                    style={styles.input}
                    value={formData.goalWeight}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, goalWeight: text }))}
                    placeholder="Enter goal weight in kg"
                    keyboardType="numeric"
                  />
                ) : (
                  <Text style={styles.infoValue}>
                    {userProfile?.profile?.goalWeight ? `${userProfile.profile.goalWeight} kg` : 'Not set'}
                  </Text>
                )}
              </View>

              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Health Goal</Text>
                {editMode ? (
                  <TouchableOpacity 
                    style={styles.input}
                    onPress={() => setShowHealthGoalPicker(true)}
                  >
                    <Text style={[styles.inputText, !formData.healthGoals && styles.placeholder]}>
                      {formData.healthGoals || 'Select health goal'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.infoValue}>
                    {userProfile?.profile?.healthGoals || 'Not set'}
                  </Text>
                )}
              </View>

              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Gender</Text>
                <Text style={styles.infoValue}>
                  {userProfile?.profile?.gender || 'Not set'}
                </Text>
              </View>

              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Activity Level</Text>
                <Text style={styles.infoValue}>
                  {userProfile?.profile?.activityLevel || 'Not set'}
                </Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          {editMode && (
            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={handleCancel}
                disabled={saving}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* Health Goal Picker Modal */}
        <HealthGoalPickerModal />
      </MainLayout>
    </ProtectedRoute>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  profileHeader: {
    backgroundColor: '#ffffff',
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '700',
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 16,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
    marginLeft: 6,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  infoItem: {
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 6,
  },
  infoValue: {
    fontSize: 16,
    color: '#1F2937',
  },
  input: {
    fontSize: 16,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F9FAFB',
  },
  inputText: {
    fontSize: 16,
    color: '#1F2937',
  },
  placeholder: {
    color: '#9CA3AF',
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#10B981',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 12,
    width: '80%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  optionsList: {
    maxHeight: 200,
  },
  optionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#D1D5DB',
  },
  optionText: {
    fontSize: 16,
    color: '#1F2937',
  },
}) 