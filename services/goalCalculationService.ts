import { DailyNutritionGoals } from '../types/nutrition'
import { User } from '../types/user'

interface HealthGoalSettings {
  calorieMultiplier: number
  proteinPerKg: number
  carbsPercentage: number
  fatPercentage: number
  waterMultiplier: number
  sleepHours: number
  workoutDays: number
}

export class GoalCalculationService {
  private static readonly GOAL_SETTINGS: Record<string, HealthGoalSettings> = {
    'Lose Weight': {
      calorieMultiplier: 0.8, // 20% deficit
      proteinPerKg: 1.6,
      carbsPercentage: 0.35,
      fatPercentage: 0.25,
      waterMultiplier: 35,
      sleepHours: 8,
      workoutDays: 4
    },
    'Gain Weight': {
      calorieMultiplier: 1.2, // 20% surplus
      proteinPerKg: 1.8,
      carbsPercentage: 0.45,
      fatPercentage: 0.25,
      waterMultiplier: 40,
      sleepHours: 8,
      workoutDays: 5
    },
    'Build Muscle': {
      calorieMultiplier: 1.1, // Slight surplus
      proteinPerKg: 2.0,
      carbsPercentage: 0.40,
      fatPercentage: 0.25,
      waterMultiplier: 40,
      sleepHours: 8,
      workoutDays: 5
    },
    'Improve Fitness': {
      calorieMultiplier: 1.0,
      proteinPerKg: 1.4,
      carbsPercentage: 0.50,
      fatPercentage: 0.20,
      waterMultiplier: 35,
      sleepHours: 8,
      workoutDays: 4
    },
    'Maintain Weight': {
      calorieMultiplier: 1.0,
      proteinPerKg: 1.2,
      carbsPercentage: 0.45,
      fatPercentage: 0.25,
      waterMultiplier: 35,
      sleepHours: 8,
      workoutDays: 3
    },
    'Better Sleep': {
      calorieMultiplier: 1.0,
      proteinPerKg: 1.2,
      carbsPercentage: 0.40,
      fatPercentage: 0.30,
      waterMultiplier: 30,
      sleepHours: 9,
      workoutDays: 3
    },
    'Reduce Stress': {
      calorieMultiplier: 1.0,
      proteinPerKg: 1.2,
      carbsPercentage: 0.45,
      fatPercentage: 0.25,
      waterMultiplier: 35,
      sleepHours: 8,
      workoutDays: 3
    },
    'General Health': {
      calorieMultiplier: 1.0,
      proteinPerKg: 1.2,
      carbsPercentage: 0.45,
      fatPercentage: 0.25,
      waterMultiplier: 35,
      sleepHours: 8,
      workoutDays: 3
    }
  }

  private static readonly ACTIVITY_MULTIPLIERS = {
    'sedentary': 1.2,
    'light': 1.375,
    'moderate': 1.55,
    'active': 1.725,
    'extremely active': 1.9
  }

  static calculateBMR(weight: number, height: number, age: number, gender: 'male' | 'female'): number {
    // Mifflin-St Jeor Equation
    if (gender === 'male') {
      return 10 * weight + 6.25 * height - 5 * age + 5
    } else {
      return 10 * weight + 6.25 * height - 5 * age - 161
    }
  }

  static calculateTDEE(bmr: number, activityLevel: string): number {
    const multiplier = this.ACTIVITY_MULTIPLIERS[activityLevel.toLowerCase() as keyof typeof this.ACTIVITY_MULTIPLIERS] || 1.2
    return bmr * multiplier
  }

  static calculatePersonalizedGoals(user: User, healthGoal: string): DailyNutritionGoals {
    const profile = user.profile
    const goalSettings = this.GOAL_SETTINGS[healthGoal] || this.GOAL_SETTINGS['General Health']
    
    // Use provided values or defaults
    const weight = profile.currentWeight || 70
    const height = profile.height || 170
    const age = profile.age || 30
    const gender = profile.gender || 'male'
    const activityLevel = profile.activityLevel || 'moderate'
    
    // Calculate BMR and TDEE
    const bmr = this.calculateBMR(weight, height, age, gender)
    const tdee = this.calculateTDEE(bmr, activityLevel)
    
    // Apply goal-specific modifications
    const targetCalories = Math.round(tdee * goalSettings.calorieMultiplier)
    const proteinGoal = Math.round(weight * goalSettings.proteinPerKg)
    const carbsGoal = Math.round((targetCalories * goalSettings.carbsPercentage) / 4) // 4 cal per gram
    const fatGoal = Math.round((targetCalories * goalSettings.fatPercentage) / 9) // 9 cal per gram
    const waterGoal = Math.round(weight * goalSettings.waterMultiplier) // ml per kg
    
    const today = new Date()
    const dateString = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`
    
    return {
      date: dateString,
      userId: user.id,
      targetMeals: {
        breakfast: 1,
        lunch: 1,
        dinner: 1,
        snacks: healthGoal === 'Gain Weight' || healthGoal === 'Build Muscle' ? 3 : 2
      },
      calorieGoal: targetCalories,
      proteinGoal: proteinGoal,
      carbsGoal: carbsGoal,
      fatGoal: fatGoal,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }

  static getRecommendedWaterIntake(user: User, healthGoal: string): number {
    if (!user || !user.profile) {
      console.warn('⚠️ User or profile is undefined, using default water intake calculation')
      return 2000 // Default 2L for adults
    }
    
    const profile = user.profile
    const goalSettings = this.GOAL_SETTINGS[healthGoal] || this.GOAL_SETTINGS['General Health']
    const weight = profile.currentWeight || 70
    
    return Math.round(weight * goalSettings.waterMultiplier)
  }

  static getRecommendedSleep(healthGoal: string): number {
    const goalSettings = this.GOAL_SETTINGS[healthGoal] || this.GOAL_SETTINGS['General Health']
    return goalSettings.sleepHours
  }

  static getRecommendedWorkouts(healthGoal: string): number {
    const goalSettings = this.GOAL_SETTINGS[healthGoal] || this.GOAL_SETTINGS['General Health']
    return goalSettings.workoutDays
  }
} 