import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    query,
    updateDoc,
    where
} from 'firebase/firestore'
import { DailyHydrationSummary, DrinkType, HydrationGoal, WaterEntry } from '../types/hydration'
import { User } from '../types/user'
import { db } from '../utils/firebase'
import { GoalCalculationService } from './goalCalculationService'

export class HydrationService {
  private static readonly COLLECTION_NAME = 'waterEntries'
  private static readonly GOALS_COLLECTION = 'hydrationGoals'

  // Predefined drink types
  static readonly DRINK_TYPES: DrinkType[] = [
    {
      id: 'water',
      name: 'Water',
      icon: '💧',
      color: '#3B82F6',
      defaultAmount: 250,
      hydrationValue: 1.0
    },
    {
      id: 'tea',
      name: 'Tea',
      icon: '🍵',
      color: '#10B981',
      defaultAmount: 200,
      hydrationValue: 0.9
    },
    {
      id: 'coffee',
      name: 'Coffee',
      icon: '☕',
      color: '#8B5CF6',
      defaultAmount: 150,
      hydrationValue: 0.8
    },
    {
      id: 'juice',
      name: 'Juice',
      icon: '🧃',
      color: '#F59E0B',
      defaultAmount: 200,
      hydrationValue: 0.9
    },
    {
      id: 'sports_drink',
      name: 'Sports Drink',
      icon: '🥤',
      color: '#EF4444',
      defaultAmount: 250,
      hydrationValue: 1.1
    },
    {
      id: 'other',
      name: 'Other',
      icon: '🥛',
      color: '#6B7280',
      defaultAmount: 200,
      hydrationValue: 0.9
    }
  ]

  static async addWaterEntry(
    userId: string,
    amount: number,
    drinkType: string = 'water',
    note?: string
  ): Promise<WaterEntry> {
    const now = new Date()
    
    // Use the current date in the user's timezone, not UTC
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const dateString = today.toISOString().split('T')[0]

    const entryData = {
      userId,
      date: dateString, // This should match the selectedDate format
      amount: amount,
      timeConsumed: now,
      drinkType,
      note: note || '',
      createdAt: now,
      updatedAt: now
    }

    try {
      console.log('💧 Adding water entry to Firestore:', entryData)
      console.log('📅 Date being saved:', dateString, 'vs current date:', new Date().toISOString().split('T')[0])
      
      const docRef = await addDoc(collection(db, this.COLLECTION_NAME), entryData)
      console.log('✅ Water entry added with ID:', docRef.id)
      
      return {
        id: docRef.id,
        ...entryData
      }
    } catch (error) {
      console.error('❌ Error adding water entry:', error)
      throw new Error('Failed to add water entry')
    }
  }

  static async updateWaterEntry(
    entryId: string,
    updates: Partial<Omit<WaterEntry, 'id' | 'userId' | 'createdAt'>>
  ): Promise<void> {
    try {
      const entryRef = doc(db, this.COLLECTION_NAME, entryId)
      
      // If amount or drinkType is being updated, recalculate effective amount
      if (updates.amount !== undefined || updates.drinkType !== undefined) {
        const currentDoc = await getDoc(entryRef)
        if (currentDoc.exists()) {
          const currentData = currentDoc.data()
          const drinkType = updates.drinkType || currentData.drinkType
          const amount = updates.amount || currentData.amount
          
          const drinkTypeData = this.DRINK_TYPES.find(dt => dt.id === drinkType) || this.DRINK_TYPES[0]
          updates.amount = Math.round(amount * drinkTypeData.hydrationValue)
        }
      }

      await updateDoc(entryRef, {
        ...updates,
        updatedAt: new Date()
      })
    } catch (error) {
      console.error('❌ Error updating water entry:', error)
      throw new Error('Failed to update water entry')
    }
  }

  static async deleteWaterEntry(entryId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, this.COLLECTION_NAME, entryId))
    } catch (error) {
      console.error('❌ Error deleting water entry:', error)
      throw new Error('Failed to delete water entry')
    }
  }

  static async getDailySummary(userId: string, date: string): Promise<DailyHydrationSummary> {
    try {
      console.log('🔍 Getting daily summary for:', userId, date)
      
      // Get user's hydration goal
      const target = await this.getUserHydrationGoal(userId)
      console.log('🎯 Target amount:', target)
      
      // Get all water entries for the date (without orderBy to avoid index issues)
      const entriesQuery = query(
        collection(db, this.COLLECTION_NAME),
        where('userId', '==', userId),
        where('date', '==', date)
      )

      const entriesSnapshot = await getDocs(entriesQuery)
      console.log('📊 Found entries in Firestore:', entriesSnapshot.docs.length)
      
      const entries: WaterEntry[] = entriesSnapshot.docs.map(doc => {
        const data = doc.data()
        console.log('📄 Processing entry:', doc.id, data)
        
        return {
          id: doc.id,
          userId: data.userId,
          date: data.date,
          amount: data.amount,
          timeConsumed: data.timeConsumed?.toDate ? data.timeConsumed.toDate() : new Date(data.timeConsumed),
          drinkType: data.drinkType,
          note: data.note || '',
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt)
        } as WaterEntry
      })

      // Sort entries by timeConsumed in memory (most recent first)
      entries.sort((a, b) => new Date(b.timeConsumed).getTime() - new Date(a.timeConsumed).getTime())
      
      console.log('🔄 Processed entries:', entries.length, entries.map(e => ({ id: e.id, amount: e.amount, time: e.timeConsumed })))

      // Calculate total consumed with hydration values applied
      const totalConsumed = entries.reduce((sum, entry) => {
        const drinkTypeData = this.DRINK_TYPES.find(dt => dt.id === entry.drinkType) || this.DRINK_TYPES[0]
        const effectiveAmount = entry.amount * drinkTypeData.hydrationValue
        console.log(`💧 Entry ${entry.id}: ${entry.amount}ml × ${drinkTypeData.hydrationValue} = ${effectiveAmount}ml`)
        return sum + effectiveAmount
      }, 0)
      
      const percentageComplete = target > 0 ? Math.min((totalConsumed / target) * 100, 100) : 0

      console.log('📈 Daily summary calculated:', {
        entriesCount: entries.length,
        totalConsumed: Math.round(totalConsumed),
        target,
        percentage: percentageComplete.toFixed(1)
      })

      const summary = {
        date,
        userId,
        targetAmount: target,
        totalConsumed: Math.round(totalConsumed),
        percentageComplete,
        entries,
        lastEntry: entries[0] // Most recent entry (first due to desc sort)
      }

      console.log('✅ Returning summary:', summary)
      return summary
    } catch (error) {
      console.error('❌ Error getting daily hydration summary:', error)
      console.error('❌ Error details:', error.message, error.stack)
      throw new Error('Failed to get daily hydration summary')
    }
  }

  static async getUserHydrationGoal(userId: string): Promise<number> {
    try {
      // Try to get user's custom goal first
      const goalsQuery = query(
        collection(db, this.GOALS_COLLECTION),
        where('userId', '==', userId)
      )
      
      const goalsSnapshot = await getDocs(goalsQuery)
      
      if (!goalsSnapshot.empty) {
        const goal = goalsSnapshot.docs[0].data() as HydrationGoal
        return goal.dailyTarget
      }

      // If no custom goal, calculate based on user profile
      // This would need user data - for now return default
      return 2000 // 2L default
    } catch (error) {
      console.error('❌ Error getting hydration goal:', error)
      return 2000 // Default fallback
    }
  }

  static async setUserHydrationGoal(
    userId: string, 
    user: User, 
    customTarget?: number
  ): Promise<void> {
    try {
      // Add null checks for user and user.profile
      if (!user || !user.profile) {
        console.error('❌ Invalid user data provided to setUserHydrationGoal')
        throw new Error('Invalid user data')
      }

      const targetAmount = customTarget || GoalCalculationService.getRecommendedWaterIntake(
        user, 
        user.profile?.healthGoals || 'General Health'
      )

      const goalData: Omit<HydrationGoal, 'userId'> = {
        dailyTarget: targetAmount,
        basedOnWeight: user.profile?.currentWeight || 70,
        healthGoal: user.profile?.healthGoals || 'General Health',
        activityLevel: user.profile?.activityLevel || 'moderate',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      // Check if goal already exists
      const existingGoalsQuery = query(
        collection(db, this.GOALS_COLLECTION),
        where('userId', '==', userId)
      )
      
      const existingGoalsSnapshot = await getDocs(existingGoalsQuery)
      
      if (!existingGoalsSnapshot.empty) {
        // Update existing goal
        const goalDoc = existingGoalsSnapshot.docs[0]
        await updateDoc(goalDoc.ref, {
          ...goalData,
          updatedAt: new Date()
        })
      } else {
        // Create new goal
        await addDoc(collection(db, this.GOALS_COLLECTION), {
          userId,
          ...goalData
        })
      }
    } catch (error) {
      console.error('❌ Error setting hydration goal:', error)
      throw new Error('Failed to set hydration goal')
    }
  }

  static async getWeeklyProgress(userId: string, startDate: string): Promise<DailyHydrationSummary[]> {
    try {
      const weeklyData: DailyHydrationSummary[] = []
      const start = new Date(startDate)

      for (let i = 0; i < 7; i++) {
        const currentDate = new Date(start)
        currentDate.setDate(start.getDate() + i)
        const dateString = currentDate.toISOString().split('T')[0]
        
        const dailySummary = await this.getDailySummary(userId, dateString)
        weeklyData.push(dailySummary)
      }

      return weeklyData
    } catch (error) {
      console.error('❌ Error getting weekly progress:', error)
      throw new Error('Failed to get weekly progress')
    }
  }

  static getDrinkTypeById(id: string): DrinkType | undefined {
    return this.DRINK_TYPES.find(dt => dt.id === id)
  }
} 