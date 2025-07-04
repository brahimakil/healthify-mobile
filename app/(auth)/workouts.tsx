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
import { AIWorkoutSuggestionService, WorkoutSuggestion } from '../../services/aiWorkoutSuggestionService';
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
  const [currentPlan, setCurrentPlan] = useState<any>(null)
  const [showPlanInfo, setShowPlanInfo] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState<WorkoutSuggestion | null>(null)
  const [suggestionLoading, setSuggestionLoading] = useState(false)
  const [showAISuggestion, setShowAISuggestion] = useState(false)
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false)
  const [exerciseToDelete, setExerciseToDelete] = useState<{
    exercise: PlannedExercise;
    index: number;
  } | null>(null)

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
        router.push('/(auth)/sleep');
        break;
      case 'hydration':
        router.push('/(auth)/hydration');
        break;
      case 'dietitians':
        router.push('/(auth)/dietitians');
        break;
      case 'settings':
        router.push('/(auth)/settings');
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
      loadCurrentPlan();
    }
  }, [user?.uid]);

  // Load AI suggestions when user and current plan are available
  useEffect(() => {
    if (user?.uid && currentPlan) {
      loadAIWorkoutSuggestion();
    }
  }, [user?.uid, currentPlan]);

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
    console.log('🗑️ handleRemoveExercise called with index:', exerciseIndex)
    
    if (!user?.uid) {
      console.error('❌ No user found')
      return
    }

    const dayPlan = weeklyPlan[selectedDay]
    if (!dayPlan || !dayPlan.exercises[exerciseIndex]) {
      console.error('❌ Exercise not found:', { 
        selectedDay, 
        exerciseIndex, 
        hasDay: !!dayPlan,
        exerciseCount: dayPlan?.exercises?.length || 0
      })
      return
    }

    const exerciseToRemove = dayPlan.exercises[exerciseIndex]
    console.log('🎯 Exercise to remove:', exerciseToRemove)

    // Set the exercise to delete and show confirmation modal
    setExerciseToDelete({
      exercise: exerciseToRemove,
      index: exerciseIndex
    })
    setShowDeleteConfirmation(true)
    console.log('🔔 Showing delete confirmation modal')
  }

  const performExerciseDeletion = async () => {
    if (!exerciseToDelete || !user?.uid) return

    try {
      console.log('🚀 Starting exercise removal...')
      setLoading(true)
      
      await workoutService.removeExerciseFromDayPlan(
        user.uid, 
        selectedDay, 
        exerciseToDelete.index
      )
      console.log('✅ Exercise removed from service')
      
      await loadWorkoutData()
      console.log('✅ Workout data reloaded')
      
      console.log(`✅ Successfully removed "${exerciseToDelete.exercise.exerciseName}"`)
      
    } catch (error) {
      console.error('❌ Error removing exercise:', error)
    } finally {
      setLoading(false)
      setShowDeleteConfirmation(false)
      setExerciseToDelete(null)
    }
  }

  const filteredExercises = exercises.filter(exercise =>
    exercise.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    exercise.bodyPart?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    exercise.target?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
                      onPress={() => {
                        handleRemoveExercise(index);
                      }}
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

  const loadAIWorkoutSuggestion = async () => {
    if (!user?.uid) return
    
    try {
      setSuggestionLoading(true)
      console.log('🤖 Loading AI workout suggestion for tomorrow')
      
      const userPreferences = currentPlan ? {
        healthGoal: currentPlan.healthGoal,
        fitnessLevel: 'intermediate',
        preferredFocus: currentPlan.workoutPlan?.recommendedFocus || [],
        availableEquipment: ['bodyweight', 'dumbbells']
      } : undefined
      
      const suggestion = await AIWorkoutSuggestionService.generateTomorrowWorkoutSuggestion(
        user.uid,
        userPreferences
      )
      
      console.log('✅ AI workout suggestion loaded:', suggestion)
      setAiSuggestion(suggestion)
      
    } catch (error) {
      console.error('❌ Error loading AI workout suggestion:', error)
    } finally {
      setSuggestionLoading(false)
    }
  }

  const applyAISuggestion = async () => {
    console.log('🚀 applyAISuggestion called')
    
    if (!aiSuggestion || !user?.uid) {
      console.error('❌ Missing data for applying AI suggestion')
      return
    }

    if (!aiSuggestion.suggestedExercises || aiSuggestion.suggestedExercises.length === 0) {
      console.error('❌ No exercises found in AI suggestion')
      return
    }

    try {
      console.log(`🤖 Starting to apply ${aiSuggestion.suggestedExercises.length} exercises to ${aiSuggestion.dayOfWeek}`)
      
      setLoading(true)
      
      // Get current day plan to check for duplicates
      const currentDayPlan = weeklyPlan[aiSuggestion.dayOfWeek]
      const existingExerciseNames = currentDayPlan?.exercises?.map(ex => ex.exerciseName.toLowerCase()) || []
      
      console.log('📋 Current exercises in plan:', existingExerciseNames)
      
      let successCount = 0
      let errorCount = 0
      let duplicateCount = 0
      const duplicateExercises: string[] = []
      const newExercises: string[] = []

      // Check each suggested exercise for duplicates
      for (let i = 0; i < aiSuggestion.suggestedExercises.length; i++) {
        const exercise = aiSuggestion.suggestedExercises[i]
        
        // Check if exercise already exists
        if (existingExerciseNames.includes(exercise.name.toLowerCase())) {
          console.log(`⚠️ Exercise already exists: ${exercise.name}`)
          duplicateCount++
          duplicateExercises.push(exercise.name)
          continue
        }
        
        try {
          console.log(`➕ Adding NEW exercise ${i + 1}/${aiSuggestion.suggestedExercises.length}: ${exercise.name}`)
          
          if (!exercise.name || !exercise.id) {
            console.error('❌ Invalid exercise data:', exercise)
            errorCount++
            continue
          }

          await workoutService.addExerciseToDayPlan(
            user.uid,
            aiSuggestion.dayOfWeek,
            exercise,
            3, // Default sets
            10, // Default reps
            undefined, // duration
            60, // rest time in seconds
            undefined, // weight
            `Added from AI suggestion - ${aiSuggestion.validationStatus}`
          )
          
          successCount++
          newExercises.push(exercise.name)
          console.log(`✅ Successfully added: ${exercise.name}`)
          
        } catch (exerciseError) {
          console.error(`❌ Failed to add exercise ${exercise.name}:`, exerciseError)
          errorCount++
        }
      }

      console.log(`📊 Apply results: ${successCount} new, ${duplicateCount} duplicates, ${errorCount} errors`)

      // Reload workout data to show the changes
      if (successCount > 0) {
        console.log('🔄 Reloading workout data...')
        await loadWorkoutData()
      }
      
      // Show detailed result message
      let message = ''
      if (successCount > 0) {
        message += `✅ Added ${successCount} new exercises:\n${newExercises.join(', ')}\n\n`
      }
      if (duplicateCount > 0) {
        message += `⚠️ ${duplicateCount} exercises already in your plan:\n${duplicateExercises.join(', ')}\n\n`
      }
      if (errorCount > 0) {
        message += `❌ ${errorCount} exercises failed to add\n\n`
      }
      
      if (successCount === 0 && duplicateCount > 0) {
        message += "All suggested exercises are already in your plan!"
      }
      
      Alert.alert(
        successCount > 0 ? 'Suggestions Applied!' : 'No New Exercises Added',
        message.trim(),
        [
          {
            text: successCount > 0 ? 'View Plan' : 'OK',
            onPress: () => {
              if (successCount > 0) {
                setSelectedDay(aiSuggestion.dayOfWeek)
              }
            }
          }
        ]
      )
      
      // Only clear suggestion if we added something new
      if (successCount > 0) {
        setAiSuggestion(null)
      }
      
    } catch (error) {
      console.error('❌ Critical error applying AI suggestion:', error)
      Alert.alert(
        'Error', 
        `Failed to apply AI suggestions: ${error.message || 'Unknown error'}`
      )
    } finally {
      setLoading(false)
      console.log('✅ applyAISuggestion completed')
    }
  }

  const renderAISuggestion = () => {
    // Always show loading or result
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    return (
      <View style={styles.aiSuggestionContainer}>
        <TouchableOpacity
          style={styles.aiSuggestionHeader}
          onPress={() => setShowAISuggestion(!showAISuggestion)}
        >
          <View style={styles.aiSuggestionHeaderLeft}>
            <Text style={styles.aiSuggestionTitle}>
              🤖 AI Suggestion for {aiSuggestion?.dayOfWeek || 'Tomorrow'}
            </Text>
            {suggestionLoading && (
              <ActivityIndicator size="small" color="#10B981" style={{ marginLeft: 8 }} />
            )}
            {!suggestionLoading && !aiSuggestion && (
              <Text style={styles.aiSuggestionError}>• Failed to load</Text>
            )}
            {aiSuggestion && (
              <Text style={styles.aiSuggestionStatus}>
                • {aiSuggestion.validationStatus === 'validated' ? '✅ AI' : 
                   aiSuggestion.validationStatus === 'rule-based' ? '⚡ Smart' : '🔄 Fallback'}
              </Text>
            )}
          </View>
          <Text style={styles.aiSuggestionToggle}>
            {showAISuggestion ? '▼' : '▶'}
          </Text>
        </TouchableOpacity>
        
        {showAISuggestion && (
          <View style={styles.aiSuggestionContent}>
            {suggestionLoading ? (
              <View style={styles.aiSuggestionLoading}>
                <ActivityIndicator size="large" color="#10B981" />
                <Text style={styles.aiSuggestionLoadingText}>
                  Analyzing your training patterns...
                </Text>
              </View>
            ) : aiSuggestion ? (
              <>
                <Text style={styles.aiSuggestionReasoning}>
                  {aiSuggestion.reasoning}
                </Text>
                
                {aiSuggestion.recommendedFocus.length > 0 ? (
                  <>
                    <Text style={styles.aiSuggestionFocusTitle}>Recommended Focus:</Text>
                    <View style={styles.aiSuggestionFocusContainer}>
                      {aiSuggestion.recommendedFocus.map((focus, index) => (
                        <View key={index} style={styles.aiSuggestionFocusChip}>
                          <Text style={styles.aiSuggestionFocusText}>{focus}</Text>
                        </View>
                      ))}
                    </View>
                    
                    {aiSuggestion.suggestedExercises.length > 0 ? (
                      <>
                        <Text style={styles.aiSuggestionExercisesTitle}>
                          Validated Exercises ({aiSuggestion.suggestedExercises.length}):
                        </Text>
                        <View style={styles.aiSuggestionExercisesList}>
                          {aiSuggestion.suggestedExercises.slice(0, 4).map((exercise, index) => (
                            <Text key={index} style={styles.aiSuggestionExerciseItem}>
                              • {exercise.name} ({exercise.target})
                            </Text>
                          ))}
                          {aiSuggestion.suggestedExercises.length > 4 && (
                            <Text style={styles.aiSuggestionMoreExercises}>
                              +{aiSuggestion.suggestedExercises.length - 4} more exercises
                            </Text>
                          )}
                        </View>
                        
                        <TouchableOpacity
                          style={[
                            styles.aiSuggestionApplyButton,
                            loading && styles.aiSuggestionApplyButtonDisabled
                          ]}
                          onPress={applyAISuggestion}
                          disabled={loading}
                        >
                          {loading ? (
                            <View style={styles.aiSuggestionApplyLoading}>
                              <ActivityIndicator size="small" color="#FFFFFF" />
                              <Text style={styles.aiSuggestionApplyText}>
                                Applying...
                              </Text>
                            </View>
                          ) : (
                            <Text style={styles.aiSuggestionApplyText}>
                              Apply {aiSuggestion.suggestedExercises.length} exercises to {aiSuggestion.dayOfWeek}
                            </Text>
                          )}
                        </TouchableOpacity>
                      </>
                    ) : (
                      <Text style={styles.aiSuggestionNoExercises}>
                        ⚠️ No exercises found for these focus areas. Try adding exercises manually.
                      </Text>
                    )}
                  </>
                ) : (
                  <View style={styles.aiSuggestionRestDay}>
                    <Text style={styles.aiSuggestionRestText}>🛌 Rest Day Recommended</Text>
                    <Text style={styles.aiSuggestionRestSubtext}>
                      Take time to recover and prepare for your next workout session.
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.aiSuggestionError}>
                <Text style={styles.aiSuggestionErrorText}>
                  ❌ Failed to generate suggestions. Please try refreshing the page.
                </Text>
                <TouchableOpacity
                  style={styles.aiSuggestionRetryButton}
                  onPress={loadAIWorkoutSuggestion}
                >
                  <Text style={styles.aiSuggestionRetryText}>🔄 Retry</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>
    )
  }

  const renderDeleteConfirmationModal = () => (
    <Modal
      visible={showDeleteConfirmation}
      transparent
      animationType="fade"
      onRequestClose={() => setShowDeleteConfirmation(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.deleteConfirmationModal}>
          <Text style={styles.deleteConfirmationTitle}>Remove Exercise</Text>
          <Text style={styles.deleteConfirmationMessage}>
            Are you sure you want to remove "{exerciseToDelete?.exercise.exerciseName}" 
            from your {selectedDay} plan?
          </Text>
          
          <View style={styles.deleteConfirmationButtons}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setShowDeleteConfirmation(false)
                setExerciseToDelete(null)
                console.log('❌ Delete cancelled by user')
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={performExerciseDeletion}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.deleteButtonText}>Remove</Text>
              )}
            </TouchableOpacity>
          </View>
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
          <ScrollView style={styles.scrollContainer}>
            {/* Plan Info Header */}
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

            {renderAISuggestion()}
            
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
          
          {/* NEW: Delete Confirmation Modal */}
          {renderDeleteConfirmationModal()}
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
  scrollView: {
    flex: 1,
    padding: 16,
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
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  addExerciseModal: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 0,
    width: '100%',
    maxHeight: '90%',
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  modalContent: {
    flex: 1,
    paddingBottom: 20,
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
    marginBottom: 30,
  },
  addExerciseButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  exerciseLibrary: {
    flex: 1,
    paddingBottom: 20,
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
    backgroundColor: 'white',
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
    paddingBottom: 20,
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
    flex: 1,
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '500',
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
  aiSuggestionContainer: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  aiSuggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  aiSuggestionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  aiSuggestionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
  },
  aiSuggestionToggle: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '600',
  },
  aiSuggestionContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  aiSuggestionReasoning: {
    fontSize: 14,
    color: '#047857',
    marginBottom: 12,
    lineHeight: 20,
  },
  aiSuggestionFocusTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#065F46',
    marginBottom: 8,
  },
  aiSuggestionFocusContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  aiSuggestionFocusChip: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 4,
  },
  aiSuggestionFocusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  aiSuggestionExercisesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#065F46',
    marginBottom: 8,
  },
  aiSuggestionExercisesList: {
    marginBottom: 16,
  },
  aiSuggestionExerciseItem: {
    fontSize: 13,
    color: '#047857',
    marginBottom: 2,
  },
  aiSuggestionMoreExercises: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
    marginTop: 4,
  },
  aiSuggestionApplyButton: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  aiSuggestionApplyText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  aiSuggestionApplyButtonDisabled: {
    backgroundColor: '#9CA3AF',
    opacity: 0.7,
  },
  aiSuggestionApplyLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiSuggestionRestDay: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  aiSuggestionRestText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
    marginBottom: 4,
  },
  aiSuggestionRestSubtext: {
    fontSize: 14,
    color: '#047857',
    textAlign: 'center',
  },
  aiSuggestionError: {
    color: '#EF4444',
    fontSize: 12,
    marginLeft: 8,
  },
  aiSuggestionStatus: {
    color: '#059669',
    fontSize: 12,
    marginLeft: 8,
  },
  aiSuggestionLoading: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  aiSuggestionLoadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#059669',
  },
  aiSuggestionNoExercises: {
    fontSize: 14,
    color: '#F59E0B',
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 12,
  },
  aiSuggestionErrorText: {
    fontSize: 14,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 12,
  },
  aiSuggestionRetryButton: {
    backgroundColor: '#EF4444',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  aiSuggestionRetryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteConfirmationModal: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 12,
    padding: 24,
    minWidth: 300,
    maxWidth: 400,
  },
  deleteConfirmationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  deleteConfirmationMessage: {
    fontSize: 16,
    color: '#4B5563',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  deleteConfirmationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#EF4444',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
});