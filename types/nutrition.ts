export interface NutritionInfo {
  calories: number
  protein: number // grams
  carbs: number // grams
  fat: number // grams
  fiber?: number // grams
  sugar?: number // grams
  sodium?: number // mg
  cholesterol?: number // mg
  vitamins?: {
    vitaminA?: number // mcg
    vitaminC?: number // mg
    vitaminD?: number // mcg
    vitaminE?: number // mg
    vitaminK?: number // mcg
    vitaminB12?: number // mcg
    folate?: number // mcg
  }
  minerals?: {
    calcium?: number // mg
    iron?: number // mg
    magnesium?: number // mg
    phosphorus?: number // mg
    potassium?: number // mg
    zinc?: number // mg
  }
}

// NEW: Complete meal structure
export interface Meal {
  id: string
  name: string
  description: string
  category: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  servingSize: string // e.g., "1 bowl", "1 plate", "1 serving"
  nutrition: NutritionInfo
  ingredients?: string[]
  image?: string
  prepTime?: number // minutes
  isCustom: boolean
  userId?: string // only for custom meals
  createdAt?: Date
  updatedAt?: Date
}

export interface FoodItem {
  id: string
  name: string
  description?: string
  brand?: string
  servingSize: number // grams
  servingUnit: string // 'g', 'ml', 'cup', 'piece', etc.
  nutritionPer100g: NutritionInfo
  image?: string // base64 URL
  isCustom: boolean // true if user-created
  userId?: string // only for custom foods
  createdAt?: Date
  updatedAt?: Date
}

// UPDATED: Support both meals and individual foods
export interface MealEntry {
  id: string
  userId: string
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  consumedAt: Date
  
  // Either a complete meal OR individual food item
  meal?: Meal
  foodItem?: FoodItem
  
  // For meals: servings (1 serving, 2 servings, etc.)
  // For food items: quantity in grams
  quantity: number
  servings?: number
  
  actualNutrition: NutritionInfo
  notes?: string
}

export interface DailyNutritionGoals {
  date: string // YYYY-MM-DD
  userId: string
  targetMeals: {
    breakfast: number
    lunch: number
    dinner: number
    snacks: number
  }
  calorieGoal: number
  proteinGoal: number
  carbsGoal: number
  fatGoal: number
  createdAt?: Date
  updatedAt?: Date
}

export interface DailyNutritionSummary {
  date: string
  userId: string
  meals: MealEntry[]
  totalNutrition: NutritionInfo
  goals: DailyNutritionGoals
  progress: {
    calories: number // percentage
    protein: number
    carbs: number
    fat: number
    mealsConsumed: {
      breakfast: number
      lunch: number
      dinner: number
      snacks: number
    }
  }
}

// API Types for food search - UPDATED to include complete meals
export interface FoodSearchResult {
  fdcId: string
  description: string
  brandOwner?: string
  ingredients?: string
  servingSize?: number
  servingSizeUnit?: string
  foodNutrients: Array<{
    nutrientId: number
    nutrientName: string
    nutrientNumber: string
    unitName: string
    value: number
  }>
  
  // NEW: Meal specific properties
  isMeal?: boolean // true if this is a complete meal
  mealCategory?: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  servingDescription?: string // e.g., "1 bowl", "1 plate"
}

export interface FoodSearchResponse {
  foods: FoodSearchResult[]
  totalHits: number
  currentPage: number
  totalPages: number
} 