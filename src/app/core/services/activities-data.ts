// src/app/core/services/activities-data.ts

import { Activity } from '../models/activity.model';

/**
 * A comprehensive list of default activities available in the application.
 */
export const ACTIVITIES_DATA: Activity[] = [
  // Team Sports
  {
    id: 'football',
    name: 'Football',
    description: 'A team sport involving kicking a ball to score a goal.',
    category: 'Team Sports',
    iconName: 'football',
    intensity: 'High',
    defaultTrackingMetrics: { duration: true, distance: true, calories: true, notes: true }
  },
  {
    id: 'basketball',
    name: 'Basketball',
    description: 'A team sport where players shoot a ball through a hoop.',
    category: 'Team Sports',
    iconName: 'basketball',
    intensity: 'High',
    defaultTrackingMetrics: { duration: true, distance: false, calories: true, notes: true }
  },
  {
    id: 'volleyball',
    name: 'Volleyball',
    description: 'A team sport where two teams hit a ball over a net.',
    category: 'Team Sports',
    iconName: 'volleyball',
    intensity: 'Medium',
    defaultTrackingMetrics: { duration: true, distance: false, calories: true, notes: true }
  },
  {
    id: 'baseball',
    name: 'Baseball',
    description: 'A bat-and-ball game played between two opposing teams.',
    category: 'Team Sports',
    iconName: 'baseball',
    intensity: 'Medium',
    defaultTrackingMetrics: { duration: true, distance: false, calories: true, notes: true }
  },

  // Individual Sports
  {
    id: 'running',
    name: 'Running',
    description: 'Running or jogging at a steady pace outdoors or on a treadmill.',
    category: 'Individual Sports',
    iconName: 'run',
    intensity: 'High',
    defaultTrackingMetrics: { duration: true, distance: true, calories: true, notes: true }
  },
  {
    id: 'swimming',
    name: 'Swimming',
    description: 'Propelling oneself through water using limbs, typically in a pool or open water.',
    category: 'Individual Sports',
    iconName: 'pool',
    intensity: 'High',
    defaultTrackingMetrics: { duration: true, distance: true, calories: true, notes: true }
  },
  {
    id: 'cycling',
    name: 'Cycling',
    description: 'Riding a bicycle for transport, recreation, or sport.',
    category: 'Individual Sports',
    iconName: 'bike',
    intensity: 'Medium',
    defaultTrackingMetrics: { duration: true, distance: true, calories: true, notes: true }
  },
  {
    id: 'tennis',
    name: 'Tennis',
    description: 'A racket sport that can be played individually or between two teams of two.',
    category: 'Individual Sports',
    iconName: 'tennisball',
    intensity: 'High',
    defaultTrackingMetrics: { duration: true, distance: false, calories: true, notes: true }
  },
  {
    id: 'golf',
    name: 'Golf',
    description: 'A club-and-ball sport in which players use various clubs to hit balls into a series of holes.',
    category: 'Individual Sports',
    iconName: 'golf',
    intensity: 'Low',
    defaultTrackingMetrics: { duration: true, distance: false, calories: true, notes: true }
  },

  // Outdoor & Adventure
  {
    id: 'hiking',
    name: 'Hiking',
    description: 'A long, vigorous walk, usually on trails or footpaths in the countryside.',
    category: 'Outdoor & Adventure',
    iconName: 'hiking',
    intensity: 'Medium',
    defaultTrackingMetrics: { duration: true, distance: true, calories: true, notes: true }
  },
  {
    id: 'rock-climbing',
    name: 'Rock Climbing',
    description: 'The sport of climbing rock faces, especially with the aid of ropes and special equipment.',
    category: 'Outdoor & Adventure',
    iconName: 'rock-climbing',
    intensity: 'High',
    defaultTrackingMetrics: { duration: true, distance: false, calories: true, notes: true }
  },
  {
    id: 'skiing',
    name: 'Skiing',
    description: 'The action of traveling over snow on skis, especially as a sport or recreation.',
    category: 'Outdoor & Adventure',
    iconName: 'skiing',
    intensity: 'High',
    defaultTrackingMetrics: { duration: true, distance: true, calories: true, notes: true }
  },
  {
    id: 'kayaking',
    name: 'Kayaking',
    description: 'The use of a kayak for moving across water.',
    category: 'Outdoor & Adventure',
    iconName: 'kayaking',
    intensity: 'Medium',
    defaultTrackingMetrics: { duration: true, distance: true, calories: true, notes: true }
  },

  // Fitness & Classes
  {
    id: 'yoga',
    name: 'Yoga',
    description: 'A group of physical, mental, and spiritual practices which originated in ancient India.',
    category: 'Fitness & Classes',
    iconName: 'yoga',
    intensity: 'Low',
    defaultTrackingMetrics: { duration: true, distance: false, calories: true, notes: true }
  },
  {
    id: 'pilates',
    name: 'Pilates',
    description: 'A physical fitness system developed in the early 20th century by Joseph Pilates.',
    category: 'Fitness & Classes',
    iconName: 'pilates',
    intensity: 'Low',
    defaultTrackingMetrics: { duration: true, distance: false, calories: true, notes: true }
  },
  {
    id: 'hiit-class',
    name: 'HIIT Class',
    description: 'High-Intensity Interval Training class, involving short bursts of intense exercise.',
    category: 'Fitness & Classes',
    iconName: 'flame',
    intensity: 'High',
    defaultTrackingMetrics: { duration: true, distance: false, calories: true, notes: true }
  },
  {
    id: 'spinning',
    name: 'Spinning Class',
    description: 'An indoor cycling class focusing on endurance, strength, and high-intensity.',
    category: 'Fitness & Classes',
    iconName: 'spin-bike',
    intensity: 'High',
    defaultTrackingMetrics: { duration: true, distance: true, calories: true, notes: true }
  },
  
  // Mind & Body
  {
    id: 'meditation',
    name: 'Meditation',
    description: 'A practice where an individual uses a technique to train attention and awareness.',
    category: 'Mind & Body',
    iconName: 'meditation',
    intensity: 'Low',
    defaultTrackingMetrics: { duration: true, distance: false, calories: false, notes: true }
  },
  {
    id: 'stretching',
    name: 'Stretching',
    description: 'A form of physical exercise in which a specific muscle or tendon is deliberately flexed or stretched.',
    category: 'Mind & Body',
    iconName: 'stretch',
    intensity: 'Low',
    defaultTrackingMetrics: { duration: true, distance: false, calories: true, notes: true }
  },

  // Recreational & Leisure
  {
    id: 'walking',
    name: 'Walking',
    description: 'Walking at a casual to brisk pace for leisure or transport.',
    category: 'Recreational & Leisure',
    iconName: 'walk',
    intensity: 'Low',
    defaultTrackingMetrics: { duration: true, distance: true, calories: true, notes: true }
  },
  {
    id: 'dancing',
    name: 'Dancing (Social)',
    description: 'Moving rhythmically to music, as a form of social interaction or performance.',
    category: 'Recreational & Leisure',
    iconName: 'dance',
    intensity: 'Medium',
    defaultTrackingMetrics: { duration: true, distance: false, calories: true, notes: true }
  },

  // Home & Lifestyle
  {
    id: 'gardening',
    name: 'Gardening',
    description: 'The practice of growing and cultivating plants as part of horticulture.',
    category: 'Home & Lifestyle',
    iconName: 'leaf',
    intensity: 'Low',
    defaultTrackingMetrics: { duration: true, distance: false, calories: true, notes: true }
  },
  {
    id: 'heavy-chores',
    name: 'Heavy Chores',
    description: 'Physically demanding household or yard work, such as moving furniture or landscaping.',
    category: 'Home & Lifestyle',
    iconName: 'home-wrench',
    intensity: 'Medium',
    defaultTrackingMetrics: { duration: true, distance: false, calories: true, notes: true }
  }
];