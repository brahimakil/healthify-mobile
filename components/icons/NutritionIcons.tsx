import { Ionicons, MaterialIcons } from '@expo/vector-icons'
import React from 'react'

interface IconProps {
  size?: number
  color?: string
}

export const FoodIcon: React.FC<IconProps> = ({ size = 24, color = '#1F2937' }) => (
  <MaterialIcons name="restaurant" size={size} color={color} />
)

export const CaloriesIcon: React.FC<IconProps> = ({ size = 24, color = '#1F2937' }) => (
  <MaterialIcons name="local-fire-department" size={size} color={color} />
)

export const ProteinIcon: React.FC<IconProps> = ({ size = 24, color = '#1F2937' }) => (
  <MaterialIcons name="fitness-center" size={size} color={color} />
)

export const CarbsIcon: React.FC<IconProps> = ({ size = 24, color = '#1F2937' }) => (
  <MaterialIcons name="grain" size={size} color={color} />
)

export const FatIcon: React.FC<IconProps> = ({ size = 24, color = '#1F2937' }) => (
  <Ionicons name="water" size={size} color={color} />
)

export const FiberIcon: React.FC<IconProps> = ({ size = 24, color = '#1F2937' }) => (
  <MaterialIcons name="eco" size={size} color={color} />
)

export const AddMealIcon: React.FC<IconProps> = ({ size = 24, color = '#1F2937' }) => (
  <MaterialIcons name="add-circle" size={size} color={color} />
)

export const CustomFoodIcon: React.FC<IconProps> = ({ size = 24, color = '#1F2937' }) => (
  <MaterialIcons name="create" size={size} color={color} />
)

export const CameraIcon: React.FC<IconProps> = ({ size = 24, color = '#1F2937' }) => (
  <Ionicons name="camera" size={size} color={color} />
)

export const EditIcon: React.FC<IconProps> = ({ size = 24, color = '#1F2937' }) => (
  <MaterialIcons name="edit" size={size} color={color} />
)

export const DeleteIcon: React.FC<IconProps> = ({ size = 24, color = '#1F2937' }) => (
  <MaterialIcons name="delete" size={size} color={color} />
)

export const TargetIcon: React.FC<IconProps> = ({ size = 24, color = '#1F2937' }) => (
  <MaterialIcons name="gps-fixed" size={size} color={color} />
) 