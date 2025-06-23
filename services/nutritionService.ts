import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore'
import {
  DailyNutritionGoals,
  DailyNutritionSummary,
  FoodItem,
  FoodSearchResponse,
  FoodSearchResult,
  Meal,
  MealEntry,
  NutritionInfo
} from '../types/nutrition'
import { db } from '../utils/firebase'

const FOOD_ITEMS_COLLECTION = 'food_items'
const MEAL_ENTRIES_COLLECTION = 'meal_entries'
const DAILY_GOALS_COLLECTION = 'daily_nutrition_goals'

export class NutritionService {
  // Using FatSecret API (Free tier - 5000 calls/day)
  // No API key needed for basic search
  private static readonly FATSECRET_BASE_URL = 'https://platform.fatsecret.com/rest/server.api'
  
  // Alternative: Use USDA FoodData Central (completely free)
  private static readonly USDA_BASE_URL = 'https://api.nal.usda.gov/fdc/v1'
  private static readonly USDA_API_KEY = '6voHZhZiCTBpvwnaRXmYh9DWL9pNvyf5t1wnjh7m' // Replace with your free API key from https://fdc.nal.usda.gov/api-key-signup.html

  // Food Search API using USDA FoodData Central (Free - no limits)
  static async searchFoods(query: string, pageNumber: number = 1): Promise<FoodSearchResponse> {
    try {
      const pageSize = 20
      const from = (pageNumber - 1) * pageSize
      
      // Use USDA FoodData Central API (completely free)
      const url = `${this.USDA_BASE_URL}/foods/search?query=${encodeURIComponent(query)}&pageSize=${pageSize}&pageNumber=${pageNumber}&api_key=${this.USDA_API_KEY}&dataType=Branded,Foundation`
      
      console.log('Searching with URL:', url)
      
      const response = await fetch(url)
      if (!response.ok) {
        console.error('API response error:', response.status, response.statusText)
        throw new Error(`API request failed: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('API Response:', data)
      
      // Convert USDA response to our format
      const foods: FoodSearchResult[] = (data.foods || []).map((item: any) => ({
        fdcId: item.fdcId.toString(),
        description: item.description || item.lowercaseDescription?.replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'Unknown Food',
        brandOwner: item.brandOwner || item.brandName || '',
        ingredients: item.ingredients || item.foodCategory || '',
        servingSize: 100,
        servingSizeUnit: 'g',
        foodNutrients: this.convertUSDANutrients(item.foodNutrients || [])
      })).filter(food => food.description && food.fdcId)
      
      return {
        foods,
        totalHits: data.totalHits || foods.length,
        currentPage: pageNumber,
        totalPages: Math.ceil((data.totalHits || foods.length) / pageSize)
      }
    } catch (error) {
      console.error('Food search error:', error)
      
      // Return meal-specific suggestions based on search query
      return this.getMealSuggestions(query, pageNumber)
    }
  }

  // Convert USDA nutrients to our format
  private static convertUSDANutrients(nutrients: any[]): Array<{
    nutrientId: number
    nutrientName: string
    nutrientNumber: string
    unitName: string
    value: number
  }> {
    return nutrients.map(nutrient => ({
      nutrientId: nutrient.nutrientId || 0,
      nutrientName: nutrient.nutrientName || 'Unknown',
      nutrientNumber: nutrient.nutrientNumber || '000',
      unitName: nutrient.unitName || 'g',
      value: nutrient.value || 0
    }))
  }

  // UPDATED: Return complete meals instead of individual ingredients
  private static getMealSuggestions(query: string, pageNumber: number = 1): FoodSearchResponse {
    const currentHour = new Date().getHours()
    let mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' = 'snack'
    
    if (currentHour >= 6 && currentHour < 11) mealType = 'breakfast'
    else if (currentHour >= 11 && currentHour < 16) mealType = 'lunch'
    else if (currentHour >= 16 && currentHour < 22) mealType = 'dinner'
    
    const mealSuggestions = {
      breakfast: [
        {
          fdcId: 'meal_breakfast_oatmeal',
          description: 'Oatmeal Bowl with Berries',
          brandOwner: '',
          ingredients: 'Steel-cut oats, mixed berries, almond milk, honey',
          servingSize: 1,
          servingSizeUnit: 'bowl',
          servingDescription: '1 bowl',
          isMeal: true,
          mealCategory: 'breakfast' as const,
          foodNutrients: [
            { nutrientId: 1008, nutrientName: 'Energy', nutrientNumber: '208', unitName: 'kcal', value: 320 },
            { nutrientId: 1003, nutrientName: 'Protein', nutrientNumber: '203', unitName: 'g', value: 12 },
            { nutrientId: 1005, nutrientName: 'Carbohydrate', nutrientNumber: '205', unitName: 'g', value: 54 },
            { nutrientId: 1004, nutrientName: 'Total fat', nutrientNumber: '204', unitName: 'g', value: 8 }
          ]
        },
        {
          fdcId: 'meal_breakfast_eggs_toast',
          description: 'Scrambled Eggs with Whole Grain Toast',
          brandOwner: '',
          ingredients: '2 eggs, whole grain bread, butter, side of fresh fruit',
          servingSize: 1,
          servingSizeUnit: 'plate',
          servingDescription: '1 plate',
          isMeal: true,
          mealCategory: 'breakfast' as const,
          foodNutrients: [
            { nutrientId: 1008, nutrientName: 'Energy', nutrientNumber: '208', unitName: 'kcal', value: 380 },
            { nutrientId: 1003, nutrientName: 'Protein', nutrientNumber: '203', unitName: 'g', value: 22 },
            { nutrientId: 1005, nutrientName: 'Carbohydrate', nutrientNumber: '205', unitName: 'g', value: 28 },
            { nutrientId: 1004, nutrientName: 'Total fat', nutrientNumber: '204', unitName: 'g', value: 18 }
          ]
        },
        {
          fdcId: 'meal_breakfast_smoothie_bowl',
          description: 'Acai Smoothie Bowl',
          brandOwner: '',
          ingredients: 'Acai, banana, granola, coconut flakes, fresh berries',
          servingSize: 1,
          servingSizeUnit: 'bowl',
          servingDescription: '1 bowl',
          isMeal: true,
          mealCategory: 'breakfast' as const,
          foodNutrients: [
            { nutrientId: 1008, nutrientName: 'Energy', nutrientNumber: '208', unitName: 'kcal', value: 340 },
            { nutrientId: 1003, nutrientName: 'Protein', nutrientNumber: '203', unitName: 'g', value: 8 },
            { nutrientId: 1005, nutrientName: 'Carbohydrate', nutrientNumber: '205', unitName: 'g', value: 62 },
            { nutrientId: 1004, nutrientName: 'Total fat', nutrientNumber: '204', unitName: 'g', value: 12 }
          ]
        }
      ],
      lunch: [
        {
          fdcId: 'meal_lunch_caesar_salad',
          description: 'Grilled Chicken Caesar Salad',
          brandOwner: '',
          ingredients: 'Grilled chicken breast, romaine lettuce, parmesan cheese, caesar dressing, croutons',
          servingSize: 1,
          servingSizeUnit: 'bowl',
          servingDescription: '1 large bowl',
          isMeal: true,
          mealCategory: 'lunch' as const,
          foodNutrients: [
            { nutrientId: 1008, nutrientName: 'Energy', nutrientNumber: '208', unitName: 'kcal', value: 420 },
            { nutrientId: 1003, nutrientName: 'Protein', nutrientNumber: '203', unitName: 'g', value: 35 },
            { nutrientId: 1005, nutrientName: 'Carbohydrate', nutrientNumber: '205', unitName: 'g', value: 12 },
            { nutrientId: 1004, nutrientName: 'Total fat', nutrientNumber: '204', unitName: 'g', value: 25 }
          ]
        },
        {
          fdcId: 'meal_lunch_turkey_sandwich',
          description: 'Turkey Avocado Sandwich',
          brandOwner: '',
          ingredients: 'Sliced turkey, avocado, whole grain bread, lettuce, tomato, side of chips',
          servingSize: 1,
          servingSizeUnit: 'sandwich',
          servingDescription: '1 sandwich with sides',
          isMeal: true,
          mealCategory: 'lunch' as const,
          foodNutrients: [
            { nutrientId: 1008, nutrientName: 'Energy', nutrientNumber: '208', unitName: 'kcal', value: 480 },
            { nutrientId: 1003, nutrientName: 'Protein', nutrientNumber: '203', unitName: 'g', value: 28 },
            { nutrientId: 1005, nutrientName: 'Carbohydrate', nutrientNumber: '205', unitName: 'g', value: 45 },
            { nutrientId: 1004, nutrientName: 'Total fat', nutrientNumber: '204', unitName: 'g', value: 18 }
          ]
        },
        {
          fdcId: 'meal_lunch_quinoa_bowl',
          description: 'Mediterranean Quinoa Bowl',
          brandOwner: '',
          ingredients: 'Quinoa, chickpeas, cucumber, tomatoes, feta cheese, olive oil dressing',
          servingSize: 1,
          servingSizeUnit: 'bowl',
          servingDescription: '1 bowl',
          isMeal: true,
          mealCategory: 'lunch' as const,
          foodNutrients: [
            { nutrientId: 1008, nutrientName: 'Energy', nutrientNumber: '208', unitName: 'kcal', value: 450 },
            { nutrientId: 1003, nutrientName: 'Protein', nutrientNumber: '203', unitName: 'g', value: 18 },
            { nutrientId: 1005, nutrientName: 'Carbohydrate', nutrientNumber: '205', unitName: 'g', value: 65 },
            { nutrientId: 1004, nutrientName: 'Total fat', nutrientNumber: '204', unitName: 'g', value: 12 }
          ]
        }
      ],
      dinner: [
        {
          fdcId: 'meal_dinner_salmon_vegetables',
          description: 'Grilled Salmon with Roasted Vegetables',
          brandOwner: '',
          ingredients: 'Atlantic salmon fillet, roasted broccoli, sweet potato, asparagus',
          servingSize: 1,
          servingSizeUnit: 'plate',
          servingDescription: '1 dinner plate',
          isMeal: true,
          mealCategory: 'dinner' as const,
          foodNutrients: [
            { nutrientId: 1008, nutrientName: 'Energy', nutrientNumber: '208', unitName: 'kcal', value: 520 },
            { nutrientId: 1003, nutrientName: 'Protein', nutrientNumber: '203', unitName: 'g', value: 42 },
            { nutrientId: 1005, nutrientName: 'Carbohydrate', nutrientNumber: '205', unitName: 'g', value: 35 },
            { nutrientId: 1004, nutrientName: 'Total fat', nutrientNumber: '204', unitName: 'g', value: 22 }
          ]
        },
        {
          fdcId: 'meal_dinner_chicken_rice',
          description: 'Herb-Crusted Chicken with Brown Rice',
          brandOwner: '',
          ingredients: 'Chicken breast, brown rice, steamed vegetables, herbs',
          servingSize: 1,
          servingSizeUnit: 'plate',
          servingDescription: '1 dinner plate',
          isMeal: true,
          mealCategory: 'dinner' as const,
          foodNutrients: [
            { nutrientId: 1008, nutrientName: 'Energy', nutrientNumber: '208', unitName: 'kcal', value: 480 },
            { nutrientId: 1003, nutrientName: 'Protein', nutrientNumber: '203', unitName: 'g', value: 38 },
            { nutrientId: 1005, nutrientName: 'Carbohydrate', nutrientNumber: '205', unitName: 'g', value: 45 },
            { nutrientId: 1004, nutrientName: 'Total fat', nutrientNumber: '204', unitName: 'g', value: 10 }
          ]
        },
        {
          fdcId: 'meal_dinner_pasta',
          description: 'Spaghetti with Meat Sauce',
          brandOwner: '',
          ingredients: 'Whole wheat spaghetti, lean ground beef, marinara sauce, side salad',
          servingSize: 1,
          servingSizeUnit: 'plate',
          servingDescription: '1 dinner plate',
          isMeal: true,
          mealCategory: 'dinner' as const,
          foodNutrients: [
            { nutrientId: 1008, nutrientName: 'Energy', nutrientNumber: '208', unitName: 'kcal', value: 550 },
            { nutrientId: 1003, nutrientName: 'Protein', nutrientNumber: '203', unitName: 'g', value: 32 },
            { nutrientId: 1005, nutrientName: 'Carbohydrate', nutrientNumber: '205', unitName: 'g', value: 68 },
            { nutrientId: 1004, nutrientName: 'Total fat', nutrientNumber: '204', unitName: 'g', value: 15 }
          ]
        }
      ],
      snack: [
        {
          fdcId: 'meal_snack_trail_mix',
          description: 'Mixed Nuts and Dried Fruit',
          brandOwner: '',
          ingredients: 'Almonds, walnuts, dried cranberries, dark chocolate chips',
          servingSize: 1,
          servingSizeUnit: 'handful',
          servingDescription: '1 small handful',
          isMeal: true,
          mealCategory: 'snack' as const,
          foodNutrients: [
            { nutrientId: 1008, nutrientName: 'Energy', nutrientNumber: '208', unitName: 'kcal', value: 180 },
            { nutrientId: 1003, nutrientName: 'Protein', nutrientNumber: '203', unitName: 'g', value: 6 },
            { nutrientId: 1005, nutrientName: 'Carbohydrate', nutrientNumber: '205', unitName: 'g', value: 15 },
            { nutrientId: 1004, nutrientName: 'Total fat', nutrientNumber: '204', unitName: 'g', value: 12 }
          ]
        },
        {
          fdcId: 'meal_snack_yogurt_parfait',
          description: 'Greek Yogurt Parfait',
          brandOwner: '',
          ingredients: 'Greek yogurt, granola, fresh berries, honey drizzle',
          servingSize: 1,
          servingSizeUnit: 'cup',
          servingDescription: '1 cup',
          isMeal: true,
          mealCategory: 'snack' as const,
          foodNutrients: [
            { nutrientId: 1008, nutrientName: 'Energy', nutrientNumber: '208', unitName: 'kcal', value: 220 },
            { nutrientId: 1003, nutrientName: 'Protein', nutrientNumber: '203', unitName: 'g', value: 15 },
            { nutrientId: 1005, nutrientName: 'Carbohydrate', nutrientNumber: '205', unitName: 'g', value: 28 },
            { nutrientId: 1004, nutrientName: 'Total fat', nutrientNumber: '204', unitName: 'g', value: 6 }
          ]
        }
      ]
    }

    // Filter suggestions based on query and meal type
    let suggestions = mealSuggestions[mealType]
    if (query.trim()) {
      suggestions = suggestions.filter(meal => 
        meal.description.toLowerCase().includes(query.toLowerCase()) ||
        meal.ingredients.toLowerCase().includes(query.toLowerCase())
      )
    }

    return {
      foods: suggestions,
      totalHits: suggestions.length,
      currentPage: pageNumber,
      totalPages: 1
    }
  }

  // Get food details by ID
  static async getFoodDetails(fdcId: string): Promise<FoodItem> {
    console.log('🔍 Getting food details for ID:', fdcId)
    
    try {
      // Check if it's a custom food first
      const customFoodRef = doc(db, FOOD_ITEMS_COLLECTION, fdcId)
      const customFoodSnapshot = await getDoc(customFoodRef)
      
      if (customFoodSnapshot.exists()) {
        console.log('✅ Found custom food in database')
        const data = customFoodSnapshot.data()
        return {
          id: customFoodSnapshot.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        } as FoodItem
      }
      
      // If not custom food, try USDA API
      const response = await fetch(
        `${this.USDA_BASE_URL}/food/${fdcId}?api_key=${this.USDA_API_KEY}`
      )
      
      if (!response.ok) {
        console.warn('❌ USDA API request failed, using mock data')
        return this.getMockFoodDetails(fdcId)
      }
      
      const data = await response.json()
      return this.convertUSDAToFoodItem(data)
      
    } catch (error) {
      console.error('❌ Error getting food details:', error)
      return this.getMockFoodDetails(fdcId)
    }
  }

  private static convertUSDAToFoodItem(data: any): FoodItem {
    const nutrients = data.foodNutrients || []
    const nutritionPer100g: NutritionInfo = {
      calories: this.findNutrientValue(nutrients, 'Energy') || 0,
      protein: this.findNutrientValue(nutrients, 'Protein') || 0,
      carbs: this.findNutrientValue(nutrients, 'Carbohydrate') || 0,
      fat: this.findNutrientValue(nutrients, 'Total lipid') || 0,
      fiber: this.findNutrientValue(nutrients, 'Fiber'),
      sugar: this.findNutrientValue(nutrients, 'Sugars'),
      sodium: this.findNutrientValue(nutrients, 'Sodium')
    }

    return {
      id: data.fdcId.toString(),
      name: data.description || 'Unknown Food',
      description: data.description || '',
      brand: data.brandOwner || '',
        servingSize: 100,
        servingUnit: 'g',
      nutritionPer100g,
      isCustom: false
    }
  }

  private static findNutrientValue(nutrients: any[], nutrientName: string): number | undefined {
    const nutrient = nutrients.find((n: any) => 
      n.nutrient?.name?.toLowerCase().includes(nutrientName.toLowerCase())
    )
    return nutrient?.amount
  }

  private static getMockFoodDetails(fdcId: string): FoodItem {
    // Return mock food details for fallback
    return {
      id: fdcId,
      name: 'Unknown Food',
      description: 'Food item',
        brand: '',
        servingSize: 100,
        servingUnit: 'g',
        nutritionPer100g: {
        calories: 100,
        protein: 5,
        carbs: 15,
        fat: 3
      },
      isCustom: false
    }
  }

  // Custom Food Items
  static async createCustomFood(userId: string, foodData: Omit<FoodItem, 'id' | 'isCustom' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<string> {
    console.log('🥕 NutritionService.createCustomFood called:', {
      userId,
      foodName: foodData.name,
      nutrition: foodData.nutritionPer100g
    })
    
    try {
      const foodRef = doc(collection(db, FOOD_ITEMS_COLLECTION))
      console.log('📄 Generated food reference ID:', foodRef.id)
      
      // Sanitize nutrition data to prevent undefined values
      const sanitizedNutrition: NutritionInfo = {
        calories: foodData.nutritionPer100g.calories,
        protein: foodData.nutritionPer100g.protein,
        carbs: foodData.nutritionPer100g.carbs,
        fat: foodData.nutritionPer100g.fat,
        // Replace undefined values with 0 or null
        fiber: foodData.nutritionPer100g.fiber ?? 0,
        sugar: foodData.nutritionPer100g.sugar ?? 0,
        sodium: foodData.nutritionPer100g.sodium ?? 0
      }
      
      const foodItem: Omit<FoodItem, 'id'> & { userId: string } = {
        ...foodData,
        nutritionPer100g: sanitizedNutrition, // Use sanitized nutrition data
        isCustom: true,
        userId,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      console.log('💾 Saving custom food to Firestore:', {
        collection: FOOD_ITEMS_COLLECTION,
        id: foodRef.id,
        foodItem
      })
      
      await setDoc(foodRef, {
        ...foodItem,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
      
      console.log('✅ Custom food saved successfully with ID:', foodRef.id)
      return foodRef.id
    } catch (error) {
      console.error('❌ Error in createCustomFood:', error)
      throw new Error(`Failed to create custom food: ${error.message}`)
    }
  }

  static async getUserCustomFoods(userId: string): Promise<FoodItem[]> {
    try {
    const q = query(
      collection(db, FOOD_ITEMS_COLLECTION),
      where('userId', '==', userId),
      where('isCustom', '==', true),
      orderBy('createdAt', 'desc')
    )
    
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date()
    } as FoodItem))
    } catch (error) {
      console.error('Error getting custom foods:', error)
      return []
    }
  }

  static async updateCustomFood(foodId: string, updates: Partial<FoodItem>): Promise<void> {
    const foodRef = doc(db, FOOD_ITEMS_COLLECTION, foodId)
    await updateDoc(foodRef, {
      ...updates,
      updatedAt: serverTimestamp()
    })
  }

  static async deleteCustomFood(foodId: string): Promise<void> {
    const foodRef = doc(db, FOOD_ITEMS_COLLECTION, foodId)
    await deleteDoc(foodRef)
  }

  // UPDATED: Handle complete meals
  static async addMealEntry(mealEntry: Omit<MealEntry, 'id' | 'createdAt'>): Promise<string> {
    console.log('💾 NutritionService.addMealEntry called with:', {
      userId: mealEntry.userId,
      mealType: mealEntry.mealType,
      hasMeal: !!mealEntry.meal,
      hasFoodItem: !!mealEntry.foodItem,
      calories: mealEntry.actualNutrition.calories
    })
    
    try {
      const entryId = doc(collection(db, MEAL_ENTRIES_COLLECTION)).id
      const entryRef = doc(db, MEAL_ENTRIES_COLLECTION, entryId)

      const dataToSave = {
        ...mealEntry,
        createdAt: serverTimestamp(),
      }
      
      console.log('💾 Saving to Firestore:', { entryId, collection: MEAL_ENTRIES_COLLECTION })
      await setDoc(entryRef, dataToSave)
      console.log('✅ Successfully saved meal entry with ID:', entryId)

      return entryId
    } catch (error) {
      console.error('❌ Error in addMealEntry:', error)
      throw error
    }
  }

  static async getDailyMeals(userId: string, date: string): Promise<MealEntry[]> {
    console.log('📅 NutritionService.getDailyMeals called:', { userId, date })
    
    try {
      const startOfDay = new Date(date + 'T00:00:00')
      const endOfDay = new Date(date + 'T23:59:59')
      
      console.log('📅 Date range:', { startOfDay, endOfDay })
      
      const q = query(
        collection(db, MEAL_ENTRIES_COLLECTION),
        where('userId', '==', userId),
        where('consumedAt', '>=', startOfDay),
        where('consumedAt', '<=', endOfDay),
        orderBy('consumedAt', 'asc')
      )
      
      console.log('🔍 Executing Firestore query...')
      const snapshot = await getDocs(q)
      console.log('📊 Query results:', { docsFound: snapshot.docs.length })
      
      const meals = snapshot.docs.map(doc => {
        const data = doc.data()
        console.log('📄 Document data:', { 
          id: doc.id, 
          mealType: data.mealType,
          hasmeal: !!data.meal,
          hasFoodItem: !!data.foodItem,
          calories: data.actualNutrition?.calories
        })
        
        return {
          id: doc.id,
          ...data,
          consumedAt: data.consumedAt?.toDate() || new Date()
        } as MealEntry
      })
      
      console.log('✅ Processed meals:', meals.length)
      return meals
    } catch (error) {
      console.error('❌ Error in getDailyMeals:', error)
      throw error
    }
  }

  static async deleteMealEntry(entryId: string): Promise<void> {
    console.log('🗑️ DELETE ENTRY CALLED:', entryId)
    
    if (!entryId) {
      throw new Error('No entry ID provided')
    }
    
    try {
      const mealRef = doc(db, MEAL_ENTRIES_COLLECTION, entryId)
      await deleteDoc(mealRef)
      console.log('✅ FIRESTORE DELETE SUCCESS:', entryId)
    } catch (error) {
      console.error('❌ FIRESTORE DELETE ERROR:', error)
      throw error
    }
  }

  // ADD: Debug function to check for duplicate IDs
  static async debugMealIds(userId: string, date: string): Promise<void> {
    console.log('🔍 Debugging meal IDs for:', { userId, date })
    
    try {
      const startOfDay = new Date(date + 'T00:00:00')
      const endOfDay = new Date(date + 'T23:59:59')
      
      const q = query(
        collection(db, MEAL_ENTRIES_COLLECTION),
        where('userId', '==', userId),
        where('consumedAt', '>=', startOfDay),
        where('consumedAt', '<=', endOfDay)
      )
      
      const snapshot = await getDocs(q)
      const ids = snapshot.docs.map(doc => doc.id)
      const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index)
      
      console.log('🔍 All meal IDs:', ids)
      console.log('🔍 Duplicate IDs found:', duplicateIds)
      
      if (duplicateIds.length > 0) {
        console.error('❌ DUPLICATE IDS DETECTED!', duplicateIds)
      } else {
        console.log('✅ No duplicate IDs found')
      }
      
      // Log each meal's details
      snapshot.docs.forEach(doc => {
        const data = doc.data()
        console.log('📄 Meal details:', {
          id: doc.id,
          userId: data.userId,
          mealType: data.mealType,
          name: data.meal?.name || data.foodItem?.name,
          calories: data.actualNutrition?.calories,
          consumedAt: data.consumedAt?.toDate()
        })
      })
      
    } catch (error) {
      console.error('❌ Error in debugMealIds:', error)
    }
  }

  // Daily Goals
  static async setDailyGoals(goals: Omit<DailyNutritionGoals, 'createdAt' | 'updatedAt'>): Promise<void> {
    const goalRef = doc(db, DAILY_GOALS_COLLECTION, `${goals.userId}_${goals.date}`)
    
    await setDoc(goalRef, {
      ...goals,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
  }

  static async getDailyGoals(userId: string, date: string): Promise<DailyNutritionGoals | null> {
    const goalRef = doc(db, DAILY_GOALS_COLLECTION, `${userId}_${date}`)
    const snapshot = await getDoc(goalRef)
    
    if (snapshot.exists()) {
      return {
        ...snapshot.data(),
        createdAt: snapshot.data().createdAt?.toDate() || new Date(),
        updatedAt: snapshot.data().updatedAt?.toDate() || new Date()
      } as DailyNutritionGoals
    }
    
    // Return default goals if none exist
    return {
      date,
      userId,
      targetMeals: {
        breakfast: 1,
        lunch: 1,
        dinner: 1,
        snacks: 2
      },
      calorieGoal: 2000,
      proteinGoal: 150,
      carbsGoal: 250,
      fatGoal: 65,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }

  // Utility Methods
  static calculateNutritionForQuantity(foodItem: FoodItem, quantityInGrams: number): NutritionInfo {
    const ratio = quantityInGrams / 100 // nutrition is per 100g
    
    return {
      calories: Math.round(foodItem.nutritionPer100g.calories * ratio),
      protein: Math.round(foodItem.nutritionPer100g.protein * ratio * 10) / 10,
      carbs: Math.round(foodItem.nutritionPer100g.carbs * ratio * 10) / 10,
      fat: Math.round(foodItem.nutritionPer100g.fat * ratio * 10) / 10,
      fiber: foodItem.nutritionPer100g.fiber ? Math.round(foodItem.nutritionPer100g.fiber * ratio * 10) / 10 : undefined,
      sugar: foodItem.nutritionPer100g.sugar ? Math.round(foodItem.nutritionPer100g.sugar * ratio * 10) / 10 : undefined,
      sodium: foodItem.nutritionPer100g.sodium ? Math.round(foodItem.nutritionPer100g.sodium * ratio * 10) / 10 : undefined
    }
  }

  static async getDailySummary(userId: string, date: string): Promise<DailyNutritionSummary> {
    console.log('📊 NutritionService.getDailySummary called:', { userId, date })
    
    try {
      const [meals, goals] = await Promise.all([
        this.getDailyMeals(userId, date),
        this.getDailyGoals(userId, date)
      ])
      
      console.log('📊 Summary data loaded:', {
        mealsCount: meals.length,
        goalsExists: !!goals
      })
      
      const totalNutrition = meals.reduce(
        (total, meal) => ({
        calories: total.calories + meal.actualNutrition.calories,
        protein: total.protein + meal.actualNutrition.protein,
        carbs: total.carbs + meal.actualNutrition.carbs,
        fat: total.fat + meal.actualNutrition.fat,
        fiber: (total.fiber || 0) + (meal.actualNutrition.fiber || 0),
        sugar: (total.sugar || 0) + (meal.actualNutrition.sugar || 0),
        sodium: (total.sodium || 0) + (meal.actualNutrition.sodium || 0)
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 }
      )

      const mealCounts = meals.reduce(
        (counts, meal) => {
          counts[meal.mealType]++
          return counts
        },
        { breakfast: 0, lunch: 0, dinner: 0, snacks: 0 }
      )
      
      const summary = {
        date,
        userId,
        meals,
        totalNutrition,
        goals: goals!,
        progress: {
          calories: Math.round((totalNutrition.calories / goals!.calorieGoal) * 100),
          protein: Math.round((totalNutrition.protein / goals!.proteinGoal) * 100),
          carbs: Math.round((totalNutrition.carbs / goals!.carbsGoal) * 100),
          fat: Math.round((totalNutrition.fat / goals!.fatGoal) * 100),
          mealsConsumed: mealCounts
        }
      }
      
      console.log('✅ Daily summary created:', {
        totalCalories: totalNutrition.calories,
        mealCounts
      })
      
      return summary
    } catch (error) {
      console.error('❌ Error in getDailySummary:', error)
      throw error
    }
  }

  // NEW: Convert FoodSearchResult to Meal for complete meals
  static convertSearchResultToMeal(searchResult: FoodSearchResult): Meal {
    const nutrition: NutritionInfo = {
      calories: this.findNutrientByName(searchResult.foodNutrients, 'Energy') || 0,
      protein: this.findNutrientByName(searchResult.foodNutrients, 'Protein') || 0,
      carbs: this.findNutrientByName(searchResult.foodNutrients, 'Carbohydrate') || 0,
      fat: this.findNutrientByName(searchResult.foodNutrients, 'Total fat') || 0,
      fiber: this.findNutrientByName(searchResult.foodNutrients, 'Fiber'),
      sodium: this.findNutrientByName(searchResult.foodNutrients, 'Sodium')
    }

    return {
      id: searchResult.fdcId,
      name: searchResult.description,
      description: searchResult.description,
      category: searchResult.mealCategory || 'snack',
      servingSize: searchResult.servingDescription || `${searchResult.servingSize} ${searchResult.servingSizeUnit}` || '1 serving',
      nutrition,
      ingredients: searchResult.ingredients ? searchResult.ingredients.split(', ') : [],
      isCustom: false
    }
  }

  private static findNutrientByName(nutrients: Array<{nutrientName: string, value: number}>, name: string): number | undefined {
    const nutrient = nutrients.find(n => n.nutrientName.toLowerCase().includes(name.toLowerCase()))
    return nutrient?.value
  }

  static async updateMealEntry(entryId: string, updates: Partial<MealEntry>): Promise<void> {
    console.log('✏️ NutritionService.updateMealEntry called:', { entryId, updates })
    
    try {
      const mealRef = doc(db, MEAL_ENTRIES_COLLECTION, entryId)
      
      await updateDoc(mealRef, {
        ...updates,
        updatedAt: serverTimestamp()
      })
      
      console.log('✅ Meal entry updated successfully')
    } catch (error) {
      console.error('❌ Error updating meal entry:', error)
      throw new Error(`Failed to update meal entry: ${error.message}`)
    }
  }
} 