import bcrypt from 'bcryptjs';
import {
  sequelize,
  User,
  ShipperProfile,
  TruckerProfile,
  BrokerProfile,
  Wallet,
  WalletTransaction,
  CargoListing,
  TruckListing,
  Bid,
  Notification,
} from './models/index.js';

// Philippine city coordinates
const cityCoordinates = {
  'Davao City': { lat: 7.0707, lng: 125.6087 },
  'Cebu City': { lat: 10.3157, lng: 123.8854 },
  'General Santos': { lat: 6.1164, lng: 125.1716 },
  'Cagayan de Oro': { lat: 8.4542, lng: 124.6319 },
  'Manila': { lat: 14.5995, lng: 120.9842 },
  'Zamboanga City': { lat: 6.9214, lng: 122.0790 },
  'Butuan City': { lat: 8.9475, lng: 125.5406 },
  'Tagum City': { lat: 7.4478, lng: 125.8037 },
  'Digos City': { lat: 6.7496, lng: 125.3572 },
  'Cotabato City': { lat: 7.2236, lng: 124.2464 },
};

async function seed() {
  try {
    console.log('Starting database seed...');

    // Sync database
    await sequelize.sync({ force: true }); // This will drop all tables and recreate
    console.log('Database tables created');

    // Create sample users
    const hashedPassword = await bcrypt.hash('password123', 10);

    // Shippers
    const shipper1 = await User.create({
      phone: '09171234567',
      email: 'abc@trading.com',
      password: hashedPassword,
      name: 'ABC Trading Co.',
      role: 'shipper',
    });

    const shipper2 = await User.create({
      phone: '09181234567',
      email: 'fresh@farms.com',
      password: hashedPassword,
      name: 'Fresh Farms Inc.',
      role: 'shipper',
    });

    const shipper3 = await User.create({
      phone: '09191234567',
      email: 'steel@masters.com',
      password: hashedPassword,
      name: 'Steel Masters Corp.',
      role: 'shipper',
    });

    // Create shipper profiles
    await ShipperProfile.create({ userId: shipper1.id, businessName: 'ABC Trading Co.', totalTransactions: 45, membershipTier: 'GOLD' });
    await ShipperProfile.create({ userId: shipper2.id, businessName: 'Fresh Farms Inc.', totalTransactions: 28, membershipTier: 'SILVER' });
    await ShipperProfile.create({ userId: shipper3.id, businessName: 'Steel Masters Corp.', totalTransactions: 12, membershipTier: 'BRONZE' });

    // Truckers
    const trucker1 = await User.create({
      phone: '09271234567',
      email: 'juan@trucking.com',
      password: hashedPassword,
      name: 'Juan Trucking',
      role: 'trucker',
    });

    const trucker2 = await User.create({
      phone: '09281234567',
      email: 'mindanao@haulers.com',
      password: hashedPassword,
      name: 'Mindanao Haulers',
      role: 'trucker',
    });

    const trucker3 = await User.create({
      phone: '09291234567',
      email: 'cdo@express.com',
      password: hashedPassword,
      name: 'CDO Express',
      role: 'trucker',
    });

    const trucker4 = await User.create({
      phone: '09301234567',
      email: 'vismin@logistics.com',
      password: hashedPassword,
      name: 'VisMin Logistics',
      role: 'trucker',
    });

    // Create trucker profiles
    await TruckerProfile.create({ userId: trucker1.id, businessName: 'Juan Trucking', rating: 4.8, totalTrips: 156, badge: 'ELITE' });
    await TruckerProfile.create({ userId: trucker2.id, businessName: 'Mindanao Haulers', rating: 4.5, totalTrips: 89, badge: 'PRO' });
    await TruckerProfile.create({ userId: trucker3.id, businessName: 'CDO Express', rating: 4.2, totalTrips: 34, badge: 'VERIFIED' });
    await TruckerProfile.create({ userId: trucker4.id, businessName: 'VisMin Logistics', rating: 4.9, totalTrips: 212, badge: 'ELITE' });

    // Create wallets for truckers
    const wallet1 = await Wallet.create({ userId: trucker1.id, balance: 1500 });
    const wallet2 = await Wallet.create({ userId: trucker2.id, balance: 2500 });
    const wallet3 = await Wallet.create({ userId: trucker3.id, balance: 800 });
    const wallet4 = await Wallet.create({ userId: trucker4.id, balance: 5000 });

    // Add wallet transactions
    await WalletTransaction.create({ walletId: wallet1.id, type: 'topup', amount: 2000, method: 'GCash', description: 'Top-up via GCash', reference: 'GC-78291', status: 'completed' });
    await WalletTransaction.create({ walletId: wallet1.id, type: 'fee', amount: -500, description: 'Platform fee: Davao → CDO', reference: 'KC-001', status: 'completed' });
    await WalletTransaction.create({ walletId: wallet2.id, type: 'topup', amount: 3000, method: 'Maya', description: 'Top-up via Maya', reference: 'MY-12345', status: 'completed' });
    await WalletTransaction.create({ walletId: wallet2.id, type: 'fee', amount: -500, description: 'Platform fee: GenSan → Davao', reference: 'KC-002', status: 'completed' });

    // Create wallets for shippers too
    await Wallet.create({ userId: shipper1.id, balance: 0 });
    await Wallet.create({ userId: shipper2.id, balance: 0 });
    await Wallet.create({ userId: shipper3.id, balance: 0 });

    // Create cargo listings
    const cargo1 = await CargoListing.create({
      userId: shipper1.id,
      origin: 'Davao City',
      destination: 'Cebu City',
      originLat: cityCoordinates['Davao City'].lat,
      originLng: cityCoordinates['Davao City'].lng,
      destLat: cityCoordinates['Cebu City'].lat,
      destLng: cityCoordinates['Cebu City'].lng,
      cargoType: 'Agricultural Products',
      weight: 12,
      weightUnit: 'tons',
      vehicleNeeded: '10W Wing Van',
      askingPrice: 18000,
      description: 'Fresh fruits and vegetables for distribution. Need careful handling.',
      pickupDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      photos: [
        { id: 1, url: 'https://via.placeholder.com/400x300?text=Cargo+1', caption: 'Cargo ready for pickup' }
      ],
      status: 'open',
    });

    const cargo2 = await CargoListing.create({
      userId: shipper2.id,
      origin: 'General Santos',
      destination: 'Cagayan de Oro',
      originLat: cityCoordinates['General Santos'].lat,
      originLng: cityCoordinates['General Santos'].lng,
      destLat: cityCoordinates['Cagayan de Oro'].lat,
      destLng: cityCoordinates['Cagayan de Oro'].lng,
      cargoType: 'Frozen Goods',
      weight: 8,
      weightUnit: 'tons',
      vehicleNeeded: '6W Refrigerated Van',
      askingPrice: 15000,
      description: 'Frozen tuna for export processing. Requires reefer truck.',
      pickupDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // Tomorrow
      photos: [],
      status: 'open',
    });

    const cargo3 = await CargoListing.create({
      userId: shipper3.id,
      origin: 'Davao City',
      destination: 'Manila',
      originLat: cityCoordinates['Davao City'].lat,
      originLng: cityCoordinates['Davao City'].lng,
      destLat: cityCoordinates['Manila'].lat,
      destLng: cityCoordinates['Manila'].lng,
      cargoType: 'Construction Materials',
      weight: 20,
      weightUnit: 'tons',
      vehicleNeeded: '10W Flatbed',
      askingPrice: 35000,
      description: 'Steel bars and construction materials. Heavy load.',
      pickupDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      photos: [],
      status: 'open',
    });

    // Create truck listings
    const truck1 = await TruckListing.create({
      userId: trucker1.id,
      origin: 'Cebu City',
      destination: 'Davao City',
      originLat: cityCoordinates['Cebu City'].lat,
      originLng: cityCoordinates['Cebu City'].lng,
      destLat: cityCoordinates['Davao City'].lat,
      destLng: cityCoordinates['Davao City'].lng,
      vehicleType: '10W Wing Van',
      capacity: 15,
      capacityUnit: 'tons',
      plateNumber: 'ABC 1234',
      askingPrice: 15000,
      description: 'Returning to Davao after delivery. Can accommodate backload cargo.',
      availableDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      departureTime: '6:00 AM',
      status: 'open',
    });

    const truck2 = await TruckListing.create({
      userId: trucker2.id,
      origin: 'Cagayan de Oro',
      destination: 'General Santos',
      originLat: cityCoordinates['Cagayan de Oro'].lat,
      originLng: cityCoordinates['Cagayan de Oro'].lng,
      destLat: cityCoordinates['General Santos'].lat,
      destLng: cityCoordinates['General Santos'].lng,
      vehicleType: '6W Closed Van',
      capacity: 6,
      capacityUnit: 'tons',
      plateNumber: 'XYZ 5678',
      askingPrice: 12000,
      description: 'Empty truck heading to GenSan. Good for dry goods.',
      availableDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      departureTime: '5:00 AM',
      status: 'open',
    });

    const truck3 = await TruckListing.create({
      userId: trucker4.id,
      origin: 'Manila',
      destination: 'Davao City',
      originLat: cityCoordinates['Manila'].lat,
      originLng: cityCoordinates['Manila'].lng,
      destLat: cityCoordinates['Davao City'].lat,
      destLng: cityCoordinates['Davao City'].lng,
      vehicleType: '10W Container Van',
      capacity: 20,
      capacityUnit: 'tons',
      plateNumber: 'MNL 9012',
      askingPrice: 28000,
      description: 'Long haul from Manila to Davao via RORO. Can handle heavy cargo.',
      availableDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      departureTime: '4:00 AM',
      status: 'open',
    });

    // Create bids
    const bid1 = await Bid.create({
      bidderId: trucker1.id,
      cargoListingId: cargo1.id,
      listingType: 'cargo',
      price: 17500,
      message: 'Can pick up tomorrow morning. Have experience with agricultural products.',
      status: 'pending',
    });

    const bid2 = await Bid.create({
      bidderId: trucker2.id,
      cargoListingId: cargo1.id,
      listingType: 'cargo',
      price: 19000,
      message: 'Available immediately. Will ensure safe delivery.',
      status: 'pending',
    });

    const bid3 = await Bid.create({
      bidderId: shipper1.id,
      truckListingId: truck1.id,
      listingType: 'truck',
      price: 14000,
      message: 'Need to ship electronic appliances. About 8 tons.',
      cargoType: 'Electronics',
      cargoWeight: 8,
      status: 'pending',
    });

    // Create sample notifications
    await Notification.create({
      userId: shipper1.id,
      type: 'NEW_BID',
      title: 'New Bid Received!',
      message: 'Juan Trucking bid ₱17,500 on your Davao → Cebu cargo',
      data: { bidId: bid1.id, listingId: cargo1.id, listingType: 'cargo', price: 17500 },
      isRead: false,
    });

    await Notification.create({
      userId: shipper1.id,
      type: 'NEW_BID',
      title: 'New Bid Received!',
      message: 'Mindanao Haulers bid ₱19,000 on your Davao → Cebu cargo',
      data: { bidId: bid2.id, listingId: cargo1.id, listingType: 'cargo', price: 19000 },
      isRead: false,
    });

    await Notification.create({
      userId: trucker1.id,
      type: 'NEW_BID',
      title: 'New Bid on Your Truck!',
      message: 'ABC Trading Co. wants to book your Cebu → Davao truck for ₱14,000',
      data: { bidId: bid3.id, listingId: truck1.id, listingType: 'truck', price: 14000 },
      isRead: false,
    });

    // Create a broker profile for one user
    await BrokerProfile.create({
      userId: shipper1.id,
      referralCode: 'SHP12345',
      tier: 'SILVER',
      totalEarnings: 8450,
      pendingEarnings: 1200,
      availableBalance: 7250,
      totalReferrals: 12,
      totalTransactions: 34,
    });

    console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║   KARGA CONNECT Database Seeded Successfully!     ║
║                                                   ║
║   Created:                                        ║
║   - 3 Shippers                                    ║
║   - 4 Truckers                                    ║
║   - 3 Cargo Listings                              ║
║   - 3 Truck Listings                              ║
║   - 3 Bids                                        ║
║   - Sample Notifications                          ║
║   - Wallet Transactions                           ║
║                                                   ║
║   Test Accounts:                                  ║
║   Shipper: 09171234567 / password123              ║
║   Trucker: 09271234567 / password123              ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
    `);

    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
}

seed();
