import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SlidersHorizontal, X, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const VEHICLE_TYPES = [
  'Wing Van',
  'Closed Van',
  'Open Truck',
  'Flatbed',
  'Refrigerated',
  'Tanker',
  'Dropside',
  'L300',
  'Canter',
  'Forward',
  '6-Wheeler',
  '10-Wheeler',
  '12-Wheeler',
];

const CARGO_TYPES = [
  'General Cargo',
  'Perishables',
  'Fragile',
  'Hazardous',
  'Machinery',
  'Construction Materials',
  'Agricultural',
  'Electronics',
  'Furniture',
  'Textiles',
];

const SORT_OPTIONS = [
  { value: 'createdAt-DESC', label: 'Newest First' },
  { value: 'createdAt-ASC', label: 'Oldest First' },
  { value: 'askingPrice-ASC', label: 'Price: Low to High' },
  { value: 'askingPrice-DESC', label: 'Price: High to Low' },
  { value: 'weight-DESC', label: 'Weight: Heavy First' },
  { value: 'weight-ASC', label: 'Weight: Light First' },
];

export function FilterPanel({ type = 'cargo', filters, onFiltersChange, activeFilterCount = 0 }) {
  const [open, setOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState(filters || {});

  const handleApply = () => {
    onFiltersChange(localFilters);
    setOpen(false);
  };

  const handleReset = () => {
    const emptyFilters = {};
    setLocalFilters(emptyFilters);
    onFiltersChange(emptyFilters);
  };

  const updateFilter = (key, value) => {
    setLocalFilters((prev) => {
      if (value === '' || value === undefined) {
        const { [key]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: value };
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <SlidersHorizontal className="w-4 h-4" />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[320px] sm:w-[400px]">
        <SheetHeader>
          <SheetTitle>Filter {type === 'cargo' ? 'Cargo' : 'Truck'} Listings</SheetTitle>
          <SheetDescription>
            Narrow down results with advanced filters
          </SheetDescription>
        </SheetHeader>

        <div className="py-6 space-y-5">
          {/* Sort */}
          <div>
            <Label className="text-xs font-medium">Sort By</Label>
            <Select
              value={`${localFilters.sortBy || 'createdAt'}-${localFilters.sortOrder || 'DESC'}`}
              onValueChange={(value) => {
                const [sortBy, sortOrder] = value.split('-');
                updateFilter('sortBy', sortBy);
                updateFilter('sortOrder', sortOrder);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Price Range */}
          <div>
            <Label className="text-xs font-medium">Price Range (₱)</Label>
            <div className="flex gap-2 mt-1">
              <Input
                type="number"
                placeholder="Min"
                value={localFilters.minPrice || ''}
                onChange={(e) => updateFilter('minPrice', e.target.value)}
              />
              <span className="self-center text-muted-foreground">-</span>
              <Input
                type="number"
                placeholder="Max"
                value={localFilters.maxPrice || ''}
                onChange={(e) => updateFilter('maxPrice', e.target.value)}
              />
            </div>
          </div>

          {/* Weight/Capacity Range */}
          <div>
            <Label className="text-xs font-medium">
              {type === 'cargo' ? 'Weight (tons)' : 'Capacity (tons)'}
            </Label>
            <div className="flex gap-2 mt-1">
              <Input
                type="number"
                placeholder="Min"
                value={type === 'cargo' ? localFilters.minWeight || '' : localFilters.minCapacity || ''}
                onChange={(e) => updateFilter(type === 'cargo' ? 'minWeight' : 'minCapacity', e.target.value)}
              />
              <span className="self-center text-muted-foreground">-</span>
              <Input
                type="number"
                placeholder="Max"
                value={type === 'cargo' ? localFilters.maxWeight || '' : localFilters.maxCapacity || ''}
                onChange={(e) => updateFilter(type === 'cargo' ? 'maxWeight' : 'maxCapacity', e.target.value)}
              />
            </div>
          </div>

          {/* Vehicle Type */}
          <div>
            <Label className="text-xs font-medium">Vehicle Type</Label>
            <Select
              value={localFilters.vehicleType || ''}
              onValueChange={(value) => updateFilter('vehicleType', value === 'all' ? '' : value)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Any vehicle type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any vehicle type</SelectItem>
                {VEHICLE_TYPES.map((vt) => (
                  <SelectItem key={vt} value={vt}>{vt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cargo Type (only for cargo) */}
          {type === 'cargo' && (
            <div>
              <Label className="text-xs font-medium">Cargo Type</Label>
              <Select
                value={localFilters.cargoType || ''}
                onValueChange={(value) => updateFilter('cargoType', value === 'all' ? '' : value)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Any cargo type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any cargo type</SelectItem>
                  {CARGO_TYPES.map((ct) => (
                    <SelectItem key={ct} value={ct}>{ct}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Date Range */}
          <div>
            <Label className="text-xs font-medium">
              {type === 'cargo' ? 'Pickup Date' : 'Available Date'}
            </Label>
            <div className="flex gap-2 mt-1">
              <Input
                type="date"
                value={type === 'cargo' ? localFilters.pickupDateFrom || '' : localFilters.availableDateFrom || ''}
                onChange={(e) => updateFilter(type === 'cargo' ? 'pickupDateFrom' : 'availableDateFrom', e.target.value)}
              />
              <span className="self-center text-muted-foreground">-</span>
              <Input
                type="date"
                value={type === 'cargo' ? localFilters.pickupDateTo || '' : localFilters.availableDateTo || ''}
                onChange={(e) => updateFilter(type === 'cargo' ? 'pickupDateTo' : 'availableDateTo', e.target.value)}
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <Label className="text-xs font-medium">Status</Label>
            <Select
              value={localFilters.status || 'open'}
              onValueChange={(value) => updateFilter('status', value)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="negotiating">Negotiating</SelectItem>
                <SelectItem value="contracted">Contracted</SelectItem>
                <SelectItem value="in_transit">In Transit</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <SheetFooter className="flex gap-2">
          <Button variant="outline" onClick={handleReset} className="flex-1">
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
          <Button onClick={handleApply} className="flex-1">
            Apply Filters
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default FilterPanel;
