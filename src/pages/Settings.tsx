import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Building2, FileText, Receipt, ChevronRight, CreditCard, User, Link2, Bell, Shield, LogOut, Loader2, Save, MapPin, Car } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import PenguinIcon from "@/components/PenguinIcon";
import Logo from "@/components/Logo";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { useOnboardingSettings } from "@/hooks/useOnboardingSettings";
import { useDirectorOnboarding } from "@/hooks/useDirectorOnboarding";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const businessTypes = [
  { value: "construction", label: "Construction" },
  { value: "carpentry_joinery", label: "Carpentry & Joinery" },
  { value: "electrical", label: "Electrical" },
  { value: "plumbing_heating", label: "Plumbing & Heating" },
  { value: "landscaping_groundworks", label: "Landscaping & Groundworks" },
  { value: "painting_decorating", label: "Painting & Decorating" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "retail_ecommerce", label: "Retail & E-Commerce" },
  { value: "hospitality", label: "Hospitality" },
  { value: "professional_services", label: "Professional Services" },
  { value: "transport_logistics", label: "Transport & Logistics" },
  { value: "health_wellness", label: "Health & Wellness" },
  { value: "technology_it", label: "Technology & IT" },
  { value: "real_estate_property", label: "Real Estate & Property" },
  { value: "maintenance_facilities", label: "Maintenance & Facilities" },
];

const Settings = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, profile, signOut } = useAuth();
  const { data: onboarding } = useOnboardingSettings();
  
  const { data: directorRows } = useDirectorOnboarding();
  const [showBusinessDialog, setShowBusinessDialog] = useState(false);
  const [showTravelDialog, setShowTravelDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state — Business Info
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [businessDescription, setBusinessDescription] = useState("");

  // Form state — Travel & Trips
  const [placeOfWork, setPlaceOfWork] = useState("");
  const [workshopAddress, setWorkshopAddress] = useState("");
  const [subsistenceRadius, setSubsistenceRadius] = useState(8);
  const [commuteMethod, setCommuteMethod] = useState("");
  const [vehicleOwnedByDirector, setVehicleOwnedByDirector] = useState(false);

  // Load travel settings from localStorage
  const getTravelSettings = () => {
    try {
      const extra = localStorage.getItem("business_onboarding_extra");
      if (extra) {
        const parsed = JSON.parse(extra);
        const biz = parsed?.businesses?.[0];
        return {
          placeOfWork: biz?.place_of_work || "",
          workshopAddress: biz?.workshop_address || "",
          subsistenceRadius: biz?.subsistence_radius_km || 8,
        };
      }
    } catch { /* ignore */ }
    return { placeOfWork: "", workshopAddress: "", subsistenceRadius: 8 };
  };

  const getDirectorSettings = () => {
    const d1 = directorRows?.[0];
    const data = (d1 as Record<string, unknown>)?.onboarding_data as Record<string, unknown> | undefined;
    return {
      commuteMethod: (data?.commute_method as string) || "",
      vehicleOwnedByDirector: data?.vehicle_owned_by_director === true,
    };
  };

  const getCommuteMethod = (): string => {
    const d1 = directorRows?.[0];
    const data = (d1 as Record<string, unknown>)?.onboarding_data as Record<string, unknown> | undefined;
    return data?.commute_method || "";
  };

  const openBusinessDialog = () => {
    // Pre-fill with existing data
    setBusinessName(onboarding?.business_name || profile?.business_name || "");
    setBusinessType(onboarding?.business_type || profile?.business_type || "");
    setVatNumber(onboarding?.vat_number || profile?.vat_number || "");
    setPhone(profile?.phone || "");
    setAddress(profile?.address || "");
    setBusinessDescription(onboarding?.business_description || profile?.business_description || "");
    setShowBusinessDialog(true);
  };

  const openTravelDialog = () => {
    const ts = getTravelSettings();
    const ds = getDirectorSettings();
    setPlaceOfWork(ts.placeOfWork);
    setWorkshopAddress(ts.workshopAddress);
    setSubsistenceRadius(ts.subsistenceRadius);
    setCommuteMethod(ds.commuteMethod);
    setVehicleOwnedByDirector(ds.vehicleOwnedByDirector);
    setShowTravelDialog(true);
  };

  const handleSaveTravelInfo = async () => {
    if (!user?.id) return;
    setIsSaving(true);
    try {
      // Update place_of_work in business_onboarding_extra (localStorage)
      let extra: Record<string, unknown> = {};
      try {
        const raw = localStorage.getItem("business_onboarding_extra");
        if (raw) extra = JSON.parse(raw);
      } catch { /* ignore */ }

      if (!extra.businesses || !Array.isArray(extra.businesses) || extra.businesses.length === 0) {
        extra.businesses = [{}];
      }
      extra.businesses[0].place_of_work = placeOfWork;
      extra.businesses[0].workshop_address = workshopAddress;
      extra.businesses[0].subsistence_radius_km = subsistenceRadius;
      localStorage.setItem("business_onboarding_extra", JSON.stringify(extra));

      // Update commute_method in director onboarding (Supabase)
      if (commuteMethod) {
        const { data: existing } = await supabase
          .from("director_onboarding")
          .select("id, onboarding_data")
          .eq("user_id", user.id)
          .eq("director_number", 1)
          .maybeSingle();

        if (existing) {
          const updatedData = {
            ...((existing.onboarding_data as Record<string, unknown>) || {}),
            commute_method: commuteMethod,
            vehicle_owned_by_director: vehicleOwnedByDirector,
          };
          await supabase
            .from("director_onboarding")
            .update({ onboarding_data: updatedData })
            .eq("id", existing.id);
        }
      }

      toast.success("Travel settings updated");
      setShowTravelDialog(false);
    } catch (error) {
      console.error("Error saving travel info:", error);
      toast.error("Failed to save travel settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveBusinessInfo = async () => {
    if (!user?.id) return;
    
    setIsSaving(true);
    try {
      // Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          business_name: businessName,
          business_type: businessType,
          business_description: businessDescription || null,
          vat_number: vatNumber,
          phone,
          address,
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // Update onboarding settings if exists
      const { error: onboardingError } = await supabase
        .from("onboarding_settings")
        .update({
          business_name: businessName,
          business_type: businessType,
          business_description: businessDescription || null,
          vat_number: vatNumber,
        })
        .eq("user_id", user.id);

      // Ignore onboarding error if record doesn't exist
      if (onboardingError && !onboardingError.message.includes("0 rows")) {
        console.warn("Onboarding update warning:", onboardingError);
      }

      // Refresh data
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      await queryClient.invalidateQueries({ queryKey: ["onboarding-settings"] });
      
      toast.success("Business details updated");
      setShowBusinessDialog(false);
    } catch (error) {
      console.error("Error saving business info:", error);
      toast.error("Failed to save business details");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const displayBusinessName = onboarding?.business_name || profile?.business_name || "Your Business";
  const displayBusinessType = businessTypes.find(bt => bt.value === (onboarding?.business_type || profile?.business_type))?.label || "Not set";

  const currentTravel = getTravelSettings();
  const currentCommuteMethod = getCommuteMethod();
  const commuteLabel = currentCommuteMethod
    ? currentCommuteMethod.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
    : "Not set";

  const settingsSections = [
    {
      title: "Business",
      items: [
        { icon: Building2, label: "Business Info", description: displayBusinessType, onClick: openBusinessDialog },
        { icon: MapPin, label: "Trip & Travel", description: currentTravel.workshopAddress || currentTravel.placeOfWork || "Set your place of work", onClick: openTravelDialog },
        { icon: FileText, label: "VAT Settings", description: onboarding?.vat_registered ? `VAT: ${onboarding?.vat_number || "Registered"}` : "Not VAT registered" },
        { icon: Receipt, label: "RCT Settings", description: onboarding?.rct_registered ? "RCT enabled" : "Not using RCT" },
      ]
    },
    {
      title: "Connections",
      items: [
        { icon: Link2, label: "Bank Connections", description: "Manage linked accounts" },
      ]
    },
    {
      title: "Account",
      items: [
        { icon: User, label: "User Profile", description: user?.email || "Not signed in" },
        { icon: Bell, label: "Notifications", description: "Email and push preferences" },
        { icon: Shield, label: "Security", description: "Two-factor authentication" },
      ]
    },
    {
      title: "Subscription",
      items: [
        { icon: CreditCard, label: "Plan & Billing", description: "Pro Plan - €29/month" },
      ]
    },
  ];

  return (
    <AppLayout>
      {/* Business Info Dialog */}
      <Dialog open={showBusinessDialog} onOpenChange={setShowBusinessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Business Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="businessName">Business Name</Label>
              <Input
                id="businessName"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Enter business name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="businessType">Business Type</Label>
              <Select value={businessType} onValueChange={setBusinessType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select business type" />
                </SelectTrigger>
                <SelectContent>
                  {businessTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="vatNumber">VAT Number</Label>
              <Input
                id="vatNumber"
                value={vatNumber}
                onChange={(e) => setVatNumber(e.target.value)}
                placeholder="IE1234567X"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+353 1 234 5678"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="address">Business Address</Label>
              <AddressAutocomplete
                id="address"
                value={address}
                onChange={setAddress}
                placeholder="Enter business address"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessDescription">Business Description</Label>
              <Textarea
                id="businessDescription"
                className="min-h-[80px]"
                placeholder="e.g. We build custom kitchens and wardrobes for residential clients in Dublin"
                value={businessDescription}
                onChange={(e) => {
                  const words = e.target.value.trim().split(/\s+/).filter(Boolean);
                  if (words.length <= 40) setBusinessDescription(e.target.value);
                }}
              />
              <p className="text-xs text-muted-foreground text-right">
                {businessDescription.trim().split(/\s+/).filter(Boolean).length}/40 words
              </p>
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowBusinessDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveBusinessInfo} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Travel Dialog */}
      <Dialog open={showTravelDialog} onOpenChange={setShowTravelDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Trip & Travel Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="placeOfWork">Home county</Label>
              <AddressAutocomplete
                id="placeOfWork"
                value={placeOfWork}
                onChange={setPlaceOfWork}
                onTownSelect={(town) => setPlaceOfWork(town.county)}
                placeholder="e.g. Dublin, Kildare, Cork"
              />
              <p className="text-xs text-muted-foreground">
                Work outside this county triggers overnight stay detection (hotel bookings).
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="workshopAddress">Workshop / office address</Label>
              <AddressAutocomplete
                id="workshopAddress"
                value={workshopAddress}
                onChange={setWorkshopAddress}
                placeholder="e.g. Hollystown Industrial Units, Dublin 15"
              />
              <p className="text-xs text-muted-foreground">
                Subsistence (meals) applies when working beyond the radius below from this address.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subsistenceRadius">Subsistence radius (km)</Label>
              <Input
                id="subsistenceRadius"
                type="number"
                min={1}
                max={100}
                value={subsistenceRadius}
                onChange={(e) => setSubsistenceRadius(parseInt(e.target.value) || 8)}
                className="w-24"
              />
              <p className="text-xs text-muted-foreground">
                Civil service subsistence rates apply when working more than {subsistenceRadius}km from your workshop.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="commuteMethod">Vehicle / commute method</Label>
              <Select value={commuteMethod} onValueChange={setCommuteMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select commute method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal_vehicle">Personal vehicle</SelectItem>
                  <SelectItem value="company_vehicle">Company vehicle</SelectItem>
                  <SelectItem value="public_transport">Public transport</SelectItem>
                  <SelectItem value="walk_cycle">Walk / cycle</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {commuteMethod === "personal_vehicle" && (
              <div className="space-y-2">
                <Label>Vehicle owned by director personally?</Label>
                <div className="flex gap-3">
                  {[
                    { value: true, label: "Yes" },
                    { value: false, label: "No" },
                  ].map((opt) => (
                    <button
                      key={String(opt.value)}
                      type="button"
                      onClick={() => setVehicleOwnedByDirector(opt.value)}
                      className={`flex-1 px-4 py-3 rounded-xl border-2 font-medium transition-all ${
                        vehicleOwnedByDirector === opt.value
                          ? "bg-foreground text-background border-foreground"
                          : "border-border hover:border-foreground/40"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Mileage at Revenue civil service rates only applies when the director personally owns the vehicle.
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowTravelDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTravelInfo} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <header className="bg-background px-6 py-4 card-shadow sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="w-24" />
          <div className="flex-1 text-center">
            <h1 className="font-semibold text-xl">Settings</h1>
          </div>
          <div className="w-24" />
        </div>
      </header>

      <main className="px-4 md:px-6 py-6 max-w-4xl mx-auto md:mx-0 space-y-6">
        {/* Profile Card */}
        <div className="bg-card rounded-2xl p-6 card-shadow animate-fade-in">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center">
              <PenguinIcon className="w-10 h-10 text-primary-foreground" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">{displayBusinessName}</h2>
              <p className="text-muted-foreground">{user?.email || "Not signed in"}</p>
              <span className="inline-block mt-1 px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
                Pro Plan
              </span>
            </div>
          </div>
        </div>

        {/* Settings Sections */}
        {settingsSections.map((section, sectionIndex) => (
          <div 
            key={section.title}
            className="animate-fade-in"
            style={{ animationDelay: `${(sectionIndex + 1) * 0.05}s` }}
          >
            <h3 className="text-sm font-medium text-muted-foreground mb-2 px-1">{section.title}</h3>
            <div className="bg-card rounded-2xl card-shadow overflow-hidden">
              {section.items.map((item, index) => (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  className={`w-full p-4 flex items-center gap-4 hover:bg-muted/50 transition-colors ${
                    index !== section.items.length - 1 ? "border-b border-border" : ""
                  }`}
                >
                  <div className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center">
                    <item.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium">{item.label}</p>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Sign Out */}
        <button 
          onClick={handleSignOut}
          className="w-full bg-card rounded-2xl p-4 card-shadow flex items-center gap-4 hover:bg-destructive/5 transition-colors animate-fade-in" 
          style={{ animationDelay: "0.25s" }}
        >
          <div className="w-10 h-10 bg-destructive/10 rounded-xl flex items-center justify-center">
            <LogOut className="w-5 h-5 text-destructive" />
          </div>
          <span className="font-medium text-destructive">Sign Out</span>
        </button>

        {/* App Info */}
        <div className="text-center pt-4 animate-fade-in" style={{ animationDelay: "0.3s" }}>
          <Logo size="sm" className="mx-auto mb-2 opacity-50" />
          <p className="text-xs text-muted-foreground">Version 1.0.0</p>
        </div>
      </main>
    </AppLayout>
  );
};

export default Settings;
