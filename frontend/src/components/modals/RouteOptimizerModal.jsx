import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Route,
  MapPin,
  Truck,
  Package,
  Navigation,
  TrendingUp,
  Loader2,
  Search,
  ArrowRight,
  Star,
} from 'lucide-react';
import { useRouteOptimizer } from '@/hooks/useRouteOptimizer';
import { formatCurrency } from '@/lib/utils';

export function RouteOptimizerModal({ open, onClose, initialOrigin, initialDestination }) {
  const [origin, setOrigin] = useState(initialOrigin || '');
  const [destination, setDestination] = useState(initialDestination || '');
  const [maxDetour, setMaxDetour] = useState('50');
  const [searchType, setSearchType] = useState('both');

  const {
    backloadResults,
    popularRoutes,
    loading,
    error,
    findBackload,
    fetchPopularRoutes,
    clearResults,
  } = useRouteOptimizer();

  // Load popular routes on mount
  useEffect(() => {
    if (open) {
      fetchPopularRoutes();
    }
  }, [open, fetchPopularRoutes]);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setOrigin(initialOrigin || '');
      setDestination(initialDestination || '');
      clearResults();
    }
  }, [open, initialOrigin, initialDestination, clearResults]);

  const handleSearch = async () => {
    if (!origin.trim()) return;

    await findBackload({
      origin: origin.trim(),
      destination: destination.trim() || undefined,
      maxDetourKm: maxDetour,
      type: searchType,
    });
  };

  const handlePopularRouteClick = (route) => {
    setOrigin(route.origin);
    setDestination(route.destination);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 text-white">
              <Route className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle>Route Optimizer</DialogTitle>
              <DialogDescription>Find backload opportunities along your route</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Search Form */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="origin" className="text-xs">Origin</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                  <Input
                    id="origin"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    placeholder="e.g., Davao City"
                    className="pl-9"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="destination" className="text-xs">Destination (optional)</Label>
                <div className="relative">
                  <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
                  <Input
                    id="destination"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="e.g., Cebu City"
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Label htmlFor="maxDetour" className="text-xs">Max Detour (km)</Label>
                <Input
                  id="maxDetour"
                  type="number"
                  value={maxDetour}
                  onChange={(e) => setMaxDetour(e.target.value)}
                  min="10"
                  max="200"
                />
              </div>
              <div className="flex-1">
                <Label className="text-xs">Search Type</Label>
                <div className="flex gap-1">
                  {[
                    { value: 'both', label: 'Both' },
                    { value: 'cargo', label: 'Cargo' },
                    { value: 'truck', label: 'Trucks' },
                  ].map((type) => (
                    <Button
                      key={type.value}
                      variant={searchType === type.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSearchType(type.value)}
                      className="flex-1"
                    >
                      {type.label}
                    </Button>
                  ))}
                </div>
              </div>
              <Button
                onClick={handleSearch}
                disabled={loading || !origin.trim()}
                className="bg-gradient-to-r from-green-500 to-emerald-600"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span className="ml-2">Search</span>
              </Button>
            </div>
          </div>

          {/* Results or Popular Routes */}
          <ScrollArea className="flex-1">
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            {backloadResults ? (
              <div className="space-y-4">
                {/* Summary */}
                <div className="p-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg">
                  <p className="text-sm font-medium text-green-700 dark:text-green-300">
                    Found {backloadResults.totalMatches} backload opportunities within {backloadResults.maxDetourKm}km
                  </p>
                </div>

                {/* Recommendations */}
                {backloadResults.recommendations?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <Star className="w-4 h-4 text-yellow-500" />
                      Top Recommendations
                    </h4>
                    <div className="space-y-2">
                      {backloadResults.recommendations.map((rec, idx) => (
                        <div
                          key={rec.id}
                          className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {rec.type === 'cargo' ? (
                                <Package className="w-4 h-4 text-blue-500" />
                              ) : (
                                <Truck className="w-4 h-4 text-purple-500" />
                              )}
                              <span className="font-medium text-sm">{rec.route}</span>
                            </div>
                            <Badge variant="outline" className="text-green-600 border-green-300">
                              {formatCurrency(rec.price)}
                            </Badge>
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{rec.originDistance}km from origin</span>
                            {rec.destDistance !== null && (
                              <>
                                <span>•</span>
                                <span>{rec.destDistance}km from destination</span>
                              </>
                            )}
                            <span>•</span>
                            <span className="text-green-600">{rec.reason}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cargo Results */}
                {backloadResults.cargo?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <Package className="w-4 h-4 text-blue-500" />
                      Available Cargo ({backloadResults.cargo.length})
                    </h4>
                    <div className="space-y-2">
                      {backloadResults.cargo.slice(0, 5).map((cargo) => (
                        <div
                          key={cargo.id}
                          className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">
                              {cargo.origin} <ArrowRight className="inline w-3 h-3" /> {cargo.destination}
                            </span>
                            <Badge>{formatCurrency(cargo.askingPrice)}</Badge>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {cargo.cargoType} • {cargo.weight} {cargo.weightUnit} • {cargo.routeDistance}km route
                          </div>
                          <div className="mt-1 text-xs text-green-600">
                            {cargo.originDistance}km detour from your origin
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Truck Results */}
                {backloadResults.trucks?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <Truck className="w-4 h-4 text-purple-500" />
                      Available Trucks ({backloadResults.trucks.length})
                    </h4>
                    <div className="space-y-2">
                      {backloadResults.trucks.slice(0, 5).map((truck) => (
                        <div
                          key={truck.id}
                          className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">
                              {truck.origin} <ArrowRight className="inline w-3 h-3" /> {truck.destination}
                            </span>
                            <Badge>{formatCurrency(truck.askingPrice)}</Badge>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {truck.vehicleType} • {truck.capacity} {truck.capacityUnit} • {truck.routeDistance}km route
                          </div>
                          <div className="mt-1 text-xs text-green-600">
                            {truck.originDistance}km detour from your origin
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {backloadResults.totalMatches === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Route className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No backload opportunities found</p>
                    <p className="text-sm">Try increasing the max detour distance</p>
                  </div>
                )}
              </div>
            ) : (
              /* Popular Routes */
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-orange-500" />
                  Popular Routes
                </h4>
                {popularRoutes.length > 0 ? (
                  <div className="space-y-2">
                    {popularRoutes.map((route, idx) => (
                      <button
                        key={idx}
                        onClick={() => handlePopularRouteClick(route)}
                        className="w-full p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">
                            {route.origin} <ArrowRight className="inline w-3 h-3" /> {route.destination}
                          </span>
                          <Badge variant="secondary">{route.count} listings</Badge>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {route.distance}km distance
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Loading popular routes...</p>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default RouteOptimizerModal;
