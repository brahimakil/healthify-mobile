import AsyncStorage from '@react-native-async-storage/async-storage'
import { Exercise, workoutService } from './workoutService'

export interface WorkoutSuggestion {
  dayOfWeek: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday'
  recommendedFocus: string[]
  suggestedExercises: Exercise[]
  reasoning: string
  validationStatus: 'validated' | 'fallback' | 'rule-based'
}

export class AIWorkoutSuggestionService {
  private static readonly SUGGESTIONS_CACHE_KEY = 'ai_workout_suggestions_cache'
  private static readonly CACHE_EXPIRY_HOURS = 12 // Shorter cache for fresh suggestions

  static async generateTomorrowWorkoutSuggestion(
    userId: string,
    userPreferences?: {
      healthGoal?: string
      fitnessLevel?: string
      preferredFocus?: string[]
      availableEquipment?: string[]
    }
  ): Promise<WorkoutSuggestion> {
    try {
      console.log('🏋️ Starting AI workout suggestion generation...')
      
      // Get tomorrow's day
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowDay = this.getDayOfWeek(tomorrow)
      
      console.log(`📅 Tomorrow is: ${tomorrowDay}`)

      // Analyze this week's training history first
      console.log('📊 Analyzing weekly training patterns...')
      const weeklyAnalysis = await this.analyzeWeeklyTraining(userId)
      console.log('📊 Weekly analysis complete:', weeklyAnalysis)

      // Try AI-powered suggestions first
      let suggestion = await this.tryAISuggestion(userId, tomorrowDay, weeklyAnalysis, userPreferences)
      
      if (suggestion) {
        console.log('🤖 AI suggestion generated successfully')
        // Validate exercises exist in API
        const validatedSuggestion = await this.validateAndEnrichSuggestion(suggestion)
        if (validatedSuggestion.suggestedExercises.length > 0) {
          console.log('✅ AI suggestion validated with real exercises')
          await this.cacheSuggestion(tomorrowDay, validatedSuggestion)
          return validatedSuggestion
        }
      }

      // Fallback to rule-based suggestions
      console.log('⚡ Using intelligent rule-based suggestions')
      const fallbackSuggestion = await this.generateRuleBasedSuggestion(tomorrowDay, weeklyAnalysis, userPreferences)
      await this.cacheSuggestion(tomorrowDay, fallbackSuggestion)
      return fallbackSuggestion

    } catch (error) {
      console.error('❌ Error in AI workout suggestion:', error)
      return this.getEmergencyFallback(userId)
    }
  }

  private static async tryAISuggestion(
    userId: string,
    dayOfWeek: string,
    weeklyAnalysis: any,
    userPreferences?: any
  ): Promise<WorkoutSuggestion | null> {
    try {
      // Get user's API key from their profile
      const { UserService } = await import('./userService')
      const user = await UserService.getUser(userId)
      const apiKey = user?.profile?.googleApiKey
      
      if (!apiKey) {
        console.log('⚠️ No Google API key found in user profile')
        return null
      }

      console.log('🤖 Calling Google AI API with user\'s API key...')
      const aiResult = await this.callGoogleAI(dayOfWeek, weeklyAnalysis, apiKey, userPreferences)
      
      if (!aiResult) {
        console.log('❌ AI API call failed')
        return null
      }

      return {
        dayOfWeek: dayOfWeek as any,
        recommendedFocus: aiResult.focus,
        suggestedExercises: [], // Will be filled by validation
        reasoning: aiResult.reasoning,
        validationStatus: 'validated'
      }
    } catch (error) {
      console.error('❌ AI suggestion failed:', error)
      return null
    }
  }

  private static async callGoogleAI(
    dayOfWeek: string,
    weeklyAnalysis: any,
    apiKey: string,
    userPreferences?: any
  ): Promise<{ focus: string[], reasoning: string } | null> {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`
    
    // Define ONLY the body parts that exist in our exercise API
    const validBodyParts = [
      'chest',      // Available in API
      'back',       // Available in API  
      'upper arms', // Available in API (for arms/biceps/triceps)
      'lower legs', // Available in API (for legs/quads/hamstrings)
      'waist',      // Available in API (for core/abs)
      'cardio'      // Available in fallback exercises
    ]
    
    let context = `You are a professional fitness trainer AI. Analyze the user's weekly training and suggest what they should train tomorrow (${dayOfWeek}).

IMPORTANT: You can ONLY suggest focus areas from this exact list:
- chest
- back  
- upper arms (for biceps, triceps, arm training)
- lower legs (for quadriceps, hamstrings, leg training)
- waist (for core, abs, abdominal training)
- cardio

DO NOT suggest any other body parts like "shoulders", "legs", "arms", "core", "abs" etc. Use ONLY the exact terms listed above.

WEEKLY ANALYSIS:
- Days with workouts: ${weeklyAnalysis.completedDays.join(', ') || 'None'}
- Muscle groups trained: ${weeklyAnalysis.trainedMuscleGroups.join(', ') || 'None'}
- Total workouts this week: ${weeklyAnalysis.totalWorkouts}
- Tomorrow already has exercises: ${weeklyAnalysis.tomorrowHasExercises ? 'Yes (' + weeklyAnalysis.tomorrowExerciseCount + ' exercises)' : 'No'}

RULES:
1. If tomorrow already has 3+ exercises planned, recommend REST (empty focus array)
2. If tomorrow already has 1-2 exercises, suggest light training (max 1 focus area)
3. If total workouts >= 5, recommend REST (empty focus array)
4. Focus on body parts that haven't been trained this week
5. Use ONLY the valid body parts listed above

USER PREFERENCES:
${userPreferences ? JSON.stringify(userPreferences, null, 2) : 'None specified'}

Respond with ONLY a JSON object in this exact format:
{
  "shouldWorkout": boolean,
  "focus": ["body_part1", "body_part2"],
  "reasoning": "explanation for your recommendation"
}

If recommending rest, set shouldWorkout to false and focus to empty array.
Remember: Use ONLY the exact body part terms from the valid list above.`

    try {
      console.log('🤖 Calling Google AI for workout suggestion...')
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: context
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          }
        })
      })

      if (!response.ok) {
        console.error('❌ Google AI API error:', response.status, response.statusText)
        return null
      }

      const data = await response.json()
      
      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        const aiText = data.candidates[0].content.parts[0].text
        console.log('🤖 Raw AI response:', aiText)
        
        try {
          // Clean the response text
          let cleanedText = aiText.trim()
          
          // Remove markdown code blocks if present
          if (cleanedText.startsWith('```json')) {
            cleanedText = cleanedText.replace(/```json\s*/, '').replace(/```\s*$/, '')
          } else if (cleanedText.startsWith('```')) {
            cleanedText = cleanedText.replace(/```\s*/, '').replace(/```\s*$/, '')
          }
          
          // Remove any leading/trailing whitespace
          cleanedText = cleanedText.trim()
          
          // Try to extract JSON if there's extra text
          const jsonMatch = cleanedText.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            cleanedText = jsonMatch[0]
          }
          
          console.log('🧹 Cleaned AI response:', cleanedText)
          
          const parsed = JSON.parse(cleanedText)
          
          // Validate and filter focus areas to only include valid body parts
          let validatedFocus: string[] = []
          if (Array.isArray(parsed.focus)) {
            validatedFocus = parsed.focus.filter((focus: string) => 
              validBodyParts.includes(focus.toLowerCase())
            )
          }
          
          // Validate the response structure
          if (typeof parsed.shouldWorkout === 'boolean' && typeof parsed.reasoning === 'string') {
            return {
              focus: parsed.shouldWorkout ? validatedFocus : [],
              reasoning: parsed.reasoning || 'AI recommendation generated'
            }
          } else {
            console.error('❌ Invalid AI response structure:', parsed)
            return null
          }
          
        } catch (parseError) {
          console.error('❌ Failed to parse AI response:', parseError)
          console.error('❌ Original text:', aiText)
          
          // Try to extract reasoning from the text even if JSON parsing fails
          const reasoningMatch = aiText.match(/reasoning['":\s]*["']([^"']+)["']/i)
          if (reasoningMatch) {
            return {
              focus: [],
              reasoning: reasoningMatch[1]
            }
          }
          
          return null
        }
      }

      return null
    } catch (error) {
      console.error('❌ AI API call failed:', error)
      return null
    }
  }

  private static async validateAndEnrichSuggestion(suggestion: WorkoutSuggestion): Promise<WorkoutSuggestion> {
    console.log('🔍 Validating and enriching AI suggestion...')
    
    if (suggestion.recommendedFocus.length === 0) {
      // Rest day suggestion
      return {
        ...suggestion,
        suggestedExercises: [],
        validationStatus: 'validated'
      }
    }

    const validatedExercises: Exercise[] = []
    
    // Search for exercises for each focus area
    for (const focusArea of suggestion.recommendedFocus.slice(0, 3)) {
      try {
        console.log(`🔍 Searching exercises for: ${focusArea}`)
        
        let searchResults: Exercise[] = []
        
        // Try different search terms for the focus area
        const searchTerms = this.getSearchTermsForFocus(focusArea)
        
        for (const term of searchTerms) {
          try {
            const results = await workoutService.searchExercises(
              term !== 'cardio' ? term : undefined,
              'beginner',
              undefined
            )
            if (results.length > 0) {
              searchResults = results
              break
            }
          } catch (searchError) {
            console.warn(`Search failed for term: ${term}`)
          }
        }
        
        if (searchResults.length > 0) {
          // Take 2-3 best exercises per focus area
          const selectedExercises = searchResults
            .filter(ex => ex.name && ex.target && ex.bodyPart)
            .slice(0, 3)
          
          validatedExercises.push(...selectedExercises)
          console.log(`✅ Found ${selectedExercises.length} exercises for ${focusArea}`)
        } else {
          console.warn(`❌ No exercises found for: ${focusArea}`)
        }
      } catch (error) {
        console.error(`❌ Error searching for ${focusArea}:`, error)
      }
    }

    // Remove duplicates and limit total exercises
    const uniqueExercises = validatedExercises
      .filter((exercise, index, self) => 
        index === self.findIndex(e => e.id === exercise.id)
      )
      .slice(0, 8) // Max 8 exercises

    console.log(`✅ Validation complete: ${uniqueExercises.length} unique exercises found`)

    return {
      ...suggestion,
      suggestedExercises: uniqueExercises,
      validationStatus: uniqueExercises.length > 0 ? 'validated' : 'fallback'
    }
  }

  private static getSearchTermsForFocus(focus: string): string[] {
    // Map AI focus areas to actual API search terms
    const searchMapping: Record<string, string[]> = {
      'chest': ['chest'],
      'back': ['back'],
      'upper arms': ['upper arms'], // This matches the API body part
      'lower legs': ['lower legs'], // This matches the API body part  
      'waist': ['waist'],           // This matches the API body part
      'cardio': ['cardio']
    }
    
    return searchMapping[focus.toLowerCase()] || [focus]
  }

  private static async generateRuleBasedSuggestion(
    dayOfWeek: string,
    weeklyAnalysis: any,
    userPreferences?: any
  ): Promise<WorkoutSuggestion> {
    console.log('⚡ Generating rule-based suggestion...')
    
    let recommendedFocus: string[] = []
    let reasoning = ''

    const trainedGroups = weeklyAnalysis.trainedMuscleGroups
    const totalWorkouts = weeklyAnalysis.totalWorkouts
    const tomorrowHasExercises = weeklyAnalysis.tomorrowHasExercises
    const tomorrowExerciseCount = weeklyAnalysis.tomorrowExerciseCount
    
    // Rule 0: Tomorrow already has exercises planned
    if (tomorrowHasExercises && tomorrowExerciseCount >= 3) {
      reasoning = `You already have ${tomorrowExerciseCount} exercises planned for tomorrow! That's a complete workout. Focus on rest and recovery instead.`
      return {
        dayOfWeek: dayOfWeek as any,
        recommendedFocus: [],
        suggestedExercises: [],
        reasoning,
        validationStatus: 'rule-based'
      }
    } else if (tomorrowHasExercises && tomorrowExerciseCount >= 1) {
      reasoning = `You already have ${tomorrowExerciseCount} exercise${tomorrowExerciseCount > 1 ? 's' : ''} planned for tomorrow. Consider that sufficient or add light complementary exercises.`
      return {
        dayOfWeek: dayOfWeek as any,
        recommendedFocus: ['waist'], // Core/abs for light training
        suggestedExercises: [],
        reasoning,
        validationStatus: 'rule-based'
      }
    }
    
    // Rule 1: Too many workouts = rest day
    if (totalWorkouts >= 5) {
      reasoning = `You've completed ${totalWorkouts} workouts this week! Tomorrow is perfect for rest and recovery to maximize your gains.`
      return {
        dayOfWeek: dayOfWeek as any,
        recommendedFocus: [],
        suggestedExercises: [],
        reasoning,
        validationStatus: 'rule-based'
      }
    }
    
    // Rule 2: Low activity = full body (using valid body parts)
    if (totalWorkouts <= 1) {
      recommendedFocus = ['chest', 'back'] // Focus on major muscle groups
      reasoning = 'Let\'s get back into your routine with chest and back training to activate major muscle groups.'
    }
    // Rule 3: Target untrained muscle groups (using valid API body parts)
    else {
      const validMuscleGroups = ['chest', 'back', 'upper arms', 'lower legs', 'waist']
      const untrainedGroups = validMuscleGroups.filter(group => 
        !trainedGroups.some((trained: string) => {
          const trainedLower = trained.toLowerCase()
          // Map trained groups to our valid groups
          if (group === 'upper arms' && (trainedLower.includes('bicep') || trainedLower.includes('tricep') || trainedLower.includes('arm'))) return true
          if (group === 'lower legs' && (trainedLower.includes('quad') || trainedLower.includes('hamstring') || trainedLower.includes('leg'))) return true
          if (group === 'waist' && (trainedLower.includes('abs') || trainedLower.includes('core'))) return true
          return trainedLower.includes(group)
        })
      )
      
      if (untrainedGroups.length > 0) {
        recommendedFocus = untrainedGroups.slice(0, 2)
        reasoning = `Focus on ${recommendedFocus.join(' and ')} since these muscle groups haven't been trained this week yet.`
      } else {
        // All groups trained, suggest light training
        recommendedFocus = ['cardio', 'waist']
        reasoning = 'Excellent work training all muscle groups! Let\'s focus on cardio and core for active recovery.'
      }
    }

    // Get exercises for the focus areas
    const exerciseSuggestion: WorkoutSuggestion = {
      dayOfWeek: dayOfWeek as any,
      recommendedFocus,
      suggestedExercises: [],
      reasoning,
      validationStatus: 'rule-based'
    }

    return this.validateAndEnrichSuggestion(exerciseSuggestion)
  }

  private static getEmergencyFallback(userId: string): WorkoutSuggestion {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowDay = this.getDayOfWeek(tomorrow)
    
    // Simple weekly pattern using valid API body parts
    const weeklyPattern: Record<string, string[]> = {
      'Monday': ['chest', 'upper arms'],
      'Tuesday': ['back', 'upper arms'],
      'Wednesday': ['lower legs'],
      'Thursday': ['chest', 'waist'],
      'Friday': ['back', 'lower legs'],
      'Saturday': ['cardio'],
      'Sunday': [] // Rest day
    }

    const focus = weeklyPattern[tomorrowDay] || []
    const reasoning = focus.length === 0 
      ? 'Sunday is traditionally a rest day. Take time to recover and prepare for the week ahead.'
      : `Following a balanced weekly routine, ${tomorrowDay} is ideal for ${focus.join(' and ')} training.`

    return {
      dayOfWeek: tomorrowDay as any,
      recommendedFocus: focus,
      suggestedExercises: [],
      reasoning,
      validationStatus: 'fallback'
    }
  }

  private static async analyzeWeeklyTraining(userId: string): Promise<{
    completedDays: string[]
    trainedMuscleGroups: string[]
    totalWorkouts: number
    restDays: number
    lastWorkoutDay: string | null
    workoutPattern: string[]
    tomorrowHasExercises: boolean
    tomorrowExerciseCount: number
  }> {
    try {
      console.log('📊 Getting weekly workout plan...')
      const weeklyPlan = await workoutService.getWeeklyWorkoutPlan(userId)
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      
      // Get tomorrow's day
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowDay = this.getDayOfWeek(tomorrow)
      
      const completedDays: string[] = []
      const trainedMuscleGroups: string[] = []
      let lastWorkoutDay: string | null = null
      
      // Check if tomorrow already has exercises planned
      const tomorrowPlan = weeklyPlan[tomorrowDay]
      const tomorrowHasExercises = !!(tomorrowPlan && tomorrowPlan.exercises && tomorrowPlan.exercises.length > 0)
      const tomorrowExerciseCount = tomorrowPlan?.exercises?.length || 0
      
      console.log(`📅 Tomorrow (${tomorrowDay}) analysis:`, {
        hasExercises: tomorrowHasExercises,
        exerciseCount: tomorrowExerciseCount,
        exercises: tomorrowPlan?.exercises?.map(ex => ex.exerciseName) || []
      })
      
      // Analyze the rest of the week
      for (const day of days) {
        const dayPlan = weeklyPlan[day]
        
        if (dayPlan && dayPlan.exercises && dayPlan.exercises.length > 0) {
          const completedExercises = dayPlan.exercises.filter(ex => ex.completed)
          
          if (completedExercises.length > 0) {
            completedDays.push(day)
            lastWorkoutDay = day
            
            // Extract muscle groups from completed exercises
            completedExercises.forEach(exercise => {
              const muscleGroups = this.extractMuscleGroups(exercise.exerciseName)
              trainedMuscleGroups.push(...muscleGroups)
            })
          }
        }
      }
      
      // Remove duplicates from trained muscle groups
      const uniqueTrainedGroups = [...new Set(trainedMuscleGroups)]
      
      const analysis = {
        completedDays,
        trainedMuscleGroups: uniqueTrainedGroups,
        totalWorkouts: completedDays.length,
        restDays: 7 - completedDays.length,
        lastWorkoutDay,
        workoutPattern: completedDays,
        tomorrowHasExercises,
        tomorrowExerciseCount
      }
      
      console.log('📊 Weekly analysis result:', analysis)
      return analysis
      
    } catch (error) {
      console.error('❌ Error analyzing weekly training:', error)
      return {
        completedDays: [],
        trainedMuscleGroups: [],
        totalWorkouts: 0,
        restDays: 7,
        lastWorkoutDay: null,
        workoutPattern: [],
        tomorrowHasExercises: false,
        tomorrowExerciseCount: 0
      }
    }
  }

  private static getDayOfWeek(date: Date): 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday' {
    const days: ('Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday')[] = 
      ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    return days[date.getDay()] as any
  }

  private static async cacheSuggestion(dayOfWeek: string, suggestion: WorkoutSuggestion): Promise<void> {
    try {
      const cacheData = {
        suggestion,
        timestamp: new Date().toISOString()
      }
      
      await AsyncStorage.setItem(
        `${this.SUGGESTIONS_CACHE_KEY}_${dayOfWeek}`,
        JSON.stringify(cacheData)
      )
      console.log(`💾 Cached suggestion for ${dayOfWeek}`)
    } catch (error) {
      console.error('Error caching suggestion:', error)
    }
  }

  static async clearCache(): Promise<void> {
    try {
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      for (const day of days) {
        await AsyncStorage.removeItem(`${this.SUGGESTIONS_CACHE_KEY}_${day}`)
      }
      console.log('✅ AI workout suggestions cache cleared')
    } catch (error) {
      console.error('Error clearing cache:', error)
    }
  }
} 
