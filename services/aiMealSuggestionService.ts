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
      
      // Get Google API key
      const apiKey = await AsyncStorage.getItem('google_api_key')
      if (!apiKey) {
        console.log('⚠️ No Google API key found, using fallback suggestions')
        return this.getFallbackSuggestions(mealType)
      }

      // Generate AI suggestions
      const aiSuggestions = await this.generateAISuggestions(mealType, apiKey, userPreferences)
      
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

      // If we got results, cache them
      if (searchResults.length > 0) {
        await this.cacheSuggestions(mealType, searchResults)
        console.log(`✅ Generated ${searchResults.length} AI suggestions for ${mealType}`)
        return searchResults
      }

      // Fallback if AI generation fails
      return this.getFallbackSuggestions(mealType)

    } catch (error) {
      console.error('❌ Error generating AI meal suggestions:', error)
      return this.getFallbackSuggestions(mealType)
    }
  }

  private static async generateAISuggestions(
    mealType: string,
    apiKey: string,
    userPreferences?: {
      healthGoal?: string
      dietaryRestrictions?: string[]
      preferredCuisines?: string[]
    }
  ): Promise<string[]> {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`
    
    // Build context for AI
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

    context += ` Return ONLY a JSON array of 5 food names, nothing else. Example: ["oatmeal", "scrambled eggs", "greek yogurt", "avocado toast", "smoothie bowl"]`

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
      const generatedText = data.candidates[0].content.parts[0].text.trim()
      
      try {
        // Try to parse as JSON array
        const suggestions = JSON.parse(generatedText)
        if (Array.isArray(suggestions)) {
          return suggestions.slice(0, 5) // Ensure max 5 suggestions
        }
      } catch (parseError) {
        // If JSON parsing fails, try to extract food names from text
        const lines = generatedText.split('\n').filter(line => line.trim())
        return lines.slice(0, 5).map(line => line.replace(/^\d+\.?\s*/, '').replace(/["\[\]]/g, '').trim())
      }
    }

    throw new Error('Failed to parse AI response')
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

    // Convert to FoodSearchResult format (these will be searched in the API)
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
      const cacheKey = `${this.SUGGESTIONS_CACHE_KEY}_${mealType}_${this.getCurrentDateString()}`
      const cached = await AsyncStorage.getItem(cacheKey)
      
      if (cached) {
        const { suggestions, timestamp } = JSON.parse(cached)
        const now = Date.now()
        const cacheAge = (now - timestamp) / (1000 * 60 * 60) // hours
        
        if (cacheAge < this.CACHE_EXPIRY_HOURS) {
          return suggestions
        }
      }
      
      return []
    } catch (error) {
      console.warn('Error reading cached suggestions:', error)
      return []
    }
  }

  private static async cacheSuggestions(mealType: string, suggestions: FoodSearchResult[]): Promise<void> {
    try {
      const cacheKey = `${this.SUGGESTIONS_CACHE_KEY}_${mealType}_${this.getCurrentDateString()}`
      const cacheData = {
        suggestions,
        timestamp: Date.now()
      }
      
      await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData))
    } catch (error) {
      console.warn('Error caching suggestions:', error)
    }
  }

  private static getCurrentDateString(): string {
    const today = new Date()
    return `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`
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