import { Alert, Platform } from 'react-native'

interface AlertButton {
  text: string
  style?: 'default' | 'cancel' | 'destructive'
  onPress?: () => void
}

export const showAlert = (title: string, message: string, buttons?: AlertButton[]) => {
  if (Platform.OS === 'web') {
    // For web, use window.confirm for simple yes/no dialogs
    if (buttons && buttons.length > 1) {
      const confirmed = window.confirm(`${title}\n\n${message}`)
      if (confirmed) {
        // Find the non-cancel button and call its onPress
        const confirmButton = buttons.find(btn => btn.style !== 'cancel')
        if (confirmButton?.onPress) {
          confirmButton.onPress()
        }
      } else {
        // Find the cancel button and call its onPress
        const cancelButton = buttons.find(btn => btn.style === 'cancel')
        if (cancelButton?.onPress) {
          cancelButton.onPress()
        }
      }
    } else {
      // Simple alert
      window.alert(`${title}\n\n${message}`)
      if (buttons && buttons[0]?.onPress) {
        buttons[0].onPress()
      }
    }
  } else {
    // For React Native, use the standard Alert
    Alert.alert(title, message, buttons)
  }
} 