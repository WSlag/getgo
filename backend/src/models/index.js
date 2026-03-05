import { Sequelize, DataTypes } from 'sequelize';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize SQLite database
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: join(__dirname, '../../database.sqlite'),
  logging: false,
});

// User Model
const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  phone: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM('shipper', 'trucker', 'broker'),
    defaultValue: 'shipper',
  },
  profileImage: DataTypes.STRING,
  facebookUrl: DataTypes.STRING,
  isVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
});

// Shipper Profile
const ShipperProfile = sequelize.define('ShipperProfile', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  businessName: DataTypes.STRING,
  businessAddress: DataTypes.STRING,
  businessType: DataTypes.STRING,
  totalTransactions: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  membershipTier: {
    type: DataTypes.ENUM('NEW', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'),
    defaultValue: 'NEW',
  },
});

// Trucker Profile
const TruckerProfile = sequelize.define('TruckerProfile', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  businessName: DataTypes.STRING,
  licenseNumber: DataTypes.STRING,
  licenseExpiry: DataTypes.DATE,
  rating: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  totalTrips: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  badge: {
    type: DataTypes.ENUM('STARTER', 'ACTIVE', 'VERIFIED', 'PRO', 'ELITE'),
    defaultValue: 'STARTER',
  },
});

// Broker Profile
const BrokerProfile = sequelize.define('BrokerProfile', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  referralCode: {
    type: DataTypes.STRING,
    unique: true,
  },
  tier: {
    type: DataTypes.ENUM('STARTER', 'SILVER', 'GOLD', 'PLATINUM'),
    defaultValue: 'STARTER',
  },
  totalEarnings: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
  },
  pendingEarnings: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
  },
  availableBalance: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
  },
  totalReferrals: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  totalTransactions: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
});

// Wallet
const Wallet = sequelize.define('Wallet', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  balance: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
  },
});

// Wallet Transaction
const WalletTransaction = sequelize.define('WalletTransaction', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  type: {
    type: DataTypes.ENUM('topup', 'fee', 'payout', 'refund'),
    allowNull: false,
  },
  amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  method: DataTypes.STRING,
  description: DataTypes.STRING,
  reference: DataTypes.STRING,
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'failed'),
    defaultValue: 'pending',
  },
});

// Vehicle
const Vehicle = sequelize.define('Vehicle', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  type: DataTypes.STRING,
  plateNumber: DataTypes.STRING,
  capacity: DataTypes.FLOAT,
  capacityUnit: {
    type: DataTypes.STRING,
    defaultValue: 'tons',
  },
  orCrNumber: DataTypes.STRING,
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
});

// Cargo Listing
const CargoListing = sequelize.define('CargoListing', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  origin: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  destination: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  originLat: DataTypes.FLOAT,
  originLng: DataTypes.FLOAT,
  destLat: DataTypes.FLOAT,
  destLng: DataTypes.FLOAT,
  cargoType: DataTypes.STRING,
  weight: DataTypes.FLOAT,
  weightUnit: {
    type: DataTypes.STRING,
    defaultValue: 'tons',
  },
  vehicleNeeded: DataTypes.STRING,
  askingPrice: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  description: DataTypes.TEXT,
  pickupDate: DataTypes.DATE,
  photos: {
    type: DataTypes.TEXT,
    get() {
      const value = this.getDataValue('photos');
      return value ? JSON.parse(value) : [];
    },
    set(value) {
      this.setDataValue('photos', JSON.stringify(value));
    },
  },
  status: {
    type: DataTypes.ENUM('open', 'negotiating', 'contracted', 'in_transit', 'delivered', 'cancelled'),
    defaultValue: 'open',
  },
});

// Truck Listing
const TruckListing = sequelize.define('TruckListing', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  origin: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  destination: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  originLat: DataTypes.FLOAT,
  originLng: DataTypes.FLOAT,
  destLat: DataTypes.FLOAT,
  destLng: DataTypes.FLOAT,
  vehicleType: DataTypes.STRING,
  capacity: DataTypes.FLOAT,
  capacityUnit: {
    type: DataTypes.STRING,
    defaultValue: 'tons',
  },
  plateNumber: DataTypes.STRING,
  askingPrice: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  description: DataTypes.TEXT,
  availableDate: DataTypes.DATE,
  departureTime: DataTypes.STRING,
  status: {
    type: DataTypes.ENUM('open', 'negotiating', 'contracted', 'in_transit', 'completed', 'cancelled'),
    defaultValue: 'open',
  },
});

// Bid
const Bid = sequelize.define('Bid', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  listingType: {
    type: DataTypes.ENUM('cargo', 'truck'),
    allowNull: false,
  },
  price: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  message: DataTypes.TEXT,
  cargoType: DataTypes.STRING,
  cargoWeight: DataTypes.FLOAT,
  status: {
    type: DataTypes.ENUM('pending', 'accepted', 'rejected', 'withdrawn'),
    defaultValue: 'pending',
  },
});

// Chat Message
const ChatMessage = sequelize.define('ChatMessage', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
});

// Contract
const Contract = sequelize.define('Contract', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  contractNumber: {
    type: DataTypes.STRING,
    unique: true,
  },
  agreedPrice: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  platformFee: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  // Declared cargo value for liability purposes
  declaredCargoValue: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 100000, // Default PHP 100,000 if not declared
  },
  // Shipper signature details
  shipperSignature: DataTypes.STRING,
  shipperSignedAt: DataTypes.DATE,
  shipperSignatureIp: DataTypes.STRING,
  // Trucker signature details
  truckerSignature: DataTypes.STRING,
  truckerSignedAt: DataTypes.DATE,
  truckerSignatureIp: DataTypes.STRING,
  // Contract execution
  signedAt: DataTypes.DATE,
  // Pickup and delivery details
  pickupDate: DataTypes.DATE,
  pickupAddress: DataTypes.STRING,
  deliveryAddress: DataTypes.STRING,
  expectedDeliveryDate: DataTypes.DATE,
  // Cargo details for contract record
  cargoType: DataTypes.STRING,
  cargoWeight: DataTypes.FLOAT,
  cargoWeightUnit: {
    type: DataTypes.STRING,
    defaultValue: 'tons',
  },
  cargoDescription: DataTypes.TEXT,
  specialInstructions: DataTypes.TEXT,
  // Vehicle details
  vehicleType: DataTypes.STRING,
  vehiclePlateNumber: DataTypes.STRING,
  // Terms and conditions
  terms: DataTypes.TEXT,
  // Liability acknowledgment
  liabilityAcknowledged: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  // Dispute details
  disputeReason: DataTypes.TEXT,
  disputeFiledAt: DataTypes.DATE,
  disputeResolvedAt: DataTypes.DATE,
  disputeResolution: DataTypes.TEXT,
  status: {
    type: DataTypes.ENUM('draft', 'signed', 'in_transit', 'completed', 'disputed', 'cancelled'),
    defaultValue: 'draft',
  },
});

// Shipment (for tracking)
const Shipment = sequelize.define('Shipment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  trackingNumber: {
    type: DataTypes.STRING,
    unique: true,
  },
  currentLat: DataTypes.FLOAT,
  currentLng: DataTypes.FLOAT,
  currentLocation: DataTypes.STRING,
  status: {
    type: DataTypes.ENUM('picked_up', 'in_transit', 'delivered'),
    defaultValue: 'picked_up',
  },
  progress: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  eta: DataTypes.DATE,
  deliveredAt: DataTypes.DATE,
});

// Notification
const Notification = sequelize.define('Notification', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  type: {
    type: DataTypes.ENUM('NEW_BID', 'BID_ACCEPTED', 'BID_REJECTED', 'NEW_MESSAGE', 'NEW_CARGO', 'NEW_TRUCK', 'CONTRACT_READY', 'SHIPMENT_UPDATE', 'RATING_REQUEST', 'BADGE_UPGRADE', 'TIER_UPGRADE'),
    allowNull: false,
  },
  title: DataTypes.STRING,
  message: DataTypes.TEXT,
  data: {
    type: DataTypes.TEXT,
    get() {
      const value = this.getDataValue('data');
      return value ? JSON.parse(value) : {};
    },
    set(value) {
      this.setDataValue('data', JSON.stringify(value));
    },
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
});

// Rating
const Rating = sequelize.define('Rating', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  score: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
      max: 5,
    },
  },
  tags: {
    type: DataTypes.TEXT,
    get() {
      const value = this.getDataValue('tags');
      return value ? JSON.parse(value) : [];
    },
    set(value) {
      this.setDataValue('tags', JSON.stringify(value));
    },
  },
  comment: DataTypes.TEXT,
});

// Referral
const Referral = sequelize.define('Referral', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  referralCode: DataTypes.STRING,
  status: {
    type: DataTypes.ENUM('pending', 'active', 'inactive'),
    defaultValue: 'pending',
  },
  totalTransactions: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  totalEarnings: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
  },
});

// Commission Transaction
const CommissionTransaction = sequelize.define('CommissionTransaction', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  type: {
    type: DataTypes.ENUM('commission', 'bonus', 'payout'),
    allowNull: false,
  },
  amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  description: DataTypes.STRING,
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'failed'),
    defaultValue: 'pending',
  },
});

// Define relationships
User.hasOne(ShipperProfile, { foreignKey: 'userId', as: 'shipperProfile' });
ShipperProfile.belongsTo(User, { foreignKey: 'userId' });

User.hasOne(TruckerProfile, { foreignKey: 'userId', as: 'truckerProfile' });
TruckerProfile.belongsTo(User, { foreignKey: 'userId' });

User.hasOne(BrokerProfile, { foreignKey: 'userId', as: 'brokerProfile' });
BrokerProfile.belongsTo(User, { foreignKey: 'userId' });

User.hasOne(Wallet, { foreignKey: 'userId', as: 'wallet' });
Wallet.belongsTo(User, { foreignKey: 'userId' });

Wallet.hasMany(WalletTransaction, { foreignKey: 'walletId', as: 'transactions' });
WalletTransaction.belongsTo(Wallet, { foreignKey: 'walletId' });

User.hasMany(Vehicle, { foreignKey: 'userId', as: 'vehicles' });
Vehicle.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(CargoListing, { foreignKey: 'userId', as: 'cargoListings' });
CargoListing.belongsTo(User, { foreignKey: 'userId', as: 'shipper' });

User.hasMany(TruckListing, { foreignKey: 'userId', as: 'truckListings' });
TruckListing.belongsTo(User, { foreignKey: 'userId', as: 'trucker' });

CargoListing.hasMany(Bid, { foreignKey: 'cargoListingId', as: 'bids' });
Bid.belongsTo(CargoListing, { foreignKey: 'cargoListingId' });

TruckListing.hasMany(Bid, { foreignKey: 'truckListingId', as: 'bids' });
Bid.belongsTo(TruckListing, { foreignKey: 'truckListingId' });

User.hasMany(Bid, { foreignKey: 'bidderId', as: 'myBids' });
Bid.belongsTo(User, { foreignKey: 'bidderId', as: 'bidder' });

Bid.hasMany(ChatMessage, { foreignKey: 'bidId', as: 'chatHistory' });
ChatMessage.belongsTo(Bid, { foreignKey: 'bidId' });

User.hasMany(ChatMessage, { foreignKey: 'senderId', as: 'sentMessages' });
ChatMessage.belongsTo(User, { foreignKey: 'senderId', as: 'sender' });

Bid.hasOne(Contract, { foreignKey: 'bidId', as: 'contract' });
Contract.belongsTo(Bid, { foreignKey: 'bidId' });

Contract.hasOne(Shipment, { foreignKey: 'contractId', as: 'shipment' });
Shipment.belongsTo(Contract, { foreignKey: 'contractId' });

User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'userId' });

Contract.hasMany(Rating, { foreignKey: 'contractId', as: 'ratings' });
Rating.belongsTo(Contract, { foreignKey: 'contractId' });

User.hasMany(Rating, { foreignKey: 'raterId', as: 'givenRatings' });
Rating.belongsTo(User, { foreignKey: 'raterId', as: 'rater' });

User.hasMany(Rating, { foreignKey: 'ratedUserId', as: 'receivedRatings' });
Rating.belongsTo(User, { foreignKey: 'ratedUserId', as: 'ratedUser' });

BrokerProfile.hasMany(Referral, { foreignKey: 'brokerProfileId', as: 'referrals' });
Referral.belongsTo(BrokerProfile, { foreignKey: 'brokerProfileId' });

User.hasMany(Referral, { foreignKey: 'referredUserId', as: 'referredBy' });
Referral.belongsTo(User, { foreignKey: 'referredUserId', as: 'referredUser' });

BrokerProfile.hasMany(CommissionTransaction, { foreignKey: 'brokerProfileId', as: 'commissions' });
CommissionTransaction.belongsTo(BrokerProfile, { foreignKey: 'brokerProfileId' });

Contract.hasMany(CommissionTransaction, { foreignKey: 'contractId', as: 'commissionTransactions' });
CommissionTransaction.belongsTo(Contract, { foreignKey: 'contractId' });

export {
  sequelize,
  User,
  ShipperProfile,
  TruckerProfile,
  BrokerProfile,
  Wallet,
  WalletTransaction,
  Vehicle,
  CargoListing,
  TruckListing,
  Bid,
  ChatMessage,
  Contract,
  Shipment,
  Notification,
  Rating,
  Referral,
  CommissionTransaction,
};
