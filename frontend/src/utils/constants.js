import { Circle, Medal, Award, Trophy, Gem, Crown, Zap, BadgeCheck, CheckCircle2 } from 'lucide-react';

// Platform constants
export const PLATFORM_FEE_RATE = 0.05; // 5% (must match Firebase Functions)
export const MINIMUM_WALLET_BALANCE = 500; // PHP

// Payment methods
export const paymentMethods = {
  gcash: { name: 'GCash', icon: '💚', color: 'from-green-500 to-green-600', fee: 0 },
  maya: { name: 'Maya', icon: '💙', color: 'from-blue-500 to-blue-600', fee: 0 },
  grabpay: { name: 'GrabPay', icon: '💚', color: 'from-green-600 to-green-700', fee: 0 },
  bank: { name: 'Bank Transfer', icon: '🏦', color: 'from-gray-500 to-gray-600', fee: 0 },
  seveneleven: { name: '7-Eleven', icon: '🏪', color: 'from-orange-500 to-orange-600', fee: 15 },
  cebuana: { name: 'Cebuana', icon: '📮', color: 'from-yellow-500 to-yellow-600', fee: 25 },
};

// Vehicle types
export const vehicleTypes = [
  'Multicab (500 kg - 1 ton)',
  'L300/H100 (1-2 tons)',
  '4W Elf/Canter (2-4 tons)',
  '6W Forward/Fighter (5-7 tons)',
  '6W Dropside (4-6 tons)',
  '10W Wing Van (12-15 tons)',
  '10W Flatbed (12-15 tons)',
  '10W Container Van (12-15 tons)',
  '12W Trailer (18-20 tons)',
  'Prime Mover + Trailer (20-40 tons)',
];

// Cargo types
export const cargoTypes = [
  'General Merchandise',
  'Fruits & Vegetables',
  'Frozen Goods',
  'Construction Materials',
  'Electronics',
  'Furniture',
  'Machinery',
  'Chemicals',
  'Textiles',
  'Agricultural Products',
  'Food & Beverages',
  'Pharmaceutical',
  'Automotive Parts',
  'Others',
];

// Membership Tiers for Shippers
export const shipperTiers = {
  NEW: { name: 'New', icon: Circle, color: 'text-gray-500', bgLight: 'bg-gray-100', bgDark: 'bg-gray-800', min: 0, discount: 0 },
  BRONZE: { name: 'Bronze', icon: Medal, color: 'text-amber-700', bgLight: 'bg-amber-100', bgDark: 'bg-amber-900/30', min: 3, discount: 2 },
  SILVER: { name: 'Silver', icon: Award, color: 'text-gray-500', bgLight: 'bg-gray-200', bgDark: 'bg-gray-700', min: 10, discount: 5 },
  GOLD: { name: 'Gold', icon: Trophy, color: 'text-yellow-600', bgLight: 'bg-yellow-100', bgDark: 'bg-yellow-900/30', min: 25, discount: 8 },
  PLATINUM: { name: 'Platinum', icon: Gem, color: 'text-cyan-600', bgLight: 'bg-cyan-100', bgDark: 'bg-cyan-900/30', min: 50, discount: 10 },
  DIAMOND: { name: 'Diamond', icon: Crown, color: 'text-purple-600', bgLight: 'bg-purple-100', bgDark: 'bg-purple-900/30', min: 100, discount: 15 },
};

// Get shipper tier based on transaction count
export const getShipperTier = (transactions) => {
  if (transactions >= 100) return shipperTiers.DIAMOND;
  if (transactions >= 50) return shipperTiers.PLATINUM;
  if (transactions >= 25) return shipperTiers.GOLD;
  if (transactions >= 10) return shipperTiers.SILVER;
  if (transactions >= 3) return shipperTiers.BRONZE;
  return shipperTiers.NEW;
};

// Trucker badge configuration
export const truckerBadges = {
  STARTER: { name: 'Starter', icon: Circle, color: 'text-gray-500', bgLight: 'bg-gray-100', bgDark: 'bg-gray-800' },
  ACTIVE: { name: 'Active', icon: CheckCircle2, color: 'text-green-600', bgLight: 'bg-green-100', bgDark: 'bg-green-900/30' },
  VERIFIED: { name: 'Verified', icon: BadgeCheck, color: 'text-blue-600', bgLight: 'bg-blue-100', bgDark: 'bg-blue-900/30' },
  PRO: { name: 'Pro', icon: Zap, color: 'text-amber-600', bgLight: 'bg-amber-100', bgDark: 'bg-amber-900/30' },
  ELITE: { name: 'Elite', icon: Crown, color: 'text-purple-600', bgLight: 'bg-purple-100', bgDark: 'bg-purple-900/30' },
};

// Get trucker badge based on rating and trips
export const getTruckerBadge = (rating, trips) => {
  if (rating >= 4.8 && trips >= 100) return truckerBadges.ELITE;
  if (rating >= 4.5 && trips >= 50) return truckerBadges.PRO;
  if (rating >= 4.0 && trips >= 20) return truckerBadges.VERIFIED;
  if (trips >= 5) return truckerBadges.ACTIVE;
  return truckerBadges.STARTER;
};

// Broker tier configuration
export const brokerTiers = {
  STARTER: { name: 'Starter', icon: Circle, color: 'text-gray-500', minDeals: 0, rate: 3, bonus: 0 },
  SILVER: { name: 'Silver', icon: Medal, color: 'text-gray-400', minDeals: 11, rate: 4, bonus: 500 },
  GOLD: { name: 'Gold', icon: Trophy, color: 'text-yellow-500', minDeals: 31, rate: 5, bonus: 1500 },
  PLATINUM: { name: 'Platinum', icon: Crown, color: 'text-purple-500', minDeals: 51, rate: 6, bonus: 3000 },
};

// Get broker tier based on deal count
export const getBrokerTier = (deals) => {
  if (deals >= 51) return { key: 'PLATINUM', ...brokerTiers.PLATINUM };
  if (deals >= 31) return { key: 'GOLD', ...brokerTiers.GOLD };
  if (deals >= 11) return { key: 'SILVER', ...brokerTiers.SILVER };
  return { key: 'STARTER', ...brokerTiers.STARTER };
};

// Notification types
export const notificationTypes = {
  NEW_BID: { icon: 'TrendingUp', color: 'text-green-500', bgLight: 'bg-green-100', bgDark: 'bg-green-900/30' },
  BID_ACCEPTED: { icon: 'CheckCircle2', color: 'text-blue-500', bgLight: 'bg-blue-100', bgDark: 'bg-blue-900/30' },
  BID_REJECTED: { icon: 'X', color: 'text-red-500', bgLight: 'bg-red-100', bgDark: 'bg-red-900/30' },
  NEW_MESSAGE: { icon: 'MessageSquare', color: 'text-purple-500', bgLight: 'bg-purple-100', bgDark: 'bg-purple-900/30' },
  NEW_CARGO: { icon: 'Package', color: 'text-amber-500', bgLight: 'bg-amber-100', bgDark: 'bg-amber-900/30' },
  NEW_TRUCK: { icon: 'Truck', color: 'text-cyan-500', bgLight: 'bg-cyan-100', bgDark: 'bg-cyan-900/30' },
  CONTRACT_READY: { icon: 'FileText', color: 'text-indigo-500', bgLight: 'bg-indigo-100', bgDark: 'bg-indigo-900/30' },
  SHIPMENT_UPDATE: { icon: 'MapPinned', color: 'text-orange-500', bgLight: 'bg-orange-100', bgDark: 'bg-orange-900/30' },
  RATING_REQUEST: { icon: 'Star', color: 'text-yellow-500', bgLight: 'bg-yellow-100', bgDark: 'bg-yellow-900/30' },
};

// Listing status options
export const cargoStatuses = ['open', 'negotiating', 'contracted', 'in_transit', 'delivered', 'cancelled'];
export const truckStatuses = ['open', 'negotiating', 'contracted', 'in_transit', 'completed', 'cancelled'];
export const bidStatuses = ['pending', 'accepted', 'rejected', 'withdrawn'];
export const shipmentStatuses = ['picked_up', 'in_transit', 'delivered'];
export const contractStatuses = ['draft', 'signed', 'completed', 'disputed', 'cancelled'];

// Rating tags
export const ratingTags = {
  positive: ['On-time delivery', 'Good communication', 'Careful handling', 'Professional', 'Fair pricing'],
  negative: ['Late delivery', 'Poor communication', 'Damaged goods', 'Unprofessional', 'Overcharging'],
};
