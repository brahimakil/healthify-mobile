export interface WaterEntry {
  id: string
  userId: string
  date: string // YYYY-MM-DD format
  amount: number // in ml
  timeConsumed: Date
  drinkType: 'water' | 'tea' | 'coffee' | 'juice' | 'sports_drink' | 'other'
  note?: string
  createdAt: Date
  updatedAt: Date
}

export interface DailyHydrationSummary {
  date: string
  userId: string
  targetAmount: number // in ml (daily goal)
  totalConsumed: number // in ml
  percentageComplete: number
  entries: WaterEntry[]
  lastEntry?: WaterEntry
}

export interface HydrationGoal {
  userId: string
  dailyTarget: number // in ml
  basedOnWeight: number // kg
  healthGoal: string
  activityLevel: string
  createdAt: Date
  updatedAt: Date
}

export interface DrinkType {
  id: string
  name: string
  icon: string
  color: string
  defaultAmount: number // in ml
  hydrationValue: number // multiplier (e.g., 0.8 for coffee due to caffeine)
} 