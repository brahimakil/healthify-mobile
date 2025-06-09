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
      let suggestion = await this.tryAISuggestion(tomorrowDay, weeklyAnalysis, userPreferences)
      
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
    dayOfWeek: string,
    weeklyAnalysis: any,
    userPreferences?: any
  ): Promise<WorkoutSuggestion | null> {
    try {
      // Get Google API key
      const apiKey = await AsyncStorage.getItem('google_api_key')
      if (!apiKey) {
        console.log('⚠️ No Google API key found')
        return null
      }

      console.log('🤖 Calling Google AI API...')
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
    
    let context = `You are a professional fitness trainer AI. Analyze the user's weekly training and suggest what they should train tomorrow (${dayOfWeek}).

WEEKLY ANALYSIS:
- Days worked out: ${weeklyAnalysis.completedDays.join(', ') || 'None this week'}
- Muscle groups trained: ${weeklyAnalysis.trainedMuscleGroups.join(', ') || 'None this week'}
- Total workouts completed: ${weeklyAnalysis.totalWorkouts}
- Rest days taken: ${weeklyAnalysis.restDays}
- Last workout day: ${weeklyAnalysis.lastWorkoutDay || 'None this week'}

TOMORROW: ${dayOfWeek}`

    if (userPreferences?.healthGoal) {
      context += `\nHEALTH GOAL: ${userPreferences.healthGoal}`
    }
    
    if (userPreferences?.fitnessLevel) {
      context += `\nFITNESS LEVEL: ${userPreferences.fitnessLevel}`
    }

    if (userPreferences?.preferredFocus?.length > 0) {
      context += `\nPREFERRED FOCUS AREAS: ${userPreferences.preferredFocus.join(', ')}`
    }

    context += `

TASK: Based on this analysis, recommend what the user should do tomorrow.

RULES:
1. Muscle Recovery: Don't train same muscle groups on consecutive days
2. Weekly Balance: Aim for 3-5 workouts per week
3. Progressive Training: Ensure all major muscle groups get trained weekly
4. Recovery: Recommend rest if they've worked out 5+ times this week

RESPONSE FORMAT (JSON only):
{
  "shouldWorkout": true/false,
  "focus": ["primary_muscle", "secondary_muscle"] or [],
  "reasoning": "2-3 sentences explaining your recommendation"
}

FOCUS OPTIONS: chest, back, legs, shoulders, arms, core, cardio, full body, flexibility

EXAMPLE RESPONSES:
{"shouldWorkout": true, "focus": ["chest", "triceps"], "reasoning": "You haven't trained upper body this week. Focus on chest and triceps for balanced muscle development."}
{"shouldWorkout": false, "focus": [], "reasoning": "You've completed 5 workouts this week. Take tomorrow as a rest day for optimal recovery."}`

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: context }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 400
          }
        })
      })

      if (!response.ok) {
        console.error('AI API error:', response.status, response.statusText)
        return null
      }

      const data = await response.json()
      
      if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        const aiText = data.candidates[0].content.parts[0].text.trim()
        console.log('🤖 Raw AI response:', aiText)
        
        try {
          const parsed = JSON.parse(aiText)
          return {
            focus: parsed.shouldWorkout ? (parsed.focus || []) : [],
            reasoning: parsed.reasoning || 'AI recommendation generated'
          }
        } catch (parseError) {
          console.error('Failed to parse AI response:', parseError)
          return null
        }
      }

      return null
    } catch (error) {
      console.error('AI API call failed:', error)
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
    const searchMapping: Record<string, string[]> = {
      'chest': ['chest', 'pectorals', 'pecs'],
      'back': ['back', 'lats', 'latissimus'],
      'legs': ['legs', 'quadriceps', 'hamstrings', 'glutes'],
      'shoulders': ['shoulders', 'deltoids', 'delts'],
      'arms': ['biceps', 'triceps', 'arms'],
      'core': ['abs', 'core', 'abdominals'],
      'cardio': ['cardio'],
      'full body': ['full body', 'compound'],
      'flexibility': ['stretching', 'flexibility']
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
    
    // Rule 2: Low activity = full body
    if (totalWorkouts <= 1) {
      recommendedFocus = ['full body', 'cardio']
      reasoning = 'Let\'s get back into your routine with a balanced full-body workout to activate all major muscle groups.'
    }
    // Rule 3: Target untrained muscle groups
    else {
      const allMuscleGroups = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core']
      const untrainedGroups = allMuscleGroups.filter(group => 
        !trainedGroups.some(trained => trained.toLowerCase().includes(group))
      )
      
      if (untrainedGroups.length > 0) {
        recommendedFocus = untrainedGroups.slice(0, 2)
        reasoning = `Focus on ${recommendedFocus.join(' and ')} since these muscle groups haven't been trained this week yet.`
      } else {
        // All groups trained, suggest light training
        recommendedFocus = ['cardio', 'core']
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
    
    // Simple weekly pattern as absolute fallback
    const weeklyPattern: Record<string, string[]> = {
      'Monday': ['chest', 'triceps'],
      'Tuesday': ['back', 'biceps'],
      'Wednesday': ['legs'],
      'Thursday': ['shoulders', 'core'],
      'Friday': ['full body'],
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
  }> {
    try {
      console.log('📊 Getting weekly workout plan...')
      const weeklyPlan = await workoutService.getWeeklyWorkoutPlan(userId)
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      
      const completedDays: string[] = []
      const trainedMuscleGroups: string[] = []
      let lastWorkoutDay: string | null = null
      
      // Analyze each day of the week
      for (const day of days) {
        const dayPlan = weeklyPlan[day.toLowerCase()]
        if (dayPlan && dayPlan.exercises && dayPlan.exercises.length > 0) {
          const hasCompletedExercises = dayPlan.exercises.some(ex => ex.completed)
          if (hasCompletedExercises) {
            completedDays.push(day)
            lastWorkoutDay = day
            if (dayPlan.targetMuscleGroups) {
              trainedMuscleGroups.push(...dayPlan.targetMuscleGroups)
            }
          }
        }
      }

      const uniqueMuscleGroups = [...new Set(trainedMuscleGroups)]
      
      const analysis = {
        completedDays,
        trainedMuscleGroups: uniqueMuscleGroups,
        totalWorkouts: completedDays.length,
        restDays: 7 - completedDays.length,
        lastWorkoutDay,
        workoutPattern: completedDays
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
        workoutPattern: []
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
