export interface User {
  id: string
  email: string
  displayName?: string
  photoURL?: string
  role: 'user' | 'dietitian'
  createdAt: Date
  updatedAt: Date
  
  // Profile data
  profile: {
    name: string
    age?: number
    gender?: 'male' | 'female'
    height?: number // in cm
    currentWeight?: number // in kg
    goalWeight?: number // in kg
    activityLevel?: 'sedentary' | 'light' | 'moderate' | 'active' | 'extremely active'
    healthGoals?: string // Primary health goal selected during signup
    dietaryPreferences?: string[]
    
    // Goals (calculated based on health goals)
    dailyCalorieTarget?: number
    dailyWaterTarget?: number // in ml
    sleepDurationTarget?: number // in hours
    weeklyWorkoutTarget?: number
    
    // AI Configuration
    googleApiKey?: string // Google Gemini API key for AI features
  }
}

export interface UserDocument {
  email: string
  displayName?: string
  photoURL?: string
  role: 'user' | 'dietitian'
  createdAt: Date
  updatedAt: Date
  profile: User['profile']
}