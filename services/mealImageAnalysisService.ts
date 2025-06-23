import { NutritionInfo } from '../types/nutrition';
import { UserService } from './userService';

interface MealAnalysisResult {
  foodName: string;
  description?: string;
  nutritionPer100g: NutritionInfo;
  success: boolean;
  message?: string;
}

export class MealImageAnalysisService {
  static async analyzeImage(userId: string, imageBase64: string): Promise<MealAnalysisResult> {
    try {
      // Get user's API key from their profile
      const user = await UserService.getUser(userId);
      const apiKey = user?.profile?.googleApiKey;
      
      if (!apiKey) {
        return {
          foodName: '',
          nutritionPer100g: {
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0
          },
          success: false,
          message: 'No Google API key found in user profile'
        };
      }
      
      // Prepare the API call to Gemini
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      
      // Construct the prompt for Gemini
      const prompt = `
        Analyze this food image and provide detailed nutritional information.
        
        I need:
        1. The name of the food
        2. A brief description
        3. Nutritional information per 100g:
           - Calories
           - Protein (g)
           - Carbs (g)
           - Fat (g)
           - Fiber (g) (if applicable)
           - Sugar (g) (if applicable)
           - Sodium (mg) (if applicable)
        
        Return ONLY a valid JSON object with the following structure:
        {
          "foodName": "Name of the food",
          "description": "Brief description",
          "nutritionPer100g": {
            "calories": 0,
            "protein": 0,
            "carbs": 0,
            "fat": 0,
            "fiber": 0,
            "sugar": 0,
            "sodium": 0
          }
        }
      `;
      
      // Prepare the request body
      const requestBody = {
        contents: [
          {
            parts: [
              {
                text: prompt
              },
              {
                inline_data: {
                  mime_type: "image/jpeg",
                  data: imageBase64.replace(/^data:image\/\w+;base64,/, '') // Remove the prefix if it exists
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 1024
        }
      };
      
      // Make the API call
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        throw new Error(`AI API request failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        const aiText = data.candidates[0].content.parts[0].text.trim();
        console.log('🤖 Raw AI response:', aiText);
        
        try {
          // Clean the response to handle markdown code blocks
          let cleanedText = aiText;
          
          // Remove markdown code blocks if present
          if (cleanedText.includes('```json')) {
            cleanedText = cleanedText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
          } else if (cleanedText.includes('```')) {
            cleanedText = cleanedText.replace(/```\s*/g, '');
          }
          
          // Remove any leading/trailing whitespace
          cleanedText = cleanedText.trim();
          
          // Try to extract JSON object if there's extra text
          const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            cleanedText = jsonMatch[0];
          }
          
          console.log('🧹 Cleaned AI response:', cleanedText);
          
          const nutritionData = JSON.parse(cleanedText);
          
          // Ensure all required fields exist
          return {
            foodName: nutritionData.foodName || 'Unknown Food',
            description: nutritionData.description || '',
            nutritionPer100g: {
              calories: parseFloat(nutritionData.nutritionPer100g?.calories || 0),
              protein: parseFloat(nutritionData.nutritionPer100g?.protein || 0),
              carbs: parseFloat(nutritionData.nutritionPer100g?.carbs || 0),
              fat: parseFloat(nutritionData.nutritionPer100g?.fat || 0),
              fiber: nutritionData.nutritionPer100g?.fiber ? parseFloat(nutritionData.nutritionPer100g.fiber) : 0,
              sugar: nutritionData.nutritionPer100g?.sugar ? parseFloat(nutritionData.nutritionPer100g.sugar) : 0,
              sodium: nutritionData.nutritionPer100g?.sodium ? parseFloat(nutritionData.nutritionPer100g.sodium) : 0
            },
            success: true
          };
        } catch (parseError) {
          console.error('❌ Failed to parse AI response:', parseError);
          console.error('❌ Original text:', aiText);
          return {
            foodName: '',
            nutritionPer100g: {
              calories: 0,
              protein: 0,
              carbs: 0,
              fat: 0
            },
            success: false,
            message: 'Failed to parse AI response'
          };
        }
      }
      
      return {
        foodName: '',
        nutritionPer100g: {
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0
        },
        success: false,
        message: 'No valid response from AI'
      };
    } catch (error) {
      console.error('❌ Error analyzing meal image:', error);
      return {
        foodName: '',
        nutritionPer100g: {
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0
        },
        success: false,
        message: `Error analyzing image: ${error.message}`
      };
    }
  }
} 