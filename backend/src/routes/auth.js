import { Router } from 'express';
import bcrypt from 'bcryptjs';
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
    const user = await User.findByPk(req.user.id, {
      include: [
        { model: ShipperProfile, as: 'shipperProfile' },
        { model: TruckerProfile, as: 'truckerProfile' },
        { model: BrokerProfile, as: 'brokerProfile' },
        { model: Wallet, as: 'wallet' },
      ],
      attributes: { exclude: ['password'] },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Update user profile
router.put('/me', authenticateToken, async (req, res) => {
  try {
    const { name, email, facebookUrl, profileImage } = req.body;

    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await user.update({ name, email, facebookUrl, profileImage });

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        name: user.name,
        role: user.role,
        facebookUrl: user.facebookUrl,
        profileImage: user.profileImage,
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
    const { role } = req.body;

    if (!['shipper', 'trucker'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create profile for new role if doesn't exist
    if (role === 'shipper') {
      const existing = await ShipperProfile.findOne({ where: { userId: user.id } });
      if (!existing) {
        await ShipperProfile.create({ userId: user.id, businessName: user.name });
      }
    } else if (role === 'trucker') {
      const existing = await TruckerProfile.findOne({ where: { userId: user.id } });
      if (!existing) {
        await TruckerProfile.create({ userId: user.id, businessName: user.name });
      }
    }

    await user.update({ role });

    // Generate new token with updated role
    const token = generateToken({ ...user.toJSON(), role });

    res.json({
      message: 'Role switched successfully',
      role,
      token,
    });
  } catch (error) {
    console.error('Switch role error:', error);
    res.status(500).json({ error: 'Failed to switch role' });
  }
});

// Register as broker
router.post('/register-broker', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if already a broker
    const existingBroker = await BrokerProfile.findOne({ where: { userId: user.id } });
    if (existingBroker) {
      return res.status(400).json({ error: 'Already registered as broker' });
    }

    // Generate unique referral code
    const prefix = user.role === 'shipper' ? 'SHP' : 'TRK';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const random = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const referralCode = `${prefix}${random}`;

    // Create broker profile
    const brokerProfile = await BrokerProfile.create({
      userId: user.id,
      referralCode,
      tier: 'STARTER',
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
