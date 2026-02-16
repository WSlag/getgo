import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogBottomSheet,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Route,
  Truck,
  Package,
  TrendingUp,
  Loader2,
  Search,
  ArrowRight,
  Star,
  BookmarkPlus,
  Bookmark,
  Trash2,
} from 'lucide-react';
import { useRouteOptimizer } from '@/hooks/useRouteOptimizer';
import { formatCurrency } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/useMediaQuery';

export function RouteOptimizerModal({
  open,
  onClose,
  initialOrigin,
  initialDestination,
  savedRoutes = [],
  onSaveRoute,
  onApplySavedRoute,
  onDeleteSavedRoute,
  darkMode = false,
}) {
  const [origin, setOrigin] = useState(initialOrigin || '');
  const [destination, setDestination] = useState(initialDestination || '');
  const [maxDetour, setMaxDetour] = useState('50');
  const [searchType, setSearchType] = useState('both');
  const isMobile = useMediaQuery('(max-width: 1023px)');

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
  const canSaveRoute = origin.trim() && destination.trim();

  const handleSaveCurrentRoute = () => {
    if (!canSaveRoute) return;
    onSaveRoute?.({
      origin: origin.trim(),
      destination: destination.trim(),
      maxDetourKm: Number(maxDetour) || 50,
      type: searchType,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogBottomSheet className="max-w-2xl backdrop-blur-sm" hideCloseButton>
        <div style={{ padding: isMobile ? '16px' : '24px' }}>
        <DialogHeader>
          <div className="flex items-center" style={{ gap: isMobile ? '8px' : '12px' }}>
            <div style={{
              width: isMobile ? '40px' : '48px',
              height: isMobile ? '40px' : '48px',
              borderRadius: '12px',
              background: 'linear-gradient(to bottom right, #10b981, #059669)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.3)'
            }}>
              <Route style={{ width: isMobile ? '20px' : '24px', height: isMobile ? '20px' : '24px', color: '#fff' }} />
            </div>
            <div>
              <DialogTitle style={{ fontSize: isMobile ? '16px' : '20px' }}>Route Optimizer</DialogTitle>
              <DialogDescription style={{ fontSize: isMobile ? '12px' : '14px' }}>Find backload opportunities along your route</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Search Form */}
        <div className="border-b border-gray-200 dark:border-gray-700" style={{ paddingTop: isMobile ? '16px' : '20px', paddingBottom: isMobile ? '16px' : '20px', marginTop: isMobile ? '12px' : '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '10px' : '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '10px' : '12px' }}>
              <div>
                <Label htmlFor="origin" style={{ fontSize: isMobile ? '11px' : '12px', marginBottom: '4px', display: 'block' }}>Origin</Label>
                <Input
                  id="origin"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  placeholder="e.g., Davao City"
                  style={{ fontSize: isMobile ? '13px' : '14px' }}
                />
              </div>
              <div>
                <Label htmlFor="destination" style={{ fontSize: isMobile ? '11px' : '12px', marginBottom: '4px', display: 'block' }}>Destination (optional)</Label>
                <Input
                  id="destination"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="e.g., Cebu City"
                  style={{ fontSize: isMobile ? '13px' : '14px' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '10px' : '12px' }}>
              <div>
                <Label htmlFor="maxDetour" style={{ fontSize: isMobile ? '11px' : '12px', marginBottom: '4px', display: 'block' }}>Max Detour (km)</Label>
                <Input
                  id="maxDetour"
                  type="number"
                  value={maxDetour}
                  onChange={(e) => setMaxDetour(e.target.value)}
                  min="10"
                  max="200"
                  style={{ fontSize: isMobile ? '13px' : '14px' }}
                />
              </div>
              <div>
                <Label style={{ fontSize: isMobile ? '11px' : '12px', marginBottom: '4px', display: 'block' }}>Search Type</Label>
                <div className="flex" style={{ gap: isMobile ? '4px' : '6px' }}>
                  {[
                    { value: 'both', label: 'Both' },
                    { value: 'cargo', label: 'Cargo' },
                    { value: 'truck', label: 'Trucks' },
                  ].map((type) => (
                    <Button
                      key={type.value}
                      variant={searchType === type.value ? 'default' : 'outline'}
                      size={isMobile ? "sm" : "default"}
                      onClick={() => setSearchType(type.value)}
                      className="flex-1"
                      style={{ fontSize: isMobile ? '11px' : '12px' }}
                    >
                      {type.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex" style={{ gap: '8px' }}>
              <Button
                onClick={handleSearch}
                disabled={loading || !origin.trim()}
                size={isMobile ? "default" : "lg"}
                className="bg-gradient-to-r from-green-500 to-emerald-600 flex-1"
                style={{ gap: '6px' }}
              >
                {loading ? <Loader2 style={{ width: isMobile ? '14px' : '16px', height: isMobile ? '14px' : '16px' }} className="animate-spin" /> : <Search style={{ width: isMobile ? '14px' : '16px', height: isMobile ? '14px' : '16px' }} />}
                <span>Search</span>
              </Button>
              <Button
                onClick={handleSaveCurrentRoute}
                disabled={!canSaveRoute}
                size={isMobile ? "default" : "lg"}
                variant="outline"
                className="gap-1"
              >
                <BookmarkPlus style={{ width: isMobile ? '14px' : '16px', height: isMobile ? '14px' : '16px' }} />
                <span>Save</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Saved Routes */}
        {savedRoutes.length > 0 && (
          <div className="border-b border-gray-200 dark:border-gray-700" style={{ paddingTop: isMobile ? '16px' : '20px', paddingBottom: isMobile ? '16px' : '20px' }}>
            <div className="flex items-center" style={{ gap: '6px', marginBottom: isMobile ? '6px' : '8px' }}>
              <Bookmark style={{ width: isMobile ? '14px' : '16px', height: isMobile ? '14px' : '16px', color: '#f97316' }} />
              <p style={{ fontSize: isMobile ? '12px' : '13px', fontWeight: '600' }}>Saved Routes</p>
            </div>
            <div className="flex flex-wrap" style={{ gap: '8px' }}>
              {savedRoutes.map((savedRoute) => (
                <div
                  key={savedRoute.id}
                  className="flex items-center rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
                  style={{ padding: '4px 10px', gap: '6px' }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setOrigin(savedRoute.origin || '');
                      setDestination(savedRoute.destination || '');
                      setMaxDetour(String(savedRoute.maxDetourKm || 50));
                      setSearchType(savedRoute.type || 'both');
                      onApplySavedRoute?.(savedRoute);
                    }}
                    style={{ fontSize: isMobile ? '11px' : '12px' }}
                  >
                    {savedRoute.origin} <ArrowRight style={{ width: '10px', height: '10px', display: 'inline' }} /> {savedRoute.destination}
                  </button>
                  <button
                    type="button"
                    aria-label="Delete route"
                    onClick={() => onDeleteSavedRoute?.(savedRoute.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 style={{ width: isMobile ? '12px' : '13px', height: isMobile ? '12px' : '13px' }} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="border-b border-gray-200 dark:border-gray-700" style={{ paddingTop: isMobile ? '16px' : '20px', paddingBottom: isMobile ? '16px' : '20px' }}>
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400" style={{ padding: isMobile ? '12px' : '16px', fontSize: isMobile ? '12px' : '14px' }}>
              {error}
            </div>
          </div>
        )}

        {/* Results or Popular Routes */}
        <div style={{ paddingTop: isMobile ? '16px' : '20px' }}>
          {backloadResults ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '12px' : '16px' }}>
                {/* Summary */}
                <div className="rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20" style={{ padding: isMobile ? '10px 12px' : '12px 16px' }}>
                  <p style={{ fontSize: isMobile ? '12px' : '14px', fontWeight: '500', color: '#047857' }} className="dark:text-green-300">
                    Found {backloadResults.totalMatches} backload opportunities within {backloadResults.maxDetourKm}km
                  </p>
                </div>

                {/* Recommendations */}
                {backloadResults.recommendations?.length > 0 && (
                  <div>
                    <h4 className="flex items-center" style={{ fontSize: isMobile ? '12px' : '14px', fontWeight: '600', marginBottom: isMobile ? '6px' : '8px', gap: '6px' }}>
                      <Star style={{ width: isMobile ? '14px' : '16px', height: isMobile ? '14px' : '16px', color: '#eab308' }} />
                      Top Recommendations
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '6px' : '8px' }}>
                      {backloadResults.recommendations.map((rec, idx) => (
                        <div
                          key={rec.id}
                          className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800"
                          style={{ padding: isMobile ? '10px' : '12px' }}
                        >
                          <div className="flex items-center justify-between" style={{ marginBottom: isMobile ? '4px' : '6px' }}>
                            <div className="flex items-center" style={{ gap: isMobile ? '6px' : '8px', minWidth: 0, flex: 1 }}>
                              {rec.type === 'cargo' ? (
                                <Package style={{ width: isMobile ? '14px' : '16px', height: isMobile ? '14px' : '16px', color: '#3b82f6', flexShrink: 0 }} />
                              ) : (
                                <Truck style={{ width: isMobile ? '14px' : '16px', height: isMobile ? '14px' : '16px', color: '#a78bfa', flexShrink: 0 }} />
                              )}
                              <span style={{ fontSize: isMobile ? '12px' : '13px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rec.route}</span>
                            </div>
                            <Badge variant="outline" className="text-green-600 border-green-300" style={{ padding: isMobile ? '2px 6px' : '4px 8px', fontSize: isMobile ? '11px' : '12px', flexShrink: 0 }}>
                              {formatCurrency(rec.price)}
                            </Badge>
                          </div>
                          <div className="flex items-center text-muted-foreground" style={{ gap: isMobile ? '6px' : '8px', fontSize: isMobile ? '11px' : '12px', flexWrap: 'wrap' }}>
                            <span>{rec.originDistance}km from origin</span>
                            {rec.destDistance !== null && (
                              <>
                                <span>-</span>
                                <span>{rec.destDistance}km from destination</span>
                              </>
                            )}
                            <span>-</span>
                            <span className="text-green-600">{rec.reason}</span>
                            {typeof rec.etaSavedMinutes === 'number' && (
                              <>
                                <span>-</span>
                                <span className="text-blue-600">ETA gain {rec.etaSavedMinutes}m</span>
                              </>
                            )}
                            {typeof rec.matchScore === 'number' && (
                              <>
                                <span>-</span>
                                <span className="text-amber-600">Match {Math.round(rec.matchScore)}%</span>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cargo Results */}
                {backloadResults.cargo?.length > 0 && (
                  <div>
                    <h4 className="flex items-center" style={{ fontSize: isMobile ? '12px' : '14px', fontWeight: '600', marginBottom: isMobile ? '6px' : '8px', gap: '6px' }}>
                      <Package style={{ width: isMobile ? '14px' : '16px', height: isMobile ? '14px' : '16px', color: '#3b82f6' }} />
                      Available Cargo ({backloadResults.cargo.length})
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '6px' : '8px' }}>
                      {backloadResults.cargo.slice(0, 5).map((cargo) => (
                        <div
                          key={cargo.id}
                          className="rounded-lg bg-blue-50 dark:bg-blue-900/20"
                          style={{ padding: isMobile ? '10px' : '12px' }}
                        >
                          <div className="flex items-center justify-between" style={{ marginBottom: isMobile ? '4px' : '6px' }}>
                            <span style={{ fontSize: isMobile ? '12px' : '13px', fontWeight: '500', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {cargo.origin} <ArrowRight style={{ width: isMobile ? '12px' : '14px', height: isMobile ? '12px' : '14px', display: 'inline', verticalAlign: 'middle' }} /> {cargo.destination}
                            </span>
                            <Badge style={{ fontSize: isMobile ? '11px' : '12px', padding: isMobile ? '2px 6px' : '4px 8px', flexShrink: 0 }}>{formatCurrency(cargo.askingPrice)}</Badge>
                          </div>
                          <div className="text-muted-foreground" style={{ fontSize: isMobile ? '11px' : '12px', marginBottom: '4px' }}>
                            {cargo.cargoType} - {cargo.weight} {cargo.weightUnit} - {cargo.routeDistance}km route
                          </div>
                          <div className="text-green-600" style={{ fontSize: isMobile ? '11px' : '12px' }}>
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
                    <h4 className="flex items-center" style={{ fontSize: isMobile ? '12px' : '14px', fontWeight: '600', marginBottom: isMobile ? '6px' : '8px', gap: '6px' }}>
                      <Truck style={{ width: isMobile ? '14px' : '16px', height: isMobile ? '14px' : '16px', color: '#a78bfa' }} />
                      Available Trucks ({backloadResults.trucks.length})
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '6px' : '8px' }}>
                      {backloadResults.trucks.slice(0, 5).map((truck) => (
                        <div
                          key={truck.id}
                          className="rounded-lg bg-purple-50 dark:bg-purple-900/20"
                          style={{ padding: isMobile ? '10px' : '12px' }}
                        >
                          <div className="flex items-center justify-between" style={{ marginBottom: isMobile ? '4px' : '6px' }}>
                            <span style={{ fontSize: isMobile ? '12px' : '13px', fontWeight: '500', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {truck.origin} <ArrowRight style={{ width: isMobile ? '12px' : '14px', height: isMobile ? '12px' : '14px', display: 'inline', verticalAlign: 'middle' }} /> {truck.destination}
                            </span>
                            <Badge style={{ fontSize: isMobile ? '11px' : '12px', padding: isMobile ? '2px 6px' : '4px 8px', flexShrink: 0 }}>{formatCurrency(truck.askingPrice)}</Badge>
                          </div>
                          <div className="text-muted-foreground" style={{ fontSize: isMobile ? '11px' : '12px', marginBottom: '4px' }}>
                            {truck.vehicleType} - {truck.capacity} {truck.capacityUnit} - {truck.routeDistance}km route
                          </div>
                          <div className="text-green-600" style={{ fontSize: isMobile ? '11px' : '12px' }}>
                            {truck.originDistance}km detour from your origin
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {backloadResults.totalMatches === 0 && (
                  <div className="text-center text-muted-foreground" style={{ paddingTop: isMobile ? '24px' : '32px', paddingBottom: isMobile ? '24px' : '32px' }}>
                    <Route style={{ width: isMobile ? '40px' : '48px', height: isMobile ? '40px' : '48px', margin: '0 auto 8px', opacity: 0.5 }} />
                    <p style={{ fontSize: isMobile ? '13px' : '14px', marginBottom: '4px' }}>No backload opportunities found</p>
                    <p style={{ fontSize: isMobile ? '12px' : '13px' }}>Try increasing the max detour distance</p>
                  </div>
                )}
              </div>
            ) : (
              /* Popular Routes */
              <div>
                <h4 className="flex items-center" style={{ fontSize: isMobile ? '12px' : '14px', fontWeight: '600', marginBottom: isMobile ? '8px' : '12px', gap: '6px' }}>
                  <TrendingUp style={{ width: isMobile ? '14px' : '16px', height: isMobile ? '14px' : '16px', color: '#f97316' }} />
                  Popular Routes
                </h4>
                {popularRoutes.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '6px' : '8px' }}>
                    {popularRoutes.map((route, idx) => (
                      <button
                        key={idx}
                        onClick={() => handlePopularRouteClick(route)}
                        className="w-full bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                        style={{ padding: isMobile ? '10px' : '12px' }}
                      >
                        <div className="flex items-center justify-between" style={{ marginBottom: isMobile ? '4px' : '6px' }}>
                          <span style={{ fontSize: isMobile ? '12px' : '13px', fontWeight: '500', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {route.origin} <ArrowRight style={{ width: isMobile ? '12px' : '14px', height: isMobile ? '12px' : '14px', display: 'inline', verticalAlign: 'middle' }} /> {route.destination}
                          </span>
                          <Badge variant="secondary" style={{ fontSize: isMobile ? '11px' : '12px', padding: isMobile ? '2px 6px' : '4px 8px', flexShrink: 0 }}>{route.count} listings</Badge>
                        </div>
                        <div className="text-muted-foreground" style={{ fontSize: isMobile ? '11px' : '12px' }}>
                          {route.distance}km distance
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground" style={{ paddingTop: isMobile ? '24px' : '32px', paddingBottom: isMobile ? '24px' : '32px' }}>
                    <TrendingUp style={{ width: isMobile ? '40px' : '48px', height: isMobile ? '40px' : '48px', margin: '0 auto 8px', opacity: 0.5 }} />
                    <p style={{ fontSize: isMobile ? '13px' : '14px' }}>Loading popular routes...</p>
                  </div>
                )}
              </div>
            )}
        </div>
        </div>
      </DialogBottomSheet>
    </Dialog>
  );
}

export default RouteOptimizerModal;

