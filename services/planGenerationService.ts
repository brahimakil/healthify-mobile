import { addDoc, collection, deleteDoc, getDocs, query, where } from 'firebase/firestore'
import { User } from '../types/user'
import { db } from '../utils/firebase'
import { GoalCalculationService } from './goalCalculationService'
import { HydrationService } from './hydrationService'
import { NutritionService } from './nutritionService'
import { sleepService } from './sleepService'
import { UserService } from './userService'

export interface HealthPlan {
  id: string
  userId: string
  healthGoal: string
  nutritionGoals: {
    calorieGoal: number
    proteinGoal: number
    carbsGoal: number
    fatGoal: number
  }
  workoutPlan: {
    workoutsPerWeek: number
    recommendedFocus: string[]
  }
  hydrationGoal: number // ml
  sleepGoal: number // hours
  createdAt: Date
  updatedAt: Date
}

export class PlanGenerationService {
  private static readonly PLANS_COLLECTION = 'userPlans'

  static async generateComprehensivePlan(user: User, healthGoal: string): Promise<void> {
    try {
      console.log(`🎯 Generating comprehensive plan for: ${healthGoal}`)

      // 1. Calculate and set nutrition goals (preserves existing nutrition functionality)
      const nutritionGoals = GoalCalculationService.calculatePersonalizedGoals(user, healthGoal)
      await NutritionService.setDailyGoals(nutritionGoals)

      // 2. Set hydration goal (preserves existing hydration functionality)
      const hydrationGoal = GoalCalculationService.getRecommendedWaterIntake(user, healthGoal)
      await HydrationService.setUserHydrationGoal(user.id, user, hydrationGoal)

      // 3. Set sleep goal (preserves existing sleep functionality)
      const sleepGoal = GoalCalculationService.getRecommendedSleep(healthGoal)
      await sleepService.setSleepGoals({
        userId: user.id,
        targetSleepDuration: sleepGoal,
        targetBedtime: '22:00',
        targetWakeTime: `${6 + sleepGoal}:00`,
      })

      // 4. Store overall plan metadata (doesn't interfere with existing workout API)
      const plan: Omit<HealthPlan, 'id'> = {
        userId: user.id,
        healthGoal,
        nutritionGoals: {
          calorieGoal: nutritionGoals.calorieGoal,
          proteinGoal: nutritionGoals.proteinGoal,
          carbsGoal: nutritionGoals.carbsGoal,
          fatGoal: nutritionGoals.fatGoal,
        },
        workoutPlan: {
          workoutsPerWeek: GoalCalculationService.getRecommendedWorkouts(healthGoal),
          recommendedFocus: this.getFocusAreas(healthGoal),
        },
        hydrationGoal,
        sleepGoal,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      await addDoc(collection(db, this.PLANS_COLLECTION), plan)
      console.log('✅ Comprehensive plan generated successfully!')

    } catch (error) {
      console.error('❌ Error generating comprehensive plan:', error)
      throw error
    }
  }

  private static getFocusAreas(healthGoal: string): string[] {
    const focusMap = {
      'Lose Weight': ['cardio', 'full body', 'core'],
      'Gain Weight': ['chest', 'back', 'legs', 'shoulders'],
      'Build Muscle': ['chest', 'back', 'legs', 'shoulders', 'arms'],
      'Improve Fitness': ['cardio', 'full body', 'core', 'legs'],
    }
    return focusMap[healthGoal as keyof typeof focusMap] || ['full body']
  }

  static async switchHealthPlan(userId: string, newHealthGoal: string): Promise<void> {
    try {
      console.log(`🔄 Switching health plan to: ${newHealthGoal}`)

      // Get user data
      const user = await UserService.getUser(userId)
      if (!user) throw new Error('User not found')

      // Clear existing plan goals (NOT the data/entries - preserves all logged data)
      await this.clearExistingPlanGoals(userId)

      // Update user's health goal
      await UserService.updateUser(userId, {
        ...user,
        profile: {
          ...user.profile,
          healthGoals: newHealthGoal,
        }
      })

      // Generate new comprehensive plan
      await this.generateComprehensivePlan(user, newHealthGoal)

      console.log('✅ Health plan switched successfully!')

    } catch (error) {
      console.error('❌ Error switching health plan:', error)
      throw error
    }
  }

  private static async clearExistingPlanGoals(userId: string): Promise<void> {
    try {
      // ONLY clear plan metadata, NOT user data entries
      const plansQuery = query(collection(db, this.PLANS_COLLECTION), where('userId', '==', userId))
      const plansSnapshot = await getDocs(plansQuery)
      
      for (const doc of plansSnapshot.docs) {
        await deleteDoc(doc.ref)
      }

      console.log('🗑️ Existing plan goals cleared (data preserved)')

    } catch (error) {
      console.error('❌ Error clearing existing plan goals:', error)
      throw error
    }
  }

  static async getCurrentPlan(userId: string): Promise<HealthPlan | null> {
    try {
      const plansQuery = query(collection(db, this.PLANS_COLLECTION), where('userId', '==', userId))
      const plansSnapshot = await getDocs(plansQuery)
      
      if (plansSnapshot.empty) return null
      
      const planDoc = plansSnapshot.docs[0]
      return {
        id: planDoc.id,
        ...planDoc.data(),
      } as HealthPlan

    } catch (error) {
      console.error('❌ Error getting current plan:', error)
      return null
    }
  }
} 