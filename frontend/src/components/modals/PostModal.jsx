import { useState, useEffect } from 'react';
import { Package, Truck, Camera, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogBottomSheet,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
    originStreetAddress: '',
    destination: '',
    destCoords: null,
    destinationStreetAddress: '',
    weight: '',
    unit: 'tons',
    cargoType: '',
    vehicleType: '',
    askingPrice: '',
    declaredValue: '',
    description: '',
    pickupDate: '',
    photos: [],
  });

  const [formData, setFormData] = useState(getInitialFormData());
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (editMode && existingData && open) {
      setFormData({
        origin: existingData.origin || '',
        originCoords: existingData.originCoords || null,
        originStreetAddress: existingData.originStreetAddress || '',
        destination: existingData.destination || '',
        destCoords: existingData.destCoords || null,
        destinationStreetAddress: existingData.destinationStreetAddress || '',
        weight: existingData.weight?.toString() || '',
        unit: existingData.unit || 'tons',
        cargoType: existingData.cargoType || '',
        vehicleType: existingData.vehicleType || existingData.vehicleNeeded || '',
        askingPrice: (existingData.askingPrice || existingData.askingRate || existingData.price)?.toString() || '',
        declaredValue: existingData.declaredValue?.toString() || '',
        description: existingData.description || '',
        pickupDate: existingData.pickupDate || existingData.availableDate || '',
        photos: existingData.cargoPhotos || existingData.truckPhotos || existingData.photos || [],
        id: existingData.id,
      });
    } else if (!editMode && open) {
      setFormData(getInitialFormData());
    }
  }, [editMode, existingData, open]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const handleOriginSelect = (location) => {
    if (location) {
      setFormData((prev) => ({
        ...prev,
        origin: location.name,
        originCoords: { lat: location.lat, lng: location.lng },
      }));
    } else {
      setFormData((prev) => ({ ...prev, origin: '', originCoords: null }));
    }
    if (errors.origin) {
      setErrors((prev) => ({ ...prev, origin: null }));
    }
  };

  const handleDestSelect = (location) => {
    if (location) {
      setFormData((prev) => ({
        ...prev,
        destination: location.name,
        destCoords: { lat: location.lat, lng: location.lng },
      }));
    } else {
      setFormData((prev) => ({ ...prev, destination: '', destCoords: null }));
    }
    if (errors.destination) {
      setErrors((prev) => ({ ...prev, destination: null }));
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
    } else if (!formData.vehicleType) {
      newErrors.vehicleType = 'Vehicle type is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) onSubmit?.(formData);
  };

  const handleClose = () => {
    setFormData(getInitialFormData());
    setErrors({});
    onClose?.();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogBottomSheet className="max-w-lg">
        <div className="space-y-5 p-4 lg:p-6">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'flex size-12 shrink-0 items-center justify-center rounded-xl shadow-sm',
                  isShipper ? 'bg-primary/10 text-primary' : 'bg-info/10 text-info'
                )}
              >
                {isShipper ? <Package className="size-6" /> : <Truck className="size-6" />}
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

          <section className="space-y-3 border-t border-border pt-4 lg:pt-5">
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="space-y-3">
                <AddressSearch
                  label="Origin"
                  value={formData.origin}
                  onChange={(value) => handleChange('origin', value)}
                  onSelect={handleOriginSelect}
                  placeholder="Search origin city..."
                  error={errors.origin}
                  required
                />
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Pickup Street Address <span className="text-xs text-muted-foreground">(Optional but recommended)</span>
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g., 123 Main St, Barangay Central, Building Name"
                    value={formData.originStreetAddress}
                    onChange={(e) => handleChange('originStreetAddress', e.target.value)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Include building name, floor number, or landmarks to help the trucker find you.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <AddressSearch
                  label="Destination"
                  value={formData.destination}
                  onChange={(value) => handleChange('destination', value)}
                  onSelect={handleDestSelect}
                  placeholder="Search destination..."
                  error={errors.destination}
                  required
                />
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Delivery Street Address <span className="text-xs text-muted-foreground">(Optional but recommended)</span>
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g., 456 Commerce Ave, Warehouse 3, Gate B"
                    value={formData.destinationStreetAddress}
                    onChange={(e) => handleChange('destinationStreetAddress', e.target.value)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Include receiving area details, contact person, or gate number.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {isShipper && (
            <section className="space-y-3 border-t border-border pt-4 lg:pt-5">
              <div className="grid gap-3 lg:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Cargo Type</label>
                  <Select value={formData.cargoType} onValueChange={(value) => handleChange('cargoType', value)}>
                    <SelectTrigger className={cn(errors.cargoType && 'border-destructive')}>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {CARGO_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.cargoType && <p className="mt-1 text-xs text-destructive">{errors.cargoType}</p>}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Weight</label>
                  <div className="relative">
                    <Input
                      type="number"
                      placeholder="0"
                      value={formData.weight}
                      onChange={(e) => handleChange('weight', e.target.value)}
                      className={cn('pr-14', errors.weight && 'border-destructive')}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">tons</span>
                  </div>
                  {errors.weight && <p className="mt-1 text-xs text-destructive">{errors.weight}</p>}
                </div>
              </div>
            </section>
          )}

          <section className="space-y-3 border-t border-border pt-4 lg:pt-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                {isShipper ? 'Vehicle Needed' : 'Vehicle Type'}
              </label>
              <Select value={formData.vehicleType} onValueChange={(value) => handleChange('vehicleType', value)}>
                <SelectTrigger className={cn(errors.vehicleType && 'border-destructive')}>
                  <SelectValue placeholder="Select vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {VEHICLE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.vehicleType && <p className="mt-1 text-xs text-destructive">{errors.vehicleType}</p>}
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  {isShipper ? 'Budget / Asking Price' : 'Rate'}
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="0"
                    value={formData.askingPrice}
                    onChange={(e) => handleChange('askingPrice', e.target.value)}
                    className={cn('pr-14', errors.askingPrice && 'border-destructive')}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">PHP</span>
                </div>
                {errors.askingPrice && <p className="mt-1 text-xs text-destructive">{errors.askingPrice}</p>}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  {isShipper ? 'Pickup Date' : 'Available Date'}
                </label>
                <Input
                  type="date"
                  value={formData.pickupDate}
                  onChange={(e) => handleChange('pickupDate', e.target.value)}
                />
              </div>
            </div>

            {isShipper && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Declared Cargo Value <span className="text-xs text-muted-foreground">(Optional)</span>
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="Default: PHP 100,000"
                    value={formData.declaredValue}
                    onChange={(e) => handleChange('declaredValue', e.target.value)}
                    className="pr-14"
                    min="0"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">PHP</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Maximum liability in case of loss/damage. Leave blank for default PHP 100,000.
                </p>
              </div>
            )}
          </section>

          <section className="space-y-3 border-t border-border pt-4 lg:pt-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Description</label>
              <Textarea
                placeholder={isShipper
                  ? 'Describe your cargo (packaging, special handling needs, etc.)'
                  : 'Describe your truck (capacity, features, route experience, etc.)'}
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                className="min-h-[96px]"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Photos (Optional)</label>
              <input
                type="file"
                id="photo-upload"
                accept="image/png,image/jpeg,image/jpg"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  const validFiles = files.filter((file) => {
                    if (file.size > 5 * 1024 * 1024) {
                      window.alert(`${file.name} is larger than 5MB`);
                      return false;
                    }
                    return true;
                  });

                  const newPhotos = validFiles.map((file) => ({
                    file,
                    preview: URL.createObjectURL(file),
                    name: file.name,
                  }));

                  setFormData((prev) => ({
                    ...prev,
                    photos: [...(prev.photos || []), ...newPhotos],
                  }));

                  e.target.value = '';
                }}
              />

              <label
                htmlFor="photo-upload"
                className="group block cursor-pointer rounded-xl border-2 border-dashed border-border bg-muted/20 p-6 text-center transition-colors hover:border-primary/50 hover:bg-muted"
              >
                <Camera className="mx-auto mb-2 size-8 text-muted-foreground transition-colors group-hover:text-primary" />
                <p className="text-sm text-foreground">Click to upload photos</p>
                <p className="mt-1 text-xs text-muted-foreground">PNG, JPG up to 5MB each</p>
              </label>

              {formData.photos && formData.photos.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {formData.photos.map((photo, index) => (
                    <div key={index} className="group/photo relative">
                      <img
                        src={photo.preview || photo}
                        alt={photo.name || `Photo ${index + 1}`}
                        className="size-16 rounded-lg border border-border object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (photo.preview) URL.revokeObjectURL(photo.preview);
                          setFormData((prev) => ({
                            ...prev,
                            photos: prev.photos.filter((_, i) => i !== index),
                          }));
                        }}
                        className="absolute -right-2 -top-2 rounded-full bg-destructive p-0.5 text-destructive-foreground opacity-0 transition-opacity group-hover/photo:opacity-100"
                        aria-label="Remove photo"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="dialog-fixed-footer flex gap-2 border-t border-border bg-background p-4 lg:p-5">
          <Button variant="ghost" onClick={handleClose} className="min-h-11 flex-1">
            Cancel
          </Button>
          <Button
            variant={isShipper ? 'gradient' : 'gradient-blue'}
            onClick={handleSubmit}
            disabled={loading}
            className="min-h-11 flex-1"
          >
            {loading
              ? (editMode ? 'Saving...' : 'Posting...')
              : editMode
                ? `Update ${isShipper ? 'Cargo' : 'Truck'}`
                : `Post ${isShipper ? 'Cargo' : 'Truck'}`}
          </Button>
        </div>
      </DialogBottomSheet>
    </Dialog>
  );
}

export default PostModal;
