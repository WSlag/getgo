import React, { useState, useEffect } from 'react';
import { Package, Truck, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import AddressSearch from '../maps/AddressSearch';

const VEHICLE_TYPES = [
  '4W Elf/Canter (1-2 tons)',
  '6W Forward/Fighter (5-7 tons)',
  '6W Dropside (4-6 tons)',
  '10W Wing Van (12-15 tons)',
  '10W Flatbed (12-15 tons)',
  '10W Refrigerated Van',
  'Trailer (20-30 tons)',
];

const CARGO_TYPES = [
  'General Merchandise',
  'Fruits & Vegetables',
  'Construction Materials',
  'Electronics',
  'Furniture',
  'Chemicals',
  'Agricultural Products',
  'Other',
];

export function PostModal({
  open,
  onClose,
  currentRole = 'shipper',
  onSubmit,
  loading = false,
  editMode = false,
  existingData = null,
}) {
  const isShipper = currentRole === 'shipper';

  const getInitialFormData = () => ({
    origin: '',
    originCoords: null,
    destination: '',
    destCoords: null,
    weight: '',
    unit: 'tons',
    cargoType: '',
    vehicleType: '',
    askingPrice: '',
    description: '',
    pickupDate: '',
    photos: [],
  });

  const [formData, setFormData] = useState(getInitialFormData());
  const isMobile = !useMediaQuery('(min-width: 640px)');

  // Pre-populate form when editing
  useEffect(() => {
    if (editMode && existingData && open) {
      setFormData({
        origin: existingData.origin || '',
        originCoords: existingData.originCoords || null,
        destination: existingData.destination || '',
        destCoords: existingData.destCoords || null,
        weight: existingData.weight?.toString() || '',
        unit: existingData.unit || 'tons',
        cargoType: existingData.cargoType || '',
        vehicleType: existingData.vehicleType || existingData.vehicleNeeded || '',
        askingPrice: (existingData.askingPrice || existingData.askingRate || existingData.price)?.toString() || '',
        description: existingData.description || '',
        pickupDate: existingData.pickupDate || existingData.availableDate || '',
        photos: existingData.cargoPhotos || existingData.truckPhotos || existingData.photos || [],
        // Keep track of original ID for updates
        id: existingData.id,
      });
    } else if (!editMode && open) {
      setFormData(getInitialFormData());
    }
  }, [editMode, existingData, open]);

  const [errors, setErrors] = useState({});

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleOriginSelect = (location) => {
    if (location) {
      setFormData(prev => ({
        ...prev,
        origin: location.name,
        originCoords: { lat: location.lat, lng: location.lng },
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        origin: '',
        originCoords: null,
      }));
    }
    if (errors.origin) {
      setErrors(prev => ({ ...prev, origin: null }));
    }
  };

  const handleDestSelect = (location) => {
    if (location) {
      setFormData(prev => ({
        ...prev,
        destination: location.name,
        destCoords: { lat: location.lat, lng: location.lng },
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        destination: '',
        destCoords: null,
      }));
    }
    if (errors.destination) {
      setErrors(prev => ({ ...prev, destination: null }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.origin) newErrors.origin = 'Origin is required';
    if (!formData.destination) newErrors.destination = 'Destination is required';
    if (!formData.askingPrice) newErrors.askingPrice = 'Price/Rate is required';
    if (isShipper) {
      if (!formData.weight) newErrors.weight = 'Weight is required';
      if (!formData.cargoType) newErrors.cargoType = 'Cargo type is required';
      if (!formData.vehicleType) newErrors.vehicleType = 'Vehicle type is required';
    } else {
      if (!formData.vehicleType) newErrors.vehicleType = 'Vehicle type is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onSubmit?.(formData);
    }
  };

  const handleClose = () => {
    setFormData(getInitialFormData());
    setErrors({});
    onClose?.();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto backdrop-blur-sm">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn(
              "size-12 rounded-xl flex items-center justify-center shadow-lg",
              isShipper
                ? "bg-gradient-to-br from-orange-400 to-orange-600 shadow-orange-500/30"
                : "bg-gradient-to-br from-blue-400 to-blue-600 shadow-blue-500/30"
            )}>
              {isShipper ? (
                <Package className="size-6 text-white" />
              ) : (
                <Truck className="size-6 text-white" />
              )}
            </div>
            <div>
              <DialogTitle>
                {editMode
                  ? (isShipper ? 'Edit Cargo' : 'Edit Truck')
                  : (isShipper ? 'Post New Cargo' : 'Post Available Truck')}
              </DialogTitle>
              <DialogDescription>
                {editMode
                  ? 'Update your listing details'
                  : isShipper
                    ? 'Describe your cargo and find the right trucker'
                    : 'Share your route and find cargo to haul'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-4" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Route Section - Now using AddressSearch */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
            <AddressSearch
              label="Origin"
              value={formData.origin}
              onChange={(value) => handleChange('origin', value)}
              onSelect={handleOriginSelect}
              placeholder="Search origin city..."
              error={errors.origin}
              required
            />

            <AddressSearch
              label="Destination"
              value={formData.destination}
              onChange={(value) => handleChange('destination', value)}
              onSelect={handleDestSelect}
              placeholder="Search destination..."
              error={errors.destination}
              required
            />
          </div>

          {/* Cargo Details - Shipper only */}
          {isShipper && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                    Cargo Type
                  </label>
                  <select
                    value={formData.cargoType}
                    onChange={(e) => handleChange('cargoType', e.target.value)}
                    className={cn(
                      "w-full h-10 px-3 rounded-xl border bg-input-background text-sm focus:ring-2 focus:ring-ring focus:ring-offset-2 outline-none",
                      errors.cargoType ? "border-red-500" : "border-border"
                    )}
                  >
                    <option value="">Select type</option>
                    {CARGO_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  {errors.cargoType && <p className="text-xs text-red-500 mt-1">{errors.cargoType}</p>}
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                    Weight
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      placeholder="0"
                      value={formData.weight}
                      onChange={(e) => handleChange('weight', e.target.value)}
                      className={cn("pr-12", errors.weight && "border-red-500")}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                      tons
                    </span>
                  </div>
                  {errors.weight && <p className="text-xs text-red-500 mt-1">{errors.weight}</p>}
                </div>
              </div>
            </>
          )}

          {/* Vehicle Type */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
              {isShipper ? 'Vehicle Needed' : 'Vehicle Type'}
            </label>
            <select
              value={formData.vehicleType}
              onChange={(e) => handleChange('vehicleType', e.target.value)}
              className={cn(
                "w-full h-10 px-3 rounded-xl border bg-input-background text-sm focus:ring-2 focus:ring-ring focus:ring-offset-2 outline-none",
                errors.vehicleType ? "border-red-500" : "border-border"
              )}
            >
              <option value="">Select vehicle</option>
              {VEHICLE_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            {errors.vehicleType && <p className="text-xs text-red-500 mt-1">{errors.vehicleType}</p>}
          </div>

          {/* Price & Date */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                {isShipper ? 'Budget / Asking Price' : 'Rate'}
              </label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="0"
                  value={formData.askingPrice}
                  onChange={(e) => handleChange('askingPrice', e.target.value)}
                  className={cn("pr-12", errors.askingPrice && "border-red-500")}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                  PHP
                </span>
              </div>
              {errors.askingPrice && <p className="text-xs text-red-500 mt-1">{errors.askingPrice}</p>}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                {isShipper ? 'Pickup Date' : 'Available Date'}
              </label>
              <Input
                type="date"
                value={formData.pickupDate}
                onChange={(e) => handleChange('pickupDate', e.target.value)}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
              Description
            </label>
            <Textarea
              placeholder={isShipper
                ? "Describe your cargo (packaging, special handling needs, etc.)"
                : "Describe your truck (capacity, features, route experience, etc.)"
              }
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              className="min-h-[80px]"
            />
          </div>

          {/* Photo Upload Placeholder */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
              Photos (Optional)
            </label>
            <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-6 text-center hover:border-orange-400 hover:bg-orange-50/50 dark:hover:bg-orange-900/10 transition-all duration-300 cursor-pointer group">
              <Camera className="size-8 text-gray-400 mx-auto mb-2 group-hover:text-orange-500 transition-colors duration-300" />
              <p className="text-sm text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors duration-300">
                Click to upload photos
              </p>
              <p className="text-xs text-gray-400 mt-1">
                PNG, JPG up to 5MB each
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={handleClose} style={{ paddingLeft: '28px', paddingRight: '28px' }}>
            Cancel
          </Button>
          <Button
            variant="gradient"
            onClick={handleSubmit}
            disabled={loading}
            style={{ paddingLeft: '28px', paddingRight: '28px' }}
            className={!isShipper ? "bg-gradient-to-br from-blue-500 to-blue-600" : ""}
          >
            {loading
              ? (editMode ? 'Saving...' : 'Posting...')
              : editMode
                ? `Update ${isShipper ? 'Cargo' : 'Truck'}`
                : `Post ${isShipper ? 'Cargo' : 'Truck'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PostModal;
