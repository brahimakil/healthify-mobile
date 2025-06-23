import { Ionicons, MaterialIcons } from '@expo/vector-icons'
import React from 'react'

interface IconProps {
  size?: number
  color?: string
  strokeWidth?: number
}

export const MenuIcon: React.FC<IconProps> = ({ size = 24, color = '#1F2937' }) => (
  <Ionicons name="menu" size={size} color={color} />
)

export const CloseIcon: React.FC<IconProps> = ({ size = 24, color = '#1F2937' }) => (
  <Ionicons name="close" size={size} color={color} />
)

export const SearchIcon: React.FC<IconProps> = ({ size = 24, color = '#1F2937' }) => (
  <Ionicons name="search" size={size} color={color} />
)

export const BellIcon: React.FC<IconProps> = ({ size = 24, color = '#1F2937' }) => (
  <Ionicons name="notifications-outline" size={size} color={color} />
)

export const DashboardIcon: React.FC<IconProps> = ({ size = 24, color = '#1F2937' }) => (
  <MaterialIcons name="dashboard" size={size} color={color} />
)

export const NutritionIcon: React.FC<IconProps> = ({ size = 24, color = '#1F2937' }) => (
  <MaterialIcons name="restaurant" size={size} color={color} />
)

export const WorkoutIcon: React.FC<IconProps> = ({ size = 24, color = '#1F2937' }) => (
  <MaterialIcons name="fitness-center" size={size} color={color} />
)

export const SleepIcon: React.FC<IconProps> = ({ size = 24, color = '#1F2937' }) => (
  <Ionicons name="bed-outline" size={size} color={color} />
)

export const WaterIcon: React.FC<IconProps> = ({ size = 24, color = '#1F2937' }) => (
  <Ionicons name="water-outline" size={size} color={color} />
)

export const SettingsIcon: React.FC<IconProps> = ({ size = 24, color = '#1F2937' }) => (
  <Ionicons name="settings-outline" size={size} color={color} />
)

export const LogoutIcon: React.FC<IconProps> = ({ size = 24, color = '#1F2937' }) => (
  <Ionicons name="log-out-outline" size={size} color={color} />
)

export const ChevronRightIcon: React.FC<IconProps> = ({ size = 24, color = '#1F2937' }) => (
  <Ionicons name="chevron-forward" size={size} color={color} />
)

export const PlusIcon: React.FC<IconProps> = ({ size = 24, color = '#1F2937' }) => (
  <Ionicons name="add" size={size} color={color} />
)

// ADDED: Missing icons for nutrition page
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

export const FoodIcon: React.FC<IconProps> = ({ size = 24, color = '#1F2937' }) => (
  <MaterialIcons name="restaurant" size={size} color={color} />
)

// ADD: Missing icons for hydration page
export const CalendarIcon: React.FC<IconProps> = ({ size = 24, color = '#1F2937' }) => (
  <Ionicons name="calendar-outline" size={size} color={color} />
)

export const DropletIcon: React.FC<IconProps> = ({ size = 24, color = '#1F2937' }) => (
  <Ionicons name="water" size={size} color={color} />
)

export const UserIcon: React.FC<IconProps> = ({ size = 24, color = '#1F2937' }) => (
  <Ionicons name="person-outline" size={size} color={color} />
)

export const PersonGroupIcon: React.FC<IconProps> = ({ size = 24, color = '#1F2937' }) => (
  <Ionicons name="people-outline" size={size} color={color} />
)