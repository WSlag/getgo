import React, { useState, useEffect } from 'react';
import { Truck, Package, MessageSquare, FileText, Users, Plus, Send, Check, X, MapPin, Weight, Calendar, ChevronDown, ChevronUp, Star, Filter, ArrowRight, Shield, CheckCircle2, Eye, Bell, Home, User, Phone, Mail, Lock, Navigation, Route, Maximize2, TrendingUp, TrendingDown, Minus, Clock, Box, Award, Crown, Gem, Medal, Trophy, ThumbsUp, ThumbsDown, MapPinned, Radio, Circle, Zap, BadgeCheck, Timer, Moon, Sun, Camera, Image, Upload, RotateCcw, Fuel, GitBranch, Waypoints, CircleDot, LogOut } from 'lucide-react';
import { PesoIcon } from '@/components/ui/PesoIcon';

// Firebase imports
import { useAuth } from './contexts/AuthContext';
import { useCargoListings } from './hooks/useCargoListings';
import { useTruckListings } from './hooks/useTruckListings';
import { useBidsForListing } from './hooks/useBids';
import { useChat } from './hooks/useChat';
import { useWallet } from './hooks/useWallet';
import { useNotifications } from './hooks/useNotifications';
import { useShipments } from './hooks/useShipments';
import * as firestoreService from './services/firestoreService';
import { getCoordinates, cityCoordinates } from './utils/cityCoordinates';
import { maskContact, calculateDistance, estimateFuelCost, optimizeRoute, findBackloadMatches, calculateFuelSavings, estimateDuration, calculateRouteEfficiency } from './utils/calculations';
import { PLATFORM_FEE_RATE, MINIMUM_WALLET_BALANCE, paymentMethods, shipperTiers, getShipperTier, getTruckerBadge, brokerTiers, notificationTypes } from './utils/constants';
import { RouteMap, FullMapModal, TrackingMap } from './components/maps';

// Removed duplicate utilities - now imported from ./utils/

// Sample Notifications
const sampleNotifications = [
  {
    id: 'N1',
    type: 'NEW_BID',
    title: 'New Bid Received!',
    message: 'Juan Trucking bid ₱17,500 on your Davao → Cebu cargo',
    route: 'Davao City → Cebu City',
    amount: 17500,
    from: 'Juan Trucking',
    time: '5 min ago',
    timestamp: Date.now() - 5 * 60 * 1000,
    read: false,
    forRole: 'shipper',
    actionType: 'view_bid',
    relatedId: 'C1'
  },
  {
    id: 'N2',
    type: 'NEW_BID',
    title: 'New Bid Received!',
    message: 'Mindanao Haulers bid ₱19,000 on your Davao → Cebu cargo',
    route: 'Davao City → Cebu City',
    amount: 19000,
    from: 'Mindanao Haulers',
    time: '45 min ago',
    timestamp: Date.now() - 45 * 60 * 1000,
    read: false,
    forRole: 'shipper',
    actionType: 'view_bid',
    relatedId: 'C1'
  },
  {
    id: 'N3',
    type: 'NEW_CARGO',
    title: 'New Cargo Posted!',
    message: 'Fresh Farms Inc. needs 6W Forward for GenSan → Davao',
    route: 'General Santos → Davao City',
    amount: 8500,
    from: 'Fresh Farms Inc.',
    time: '1 hour ago',
    timestamp: Date.now() - 60 * 60 * 1000,
    read: false,
    forRole: 'trucker',
    actionType: 'view_cargo',
    relatedId: 'C2'
  },
  {
    id: 'N4',
    type: 'NEW_MESSAGE',
    title: 'New Message',
    message: 'Juan Trucking: "Available po, pwede pickup tomorrow"',
    route: 'Davao City → Cebu City',
    from: 'Juan Trucking',
    time: '1 hour ago',
    timestamp: Date.now() - 60 * 60 * 1000,
    read: true,
    forRole: 'shipper',
    actionType: 'open_chat',
    relatedId: 'C1'
  },
  {
    id: 'N5',
    type: 'NEW_TRUCK',
    title: 'Truck Available on Your Route!',
    message: 'Heavy Haul PH has 10W Flatbed going CDO → Davao',
    route: 'Cagayan de Oro → Davao City',
    amount: 15000,
    from: 'Heavy Haul PH',
    time: '3 hours ago',
    timestamp: Date.now() - 3 * 60 * 60 * 1000,
    read: true,
    forRole: 'shipper',
    actionType: 'view_truck',
    relatedId: 'T1'
  },
  {
    id: 'N6',
    type: 'BID_ACCEPTED',
    title: 'Your Bid Was Accepted! 🎉',
    message: 'Steel Masters accepted your ₱14,000 bid for CDO → Davao',
    route: 'Cagayan de Oro → Davao City',
    amount: 14000,
    from: 'Steel Masters',
    time: '2 hours ago',
    timestamp: Date.now() - 2 * 60 * 60 * 1000,
    read: false,
    forRole: 'trucker',
    actionType: 'view_contract',
    relatedId: 'T1'
  },
  {
    id: 'N7',
    type: 'SHIPMENT_UPDATE',
    title: 'Shipment In Transit',
    message: 'Your cargo is now near Butuan City (65% complete)',
    route: 'Davao City → Cebu City',
    from: 'Juan Trucking',
    time: '30 min ago',
    timestamp: Date.now() - 30 * 60 * 1000,
    read: false,
    forRole: 'shipper',
    actionType: 'track_shipment',
    relatedId: 'S1'
  },
  {
    id: 'N8',
    type: 'RATING_REQUEST',
    title: 'Rate Your Delivery',
    message: 'How was your delivery with Heavy Haul PH?',
    route: 'Cagayan de Oro → Davao City',
    from: 'Heavy Haul PH',
    time: 'Yesterday',
    timestamp: Date.now() - 24 * 60 * 60 * 1000,
    read: true,
    forRole: 'shipper',
    actionType: 'rate_delivery',
    relatedId: 'S3'
  },
];

// Sample Active Shipments
const sampleActiveShipments = [
  {
    id: 'S1',
    cargo: 'General Merchandise',
    shipper: 'ABC Trading',
    trucker: 'Juan Trucking',
    truckerRating: 4.8,
    origin: 'Davao City',
    destination: 'Cebu City',
    originCoords: { lat: 7.0707, lng: 125.6087 },
    destCoords: { lat: 10.3157, lng: 123.8854 },
    status: 'in_transit',
    progress: 65,
    currentLocation: { lat: 8.9475, lng: 125.0406, name: 'Near Butuan City' },
    departedAt: '2026-01-24 06:00 AM',
    eta: '2026-01-24 4:00 PM',
    lastUpdate: '5 min ago',
    vehiclePlate: 'ABC 1234',
    driverPhone: '0917-123-4567'
  },
  {
    id: 'S2',
    cargo: 'Fruits & Vegetables',
    shipper: 'Fresh Farms Inc.',
    trucker: 'Southern Express',
    truckerRating: 4.7,
    origin: 'General Santos',
    destination: 'Davao City',
    originCoords: { lat: 6.1164, lng: 125.1716 },
    destCoords: { lat: 7.0707, lng: 125.6087 },
    status: 'picked_up',
    progress: 25,
    currentLocation: { lat: 6.5, lng: 125.3, name: 'Polomolok, South Cotabato' },
    departedAt: '2026-01-24 08:00 AM',
    eta: '2026-01-24 12:00 PM',
    lastUpdate: '2 min ago',
    vehiclePlate: 'SE 3456',
    driverPhone: '0920-111-2222'
  },
  {
    id: 'S3',
    cargo: 'Construction Materials',
    shipper: 'Steel Masters',
    trucker: 'Heavy Haul PH',
    truckerRating: 4.7,
    origin: 'Cagayan de Oro',
    destination: 'Davao City',
    originCoords: { lat: 8.4542, lng: 124.6319 },
    destCoords: { lat: 7.0707, lng: 125.6087 },
    status: 'delivered',
    progress: 100,
    currentLocation: { lat: 7.0707, lng: 125.6087, name: 'Davao City - Delivered' },
    departedAt: '2026-01-23 06:00 AM',
    eta: '2026-01-23 02:00 PM',
    lastUpdate: 'Yesterday',
    vehiclePlate: 'HHP 3456',
    driverPhone: '0918-987-6543',
    deliveredAt: '2026-01-23 01:45 PM',
    needsRating: true
  }
];

// Sample Cargo Posts
const sampleCargoListings = [
  { 
    id: 'C1', type: 'cargo',
    shipper: 'ABC Trading', shipperTransactions: 45,
    contact: { phone: '0917-111-2222', email: 'abc@trading.com', fb: 'fb.com/abctrading' },
    origin: 'Davao City', destination: 'Cebu City',
    originCoords: { lat: 7.0707, lng: 125.6087 }, destCoords: { lat: 10.3157, lng: 123.8854 },
    weight: 12, unit: 'tons', cargoType: 'General Merchandise', vehicleNeeded: '10W Wing Van (12-15 tons)',
    askingPrice: 18000, description: 'Assorted dry goods, palletized. 24 pallets total, properly wrapped.',
    pickupDate: '2026-01-26', status: 'open', postedAt: '2 hours ago',
    cargoPhotos: [
      { id: 'p1', url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400', caption: 'Palletized goods' },
      { id: 'p2', url: 'https://images.unsplash.com/photo-1553413077-190dd305871c?w=400', caption: 'Warehouse view' },
    ],
    bids: [
      { id: 'B1', bidder: 'Juan Trucking', bidderType: 'trucker', price: 17500, rating: 4.8, trips: 156, message: 'Available po, pwede pickup tomorrow', status: 'pending', time: '1 hour ago', contact: { phone: '0917-123-4567', email: 'juan@trucking.com', fb: 'fb.com/juantrucking' }, chatHistory: [] },
      { id: 'B2', bidder: 'Mindanao Haulers', bidderType: 'trucker', price: 19000, rating: 4.5, trips: 89, message: 'May refrigerated van ako if needed', status: 'pending', time: '45 min ago', contact: { phone: '0918-555-6666', email: 'mh@haulers.ph', fb: 'fb.com/mindanaohaulers' }, chatHistory: [] },
    ]
  },
  { 
    id: 'C2', type: 'cargo',
    shipper: 'Fresh Farms Inc.', shipperTransactions: 12,
    contact: { phone: '0917-222-3333', email: 'fresh@farms.ph', fb: 'fb.com/freshfarms' },
    origin: 'General Santos', destination: 'Davao City',
    originCoords: { lat: 6.1164, lng: 125.1716 }, destCoords: { lat: 7.0707, lng: 125.6087 },
    weight: 5, unit: 'tons', cargoType: 'Fruits & Vegetables', vehicleNeeded: '6W Forward/Fighter (5-7 tons)',
    askingPrice: 8500, description: 'Fresh bananas and mangoes. Temperature sensitive, need early morning delivery.',
    pickupDate: '2026-01-25', status: 'open', postedAt: '5 hours ago',
    cargoPhotos: [
      { id: 'p3', url: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400', caption: 'Fresh bananas' },
      { id: 'p4', url: 'https://images.unsplash.com/photo-1553279768-865429fa0078?w=400', caption: 'Mango crates' },
    ],
    bids: []
  },
  { 
    id: 'C3', type: 'cargo',
    shipper: 'BuildRight Construction', shipperTransactions: 67,
    contact: { phone: '0917-333-4444', email: 'build@right.ph', fb: 'fb.com/buildright' },
    origin: 'Cagayan de Oro', destination: 'Butuan City',
    originCoords: { lat: 8.4542, lng: 124.6319 }, destCoords: { lat: 8.9475, lng: 125.5406 },
    weight: 8, unit: 'tons', cargoType: 'Construction Materials', vehicleNeeded: '6W Dropside (4-6 tons)',
    askingPrice: 12000, description: 'Steel bars and cement. Heavy items, need truck with crane or boom.',
    pickupDate: '2026-01-27', status: 'open', postedAt: '1 hour ago',
    cargoPhotos: [
      { id: 'p5', url: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400', caption: 'Steel bars bundle' },
    ],
    bids: []
  },
];

// Sample Truck Posts
const sampleTruckListings = [
  { 
    id: 'T1', type: 'truck',
    trucker: 'Heavy Haul PH', rating: 4.7, trips: 178,
    contact: { phone: '0918-987-6543', email: 'heavyhaul@gmail.com', fb: 'fb.com/heavyhaulph' },
    origin: 'Cagayan de Oro', destination: 'Davao City',
    originCoords: { lat: 8.4542, lng: 124.6319 }, destCoords: { lat: 7.0707, lng: 125.6087 },
    vehicleType: '10W Flatbed (12-15 tons)', capacity: 14, unit: 'tons', plateNo: 'HHP 3456',
    askingPrice: 15000, description: 'Backload available, may crane for loading',
    availableDate: '2026-01-27', departureTime: '6:00 AM', status: 'open', postedAt: '3 hours ago',
    bids: [
      { id: 'B3', bidder: 'Steel Masters', bidderType: 'shipper', shipperTransactions: 28, price: 14000, message: 'May 8 tons steel bars ako', status: 'pending', time: '2 hours ago', contact: { phone: '0917-333-4444', email: 'steel@masters.ph', fb: 'fb.com/steelmasters' }, cargoDetails: { type: 'Construction Materials', weight: 8 }, chatHistory: [] },
      { id: 'B4', bidder: 'CDO Furniture', bidderType: 'shipper', shipperTransactions: 5, price: 16000, message: 'Higher offer for priority loading', status: 'pending', time: '1 hour ago', contact: { phone: '0917-444-5555', email: 'cdo@furniture.ph', fb: 'fb.com/cdofurniture' }, cargoDetails: { type: 'Furniture', weight: 6 }, chatHistory: [] },
    ]
  },
  { 
    id: 'T2', type: 'truck',
    trucker: 'Quick Logistics', rating: 4.9, trips: 234,
    contact: { phone: '0919-777-8888', email: 'quick@logistics.ph', fb: 'fb.com/quicklogistics' },
    origin: 'Cebu City', destination: 'Davao City',
    originCoords: { lat: 10.3157, lng: 123.8854 }, destCoords: { lat: 7.0707, lng: 125.6087 },
    vehicleType: '10W Wing Van (12-15 tons)', capacity: 12, unit: 'tons', plateNo: 'QL 9012',
    askingPrice: 22000, description: 'RORO via Liloan-Lipata, experienced route',
    availableDate: '2026-01-28', departureTime: '4:00 AM', status: 'open', postedAt: '1 hour ago', bids: []
  },
];

// Theme Context
const ThemeContext = React.createContext();

export default function KargaMarketplace() {
  // Firebase Auth Context
  const {
    authUser,
    userProfile,
    shipperProfile,
    truckerProfile,
    brokerProfile,
    wallet: authWallet,
    currentRole,
    isBroker: authIsBroker,
    switchRole,
    logout
  } = useAuth();

  // Firebase Real-time Hooks
  const { listings: firebaseCargoListings, loading: cargoLoading } = useCargoListings({ status: 'open' });
  const { listings: firebaseTruckListings, loading: truckLoading } = useTruckListings({ status: 'open' });
  const { notifications: firebaseNotifications, unreadCount: firebaseUnreadCount } = useNotifications(authUser?.uid);
  const { balance: firebaseWalletBalance, transactions: firebaseWalletTransactions } = useWallet(authUser?.uid);
  const { activeShipments: firebaseActiveShipments } = useShipments(authUser?.uid);

  const [darkMode, setDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [activeMarket, setActiveMarket] = useState('cargo');
  const [expandedListing, setExpandedListing] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);

  // Use Firebase data with fallback to local state for demo
  const userRole = currentRole || 'shipper';
  const cargoListings = firebaseCargoListings.length > 0 ? firebaseCargoListings : sampleCargoListings;
  const truckListings = firebaseTruckListings.length > 0 ? firebaseTruckListings : sampleTruckListings;
  const activeShipments = firebaseActiveShipments.length > 0 ? firebaseActiveShipments : sampleActiveShipments;
  const notifications = firebaseNotifications.length > 0 ? firebaseNotifications : sampleNotifications;

  // User stats from profiles
  const userTransactions = shipperProfile?.totalTransactions || 0;
  const userRating = truckerProfile?.rating || 0;
  const userTrips = truckerProfile?.totalTrips || 0;

  // Wallet System - use Firebase with fallback
  const walletBalance = firebaseWalletBalance || 0;
  const walletTransactions = firebaseWalletTransactions.length > 0 ? firebaseWalletTransactions : [];
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [topUpMethod, setTopUpMethod] = useState('gcash');
  
  // Broker/Earnings System State - use Firebase data
  const [demoBroker, setDemoBroker] = useState(false);
  const isBroker = authIsBroker || !!brokerProfile || demoBroker;
  const [showEarningsModal, setShowEarningsModal] = useState(false);
  const [earningsTab, setEarningsTab] = useState('dashboard');
  const referralCode = brokerProfile?.referralCode || (demoBroker ? 'DEMO123' : '');
  const brokerTier = brokerProfile?.tier || 'STARTER';

  // Sample data for demo broker mode
  const sampleReferrals = [
    { id: 'R1', name: 'Juan Santos', type: 'shipper', transactions: 8, earnings: 2400, status: 'active', joinedDate: 'Jan 15' },
    { id: 'R2', name: 'Maria Garcia', type: 'trucker', transactions: 12, earnings: 3600, status: 'active', joinedDate: 'Jan 22' },
    { id: 'R3', name: 'Pedro Reyes', type: 'shipper', transactions: 3, earnings: 900, status: 'pending', joinedDate: 'Feb 1' },
  ];

  const sampleEarningsHistory = [
    { id: 'E1', date: '2025-02-01', type: 'commission', description: 'Commission from Juan Santos deal', amount: 450, status: 'completed' },
    { id: 'E2', date: '2025-01-28', type: 'commission', description: 'Commission from Maria Garcia deal', amount: 520, status: 'completed' },
    { id: 'E3', date: '2025-01-25', type: 'bonus', description: 'First referral bonus', amount: 50, status: 'completed' },
    { id: 'E4', date: '2025-01-20', type: 'payout', description: 'GCash Withdrawal', amount: -500, status: 'completed' },
  ];

  const referralEarnings = demoBroker ? {
    totalEarnings: 6900,
    pendingEarnings: 900,
    availableBalance: 2850,
    thisMonth: 1470,
    lastMonth: 2200,
    totalReferrals: 3,
    activeReferrals: 2,
    totalTransactions: 23,
  } : {
    totalEarnings: brokerProfile?.totalEarnings || 0,
    pendingEarnings: brokerProfile?.pendingEarnings || 0,
    availableBalance: brokerProfile?.availableBalance || 0,
    thisMonth: 0,
    lastMonth: 0,
    totalReferrals: brokerProfile?.totalReferrals || 0,
    activeReferrals: 0,
    totalTransactions: brokerProfile?.totalTransactions || 0,
  };
  const [myReferrals, setMyReferrals] = useState([]);
  const [earningsHistory, setEarningsHistory] = useState([]);
  const [showPayoutRequestModal, setShowPayoutRequestModal] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutMethod, setPayoutMethod] = useState('gcash');

  // Register as broker - Firebase version
  const registerAsBroker = async () => {
    if (!authUser) return;
    const code = firestoreService.generateReferralCode(userRole);
    await firestoreService.createBrokerProfile(authUser.uid, code);
    setEarningsTab('dashboard');
  };

  // Demo: Activate broker with sample data (for demo mode without auth)
  const activateDemoBroker = () => {
    setDemoBroker(true);
    setMyReferrals(sampleReferrals);
    setEarningsHistory(sampleEarningsHistory);
    setEarningsTab('dashboard');
  };
  
  // Modals
  const [showPostModal, setShowPostModal] = useState(false);
  const [showBidModal, setShowBidModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [showContractModal, setShowContractModal] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showRouteOptimizer, setShowRouteOptimizer] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  // Profile Action Modals
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [editProfileData, setEditProfileData] = useState({
    name: '',
    email: '',
    businessName: '',
    facebookUrl: ''
  });
  const [editProfileLoading, setEditProfileLoading] = useState(false);
  
  const [selectedListing, setSelectedListing] = useState(null);
  const [selectedBid, setSelectedBid] = useState(null);
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [contractSigned, setContractSigned] = useState(false);
  
  // Form states
  const [bidAmount, setBidAmount] = useState('');
  const [bidMessage, setBidMessage] = useState('');
  const [bidCargoType, setBidCargoType] = useState('');
  const [bidCargoWeight, setBidCargoWeight] = useState('');
  const [chatInput, setChatInput] = useState('');
  
  const [newPost, setNewPost] = useState({
    origin: '', destination: '', askingPrice: '', description: '',
    weight: '', cargoType: '', vehicleNeeded: '', pickupDate: '',
    vehicleType: '', capacity: '', plateNo: '', availableDate: '', departureTime: '',
    photos: [] // Array of { id, url, caption }
  });

  // Route Optimizer State
  const [optimizerOrigin, setOptimizerOrigin] = useState('');
  const [optimizerDestination, setOptimizerDestination] = useState('');
  const [optimizedRoute, setOptimizedRoute] = useState(null);
  const [backloadMatches, setBackloadMatches] = useState([]);

  const cities = Object.keys(cityCoordinates);
  const vehicleTypes = [
    // Light Commercial Vehicles (LCV) - Up to 2 tons
    'Multicab (500kg-1ton)',
    'L300 FB Van (1 ton)',
    'H100/Porter (1-1.5 tons)',
    'Kia Bongo (1-1.5 tons)',
    'Toyota Hiace (1 ton)',
    'Hyundai Starex (1 ton)',
    
    // Light Trucks - 4 Wheeler (2-4 tons)
    '4W Closed Van (2-3 tons)',
    '4W Aluminum Van (2-3 tons)',
    '4W Elf/Canter (2-4 tons)',
    '4W Dropside (2-4 tons)',
    '4W Flatbed (2-4 tons)',
    '4W Refrigerated Van (2-3 tons)',
    
    // Medium Trucks - 6 Wheeler (4-7 tons)
    '6W Closed Van (4-6 tons)',
    '6W Aluminum Van (4-6 tons)',
    '6W Forward/Fighter (5-7 tons)',
    '6W Dropside (4-6 tons)',
    '6W Flatbed (4-6 tons)',
    '6W Dump Truck (5-7 tons)',
    '6W Refrigerated Van (4-6 tons)',
    '6W Tanker (5,000-8,000L)',
    
    // Heavy Trucks - 10 Wheeler (10-15 tons)
    '10W Wing Van (12-15 tons)',
    '10W Closed Van (12-15 tons)',
    '10W Aluminum Van (12-15 tons)',
    '10W Dropside (12-15 tons)',
    '10W Flatbed (12-15 tons)',
    '10W Dump Truck (12-15 tons)',
    '10W Refrigerated Van (12-15 tons)',
    '10W Tanker (10,000-15,000L)',
    '10W Boom Truck (10-12 tons)',
    '10W Car Carrier (4-6 cars)',
    
    // Extra Heavy - 12 Wheeler (15-20 tons)
    '12W Wing Van (15-20 tons)',
    '12W Flatbed (15-20 tons)',
    '12W Dump Truck (15-20 tons)',
    '12W Lowbed (15-20 tons)',
    
    // Trailer Trucks - Prime Mover + Trailer (20-40 tons)
    '10W Prime Mover + 40ft Container',
    '10W Prime Mover + 20ft Container',
    '12W Prime Mover + 40ft Container',
    '12W Prime Mover + 45ft Wing Van',
    '12W Prime Mover + Flatbed Trailer',
    '12W Prime Mover + Lowbed Trailer',
    '12W Prime Mover + Tanker Trailer',
    '12W Prime Mover + Car Carrier Trailer',
    '12W Prime Mover + Refrigerated Container',
  ];
  const cargoTypes = ['General Merchandise', 'Fruits & Vegetables', 'Frozen Goods', 'Construction Materials', 'Electronics', 'Furniture', 'Agricultural Products', 'Others'];

  // Theme classes
  const theme = {
    bg: darkMode ? 'bg-gray-950' : 'bg-gray-50',
    bgCard: darkMode ? 'bg-gray-900' : 'bg-white',
    bgSecondary: darkMode ? 'bg-gray-800' : 'bg-gray-100',
    bgTertiary: darkMode ? 'bg-gray-800/50' : 'bg-gray-50',
    text: darkMode ? 'text-white' : 'text-gray-900',
    textSecondary: darkMode ? 'text-gray-400' : 'text-gray-600',
    textMuted: darkMode ? 'text-gray-500' : 'text-gray-500',
    border: darkMode ? 'border-gray-800' : 'border-gray-200',
    borderLight: darkMode ? 'border-gray-700' : 'border-gray-100',
    input: darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900',
    hover: darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50',
  };

  // Get unread notification count - use Firebase count
  const unreadCount = firebaseUnreadCount || notifications.filter(n => !n.read && n.forRole === userRole).length;

  // Get notifications for current role
  const roleNotifications = firebaseNotifications.length > 0 ? firebaseNotifications : notifications.filter(n => n.forRole === userRole);

  // Mark notification as read - Firebase version
  const markAsRead = async (notificationId) => {
    if (authUser) {
      await firestoreService.markNotificationRead(authUser.uid, notificationId);
    }
  };

  // Mark all as read - Firebase version
  const markAllAsRead = async () => {
    if (authUser) {
      await firestoreService.markAllNotificationsRead(authUser.uid);
    }
  };

  // Get notification icon component
  const getNotificationIcon = (type) => {
    const iconMap = {
      NEW_BID: TrendingUp,
      BID_ACCEPTED: CheckCircle2,
      BID_REJECTED: X,
      NEW_MESSAGE: MessageSquare,
      NEW_CARGO: Package,
      NEW_TRUCK: Truck,
      CONTRACT_READY: FileText,
      SHIPMENT_UPDATE: MapPinned,
      RATING_REQUEST: Star,
    };
    return iconMap[type] || Bell;
  };

  // Notification Panel Component
  const NotificationPanel = () => {
    if (!showNotifications) return null;
    
    return (
      <>
        {/* Backdrop */}
        <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
        
        {/* Panel */}
        <div className={`absolute right-0 top-12 w-80 sm:w-96 ${theme.bgCard} rounded-2xl shadow-2xl border ${theme.border} z-50 overflow-hidden`}>
          {/* Header */}
          <div className={`p-4 border-b ${theme.borderLight} flex justify-between items-center`}>
            <div>
              <h3 className={`font-bold ${theme.text}`}>Notifications</h3>
              <p className={`text-xs ${theme.textMuted}`}>
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
              </p>
            </div>
            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead}
                className="text-xs text-amber-500 font-medium hover:text-amber-600"
              >
                Mark all read
              </button>
            )}
          </div>
          
          {/* Notification List */}
          <div className="max-h-96 overflow-y-auto">
            {roleNotifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell size={32} className={`mx-auto ${theme.textMuted} mb-2`} />
                <p className={theme.textMuted}>No notifications yet</p>
              </div>
            ) : (
              roleNotifications.map((notification) => {
                const IconComponent = getNotificationIcon(notification.type);
                const typeConfig = notificationTypes[notification.type];
                
                return (
                  <div 
                    key={notification.id}
                    onClick={() => {
                      markAsRead(notification.id);
                      setShowNotifications(false);
                      // Handle navigation based on action type
                      if (notification.actionType === 'track_shipment') {
                        setActiveTab('tracking');
                      }
                    }}
                    className={`p-4 border-b ${theme.borderLight} cursor-pointer transition ${
                      !notification.read 
                        ? (darkMode ? 'bg-amber-900/10' : 'bg-amber-50/50') 
                        : theme.hover
                    }`}
                  >
                    <div className="flex gap-3">
                      {/* Icon */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${darkMode ? typeConfig.bgDark : typeConfig.bgLight}`}>
                        <IconComponent size={18} className={typeConfig.color} />
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <p className={`font-semibold text-sm ${theme.text} ${!notification.read ? '' : 'font-normal'}`}>
                            {notification.title}
                          </p>
                          {!notification.read && (
                            <span className="w-2 h-2 bg-amber-500 rounded-full flex-shrink-0 mt-1.5"></span>
                          )}
                        </div>
                        <p className={`text-sm ${theme.textSecondary} line-clamp-2`}>{notification.message}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs ${theme.textMuted}`}>{notification.route}</span>
                          {notification.amount && (
                            <span className="text-xs font-semibold text-amber-500">₱{notification.amount.toLocaleString()}</span>
                          )}
                        </div>
                        <p className={`text-xs ${theme.textMuted} mt-1`}>{notification.time}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          
          {/* Footer */}
          <div className={`p-3 border-t ${theme.borderLight} text-center`}>
            <button 
              onClick={() => { setShowNotifications(false); setActiveTab('notifications'); }}
              className="text-sm text-amber-500 font-medium hover:text-amber-600"
            >
              View All Notifications
            </button>
          </div>
        </div>
      </>
    );
  };

  // Photo Gallery Component
  const PhotoGallery = ({ photos, onViewPhoto }) => {
    if (!photos || photos.length === 0) return null;
    
    return (
      <div className="mt-3">
        <p className={`text-xs ${theme.textMuted} mb-2 flex items-center gap-1`}>
          <Camera size={12} /> {photos.length} Photo{photos.length > 1 ? 's' : ''}
        </p>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {photos.map((photo, idx) => (
            <div 
              key={photo.id} 
              onClick={() => onViewPhoto(idx)}
              className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden cursor-pointer group border border-gray-200 dark:border-gray-700"
            >
              <img src={photo.url} alt={photo.caption} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                <Maximize2 size={16} className="text-white" />
              </div>
              {idx === 0 && photos.length > 1 && (
                <div className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                  +{photos.length - 1}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Photo Viewer Modal
  const PhotoViewerModal = ({ photos, initialIndex, onClose }) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const photo = photos[currentIndex];
    
    return (
      <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
        <div className="flex justify-between items-center p-4">
          <p className="text-white font-medium">{currentIndex + 1} / {photos.length}</p>
          <button onClick={onClose} className="text-white p-2"><X size={24} /></button>
        </div>
        
        <div className="flex-1 flex items-center justify-center p-4">
          <img src={photo.url} alt={photo.caption} className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
        
        <div className="p-4 text-center">
          {photo.caption && <p className="text-white mb-4">{photo.caption}</p>}
          <div className="flex justify-center gap-2">
            {photos.map((_, idx) => (
              <button 
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`w-2 h-2 rounded-full transition ${idx === currentIndex ? 'bg-amber-500' : 'bg-white/50'}`}
              />
            ))}
          </div>
        </div>
        
        {photos.length > 1 && (
          <>
            <button 
              onClick={() => setCurrentIndex((currentIndex - 1 + photos.length) % photos.length)}
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 text-white p-3 rounded-full"
            >
              ←
            </button>
            <button 
              onClick={() => setCurrentIndex((currentIndex + 1) % photos.length)}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 text-white p-3 rounded-full"
            >
              →
            </button>
          </>
        )}
      </div>
    );
  };

  // Photo Upload Component
  const PhotoUploader = ({ photos, onPhotosChange, maxPhotos = 5 }) => {
    const fileInputRef = React.useRef(null);

    const handleFileSelect = (e) => {
      const files = Array.from(e.target.files);
      const remainingSlots = maxPhotos - photos.length;
      const filesToProcess = files.slice(0, remainingSlots);

      const newPhotos = [...photos];

      let processed = 0;
      filesToProcess.forEach(file => {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const newPhoto = {
              id: `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              url: event.target.result,
              caption: file.name,
              file: file
            };
            newPhotos.push(newPhoto);
            processed++;
            // Only update when all files are processed
            if (processed === filesToProcess.length) {
              onPhotosChange(newPhotos);
            }
          };
          reader.readAsDataURL(file);
        } else {
          processed++;
        }
      });

      // Reset input so same file can be selected again
      e.target.value = '';
    };

    const handleRemovePhoto = (photoId) => {
      onPhotosChange(photos.filter(p => p.id !== photoId));
    };

    return (
      <div>
        <label className={`block text-sm ${theme.textSecondary} mb-2 font-medium flex items-center gap-1`}>
          <Camera size={14} /> Cargo Photos ({photos.length}/{maxPhotos})
        </label>
        <div className="flex gap-2 flex-wrap">
          {photos.map(photo => (
            <div key={photo.id} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
              <img src={photo.url} alt={photo.caption} className="w-full h-full object-cover" />
              <button
                onClick={() => handleRemovePhoto(photo.id)}
                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full"
              >
                <X size={12} />
              </button>
            </div>
          ))}
          {photos.length < maxPhotos && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`w-20 h-20 rounded-lg border-2 border-dashed ${theme.border} flex flex-col items-center justify-center gap-1 ${theme.textMuted} hover:border-amber-500 hover:text-amber-500 transition`}
              >
                <Upload size={20} />
                <span className="text-xs">Add</span>
              </button>
            </>
          )}
        </div>
        <p className={`text-xs ${theme.textMuted} mt-1`}>Add photos to help truckers see your cargo</p>
      </div>
    );
  };

  // Route Optimizer Component
  const RouteOptimizerModal = () => {
    const runOptimization = () => {
      if (!optimizerOrigin || !optimizerDestination) return;
      
      const originCoords = getCoordinates(optimizerOrigin);
      const destCoords = getCoordinates(optimizerDestination);
      
      // Find backload matches
      const matches = findBackloadMatches(optimizerOrigin, optimizerDestination, cargoListings);
      setBackloadMatches(matches);
      
      // Create waypoints including matched cargo pickups/dropoffs
      const waypoints = [
        { name: optimizerOrigin, ...originCoords, type: 'origin' },
        ...matches.slice(0, 3).flatMap(m => [
          { name: `Pickup: ${m.origin}`, ...getCoordinates(m.origin), type: 'pickup', cargo: m },
          { name: `Dropoff: ${m.destination}`, ...getCoordinates(m.destination), type: 'dropoff', cargo: m }
        ]),
        { name: optimizerDestination, ...destCoords, type: 'destination' }
      ];
      
      const result = optimizeRoute(waypoints);
      const fuelSaved = calculateFuelSavings(result.savings);
      
      setOptimizedRoute({
        ...result,
        fuelSavings: fuelSaved,
        duration: estimateDuration(result.totalDistance),
        waypoints: result.route
      });
    };

    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className={`${theme.bgCard} rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl`}>
          <div className={`sticky top-0 ${theme.bgCard} p-4 border-b ${theme.borderLight} flex justify-between items-center`}>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl flex items-center justify-center">
                <Waypoints size={20} className="text-white" />
              </div>
              <div>
                <h2 className={`text-lg font-bold ${theme.text}`}>Route Optimizer</h2>
                <p className={`text-xs ${theme.textMuted}`}>Find backloads & save fuel</p>
              </div>
            </div>
            <button onClick={() => setShowRouteOptimizer(false)} className={`${theme.bgSecondary} p-2 rounded-full`}>
              <X size={20} className={theme.textSecondary} />
            </button>
          </div>
          
          <div className="p-4 space-y-4">
            {/* Input Fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block text-sm ${theme.textSecondary} mb-1 font-medium`}>From</label>
                <select 
                  value={optimizerOrigin} 
                  onChange={e => setOptimizerOrigin(e.target.value)} 
                  className={`w-full ${theme.input} border rounded-xl px-3 py-2.5`}
                >
                  <option value="">Select origin...</option>
                  {cities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={`block text-sm ${theme.textSecondary} mb-1 font-medium`}>To</label>
                <select 
                  value={optimizerDestination} 
                  onChange={e => setOptimizerDestination(e.target.value)} 
                  className={`w-full ${theme.input} border rounded-xl px-3 py-2.5`}
                >
                  <option value="">Select destination...</option>
                  {cities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            
            <button 
              onClick={runOptimization}
              disabled={!optimizerOrigin || !optimizerDestination}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white py-3 rounded-xl font-bold shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <RotateCcw size={18} /> Optimize Route
            </button>
            
            {/* Results */}
            {optimizedRoute && (
              <div className="space-y-4">
                {/* Stats Cards */}
                <div className="grid grid-cols-3 gap-2">
                  <div className={`${theme.bgSecondary} rounded-xl p-3 text-center`}>
                    <Route size={20} className="mx-auto text-blue-500 mb-1" />
                    <p className="text-lg font-bold text-blue-500">{optimizedRoute.totalDistance} km</p>
                    <p className={`text-xs ${theme.textMuted}`}>Total</p>
                  </div>
                  <div className={`${theme.bgSecondary} rounded-xl p-3 text-center`}>
                    <Clock size={20} className="mx-auto text-purple-500 mb-1" />
                    <p className="text-lg font-bold text-purple-500">{optimizedRoute.duration}</p>
                    <p className={`text-xs ${theme.textMuted}`}>Est. Time</p>
                  </div>
                  <div className={`${darkMode ? 'bg-green-900/30' : 'bg-green-50'} rounded-xl p-3 text-center`}>
                    <Fuel size={20} className="mx-auto text-green-500 mb-1" />
                    <p className="text-lg font-bold text-green-500">₱{optimizedRoute.fuelSavings}</p>
                    <p className={`text-xs ${theme.textMuted}`}>Fuel Saved</p>
                  </div>
                </div>
                
                {/* Savings Banner */}
                {optimizedRoute.savingsPercent > 0 && (
                  <div className={`${darkMode ? 'bg-amber-900/20 border-amber-800' : 'bg-amber-50 border-amber-200'} border rounded-xl p-3 flex items-center gap-3`}>
                    <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center">
                      <TrendingDown size={24} className="text-white" />
                    </div>
                    <div>
                      <p className={`font-bold ${darkMode ? 'text-amber-400' : 'text-amber-700'}`}>
                        {optimizedRoute.savingsPercent}% Route Optimized!
                      </p>
                      <p className={`text-sm ${theme.textMuted}`}>
                        Saved {optimizedRoute.savings} km vs direct route
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Optimized Route Visualization */}
                <div className={`${theme.bgSecondary} rounded-xl p-4`}>
                  <p className={`font-semibold ${theme.text} mb-3 flex items-center gap-2`}>
                    <GitBranch size={16} className="text-amber-500" /> Optimized Stops
                  </p>
                  <div className="space-y-2">
                    {optimizedRoute.waypoints.map((wp, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                          wp.type === 'origin' ? 'bg-green-500' :
                          wp.type === 'destination' ? 'bg-red-500' :
                          wp.type === 'pickup' ? 'bg-blue-500' : 'bg-purple-500'
                        }`}>
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <p className={`font-medium ${theme.text}`}>{wp.name}</p>
                          {wp.cargo && (
                            <p className={`text-xs ${theme.textMuted}`}>
                              {wp.cargo.cargoType} • {wp.cargo.weight} tons • ₱{wp.cargo.askingPrice.toLocaleString()}
                            </p>
                          )}
                        </div>
                        {idx < optimizedRoute.waypoints.length - 1 && (
                          <div className={`text-xs ${theme.textMuted}`}>
                            {calculateDistance(wp.lat, wp.lng, optimizedRoute.waypoints[idx+1].lat, optimizedRoute.waypoints[idx+1].lng)} km
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Backload Matches */}
                {backloadMatches.length > 0 && (
                  <div>
                    <p className={`font-semibold ${theme.text} mb-3 flex items-center gap-2`}>
                      <Package size={16} className="text-blue-500" /> Available Backloads ({backloadMatches.length})
                    </p>
                    <div className="space-y-2">
                      {backloadMatches.map(match => (
                        <div key={match.id} className={`${theme.bgCard} border ${theme.border} rounded-xl p-3`}>
                          <div className="flex justify-between items-start">
                            <div>
                              <p className={`font-medium ${theme.text}`}>{match.origin} → {match.destination}</p>
                              <p className={`text-sm ${theme.textMuted}`}>{match.cargoType} • {match.weight} tons</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-xs px-2 py-0.5 rounded-full ${darkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'}`}>
                                  {match.matchScore}% match
                                </span>
                                <span className={`text-xs ${theme.textMuted}`}>+{match.detourKm} km detour</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-amber-500">₱{match.askingPrice.toLocaleString()}</p>
                              <button 
                                onClick={() => {
                                  setShowRouteOptimizer(false);
                                  setSelectedListing(match);
                                  setShowBidModal(true);
                                }}
                                className="text-xs text-blue-500 font-medium mt-1"
                              >
                                Bid Now →
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Empty State */}
            {!optimizedRoute && (
              <div className={`${theme.bgSecondary} rounded-xl p-8 text-center`}>
                <Waypoints size={48} className={`mx-auto ${theme.textMuted} mb-3`} />
                <p className={theme.textMuted}>Select origin and destination to find optimal routes with backload opportunities</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Wallet Modal Component
  const WalletModal = () => {
    const pendingFees = walletTransactions.filter(t => t.type === 'fee' && t.status === 'pending').reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const availableBalance = walletBalance - pendingFees;
    
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className={`${theme.bgCard} rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl`}>
          <div className={`sticky top-0 ${theme.bgCard} p-4 border-b ${theme.borderLight} flex justify-between items-center`}>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl flex items-center justify-center">
                <PesoIcon size={20} className="text-white" />
              </div>
              <div>
                <h2 className={`text-lg font-bold ${theme.text}`}>My Wallet</h2>
                <p className={`text-xs ${theme.textMuted}`}>Trucker Wallet System</p>
              </div>
            </div>
            <button onClick={() => setShowWalletModal(false)} className={`${theme.bgSecondary} p-2 rounded-full`}>
              <X size={20} className={theme.textSecondary} />
            </button>
          </div>
          
          <div className="p-4 space-y-4">
            {/* Balance Card */}
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-5 text-white">
              <p className="text-green-100 text-sm">Available Balance</p>
              <p className="text-4xl font-bold mt-1">₱{walletBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
              {pendingFees > 0 && (
                <p className="text-green-200 text-xs mt-2">₱{pendingFees.toFixed(2)} pending fees</p>
              )}
              <div className="flex gap-2 mt-4">
                <button 
                  onClick={() => { setShowWalletModal(false); setShowTopUpModal(true); }}
                  className="flex-1 bg-white/20 hover:bg-white/30 py-2 rounded-xl font-medium text-sm backdrop-blur transition"
                >
                  + Top Up
                </button>
                <button className="flex-1 bg-white/20 hover:bg-white/30 py-2 rounded-xl font-medium text-sm backdrop-blur transition">
                  Withdraw
                </button>
              </div>
            </div>
            
            {/* Minimum Balance Warning */}
            {walletBalance < MINIMUM_WALLET_BALANCE && (
              <div className={`${darkMode ? 'bg-red-900/30 border-red-800' : 'bg-red-50 border-red-200'} border rounded-xl p-3 flex items-start gap-3`}>
                <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <X size={16} className="text-white" />
                </div>
                <div>
                  <p className={`font-semibold ${darkMode ? 'text-red-400' : 'text-red-700'}`}>Low Balance!</p>
                  <p className={`text-sm ${darkMode ? 'text-red-300' : 'text-red-600'}`}>
                    Minimum ₱{MINIMUM_WALLET_BALANCE} required to accept jobs. Top up now to continue.
                  </p>
                </div>
              </div>
            )}
            
            {/* How It Works */}
            <div className={`${theme.bgSecondary} rounded-xl p-4`}>
              <p className={`font-semibold ${theme.text} mb-3`}>💡 How Platform Fees Work</p>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-amber-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                  <p className={theme.textSecondary}>You accept a job worth ₱18,000</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-amber-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                  <p className={theme.textSecondary}>Platform fee (3%) = ₱540 is held from wallet</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-amber-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                  <p className={theme.textSecondary}>You deliver & collect ₱18,000 cash from shipper</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">✓</span>
                  <p className={theme.textSecondary}>Fee confirmed, you keep ₱17,460 net earnings!</p>
                </div>
              </div>
            </div>
            
            {/* Transaction History */}
            <div>
              <p className={`font-semibold ${theme.text} mb-3`}>Recent Transactions</p>
              <div className="space-y-2">
                {walletTransactions.map(tx => (
                  <div key={tx.id} className={`${theme.bgSecondary} rounded-xl p-3 flex justify-between items-center`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        tx.type === 'topup' 
                          ? (darkMode ? 'bg-green-900/50' : 'bg-green-100') 
                          : (darkMode ? 'bg-red-900/50' : 'bg-red-100')
                      }`}>
                        {tx.type === 'topup' ? (
                          <TrendingUp size={18} className="text-green-500" />
                        ) : (
                          <TrendingDown size={18} className="text-red-500" />
                        )}
                      </div>
                      <div>
                        <p className={`font-medium ${theme.text}`}>
                          {tx.type === 'topup' ? `Top Up via ${tx.method}` : tx.description}
                        </p>
                        <p className={`text-xs ${theme.textMuted}`}>{tx.date}</p>
                      </div>
                    </div>
                    <p className={`font-bold ${tx.amount > 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {tx.amount > 0 ? '+' : ''}₱{Math.abs(tx.amount).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Top Up Modal Component
  const TopUpModal = () => {
    const [step, setStep] = useState(1); // 1: Select amount, 2: Select method, 3: Processing, 4: Success
    const [processing, setProcessing] = useState(false);
    
    const quickAmounts = [500, 1000, 2000, 5000];
    const selectedMethod = paymentMethods[topUpMethod];
    const totalAmount = parseFloat(topUpAmount || 0) + (selectedMethod?.fee || 0);
    
    const handleTopUp = async () => {
      if (!topUpAmount || parseFloat(topUpAmount) < 100 || !authUser) return;

      setProcessing(true);
      setStep(3);

      try {
        const amount = parseFloat(topUpAmount);
        const reference = `${topUpMethod.toUpperCase()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;

        // Use Firebase to update wallet
        await firestoreService.topUpWallet(authUser.uid, amount, selectedMethod.name, reference);

        setProcessing(false);
        setStep(4);
      } catch (error) {
        console.error('Top up error:', error);
        alert('Failed to process top up. Please try again.');
        setProcessing(false);
        setStep(1);
      }
    };
    
    const resetAndClose = () => {
      setShowTopUpModal(false);
      setTopUpAmount('');
      setTopUpMethod('gcash');
      setStep(1);
    };
    
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className={`${theme.bgCard} rounded-2xl w-full max-w-md shadow-2xl`}>
          <div className={`p-4 border-b ${theme.borderLight} flex justify-between items-center`}>
            <h2 className={`text-xl font-bold ${theme.text}`}>
              {step === 1 && '💰 Top Up Wallet'}
              {step === 2 && '💳 Select Payment'}
              {step === 3 && '⏳ Processing...'}
              {step === 4 && '✅ Success!'}
            </h2>
            <button onClick={resetAndClose} className={`${theme.bgSecondary} p-2 rounded-full`}>
              <X size={20} className={theme.textSecondary} />
            </button>
          </div>
          
          <div className="p-4">
            {/* Step 1: Select Amount */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className={`block text-sm ${theme.textSecondary} mb-2 font-medium`}>Enter Amount</label>
                  <div className="relative">
                    <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold ${theme.textMuted}`}>₱</span>
                    <input 
                      type="number" 
                      value={topUpAmount} 
                      onChange={e => setTopUpAmount(e.target.value)}
                      placeholder="0.00"
                      className={`w-full ${theme.input} border rounded-xl pl-12 pr-4 py-4 text-2xl font-bold text-right`}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-4 gap-2">
                  {quickAmounts.map(amt => (
                    <button 
                      key={amt}
                      onClick={() => setTopUpAmount(amt.toString())}
                      className={`py-2 rounded-xl font-medium text-sm transition ${
                        topUpAmount === amt.toString()
                          ? 'bg-amber-500 text-white'
                          : `${theme.bgSecondary} ${theme.textSecondary} hover:bg-amber-100 dark:hover:bg-amber-900/30`
                      }`}
                    >
                      ₱{amt.toLocaleString()}
                    </button>
                  ))}
                </div>
                
                <p className={`text-xs ${theme.textMuted} text-center`}>Minimum top-up: ₱100</p>
                
                <button 
                  onClick={() => setStep(2)}
                  disabled={!topUpAmount || parseFloat(topUpAmount) < 100}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white py-3 rounded-xl font-bold shadow-lg disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            )}
            
            {/* Step 2: Select Payment Method */}
            {step === 2 && (
              <div className="space-y-4">
                <div className={`${darkMode ? 'bg-amber-900/20' : 'bg-amber-50'} rounded-xl p-4 text-center`}>
                  <p className={`text-sm ${theme.textMuted}`}>Amount to Top Up</p>
                  <p className="text-3xl font-bold text-amber-500">₱{parseFloat(topUpAmount).toLocaleString()}</p>
                </div>
                
                <p className={`font-medium ${theme.text}`}>Select Payment Method</p>
                
                <div className="space-y-2">
                  {Object.entries(paymentMethods).map(([key, method]) => (
                    <button
                      key={key}
                      onClick={() => setTopUpMethod(key)}
                      className={`w-full p-4 rounded-xl border-2 flex items-center justify-between transition ${
                        topUpMethod === key
                          ? 'border-amber-500 bg-amber-500/10'
                          : `${theme.border} ${theme.bgSecondary}`
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{method.icon}</span>
                        <div className="text-left">
                          <p className={`font-medium ${theme.text}`}>{method.name}</p>
                          {method.fee > 0 && <p className={`text-xs ${theme.textMuted}`}>+₱{method.fee} fee</p>}
                        </div>
                      </div>
                      {topUpMethod === key && (
                        <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center">
                          <Check size={14} className="text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                
                {selectedMethod?.fee > 0 && (
                  <div className={`${theme.bgSecondary} rounded-xl p-3 flex justify-between`}>
                    <span className={theme.textSecondary}>Total to Pay</span>
                    <span className={`font-bold ${theme.text}`}>₱{totalAmount.toLocaleString()}</span>
                  </div>
                )}
                
                <div className="flex gap-2">
                  <button 
                    onClick={() => setStep(1)}
                    className={`flex-1 ${theme.bgSecondary} ${theme.text} py-3 rounded-xl font-medium`}
                  >
                    Back
                  </button>
                  <button 
                    onClick={handleTopUp}
                    className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white py-3 rounded-xl font-bold shadow-lg"
                  >
                    Pay ₱{totalAmount.toLocaleString()}
                  </button>
                </div>
              </div>
            )}
            
            {/* Step 3: Processing */}
            {step === 3 && (
              <div className="py-12 text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center animate-pulse">
                  <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <p className={`text-lg font-semibold ${theme.text}`}>Processing Payment...</p>
                <p className={`text-sm ${theme.textMuted} mt-2`}>Please wait while we confirm your payment</p>
              </div>
            )}
            
            {/* Step 4: Success */}
            {step === 4 && (
              <div className="py-8 text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Check size={40} className="text-green-500" />
                </div>
                <p className={`text-xl font-bold ${theme.text}`}>Top Up Successful!</p>
                <p className={`text-sm ${theme.textMuted} mt-2`}>₱{parseFloat(topUpAmount).toLocaleString()} has been added to your wallet</p>
                
                <div className={`${theme.bgSecondary} rounded-xl p-4 mt-6`}>
                  <p className={`text-sm ${theme.textMuted}`}>New Balance</p>
                  <p className="text-3xl font-bold text-green-500">₱{walletBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                </div>
                
                <button 
                  onClick={resetAndClose}
                  className="w-full mt-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white py-3 rounded-xl font-bold shadow-lg"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Earnings/Broker Modal Component
  const EarningsModal = () => {
    const currentTier = brokerTiers[brokerTier] || brokerTiers.STARTER;
    const TierIcon = currentTier.icon;
    
    const copyReferralLink = () => {
      const link = `https://karga.ph/r/${referralCode}`;
      navigator.clipboard?.writeText(link);
      alert('Referral link copied to clipboard!');
    };
    
    const shareToSocial = (platform) => {
      const link = `https://karga.ph/r/${referralCode}`;
      const text = `Join KARGA CONNECT - the two-way trucking marketplace! Use my referral code ${referralCode}. ${link}`;
      const urls = {
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`,
        messenger: `fb-messenger://share/?link=${encodeURIComponent(link)}`,
        viber: `viber://forward?text=${encodeURIComponent(text)}`,
      };
      window.open(urls[platform], '_blank');
    };
    
    const handlePayoutRequest = () => {
      const amount = parseFloat(payoutAmount);
      if (!amount || amount < 500 || amount > referralEarnings.availableBalance) return;
      
      setReferralEarnings(prev => ({
        ...prev,
        availableBalance: prev.availableBalance - amount,
        pendingEarnings: prev.pendingEarnings + amount,
      }));
      setEarningsHistory(prev => [{
        id: `E${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        type: 'payout',
        description: `${paymentMethods[payoutMethod]?.name || 'GCash'} Withdrawal`,
        amount: -amount,
        status: 'processing'
      }, ...prev]);
      setPayoutAmount('');
      setShowPayoutRequestModal(false);
      alert('Payout request submitted! You will receive your funds within 24-48 hours.');
    };
    
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className={`${theme.bgCard} rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden shadow-2xl flex flex-col`}>
          {/* Header */}
          <div className={`p-4 border-b ${theme.borderLight} flex justify-between items-center flex-shrink-0`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl flex items-center justify-center">
                <PesoIcon size={20} className="text-white" />
              </div>
              <div>
                <h2 className={`text-lg font-bold ${theme.text}`}>Earnings</h2>
                <p className={`text-xs ${theme.textMuted}`}>{isBroker ? 'Broker Dashboard' : 'Become a Partner'}</p>
              </div>
            </div>
            <button onClick={() => setShowEarningsModal(false)} className={`${theme.bgSecondary} p-2 rounded-full`}>
              <X size={20} className={theme.textSecondary} />
            </button>
          </div>
          
          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {!isBroker ? (
              /* Registration/Onboarding Screen */
              <div className="p-4 space-y-4">
                {/* Hero Section */}
                <div className="text-center py-4">
                  <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center">
                    <Users size={36} className="text-white" />
                  </div>
                  <h3 className={`text-2xl font-bold ${theme.text}`}>Earn as a KARGA Partner!</h3>
                  <p className={`${theme.textMuted} mt-2`}>Refer shippers & truckers, earn commission on every deal</p>
                </div>
                
                {/* Commission Highlights */}
                <div className="grid grid-cols-3 gap-2">
                  <div className={`${darkMode ? 'bg-green-900/30' : 'bg-green-50'} rounded-xl p-3 text-center`}>
                    <p className="text-2xl font-bold text-green-500">3-6%</p>
                    <p className={`text-xs ${theme.textMuted}`}>Commission</p>
                  </div>
                  <div className={`${darkMode ? 'bg-amber-900/30' : 'bg-amber-50'} rounded-xl p-3 text-center`}>
                    <p className="text-2xl font-bold text-amber-500">₱50</p>
                    <p className={`text-xs ${theme.textMuted}`}>Per Signup</p>
                  </div>
                  <div className={`${darkMode ? 'bg-purple-900/30' : 'bg-purple-50'} rounded-xl p-3 text-center`}>
                    <p className="text-2xl font-bold text-purple-500">∞</p>
                    <p className={`text-xs ${theme.textMuted}`}>Lifetime</p>
                  </div>
                </div>
                
                {/* How It Works */}
                <div className={`${theme.bgSecondary} rounded-xl p-4`}>
                  <p className={`font-semibold ${theme.text} mb-3`}>💡 How It Works</p>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 bg-amber-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">1</div>
                      <div>
                        <p className={`font-medium ${theme.text}`}>Register as Partner</p>
                        <p className={`text-sm ${theme.textMuted}`}>Get your unique referral code instantly</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 bg-amber-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">2</div>
                      <div>
                        <p className={`font-medium ${theme.text}`}>Share Your Code</p>
                        <p className={`text-sm ${theme.textMuted}`}>Invite shippers and truckers to join KARGA</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 bg-amber-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">3</div>
                      <div>
                        <p className={`font-medium ${theme.text}`}>Earn Commission</p>
                        <p className={`text-sm ${theme.textMuted}`}>Get 3-6% on every transaction they make</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">✓</div>
                      <div>
                        <p className={`font-medium ${theme.text}`}>Withdraw Anytime</p>
                        <p className={`text-sm ${theme.textMuted}`}>Cash out via GCash, Maya, or bank transfer</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Example Earnings */}
                <div className={`${darkMode ? 'bg-amber-900/20 border-amber-800' : 'bg-amber-50 border-amber-200'} border rounded-xl p-4`}>
                  <p className={`font-semibold ${darkMode ? 'text-amber-400' : 'text-amber-700'} mb-2`}>📈 Example Monthly Earnings</p>
                  <div className={`text-sm ${theme.textSecondary} space-y-1`}>
                    <p>• 5 referrals × 4 deals each × ₱15,000 avg × 3%</p>
                    <p className="text-xl font-bold text-green-500 mt-2">= ₱9,000/month!</p>
                  </div>
                </div>
                
                {/* Tier Preview */}
                <div className={`${theme.bgSecondary} rounded-xl p-4`}>
                  <p className={`font-semibold ${theme.text} mb-3`}>🏆 Partner Tiers</p>
                  <div className="space-y-2 text-sm">
                    {Object.entries(brokerTiers).map(([key, tier]) => (
                      <div key={key} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <tier.icon size={16} className={tier.color} />
                          <span className={theme.text}>{tier.name}</span>
                        </div>
                        <span className={theme.textMuted}>{tier.rate}% commission</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Registration Buttons */}
                <button 
                  onClick={registerAsBroker}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white py-4 rounded-xl font-bold shadow-lg text-lg"
                >
                  🚀 Become a Partner - FREE!
                </button>
                
                <button 
                  onClick={activateDemoBroker}
                  className={`w-full ${theme.bgSecondary} ${theme.text} py-3 rounded-xl font-medium text-sm`}
                >
                  View Demo Dashboard →
                </button>
              </div>
            ) : (
              /* Broker Dashboard */
              <div>
                {/* Tab Navigation */}
                <div className={`flex gap-1 p-2 ${theme.bgSecondary} overflow-x-auto flex-shrink-0`}>
                  {[
                    { id: 'dashboard', label: '📊', title: 'Dashboard' },
                    { id: 'referrals', label: '👥', title: 'Referrals' },
                    { id: 'history', label: '📋', title: 'History' },
                    { id: 'payout', label: '💸', title: 'Payout' },
                    { id: 'howto', label: '📚', title: 'Learn' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setEarningsTab(tab.id)}
                      className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium transition flex flex-col items-center gap-1 ${
                        earningsTab === tab.id
                          ? 'bg-green-500 text-white'
                          : `${theme.textMuted}`
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span className="text-[10px]">{tab.title}</span>
                    </button>
                  ))}
                </div>
                
                <div className="p-4">
                  {/* Dashboard Tab */}
                  {earningsTab === 'dashboard' && (
                    <div className="space-y-4">
                      {/* Balance Card */}
                      <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-5 text-white">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-green-100 text-sm">Available Balance</p>
                            <p className="text-3xl font-bold">₱{referralEarnings.availableBalance.toLocaleString()}</p>
                            {referralEarnings.pendingEarnings > 0 && (
                              <p className="text-green-200 text-xs mt-1">+₱{referralEarnings.pendingEarnings.toLocaleString()} pending</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 px-2 py-1 bg-white/20 rounded-full">
                            <TierIcon size={14} />
                            <span className="text-xs font-medium">{currentTier.name}</span>
                          </div>
                        </div>
                        <button 
                          onClick={() => setEarningsTab('payout')}
                          className="mt-4 w-full bg-white/20 hover:bg-white/30 py-2 rounded-xl font-medium text-sm transition"
                        >
                          Withdraw Funds
                        </button>
                      </div>
                      
                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className={`${theme.bgSecondary} rounded-xl p-3`}>
                          <p className={`text-xs ${theme.textMuted}`}>This Month</p>
                          <p className="text-xl font-bold text-green-500">₱{referralEarnings.thisMonth.toLocaleString()}</p>
                        </div>
                        <div className={`${theme.bgSecondary} rounded-xl p-3`}>
                          <p className={`text-xs ${theme.textMuted}`}>Total Earned</p>
                          <p className={`text-xl font-bold ${theme.text}`}>₱{referralEarnings.totalEarnings.toLocaleString()}</p>
                        </div>
                        <div className={`${theme.bgSecondary} rounded-xl p-3`}>
                          <p className={`text-xs ${theme.textMuted}`}>Active Referrals</p>
                          <p className={`text-xl font-bold ${theme.text}`}>{referralEarnings.activeReferrals}</p>
                        </div>
                        <div className={`${theme.bgSecondary} rounded-xl p-3`}>
                          <p className={`text-xs ${theme.textMuted}`}>Total Deals</p>
                          <p className={`text-xl font-bold ${theme.text}`}>{referralEarnings.totalTransactions}</p>
                        </div>
                      </div>
                      
                      {/* Referral Code Card */}
                      <div className={`${theme.bgSecondary} rounded-xl p-4`}>
                        <p className={`font-semibold ${theme.text} mb-3`}>🔗 Your Referral Code</p>
                        <div className={`${theme.bgCard} border-2 border-dashed ${theme.border} rounded-xl p-4 text-center mb-3`}>
                          <p className="text-3xl font-bold tracking-widest text-green-500">{referralCode}</p>
                          <p className={`text-xs ${theme.textMuted} mt-1`}>karga.ph/r/{referralCode}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button 
                            onClick={copyReferralLink}
                            className={`${theme.bgCard} border ${theme.border} py-2.5 rounded-xl text-sm font-medium ${theme.text} flex items-center justify-center gap-2`}
                          >
                            📋 Copy Link
                          </button>
                          <button 
                            onClick={() => shareToSocial('facebook')}
                            className="bg-blue-600 text-white py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
                          >
                            📱 Share
                          </button>
                        </div>
                      </div>
                      
                      {/* Share Buttons */}
                      <div className={`${theme.bgSecondary} rounded-xl p-4`}>
                        <p className={`font-semibold ${theme.text} mb-3`}>📢 Share via</p>
                        <div className="grid grid-cols-3 gap-2">
                          <button onClick={() => shareToSocial('facebook')} className="bg-blue-600 text-white py-3 rounded-xl text-sm font-medium">Facebook</button>
                          <button onClick={() => shareToSocial('messenger')} className="bg-gradient-to-r from-blue-500 to-purple-500 text-white py-3 rounded-xl text-sm font-medium">Messenger</button>
                          <button onClick={() => shareToSocial('viber')} className="bg-purple-600 text-white py-3 rounded-xl text-sm font-medium">Viber</button>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Referrals Tab */}
                  {earningsTab === 'referrals' && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <p className={`font-semibold ${theme.text}`}>👥 My Referrals</p>
                        <span className={`text-sm ${theme.textMuted}`}>{myReferrals.length} total</span>
                      </div>
                      
                      {myReferrals.length === 0 ? (
                        <div className={`${theme.bgSecondary} rounded-xl p-8 text-center`}>
                          <Users size={48} className={`mx-auto ${theme.textMuted} mb-3`} />
                          <p className={`font-medium ${theme.text}`}>No referrals yet</p>
                          <p className={`text-sm ${theme.textMuted} mt-1`}>Share your code to start earning!</p>
                          <button 
                            onClick={copyReferralLink}
                            className="mt-4 bg-green-500 text-white px-6 py-2 rounded-xl font-medium"
                          >
                            Share Referral Link
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {myReferrals.map(ref => (
                            <div key={ref.id} className={`${theme.bgSecondary} rounded-xl p-3`}>
                              <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                    ref.type === 'shipper' 
                                      ? (darkMode ? 'bg-blue-900/50' : 'bg-blue-100')
                                      : (darkMode ? 'bg-purple-900/50' : 'bg-purple-100')
                                  }`}>
                                    {ref.type === 'shipper' 
                                      ? <Package size={18} className="text-blue-500" />
                                      : <Truck size={18} className="text-purple-500" />
                                    }
                                  </div>
                                  <div>
                                    <p className={`font-medium ${theme.text}`}>{ref.name}</p>
                                    <p className={`text-xs ${theme.textMuted}`}>{ref.transactions} deals • Joined {ref.joinedDate}</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-green-500">₱{ref.earnings.toLocaleString()}</p>
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    ref.status === 'active' 
                                      ? (darkMode ? 'bg-green-900/50 text-green-400' : 'bg-green-100 text-green-700')
                                      : ref.status === 'pending'
                                      ? (darkMode ? 'bg-yellow-900/50 text-yellow-400' : 'bg-yellow-100 text-yellow-700')
                                      : (darkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600')
                                  }`}>
                                    {ref.status}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* History Tab */}
                  {earningsTab === 'history' && (
                    <div className="space-y-4">
                      <p className={`font-semibold ${theme.text}`}>📋 Transaction History</p>
                      
                      {earningsHistory.length === 0 ? (
                        <div className={`${theme.bgSecondary} rounded-xl p-8 text-center`}>
                          <FileText size={48} className={`mx-auto ${theme.textMuted} mb-3`} />
                          <p className={theme.textMuted}>No transactions yet</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {earningsHistory.map(tx => (
                            <div key={tx.id} className={`${theme.bgSecondary} rounded-xl p-3`}>
                              <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                    tx.type === 'commission' 
                                      ? (darkMode ? 'bg-green-900/50' : 'bg-green-100')
                                      : tx.type === 'bonus'
                                      ? (darkMode ? 'bg-amber-900/50' : 'bg-amber-100')
                                      : (darkMode ? 'bg-red-900/50' : 'bg-red-100')
                                  }`}>
                                    {tx.type === 'commission' 
                                      ? <TrendingUp size={18} className="text-green-500" />
                                      : tx.type === 'bonus'
                                      ? <Star size={18} className="text-amber-500" />
                                      : <TrendingDown size={18} className="text-red-500" />
                                    }
                                  </div>
                                  <div>
                                    <p className={`font-medium ${theme.text} text-sm`}>{tx.description}</p>
                                    <p className={`text-xs ${theme.textMuted}`}>{tx.date}</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className={`font-bold ${tx.amount > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {tx.amount > 0 ? '+' : ''}₱{Math.abs(tx.amount).toLocaleString()}
                                  </p>
                                  <span className={`text-xs ${
                                    tx.status === 'completed' ? 'text-green-500'
                                    : tx.status === 'pending' ? 'text-amber-500'
                                    : 'text-blue-500'
                                  }`}>
                                    {tx.status}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Payout Tab */}
                  {earningsTab === 'payout' && (
                    <div className="space-y-4">
                      <div className={`${darkMode ? 'bg-green-900/20' : 'bg-green-50'} rounded-xl p-4 text-center`}>
                        <p className={`text-sm ${theme.textMuted}`}>Available to Withdraw</p>
                        <p className="text-3xl font-bold text-green-500">₱{referralEarnings.availableBalance.toLocaleString()}</p>
                      </div>
                      
                      <div>
                        <label className={`block text-sm ${theme.textSecondary} mb-2`}>Withdrawal Amount</label>
                        <div className="relative">
                          <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold ${theme.textMuted}`}>₱</span>
                          <input 
                            type="number"
                            value={payoutAmount}
                            onChange={e => setPayoutAmount(e.target.value)}
                            placeholder="0"
                            className={`w-full ${theme.input} border rounded-xl pl-10 pr-4 py-3 text-xl font-bold`}
                          />
                        </div>
                        <p className={`text-xs ${theme.textMuted} mt-1`}>Minimum: ₱500</p>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2">
                        {[500, 1000, Math.floor(referralEarnings.availableBalance)].map((amt, i) => (
                          <button
                            key={i}
                            onClick={() => setPayoutAmount(amt > 0 ? amt.toString() : '')}
                            disabled={amt <= 0 || amt > referralEarnings.availableBalance}
                            className={`py-2 rounded-xl text-sm font-medium ${theme.bgSecondary} ${theme.text} disabled:opacity-50`}
                          >
                            {i === 2 ? 'Max' : `₱${amt.toLocaleString()}`}
                          </button>
                        ))}
                      </div>
                      
                      <div>
                        <label className={`block text-sm ${theme.textSecondary} mb-2`}>Payout Method</label>
                        <div className="space-y-2">
                          {[
                            { key: 'gcash', name: 'GCash', icon: '💚' },
                            { key: 'maya', name: 'Maya', icon: '💙' },
                            { key: 'bank', name: 'Bank Transfer', icon: '🏦' },
                          ].map(method => (
                            <button
                              key={method.key}
                              onClick={() => setPayoutMethod(method.key)}
                              className={`w-full p-3 rounded-xl border-2 flex items-center justify-between transition ${
                                payoutMethod === method.key
                                  ? 'border-green-500 bg-green-500/10'
                                  : `${theme.border} ${theme.bgSecondary}`
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-xl">{method.icon}</span>
                                <span className={`font-medium ${theme.text}`}>{method.name}</span>
                              </div>
                              {payoutMethod === method.key && <Check size={18} className="text-green-500" />}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <button
                        onClick={handlePayoutRequest}
                        disabled={!payoutAmount || parseFloat(payoutAmount) < 500 || parseFloat(payoutAmount) > referralEarnings.availableBalance}
                        className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white py-3 rounded-xl font-bold shadow-lg disabled:opacity-50"
                      >
                        Request Withdrawal
                      </button>
                      
                      <p className={`text-xs ${theme.textMuted} text-center`}>
                        Processed within 24-48 hours
                      </p>
                    </div>
                  )}
                  
                  {/* How To / Learn Tab */}
                  {earningsTab === 'howto' && (
                    <div className="space-y-4">
                      {/* Getting Started Videos */}
                      <div className={`${theme.bgSecondary} rounded-xl p-4`}>
                        <p className={`font-semibold ${theme.text} mb-3`}>🎬 Training Videos</p>
                        <div className="space-y-2">
                          {[
                            { title: 'How KARGA Connect Works', duration: '3 min', icon: '🚛' },
                            { title: 'Commission Structure Explained', duration: '2 min', icon: '💰' },
                            { title: 'How to Invite Shippers', duration: '4 min', icon: '📦' },
                            { title: 'How to Recruit Truckers', duration: '4 min', icon: '🚚' },
                            { title: 'Tips for More Referrals', duration: '5 min', icon: '🚀' },
                          ].map((video, i) => (
                            <button
                              key={i}
                              onClick={() => alert(`"${video.title}" video coming soon!`)}
                              className={`w-full ${theme.bgCard} border ${theme.border} rounded-xl p-3 flex items-center gap-3 text-left hover:opacity-80 transition`}
                            >
                              <span className="text-2xl">{video.icon}</span>
                              <div className="flex-1">
                                <p className={`font-medium ${theme.text}`}>{video.title}</p>
                                <p className={`text-xs ${theme.textMuted}`}>{video.duration}</p>
                              </div>
                              <ArrowRight size={16} className={theme.textMuted} />
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      {/* Marketing Materials */}
                      <div className={`${theme.bgSecondary} rounded-xl p-4`}>
                        <p className={`font-semibold ${theme.text} mb-3`}>📣 Marketing Materials</p>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { title: 'FB Post Templates', icon: '📋' },
                            { title: 'Image Graphics', icon: '🖼️' },
                            { title: 'Rate Card PDF', icon: '📄' },
                            { title: 'Promo Videos', icon: '🎥' },
                            { title: 'Success Stories', icon: '⭐' },
                            { title: 'FAQ Sheet', icon: '❓' },
                          ].map((item, i) => (
                            <button
                              key={i}
                              onClick={() => alert(`"${item.title}" will be available soon!`)}
                              className={`${theme.bgCard} border ${theme.border} rounded-xl p-3 text-center hover:opacity-80 transition`}
                            >
                              <span className="text-2xl block mb-1">{item.icon}</span>
                              <p className={`text-sm font-medium ${theme.text}`}>{item.title}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      {/* Recruitment Scripts */}
                      <div className={`${theme.bgSecondary} rounded-xl p-4`}>
                        <p className={`font-semibold ${theme.text} mb-3`}>💬 Sample Scripts (Taglish)</p>
                        <div className="space-y-3">
                          <div className={`${theme.bgCard} border ${theme.border} rounded-xl p-3`}>
                            <p className={`text-xs font-medium text-blue-500 mb-1`}>FOR SHIPPERS:</p>
                            <p className={`text-sm ${theme.textSecondary}`}>"Boss, may app na pwede mo ma-save sa trucking costs. KARGA Connect - direct ka sa truckers, no middleman fees. Try mo, libre lang mag-signup!"</p>
                          </div>
                          <div className={`${theme.bgCard} border ${theme.border} rounded-xl p-3`}>
                            <p className={`text-xs font-medium text-purple-500 mb-1`}>FOR TRUCKERS:</p>
                            <p className={`text-sm ${theme.textSecondary}`}>"Pre, gusto mo wala nang deadheading? Sa KARGA Connect may backload listings. Pag balik mo may karga ka na, hindi ka empty. Download mo na!"</p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Pro Tips */}
                      <div className={`${darkMode ? 'bg-amber-900/20 border-amber-800' : 'bg-amber-50 border-amber-200'} border rounded-xl p-4`}>
                        <p className={`font-semibold ${darkMode ? 'text-amber-400' : 'text-amber-700'} mb-2`}>💡 Pro Tips</p>
                        <ul className={`text-sm ${theme.textSecondary} space-y-2`}>
                          <li>• Target truckers first - mas madaling i-convert</li>
                          <li>• Post sa FB groups around 8-9 PM (peak hours)</li>
                          <li>• Follow up after their first transaction</li>
                          <li>• Share your own success story for credibility</li>
                          <li>• Visit truck terminals and ports personally</li>
                        </ul>
                      </div>
                      
                      {/* Support */}
                      <div className={`${theme.bgSecondary} rounded-xl p-4`}>
                        <p className={`font-semibold ${theme.text} mb-3`}>📞 Partner Support</p>
                        <div className="space-y-2">
                          <a href="tel:+639171234567" className={`w-full ${theme.bgCard} border ${theme.border} rounded-xl p-3 flex items-center gap-3 hover:opacity-80 transition`}>
                            <Phone size={18} className="text-green-500" />
                            <span className={theme.text}>Hotline: 0917-KARGA-PH</span>
                          </a>
                          <a href="mailto:partners@karga.ph" className={`w-full ${theme.bgCard} border ${theme.border} rounded-xl p-3 flex items-center gap-3 hover:opacity-80 transition`}>
                            <Mail size={18} className="text-blue-500" />
                            <span className={theme.text}>partners@karga.ph</span>
                          </a>
                          <a href="https://facebook.com/groups/kargapartnersph" target="_blank" rel="noopener noreferrer" className={`w-full ${theme.bgCard} border ${theme.border} rounded-xl p-3 flex items-center gap-3 hover:opacity-80 transition`}>
                            <MessageSquare size={18} className="text-purple-500" />
                            <span className={theme.text}>FB Group: KARGA Partners PH</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Edit Profile Modal
  const EditProfileModal = () => {
    const handleSaveProfile = async () => {
      if (!authUser) {
        alert('Please log in to edit your profile');
        return;
      }
      setEditProfileLoading(true);
      try {
        await firestoreService.updateUserProfile(authUser.uid, {
          name: editProfileData.name,
          email: editProfileData.email,
          facebookUrl: editProfileData.facebookUrl
        });
        alert('Profile updated successfully!');
        setShowEditProfileModal(false);
      } catch (error) {
        alert('Failed to update profile. Please try again.');
      }
      setEditProfileLoading(false);
    };

    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className={`${theme.bgCard} rounded-2xl w-full max-w-md shadow-2xl`}>
          {/* Header */}
          <div className={`p-4 border-b ${theme.borderLight} flex justify-between items-center`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center">
                <User size={20} className="text-white" />
              </div>
              <h2 className={`text-lg font-bold ${theme.text}`}>Edit Profile</h2>
            </div>
            <button onClick={() => setShowEditProfileModal(false)} className={`${theme.bgSecondary} p-2 rounded-full`}>
              <X size={20} className={theme.textSecondary} />
            </button>
          </div>

          {/* Form */}
          <div className="p-4 space-y-4">
            <div>
              <label className={`block text-sm ${theme.textSecondary} mb-1`}>Full Name</label>
              <input
                type="text"
                value={editProfileData.name}
                onChange={(e) => setEditProfileData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Juan Dela Cruz"
                className={`w-full ${theme.input} border ${theme.border} rounded-xl px-4 py-3`}
              />
            </div>
            <div>
              <label className={`block text-sm ${theme.textSecondary} mb-1`}>Email Address</label>
              <input
                type="email"
                value={editProfileData.email}
                onChange={(e) => setEditProfileData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="juan@email.com"
                className={`w-full ${theme.input} border ${theme.border} rounded-xl px-4 py-3`}
              />
            </div>
            <div>
              <label className={`block text-sm ${theme.textSecondary} mb-1`}>Business Name (Optional)</label>
              <input
                type="text"
                value={editProfileData.businessName}
                onChange={(e) => setEditProfileData(prev => ({ ...prev, businessName: e.target.value }))}
                placeholder="Your Business Name"
                className={`w-full ${theme.input} border ${theme.border} rounded-xl px-4 py-3`}
              />
            </div>
            <div>
              <label className={`block text-sm ${theme.textSecondary} mb-1`}>Facebook Profile URL (Optional)</label>
              <input
                type="url"
                value={editProfileData.facebookUrl}
                onChange={(e) => setEditProfileData(prev => ({ ...prev, facebookUrl: e.target.value }))}
                placeholder="https://facebook.com/yourprofile"
                className={`w-full ${theme.input} border ${theme.border} rounded-xl px-4 py-3`}
              />
            </div>

            <button
              onClick={handleSaveProfile}
              disabled={editProfileLoading}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 rounded-xl font-bold shadow-lg disabled:opacity-50"
            >
              {editProfileLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Verification Modal
  const VerificationModal = () => {
    const isPhoneVerified = !!authUser?.phoneNumber;
    const isEmailVerified = !!userProfile?.email;

    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className={`${theme.bgCard} rounded-2xl w-full max-w-md shadow-2xl`}>
          {/* Header */}
          <div className={`p-4 border-b ${theme.borderLight} flex justify-between items-center`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl flex items-center justify-center">
                <Shield size={20} className="text-white" />
              </div>
              <h2 className={`text-lg font-bold ${theme.text}`}>Verification Status</h2>
            </div>
            <button onClick={() => setShowVerificationModal(false)} className={`${theme.bgSecondary} p-2 rounded-full`}>
              <X size={20} className={theme.textSecondary} />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {/* Overall Status */}
            <div className={`${darkMode ? 'bg-amber-900/20 border-amber-800' : 'bg-amber-50 border-amber-200'} border rounded-xl p-4 text-center`}>
              <Shield size={32} className={`mx-auto mb-2 ${userProfile?.isVerified ? 'text-green-500' : 'text-amber-500'}`} />
              <p className={`font-bold ${theme.text}`}>
                {userProfile?.isVerified ? 'Verified Account' : 'Pending Verification'}
              </p>
              <p className={`text-sm ${theme.textMuted}`}>
                Complete all verifications to get the verified badge
              </p>
            </div>

            {/* Verification Items */}
            <div className="space-y-3">
              {/* Phone */}
              <div className={`${theme.bgSecondary} rounded-xl p-3 flex items-center justify-between`}>
                <div className="flex items-center gap-3">
                  <Phone size={20} className={theme.textSecondary} />
                  <div>
                    <p className={`font-medium ${theme.text}`}>Phone Number</p>
                    <p className={`text-xs ${theme.textMuted}`}>Verified via OTP</p>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${isPhoneVerified ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {isPhoneVerified ? '✓ Verified' : 'Pending'}
                </div>
              </div>

              {/* Email */}
              <div className={`${theme.bgSecondary} rounded-xl p-3 flex items-center justify-between`}>
                <div className="flex items-center gap-3">
                  <Mail size={20} className={theme.textSecondary} />
                  <div>
                    <p className={`font-medium ${theme.text}`}>Email Address</p>
                    <p className={`text-xs ${theme.textMuted}`}>Add email in Edit Profile</p>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${isEmailVerified ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {isEmailVerified ? '✓ Added' : 'Not Added'}
                </div>
              </div>

              {/* ID/License */}
              <div className={`${theme.bgSecondary} rounded-xl p-3 flex items-center justify-between`}>
                <div className="flex items-center gap-3">
                  <FileText size={20} className={theme.textSecondary} />
                  <div>
                    <p className={`font-medium ${theme.text}`}>Valid ID / License</p>
                    <p className={`text-xs ${theme.textMuted}`}>Government-issued ID</p>
                  </div>
                </div>
                <div className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                  Coming Soon
                </div>
              </div>

              {/* Facebook */}
              <div className={`${theme.bgSecondary} rounded-xl p-3 flex items-center justify-between`}>
                <div className="flex items-center gap-3">
                  <Users size={20} className={theme.textSecondary} />
                  <div>
                    <p className={`font-medium ${theme.text}`}>Facebook Profile</p>
                    <p className={`text-xs ${theme.textMuted}`}>Link your FB account</p>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${userProfile?.facebookUrl ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {userProfile?.facebookUrl ? '✓ Linked' : 'Not Linked'}
                </div>
              </div>
            </div>

            {/* Tips */}
            <div className={`${theme.bgSecondary} rounded-xl p-4`}>
              <p className={`font-semibold ${theme.text} mb-2`}>💡 Why Get Verified?</p>
              <ul className={`text-sm ${theme.textMuted} space-y-1`}>
                <li>• Build trust with shippers and truckers</li>
                <li>• Get verified badge on your profile</li>
                <li>• Higher chance of winning bids</li>
                <li>• Access to premium features</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Terms & Conditions Modal
  const TermsModal = () => {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className={`${theme.bgCard} rounded-2xl w-full max-w-lg max-h-[80vh] shadow-2xl flex flex-col`}>
          {/* Header */}
          <div className={`p-4 border-b ${theme.borderLight} flex justify-between items-center flex-shrink-0`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center">
                <FileText size={20} className="text-white" />
              </div>
              <h2 className={`text-lg font-bold ${theme.text}`}>Terms & Conditions</h2>
            </div>
            <button onClick={() => setShowTermsModal(false)} className={`${theme.bgSecondary} p-2 rounded-full`}>
              <X size={20} className={theme.textSecondary} />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="p-4 overflow-y-auto flex-1">
            <div className={`space-y-4 text-sm ${theme.textSecondary}`}>
              <section>
                <h3 className={`font-bold ${theme.text} mb-2`}>1. Acceptance of Terms</h3>
                <p>By accessing and using KARGA Connect, you accept and agree to be bound by these Terms and Conditions. If you do not agree, please do not use our platform.</p>
              </section>

              <section>
                <h3 className={`font-bold ${theme.text} mb-2`}>2. Platform Description</h3>
                <p>KARGA Connect is a two-way marketplace connecting cargo shippers with truckers in the Philippines. We facilitate connections but are not party to the actual shipping contracts between users.</p>
              </section>

              <section>
                <h3 className={`font-bold ${theme.text} mb-2`}>3. User Responsibilities</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Provide accurate and truthful information</li>
                  <li>Maintain confidentiality of your account</li>
                  <li>Honor agreed-upon prices and terms</li>
                  <li>Comply with all applicable laws and regulations</li>
                  <li>Respect other users and communicate professionally</li>
                </ul>
              </section>

              <section>
                <h3 className={`font-bold ${theme.text} mb-2`}>4. Platform Fees</h3>
                <p>KARGA Connect charges a platform fee of 5% on completed transactions. This fee is deducted from the wallet balance upon contract signing.</p>
              </section>

              <section>
                <h3 className={`font-bold ${theme.text} mb-2`}>5. Wallet & Payments</h3>
                <p>Users must maintain sufficient wallet balance for transactions. Top-up via GCash, Maya, or bank transfer. Withdrawals are processed within 24-48 hours.</p>
              </section>

              <section>
                <h3 className={`font-bold ${theme.text} mb-2`}>6. Liability Disclaimer</h3>
                <p>KARGA Connect is not liable for damages, losses, or disputes arising from transactions between users. We recommend securing appropriate cargo insurance.</p>
              </section>

              <section>
                <h3 className={`font-bold ${theme.text} mb-2`}>7. Privacy Policy</h3>
                <p>We collect and process personal data in accordance with Philippine data privacy laws. Your information is used solely for platform operations and improving our services.</p>
              </section>

              <section>
                <h3 className={`font-bold ${theme.text} mb-2`}>8. Contact Us</h3>
                <p>For questions or concerns, contact us at:</p>
                <p className="mt-1">Email: support@karga.ph</p>
                <p>Hotline: 0917-KARGA-PH</p>
              </section>
            </div>
          </div>

          {/* Footer */}
          <div className={`p-4 border-t ${theme.borderLight} flex-shrink-0`}>
            <button
              onClick={() => setShowTermsModal(false)}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white py-3 rounded-xl font-bold shadow-lg"
            >
              I Understand
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Shipper Badge Component
  const ShipperBadge = ({ transactions, size = 'sm' }) => {
    const tier = getShipperTier(transactions);
    const Icon = tier.icon;
    const bg = darkMode ? tier.bgDark : tier.bgLight;
    
    if (size === 'lg') {
      return (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${bg}`}>
          <Icon size={16} className={tier.color} />
          <span className={`text-sm font-semibold ${tier.color}`}>{tier.name}</span>
          <span className={theme.textMuted}>({transactions} deals)</span>
        </div>
      );
    }
    
    return (
      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${bg}`}>
        <Icon size={12} className={tier.color} />
        <span className={`text-xs font-medium ${tier.color}`}>{tier.name}</span>
      </div>
    );
  };

  // Trucker Badge Component
  const TruckerBadge = ({ rating, trips, size = 'sm' }) => {
    const badge = getTruckerBadge(rating, trips);
    const Icon = badge.icon;
    const bg = darkMode ? badge.bgDark : badge.bgLight;
    
    if (size === 'lg') {
      return (
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${bg}`}>
            <Icon size={16} className={badge.color} />
            <span className={`text-sm font-semibold ${badge.color}`}>{badge.name}</span>
          </div>
          <div className="flex items-center gap-1">
            <Star size={16} className="text-yellow-500" fill="currentColor" />
            <span className={`font-bold ${theme.text}`}>{rating}</span>
            <span className={theme.textMuted}>({trips} trips)</span>
          </div>
        </div>
      );
    }
    
    return (
      <div className="flex items-center gap-2">
        <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full ${bg}`}>
          <Icon size={10} className={badge.color} />
          <span className={`text-xs font-medium ${badge.color}`}>{badge.name}</span>
        </div>
        <span className="flex items-center gap-0.5 text-yellow-500 text-xs">
          <Star size={10} fill="currentColor" /> {rating}
        </span>
      </div>
    );
  };

  // Rating Modal
  const RatingModal = ({ shipment, onClose, onSubmit }) => {
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [feedback, setFeedback] = useState('');
    const [tags, setTags] = useState([]);
    const feedbackTags = ['On Time', 'Good Communication', 'Careful Handling', 'Professional', 'Clean Vehicle', 'Friendly'];

    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className={`${theme.bgCard} rounded-2xl w-full max-w-md shadow-2xl`}>
          <div className={`p-6 text-center border-b ${theme.borderLight}`}>
            <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-3">
              <Trophy size={32} className="text-white" />
            </div>
            <h2 className={`text-xl font-bold ${theme.text}`}>Rate Your Experience</h2>
            <p className={theme.textSecondary}>How was your delivery with {shipment.trucker}?</p>
          </div>

          <div className="p-6 space-y-5">
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} onClick={() => setRating(star)} onMouseEnter={() => setHoverRating(star)} onMouseLeave={() => setHoverRating(0)}>
                  <Star size={40} className={`${(hoverRating || rating) >= star ? 'text-yellow-400' : darkMode ? 'text-gray-700' : 'text-gray-300'}`} fill={(hoverRating || rating) >= star ? 'currentColor' : 'none'} />
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {feedbackTags.map((tag) => (
                <button key={tag} onClick={() => setTags(tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag])}
                  className={`px-3 py-1.5 rounded-full text-sm border transition ${
                    tags.includes(tag)
                      ? 'bg-amber-100 border-amber-400 text-amber-700'
                      : `${theme.bgSecondary} ${theme.border} ${theme.textSecondary}`
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>

            <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Additional comments..." rows={3}
              className={`w-full ${theme.input} border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-400`}
            />

            <div className="flex gap-3">
              <button onClick={onClose} className={`flex-1 py-3 rounded-xl border ${theme.border} ${theme.textSecondary} font-medium`}>Skip</button>
              <button onClick={() => onSubmit({ rating, tags, feedback })} disabled={!rating}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold disabled:opacity-50">
                Submit
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Handle functions
  const handleRatingSubmit = (ratingData) => {
    setActiveShipments(activeShipments.map(s => s.id === selectedShipment.id ? { ...s, needsRating: false } : s));
    setShowRatingModal(false);
  };

  const handlePost = async () => {
    if (!authUser || !userProfile) {
      alert('Please log in to post a listing');
      return;
    }

    try {
      if (userRole === 'shipper') {
        await firestoreService.createCargoListing(authUser.uid, { ...userProfile, shipperProfile }, {
          origin: newPost.origin,
          destination: newPost.destination,
          cargoType: newPost.cargoType,
          weight: newPost.weight,
          weightUnit: 'tons',
          vehicleNeeded: newPost.vehicleNeeded,
          askingPrice: newPost.askingPrice,
          description: newPost.description,
          pickupDate: newPost.pickupDate,
          photos: newPost.photos || []
        });
      } else {
        await firestoreService.createTruckListing(authUser.uid, userProfile, truckerProfile, {
          origin: newPost.origin,
          destination: newPost.destination,
          vehicleType: newPost.vehicleType,
          capacity: newPost.capacity,
          capacityUnit: 'tons',
          plateNumber: newPost.plateNo,
          askingPrice: newPost.askingPrice,
          description: newPost.description,
          availableDate: newPost.availableDate,
          departureTime: newPost.departureTime
        });
      }
      setShowPostModal(false);
      setNewPost({ origin: '', destination: '', askingPrice: '', description: '', weight: '', cargoType: '', vehicleNeeded: '', pickupDate: '', vehicleType: '', capacity: '', plateNo: '', availableDate: '', departureTime: '', photos: [] });
    } catch (error) {
      console.error('Error creating listing:', error);
      alert('Failed to create listing. Please try again.');
    }
  };

  // Calculate platform fee
  const calculatePlatformFee = (amount) => {
    return Math.round(amount * PLATFORM_FEE_RATE);
  };

  // Check if trucker has sufficient wallet balance
  const checkWalletBalance = (jobAmount) => {
    const requiredFee = calculatePlatformFee(jobAmount);
    return walletBalance >= requiredFee;
  };

  // Deduct platform fee from wallet
  const deductPlatformFee = (jobAmount, description) => {
    const fee = calculatePlatformFee(jobAmount);
    setWalletBalance(prev => prev - fee);
    setWalletTransactions(prev => [{
      id: `W${Date.now()}`,
      type: 'fee',
      amount: -fee,
      description: description,
      date: new Date().toISOString().split('T')[0],
      status: 'completed',
      contractId: `KC-${Date.now().toString().slice(-8)}`
    }, ...prev]);
    return fee;
  };

  const handleBid = async () => {
    if (!bidAmount || !selectedListing || !authUser || !userProfile) return;

    // For truckers bidding on cargo, check wallet balance
    if (userRole === 'trucker' && selectedListing.type === 'cargo') {
      const fee = calculatePlatformFee(parseFloat(bidAmount));
      if (walletBalance < fee) {
        alert(`Insufficient wallet balance! You need at least ₱${fee} to cover the platform fee (3% of ₱${parseFloat(bidAmount).toLocaleString()}). Please top up your wallet.`);
        setShowBidModal(false);
        setShowTopUpModal(true);
        return;
      }
    }

    try {
      const bidderProfile = {
        ...userProfile,
        truckerProfile,
        shipperProfile
      };

      await firestoreService.createBid(
        authUser.uid,
        bidderProfile,
        selectedListing,
        selectedListing.type,
        {
          price: parseFloat(bidAmount),
          message: bidMessage,
          cargoType: bidCargoType || null,
          cargoWeight: bidCargoWeight ? parseFloat(bidCargoWeight) : null
        }
      );

      setShowBidModal(false);
      setBidAmount(''); setBidMessage(''); setBidCargoType(''); setBidCargoWeight('');
    } catch (error) {
      console.error('Error placing bid:', error);
      alert('Failed to place bid. Please try again.');
    }
  };

  const handleAcceptBid = (listing, bidId) => {
    const acceptedBid = listing.bids.find(b => b.id === bidId);
    
    // If shipper accepts trucker bid on cargo, trucker's wallet gets fee deducted
    // For demo, we'll just show the fee calculation
    if (listing.type === 'cargo' && acceptedBid) {
      const fee = calculatePlatformFee(acceptedBid.price);
      console.log(`Platform fee of ₱${fee} will be charged to trucker`);
    }
    
    const update = items => items.map(item => 
      item.id === listing.id ? { ...item, status: 'negotiating', bids: item.bids.map(b => ({ ...b, status: b.id === bidId ? 'accepted' : 'rejected' })) } : item
    );
    if (listing.type === 'cargo') setCargoListings(update(cargoListings));
    else setTruckListings(update(truckListings));
  };

  const openChat = (listing, bid) => { setSelectedListing(listing); setSelectedBid(bid); setShowChatModal(true); };

  const sendChat = () => {
    if (!chatInput.trim()) return;
    const newMsg = { id: Date.now(), sender: userRole, text: chatInput, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    
    const update = items => items.map(item => 
      item.id === selectedListing.id ? { ...item, bids: item.bids.map(b => b.id === selectedBid.id ? { ...b, chatHistory: [...b.chatHistory, newMsg] } : b) } : item
    );

    if (selectedListing.type === 'cargo') setCargoListings(update(cargoListings));
    else setTruckListings(update(truckListings));
    
    setSelectedBid({ ...selectedBid, chatHistory: [...selectedBid.chatHistory, newMsg] });
    setChatInput('');
  };

  const handleSignContract = () => {
    setContractSigned(true);
    const update = items => items.map(item => item.id === selectedListing.id ? { ...item, status: 'contracted' } : item);
    if (selectedListing.type === 'cargo') setCargoListings(update(cargoListings));
    else setTruckListings(update(truckListings));
    setUserTransactions(userTransactions + 1);
    
    // Deduct platform fee from trucker's wallet
    // In real app, this would be handled on backend when trucker accepts
    if (userRole === 'trucker' && selectedListing.type === 'cargo') {
      const fee = Math.round(selectedBid.price * PLATFORM_FEE_RATE);
      setWalletBalance(prev => prev - fee);
      setWalletTransactions(prev => [{
        id: `W${Date.now()}`,
        type: 'fee',
        amount: -fee,
        description: `Platform fee: ${selectedListing.origin} → ${selectedListing.destination}`,
        date: new Date().toISOString().split('T')[0],
        status: 'completed',
        contractId: `KC-${Date.now().toString().slice(-8)}`
      }, ...prev]);
    }
  };

  const getBidComparison = (askingPrice, bidPrice) => {
    const diff = bidPrice - askingPrice;
    const percent = Math.abs((diff / askingPrice) * 100).toFixed(0);
    if (diff > 0) return { icon: TrendingUp, color: 'text-green-500', label: `${percent}% higher` };
    if (diff < 0) return { icon: TrendingDown, color: 'text-red-500', label: `${percent}% lower` };
    return { icon: Minus, color: theme.textMuted, label: 'Match' };
  };

  // Listing Card
  const ListingCard = ({ listing, canBid }) => {
    const isExpanded = expandedListing === listing.id;
    const distance = calculateDistance(listing.originCoords.lat, listing.originCoords.lng, listing.destCoords.lat, listing.destCoords.lng);
    const isCargo = listing.type === 'cargo';
    const isOwner = (isCargo && userRole === 'shipper') || (!isCargo && userRole === 'trucker');

    const statusColors = {
      open: darkMode ? 'bg-green-900/30 text-green-400 border-green-800' : 'bg-green-50 text-green-700 border-green-200',
      negotiating: darkMode ? 'bg-amber-900/30 text-amber-400 border-amber-800' : 'bg-amber-50 text-amber-700 border-amber-200',
      contracted: darkMode ? 'bg-blue-900/30 text-blue-400 border-blue-800' : 'bg-blue-50 text-blue-700 border-blue-200',
    };

    return (
      <div className={`${theme.bgCard} rounded-2xl border ${theme.border} overflow-hidden shadow-sm h-fit`}>
        <div className="p-4">
          <div className="flex justify-between items-start gap-3 mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[listing.status]}`}>
                  {listing.status.toUpperCase()}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isCargo ? (darkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700') : (darkMode ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-700')}`}>
                  {isCargo ? '📦 CARGO' : '🚛 TRUCK'}
                </span>
                <span className={`text-xs ${theme.textMuted}`}>{listing.postedAt}</span>
              </div>
              
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isCargo ? (darkMode ? 'bg-blue-900/30' : 'bg-blue-100') : (darkMode ? 'bg-purple-900/30' : 'bg-purple-100')}`}>
                  {isCargo ? <Package size={18} className="text-blue-500" /> : <Truck size={18} className="text-purple-500" />}
                </div>
                <div>
                  <p className={`font-semibold ${theme.text}`}>{isCargo ? listing.shipper : listing.trucker}</p>
                  {isCargo ? <ShipperBadge transactions={listing.shipperTransactions} /> : <TruckerBadge rating={listing.rating} trips={listing.trips} />}
                </div>
              </div>

              <div className={`flex items-center gap-2 font-semibold ${theme.text}`}>
                <MapPin size={16} className="text-green-500" />
                <span>{listing.origin}</span>
                <ArrowRight size={14} className={theme.textMuted} />
                <MapPin size={16} className="text-red-500" />
                <span>{listing.destination}</span>
              </div>
              
              <div className="flex flex-wrap gap-2 mt-2 text-xs">
                <span className={`${theme.bgSecondary} ${theme.textSecondary} px-2 py-1 rounded-lg flex items-center gap-1`}>
                  <Route size={12} /> {distance} km
                </span>
                {isCargo ? (
                  <>
                    <span className={`${theme.bgSecondary} ${theme.textSecondary} px-2 py-1 rounded-lg flex items-center gap-1`}><Weight size={12} /> {listing.weight} {listing.unit}</span>
                    <span className={`${theme.bgSecondary} ${theme.textSecondary} px-2 py-1 rounded-lg flex items-center gap-1`}><Calendar size={12} /> {listing.pickupDate}</span>
                  </>
                ) : (
                  <>
                    <span className={`${theme.bgSecondary} ${theme.textSecondary} px-2 py-1 rounded-lg flex items-center gap-1`}><Truck size={12} /> {listing.vehicleType}</span>
                    <span className={`${theme.bgSecondary} ${theme.textSecondary} px-2 py-1 rounded-lg flex items-center gap-1`}><Calendar size={12} /> {listing.availableDate}</span>
                  </>
                )}
              </div>
              
              {listing.description && <p className={`text-sm ${theme.textMuted} mt-2`}>{listing.description}</p>}
              
              {/* Cargo Photos */}
              {isCargo && listing.cargoPhotos && listing.cargoPhotos.length > 0 && (
                <PhotoGallery 
                  photos={listing.cargoPhotos} 
                  onViewPhoto={(idx) => {
                    setSelectedListing(listing);
                    setSelectedPhotoIndex(idx);
                    setShowPhotoViewer(true);
                  }} 
                />
              )}
            </div>

            <div className={`text-right flex-shrink-0 ${darkMode ? 'bg-amber-900/20' : 'bg-amber-50'} rounded-xl p-3 border ${darkMode ? 'border-amber-800' : 'border-amber-200'}`}>
              <p className={`text-xs ${darkMode ? 'text-amber-400' : 'text-amber-700'}`}>{isCargo ? 'Willing to Pay' : 'Asking Rate'}</p>
              <p className="text-2xl font-bold text-amber-500">₱{listing.askingPrice.toLocaleString()}</p>
              <p className={`text-xs ${darkMode ? 'text-amber-400/70' : 'text-amber-600/70'}`}>₱{(listing.askingPrice / distance).toFixed(0)}/km</p>
            </div>
          </div>

          <RouteMap origin={listing.origin} destination={listing.destination} originCoords={listing.originCoords} destCoords={listing.destCoords} darkMode={darkMode} onClick={() => { setSelectedListing(listing); setShowMapModal(true); }} />

          <div className="flex gap-2 mt-3">
            {canBid && listing.status === 'open' && (
              <button onClick={() => { setSelectedListing(listing); setShowBidModal(true); }}
                className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white py-2.5 rounded-xl text-sm font-bold shadow-lg hover:shadow-amber-500/30 transition">
                {isCargo ? '🚛 Bid as Trucker' : '📦 Bid for Space'}
              </button>
            )}
            <button onClick={() => { setSelectedListing(listing); setShowMapModal(true); }}
              className={`flex items-center gap-1 ${darkMode ? 'bg-blue-900/30 text-blue-400 border-blue-800' : 'bg-blue-50 text-blue-600 border-blue-200'} px-4 py-2.5 rounded-xl text-sm font-medium border`}>
              <Navigation size={14} /> Map
            </button>
          </div>

          {listing.bids.length > 0 && (
            <button onClick={() => setExpandedListing(isExpanded ? null : listing.id)}
              className={`flex items-center gap-2 mt-3 text-sm ${theme.textSecondary} hover:${theme.text} w-full`}>
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              {listing.bids.length} Bid{listing.bids.length > 1 ? 's' : ''}
            </button>
          )}
        </div>

        {isExpanded && listing.bids.length > 0 && (
          <div className={`border-t ${theme.borderLight} ${theme.bgTertiary} p-4 space-y-3`}>
            {listing.bids.map(bid => {
              const comparison = getBidComparison(listing.askingPrice, bid.price);
              const CompIcon = comparison.icon;
              
              return (
                <div key={bid.id} className={`p-4 rounded-xl border ${bid.status === 'accepted' ? (darkMode ? 'bg-green-900/20 border-green-800' : 'bg-green-50 border-green-200') : `${theme.bgCard} ${theme.border}`}`}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-semibold ${theme.text}`}>{bid.bidder}</span>
                        {bid.bidderType === 'trucker' ? <TruckerBadge rating={bid.rating} trips={bid.trips} /> : <ShipperBadge transactions={bid.shipperTransactions} />}
                      </div>
                      {bid.message && <p className={`text-sm ${theme.textSecondary} mt-1`}>{maskContact(bid.message)}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-green-500">₱{bid.price.toLocaleString()}</p>
                      <p className={`text-xs flex items-center justify-end gap-1 ${comparison.color}`}>
                        <CompIcon size={12} /> {comparison.label}
                      </p>
                    </div>
                  </div>
                  
                  {bid.status === 'pending' && isOwner && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-dashed" style={{ borderColor: darkMode ? '#374151' : '#e5e7eb' }}>
                      <button onClick={() => handleAcceptBid(listing, bid.id)} className="flex items-center gap-1 bg-green-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium">
                        <Check size={14} /> Accept
                      </button>
                      <button onClick={() => openChat(listing, bid)} className="flex items-center gap-1 bg-blue-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium">
                        <MessageSquare size={14} /> Chat
                      </button>
                    </div>
                  )}
                  
                  {bid.status === 'accepted' && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-dashed" style={{ borderColor: darkMode ? '#374151' : '#e5e7eb' }}>
                      <button onClick={() => openChat(listing, bid)} className="flex items-center gap-1 bg-blue-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium">
                        <MessageSquare size={14} /> Chat
                      </button>
                      <button onClick={() => { setSelectedListing(listing); setSelectedBid(bid); setContractSigned(false); setShowContractModal(true); }}
                        className="flex items-center gap-1 bg-amber-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium">
                        <FileText size={14} /> Contract
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Tracking Tab
  const TrackingTab = () => (
    <div className="space-y-4">
      <h2 className={`text-lg font-bold ${theme.text}`}>📍 Active Shipments</h2>
      
      {activeShipments.filter(s => s.status !== 'delivered').length === 0 ? (
        <div className={`${theme.bgCard} rounded-2xl p-8 text-center border ${theme.border}`}>
          <Truck size={48} className={`mx-auto ${theme.textMuted} mb-3`} />
          <p className={theme.textMuted}>No active shipments</p>
        </div>
      ) : (
        activeShipments.filter(s => s.status !== 'delivered').map(shipment => (
          <div key={shipment.id} onClick={() => { setSelectedShipment(shipment); setShowTrackingModal(true); }} className="cursor-pointer">
            <TrackingMap shipment={shipment} darkMode={darkMode} />
          </div>
        ))
      )}

      <h2 className={`text-lg font-bold ${theme.text} mt-6`}>✅ Completed</h2>
      {activeShipments.filter(s => s.status === 'delivered').map(shipment => (
        <div key={shipment.id} className={`${theme.bgCard} rounded-xl border ${theme.border} p-4`}>
          <div className="flex justify-between items-center">
            <div>
              <p className={`font-semibold ${theme.text}`}>{shipment.cargo}</p>
              <p className={`text-sm ${theme.textMuted}`}>{shipment.origin} → {shipment.destination}</p>
              <p className="text-xs text-green-500 mt-1">Delivered: {shipment.deliveredAt}</p>
            </div>
            {shipment.needsRating ? (
              <button onClick={(e) => { e.stopPropagation(); setSelectedShipment(shipment); setShowRatingModal(true); }}
                className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2 rounded-xl text-sm font-bold">
                <Star size={14} className="inline mr-1" /> Rate
              </button>
            ) : (
              <div className="flex items-center gap-1 text-green-500">
                <CheckCircle2 size={20} />
                <span className="text-sm font-medium">Rated</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  // Profile Tab
  const ProfileTab = () => {
    const tier = getShipperTier(userTransactions);
    const currentBrokerTier = brokerTiers[brokerTier] || brokerTiers.STARTER;
    const BrokerTierIcon = currentBrokerTier.icon;

    const handleLogout = async () => {
      if (window.confirm('Are you sure you want to logout?')) {
        await logout();
      }
    };

    return (
      <div className="space-y-4">
        <div className={`${theme.bgCard} rounded-2xl border ${theme.border} p-6 text-center`}>
          <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
            {userRole === 'shipper' ? <Package size={36} className="text-white" /> : <Truck size={36} className="text-white" />}
          </div>
          <h2 className={`text-xl font-bold ${theme.text}`}>{userProfile?.name || (userRole === 'shipper' ? 'Shipper' : 'Trucker')}</h2>
          <p className={theme.textMuted}>{userProfile?.phone || 'Member'}</p>

          <div className="mt-4 flex justify-center">
            {userRole === 'shipper' ? <ShipperBadge transactions={userTransactions} size="lg" /> : <TruckerBadge rating={userRating} trips={userTrips} size="lg" />}
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className={`mt-4 flex items-center justify-center gap-2 mx-auto px-4 py-2 rounded-lg text-sm font-medium transition ${darkMode ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>

        {/* 💰 EARNINGS BUTTON - Main Feature */}
        <button
          onClick={() => setShowEarningsModal(true)}
          className={`w-full ${theme.bgCard} rounded-2xl border-2 ${isBroker ? 'border-green-500' : 'border-dashed border-amber-400'} p-4 text-left transition hover:shadow-lg`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${isBroker ? 'bg-gradient-to-br from-green-400 to-emerald-500' : 'bg-gradient-to-br from-amber-400 to-orange-500'}`}>
                <PesoIcon size={28} className="text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className={`text-lg font-bold ${theme.text}`}>Earnings</h3>
                  {isBroker && (
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${darkMode ? 'bg-green-900/50 text-green-400' : 'bg-green-100 text-green-700'}`}>
                      <BrokerTierIcon size={12} />
                      {currentBrokerTier.name}
                    </span>
                  )}
                </div>
                {isBroker ? (
                  <p className={`text-sm ${theme.textMuted}`}>
                    Balance: <span className="font-bold text-green-500">₱{referralEarnings.availableBalance.toLocaleString()}</span>
                    {referralEarnings.pendingEarnings > 0 && (
                      <span className="text-amber-500"> (+₱{referralEarnings.pendingEarnings.toLocaleString()} pending)</span>
                    )}
                  </p>
                ) : (
                  <p className={`text-sm ${theme.textMuted}`}>Earn by referring shippers & truckers!</p>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end">
              {isBroker ? (
                <>
                  <p className="text-xs text-green-500 font-medium">{referralEarnings.activeReferrals} active referrals</p>
                  <p className={`text-xs ${theme.textMuted}`}>{referralEarnings.totalTransactions} deals</p>
                </>
              ) : (
                <span className="px-3 py-1 bg-amber-500 text-white text-xs font-bold rounded-full">JOIN FREE</span>
              )}
              <ArrowRight size={20} className={`mt-2 ${theme.textMuted}`} />
            </div>
          </div>
        </button>

        {userRole === 'shipper' && (
          <div className={`${theme.bgCard} rounded-2xl border ${theme.border} p-4`}>
            <h3 className={`font-semibold ${theme.text} mb-3`}>Membership Progress</h3>
            <div className="space-y-2">
              {Object.values(shipperTiers).map((t) => {
                const Icon = t.icon;
                const isActive = t.name === tier.name;
                const isPassed = userTransactions >= t.min;
                const bg = darkMode ? t.bgDark : t.bgLight;
                return (
                  <div key={t.name} className={`flex items-center gap-3 p-2 rounded-lg ${isActive ? bg : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isPassed ? bg : theme.bgSecondary}`}>
                      <Icon size={16} className={isPassed ? t.color : theme.textMuted} />
                    </div>
                    <div className="flex-1">
                      <p className={`font-medium ${isActive ? t.color : isPassed ? theme.text : theme.textMuted}`}>{t.name}</p>
                      <p className={`text-xs ${theme.textMuted}`}>{t.min}+ deals • {t.discount}% discount</p>
                    </div>
                    {isPassed && <Check size={16} className="text-green-500" />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className={`${theme.bgCard} rounded-xl border ${theme.border} p-4 text-center`}>
            <p className="text-3xl font-bold text-amber-500">{userRole === 'shipper' ? userTransactions : userTrips}</p>
            <p className={`text-sm ${theme.textMuted}`}>{userRole === 'shipper' ? 'Completed' : 'Trips'}</p>
          </div>
          <div className={`${theme.bgCard} rounded-xl border ${theme.border} p-4 text-center`}>
            <p className="text-3xl font-bold text-green-500">{userRole === 'shipper' ? `${tier.discount}%` : userRating}</p>
            <p className={`text-sm ${theme.textMuted}`}>{userRole === 'shipper' ? 'Discount' : 'Rating'}</p>
          </div>
        </div>
        
        {/* Account Actions */}
        <div className={`${theme.bgCard} rounded-2xl border ${theme.border} p-4 space-y-2`}>
          <button
            onClick={() => {
              setEditProfileData({
                name: userProfile?.name || '',
                email: userProfile?.email || '',
                businessName: shipperProfile?.businessName || truckerProfile?.businessName || '',
                facebookUrl: userProfile?.facebookUrl || ''
              });
              setShowEditProfileModal(true);
            }}
            className={`w-full flex items-center gap-3 p-3 rounded-xl ${theme.bgSecondary} text-left hover:opacity-80 transition`}
          >
            <User size={20} className={theme.textSecondary} />
            <span className={theme.text}>Edit Profile</span>
          </button>
          <button
            onClick={() => setShowVerificationModal(true)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl ${theme.bgSecondary} text-left hover:opacity-80 transition`}
          >
            <Shield size={20} className={theme.textSecondary} />
            <span className={theme.text}>Verification</span>
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`w-full flex items-center gap-3 p-3 rounded-xl ${theme.bgSecondary} text-left hover:opacity-80 transition`}
          >
            <Bell size={20} className={theme.textSecondary} />
            <span className={theme.text}>Notifications</span>
          </button>
          <button
            onClick={() => setShowTermsModal(true)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl ${theme.bgSecondary} text-left hover:opacity-80 transition`}
          >
            <FileText size={20} className={theme.textSecondary} />
            <span className={theme.text}>Terms & Conditions</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className={`min-h-screen ${theme.bg} transition-colors duration-300`}>
      {/* Header */}
      <header className={`sticky top-0 z-40 ${theme.bgCard} border-b ${theme.border} shadow-sm`}>
        <div className="w-full max-w-7xl lg:max-w-none mx-auto px-4 sm:px-6 lg:px-12 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg">
                <Truck className="text-white" size={20} />
              </div>
              <div>
                <h1 className={`font-bold text-lg ${theme.text}`}>KARGA CONNECT</h1>
                <p className={`text-xs ${theme.textMuted}`}>Two-Way Marketplace</p>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-1">
              {[
                { tab: 'home', icon: Home, label: 'Home' },
                { tab: 'tracking', icon: MapPinned, label: 'Tracking' },
                { tab: 'notifications', icon: Bell, label: 'Alerts' },
                { tab: 'profile', icon: User, label: 'Profile' }
              ].map(({ tab, icon: Icon, label }) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                    activeTab === tab
                      ? 'bg-amber-500 text-white'
                      : `${theme.textSecondary} hover:${theme.bgSecondary}`
                  }`}
                >
                  <Icon size={18} />
                  {label}
                  {tab === 'notifications' && unreadCount > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full font-bold">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                  {tab === 'tracking' && activeShipments.filter(s => s.status !== 'delivered').length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 bg-blue-500 text-white text-xs rounded-full font-bold">
                      {activeShipments.filter(s => s.status !== 'delivered').length}
                    </span>
                  )}
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              {/* Wallet Button - Truckers Only */}
              {userRole === 'trucker' && (
                <button 
                  onClick={() => setShowWalletModal(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${
                    walletBalance < MINIMUM_WALLET_BALANCE 
                      ? 'bg-red-500 text-white animate-pulse' 
                      : 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                  } shadow-sm`}
                >
                  <PesoIcon size={14} />
                  <span className="font-bold text-sm">₱{walletBalance.toLocaleString()}</span>
                </button>
              )}
              
              {/* Dark Mode Toggle */}
              <button onClick={() => setDarkMode(!darkMode)} className={`p-2 rounded-full ${theme.bgSecondary} transition-colors`}>
                {darkMode ? <Sun size={20} className="text-yellow-400" /> : <Moon size={20} className={theme.textSecondary} />}
              </button>
              
              {/* Notifications */}
              <div className="relative">
                <button 
                  onClick={() => setShowNotifications(!showNotifications)} 
                  className={`p-2 ${theme.bgSecondary} rounded-full relative transition-colors ${showNotifications ? 'ring-2 ring-amber-500' : ''}`}
                >
                  <Bell size={20} className={showNotifications ? 'text-amber-500' : theme.textSecondary} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs text-white font-bold">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
                <NotificationPanel />
              </div>
            </div>
          </div>

          {/* Role Toggle - Mobile Only */}
          <div className={`lg:hidden flex gap-1 mt-3 p-1 ${theme.bgSecondary} rounded-xl`}>
            <button onClick={() => switchRole('shipper')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 ${userRole === 'shipper' ? `${theme.bgCard} text-blue-500 shadow-sm` : theme.textMuted}`}>
              <Package size={16} /> Shipper
            </button>
            <button onClick={() => switchRole('trucker')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 ${userRole === 'trucker' ? `${theme.bgCard} text-purple-500 shadow-sm` : theme.textMuted}`}>
              <Truck size={16} /> Trucker
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area with Desktop Sidebar */}
      <div className="w-full max-w-7xl lg:max-w-none mx-auto px-4 sm:px-6 lg:px-12 py-6 pb-24 lg:pb-6 lg:flex lg:gap-8">

        {/* Desktop Sidebar */}
        <aside className="hidden lg:block lg:w-64 flex-shrink-0">
          <div className={`${theme.bgCard} rounded-2xl border ${theme.border} p-4 sticky top-24`}>
            {/* User Info */}
            {userProfile && (
              <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                <p className={`font-medium ${theme.text}`}>{userProfile.name}</p>
                <p className={`text-xs ${theme.textMuted}`}>{userProfile.phone}</p>
              </div>
            )}

            {/* Role Toggle */}
            <div className="mb-6">
              <p className={`text-xs font-semibold ${theme.textMuted} uppercase tracking-wider mb-2`}>I am a</p>
              <div className={`flex gap-1 p-1 ${theme.bgSecondary} rounded-xl`}>
                <button
                  onClick={() => switchRole('shipper')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 ${userRole === 'shipper' ? `${theme.bgCard} text-blue-500 shadow-sm` : theme.textMuted}`}
                >
                  <Package size={16} /> Shipper
                </button>
                <button
                  onClick={() => switchRole('trucker')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 ${userRole === 'trucker' ? `${theme.bgCard} text-purple-500 shadow-sm` : theme.textMuted}`}
                >
                  <Truck size={16} /> Trucker
                </button>
              </div>
            </div>

            {/* Market Toggle */}
            <div className="mb-6">
              <p className={`text-xs font-semibold ${theme.textMuted} uppercase tracking-wider mb-2`}>Browse</p>
              <div className="space-y-2">
                <button
                  onClick={() => { setActiveMarket('cargo'); setActiveTab('home'); }}
                  className={`w-full py-2.5 px-3 rounded-xl text-sm font-medium border transition flex items-center gap-2 ${
                    activeMarket === 'cargo' && activeTab === 'home'
                      ? (darkMode ? 'bg-blue-900/30 border-blue-800 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-700')
                      : `${theme.bgCard} ${theme.border} ${theme.textMuted} hover:${theme.bgSecondary}`
                  }`}
                >
                  <Package size={16} />
                  Cargo
                  <span className={`ml-auto px-2 py-0.5 rounded-full text-xs ${darkMode ? 'bg-blue-900/50' : 'bg-blue-100'}`}>
                    {cargoListings.filter(c => c.status === 'open').length}
                  </span>
                </button>
                <button
                  onClick={() => { setActiveMarket('trucks'); setActiveTab('home'); }}
                  className={`w-full py-2.5 px-3 rounded-xl text-sm font-medium border transition flex items-center gap-2 ${
                    activeMarket === 'trucks' && activeTab === 'home'
                      ? (darkMode ? 'bg-purple-900/30 border-purple-800 text-purple-400' : 'bg-purple-50 border-purple-200 text-purple-700')
                      : `${theme.bgCard} ${theme.border} ${theme.textMuted} hover:${theme.bgSecondary}`
                  }`}
                >
                  <Truck size={16} />
                  Trucks
                  <span className={`ml-auto px-2 py-0.5 rounded-full text-xs ${darkMode ? 'bg-purple-900/50' : 'bg-purple-100'}`}>
                    {truckListings.filter(t => t.status === 'open').length}
                  </span>
                </button>
              </div>
            </div>

            {/* Post Button */}
            <button
              onClick={() => {
                setNewPost({ origin: '', destination: '', askingPrice: '', description: '', weight: '', cargoType: '', vehicleNeeded: '', pickupDate: '', vehicleType: '', capacity: '', plateNo: '', availableDate: '', departureTime: '', photos: [] });
                setShowPostModal(true);
              }}
              className="w-full mb-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg hover:shadow-amber-500/30 transition"
            >
              <Plus size={20} /> {userRole === 'shipper' ? 'Post Cargo' : 'Post Truck'}
            </button>

            {/* Route Optimizer Button for Truckers */}
            {userRole === 'trucker' && (
              <button
                onClick={() => setShowRouteOptimizer(true)}
                className={`w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 border-2 border-dashed ${
                  darkMode
                    ? 'border-green-700 bg-green-900/20 text-green-400 hover:bg-green-900/40'
                    : 'border-green-400 bg-green-50 text-green-700 hover:bg-green-100'
                } transition`}
              >
                <Waypoints size={18} /> Find Backloads
              </button>
            )}

            {/* Quick Stats */}
            <div className={`mt-6 pt-6 border-t ${theme.borderLight}`}>
              <p className={`text-xs font-semibold ${theme.textMuted} uppercase tracking-wider mb-3`}>Quick Stats</p>
              <div className="space-y-2">
                <div className={`flex justify-between items-center text-sm ${theme.textSecondary}`}>
                  <span>Open Cargo</span>
                  <span className="font-semibold">{cargoListings.filter(c => c.status === 'open').length}</span>
                </div>
                <div className={`flex justify-between items-center text-sm ${theme.textSecondary}`}>
                  <span>Available Trucks</span>
                  <span className="font-semibold">{truckListings.filter(t => t.status === 'open').length}</span>
                </div>
                <div className={`flex justify-between items-center text-sm ${theme.textSecondary}`}>
                  <span>Active Shipments</span>
                  <span className="font-semibold">{activeShipments.filter(s => s.status !== 'delivered').length}</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          {activeTab === 'home' && (
            <>
              {/* Mobile Market Toggle */}
              <div className="lg:hidden flex gap-2 mb-4">
                <button onClick={() => setActiveMarket('cargo')} className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition ${activeMarket === 'cargo' ? (darkMode ? 'bg-blue-900/30 border-blue-800 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-700') : `${theme.bgCard} ${theme.border} ${theme.textMuted}`}`}>
                  📦 Cargo ({cargoListings.filter(c => c.status === 'open').length})
                </button>
                <button onClick={() => setActiveMarket('trucks')} className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition ${activeMarket === 'trucks' ? (darkMode ? 'bg-purple-900/30 border-purple-800 text-purple-400' : 'bg-purple-50 border-purple-200 text-purple-700') : `${theme.bgCard} ${theme.border} ${theme.textMuted}`}`}>
                  🚛 Trucks ({truckListings.filter(t => t.status === 'open').length})
                </button>
              </div>

              {/* Mobile Post Button */}
              <button onClick={() => {
                setNewPost({ origin: '', destination: '', askingPrice: '', description: '', weight: '', cargoType: '', vehicleNeeded: '', pickupDate: '', vehicleType: '', capacity: '', plateNo: '', availableDate: '', departureTime: '', photos: [] });
                setShowPostModal(true);
              }} className="lg:hidden w-full mb-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg">
                <Plus size={20} /> {userRole === 'shipper' ? 'Post Cargo' : 'Post Truck'}
              </button>

              {/* Mobile Route Optimizer Button for Truckers */}
              {userRole === 'trucker' && (
                <button
                  onClick={() => setShowRouteOptimizer(true)}
                  className={`lg:hidden w-full mb-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 border-2 border-dashed ${
                    darkMode
                      ? 'border-green-700 bg-green-900/20 text-green-400 hover:bg-green-900/40'
                      : 'border-green-400 bg-green-50 text-green-700 hover:bg-green-100'
                  } transition`}
                >
                  <Waypoints size={20} /> Find Backloads & Optimize Route
                </button>
              )}

              {/* Desktop Header for Listings */}
              <div className="hidden lg:flex lg:items-center lg:justify-between lg:mb-6">
                <div>
                  <h2 className={`text-xl font-bold ${theme.text}`}>
                    {activeMarket === 'cargo' ? '📦 Available Cargo' : '🚛 Available Trucks'}
                  </h2>
                  <p className={`text-sm ${theme.textMuted}`}>
                    {activeMarket === 'cargo'
                      ? `${cargoListings.filter(c => c.status === 'open').length} cargo listings available`
                      : `${truckListings.filter(t => t.status === 'open').length} trucks available`
                    }
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {activeMarket === 'cargo' ? (
                  cargoListings.map(cargo => <ListingCard key={cargo.id} listing={cargo} canBid={userRole === 'trucker'} />)
                ) : (
                  truckListings.map(truck => <ListingCard key={truck.id} listing={truck} canBid={userRole === 'shipper'} />)
                )}
              </div>
            </>
          )}

        {activeTab === 'tracking' && <TrackingTab />}
        {activeTab === 'profile' && <ProfileTab />}
        
        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className={`text-lg font-bold ${theme.text}`}>🔔 All Notifications</h2>
              {unreadCount > 0 && (
                <button onClick={markAllAsRead} className="text-sm text-amber-500 font-medium">
                  Mark all as read
                </button>
              )}
            </div>
            
            {/* Filter Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {['All', 'Bids', 'Messages', 'Shipments'].map((filter) => (
                <button 
                  key={filter}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                    filter === 'All' 
                      ? 'bg-amber-500 text-white' 
                      : `${theme.bgSecondary} ${theme.textSecondary}`
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
            
            {/* Notifications List */}
            <div className="space-y-3">
              {roleNotifications.length === 0 ? (
                <div className={`${theme.bgCard} rounded-2xl p-8 text-center border ${theme.border}`}>
                  <Bell size={48} className={`mx-auto ${theme.textMuted} mb-3`} />
                  <p className={theme.textMuted}>No notifications yet</p>
                  <p className={`text-sm ${theme.textMuted} mt-1`}>
                    {userRole === 'shipper' 
                      ? "You'll be notified when truckers bid on your cargo"
                      : "You'll be notified when shippers post cargo on your routes"
                    }
                  </p>
                </div>
              ) : (
                roleNotifications.map((notification) => {
                  const IconComponent = getNotificationIcon(notification.type);
                  const typeConfig = notificationTypes[notification.type];
                  
                  return (
                    <div 
                      key={notification.id}
                      onClick={() => markAsRead(notification.id)}
                      className={`${theme.bgCard} rounded-xl p-4 border ${theme.border} cursor-pointer transition ${
                        !notification.read ? (darkMode ? 'border-amber-800' : 'border-amber-300') : ''
                      }`}
                    >
                      <div className="flex gap-3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${darkMode ? typeConfig.bgDark : typeConfig.bgLight}`}>
                          <IconComponent size={20} className={typeConfig.color} />
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className={`font-semibold ${theme.text}`}>{notification.title}</p>
                              <p className={`text-sm ${theme.textSecondary}`}>{notification.message}</p>
                            </div>
                            {!notification.read && (
                              <span className="w-3 h-3 bg-amber-500 rounded-full flex-shrink-0"></span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-3 mt-2">
                            <span className={`text-xs ${theme.bgSecondary} px-2 py-1 rounded ${theme.textMuted}`}>
                              {notification.route}
                            </span>
                            {notification.amount && (
                              <span className="text-sm font-bold text-amber-500">
                                ₱{notification.amount.toLocaleString()}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex justify-between items-center mt-2">
                            <p className={`text-xs ${theme.textMuted}`}>{notification.time}</p>
                            <button className="text-xs text-amber-500 font-medium">
                              {notification.actionType === 'view_bid' && 'View Bid →'}
                              {notification.actionType === 'view_cargo' && 'View Cargo →'}
                              {notification.actionType === 'view_truck' && 'View Truck →'}
                              {notification.actionType === 'open_chat' && 'Open Chat →'}
                              {notification.actionType === 'track_shipment' && 'Track →'}
                              {notification.actionType === 'rate_delivery' && 'Rate Now →'}
                              {notification.actionType === 'view_contract' && 'View Contract →'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </main>
      </div>

      {/* Bottom Nav - Mobile Only */}
      <nav className={`lg:hidden fixed bottom-0 left-0 right-0 ${theme.bgCard} border-t ${theme.border} z-40`}>
        <div className="w-full max-w-7xl mx-auto flex justify-around py-2 px-4 sm:px-6 lg:px-8">
          {[
            { tab: 'home', icon: Home, label: 'Home', badge: 0 },
            { tab: 'tracking', icon: MapPinned, label: 'Tracking', badge: activeShipments.filter(s => s.status !== 'delivered').length },
            { tab: 'notifications', icon: Bell, label: 'Alerts', badge: unreadCount },
            { tab: 'profile', icon: User, label: 'Profile', badge: 0 }
          ].map(({ tab, icon: Icon, label, badge }) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition relative ${activeTab === tab ? 'text-amber-500' : theme.textMuted}`}>
              <div className="relative">
                <Icon size={20} />
                {badge > 0 && (
                  <span className="absolute -top-1 -right-2 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[10px] text-white font-bold">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </div>
              <span className="text-xs font-medium">{label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Post Modal */}
      {showPostModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className={`${theme.bgCard} rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl`}>
            <div className={`sticky top-0 ${theme.bgCard} p-4 border-b ${theme.borderLight} flex justify-between items-center`}>
              <h2 className={`text-xl font-bold ${theme.text}`}>{userRole === 'shipper' ? '📦 Post Cargo' : '🚛 Post Truck'}</h2>
              <button onClick={() => setShowPostModal(false)} className={`${theme.bgSecondary} p-2 rounded-full`}><X size={20} className={theme.textSecondary} /></button>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-sm ${theme.textSecondary} mb-1 font-medium`}>Origin *</label>
                  <select value={newPost.origin} onChange={e => setNewPost({...newPost, origin: e.target.value})} className={`w-full ${theme.input} border rounded-xl px-3 py-2.5`}>
                    <option value="">Select...</option>
                    {cities.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className={`block text-sm ${theme.textSecondary} mb-1 font-medium`}>Destination *</label>
                  <select value={newPost.destination} onChange={e => setNewPost({...newPost, destination: e.target.value})} className={`w-full ${theme.input} border rounded-xl px-3 py-2.5`}>
                    <option value="">Select...</option>
                    {cities.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {newPost.origin && newPost.destination && (
                <RouteMap origin={newPost.origin} destination={newPost.destination} originCoords={getCoordinates(newPost.origin)} destCoords={getCoordinates(newPost.destination)} darkMode={darkMode} onClick={() => {}} />
              )}

              {userRole === 'shipper' ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={`block text-sm ${theme.textSecondary} mb-1 font-medium`}>Weight (tons)</label>
                      <input type="number" value={newPost.weight} onChange={e => setNewPost({...newPost, weight: e.target.value})} className={`w-full ${theme.input} border rounded-xl px-3 py-2.5`} />
                    </div>
                    <div>
                      <label className={`block text-sm ${theme.textSecondary} mb-1 font-medium`}>Cargo Type</label>
                      <select value={newPost.cargoType} onChange={e => setNewPost({...newPost, cargoType: e.target.value})} className={`w-full ${theme.input} border rounded-xl px-3 py-2.5`}>
                        <option value="">Select...</option>
                        {cargoTypes.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className={`block text-sm ${theme.textSecondary} mb-1 font-medium`}>Vehicle Needed</label>
                    <select value={newPost.vehicleNeeded} onChange={e => setNewPost({...newPost, vehicleNeeded: e.target.value})} className={`w-full ${theme.input} border rounded-xl px-3 py-2.5`}>
                      <option value="">Select...</option>
                      {vehicleTypes.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={`block text-sm ${theme.textSecondary} mb-1 font-medium`}>Pickup Date</label>
                    <input type="date" value={newPost.pickupDate} onChange={e => setNewPost({...newPost, pickupDate: e.target.value})} className={`w-full ${theme.input} border rounded-xl px-3 py-2.5`} />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={`block text-sm ${theme.textSecondary} mb-1 font-medium`}>Vehicle Type</label>
                      <select value={newPost.vehicleType} onChange={e => setNewPost({...newPost, vehicleType: e.target.value})} className={`w-full ${theme.input} border rounded-xl px-3 py-2.5`}>
                        <option value="">Select...</option>
                        {vehicleTypes.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={`block text-sm ${theme.textSecondary} mb-1 font-medium`}>Capacity (tons)</label>
                      <input type="number" value={newPost.capacity} onChange={e => setNewPost({...newPost, capacity: e.target.value})} className={`w-full ${theme.input} border rounded-xl px-3 py-2.5`} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={`block text-sm ${theme.textSecondary} mb-1 font-medium`}>Available Date</label>
                      <input type="date" value={newPost.availableDate} onChange={e => setNewPost({...newPost, availableDate: e.target.value})} className={`w-full ${theme.input} border rounded-xl px-3 py-2.5`} />
                    </div>
                    <div>
                      <label className={`block text-sm ${theme.textSecondary} mb-1 font-medium`}>Departure Time</label>
                      <input type="time" value={newPost.departureTime} onChange={e => setNewPost({...newPost, departureTime: e.target.value})} className={`w-full ${theme.input} border rounded-xl px-3 py-2.5`} />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className={`block text-sm ${theme.textSecondary} mb-1 font-medium`}>{userRole === 'shipper' ? 'Willing to Pay (₱) *' : 'Asking Rate (₱) *'}</label>
                <input type="number" value={newPost.askingPrice} onChange={e => setNewPost({...newPost, askingPrice: e.target.value})} placeholder="15000" className={`w-full ${theme.input} border rounded-xl px-3 py-3 text-xl font-bold`} />
              </div>

              <div>
                <label className={`block text-sm ${theme.textSecondary} mb-1 font-medium`}>Description</label>
                <textarea value={newPost.description} onChange={e => setNewPost({...newPost, description: e.target.value})} placeholder="Additional details..." rows={2} className={`w-full ${theme.input} border rounded-xl px-3 py-2.5`} />
              </div>

              {/* Photo Upload for Shippers */}
              {userRole === 'shipper' && (
                <PhotoUploader 
                  photos={newPost.photos} 
                  onPhotosChange={(photos) => setNewPost({...newPost, photos})} 
                  maxPhotos={5}
                />
              )}

              <button onClick={handlePost} disabled={!newPost.origin || !newPost.destination || !newPost.askingPrice} className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white py-3 rounded-xl font-bold shadow-lg disabled:opacity-50">
                Post {userRole === 'shipper' ? 'Cargo' : 'Truck'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bid Modal */}
      {showBidModal && selectedListing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className={`${theme.bgCard} rounded-2xl w-full max-w-md shadow-2xl`}>
            <div className={`p-4 border-b ${theme.borderLight} flex justify-between items-center`}>
              <h2 className={`text-xl font-bold ${theme.text}`}>Place Your Bid</h2>
              <button onClick={() => setShowBidModal(false)} className={`${theme.bgSecondary} p-2 rounded-full`}><X size={20} className={theme.textSecondary} /></button>
            </div>
            
            <div className="p-4 space-y-4">
              <div className={`${theme.bgSecondary} rounded-xl p-3`}>
                <p className={`font-semibold ${theme.text}`}>{selectedListing.origin} → {selectedListing.destination}</p>
                <p className="text-xl font-bold text-amber-500 mt-1">
                  {selectedListing.type === 'cargo' ? 'Offers' : 'Asks'}: ₱{selectedListing.askingPrice.toLocaleString()}
                </p>
              </div>

              <RouteMap origin={selectedListing.origin} destination={selectedListing.destination} originCoords={selectedListing.originCoords} destCoords={selectedListing.destCoords} darkMode={darkMode} onClick={() => {}} />

              <div>
                <label className={`block text-sm ${theme.textSecondary} mb-1 font-medium`}>Your Bid (₱)</label>
                <input type="number" value={bidAmount} onChange={e => setBidAmount(e.target.value)} placeholder="Enter amount" className={`w-full ${theme.input} border rounded-xl px-4 py-3 text-xl font-bold`} />
                {bidAmount && (
                  <p className={`text-sm mt-1 flex items-center gap-1 ${parseFloat(bidAmount) > selectedListing.askingPrice ? 'text-green-500' : parseFloat(bidAmount) < selectedListing.askingPrice ? 'text-red-500' : theme.textMuted}`}>
                    {parseFloat(bidAmount) > selectedListing.askingPrice ? <TrendingUp size={14} /> : parseFloat(bidAmount) < selectedListing.askingPrice ? <TrendingDown size={14} /> : <Minus size={14} />}
                    {Math.abs(((parseFloat(bidAmount) - selectedListing.askingPrice) / selectedListing.askingPrice) * 100).toFixed(0)}% {parseFloat(bidAmount) > selectedListing.askingPrice ? 'higher' : parseFloat(bidAmount) < selectedListing.askingPrice ? 'lower' : 'match'}
                  </p>
                )}
              </div>

              {userRole === 'shipper' && selectedListing.type === 'truck' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-sm ${theme.textSecondary} mb-1 font-medium`}>Cargo Type</label>
                    <select value={bidCargoType} onChange={e => setBidCargoType(e.target.value)} className={`w-full ${theme.input} border rounded-xl px-3 py-2`}>
                      <option value="">Select...</option>
                      {cargoTypes.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={`block text-sm ${theme.textSecondary} mb-1 font-medium`}>Weight</label>
                    <input type="number" value={bidCargoWeight} onChange={e => setBidCargoWeight(e.target.value)} placeholder="tons" className={`w-full ${theme.input} border rounded-xl px-3 py-2`} />
                  </div>
                </div>
              )}

              <div>
                <label className={`block text-sm ${theme.textSecondary} mb-1 font-medium`}>Message</label>
                <textarea value={bidMessage} onChange={e => setBidMessage(e.target.value)} placeholder="Why should they accept?" rows={2} className={`w-full ${theme.input} border rounded-xl px-3 py-2`} />
              </div>

              {/* Platform Fee Notice for Truckers */}
              {userRole === 'trucker' && selectedListing.type === 'cargo' && bidAmount && (
                <div className={`${darkMode ? 'bg-amber-900/20 border-amber-800' : 'bg-amber-50 border-amber-200'} border rounded-xl p-3`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className={`text-sm ${theme.textSecondary}`}>Platform Fee (3%)</span>
                    <span className={`font-bold text-amber-600`}>₱{Math.round(parseFloat(bidAmount) * PLATFORM_FEE_RATE).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className={`text-sm ${theme.textSecondary}`}>Your Net Earnings</span>
                    <span className={`font-bold text-green-500`}>₱{Math.round(parseFloat(bidAmount) * (1 - PLATFORM_FEE_RATE)).toLocaleString()}</span>
                  </div>
                  <div className={`flex items-center gap-2 text-xs ${theme.textMuted} pt-2 border-t ${theme.borderLight}`}>
                    <PesoIcon size={12} />
                    <span>Wallet Balance: <strong className={walletBalance >= Math.round(parseFloat(bidAmount) * PLATFORM_FEE_RATE) ? 'text-green-500' : 'text-red-500'}>₱{walletBalance.toLocaleString()}</strong></span>
                    {walletBalance < Math.round(parseFloat(bidAmount) * PLATFORM_FEE_RATE) && (
                      <span className="text-red-500">(Insufficient!)</span>
                    )}
                  </div>
                </div>
              )}

              <button onClick={handleBid} disabled={!bidAmount || (userRole === 'trucker' && selectedListing.type === 'cargo' && walletBalance < Math.round(parseFloat(bidAmount || 0) * PLATFORM_FEE_RATE))} className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white py-3 rounded-xl font-bold shadow-lg disabled:opacity-50">
                {userRole === 'trucker' && selectedListing.type === 'cargo' && walletBalance < Math.round(parseFloat(bidAmount || 0) * PLATFORM_FEE_RATE) 
                  ? 'Top Up Wallet First' 
                  : 'Submit Bid'}
              </button>
              
              {userRole === 'trucker' && walletBalance < MINIMUM_WALLET_BALANCE && (
                <button 
                  onClick={() => { setShowBidModal(false); setShowTopUpModal(true); }}
                  className={`w-full mt-2 ${theme.bgSecondary} ${theme.text} py-2 rounded-xl font-medium text-sm`}
                >
                  + Top Up Wallet
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Chat Modal */}
      {showChatModal && selectedListing && selectedBid && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className={`${theme.bgCard} rounded-2xl w-full max-w-lg h-[80vh] flex flex-col shadow-2xl`}>
            <div className={`p-4 border-b ${theme.borderLight} flex justify-between items-center`}>
              <div>
                <h2 className={`font-bold ${theme.text} flex items-center gap-2`}>Private Chat <Lock size={14} className="text-blue-500" /></h2>
                <p className={theme.textMuted}>with {selectedBid.bidder}</p>
              </div>
              <button onClick={() => setShowChatModal(false)} className={`${theme.bgSecondary} p-2 rounded-full`}><X size={20} className={theme.textSecondary} /></button>
            </div>

            <div className={`${darkMode ? 'bg-amber-900/10' : 'bg-amber-50'} px-4 py-2 flex items-center gap-2 text-sm border-b ${darkMode ? 'border-amber-900/30' : 'border-amber-100'}`}>
              <Shield size={16} className="text-amber-500" />
              <span className={darkMode ? 'text-amber-400' : 'text-amber-700'}>Contact info hidden until contract</span>
            </div>

            <div className={`flex-1 overflow-y-auto p-4 space-y-3 ${theme.bgTertiary}`}>
              {selectedBid.chatHistory.length === 0 && <p className={`text-center ${theme.textMuted} py-8`}>Start negotiating!</p>}
              {selectedBid.chatHistory.map(msg => (
                <div key={msg.id} className={`flex ${msg.sender === userRole ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${msg.sender === userRole ? 'bg-amber-500 text-white' : `${theme.bgCard} border ${theme.border}`}`}>
                    <p className={msg.sender !== userRole ? theme.text : ''}>{maskContact(msg.text)}</p>
                    <p className={`text-xs mt-1 ${msg.sender === userRole ? 'text-amber-100' : theme.textMuted}`}>{msg.time}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className={`p-4 border-t ${theme.borderLight}`}>
              <div className="flex gap-2">
                <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && sendChat()} placeholder="Type message..." className={`flex-1 ${theme.input} border rounded-full px-4 py-2.5`} />
                <button onClick={sendChat} className="bg-amber-500 text-white p-2.5 rounded-full shadow-lg"><Send size={20} /></button>
              </div>
              {selectedBid.status === 'accepted' && (
                <button onClick={() => { setShowChatModal(false); setContractSigned(false); setShowContractModal(true); }} className="w-full mt-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white py-3 rounded-xl font-bold shadow-lg">
                  Generate Contract
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Contract Modal */}
      {showContractModal && selectedListing && selectedBid && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className={`${theme.bgCard} rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl`}>
            <div className={`sticky top-0 ${theme.bgCard} p-4 border-b ${theme.borderLight} flex justify-between items-center`}>
              <h2 className={`text-xl font-bold ${theme.text} flex items-center gap-2`}><FileText className="text-amber-500" /> Contract</h2>
              <button onClick={() => setShowContractModal(false)} className={`${theme.bgSecondary} p-2 rounded-full`}><X size={20} className={theme.textSecondary} /></button>
            </div>

            <div className="p-4">
              <div className={`${theme.bgSecondary} rounded-xl p-6 space-y-4 text-sm border ${theme.border}`}>
                <div className={`text-center border-b ${theme.borderLight} pb-4`}>
                  <h3 className="text-xl font-bold text-amber-500">KARGA CONNECT</h3>
                  <p className={theme.textMuted}>Contract No: KC-{Date.now().toString().slice(-8)}</p>
                </div>

                <RouteMap origin={selectedListing.origin} destination={selectedListing.destination} originCoords={selectedListing.originCoords} destCoords={selectedListing.destCoords} darkMode={darkMode} onClick={() => {}} />

                <div className="grid grid-cols-2 gap-4">
                  <div className={`${darkMode ? 'bg-blue-900/20' : 'bg-blue-50'} rounded-xl p-3 border ${darkMode ? 'border-blue-800' : 'border-blue-200'}`}>
                    <p className="text-xs text-blue-500 font-medium">SHIPPER</p>
                    <p className={`font-bold ${theme.text}`}>{selectedListing.type === 'cargo' ? selectedListing.shipper : selectedBid.bidder}</p>
                  </div>
                  <div className={`${darkMode ? 'bg-purple-900/20' : 'bg-purple-50'} rounded-xl p-3 border ${darkMode ? 'border-purple-800' : 'border-purple-200'}`}>
                    <p className="text-xs text-purple-500 font-medium">TRUCKER</p>
                    <p className={`font-bold ${theme.text}`}>{selectedListing.type === 'truck' ? selectedListing.trucker : selectedBid.bidder}</p>
                  </div>
                </div>

                <div className={`${darkMode ? 'bg-green-900/20 border-green-800' : 'bg-green-50 border-green-200'} border rounded-xl p-4`}>
                  <div className="flex justify-between items-center">
                    <span className={darkMode ? 'text-green-400' : 'text-green-700'}>Agreed Rate:</span>
                    <span className="text-2xl font-bold text-green-500">₱{selectedBid.price.toLocaleString()}</span>
                  </div>
                </div>

                {contractSigned && (
                  <div className={`${darkMode ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50 border-blue-200'} border rounded-xl p-4`}>
                    <p className="text-xs text-blue-500 font-medium mb-2 flex items-center gap-1"><Eye size={12} /> CONTACTS REVEALED</p>
                    <div className={`grid grid-cols-2 gap-3 text-xs ${theme.textSecondary}`}>
                      <div>
                        <p className={`font-medium ${theme.text}`}>Shipper:</p>
                        <p><Phone size={10} className="inline" /> {selectedListing.type === 'cargo' ? selectedListing.contact.phone : selectedBid.contact.phone}</p>
                      </div>
                      <div>
                        <p className={`font-medium ${theme.text}`}>Trucker:</p>
                        <p><Phone size={10} className="inline" /> {selectedListing.type === 'truck' ? selectedListing.contact.phone : selectedBid.contact.phone}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className={`grid grid-cols-2 gap-4 pt-4 border-t ${theme.borderLight}`}>
                  <div className="text-center">
                    <div className={`h-12 border-2 border-dashed rounded-xl flex items-center justify-center ${contractSigned ? 'border-green-500 bg-green-500/10' : theme.border}`}>
                      {contractSigned ? <span className="text-green-500 font-bold">✓ SIGNED</span> : <span className={theme.textMuted}>Awaiting</span>}
                    </div>
                    <p className={`text-xs ${theme.textMuted} mt-1`}>Shipper</p>
                  </div>
                  <div className="text-center">
                    <div className={`h-12 border-2 border-dashed rounded-xl flex items-center justify-center ${contractSigned ? 'border-green-500 bg-green-500/10' : theme.border}`}>
                      {contractSigned ? <span className="text-green-500 font-bold">✓ SIGNED</span> : <span className={theme.textMuted}>Awaiting</span>}
                    </div>
                    <p className={`text-xs ${theme.textMuted} mt-1`}>Trucker</p>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                {!contractSigned ? (
                  <button onClick={handleSignContract} className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white py-3 rounded-xl font-bold shadow-lg">
                    Sign Contract
                  </button>
                ) : (
                  <div className="space-y-2">
                    <div className={`${darkMode ? 'bg-green-900/20 text-green-400' : 'bg-green-100 text-green-700'} p-3 rounded-xl text-center font-medium`}>✓ Contract Signed!</div>
                    <a href={`https://www.google.com/maps/dir/${selectedListing.originCoords.lat},${selectedListing.originCoords.lng}/${selectedListing.destCoords.lat},${selectedListing.destCoords.lng}`} target="_blank" rel="noopener noreferrer" className="block w-full bg-blue-600 text-white py-2.5 rounded-xl text-center font-medium shadow-lg">
                      <Navigation size={16} className="inline mr-2" /> Open in Google Maps
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showMapModal && selectedListing && <FullMapModal listing={selectedListing} darkMode={darkMode} onClose={() => setShowMapModal(false)} />}
      {showTrackingModal && selectedShipment && <TrackingMap shipment={selectedShipment} darkMode={darkMode} showFull={true} onClose={() => setShowTrackingModal(false)} />}
      {showRatingModal && selectedShipment && <RatingModal shipment={selectedShipment} onClose={() => setShowRatingModal(false)} onSubmit={handleRatingSubmit} />}
      
      {/* Photo Viewer Modal */}
      {showPhotoViewer && selectedListing && selectedListing.cargoPhotos && (
        <PhotoViewerModal 
          photos={selectedListing.cargoPhotos} 
          initialIndex={selectedPhotoIndex} 
          onClose={() => setShowPhotoViewer(false)} 
        />
      )}
      
      {/* Route Optimizer Modal */}
      {showRouteOptimizer && <RouteOptimizerModal />}
      
      {/* Wallet Modals */}
      {showWalletModal && <WalletModal />}
      {showTopUpModal && <TopUpModal />}
      {showEarningsModal && <EarningsModal />}

      {/* Profile Action Modals */}
      {showEditProfileModal && <EditProfileModal />}
      {showVerificationModal && <VerificationModal />}
      {showTermsModal && <TermsModal />}
    </div>
  );
}
