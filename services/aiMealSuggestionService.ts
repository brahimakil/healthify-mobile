import AsyncStorage from '@react-native-async-storage/async-storage'
import { FoodSearchResult } from '../types/nutrition'
import { NutritionService } from './nutritionService'

export interface MealSuggestion {
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  suggestions: FoodSearchResult[]
}

export class AIMealSuggestionService {
  private static readonly SUGGESTIONS_CACHE_KEY = 'ai_meal_suggestions_cache'
  private static readonly CACHE_EXPIRY_HOURS = 24

  static async generateMealSuggestions(
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack',
    userId: string,
    userPreferences?: {
      healthGoal?: string
      dietaryRestrictions?: string[]
      preferredCuisines?: string[]
    }
  ): Promise<FoodSearchResult[]> {
    try {
      // Check cache first to avoid generating same suggestions daily
      const cachedSuggestions = await this.getCachedSuggestions(mealType)
      if (cachedSuggestions.length > 0) {
        console.log(`🍽️ Using cached AI suggestions for ${mealType}`)
        return cachedSuggestions
      }

      console.log(`🤖 Generating AI meal suggestions for ${mealType}`)
      
      // Get user's API key from their profile
      const { UserService } = await import('./userService')
      const user = await UserService.getUser(userId)
      const apiKey = user?.profile?.googleApiKey
      
      if (!apiKey) {
        console.log('⚠️ No Google API key found in user profile, using fallback suggestions')
        return this.getFallbackSuggestions(mealType)
      }

      // Check if user has workouts planned for tomorrow
      const hasWorkoutTomorrow = await this.checkWorkoutForTomorrow(userId)
      
      // Generate AI suggestions with workout context
      const aiSuggestions = await this.generateAISuggestions(mealType, apiKey, userPreferences, hasWorkoutTomorrow)
      
      // Search for each AI-suggested food in the nutrition API
      const searchResults: FoodSearchResult[] = []
      
      for (const suggestion of aiSuggestions) {
        try {
          const searchResponse = await NutritionService.searchFoods(suggestion, 1)
          if (searchResponse.foods.length > 0) {
            // Take the first result from each search
            searchResults.push(searchResponse.foods[0])
          }
        } catch (error) {
          console.warn(`Failed to search for: ${suggestion}`, error)
        }
      }

      // If we got results, add fallback suggestions to ensure we have enough
      if (searchResults.length < 3) {
        const fallbackSuggestions = this.getFallbackSuggestions(mealType)
        searchResults.push(...fallbackSuggestions.slice(0, 5 - searchResults.length))
      }

      // Cache the results
      await this.cacheSuggestions(mealType, searchResults)
      
      console.log(`✅ Generated ${searchResults.length} AI meal suggestions for ${mealType}`)
      return searchResults.slice(0, 5) // Return max 5 suggestions

    } catch (error) {
      console.error(`❌ Error generating AI meal suggestions for ${mealType}:`, error)
      return this.getFallbackSuggestions(mealType)
    }
  }

  private static async checkWorkoutForTomorrow(userId: string): Promise<boolean> {
    try {
      // Get tomorrow's date
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowDay = this.getDayOfWeek(tomorrow)
      
      // Import workoutService to check for planned workouts
      const { workoutService } = await import('./workoutService')
      const weeklyPlan = await workoutService.getWeeklyWorkoutPlan(userId)
      
      // Check if tomorrow has any planned exercises
      const tomorrowPlan = weeklyPlan[tomorrowDay]
      const hasWorkout = tomorrowPlan && tomorrowPlan.exercises && tomorrowPlan.exercises.length > 0
      
      console.log(`📅 Tomorrow (${tomorrowDay}) workout check:`, hasWorkout ? 'Has workout planned' : 'No workout planned')
      return hasWorkout || false
      
    } catch (error) {
      console.error('❌ Error checking tomorrow\'s workout:', error)
      return false // Default to no workout if we can't check
    }
  }

  private static getDayOfWeek(date: Date): 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday' {
    const days: ('Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday')[] = 
      ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    return days[date.getDay()] as any
  }

  private static async generateAISuggestions(
    mealType: string,
    apiKey: string,
    userPreferences?: {
      healthGoal?: string
      dietaryRestrictions?: string[]
      preferredCuisines?: string[]
    },
    hasWorkoutTomorrow?: boolean
  ): Promise<string[]> {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`
    
    // Build context for AI with workout information
    let context = `Generate 5 healthy ${mealType} food suggestions.`
    
    if (userPreferences?.healthGoal) {
      context += ` The user's health goal is: ${userPreferences.healthGoal}.`
    }
    
    if (userPreferences?.dietaryRestrictions?.length) {
      context += ` Dietary restrictions: ${userPreferences.dietaryRestrictions.join(', ')}.`
    }
    
    if (userPreferences?.preferredCuisines?.length) {
      context += ` Preferred cuisines: ${userPreferences.preferredCuisines.join(', ')}.`
    }

    // Add workout context for better suggestions
    if (hasWorkoutTomorrow) {
      context += ` The user has a workout planned for tomorrow, so suggest foods that support exercise performance and recovery.`
      
      // Meal-specific workout guidance
      if (mealType === 'breakfast') {
        context += ` Focus on pre-workout energy foods with carbs and moderate protein.`
      } else if (mealType === 'lunch') {
        context += ` Focus on balanced meals that sustain energy for workouts.`
      } else if (mealType === 'dinner') {
        context += ` Focus on post-workout recovery foods with protein and complex carbs.`
      } else if (mealType === 'snack') {
        context += ` Focus on pre or post-workout snacks that are easy to digest.`
      }
    } else {
      context += ` The user has no workout planned for tomorrow, so focus on general healthy nutrition.`
    }

    context += ` Return ONLY a valid JSON array of 5 food names, no markdown, no code blocks, no extra text. Example: ["oatmeal", "scrambled eggs", "greek yogurt", "avocado toast", "smoothie bowl"]`

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: context
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 200
      }
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      throw new Error(`AI API request failed: ${response.status}`)
    }

    const data = await response.json()
    
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      const aiText = data.candidates[0].content.parts[0].text.trim()
      console.log('🤖 Raw AI response:', aiText)
      
      try {
        // Clean the response to handle markdown code blocks
        let cleanedText = aiText
        
        // Remove markdown code blocks if present
        if (cleanedText.includes('```json')) {
          cleanedText = cleanedText.replace(/```json\s*/g, '').replace(/```\s*/g, '')
        } else if (cleanedText.includes('```')) {
          cleanedText = cleanedText.replace(/```\s*/g, '')
        }
        
        // Remove any leading/trailing whitespace
        cleanedText = cleanedText.trim()
        
        // Try to extract JSON array if there's extra text
        const jsonMatch = cleanedText.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
          cleanedText = jsonMatch[0]
        }
        
        console.log('🧹 Cleaned AI response:', cleanedText)
        
        const suggestions = JSON.parse(cleanedText)
        if (Array.isArray(suggestions)) {
          return suggestions.slice(0, 5) // Ensure max 5 suggestions
        } else {
          console.error('❌ AI response is not an array:', suggestions)
          return this.getDefaultSuggestions(mealType, hasWorkoutTomorrow)
        }
      } catch (parseError) {
        console.error('❌ Failed to parse AI response:', parseError)
        console.error('❌ Original text:', aiText)
        return this.getDefaultSuggestions(mealType, hasWorkoutTomorrow)
      }
    }

    // Fallback to default suggestions if AI parsing fails
    return this.getDefaultSuggestions(mealType, hasWorkoutTomorrow)
  }

  private static getDefaultSuggestions(mealType: string, hasWorkout?: boolean): string[] {
    if (hasWorkout) {
      // Workout-optimized suggestions
      const workoutSuggestions = {
        breakfast: ['oatmeal with banana', 'greek yogurt with berries', 'whole grain toast with peanut butter', 'protein smoothie', 'scrambled eggs with spinach'],
        lunch: ['quinoa bowl with chicken', 'turkey and avocado wrap', 'salmon salad', 'brown rice with vegetables', 'lean beef stir fry'],
        dinner: ['grilled chicken with sweet potato', 'salmon with quinoa', 'turkey meatballs with pasta', 'tofu stir fry with brown rice', 'lean beef with vegetables'],
        snack: ['protein bar', 'banana with almond butter', 'greek yogurt', 'mixed nuts', 'chocolate milk']
      }
      return workoutSuggestions[mealType as keyof typeof workoutSuggestions] || []
    } else {
      // Regular healthy suggestions
      const regularSuggestions = {
        breakfast: ['oatmeal with berries', 'avocado toast', 'greek yogurt parfait', 'smoothie bowl', 'whole grain cereal'],
        lunch: ['garden salad with protein', 'vegetable soup', 'quinoa bowl', 'turkey sandwich', 'Mediterranean wrap'],
        dinner: ['grilled fish with vegetables', 'chicken stir fry', 'vegetarian curry', 'pasta primavera', 'stuffed bell peppers'],
        snack: ['fresh fruit', 'hummus with vegetables', 'nuts and seeds', 'cheese and crackers', 'herbal tea with biscuit']
      }
      return regularSuggestions[mealType as keyof typeof regularSuggestions] || []
    }
  }

  private static getFallbackSuggestions(mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'): FoodSearchResult[] {
    const fallbackSuggestions = {
      breakfast: [
        'oatmeal with berries',
        'scrambled eggs',
        'greek yogurt',
        'avocado toast',
        'smoothie bowl'
      ],
      lunch: [
        'grilled chicken salad',
        'turkey sandwich',
        'quinoa bowl',
        'vegetable soup',
        'tuna wrap'
      ],
      dinner: [
        'grilled salmon',
        'chicken stir fry',
        'pasta with vegetables',
        'beef and broccoli',
        'vegetarian curry'
      ],
      snack: [
        'mixed nuts',
        'apple with peanut butter',
        'protein bar',
        'hummus with vegetables',
        'cheese and crackers'
      ]
    }

    // Convert to FoodSearchResult format
    return fallbackSuggestions[mealType].map((suggestion, index) => ({
      fdcId: `fallback_${mealType}_${index}`,
      description: suggestion,
      brandOwner: '',
      ingredients: '',
      servingSize: 100,
      servingSizeUnit: 'g',
      foodNutrients: [
        { nutrientId: 1008, nutrientName: 'Energy', nutrientNumber: '208', unitName: 'kcal', value: 200 },
        { nutrientId: 1003, nutrientName: 'Protein', nutrientNumber: '203', unitName: 'g', value: 10 },
        { nutrientId: 1005, nutrientName: 'Carbohydrate', nutrientNumber: '205', unitName: 'g', value: 20 },
        { nutrientId: 1004, nutrientName: 'Total fat', nutrientNumber: '204', unitName: 'g', value: 8 }
      ]
    }))
  }

  private static async getCachedSuggestions(mealType: string): Promise<FoodSearchResult[]> {
    try {
      const cacheKey = `${this.SUGGESTIONS_CACHE_KEY}_${mealType}`
      const cached = await AsyncStorage.getItem(cacheKey)
      
      if (cached) {
        const { suggestions, timestamp } = JSON.parse(cached)
        const now = Date.now()
        const expiryTime = this.CACHE_EXPIRY_HOURS * 60 * 60 * 1000
        
        if (now - timestamp < expiryTime) {
          return suggestions
        }
      }
      
      return []
    } catch (error) {
      console.error('Error reading cached suggestions:', error)
      return []
    }
  }

  private static async cacheSuggestions(mealType: string, suggestions: FoodSearchResult[]): Promise<void> {
    try {
      const cacheKey = `${this.SUGGESTIONS_CACHE_KEY}_${mealType}`
      const cacheData = {
        suggestions,
        timestamp: Date.now()
      }
      
      await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData))
    } catch (error) {
      console.error('Error caching suggestions:', error)
    }
  }

  static async clearCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys()
      const cacheKeys = keys.filter(key => key.startsWith(this.SUGGESTIONS_CACHE_KEY))
      await AsyncStorage.multiRemove(cacheKeys)
      console.log('🗑️ AI meal suggestions cache cleared')
    } catch (error) {
      console.warn('Error clearing cache:', error)
    }
  }
} 