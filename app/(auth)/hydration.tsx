import { useRouter } from 'expo-router'
import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native'
import {
  CalendarIcon,
  CloseIcon,
  DeleteIcon,
  DropletIcon,
  EditIcon,
  PlusIcon,
  TargetIcon,
  WaterIcon
} from '../../components/icons/IconComponents'
import { ProtectedRoute } from '../../components/ProtectedRoute'
import { useAuth } from '../../hooks/useAuth'
import { MainLayout } from '../../layouts/MainLayout'
import { GoalCalculationService } from '../../services/goalCalculationService'
import { HydrationService } from '../../services/hydrationService'
import { PlanGenerationService } from '../../services/planGenerationService'
import { DailyHydrationSummary, DrinkType, WaterEntry } from '../../types/hydration'

const { width } = Dimensions.get('window')

export default function Hydration() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [dailySummary, setDailySummary] = useState<DailyHydrationSummary | null>(null)
  const [currentPlan, setCurrentPlan] = useState<any>(null)
  const [showPlanInfo, setShowPlanInfo] = useState(false)
  
  // Date management - ensure we use the same timezone logic
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date()
    // Use local date, not UTC
    const year = today.getFullYear()
    const month = (today.getMonth() + 1).toString().padStart(2, '0')
    const day = today.getDate().toString().padStart(2, '0')
    const dateString = `${year}-${month}-${day}`
    console.log('🗓️ Initializing selectedDate:', dateString)
    return dateString
  })
  
  // Modal states
  const [showAddWater, setShowAddWater] = useState(false)
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [showEditEntry, setShowEditEntry] = useState(false)
  const [editingEntry, setEditingEntry] = useState<WaterEntry | null>(null)
  
  // Form states
  const [selectedDrinkType, setSelectedDrinkType] = useState<DrinkType>(HydrationService.DRINK_TYPES[0])
  const [waterAmount, setWaterAmount] = useState('')
  const [note, setNote] = useState('')
  const [customGoal, setCustomGoal] = useState('')
  
  // Loading states
  const [addingWater, setAddingWater] = useState(false)
  const [updatingGoal, setUpdatingGoal] = useState(false)

  useEffect(() => {
    console.log('🔄 Hydration component mounted or user/selectedDate changed')
    console.log('👤 User:', user?.uid)
    console.log('📅 Selected date:', selectedDate)
    
    if (user) {
      loadDailySummary()
    }
  }, [user, selectedDate])

  useEffect(() => {
    if (user?.uid) {
      loadCurrentPlan()
    }
  }, [user?.uid])

  const loadDailySummary = async () => {
    if (!user) return
    
    try {
      setLoading(true)
      console.log('🔄 Loading daily hydration summary for:', user.uid, selectedDate)
      console.log('📅 Selected date details:', {
        selectedDate,
        dateObject: new Date(selectedDate + 'T00:00:00'), // Add time to avoid timezone issues
        today: new Date().toISOString().split('T')[0],
        todayLocal: (() => {
          const now = new Date()
          return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`
        })()
      })
      
      const summary = await HydrationService.getDailySummary(user.uid, selectedDate)
      
      console.log('✅ Daily hydration summary loaded:', {
        totalEntries: summary.entries.length,
        totalConsumed: summary.totalConsumed,
        targetAmount: summary.targetAmount,
        percentage: summary.percentageComplete,
        entries: summary.entries.map(e => ({ id: e.id, amount: e.amount, type: e.drinkType, date: e.date }))
      })
      
      setDailySummary(summary)
    } catch (error) {
      console.error('❌ Error loading daily hydration summary:', error)
      Alert.alert('Error', 'Failed to load hydration data')
    } finally {
      setLoading(false)
    }
  }

  const loadCurrentPlan = async () => {
    if (!user?.uid) return
    
    try {
      const plan = await PlanGenerationService.getCurrentPlan(user.uid)
      setCurrentPlan(plan)
    } catch (error) {
      console.error('❌ Error loading current plan:', error)
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
      case 'settings':
        router.push('/(auth)/settings')
        break
      default:
        console.log('Unknown route:', route)
        Alert.alert('Navigation Error', `Route "${route}" not found`)
    }
  }

  const handleLogout = async () => {
    try {
      console.log('🔄 Logging out...')
      await logout()
      console.log('✅ Logout successful')
    } catch (error) {
      console.error('❌ Logout error:', error)
      Alert.alert('Error', 'Failed to logout')
    }
  }

  const addWaterEntry = async () => {
    if (!user || !waterAmount) {
      Alert.alert('Error', 'Please enter a valid amount')
      return
    }

    const amount = parseFloat(waterAmount)
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount')
      return
    }

    try {
      setAddingWater(true)
      console.log('💧 Adding water entry:', { 
        userId: user.uid, 
        amount, 
        drinkType: selectedDrinkType.id, 
        note,
        selectedDate,
        todayLocal: (() => {
          const now = new Date()
          return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`
        })()
      })
      
      const newEntry = await HydrationService.addWaterEntry(
        user.uid,
        amount,
        selectedDrinkType.id,
        note
      )
      
      console.log('✅ Water entry added successfully:', newEntry)
      console.log('📅 Entry date vs selected date:', newEntry.date, 'vs', selectedDate)
      
      // Reset form
      setWaterAmount('')
      setNote('')
      setShowAddWater(false)
      
      // Small delay before reloading to ensure Firestore consistency
      setTimeout(async () => {
        console.log('🔄 Reloading daily summary after adding entry...')
        await loadDailySummary()
      }, 500)
      
    } catch (error) {
      console.error('❌ Error adding water entry:', error)
      Alert.alert('Error', 'Failed to add water entry')
    } finally {
      setAddingWater(false)
    }
  }

  const updateWaterEntry = async () => {
    if (!editingEntry || !waterAmount) {
      Alert.alert('Error', 'Please enter a valid amount')
      return
    }

    const amount = parseFloat(waterAmount)
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount')
      return
    }

    try {
      setAddingWater(true)
      console.log('💧 Updating water entry:', editingEntry.id, { amount, drinkType: selectedDrinkType.id, note })
      
      await HydrationService.updateWaterEntry(editingEntry.id, {
        amount,
        drinkType: selectedDrinkType.id,
        note,
        updatedAt: new Date()
      })
      
      console.log('✅ Water entry updated successfully')
      
      // Reset form
      setWaterAmount('')
      setNote('')
      setEditingEntry(null)
      setShowEditEntry(false)
      
      // Reload data
      await loadDailySummary()
      
    } catch (error) {
      console.error('❌ Error updating water entry:', error)
      Alert.alert('Error', 'Failed to update water entry')
    } finally {
      setAddingWater(false)
    }
  }

  const deleteWaterEntry = async (entry: WaterEntry) => {
    console.log('🗑️ DELETE BUTTON PRESSED FOR ENTRY:', entry.id)
    console.log('🗑️ Entry details:', entry)
    
    // For web, use window.confirm instead of Alert.alert
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`Are you sure you want to delete this ${formatAmount(entry.amount)} entry?`)
      if (!confirmed) {
        console.log('🗑️ Delete cancelled')
        return
      }
      
      console.log('🗑️ Delete confirmed via window.confirm, starting deletion process...')
      await performDelete(entry)
    } else {
      // For mobile, use Alert.alert
      Alert.alert(
        'Delete Entry',
        `Are you sure you want to delete this ${formatAmount(entry.amount)} entry?`,
        [
          { 
            text: 'Cancel', 
            style: 'cancel',
            onPress: () => console.log('🗑️ Delete cancelled')
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              console.log('🗑️ Delete confirmed via Alert.alert, starting deletion process...')
              await performDelete(entry)
            }
          }
        ]
      )
    }
  }

  const performDelete = async (entry: WaterEntry) => {
    try {
      console.log('🗑️ Starting actual deletion for entry:', entry.id)
      
      // Add loading state to prevent double-taps
      setLoading(true)
      
      await HydrationService.deleteWaterEntry(entry.id)
      console.log('✅ Water entry deleted successfully from Firestore')
      
      // Immediately update UI by removing the entry from the current state
      setDailySummary(prev => {
        if (!prev) return prev
        
        const drinkType = HydrationService.getDrinkTypeById(entry.drinkType)
        const hydrationValue = drinkType?.hydrationValue || 1
        const effectiveAmount = entry.amount * hydrationValue
        const newTotalConsumed = prev.totalConsumed - effectiveAmount
        
        return {
          ...prev,
          entries: prev.entries.filter(e => e.id !== entry.id),
          totalConsumed: Math.max(0, newTotalConsumed),
          percentageComplete: prev.targetAmount > 0 ? Math.min((newTotalConsumed / prev.targetAmount) * 100, 100) : 0
        }
      })
      
      console.log('✅ UI updated immediately')
      
      // Then reload the full summary to ensure consistency
      setTimeout(async () => {
        console.log('🔄 Reloading summary after delete...')
        await loadDailySummary()
        console.log('✅ Summary reloaded after delete')
      }, 500)
      
    } catch (error) {
      console.error('❌ Error deleting water entry:', error)
      Alert.alert('Error', 'Failed to delete water entry. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const updateHydrationGoal = async () => {
    if (!user) {
      Alert.alert('Error', 'User not found')
      return
    }

    const goalAmount = customGoal ? parseFloat(customGoal) : undefined
    if (goalAmount && (isNaN(goalAmount) || goalAmount <= 0)) {
      Alert.alert('Error', 'Please enter a valid goal amount')
      return
    }

    try {
      setUpdatingGoal(true)
      console.log('🎯 Updating hydration goal:', goalAmount)
      
      await HydrationService.setUserHydrationGoal(user.uid, user, goalAmount)
      
      console.log('✅ Hydration goal updated successfully')
      setCustomGoal('')
      setShowGoalModal(false)
      await loadDailySummary()
      
    } catch (error) {
      console.error('❌ Error updating hydration goal:', error)
      Alert.alert('Error', 'Failed to update hydration goal')
    } finally {
      setUpdatingGoal(false)
    }
  }

  const openEditEntry = (entry: WaterEntry) => {
    const drinkType = HydrationService.getDrinkTypeById(entry.drinkType) || HydrationService.DRINK_TYPES[0]
    setEditingEntry(entry)
    setSelectedDrinkType(drinkType)
    setWaterAmount(entry.amount.toString())
    setNote(entry.note || '')
    setShowEditEntry(true)
  }

  const getProgressColor = (percentage: number): string => {
    if (percentage >= 100) return '#10B981' // Green
    if (percentage >= 75) return '#3B82F6'  // Blue
    if (percentage >= 50) return '#F59E0B'  // Yellow
    return '#EF4444' // Red
  }

  const formatTime = (date: Date): string => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatAmount = (amount: number): string => {
    if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}L`
    }
    return `${amount}ml`
  }

  const renderDrinkTypeSelector = () => (
    <View style={styles.drinkTypeContainer}>
      <Text style={styles.drinkTypeTitle}>Drink Type</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.drinkTypeScroll}>
        {HydrationService.DRINK_TYPES.map((drink) => (
          <TouchableOpacity
            key={drink.id}
            style={[
              styles.drinkTypeItem,
              { borderColor: drink.color },
              selectedDrinkType.id === drink.id && { backgroundColor: drink.color + '20', borderWidth: 2 }
            ]}
            onPress={() => setSelectedDrinkType(drink)}
          >
            <Text style={styles.drinkTypeIcon}>{drink.icon}</Text>
            <Text style={[styles.drinkTypeName, { color: drink.color }]}>{drink.name}</Text>
            <Text style={styles.drinkTypeAmount}>{drink.defaultAmount}ml</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  )

  const renderProgressRing = () => {
    if (!dailySummary) return null

    const progress = Math.min(dailySummary.percentageComplete, 100)
    const color = getProgressColor(progress)

    return (
      <View style={styles.progressContainer}>
        <View style={[styles.progressRing, { borderColor: color }]}>
          <View style={styles.progressCenter}>
            <WaterIcon size={40} color={color} />
            <Text style={[styles.progressPercentage, { color }]}>
              {Math.round(progress)}%
            </Text>
            <Text style={styles.progressLabel}>Daily Goal</Text>
          </View>
        </View>
        <View style={styles.progressStats}>
          <Text style={styles.progressAmount}>
            {formatAmount(dailySummary.totalConsumed)} / {formatAmount(dailySummary.targetAmount)}
          </Text>
          <Text style={styles.progressRemaining}>
            {dailySummary.totalConsumed >= dailySummary.targetAmount 
              ? '🎉 Goal completed!' 
              : `${formatAmount(dailySummary.targetAmount - dailySummary.totalConsumed)} remaining`
            }
          </Text>
        </View>
      </View>
    )
  }

  const renderQuickAddButtons = () => {
    const quickAmounts = [200, 250, 500, 750]
    
    return (
      <View style={styles.quickAddContainer}>
        <Text style={styles.quickAddTitle}>Quick Add</Text>
        <View style={styles.quickAddButtons}>
          {quickAmounts.map((amount) => (
            <TouchableOpacity
              key={amount}
              style={styles.quickAddButton}
              onPress={async () => {
                if (user) {
                  try {
                    setAddingWater(true)
                    await HydrationService.addWaterEntry(user.uid, amount, 'water')
                    await loadDailySummary()
                  } catch (error) {
                    Alert.alert('Error', 'Failed to add water entry')
                  } finally {
                    setAddingWater(false)
                  }
                }
              }}
            >
              <DropletIcon size={20} color="#3B82F6" />
              <Text style={styles.quickAddButtonText}>{formatAmount(amount)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    )
  }

  const renderEntryItem = (entry: WaterEntry) => {
    const drinkType = HydrationService.getDrinkTypeById(entry.drinkType)
    
    console.log('🎨 Rendering entry item:', entry.id, entry.amount)
    
    return (
      <View key={entry.id} style={styles.entryItem}>
        <View style={styles.entryLeft}>
          <View style={[styles.entryIcon, { backgroundColor: drinkType?.color + '20' }]}>
            <Text style={styles.entryIconText}>{drinkType?.icon}</Text>
          </View>
          <View style={styles.entryInfo}>
            <Text style={styles.entryAmount}>{formatAmount(entry.amount)}</Text>
            <Text style={styles.entryType}>{drinkType?.name}</Text>
            <Text style={styles.entryTime}>{formatTime(entry.timeConsumed)}</Text>
            {entry.note && <Text style={styles.entryNote}>{entry.note}</Text>}
          </View>
        </View>
        <View style={styles.entryActions}>
          <TouchableOpacity
            style={[styles.entryActionButton, styles.editActionButton]}
            onPress={() => {
              console.log('✏️ Edit button pressed for entry:', entry.id)
              openEditEntry(entry)
            }}
          >
            <EditIcon size={18} color="#6B7280" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.entryActionButton, styles.deleteActionButton]}
            onPress={() => {
              console.log('🗑️ Delete button pressed for entry:', entry.id)
              deleteWaterEntry(entry)
            }}
            activeOpacity={0.7}
          >
            <DeleteIcon size={18} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  // Add hydration tips function
  const getHydrationTips = (healthGoal: string): string[] => {
    const tips = {
      'Lose Weight': [
        'Drink water before meals to feel fuller',
        'Replace sugary drinks with water',
        'Stay hydrated during cardio workouts'
      ],
      'Gain Weight': [
        'Don\'t fill up on water before meals',
        'Include electrolytes during workouts',
        'Drink smoothies for extra calories'
      ],
      'Build Muscle': [
        'Hydration supports protein synthesis',
        'Drink extra water during strength training',
        'Proper hydration aids recovery'
      ],
      'Improve Fitness': [
        'Maintain hydration during exercise',
        'Monitor urine color for hydration status',
        'Drink consistently throughout the day'
      ],
    }
    return tips[healthGoal as keyof typeof tips] || []
  }

  // Add plan info modal component
  const PlanInfoModal = () => (
    <Modal
      visible={showPlanInfo}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowPlanInfo(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.planInfoModal}>
          <View style={styles.planInfoHeader}>
            <Text style={styles.planInfoTitle}>Your Hydration Plan</Text>
            <TouchableOpacity onPress={() => setShowPlanInfo(false)}>
              <CloseIcon size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>
          
          {currentPlan && (
            <ScrollView style={styles.planInfoContent}>
              <View style={styles.planInfoSection}>
                <Text style={styles.planInfoSectionTitle}>Health Goal: {currentPlan.healthGoal}</Text>
                
                <View style={styles.planInfoItem}>
                  <Text style={styles.planInfoLabel}>Daily Water Target:</Text>
                  <Text style={styles.planInfoValue}>{formatAmount(currentPlan.hydrationGoal)}</Text>
                </View>
                
                <View style={styles.planInfoItem}>
                  <Text style={styles.planInfoLabel}>Based on:</Text>
                  <Text style={styles.planInfoValue}>Body weight & activity</Text>
                </View>
              </View>
              
              <View style={styles.planTips}>
                <Text style={styles.planTipsTitle}>💧 Hydration Tips</Text>
                {getHydrationTips(currentPlan.healthGoal).map((tip, index) => (
                  <View key={index} style={styles.tipItem}>
                    <Text style={styles.tipBullet}>•</Text>
                    <Text style={styles.tipText}>{tip}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  )

  if (loading) {
    return (
      <ProtectedRoute>
        <MainLayout
          title="Hydration"
          activeRoute="hydration"
          onNavigate={handleNavigate}
          onLogout={handleLogout}
          user={user}
        >
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingText}>Loading hydration data...</Text>
          </View>
        </MainLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <MainLayout
        title="Hydration"
        activeRoute="hydration"
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        user={user}
      >
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
          {/* Add Plan Info Header */}
          {currentPlan && (
            <View style={styles.planHeader}>
              <View style={styles.planHeaderLeft}>
                <Text style={styles.planHeaderTitle}>Plan: {currentPlan.healthGoal}</Text>
                <Text style={styles.planHeaderSubtitle}>
                  Target: {formatAmount(currentPlan.hydrationGoal)} daily
                </Text>
              </View>
              <TouchableOpacity 
                style={styles.planInfoButton}
                onPress={() => setShowPlanInfo(true)}
              >
                <Text style={styles.planInfoButtonText}>View Plan</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Header Actions */}
          <View style={styles.header}>
            <View style={styles.dateContainer}>
              <CalendarIcon size={20} color="#6B7280" />
              <Text style={styles.dateText}>
                {new Date(selectedDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric'
                })}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.goalButton}
              onPress={() => setShowGoalModal(true)}
            >
              <TargetIcon size={18} color="#3B82F6" />
              <Text style={styles.goalButtonText}>Goal</Text>
            </TouchableOpacity>
          </View>

          {/* Progress Ring */}
          {renderProgressRing()}

          {/* Quick Add Buttons */}
          {renderQuickAddButtons()}

          {/* Today's Entries */}
          <View style={styles.entriesSection}>
            <View style={styles.entriesHeader}>
              <Text style={styles.entriesTitle}>Today's Hydration</Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setShowAddWater(true)}
              >
                <PlusIcon size={20} color="#FFFFFF" />
                <Text style={styles.addButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
            
            {dailySummary?.entries.length === 0 ? (
              <View style={styles.emptyState}>
                <WaterIcon size={48} color="#D1D5DB" />
                <Text style={styles.emptyStateTitle}>No water logged today</Text>
                <Text style={styles.emptyStateSubtitle}>Start tracking your hydration!</Text>
              </View>
            ) : (
              <View style={styles.entriesList}>
                {dailySummary?.entries.map(renderEntryItem)}
              </View>
            )}
          </View>
        </ScrollView>

        {/* Add Water Modal */}
        <Modal
          visible={showAddWater}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowAddWater(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Water Intake</Text>
              <TouchableOpacity onPress={() => setShowAddWater(false)}>
                <CloseIcon size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {renderDrinkTypeSelector()}

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Amount (ml)</Text>
                <TextInput
                  style={styles.formInput}
                  value={waterAmount}
                  onChangeText={setWaterAmount}
                  placeholder={`${selectedDrinkType.defaultAmount}`}
                  keyboardType="numeric"
                  maxLength={4}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Note (optional)</Text>
                <TextInput
                  style={[styles.formInput, styles.formTextArea]}
                  value={note}
                  onChangeText={setNote}
                  placeholder="Add a note..."
                  multiline
                  numberOfLines={3}
                />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setShowAddWater(false)}
              >
                <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={addWaterEntry}
                disabled={addingWater}
              >
                {addingWater ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalButtonPrimaryText}>Add Entry</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Edit Water Modal */}
        <Modal
          visible={showEditEntry}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowEditEntry(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Water Entry</Text>
              <View style={styles.modalHeaderActions}>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => editingEntry && deleteWaterEntry(editingEntry)}
                >
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowEditEntry(false)}>
                  <CloseIcon size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={styles.modalContent}>
              {renderDrinkTypeSelector()}

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Amount (ml)</Text>
                <TextInput
                  style={styles.formInput}
                  value={waterAmount}
                  onChangeText={setWaterAmount}
                  placeholder={`${selectedDrinkType.defaultAmount}`}
                  keyboardType="numeric"
                  maxLength={4}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Note (optional)</Text>
                <TextInput
                  style={[styles.formInput, styles.formTextArea]}
                  value={note}
                  onChangeText={setNote}
                  placeholder="Add a note..."
                  multiline
                  numberOfLines={3}
                />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setShowEditEntry(false)}
              >
                <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={updateWaterEntry}
                disabled={addingWater}
              >
                {addingWater ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalButtonPrimaryText}>Update Entry</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Goal Setting Modal */}
        <Modal
          visible={showGoalModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowGoalModal(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Hydration Goal</Text>
              <TouchableOpacity onPress={() => setShowGoalModal(false)}>
                <CloseIcon size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.goalInfo}>
                <Text style={styles.goalInfoTitle}>Current Goal</Text>
                <Text style={styles.goalInfoAmount}>
                  {formatAmount(dailySummary?.targetAmount || 2000)}
                </Text>
                <Text style={styles.goalInfoDescription}>
                  Based on your health goal: {user?.profile?.healthGoals || 'General Health'}
                </Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Custom Goal (ml)</Text>
                <TextInput
                  style={styles.formInput}
                  value={customGoal}
                  onChangeText={setCustomGoal}
                  placeholder="Enter custom goal (optional)"
                  keyboardType="numeric"
                  maxLength={4}
                />
                <Text style={styles.formHint}>
                  Leave empty to use recommended goal based on your profile
                </Text>
              </View>

              <View style={styles.recommendationBox}>
                <Text style={styles.recommendationTitle}>💡 Recommendation</Text>
                <Text style={styles.recommendationText}>
                  For your health goal and weight, we recommend{' '}
                  {user && user.profile ? formatAmount(GoalCalculationService.getRecommendedWaterIntake(
                    user, 
                    user.profile?.healthGoals || 'General Health'
                  )) : '2L'} per day.
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setShowGoalModal(false)}
              >
                <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={updateHydrationGoal}
                disabled={updatingGoal}
              >
                {updatingGoal ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalButtonPrimaryText}>Update Goal</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Add Plan Info Modal */}
        <PlanInfoModal />
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  goalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#EBF8FF',
    borderRadius: 8,
  },
  goalButtonText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '500',
    color: '#3B82F6',
  },
  progressContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  progressRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 8,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  progressCenter: {
    alignItems: 'center',
  },
  progressPercentage: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 4,
  },
  progressLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  progressStats: {
    alignItems: 'center',
    marginTop: 16,
  },
  progressAmount: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  progressRemaining: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  quickAddContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  quickAddTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  quickAddButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickAddButton: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#EBF8FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    minWidth: 70,
  },
  quickAddButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#3B82F6',
    marginTop: 4,
  },
  entriesSection: {
    backgroundColor: '#FFFFFF',
    paddingTop: 20,
  },
  entriesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  entriesTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#3B82F6',
    borderRadius: 8,
  },
  addButtonText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 20,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 16,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  entriesList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  entryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  entryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  entryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  entryIconText: {
    fontSize: 20,
  },
  entryInfo: {
    flex: 1,
  },
  entryAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  entryType: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  entryTime: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  entryNote: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    fontStyle: 'italic',
  },
  entryActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  entryActionButton: {
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 36,
    minHeight: 36,
  },
  editActionButton: {
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  deleteActionButton: {
    backgroundColor: '#FEF2F2',
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 12,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#EF4444',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  drinkTypeContainer: {
    marginBottom: 24,
  },
  drinkTypeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  drinkTypeScroll: {
    marginHorizontal: -8,
  },
  drinkTypeItem: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    minWidth: 80,
  },
  drinkTypeIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  drinkTypeName: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  drinkTypeAmount: {
    fontSize: 10,
    color: '#6B7280',
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
  },
  formTextArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  formHint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  modalActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonSecondary: {
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  modalButtonPrimary: {
    backgroundColor: '#3B82F6',
    marginLeft: 8,
  },
  modalButtonSecondaryText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  modalButtonPrimaryText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  goalInfo: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginBottom: 24,
  },
  goalInfoTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 8,
  },
  goalInfoAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3B82F6',
    marginBottom: 4,
  },
  goalInfoDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  recommendationBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
  },
  recommendationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 8,
  },
  recommendationText: {
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#06B6D4',
  },
  planHeaderLeft: {
    flex: 1,
  },
  planHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
  },
  planHeaderSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  planInfoButton: {
    backgroundColor: '#06B6D4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  planInfoButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  planInfoModal: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    marginTop: 'auto',
  },
  planInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  planInfoTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  planInfoContent: {
    padding: 20,
  },
  planInfoSection: {
    marginBottom: 20,
  },
  planInfoSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  planInfoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  planInfoLabel: {
    fontSize: 16,
    color: '#6B7280',
  },
  planInfoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  planTips: {
    backgroundColor: '#ECFEFF',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#06B6D4',
  },
  planTipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0891B2',
    marginBottom: 12,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  tipBullet: {
    fontSize: 16,
    color: '#06B6D4',
    marginRight: 8,
    marginTop: 2,
  },
  tipText: {
    fontSize: 14,
    color: '#0E7490',
    lineHeight: 20,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
})