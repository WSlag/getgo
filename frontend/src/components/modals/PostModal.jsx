import React, { useState } from 'react';
import { Package, Truck, MapPin, Calendar, DollarSign, Weight, FileText, Camera, X } from 'lucide-react';
import { cn } from '@/lib/utils';
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
import { Badge } from '@/components/ui/badge';

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

const CITIES = [
  'Davao City',
  'Cebu City',
  'General Santos',
  'Cagayan de Oro',
  'Zamboanga City',
  'Butuan City',
  'Iligan City',
  'Tagum City',
  'Koronadal City',
  'Cotabato City',
];

export function PostModal({
  open,
  onClose,
  currentRole = 'shipper',
  onSubmit,
  loading = false,
}) {
  const isShipper = currentRole === 'shipper';
  const [formData, setFormData] = useState({
    origin: '',
    destination: '',
    weight: '',
    unit: 'tons',
    cargoType: '',
    vehicleType: '',
    askingPrice: '',
    description: '',
    pickupDate: '',
    photos: [],
  });

  const [errors, setErrors] = useState({});

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
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
    setFormData({
      origin: '',
      destination: '',
      weight: '',
      unit: 'tons',
      cargoType: '',
      vehicleType: '',
      askingPrice: '',
      description: '',
      pickupDate: '',
      photos: [],
    });
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
                {isShipper ? 'Post New Cargo' : 'Post Available Truck'}
              </DialogTitle>
              <DialogDescription>
                {isShipper
                  ? 'Describe your cargo and find the right trucker'
                  : 'Share your route and find cargo to haul'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Route Section */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                Origin
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-green-500" />
                <select
                  value={formData.origin}
                  onChange={(e) => handleChange('origin', e.target.value)}
                  className={cn(
                    "w-full h-10 pl-10 pr-3 rounded-xl border bg-input-background text-sm focus:ring-2 focus:ring-ring focus:ring-offset-2 outline-none",
                    errors.origin ? "border-red-500" : "border-border"
                  )}
                >
                  <option value="">Select city</option>
                  {CITIES.map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>
              {errors.origin && <p className="text-xs text-red-500 mt-1">{errors.origin}</p>}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                Destination
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-red-500" />
                <select
                  value={formData.destination}
                  onChange={(e) => handleChange('destination', e.target.value)}
                  className={cn(
                    "w-full h-10 pl-10 pr-3 rounded-xl border bg-input-background text-sm focus:ring-2 focus:ring-ring focus:ring-offset-2 outline-none",
                    errors.destination ? "border-red-500" : "border-border"
                  )}
                >
                  <option value="">Select city</option>
                  {CITIES.map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>
              {errors.destination && <p className="text-xs text-red-500 mt-1">{errors.destination}</p>}
            </div>
          </div>

          {/* Cargo Details - Shipper only */}
          {isShipper && (
            <>
              <div className="grid grid-cols-2 gap-3">
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
                    <Weight className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                    <Input
                      type="number"
                      placeholder="0"
                      value={formData.weight}
                      onChange={(e) => handleChange('weight', e.target.value)}
                      className={cn("pl-10", errors.weight && "border-red-500")}
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                {isShipper ? 'Budget / Asking Price' : 'Rate'}
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-green-500" />
                <Input
                  type="number"
                  placeholder="0"
                  value={formData.askingPrice}
                  onChange={(e) => handleChange('askingPrice', e.target.value)}
                  className={cn("pl-10", errors.askingPrice && "border-red-500")}
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
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-blue-500" />
                <Input
                  type="date"
                  value={formData.pickupDate}
                  onChange={(e) => handleChange('pickupDate', e.target.value)}
                  className="pl-10"
                />
              </div>
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
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="gradient"
            onClick={handleSubmit}
            disabled={loading}
            className={isShipper ? "" : "bg-gradient-to-br from-blue-500 to-blue-600"}
          >
            {loading ? 'Posting...' : `Post ${isShipper ? 'Cargo' : 'Truck'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PostModal;
