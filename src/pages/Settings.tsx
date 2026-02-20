import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  FileText,
  Receipt,
  ChevronRight,
  User,
  Link2,
  Shield,
  LogOut,
  Loader2,
  Save,
  MapPin,
  Sun,
  Moon,
  Palette,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/components/ThemeProvider";
import PenguinIcon from "@/components/PenguinIcon";
import Logo from "@/components/Logo";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { useOnboardingSettings } from "@/hooks/useOnboardingSettings";
import { useDirectorOnboarding } from "@/hooks/useDirectorOnboarding";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

// Matches the BUSINESS_ACTIVITIES from OnboardingWizard so stored values always resolve
const businessTypes = [
  // Trades & Construction
  { value: "carpentry_joinery", label: "Carpentry & Joinery" },
  { value: "general_construction", label: "General Construction" },
  { value: "electrical_contracting", label: "Electrical Contracting" },
  { value: "plumbing_heating", label: "Plumbing & Heating" },
  { value: "bricklaying_masonry", label: "Bricklaying & Masonry" },
  { value: "plastering_drylining", label: "Plastering / Drylining" },
  { value: "painting_decorating", label: "Painting & Decorating" },
  { value: "roofing", label: "Roofing" },
  { value: "groundworks_civil", label: "Groundworks / Civil Works" },
  { value: "landscaping", label: "Landscaping" },
  { value: "tiling_stonework", label: "Tiling & Stonework" },
  { value: "steel_fabrication_welding", label: "Steel Fabrication / Welding" },
  // Construction Support & Property
  { value: "quantity_surveying", label: "Quantity Surveying" },
  { value: "project_management", label: "Project Management" },
  { value: "site_supervision", label: "Site Supervision" },
  { value: "property_maintenance", label: "Property Maintenance" },
  { value: "property_development", label: "Property Development" },
  { value: "letting_property_management", label: "Letting / Property Management" },
  // Transport & Logistics
  { value: "haulage_hgv", label: "Haulage / HGV Transport" },
  { value: "courier_services", label: "Courier Services" },
  { value: "taxi_private_hire", label: "Taxi / Private Hire" },
  { value: "delivery_services", label: "Delivery Services" },
  { value: "plant_hire", label: "Plant Hire" },
  // Retail & Wholesale
  { value: "physical_retail", label: "Physical Retail" },
  { value: "online_retail", label: "Online Retail (E-Commerce)" },
  { value: "market_stall", label: "Market / Stall Trading" },
  { value: "wholesale_distribution", label: "Wholesale / Distribution" },
  // Professional Services
  { value: "accounting_bookkeeping", label: "Accounting / Bookkeeping" },
  { value: "legal_services", label: "Legal Services" },
  { value: "consultancy", label: "Consultancy / Consulting" },
  { value: "hr_recruitment", label: "HR / Recruitment" },
  { value: "financial_services", label: "Financial Services" },
  { value: "insurance_broker", label: "Insurance / Broker" },
  { value: "architecture", label: "Architecture" },
  { value: "engineering_consultancy", label: "Engineering Consultancy" },
  // Digital & Creative
  { value: "software_development", label: "Software Development" },
  { value: "it_services", label: "IT Services / Managed Services" },
  { value: "web_design", label: "Web Design" },
  { value: "graphic_design", label: "Graphic Design" },
  { value: "digital_marketing", label: "Digital Marketing" },
  { value: "photography_videography", label: "Photography / Videography" },
  { value: "content_creation", label: "Content Creation / Media" },
  // Food & Hospitality
  { value: "cafe_restaurant", label: "Cafe / Restaurant" },
  { value: "takeaway", label: "Takeaway" },
  { value: "catering", label: "Catering" },
  { value: "mobile_food", label: "Mobile Food / Food Truck" },
  // Agriculture & Environmental
  { value: "farming", label: "Farming" },
  { value: "forestry", label: "Forestry" },
  { value: "agricultural_contracting", label: "Agricultural Contracting" },
  // Domestic & Local Services
  { value: "cleaning", label: "Cleaning" },
  { value: "waste_removal", label: "Waste Removal" },
  { value: "pest_control", label: "Pest Control" },
  { value: "care_services", label: "Care Services" },
  { value: "beauty_wellness", label: "Beauty / Wellness / Salon" },
  { value: "fitness_sports", label: "Fitness / Sports / Gym" },
  // Education & Training
  { value: "training_provider", label: "Training Provider" },
  { value: "coaching_mentoring", label: "Coaching / Mentoring" },
  { value: "tutoring", label: "Tutoring" },
  // Manufacturing & Production
  { value: "manufacturing", label: "Manufacturing" },
  { value: "bespoke_fabrication", label: "Bespoke Fabrication" },
  { value: "food_production", label: "Food Production" },
  // Mixed / Other
  { value: "mixed_activities", label: "Mixed Activities" },
  { value: "other", label: "Other" },
];

const Settings = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, profile, signOut } = useAuth();
  const { data: onboarding } = useOnboardingSettings();

  const { theme, toggleTheme } = useTheme();
  const { data: directorRows } = useDirectorOnboarding();
  const [showBusinessDialog, setShowBusinessDialog] = useState(false);
  const [showTravelDialog, setShowTravelDialog] = useState(false);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [showSecurityDialog, setShowSecurityDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Profile dialog state
  const [displayName, setDisplayName] = useState("");

  // Security dialog state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

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
    } catch {
      /* ignore */
    }
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
    // Pre-fill with existing data from onboarding / profile / localStorage
    setBusinessName(onboarding?.business_name || profile?.business_name || "");
    setBusinessType(onboarding?.business_type || profile?.business_type || "");
    setVatNumber(onboarding?.vat_number || profile?.vat_number || "");
    setPhone(profile?.phone || "");
    setBusinessDescription(onboarding?.business_description || profile?.business_description || "");

    // Pull address from profile, falling back to onboarding registered_address in localStorage
    let addr = (profile?.address as string) || "";
    if (!addr) {
      try {
        const extra = localStorage.getItem("business_onboarding_extra");
        if (extra) {
          const parsed = JSON.parse(extra);
          addr = parsed?.businesses?.[0]?.registered_address || "";
        }
      } catch { /* ignore */ }
    }
    setAddress(addr);

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
      } catch {
        /* ignore */
      }

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
          await supabase.from("director_onboarding").update({ onboarding_data: updatedData }).eq("id", existing.id);
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

  const openProfileDialog = () => {
    setDisplayName(user?.user_metadata?.full_name || "");
    setShowProfileDialog(true);
  };

  const handleSaveProfile = async () => {
    if (!user?.id) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: displayName },
      });
      if (error) throw error;
      toast.success("Profile updated");
      setShowProfileDialog(false);
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const openSecurityDialog = () => {
    setNewPassword("");
    setConfirmPassword("");
    setShowSecurityDialog(true);
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Password updated successfully");
      setShowSecurityDialog(false);
    } catch (error) {
      console.error("Error changing password:", error);
      toast.error("Failed to change password");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const displayBusinessName = onboarding?.business_name || profile?.business_name || "Your Business";
  const displayBusinessType =
    businessTypes.find((bt) => bt.value === (onboarding?.business_type || profile?.business_type))?.label || "Not set";

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
        {
          icon: MapPin,
          label: "Trip & Travel",
          description: currentTravel.workshopAddress || currentTravel.placeOfWork || "Set your place of work",
          onClick: openTravelDialog,
        },
        {
          icon: FileText,
          label: "VAT Settings",
          description: onboarding?.vat_registered
            ? `VAT: ${onboarding?.vat_number || "Registered"}`
            : "Not VAT registered",
          onClick: () => navigate("/vat"),
        },
        {
          icon: Receipt,
          label: "RCT Settings",
          description: onboarding?.rct_registered ? "RCT enabled" : "Not using RCT",
          onClick: () => navigate("/rct"),
        },
      ],
    },
    {
      title: "Connections",
      items: [
        {
          icon: Link2,
          label: "Bank Connections",
          description: "Manage linked accounts",
          onClick: () => navigate("/bank"),
        },
      ],
    },
    {
      title: "Account",
      items: [
        { icon: User, label: "User Profile", description: user?.email || "Not signed in", onClick: openProfileDialog },
        { icon: Shield, label: "Security", description: "Change password", onClick: openSecurityDialog },
      ],
    },
    {
      title: "Appearance",
      items: [{ icon: Palette, label: "Dark Mode", description: theme === "dark" ? "On" : "Off", toggle: true }],
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
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
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
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* User Profile Dialog */}
      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>User Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="profileEmail">Email</Label>
              <Input id="profileEmail" value={user?.email || ""} disabled className="opacity-60" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayName">Full Name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your full name"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowProfileDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveProfile} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Security / Change Password Dialog */}
      <Dialog open={showSecurityDialog} onOpenChange={setShowSecurityDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowSecurityDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleChangePassword} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
              Update Password
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

      <main className="px-4 md:px-6 py-6 max-w-4xl mx-auto space-y-6">
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
                  onClick={"toggle" in item && item.toggle ? toggleTheme : item.onClick}
                  className={`w-full p-4 flex items-center gap-4 hover:bg-muted/50 transition-colors ${
                    index !== section.items.length - 1 ? "border-b border-border" : ""
                  }`}
                >
                  <div className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center">
                    {"toggle" in item && item.toggle ? (
                      theme === "dark" ? (
                        <Moon className="w-5 h-5" />
                      ) : (
                        <Sun className="w-5 h-5" />
                      )
                    ) : (
                      <item.icon className="w-5 h-5" />
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium">{item.label}</p>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                  {"toggle" in item && item.toggle ? (
                    <Switch
                      checked={theme === "dark"}
                      onCheckedChange={toggleTheme}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  )}
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
