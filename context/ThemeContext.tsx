import { Colors } from '@/constants/Colors'
import React, { createContext, useContext, useState } from 'react'
import { Appearance } from 'react-native'

interface Theme {
  mode: 'light' | 'dark'
  background: string
  text: string
  // Add other theme properties as needed
}

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | null>(null)

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>('system')
  
  const getTheme = (): Theme => {
    const systemTheme = Appearance.getColorScheme() || 'light'
    const effectiveTheme = themeMode === 'system' ? systemTheme : themeMode
    
    return {
      mode: effectiveTheme,
      background: effectiveTheme === 'dark' ? Colors.dark.background : Colors.light.background,
      text: effectiveTheme === 'dark' ? Colors.dark.text : Colors.light.text,
    }
  }
  
  const toggleTheme = () => {
    setThemeMode(prev => {
      if (prev === 'light') return 'dark'
      if (prev === 'dark') return 'system'
      return 'light'
    })
  }
  
  return (
    <ThemeContext.Provider value={{ theme: getTheme(), toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
} 