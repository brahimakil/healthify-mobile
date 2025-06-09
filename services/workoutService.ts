import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  Timestamp,
  updateDoc,
  where
} from 'firebase/firestore';
import { db } from '../utils/firebase';
import { UserService } from './userService';

// Updated types for 7-day workout plan system
export interface Exercise {
  id: string;
  name: string;
  bodyPart: string;
  equipment: string;
  target: string;
  instructions?: string;
  gifUrl?: string;
  type?: string;
  muscle: string;
  difficulty: string;
}

export interface PlannedExercise {
  id?: string;
  exerciseId: string;
  exerciseName: string;
  sets: number;
  reps: number;
  duration?: number; // for cardio exercises
  restTime?: number; // rest between sets in seconds
  weight?: number; // weight used
  notes?: string;
  completed?: boolean;
  completedAt?: Date;
}

export interface DayWorkoutPlan {
  id?: string;
  userId: string;
  dayOfWeek: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  planName: string;
  exercises: PlannedExercise[];
  targetMuscleGroups: string[];
  estimatedDuration: number; // total estimated time in minutes
  createdAt: Date;
  updatedAt: Date;
}

export interface WeeklyWorkoutPlan {
  id?: string;
  userId: string;
  planName: string;
  days: {
    monday?: DayWorkoutPlan;
    tuesday?: DayWorkoutPlan;
    wednesday?: DayWorkoutPlan;
    thursday?: DayWorkoutPlan;
    friday?: DayWorkoutPlan;
    saturday?: DayWorkoutPlan;
    sunday?: DayWorkoutPlan;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkoutSession {
  id?: string;
  userId: string;
  dayOfWeek: string;
  planId: string;
  exercises: PlannedExercise[];
  totalDuration: number;
  totalCaloriesBurned: number;
  completedAt: Date;
  notes?: string;
}

export interface DailyWorkoutSummary {
  date: string;
  dayOfWeek: string;
  plannedExercises: PlannedExercise[];
  completedExercises: PlannedExercise[];
  totalPlannedDuration: number;
  totalCompletedDuration: number;
  totalCaloriesBurned: number;
  progressPercentage: number;
}

class WorkoutService {
  private readonly BASE_URL = 'https://exercisedb-api.vercel.app/api/v1';
  private readonly WORKOUT_PLANS_COLLECTION = 'workoutPlans';
  private readonly WORKOUT_SESSIONS_COLLECTION = 'workoutSessions';

  // Check if API is available and working
  private async isApiAvailable(): Promise<boolean> {
    try {
      console.log('🔍 Checking ExerciseDB API availability...');
      const response = await fetch(`${this.BASE_URL}/exercises?limit=1`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        console.log('❌ ExerciseDB API returned error:', response.status);
        return false;
      }

      const data = await response.json();
      console.log('✅ ExerciseDB API is available');
      return true;
    } catch (error) {
      console.error('❌ ExerciseDB API connection failed:', error);
      return false;
    }
  }

  // Enhanced API response parser to handle multiple formats
  private parseApiResponse(data: any): { success: boolean; exercises: any[] } {
    console.log('🔍 Parsing API response...');

    try {
      // Handle different response formats
      let exercises: any[] = [];

      // Format 1: Direct array
      if (Array.isArray(data)) {
        exercises = data;
        console.log('📦 Direct array format detected, exercises found:', exercises.length);
      }
      // Format 2: Wrapped in data.data.exercises (current API format)
      else if (data && data.data && Array.isArray(data.data.exercises)) {
        exercises = data.data.exercises;
        console.log('📦 Nested data.exercises format detected, exercises found:', exercises.length);
      }
      // Format 3: Wrapped in data.exercises
      else if (data && Array.isArray(data.exercises)) {
        exercises = data.exercises;
        console.log('📦 data.exercises format detected, exercises found:', exercises.length);
      }
      // Format 4: Wrapped in data property
      else if (data && data.data && Array.isArray(data.data)) {
        exercises = data.data;
        console.log('📦 data.data array format detected, exercises found:', exercises.length);
      }
      // Format 5: Single exercise object
      else if (data && data.exerciseId) {
        exercises = [data];
        console.log('📦 Single exercise format detected');
      }
      // Format 6: Check if data itself has exercise properties
      else if (data && (data.name || data.exerciseId)) {
        exercises = [data];
        console.log('📦 Single exercise object format detected');
      }

      if (exercises.length === 0) {
        console.log('📭 No exercises found in response');
        return { success: false, exercises: [] };
      }

      return { success: true, exercises };
    } catch (error) {
      console.error('❌ Error parsing API response:', error);
      return { success: false, exercises: [] };
    }
  }

  // Fallback exercises data when API is not available
  private getFallbackExercises(bodyPart?: string, difficulty?: string, name?: string): Exercise[] {
    const allExercises: Exercise[] = [
      // Chest exercises
      { 
        id: '1', 
        name: 'Push-ups', 
        bodyPart: 'chest', 
        equipment: 'body weight', 
        target: 'pectorals', 
        muscle: 'chest', 
        difficulty: 'beginner',
        instructions: 'Start in a plank position with your hands slightly wider than shoulder-width apart. Lower your body until your chest nearly touches the floor. Push back up to the starting position.'
      },
      { 
        id: '2', 
        name: 'Bench Press', 
        bodyPart: 'chest', 
        equipment: 'barbell', 
        target: 'pectorals', 
        muscle: 'chest', 
        difficulty: 'intermediate',
        instructions: 'Lie on a bench with your eyes under the bar. Grip the bar with hands wider than shoulder-width. Lower the bar to your chest, then press it back up.'
      },
      { 
        id: '3', 
        name: 'Incline Dumbbell Press', 
        bodyPart: 'chest', 
        equipment: 'dumbbell', 
        target: 'pectorals', 
        muscle: 'chest', 
        difficulty: 'intermediate',
        instructions: 'Lie on an incline bench holding dumbbells. Press the weights up and together, then lower them slowly to chest level.'
      },
      
      // Back exercises
      { 
        id: '4', 
        name: 'Pull-ups', 
        bodyPart: 'back', 
        equipment: 'body weight', 
        target: 'lats', 
        muscle: 'lats', 
        difficulty: 'intermediate',
        instructions: 'Hang from a pull-up bar with arms fully extended. Pull your body up until your chin is over the bar. Lower yourself back down slowly.'
      },
      { 
        id: '5', 
        name: 'Bent-over Rows', 
        bodyPart: 'back', 
        equipment: 'barbell', 
        target: 'lats', 
        muscle: 'lats', 
        difficulty: 'intermediate',
        instructions: 'Bend at the hips and knees, holding a barbell with an overhand grip. Pull the bar to your lower chest, squeezing your shoulder blades together.'
      },
      { 
        id: '6', 
        name: 'Lat Pulldowns', 
        bodyPart: 'back', 
        equipment: 'cable', 
        target: 'lats', 
        muscle: 'lats', 
        difficulty: 'beginner',
        instructions: 'Sit at a lat pulldown machine and grab the bar with a wide grip. Pull the bar down to your chest while keeping your back straight.'
      },
      
      // Arms exercises
      { 
        id: '7', 
        name: 'Bicep Curls', 
        bodyPart: 'upper arms', 
        equipment: 'dumbbell', 
        target: 'biceps', 
        muscle: 'biceps', 
        difficulty: 'beginner',
        instructions: 'Hold dumbbells at your sides with palms facing forward. Curl the weights up to your shoulders, squeezing your biceps. Lower slowly.'
      },
      { 
        id: '8', 
        name: 'Tricep Dips', 
        bodyPart: 'upper arms', 
        equipment: 'body weight', 
        target: 'triceps', 
        muscle: 'triceps', 
        difficulty: 'intermediate',
        instructions: 'Support yourself on parallel bars or a bench. Lower your body by bending your arms, then push back up.'
      },
      { 
        id: '9', 
        name: 'Hammer Curls', 
        bodyPart: 'upper arms', 
        equipment: 'dumbbell', 
        target: 'biceps', 
        muscle: 'biceps', 
        difficulty: 'beginner',
        instructions: 'Hold dumbbells with a neutral grip (palms facing each other). Curl the weights up while keeping your palms facing each other throughout the movement.'
      },
      
      // Legs exercises
      { 
        id: '10', 
        name: 'Squats', 
        bodyPart: 'lower legs', 
        equipment: 'body weight', 
        target: 'quadriceps', 
        muscle: 'quadriceps', 
        difficulty: 'beginner',
        instructions: 'Stand with feet shoulder-width apart. Lower your body by bending your knees and hips as if sitting back into a chair. Return to standing.'
      },
      { 
        id: '11', 
        name: 'Lunges', 
        bodyPart: 'lower legs', 
        equipment: 'body weight', 
        target: 'quadriceps', 
        muscle: 'quadriceps', 
        difficulty: 'beginner',
        instructions: 'Step forward with one leg, lowering your hips until both knees are bent at 90-degree angles. Push back to the starting position.'
      },
      { 
        id: '12', 
        name: 'Deadlifts', 
        bodyPart: 'lower legs', 
        equipment: 'barbell', 
        target: 'glutes', 
        muscle: 'quadriceps', 
        difficulty: 'intermediate',
        instructions: 'Stand with feet hip-width apart, bar over mid-foot. Bend at hips and knees to grab the bar. Lift by extending hips and knees simultaneously.'
      },
      
      // Core exercises
      { 
        id: '13', 
        name: 'Plank', 
        bodyPart: 'waist', 
        equipment: 'body weight', 
        target: 'abs', 
        muscle: 'abdominals', 
        difficulty: 'beginner',
        instructions: 'Start in a push-up position but rest on your forearms. Keep your body straight from head to heels. Hold this position.'
      },
      { 
        id: '14', 
        name: 'Crunches', 
        bodyPart: 'waist', 
        equipment: 'body weight', 
        target: 'abs', 
        muscle: 'abdominals', 
        difficulty: 'beginner',
        instructions: 'Lie on your back with knees bent. Place hands behind your head. Lift your shoulders off the ground by contracting your abs.'
      },
      { 
        id: '15', 
        name: 'Mountain Climbers', 
        bodyPart: 'waist', 
        equipment: 'body weight', 
        target: 'abs', 
        muscle: 'abdominals', 
        difficulty: 'intermediate',
        instructions: 'Start in a plank position. Alternate bringing your knees to your chest in a running motion while maintaining the plank position.'
      },
      
      // Cardio exercises
      { 
        id: '16', 
        name: 'Jumping Jacks', 
        bodyPart: 'cardio', 
        equipment: 'body weight', 
        target: 'cardiovascular system', 
        muscle: 'cardio', 
        difficulty: 'beginner',
        instructions: 'Start standing with feet together and arms at your sides. Jump while spreading your legs and raising your arms overhead. Return to starting position.'
      },
      { 
        id: '17', 
        name: 'Burpees', 
        bodyPart: 'cardio', 
        equipment: 'body weight', 
        target: 'cardiovascular system', 
        muscle: 'cardio', 
        difficulty: 'expert',
        instructions: 'Start standing, drop into a squat, kick back into a plank, do a push-up, jump feet back to squat, then jump up with arms overhead.'
      },
      { 
        id: '18', 
        name: 'High Knees', 
        bodyPart: 'cardio', 
        equipment: 'body weight', 
        target: 'cardiovascular system', 
        muscle: 'cardio', 
        difficulty: 'beginner',
        instructions: 'Run in place while bringing your knees up to hip level with each step. Pump your arms and maintain good posture.'
      },
    ];

    let filtered = allExercises;

    if (bodyPart) {
      filtered = filtered.filter(exercise => exercise.bodyPart === bodyPart);
    }

    if (difficulty) {
      filtered = filtered.filter(exercise => exercise.difficulty === difficulty);
    }

      if (name) {
      filtered = filtered.filter(exercise => 
          exercise.name.toLowerCase().includes(name.toLowerCase())
        );
      }
      
    return filtered.slice(0, 10); // Return max 10 exercises
  }

  // Convert API exercise to our format with improved error handling
  private convertApiExercise(apiExercise: any): Exercise {
    try {
      // Handle instructions array
      let instructions = 'No instructions available';
      if (apiExercise.instructions) {
        if (Array.isArray(apiExercise.instructions)) {
          instructions = apiExercise.instructions.join('\n');
        } else if (typeof apiExercise.instructions === 'string') {
          instructions = apiExercise.instructions;
        }
      }

      return {
        id: apiExercise.exerciseId || apiExercise.id || Math.random().toString(),
        name: apiExercise.name || apiExercise.title || 'Unknown Exercise',
        bodyPart: apiExercise.bodyPart || (apiExercise.bodyParts && apiExercise.bodyParts[0]) || 'unknown',
        equipment: apiExercise.equipment || (apiExercise.equipments && apiExercise.equipments[0]) || 'body weight',
        target: apiExercise.target || (apiExercise.targetMuscles && apiExercise.targetMuscles[0]) || 'unknown',
        instructions: instructions,
        gifUrl: apiExercise.gifUrl || apiExercise.imageUrl || apiExercise.videoUrl,
        muscle: apiExercise.bodyPart || (apiExercise.bodyParts && apiExercise.bodyParts[0]) || 'unknown',
        difficulty: this.mapTargetToDifficulty(apiExercise.target || (apiExercise.targetMuscles && apiExercise.targetMuscles[0]) || 'unknown'),
      };
    } catch (error) {
      console.error('❌ Error converting exercise:', apiExercise, error);
      // Return a safe fallback exercise
      return {
        id: Math.random().toString(),
        name: 'Exercise',
        bodyPart: 'unknown',
        equipment: 'body weight',
        target: 'unknown',
        muscle: 'unknown',
        difficulty: 'beginner',
        instructions: 'No instructions available'
      };
    }
  }

  // Map target muscle to difficulty (simple mapping)
  private mapTargetToDifficulty(target: string): string {
    const advancedTargets = ['cardiovascular system', 'spine', 'upper back'];
    const intermediateTargets = ['lats', 'delts', 'traps', 'triceps'];
    
    if (advancedTargets.includes(target)) return 'expert';
    if (intermediateTargets.includes(target)) return 'intermediate';
    return 'beginner';
  }

  // Main method to search exercises with corrected API endpoints
  async searchExercises(
    bodyPart?: string,
    difficulty?: string,
    name?: string
  ): Promise<Exercise[]> {
    const isAvailable = await this.isApiAvailable();

    if (!isAvailable) {
      console.log('🚨 ExerciseDB API not available, using fallback exercises');
      return this.getFallbackExercises(bodyPart, difficulty, name);
    }

    try {
      // Use the main exercises endpoint and filter client-side
      // This avoids the 404 error from trying to use non-existent bodyPart endpoints
      let url = `${this.BASE_URL}/exercises`;
      const params = new URLSearchParams();
      
      // Set a reasonable limit
      params.append('limit', '100');
      
      const fullUrl = `${url}?${params.toString()}`;
      console.log('🔍 Fetching exercises from ExerciseDB API:', fullUrl);

      const response = await fetch(fullUrl, {
        method: 'GET',
          headers: {
          'Accept': 'application/json',
          },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ ExerciseDB API Error Response:', response.status, errorText);
        
        // If API fails, fallback to local data
        console.log('🔄 Falling back to local exercises');
        return this.getFallbackExercises(bodyPart, difficulty, name);
      }

      const data = await response.json();
      console.log('📥 Raw API Response received, parsing...');

      // Use the enhanced parser
      const parsedResult = this.parseApiResponse(data);

      if (!parsedResult.success || parsedResult.exercises.length === 0) {
        console.log('📭 No exercises found in API response, using fallback');
        return this.getFallbackExercises(bodyPart, difficulty, name);
      }

      console.log('✅ Successfully parsed exercises:', parsedResult.exercises.length);

      let convertedExercises = parsedResult.exercises.map((ex: any) => this.convertApiExercise(ex));

      // Apply client-side filtering for bodyPart
      if (bodyPart && bodyPart.toLowerCase() !== 'all') {
        convertedExercises = convertedExercises.filter((ex: Exercise) => {
          const exerciseBodyPart = ex.bodyPart.toLowerCase();
          const searchBodyPart = bodyPart.toLowerCase();
          
          // Handle different bodyPart naming conventions
          const bodyPartMappings: { [key: string]: string[] } = {
            'back': ['back', 'upper back', 'lower back', 'lats'],
            'chest': ['chest', 'pectorals'],
            'shoulders': ['shoulders', 'delts', 'deltoids'],
            'arms': ['biceps', 'triceps', 'forearms'],
            'legs': ['quadriceps', 'hamstrings', 'glutes', 'calves'],
            'abs': ['abs', 'core', 'abdominals'],
            'cardio': ['cardio', 'cardiovascular']
          };

          // Check direct match first
          if (exerciseBodyPart.includes(searchBodyPart)) {
            return true;
          }

          // Check mapped body parts
          const mappedParts = bodyPartMappings[searchBodyPart] || [];
          return mappedParts.some(part => exerciseBodyPart.includes(part));
        });
      }

      // Apply client-side filtering for difficulty
      if (difficulty) {
        convertedExercises = convertedExercises.filter((ex: Exercise) => ex.difficulty === difficulty);
      }

      // Apply client-side filtering for name
      if (name) {
        convertedExercises = convertedExercises.filter((ex: Exercise) => 
          ex.name.toLowerCase().includes(name.toLowerCase())
        );
      }

      return convertedExercises.slice(0, 20);
    } catch (error) {
      console.error('❌ Error fetching exercises from ExerciseDB API:', error);
      console.log('🔄 Falling back to local exercises');
      return this.getFallbackExercises(bodyPart, difficulty, name);
    }
  }

  // Calculate calories burned with fallback formula
  async calculateCaloriesBurned(
    activity: string,
    weight: number,
    duration: number
  ): Promise<CaloriesBurnedData[]> {
    try {
      // Use a simple calculation since we don't have external API
      // MET values for common exercises
      const metValues: { [key: string]: number } = {
        'push-ups': 3.8,
        'pull-ups': 8.0,
        'squats': 5.0,
        'deadlifts': 6.0,
        'bench press': 5.0,
        'running': 9.8,
        'cycling': 7.5,
        'walking': 3.5,
        'swimming': 8.0,
        'yoga': 2.5,
        'weight training': 6.0,
        'cardio': 7.0,
      };

      // Find MET value for the activity
      const activityLower = activity.toLowerCase();
      let met = 5.0; // Default MET value

      for (const [key, value] of Object.entries(metValues)) {
        if (activityLower.includes(key)) {
          met = value;
          break;
        }
      }

      // Calculate calories: MET × weight(kg) × time(hours)
      const hours = duration / 60;
      const calories = met * weight * hours;

      return [{
        name: activity,
        calories_per_hour: met * weight,
        duration_minutes: duration,
        total_calories: Math.round(calories),
      }];
    } catch (error) {
      console.error('❌ Error calculating calories:', error);
      // Fallback calculation: 5 calories per minute
      return [{
        name: activity,
        calories_per_hour: 300,
        duration_minutes: duration,
        total_calories: duration * 5,
      }];
    }
  }

  // Add workout entry to Firestore
  async addWorkoutEntry(entry: Omit<WorkoutEntry, 'id'>): Promise<string> {
    try {
      console.log('💾 Adding workout entry:', entry);
      
      const workoutData = {
        ...entry,
        completedAt: Timestamp.fromDate(entry.completedAt),
      };

      const docRef = await addDoc(collection(db, 'workouts'), workoutData);
      console.log('✅ Workout entry added with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error adding workout entry:', error);
      throw error;
    }
  }

  // Get daily workouts for a user
  async getDailyWorkouts(userId: string, date: Date): Promise<DailyWorkoutSummary> {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      console.log('📊 Fetching workouts for user:', userId, 'date range:', startOfDay, 'to', endOfDay);

      const q = query(
        collection(db, 'workouts'),
        where('userId', '==', userId),
        where('completedAt', '>=', Timestamp.fromDate(startOfDay)),
        where('completedAt', '<=', Timestamp.fromDate(endOfDay))
      );

      const querySnapshot = await getDocs(q);
      console.log('📋 Found workout documents:', querySnapshot.size);

      const workouts: WorkoutEntry[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        workouts.push({
          id: doc.id,
          ...data,
          completedAt: data.completedAt.toDate(),
        } as WorkoutEntry);
      });

      // Calculate summary
      const totalDuration = workouts.reduce((sum, workout) => sum + workout.duration, 0);
      const totalCalories = workouts.reduce((sum, workout) => sum + workout.caloriesBurned, 0);
      const exerciseCount = workouts.length;

      return {
        totalDuration,
        totalCalories,
        exerciseCount,
        workouts,
      };
    } catch (error) {
      console.error('❌ Error fetching daily workouts:', error);
      throw error;
    }
  }

  // Delete workout entry
  async deleteWorkoutEntry(entryId: string): Promise<void> {
    try {
      console.log('🗑️ Deleting workout entry:', entryId);
      await deleteDoc(doc(db, 'workouts', entryId));
      console.log('✅ Workout entry deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting workout entry:', error);
      throw error;
    }
  }

  // Get user's weight from Firestore profile (updated method)
  async getUserWeight(userId?: string): Promise<number> {
    try {
      if (!userId) {
        console.log('❌ No user ID provided, using default weight');
        return 70; // Default fallback
      }

      console.log('🔍 Fetching user weight from Firestore for user:', userId);
      const user = await UserService.getUser(userId);
      
      if (user && user.profile.currentWeight) {
        console.log('✅ User weight found:', user.profile.currentWeight);
        return user.profile.currentWeight;
      }

      // Fallback to AsyncStorage for backward compatibility
      console.log('⚠️ No weight in profile, checking AsyncStorage...');
      const weight = await AsyncStorage.getItem('userWeight');
      const fallbackWeight = weight ? parseFloat(weight) : 70;
      
      console.log('📱 Using fallback weight:', fallbackWeight);
      return fallbackWeight;
    } catch (error) {
      console.error('❌ Error getting user weight:', error);
      return 70; // Default fallback
    }
  }

  // Save user's weight to Firestore profile (updated method)
  async saveUserWeight(weight: number, userId?: string): Promise<void> {
    try {
      if (!userId) {
        console.log('❌ No user ID provided, saving to AsyncStorage only');
        await AsyncStorage.setItem('userWeight', weight.toString());
        return;
      }

      console.log('💾 Saving user weight to Firestore:', weight);
      
      // Update user profile in Firestore
      await UserService.updateUserProfile(userId, {
        currentWeight: weight
      });
      
      // Also save to AsyncStorage for offline access
      await AsyncStorage.setItem('userWeight', weight.toString());
      console.log('✅ User weight saved successfully');
    } catch (error) {
      console.error('❌ Error saving user weight:', error);
      throw error;
    }
  }

  // Get exercise categories based on body parts
  getExerciseCategories() {
    return [
      { name: 'Chest', value: 'chest' },
      { name: 'Back', value: 'back' },
      { name: 'Shoulders', value: 'shoulders' },
      { name: 'Arms', value: 'upper arms' },
      { name: 'Legs', value: 'lower legs' },
      { name: 'Core', value: 'waist' },
      { name: 'Cardio', value: 'cardio' },
    ];
  }

  // Get difficulty levels
  getDifficultyLevels() {
    return [
      { name: 'Beginner', value: 'beginner' },
      { name: 'Intermediate', value: 'intermediate' },
      { name: 'Expert', value: 'expert' },
    ];
  }

  // Add method to get API status with exercise count
  async checkApiStatus(): Promise<{ isConfigured: boolean; status: string; exerciseCount?: number }> {
    try {
      console.log('🔍 Checking ExerciseDB API status...');
      
      const response = await fetch(`${this.BASE_URL}/exercises?limit=1`);
      
      if (!response.ok) {
        return {
          isConfigured: false,
          status: 'ExerciseDB API unavailable. Using built-in exercise database.',
        };
      }

      const data = await response.json();
      const parsed = this.parseApiResponse(data);
      
      if (parsed.success && parsed.exercises.length > 0) {
        // Try to get total count
        const countResponse = await fetch(`${this.BASE_URL}/exercises?limit=1000`);
        if (countResponse.ok) {
          const countData = await countResponse.json();
          const countParsed = this.parseApiResponse(countData);
          
          return {
            isConfigured: true,
            status: 'ExerciseDB API connected successfully',
            exerciseCount: countParsed.exercises.length,
          };
        }
        
        return {
          isConfigured: true,
          status: 'ExerciseDB API connected successfully',
        };
      }

      return {
        isConfigured: false,
        status: 'ExerciseDB API response format changed. Using built-in database.',
      };
    } catch (error) {
      console.error('❌ ExerciseDB API check failed:', error);
      return {
        isConfigured: false,
        status: 'ExerciseDB API unavailable. Using built-in exercise database.',
      };
    }
  }

  // New methods for 7-day workout plan system

  // Get current day of week
  private getCurrentDayOfWeek(): string {
    // Return capitalized day names to match UI expectations
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date().getDay()];
  }

  // Helper function to remove undefined values from objects before saving to Firestore
  private cleanDataForFirestore<T>(obj: T): T {
    const cleaned = {} as T;
    Object.keys(obj as any).forEach(key => {
      const value = (obj as any)[key];
      if (value !== undefined) {
        (cleaned as any)[key] = value;
      }
    });
    return cleaned;
  }

  // Create or update a day's workout plan
  async saveDayWorkoutPlan(userId: string, dayPlan: Omit<DayWorkoutPlan, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      console.log('💾 Saving day plan:', { 
        dayOfWeek: dayPlan.dayOfWeek,
        exerciseCount: dayPlan.exercises?.length || 0
      })

      const existingQuery = query(
        collection(db, this.WORKOUT_PLANS_COLLECTION),
        where('userId', '==', userId),
        where('dayOfWeek', '==', dayPlan.dayOfWeek)
      )

      const existingDocs = await getDocs(existingQuery)
      
      if (!existingDocs.empty) {
        // Update existing plan
        const docRef = existingDocs.docs[0].ref
        const existingData = existingDocs.docs[0].data()
        
        const updateData = this.cleanDataForFirestore({
          ...dayPlan,
          userId,
          createdAt: existingData.createdAt || Timestamp.fromDate(new Date()),
          updatedAt: Timestamp.fromDate(new Date())
        })
        
        await updateDoc(docRef, updateData)
        console.log(`✅ Updated ${dayPlan.dayOfWeek} workout plan`)
        return existingDocs.docs[0].id
      } else {
        // Create new plan
        const createData = this.cleanDataForFirestore({
          ...dayPlan,
          userId,
          createdAt: Timestamp.fromDate(new Date()),
          updatedAt: Timestamp.fromDate(new Date())
        })
        
        const docRef = await addDoc(collection(db, this.WORKOUT_PLANS_COLLECTION), createData)
        console.log(`✅ Created ${dayPlan.dayOfWeek} workout plan`)
        return docRef.id
      }
    } catch (error) {
      console.error('❌ Error saving day workout plan:', error)
      throw error
    }
  }

  // Get workout plan for a specific day
  async getDayWorkoutPlan(userId: string, dayOfWeek: string): Promise<DayWorkoutPlan | null> {
    try {
      const q = query(
        collection(db, this.WORKOUT_PLANS_COLLECTION),
        where('userId', '==', userId),
        where('dayOfWeek', '==', dayOfWeek) // Remove .toLowerCase() to match exact case
      );

      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      const data = doc.data();
      
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as DayWorkoutPlan;
    } catch (error) {
      console.error('❌ Error getting day workout plan:', error);
      return null;
    }
  }

  // Get all weekly workout plans for user
  async getWeeklyWorkoutPlan(userId: string): Promise<{ [key: string]: DayWorkoutPlan }> {
    try {
      const q = query(
        collection(db, this.WORKOUT_PLANS_COLLECTION),
        where('userId', '==', userId)
      );

      const snapshot = await getDocs(q);
      const weeklyPlan: { [key: string]: DayWorkoutPlan } = {};

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        weeklyPlan[data.dayOfWeek] = {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as DayWorkoutPlan;
      });

      return weeklyPlan;
    } catch (error) {
      console.error('❌ Error getting weekly workout plan:', error);
      return {};
    }
  }

  // Add exercise to day plan
  async addExerciseToDayPlan(
    userId: string, 
    dayOfWeek: string, 
    exercise: Exercise, 
    sets: number, 
    reps: number,
    duration?: number,
    restTime?: number,
    weight?: number,
    notes?: string
  ): Promise<void> {
    try {
      let dayPlan = await this.getDayWorkoutPlan(userId, dayOfWeek);
      
      if (!dayPlan) {
        // Create new day plan with capitalized day name
        dayPlan = {
          userId,
          dayOfWeek: dayOfWeek as any,
          planName: `${dayOfWeek} Workout`,
          exercises: [],
          targetMuscleGroups: [],
          estimatedDuration: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }

      // Create exercise object with only defined values
      const newExercise: any = {
        exerciseId: exercise.id || `exercise_${Date.now()}`, // Ensure we have an ID
        exerciseName: exercise.name || 'Unknown Exercise',
        sets,
        reps,
        restTime: restTime || 60,
        completed: false,
      };

      // Only add optional fields if they have values
      if (duration !== undefined && duration > 0) {
        newExercise.duration = duration;
      }
      
      if (weight !== undefined && weight > 0) {
        newExercise.weight = weight;
      }
      
      if (notes && notes.trim() !== '') {
        newExercise.notes = notes.trim();
      }

      // Clean the exercise object to ensure no undefined values
      const cleanedExercise = this.cleanDataForFirestore(newExercise);
      dayPlan.exercises.push(cleanedExercise);
      
      // Update target muscle groups
      if (exercise.muscle && !dayPlan.targetMuscleGroups.includes(exercise.muscle)) {
        dayPlan.targetMuscleGroups.push(exercise.muscle);
      }

      // Estimate duration (2 minutes per set + rest time)
      const exerciseDuration = sets * (2 + (newExercise.restTime || 60) / 60);
      dayPlan.estimatedDuration += exerciseDuration;
      dayPlan.updatedAt = new Date();

      // Clean the entire dayPlan before saving
      const cleanedDayPlan = this.cleanDataForFirestore(dayPlan);
      await this.saveDayWorkoutPlan(userId, cleanedDayPlan);
      console.log(`✅ Added ${exercise.name} to ${dayOfWeek} plan with ${sets} sets, ${reps} reps`);
    } catch (error) {
      console.error('❌ Error adding exercise to day plan:', error);
      throw error;
    }
  }

  // Remove exercise from day plan
  async removeExerciseFromDayPlan(userId: string, dayOfWeek: string, exerciseIndex: number): Promise<void> {
    try {
      console.log('🗑️ removeExerciseFromDayPlan called:', { userId, dayOfWeek, exerciseIndex })
      
      console.log('📞 About to call getDayWorkoutPlan...')
      const dayPlan = await this.getDayWorkoutPlan(userId, dayOfWeek)
      console.log('📋 getDayWorkoutPlan result:', {
        hasPlan: !!dayPlan,
        planId: dayPlan?.id,
        exerciseCount: dayPlan?.exercises?.length || 0,
        exercises: dayPlan?.exercises?.map((ex, idx) => ({ idx, name: ex.exerciseName, id: ex.exerciseId }))
      })
      
      if (!dayPlan) {
        console.error('❌ No day plan found')
        throw new Error(`No workout plan found for ${dayOfWeek}`)
      }
      
      if (!dayPlan.exercises || dayPlan.exercises.length === 0) {
        console.error('❌ No exercises in day plan')
        throw new Error('No exercises found in the day plan')
      }
      
      if (exerciseIndex < 0 || exerciseIndex >= dayPlan.exercises.length) {
        console.error('❌ Invalid exercise index:', { 
          exerciseIndex, 
          exerciseCount: dayPlan.exercises.length,
          validRange: `0-${dayPlan.exercises.length - 1}`
        })
        throw new Error(`Exercise index ${exerciseIndex} is out of range (0-${dayPlan.exercises.length - 1})`)
      }

      const removedExercise = dayPlan.exercises[exerciseIndex]
      console.log('🎯 About to remove exercise:', {
        index: exerciseIndex,
        name: removedExercise.exerciseName,
        id: removedExercise.exerciseId,
        sets: removedExercise.sets,
        restTime: removedExercise.restTime
      })

      // Remove the exercise from the array
      console.log('✂️ Removing exercise from array...')
      dayPlan.exercises.splice(exerciseIndex, 1)
      console.log('✂️ Exercise removed from array, remaining:', dayPlan.exercises.length)

      // Recalculate duration
      console.log('⏱️ Recalculating duration...')
      const exerciseDuration = removedExercise.sets * (2 + (removedExercise.restTime || 60) / 60)
      const oldDuration = dayPlan.estimatedDuration
      dayPlan.estimatedDuration = Math.max(0, dayPlan.estimatedDuration - exerciseDuration)
      console.log('⏱️ Duration updated:', {
        removedDuration: exerciseDuration,
        oldDuration,
        newDuration: dayPlan.estimatedDuration
      })

      // Create the plan data to save
      const planToSave = {
        dayOfWeek: dayPlan.dayOfWeek,
        planName: dayPlan.planName,
        exercises: dayPlan.exercises,
        targetMuscleGroups: dayPlan.targetMuscleGroups,
        estimatedDuration: dayPlan.estimatedDuration
      }
      
      console.log('💾 About to save updated plan:', {
        dayOfWeek: planToSave.dayOfWeek,
        exerciseCount: planToSave.exercises.length,
        estimatedDuration: planToSave.estimatedDuration
      })
      
      await this.saveDayWorkoutPlan(userId, planToSave)
      console.log(`✅ Successfully removed "${removedExercise.exerciseName}" from ${dayOfWeek} plan`)
      
    } catch (error) {
      console.error('❌ Error removing exercise from day plan:', error)
      console.error('❌ Error details:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name
      })
      throw error
    }
  }

  // Mark exercise as completed
  async markExerciseCompleted(userId: string, dayOfWeek: string, exerciseIndex: number, weight?: number, notes?: string): Promise<void> {
    try {
      const dayPlan = await this.getDayWorkoutPlan(userId, dayOfWeek);
      
      if (!dayPlan || !dayPlan.exercises[exerciseIndex]) {
        throw new Error('Exercise not found');
      }

      dayPlan.exercises[exerciseIndex].completed = true;
      dayPlan.exercises[exerciseIndex].completedAt = new Date();
      
      // Only set weight and notes if they have values
      if (weight !== undefined && weight > 0) {
        dayPlan.exercises[exerciseIndex].weight = weight;
      }
      
      if (notes && notes.trim() !== '') {
        dayPlan.exercises[exerciseIndex].notes = notes.trim();
      }

      // Clean the entire dayPlan before saving
      const cleanedDayPlan = this.cleanDataForFirestore(dayPlan);
      await this.saveDayWorkoutPlan(userId, cleanedDayPlan);
      console.log(`✅ Marked ${dayPlan.exercises[exerciseIndex].exerciseName} as completed`);
    } catch (error) {
      console.error('❌ Error marking exercise as completed:', error);
      throw error;
    }
  }

  // Helper method to get the start of the current week (Monday)
  private getWeekStartDate(date: Date = new Date()): string {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().split('T')[0];
  }

  // Check if we're in a new week and reset completions
  private async checkAndResetWeeklyProgress(userId: string): Promise<void> {
    try {
      // Get stored week start date
      const lastWeekKey = `lastWeekReset_${userId}`;
      const currentWeekStart = this.getWeekStartDate();
      
      // Check local storage or a simple flag
      const lastResetWeek = localStorage?.getItem(lastWeekKey);
      
      if (!lastResetWeek || lastResetWeek !== currentWeekStart) {
        console.log('🔄 New week detected, resetting workout progress...');
        
        // Reset all exercise completions for the week
        const weeklyPlan = await this.getWeeklyWorkoutPlan(userId);
        
        for (const [dayName, dayPlan] of Object.entries(weeklyPlan)) {
          if (dayPlan && dayPlan.exercises.length > 0) {
            // Reset completion status for all exercises
            const resetPlan = { ...dayPlan };
            resetPlan.exercises = dayPlan.exercises.map(exercise => ({
              ...exercise,
              completed: false,
              completedAt: undefined
            }));
            
            await this.saveDayWorkoutPlan(userId, resetPlan);
          }
        }
        
        // Update the stored week
        if (localStorage) {
          localStorage.setItem(lastWeekKey, currentWeekStart);
        }
        
        console.log('✅ Weekly workout progress reset completed');
      }
    } catch (error) {
      console.error('❌ Error resetting weekly progress:', error);
    }
  }

  // Updated getTodaysWorkoutSummary to include weekly reset check
  async getTodaysWorkoutSummary(userId: string): Promise<DailyWorkoutSummary> {
    try {
      // Check and reset weekly progress if needed
      await this.checkAndResetWeeklyProgress(userId);
      
      const today = new Date();
      const dayOfWeek = this.getCurrentDayOfWeek();
      const dateString = today.toISOString().split('T')[0];

      const dayPlan = await this.getDayWorkoutPlan(userId, dayOfWeek);
      
      if (!dayPlan) {
        return {
          date: dateString,
          dayOfWeek,
          plannedExercises: [],
          completedExercises: [],
          totalPlannedDuration: 0,
          totalCompletedDuration: 0,
          totalCaloriesBurned: 0,
          progressPercentage: 0,
        };
      }

      const completedExercises = dayPlan.exercises.filter(ex => ex.completed);
      const userWeight = await this.getUserWeight(userId);
      
      // Calculate calories burned for completed exercises
      let totalCaloriesBurned = 0;
      for (const exercise of completedExercises) {
        const duration = exercise.sets * 2; // Estimate 2 minutes per set
        const caloriesData = await this.calculateCaloriesBurned(exercise.exerciseName, userWeight, duration);
        totalCaloriesBurned += caloriesData.length > 0 ? caloriesData[0].total_calories : duration * 5;
      }

      const progressPercentage = dayPlan.exercises.length > 0 
        ? (completedExercises.length / dayPlan.exercises.length) * 100 
        : 0;

      return {
        date: dateString,
        dayOfWeek,
        plannedExercises: dayPlan.exercises,
        completedExercises,
        totalPlannedDuration: dayPlan.estimatedDuration,
        totalCompletedDuration: completedExercises.reduce((total, ex) => total + (ex.sets * 2), 0),
        totalCaloriesBurned: Math.round(totalCaloriesBurned),
        progressPercentage: Math.round(progressPercentage),
      };
    } catch (error) {
      console.error('❌ Error getting today\'s workout summary:', error);
      throw error;
    }
  }
}

export const workoutService = new WorkoutService(); 