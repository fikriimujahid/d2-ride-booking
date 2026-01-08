export interface RideOption {
  id: string
  name: string
  description: string
  priceMultiplier: number
  capacity: number
  estimatedTime: string
  icon: string
}

export interface Ride {
  id: string
  pickup: string
  destination: string
  date: string
  price: number
  status: "completed" | "cancelled" | "in-progress"
  rideType: string
  driverName?: string
  driverRating?: number
}

export interface Driver {
  id: string
  name: string
  rating: number
  carModel: string
  licensePlate: string
  photo: string
}

export const rideOptions: RideOption[] = [
  {
    id: "economy",
    name: "Economy",
    description: "Affordable rides for everyday travel",
    priceMultiplier: 1.0,
    capacity: 4,
    estimatedTime: "2 min",
    icon: "🚗",
  },
  {
    id: "premium",
    name: "Premium",
    description: "High-end vehicles with top-rated drivers",
    priceMultiplier: 1.5,
    capacity: 4,
    estimatedTime: "5 min",
    icon: "🚙",
  },
  {
    id: "xl",
    name: "XL",
    description: "Extra space for groups and luggage",
    priceMultiplier: 1.8,
    capacity: 6,
    estimatedTime: "4 min",
    icon: "🚐",
  },
]

export const mockRides: Ride[] = [
  {
    id: "1",
    pickup: "123 Main St, San Francisco, CA",
    destination: "456 Market St, San Francisco, CA",
    date: "2024-01-15T14:30:00",
    price: 24.5,
    status: "completed",
    rideType: "Economy",
    driverName: "John Smith",
    driverRating: 4.9,
  },
  {
    id: "2",
    pickup: "SFO Airport, San Francisco, CA",
    destination: "789 Tech Blvd, San Francisco, CA",
    date: "2024-01-10T09:15:00",
    price: 45.0,
    status: "completed",
    rideType: "Premium",
    driverName: "Maria Garcia",
    driverRating: 5.0,
  },
  {
    id: "3",
    pickup: "321 Oak St, San Francisco, CA",
    destination: "654 Pine St, San Francisco, CA",
    date: "2024-01-05T18:45:00",
    price: 18.75,
    status: "completed",
    rideType: "Economy",
    driverName: "David Lee",
    driverRating: 4.8,
  },
  {
    id: "4",
    pickup: "111 Castro St, San Francisco, CA",
    destination: "222 Mission St, San Francisco, CA",
    date: "2023-12-28T12:00:00",
    price: 32.0,
    status: "cancelled",
    rideType: "XL",
  },
]

export const mockDriver: Driver = {
  id: "1",
  name: "John Smith",
  rating: 4.9,
  carModel: "Toyota Camry 2022",
  licensePlate: "ABC 1234",
  photo: "/professional-driver-portrait.png",
}

export function calculatePrice(distance: number, rideTypeId: string): number {
  const basePrice = 5.0
  const pricePerMile = 2.5
  const option = rideOptions.find((opt) => opt.id === rideTypeId)
  const multiplier = option?.priceMultiplier || 1.0
  return Number(((basePrice + distance * pricePerMile) * multiplier).toFixed(2))
}

export const mockUser = {
  name: "Alex Johnson",
  email: "alex.johnson@example.com",
  phone: "+1 (555) 123-4567",
  memberSince: "2023-06",
  ridesCompleted: 127,
}
