import { Router } from 'express';
import bcrypt from 'bcryptjs';
import admin from 'firebase-admin';
import { db } from '../config/firestore.js';
import { User, ShipperProfile, TruckerProfile, BrokerProfile, Wallet } from '../models/index.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';

const router = Router();

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { phone, email, password, name, role = 'shipper' } = req.body;

    // Validate required fields
    if (!phone || !password || !name) {
      return res.status(400).json({ error: 'Phone, password, and name are required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ where: { phone } });
    if (existingUser) {
      return res.status(400).json({ error: 'Phone number already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
      phone,
      email,
      password: hashedPassword,
      name,
      role,
    });

    // Create profile based on role
    if (role === 'shipper') {
      await ShipperProfile.create({ userId: user.id, businessName: name });
    } else if (role === 'trucker') {
      await TruckerProfile.create({ userId: user.id, businessName: name });
    }

    // Create wallet for all users
    await Wallet.create({ userId: user.id, balance: 0 });

    // Generate token
    const token = generateToken(user);

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ error: 'Phone and password are required' });
    }

    // Find user
    const user = await User.findOne({
      where: { phone },
      include: [
        { model: ShipperProfile, as: 'shipperProfile' },
        { model: TruckerProfile, as: 'truckerProfile' },
        { model: BrokerProfile, as: 'brokerProfile' },
        { model: Wallet, as: 'wallet' },
      ],
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid phone or password' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid phone or password' });
    }

    // Generate token
    const token = generateToken(user);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        name: user.name,
        role: user.role,
        shipperProfile: user.shipperProfile,
        truckerProfile: user.truckerProfile,
        brokerProfile: user.brokerProfile,
        wallet: user.wallet,
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user profile
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;

    // Get user document from Firestore
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();

    // Build user object (exclude password)
    const { password, ...userWithoutPassword } = userData;
    const user = {
      id: userId,
      ...userWithoutPassword
    };

    res.json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Update user profile
router.put('/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { name, email, facebookUrl, profileImage } = req.body;

    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update user document
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (facebookUrl !== undefined) updateData.facebookUrl = facebookUrl;
    if (profileImage !== undefined) updateData.profileImage = profileImage;
    updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await userRef.update(updateData);

    // Get updated user data
    const updatedDoc = await userRef.get();
    const userData = updatedDoc.data();

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: userId,
        phone: userData.phone,
        email: userData.email,
        name: userData.name,
        role: userData.role,
        facebookUrl: userData.facebookUrl,
        profileImage: userData.profileImage,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Switch user role
router.post('/switch-role', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { role } = req.body;

    if (!['shipper', 'trucker'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();

    // Update user role in Firestore
    await userRef.update({
      role,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Note: In Firestore architecture, profile data is embedded in user document
    // No separate profile documents needed

    // Generate legacy JWT only when explicitly configured.
    // Firebase ID tokens are the primary auth mechanism.
    let token = null;
    if (process.env.JWT_SECRET) {
      token = generateToken({ id: userId, phone: userData.phone, name: userData.name, role });
    }

    res.json({
      message: 'Role switched successfully',
      role,
      ...(token ? { token } : {}),
    });
  } catch (error) {
    console.error('Switch role error:', error);
    res.status(500).json({ error: 'Failed to switch role' });
  }
});

// Register as broker
router.post('/register-broker', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;

    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();

    // Check if already a broker
    if (userData.brokerProfile) {
      return res.status(400).json({ error: 'Already registered as broker' });
    }

    // Generate unique referral code
    const prefix = userData.role === 'shipper' ? 'SHP' : 'TRK';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const random = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const referralCode = `${prefix}${random}`;

    // Create broker profile (embedded in user document)
    const brokerProfile = {
      referralCode,
      tier: 'STARTER',
      totalEarnings: 0,
      pendingEarnings: 0,
      availableBalance: 0,
      totalReferrals: 0,
      totalTransactions: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await userRef.update({
      brokerProfile,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(201).json({
      message: 'Registered as broker successfully',
      brokerProfile: {
        referralCode: brokerProfile.referralCode,
        tier: brokerProfile.tier,
        totalEarnings: brokerProfile.totalEarnings,
      },
    });
  } catch (error) {
    console.error('Register broker error:', error);
    res.status(500).json({ error: 'Failed to register as broker' });
  }
});

export default router;
