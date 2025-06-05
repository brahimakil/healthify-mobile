import { router } from 'expo-router'
import {
    createUserWithEmailAndPassword,
    User as FirebaseUser,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    updateProfile
} from 'firebase/auth'
import { useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { PlanGenerationService } from '../services/planGenerationService'
import { UserService } from '../services/userService'
import { auth } from '../utils/firebase'

interface AuthContextType {
  user: FirebaseUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, userData?: any) => Promise<void>
  logout: () => Promise<void>
  isAuthenticated: boolean
}

export const useAuth = (): AuthContextType => {
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    console.log('Setting up auth state listener...')
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('Auth state changed:', user ? 'User logged in' : 'User logged out')
      setUser(user)
      setLoading(false)
      
      // For web, ensure session is properly stored
      if (Platform.OS === 'web' && user) {
        try {
          localStorage.setItem('healthify-user-session', JSON.stringify({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            timestamp: Date.now()
          }))
          console.log('Web session stored successfully')
        } catch (error) {
          console.warn('Failed to store session in localStorage:', error)
        }
      } else if (Platform.OS === 'web' && !user) {
        // Clear web session when user logs out
        try {
          localStorage.removeItem('healthify-user-session')
          console.log('Web session cleared')
        } catch (error) {
          console.warn('Failed to clear session from localStorage:', error)
        }
      }
    }, (error) => {
      console.error('Auth state change error:', error)
      setLoading(false)
    })

    // Check for existing session on web
    if (Platform.OS === 'web') {
      try {
        const storedSession = localStorage.getItem('healthify-user-session')
        if (storedSession) {
          const session = JSON.parse(storedSession)
          console.log('Found existing web session:', session)
        }
      } catch (error) {
        console.warn('Failed to read session from localStorage:', error)
      }
    }

    return unsubscribe
  }, [])

  const login = async (email: string, password: string): Promise<void> => {
    try {
      console.log('Attempting login for:', email)
      const result = await signInWithEmailAndPassword(auth, email, password)
      console.log('Login successful for user:', result.user.uid)
      
      // Navigate to dashboard after successful login
      setTimeout(() => {
        router.replace('/(auth)/dashboard')
      }, 100)
    } catch (error) {
      console.error('Login error:', error)
      throw error
    }
  }

  const register = async (email: string, password: string, userData?: any): Promise<void> => {
    try {
      console.log('Attempting registration for:', email)
      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const firebaseUser = userCredential.user
      
      // Update display name if provided
      if (userData?.firstName && userData?.lastName) {
        const displayName = `${userData.firstName} ${userData.lastName}`
        await updateProfile(firebaseUser, { displayName })
      }

      // Calculate personalized goals based on health goals
      const healthGoal = userData?.healthGoals || 'Improve Fitness' // Default to one of the 4 options
      const weight = userData?.weight ? parseInt(userData.weight) : 70
      const height = userData?.height ? parseInt(userData.height) : 170
      const age = userData?.dateOfBirth ? calculateAge(userData.dateOfBirth) : 30
      const gender = userData?.gender?.toLowerCase() as 'male' | 'female' | undefined
      const activityLevel = mapActivityLevel(userData?.activityLevel)

      // Use existing goal calculation (preserves current logic)
      const goalSettings = {
        'Lose Weight': { calories: 0.8, protein: 1.6, water: 35, sleep: 8, workouts: 4 },
        'Gain Weight': { calories: 1.2, protein: 1.8, water: 40, sleep: 8, workouts: 5 },
        'Build Muscle': { calories: 1.1, protein: 2.0, water: 40, sleep: 8, workouts: 5 },
        'Improve Fitness': { calories: 1.0, protein: 1.4, water: 35, sleep: 8, workouts: 4 },
      }

      const modifier = goalSettings[healthGoal as keyof typeof goalSettings] || goalSettings['Improve Fitness']
      
      // Calculate BMR and TDEE (preserves existing calculation logic)
      const bmr = gender === 'male' 
        ? 10 * weight + 6.25 * height - 5 * age + 5
        : 10 * weight + 6.25 * height - 5 * age - 161

      const activityMultipliers = {
        'sedentary': 1.2,
        'light': 1.375,
        'moderate': 1.55,
        'active': 1.725
      }
      
      const tdee = bmr * (activityMultipliers[activityLevel] || 1.375)
      
      const personalizedGoals = {
        dailyCalorieTarget: Math.round(tdee * modifier.calories),
        dailyWaterTarget: Math.round(weight * modifier.water),
        sleepDurationTarget: modifier.sleep,
        weeklyWorkoutTarget: modifier.workouts
      }

      // Create user document in Firestore (preserves existing structure)
      const newUser = await UserService.createUser(firebaseUser.uid, {
        email: firebaseUser.email || '',
        displayName: userData?.firstName && userData?.lastName 
          ? `${userData.firstName} ${userData.lastName}` 
          : '',
        photoURL: firebaseUser.photoURL || '',
        role: 'user',
        profile: {
          name: userData?.firstName && userData?.lastName 
            ? `${userData.firstName} ${userData.lastName}` 
            : '',
          age: age,
          gender: gender,
          height: height,
          currentWeight: weight,
          goalWeight: userData?.goalWeight ? parseInt(userData.goalWeight) : undefined,
          activityLevel: activityLevel,
          healthGoals: healthGoal,
          ...personalizedGoals
        }
      })

      // Get the created user for plan generation
      const createdUser = await UserService.getUser(firebaseUser.uid)
      if (createdUser) {
        // Generate comprehensive plan using the new service
        await PlanGenerationService.generateComprehensivePlan(createdUser, healthGoal)
      }

      console.log('✅ User created with personalized goals and comprehensive plan')
      
      // Navigate to dashboard after successful registration
      setTimeout(() => {
        router.replace('/(auth)/dashboard')
      }, 100)
    } catch (error) {
      console.error('Registration error:', error)
      throw error
    }
  }

  const logout = async (): Promise<void> => {
    try {
      console.log('Logging out user...')
      
      // First sign out from Firebase
      await signOut(auth)
      
      // Clear web session storage
      if (Platform.OS === 'web') {
        try {
          localStorage.removeItem('healthify-user-session')
          console.log('Web session cleared from localStorage')
        } catch (error) {
          console.warn('Failed to clear session from localStorage:', error)
        }
      }
      
      console.log('Logout successful')
      
      // Navigate to onboarding after logout
      setTimeout(() => {
        router.replace('/onboarding')
      }, 100)
    } catch (error) {
      console.error('Logout error:', error)
      throw error
    }
  }

  return {
    user,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user,
  }
}

// Helper functions
const calculateAge = (birthDate: string): number => {
  if (!birthDate) return 0
  
  const birth = new Date(birthDate)
  const today = new Date()
  const age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    return age - 1
  }
  return age
}

const mapActivityLevel = (level: string): 'sedentary' | 'light' | 'moderate' | 'active' => {
  switch (level?.toLowerCase()) {
    case 'sedentary':
      return 'sedentary'
    case 'lightly active':
      return 'light'
    case 'moderately active':
      return 'moderate'
    case 'very active':
    case 'extremely active':
      return 'active'
    default:
      return 'moderate'
  }
} 