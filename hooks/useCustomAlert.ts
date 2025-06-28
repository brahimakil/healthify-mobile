import { useState } from 'react'

interface AlertButton {
  text: string
  style?: 'default' | 'cancel' | 'destructive'
  onPress?: () => void
}

interface AlertConfig {
  title: string
  message: string
  buttons?: AlertButton[]
}

export const useCustomAlert = () => {
  const [alertConfig, setAlertConfig] = useState<AlertConfig | null>(null)
  const [visible, setVisible] = useState(false)

  const showAlert = (title: string, message: string, buttons?: AlertButton[]) => {
    setAlertConfig({
      title,
      message,
      buttons: buttons || [{ text: 'OK' }],
    })
    setVisible(true)
  }

  const hideAlert = () => {
    setVisible(false)
    setTimeout(() => setAlertConfig(null), 300) // Wait for animation
  }

  return {
    alertConfig,
    visible,
    showAlert,
    hideAlert,
  }
} 