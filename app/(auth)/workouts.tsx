import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { useAuth } from '../../hooks/useAuth';
import { MainLayout } from '../../layouts/MainLayout';
import { PlanGenerationService } from '../../services/planGenerationService';
import {
    DailyWorkoutSummary,
    DayWorkoutPlan,
    Exercise,
    PlannedExercise,
    workoutService
} from '../../services/workoutService';

interface AddExerciseModalData {
  exercise: Exercise;
  sets: string;
  reps: string;
  duration: string;
  restTime: string;
  weight: string;
  notes: string;
}

type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export default function WorkoutsScreen() {
  const { user, logout } = useAuth();
  
  // State variables
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('Monday');
  const [weeklyPlan, setWeeklyPlan] = useState<Record<string, DayWorkoutPlan>>({});
  const [todaysSummary, setTodaysSummary] = useState<DailyWorkoutSummary | null>(null);
  const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
  const [showExerciseLibrary, setShowExerciseLibrary] = useState(false);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [addExerciseData, setAddExerciseData] = useState<AddExerciseModalData>({
    exercise: {} as Exercise,
    sets: '3',
    reps: '10',
    duration: '',
    restTime: '60',
    weight: '',
    notes: ''
  });
  const [showCompleteExerciseModal, setShowCompleteExerciseModal] = useState(false);
  const [selectedPlannedExercise, setSelectedPlannedExercise] = useState<{
    exercise: PlannedExercise;
    index: number;
  } | null>(null);
  const [completionWeight, setCompletionWeight] = useState('');
  const [completionNotes, setCompletionNotes] = useState('');
  const [apiStatus, setApiStatus] = useState<{
    isConfigured: boolean;
    message: string;
    exerciseCount?: number;
  } | null>(null);
  const [currentPlan, setCurrentPlan] = useState<any>(null)
  const [showPlanInfo, setShowPlanInfo] = useState(false)

  // Navigation handler for MainLayout
  const handleNavigate = (route: string) => {
    console.log('Navigating to:', route);
    switch (route) {
      case 'dashboard':
        router.push('/(auth)/dashboard');
        break;
      case 'nutrition':
        router.push('/(auth)/nutrition');
        break;
      case 'workouts':
        // Already on workouts page
        break;
      case 'sleep':
        console.log('💪 Workouts: Attempting to navigate to sleep...');
        console.log('💪 Workouts: Current route before navigation');
        try {
          router.push('/(auth)/sleep');
          console.log('💪 Workouts: Navigation to sleep initiated');
        } catch (error) {
          console.error('💪 Workouts: Navigation error:', error);
          Alert.alert('Navigation Error', 'Failed to navigate to sleep page');
        }
        break;
      case 'hydration':
        router.push('/(auth)/hydration');
        break;
      case 'settings':
        Alert.alert('Coming Soon', 'Settings page is under development');
        break;
      default:
        console.log('Unknown route:', route);
    }
  };

  // Get current day of week - fixed to return correct day
  const getCurrentDayOfWeek = (): DayOfWeek => {
    const days: DayOfWeek[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = new Date().getDay();
    return days[today];
  };

  // Load initial data
  useEffect(() => {
    if (user?.uid) {
      loadWorkoutData();
      checkApiStatus();
      loadCurrentPlan();
    }
  }, [user?.uid]);

  const checkApiStatus = async () => {
    try {
      const status = await workoutService.checkApiStatus();
      setApiStatus(status);
    } catch (error) {
      console.error('Error checking API status:', error);
    }
  };

  const loadWorkoutData = async () => {
    if (!user?.uid) return;
    
    try {
      setLoading(true);
      
      // Load today's summary
      const summary = await workoutService.getTodaysWorkoutSummary(user.uid);
      setTodaysSummary(summary);
      
      // Load weekly plan
      const weekly = await workoutService.getWeeklyWorkoutPlan(user.uid);
      setWeeklyPlan(weekly);
      
      // Set current day as selected
      setSelectedDay(getCurrentDayOfWeek());
      
    } catch (error) {
      console.error('Error loading workout data:', error);
      Alert.alert('Error', 'Failed to load workout data');
    } finally {
      setLoading(false);
    }
  };

  const loadExercises = async () => {
    try {
      setLoading(true);
      const exerciseList = await workoutService.searchExercises(undefined, undefined, searchQuery);
      setExercises(exerciseList);
    } catch (error) {
      console.error('Error loading exercises:', error);
      Alert.alert('Error', 'Failed to load exercises');
    } finally {
      setLoading(false);
    }
  };

  const handleAddExercise = async () => {
    if (!user?.uid) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    if (!addExerciseData.exercise.name) {
      Alert.alert('Error', 'Please select an exercise');
      return;
    }

    // Validate required fields
    if (!addExerciseData.sets || parseInt(addExerciseData.sets) < 1) {
      Alert.alert('Error', 'Please enter a valid number of sets');
      return;
    }

    if (!addExerciseData.reps || parseInt(addExerciseData.reps) < 1) {
      Alert.alert('Error', 'Please enter a valid number of reps');
      return;
    }

    try {
      setLoading(true);
      
      // Parse and validate optional numeric fields
      const duration = addExerciseData.duration && addExerciseData.duration.trim() !== '' 
        ? parseInt(addExerciseData.duration) 
        : undefined;
      
      const weight = addExerciseData.weight && addExerciseData.weight.trim() !== '' 
        ? parseFloat(addExerciseData.weight) 
        : undefined;
      
      const notes = addExerciseData.notes && addExerciseData.notes.trim() !== '' 
        ? addExerciseData.notes.trim() 
        : undefined;
      
      console.log('Adding exercise with cleaned data:', {
        exercise: addExerciseData.exercise.name,
        sets: parseInt(addExerciseData.sets),
        reps: parseInt(addExerciseData.reps),
        duration,
        restTime: parseInt(addExerciseData.restTime) || 60,
        weight,
        notes,
        selectedDay
      });
      
      await workoutService.addExerciseToDayPlan(
        user.uid,
        selectedDay,
        addExerciseData.exercise,
        parseInt(addExerciseData.sets),
        parseInt(addExerciseData.reps),
        duration, // Will be undefined if not provided
        parseInt(addExerciseData.restTime) || 60,
        weight, // Will be undefined if not provided
        notes // Will be undefined if not provided
      );

      // Reset form
      setAddExerciseData({
        exercise: {} as Exercise,
        sets: '3',
        reps: '10',
        duration: '',
        restTime: '60',
        weight: '',
        notes: ''
      });

      setShowAddExerciseModal(false);
      setShowExerciseLibrary(false);
      
      // Reload data to show the new exercise
      await loadWorkoutData();
      
      Alert.alert('Success', `${addExerciseData.exercise.name} added to ${selectedDay}!`);
      
      console.log('✅ Exercise added successfully and data reloaded');
    } catch (error) {
      console.error('❌ Error adding exercise:', error);
      Alert.alert('Error', `Failed to add exercise: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteExercise = async () => {
    if (!user?.uid || !selectedPlannedExercise) return;

    try {
      setLoading(true);
      
      await workoutService.markExerciseCompleted(
        user.uid,
        selectedDay,
        selectedPlannedExercise.index,
        parseFloat(completionWeight) || undefined,
        completionNotes
      );

      setShowCompleteExerciseModal(false);
      setSelectedPlannedExercise(null);
      setCompletionWeight('');
      setCompletionNotes('');
      
      // Reload data
      await loadWorkoutData();
      
      Alert.alert('Success', 'Exercise completed!');
    } catch (error) {
      console.error('Error completing exercise:', error);
      Alert.alert('Error', 'Failed to mark exercise as completed');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveExercise = async (exerciseIndex: number) => {
    if (!user?.uid) return;

    Alert.alert(
      'Remove Exercise',
      'Are you sure you want to remove this exercise from your plan?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await workoutService.removeExerciseFromDayPlan(user.uid, selectedDay, exerciseIndex);
              await loadWorkoutData();
              Alert.alert('Success', 'Exercise removed from your plan');
            } catch (error) {
              console.error('Error removing exercise:', error);
              Alert.alert('Error', 'Failed to remove exercise');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const filteredExercises = exercises.filter(exercise =>
    exercise.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    exercise.bodyPart?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    exercise.target?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderApiStatus = () => {
    if (!apiStatus) return null;

    return (
      <View style={[
        styles.apiStatusContainer,
        { backgroundColor: apiStatus.isConfigured ? '#F0FDF4' : '#FEF3C7' }
      ]}>
        <Ionicons
          name={apiStatus.isConfigured ? 'checkmark-circle' : 'warning'}
          size={20}
          color={apiStatus.isConfigured ? '#10B981' : '#F59E0B'}
        />
        <Text style={[
          styles.apiStatusText,
          { color: apiStatus.isConfigured ? '#065F46' : '#92400E' }
        ]}>
          {apiStatus.message}
          {apiStatus.exerciseCount && ` (${apiStatus.exerciseCount} exercises available)`}
        </Text>
      </View>
    );
  };

  const renderTodaysSummary = () => {
    // Add debug logging
    console.log('Today\'s Summary Data:', {
      todaysSummary,
      plannedCount: todaysSummary?.plannedExercises?.length || 0,
      completedCount: todaysSummary?.completedExercises?.length || 0,
      progressPercentage: todaysSummary?.progressPercentage || 0
    });

    if (!todaysSummary) return null;

    const totalPlanned = todaysSummary.plannedExercises?.length || 0;
    const totalCompleted = todaysSummary.completedExercises?.length || 0;
    const progressPercentage = totalPlanned > 0 ? Math.round((totalCompleted / totalPlanned) * 100) : 0;

    return (
      <View style={styles.todayCard}>
        <Text style={styles.cardTitle}>Today's Progress</Text>
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progressPercentage}%` }]} />
          </View>
          <Text style={styles.progressText}>{progressPercentage}% Complete</Text>
        </View>
        <View style={styles.summaryStats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{totalCompleted}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{totalPlanned}</Text>
            <Text style={styles.statLabel}>Planned</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{Math.round(todaysSummary.totalCaloriesBurned || 0)}</Text>
            <Text style={styles.statLabel}>Calories</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderWeeklyPlan = () => {
    const days: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const today = getCurrentDayOfWeek();

    return (
      <View style={styles.weeklyPlanCard}>
        <Text style={styles.cardTitle}>Weekly Plan</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.daysContainer}>
          {days.map((day) => {
            const dayPlan = weeklyPlan[day];
            const isToday = day === today;
            const isSelected = day === selectedDay;
            const exerciseCount = dayPlan?.exercises?.length || 0;

            return (
              <TouchableOpacity
                key={day}
                style={[
                  styles.dayCard,
                  isSelected && styles.selectedDayCard,
                  isToday && styles.todayDayCard
                ]}
                onPress={() => setSelectedDay(day)}
              >
                <Text style={[
                  styles.dayName,
                  isSelected && styles.selectedDayName,
                  isToday && styles.todayDayName
                ]}>
                  {day.substring(0, 3)}
                </Text>
                <Text style={[
                  styles.exerciseCount,
                  isSelected && styles.selectedExerciseCount
                ]}>
                  {exerciseCount} exercises
                </Text>
                {isToday && <View style={styles.todayIndicator} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const renderSelectedDayPlan = () => {
    const dayPlan = weeklyPlan[selectedDay];

    return (
      <View style={styles.dayPlanCard}>
        <View style={styles.dayPlanHeader}>
          <Text style={styles.cardTitle}>{selectedDay} Workout</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowAddExerciseModal(true)}
          >
            <Ionicons name="add" size={24} color="white" />
          </TouchableOpacity>
        </View>

        {dayPlan?.exercises && dayPlan.exercises.length > 0 ? (
          <ScrollView style={styles.exercisesList}>
            {dayPlan.exercises.map((exercise, index) => (
              <View key={index} style={styles.exerciseCard}>
                <View style={styles.exerciseHeader}>
                  <View style={styles.exerciseInfo}>
                    <Text style={styles.exerciseName}>
                      {exercise.exerciseName || 'Unknown Exercise'}
                    </Text>
                    <Text style={styles.exerciseDetails}>
                      {exercise.sets || 0} sets × {exercise.reps || 0} reps
                      {exercise.duration && exercise.duration > 0 && ` • ${exercise.duration}min`}
                    </Text>
                  </View>
                  <View style={styles.exerciseActions}>
                    {exercise.completed ? (
                      <View style={styles.completedBadge}>
                        <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                        <Text style={styles.completedText}>Done</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.completeButton}
                        onPress={() => {
                          setSelectedPlannedExercise({ exercise, index });
                          setShowCompleteExerciseModal(true);
                        }}
                      >
                        <Text style={styles.completeButtonText}>Complete</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => handleRemoveExercise(index)}
                    >
                      <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
                {exercise.notes && (
                  <Text style={styles.exerciseNotes}>{exercise.notes}</Text>
                )}
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="fitness-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyStateText}>No exercises planned for {selectedDay}</Text>
            <TouchableOpacity
              style={styles.addFirstExerciseButton}
              onPress={() => setShowAddExerciseModal(true)}
            >
              <Text style={styles.addFirstExerciseText}>Add your first exercise</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderAddExerciseModal = () => (
    <Modal visible={showAddExerciseModal} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.addExerciseModal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Exercise</Text>
            <TouchableOpacity onPress={() => {
              setShowAddExerciseModal(false);
              setShowExerciseLibrary(false);
              // Reset form when closing
              setAddExerciseData({
                exercise: {} as Exercise,
                sets: '3',
                reps: '10',
                duration: '',
                restTime: '60',
                weight: '',
                notes: ''
              });
            }}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {!showExerciseLibrary ? (
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={styles.browseButton}
                onPress={() => {
                  setShowExerciseLibrary(true);
                  loadExercises();
                }}
              >
                <Ionicons name="search" size={20} color="white" />
                <Text style={styles.browseButtonText}>Browse Exercise Library</Text>
              </TouchableOpacity>

              {addExerciseData.exercise.name && (
                <>
                  <View style={styles.selectedExercise}>
                    <Text style={styles.selectedExerciseName}>
                      {addExerciseData.exercise.name}
                    </Text>
                    <Text style={styles.selectedExerciseDetails}>
                      {addExerciseData.exercise.bodyPart || 'Unknown'} • {addExerciseData.exercise.target || 'Unknown'}
                    </Text>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Sets</Text>
                    <TextInput
                      style={styles.textInput}
                      value={addExerciseData.sets}
                      onChangeText={(value) => setAddExerciseData({...addExerciseData, sets: value})}
                      keyboardType="numeric"
                      placeholder="3"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Reps</Text>
                    <TextInput
                      style={styles.textInput}
                      value={addExerciseData.reps}
                      onChangeText={(value) => setAddExerciseData({...addExerciseData, reps: value})}
                      keyboardType="numeric"
                      placeholder="10"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Duration (minutes) - Optional</Text>
                    <TextInput
                      style={styles.textInput}
                      value={addExerciseData.duration}
                      onChangeText={(value) => setAddExerciseData({...addExerciseData, duration: value})}
                      keyboardType="numeric"
                      placeholder="30"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Rest Time (seconds)</Text>
                    <TextInput
                      style={styles.textInput}
                      value={addExerciseData.restTime}
                      onChangeText={(value) => setAddExerciseData({...addExerciseData, restTime: value})}
                      keyboardType="numeric"
                      placeholder="60"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Notes - Optional</Text>
                    <TextInput
                      style={[styles.textInput, styles.textArea]}
                      value={addExerciseData.notes}
                      onChangeText={(value) => setAddExerciseData({...addExerciseData, notes: value})}
                      placeholder="Any notes about this exercise..."
                      multiline
                      numberOfLines={3}
                    />
                  </View>

                  <TouchableOpacity
                    style={styles.addExerciseButton}
                    onPress={handleAddExercise}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text style={styles.addExerciseButtonText}>Add to {selectedDay}</Text>
                    )}
                  </TouchableOpacity>
                  
                  {/* Add some bottom padding to ensure button is visible */}
                  <View style={{ height: 20 }} />
                </>
              )}
            </ScrollView>
          ) : (
            <View style={styles.exerciseLibrary}>
              <View style={styles.searchSection}>
                <TextInput
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search exercises..."
                />
                <TouchableOpacity
                  style={styles.searchButton}
                  onPress={loadExercises}
                >
                  <Ionicons name="search" size={20} color="white" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.exerciseLibraryList} showsVerticalScrollIndicator={false}>
                {loading ? (
                  <View style={{ padding: 20, alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#3B82F6" />
                    <Text style={{ marginTop: 10, color: '#6B7280' }}>Loading exercises...</Text>
                  </View>
                ) : filteredExercises.length > 0 ? (
                  filteredExercises.map((exercise, index) => (
                    <TouchableOpacity
                      key={exercise.id || index}
                      style={styles.libraryExerciseCard}
                      onPress={() => {
                        console.log('Exercise selected:', exercise.name); // Debug log
                        setAddExerciseData({...addExerciseData, exercise});
                        setShowExerciseLibrary(false);
                      }}
                    >
                      <Text style={styles.libraryExerciseName}>
                        {exercise.name || 'Unknown Exercise'}
                      </Text>
                      <Text style={styles.libraryExerciseDetails}>
                        {exercise.bodyPart || 'Unknown'} • {exercise.target || 'Unknown'}
                      </Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={{ padding: 20, alignItems: 'center' }}>
                    <Text style={{ color: '#6B7280', fontSize: 16 }}>No exercises found</Text>
                    <Text style={{ color: '#9CA3AF', fontSize: 14, marginTop: 4 }}>Try searching for different terms</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

  const loadCurrentPlan = async () => {
    if (!user?.uid) return
    
    try {
      const plan = await PlanGenerationService.getCurrentPlan(user.uid)
      setCurrentPlan(plan)
    } catch (error) {
      console.error('❌ Error loading current plan:', error)
    }
  }

  // Add plan recommendations function
  const getPlanRecommendations = (healthGoal: string): string[] => {
    const recommendations = {
      'Lose Weight': [
        'Focus on cardio and full-body exercises',
        'Include HIIT workouts for fat burning',
        'Aim for 4+ workouts per week'
      ],
      'Gain Weight': [
        'Focus on compound strength exercises',
        'Progressive overload with weights',
        'Allow proper rest between workouts'
      ],
      'Build Muscle': [
        'Prioritize strength training',
        'Target all major muscle groups',
        'Include progressive overload'
      ],
      'Improve Fitness': [
        'Mix cardio and strength training',
        'Focus on functional movements',
        'Maintain consistency'
      ],
    }
    return recommendations[healthGoal as keyof typeof recommendations] || []
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
            <Text style={styles.planInfoTitle}>Your Workout Plan</Text>
            <TouchableOpacity onPress={() => setShowPlanInfo(false)}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>
          
          {currentPlan && (
            <ScrollView style={styles.planInfoContent}>
              <View style={styles.planInfoSection}>
                <Text style={styles.planInfoSectionTitle}>Health Goal: {currentPlan.healthGoal}</Text>
                
                <View style={styles.planInfoItem}>
                  <Text style={styles.planInfoLabel}>Recommended Workouts per Week:</Text>
                  <Text style={styles.planInfoValue}>{currentPlan.workoutPlan.workoutsPerWeek}</Text>
                </View>
                
                <View style={styles.planInfoItem}>
                  <Text style={styles.planInfoLabel}>Focus Areas:</Text>
                  <Text style={styles.planInfoValue}>
                    {currentPlan.workoutPlan.recommendedFocus.join(', ')}
                  </Text>
                </View>
              </View>
              
              <View style={styles.planRecommendations}>
                <Text style={styles.planRecommendationsTitle}>💪 Recommendations</Text>
                {getPlanRecommendations(currentPlan.healthGoal).map((rec, index) => (
                  <View key={index} style={styles.recommendationItem}>
                    <Text style={styles.recommendationBullet}>•</Text>
                    <Text style={styles.recommendationText}>{rec}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  )

  if (loading && Object.keys(weeklyPlan).length === 0) {
    return (
      <ProtectedRoute>
        <MainLayout 
          title="Workouts"
          activeRoute="workouts"
          onNavigate={handleNavigate}
          onLogout={logout}
          user={{
            name: user?.displayName || 'User',
            email: user?.email || '',
            photoURL: user?.photoURL || ''
          }}
        >
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingText}>Loading your workout plan...</Text>
          </View>
        </MainLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <MainLayout 
        title="Workouts"
        activeRoute="workouts"
        onNavigate={handleNavigate}
        onLogout={logout}
        user={{
          name: user?.displayName || 'User',
          email: user?.email || '',
          photoURL: user?.photoURL || ''
        }}
      >
        <SafeAreaView style={styles.container}>
          <ScrollView style={styles.scrollView}>
            {/* Add Plan Info Header */}
            {currentPlan && (
              <View style={styles.planHeader}>
                <View style={styles.planHeaderLeft}>
                  <Text style={styles.planHeaderTitle}>Plan: {currentPlan.healthGoal}</Text>
                  <Text style={styles.planHeaderSubtitle}>
                    {currentPlan.workoutPlan.workoutsPerWeek} workouts/week • Focus: {currentPlan.workoutPlan.recommendedFocus.slice(0, 2).join(', ')}
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

            {renderApiStatus()}
            {renderTodaysSummary()}
            {renderWeeklyPlan()}
            {renderSelectedDayPlan()}
          </ScrollView>
          
          {renderAddExerciseModal()}
          
          {/* Complete Exercise Modal */}
          <Modal visible={showCompleteExerciseModal} animationType="slide" transparent>
            <View style={styles.modalOverlay}>
              <View style={styles.completeExerciseModal}>
                <Text style={styles.completeModalTitle}>Complete Exercise</Text>
                
                {selectedPlannedExercise && (
                  <>
                    <Text style={styles.completeExerciseName}>
                      {selectedPlannedExercise.exercise.exerciseName || 'Unknown Exercise'}
                    </Text>
                    
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Weight Used (kg) - Optional</Text>
                      <TextInput
                        style={styles.textInput}
                        value={completionWeight}
                        onChangeText={setCompletionWeight}
                        keyboardType="numeric"
                        placeholder="e.g., 50"
                      />
                    </View>
                    
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Notes - Optional</Text>
                      <TextInput
                        style={[styles.textInput, styles.textArea]}
                        value={completionNotes}
                        onChangeText={setCompletionNotes}
                        placeholder="How did it feel?"
                        multiline
                        numberOfLines={3}
                      />
                    </View>
                    
                    <View style={styles.completeModalActions}>
                      <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={() => setShowCompleteExerciseModal(false)}
                      >
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={styles.completeButton}
                        onPress={handleCompleteExercise}
                        disabled={loading}
                      >
                        {loading ? (
                          <ActivityIndicator color="white" />
                        ) : (
                          <Text style={styles.completeButtonText}>Complete</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </View>
          </Modal>
          
          {/* Add Plan Info Modal */}
          <PlanInfoModal />
        </SafeAreaView>
      </MainLayout>
    </ProtectedRoute>
  );
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
  scrollView: {
    flex: 1,
    padding: 16,
  },
  apiStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  apiStatusText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  todayCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  progressText: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  weeklyPlanCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  daysContainer: {
    marginTop: 12,
  },
  dayCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginRight: 12,
    minWidth: 80,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedDayCard: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  todayDayCard: {
    borderColor: '#10B981',
  },
  dayName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  selectedDayName: {
    color: 'white',
  },
  todayDayName: {
    color: '#10B981',
  },
  exerciseCount: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  selectedExerciseCount: {
    color: 'white',
  },
  todayIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginTop: 4,
  },
  dayPlanCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dayPlanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  addButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    padding: 8,
  },
  exercisesList: {
    maxHeight: 400,
  },
  exerciseCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  exerciseDetails: {
    fontSize: 14,
    color: '#6B7280',
  },
  exerciseActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  completedText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  completeButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  completeButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  removeButton: {
    padding: 4,
  },
  exerciseNotes: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 24,
  },
  addFirstExerciseButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addFirstExerciseText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addExerciseModal: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    margin: 20,
    maxHeight: '85%',
    width: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  modalContent: {
    maxHeight: '100%',
  },
  browseButton: {
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  browseButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  selectedExercise: {
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  selectedExerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  selectedExerciseDetails: {
    fontSize: 14,
    color: '#6B7280',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  addExerciseButton: {
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  addExerciseButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  exerciseLibrary: {
    flex: 1,
  },
  searchSection: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    marginRight: 8,
  },
  searchButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exerciseLibraryList: {
    flex: 1,
  },
  libraryExerciseCard: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  libraryExerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  libraryExerciseDetails: {
    fontSize: 14,
    color: '#6B7280',
  },
  completeExerciseModal: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    margin: 20,
    maxHeight: '70%',
    width: '90%',
  },
  completeModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  completeExerciseName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3B82F6',
    marginBottom: 20,
    textAlign: 'center',
  },
  completeModalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  completeButton: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1,
    marginLeft: 8,
  },
  completeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
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
    borderLeftColor: '#3B82F6',
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
    backgroundColor: '#3B82F6',
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
    flex: 1,
  },
  planInfoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
    textAlign: 'right',
  },
  planRecommendations: {
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  planRecommendationsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 12,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  recommendationBullet: {
    fontSize: 16,
    color: '#3B82F6',
    marginRight: 8,
    marginTop: 2,
  },
  recommendationText: {
    fontSize: 14,
    color: '#1E40AF',
    lineHeight: 20,
    flex: 1,
  },
}); 