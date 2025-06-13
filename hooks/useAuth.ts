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
import { GoalCalculationService } from '../services/goalCalculationService'
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
      const healthGoal = userData?.healthGoals || 'Improve Fitness'
      
      // Convert all numeric values to numbers properly
      const weight = userData?.weight ? parseFloat(userData.weight) : 70
      const height = userData?.height ? parseFloat(userData.height) : 170
      const goalWeight = userData?.goalWeight ? parseFloat(userData.goalWeight) : undefined
      const age = userData?.dateOfBirth ? calculateAge(userData.dateOfBirth) : 30
      const gender = userData?.gender?.toLowerCase() as 'male' | 'female' | undefined
      const activityLevel = mapActivityLevel(userData?.activityLevel)

      // Create a proper user object for goal calculations
      const tempUser = {
        id: firebaseUser.uid,
        email: firebaseUser.email || '',
        profile: {
          name: userData?.firstName && userData?.lastName 
            ? `${userData.firstName} ${userData.lastName}` 
            : '',
          age: age,
          gender: gender,
          height: height,
          currentWeight: weight,
          goalWeight: goalWeight,
          activityLevel: activityLevel,
          healthGoals: healthGoal
        }
      }

      // Calculate personalized goals with proper user object
      const personalizedGoals = GoalCalculationService.calculatePersonalizedGoals(tempUser as any, healthGoal)

      // Create user document in Firestore
      await UserService.createUser(firebaseUser.uid, {
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
          ...(goalWeight && { goalWeight: goalWeight }),
          activityLevel: activityLevel,
          healthGoals: healthGoal,
          dailyCalorieTarget: personalizedGoals.calorieGoal,
          dailyWaterTarget: GoalCalculationService.getRecommendedWaterIntake(tempUser as any, healthGoal),
          sleepDurationTarget: GoalCalculationService.getRecommendedSleep(healthGoal),
          weeklyWorkoutTarget: GoalCalculationService.getRecommendedWorkouts(healthGoal)
        }
      })

      console.log('✅ User created with personalized goals')
      
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