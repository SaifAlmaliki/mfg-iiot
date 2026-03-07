'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Building2,
  Factory,
  MapPin,
  Phone,
  Mail,
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
  Rocket,
  Building,
  Warehouse,
  FlaskConical,
  Settings,
} from 'lucide-react';
import { toast } from 'sonner';

interface SetupWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

const STEPS = [
  { id: 'welcome', title: 'Welcome', description: 'Get started with UNS Platform' },
  { id: 'enterprise', title: 'Enterprise', description: 'Company information' },
  { id: 'site', title: 'Site', description: 'Manufacturing site details' },
  { id: 'area', title: 'Area', description: 'Production area setup' },
  { id: 'workcenter', title: 'Work Center', description: 'Production line/equipment' },
  { id: 'complete', title: 'Complete', description: 'Finish setup' },
];

const SITE_TYPES = [
  { value: 'MANUFACTURING', label: 'Manufacturing', icon: Factory },
  { value: 'DISTRIBUTION', label: 'Distribution Center', icon: Warehouse },
  { value: 'R_D', label: 'R&D Facility', icon: FlaskConical },
  { value: 'MIXED_USE', label: 'Mixed Use', icon: Building },
];

const AREA_TYPES = [
  { value: 'PRODUCTION', label: 'Production' },
  { value: 'WAREHOUSE', label: 'Warehouse' },
  { value: 'QUALITY_LAB', label: 'Quality Lab' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'SHIPPING', label: 'Shipping' },
  { value: 'RECEIVING', label: 'Receiving' },
  { value: 'UTILITY', label: 'Utility' },
];

const WORK_CENTER_TYPES = [
  { value: 'PRODUCTION_LINE', label: 'Production Line' },
  { value: 'BATCH_PROCESS', label: 'Batch Process' },
  { value: 'CONTINUOUS_PROCESS', label: 'Continuous Process' },
  { value: 'ASSEMBLY_CELL', label: 'Assembly Cell' },
  { value: 'PACKAGING_LINE', label: 'Packaging Line' },
  { value: 'WORK_CELL', label: 'Work Cell' },
];

export function SetupWizard({ open, onOpenChange, onComplete }: SetupWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  
  // Enterprise form
  const [enterpriseForm, setEnterpriseForm] = useState({
    name: '',
    code: '',
    description: '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    phone: '',
    email: '',
    website: '',
    industry: '',
  });
  
  // Site form
  const [siteForm, setSiteForm] = useState({
    name: '',
    code: '',
    description: '',
    siteType: 'MANUFACTURING',
    address: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    phone: '',
    email: '',
    siteManager: '',
    timezone: 'UTC',
  });
  
  // Area form
  const [areaForm, setAreaForm] = useState({
    name: '',
    code: '',
    description: '',
    areaType: 'PRODUCTION',
    building: '',
    floor: '',
    zone: '',
    supervisor: '',
  });
  
  // Work Center form
  const [workCenterForm, setWorkCenterForm] = useState({
    name: '',
    code: '',
    description: '',
    type: 'PRODUCTION_LINE',
    capacity: '',
    capacityUnit: 'units/h',
    processType: 'Batch',
    status: 'PLANNED',
  });
  
  // Created IDs for linking
  const [createdIds, setCreatedIds] = useState({
    enterpriseId: '',
    siteId: '',
    areaId: '',
    workCenterId: '',
  });

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCreateEnterprise = async () => {
    if (!enterpriseForm.name) {
      toast.error('Enterprise name is required');
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch('/api/enterprise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...enterpriseForm,
          code: enterpriseForm.code || enterpriseForm.name.toUpperCase().replace(/\s+/g, '_'),
        }),
      });
      
      if (!response.ok) throw new Error('Failed to create enterprise');
      
      const enterprise = await response.json();
      setCreatedIds(prev => ({ ...prev, enterpriseId: enterprise.id }));
      toast.success('Enterprise created successfully');
      handleNext();
    } catch (_error) {
      toast.error('Failed to create enterprise');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSite = async () => {
    if (!siteForm.name) {
      toast.error('Site name is required');
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...siteForm,
          code: siteForm.code || siteForm.name.toUpperCase().replace(/\s+/g, '_'),
        }),
      });
      
      if (!response.ok) throw new Error('Failed to create site');
      
      const site = await response.json();
      setCreatedIds(prev => ({ ...prev, siteId: site.id }));
      toast.success('Site created successfully');
      handleNext();
    } catch (_error) {
      toast.error('Failed to create site');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateArea = async () => {
    if (!areaForm.name) {
      toast.error('Area name is required');
      return;
    }
    
    if (!createdIds.siteId) {
      toast.error('Please create a site first');
      handleBack();
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch('/api/areas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...areaForm,
          code: areaForm.code || areaForm.name.toUpperCase().replace(/\s+/g, '_'),
          siteId: createdIds.siteId,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to create area');
      
      const area = await response.json();
      setCreatedIds(prev => ({ ...prev, areaId: area.id }));
      toast.success('Area created successfully');
      handleNext();
    } catch (_error) {
      toast.error('Failed to create area');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkCenter = async () => {
    if (!workCenterForm.name) {
      toast.error('Work Center name is required');
      return;
    }
    
    if (!createdIds.areaId) {
      toast.error('Please create an area first');
      handleBack();
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch('/api/workcenters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...workCenterForm,
          code: workCenterForm.code || workCenterForm.name.toUpperCase().replace(/\s+/g, '_'),
          areaId: createdIds.areaId,
          capacity: workCenterForm.capacity ? parseFloat(workCenterForm.capacity) : null,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to create work center');
      
      const workCenter = await response.json();
      setCreatedIds(prev => ({ ...prev, workCenterId: workCenter.id }));
      toast.success('Work Center created successfully');
      handleNext();
    } catch (_error) {
      toast.error('Failed to create work center');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      // Mark setup as complete
      await fetch('/api/enterprise', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isSetup: true }),
      });
      
      toast.success('Setup completed successfully!');
      onComplete();
      onOpenChange(false);
    } catch (_error) {
      toast.error('Failed to complete setup');
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (STEPS[currentStep].id) {
      case 'welcome':
        return (
          <div className="text-center py-8 space-y-6">
            <div className="w-20 h-20 mx-auto bg-emerald-100 dark:bg-emerald-900 rounded-full flex items-center justify-center">
              <Rocket className="w-10 h-10 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Welcome to UNS Platform</h2>
              <p className="text-muted-foreground mt-2">
                This wizard will guide you through setting up your manufacturing hierarchy
                following ISA-95 standards.
              </p>
            </div>
            <div className="bg-muted p-4 rounded-lg text-left">
              <h3 className="font-semibold mb-2">Setup Steps:</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>1. Enterprise - Your company information</li>
                <li>2. Site - Manufacturing plant/facility</li>
                <li>3. Area - Production areas within the site</li>
                <li>4. Work Center - Production lines/equipment</li>
              </ul>
            </div>
          </div>
        );
        
      case 'enterprise':
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900 rounded-lg flex items-center justify-center">
                <Building2 className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <h3 className="font-semibold">Enterprise Information</h3>
                <p className="text-sm text-muted-foreground">Level 4 - Company details</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              <div className="space-y-2">
                <Label htmlFor="entName">Company Name *</Label>
                <Input
                  id="entName"
                  value={enterpriseForm.name}
                  onChange={(e) => setEnterpriseForm({ ...enterpriseForm, name: e.target.value })}
                  placeholder="Acme Chemicals Inc."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="entCode">Company Code</Label>
                <Input
                  id="entCode"
                  value={enterpriseForm.code}
                  onChange={(e) => setEnterpriseForm({ ...enterpriseForm, code: e.target.value.toUpperCase() })}
                  placeholder="ACME"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="entDescription">Description</Label>
              <Textarea
                id="entDescription"
                value={enterpriseForm.description}
                onChange={(e) => setEnterpriseForm({ ...enterpriseForm, description: e.target.value })}
                placeholder="Brief description of your company"
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              <div className="space-y-2">
                <Label htmlFor="entIndustry">Industry</Label>
                <Select
                  value={enterpriseForm.industry}
                  onValueChange={(value) => setEnterpriseForm({ ...enterpriseForm, industry: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Chemical">Chemical</SelectItem>
                    <SelectItem value="Pharmaceutical">Pharmaceutical</SelectItem>
                    <SelectItem value="Food & Beverage">Food & Beverage</SelectItem>
                    <SelectItem value="Automotive">Automotive</SelectItem>
                    <SelectItem value="Electronics">Electronics</SelectItem>
                    <SelectItem value="Oil & Gas">Oil & Gas</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="entWebsite">Website</Label>
                <Input
                  id="entWebsite"
                  value={enterpriseForm.website}
                  onChange={(e) => setEnterpriseForm({ ...enterpriseForm, website: e.target.value })}
                  placeholder="www.example.com"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={enterpriseForm.address}
                onChange={(e) => setEnterpriseForm({ ...enterpriseForm, address: e.target.value })}
                placeholder="Street address"
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  value={enterpriseForm.city}
                  onChange={(e) => setEnterpriseForm({ ...enterpriseForm, city: e.target.value })}
                  placeholder="City"
                />
              </div>
              <div className="space-y-2">
                <Label>State/Province</Label>
                <Input
                  value={enterpriseForm.state}
                  onChange={(e) => setEnterpriseForm({ ...enterpriseForm, state: e.target.value })}
                  placeholder="State"
                />
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <Input
                  value={enterpriseForm.country}
                  onChange={(e) => setEnterpriseForm({ ...enterpriseForm, country: e.target.value })}
                  placeholder="Country"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              <div className="space-y-2">
                <Label><Phone className="w-4 h-4 inline mr-1" />Phone</Label>
                <Input
                  value={enterpriseForm.phone}
                  onChange={(e) => setEnterpriseForm({ ...enterpriseForm, phone: e.target.value })}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
              <div className="space-y-2">
                <Label><Mail className="w-4 h-4 inline mr-1" />Email</Label>
                <Input
                  type="email"
                  value={enterpriseForm.email}
                  onChange={(e) => setEnterpriseForm({ ...enterpriseForm, email: e.target.value })}
                  placeholder="info@company.com"
                />
              </div>
            </div>
          </div>
        );
        
      case 'site':
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900 rounded-lg flex items-center justify-center">
                <Factory className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <h3 className="font-semibold">Site Information</h3>
                <p className="text-sm text-muted-foreground">Level 3 - Manufacturing site/plant</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              <div className="space-y-2">
                <Label htmlFor="siteName">Site Name *</Label>
                <Input
                  id="siteName"
                  value={siteForm.name}
                  onChange={(e) => setSiteForm({ ...siteForm, name: e.target.value })}
                  placeholder="Main Production Plant"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="siteCode">Site Code</Label>
                <Input
                  id="siteCode"
                  value={siteForm.code}
                  onChange={(e) => setSiteForm({ ...siteForm, code: e.target.value.toUpperCase() })}
                  placeholder="PLANT-01"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              <div className="space-y-2">
                <Label>Site Type</Label>
                <Select
                  value={siteForm.siteType}
                  onValueChange={(value) => setSiteForm({ ...siteForm, siteType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SITE_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        <type.icon className="w-4 h-4 inline mr-2" />
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Select
                  value={siteForm.timezone}
                  onValueChange={(value) => setSiteForm({ ...siteForm, timezone: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTC">UTC</SelectItem>
                    <SelectItem value="America/New_York">Eastern Time</SelectItem>
                    <SelectItem value="America/Chicago">Central Time</SelectItem>
                    <SelectItem value="America/Denver">Mountain Time</SelectItem>
                    <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                    <SelectItem value="Europe/London">London</SelectItem>
                    <SelectItem value="Europe/Paris">Paris</SelectItem>
                    <SelectItem value="Asia/Shanghai">Shanghai</SelectItem>
                    <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={siteForm.description}
                onChange={(e) => setSiteForm({ ...siteForm, description: e.target.value })}
                placeholder="Brief description of this site"
              />
            </div>
            
            <div className="space-y-2">
              <Label><MapPin className="w-4 h-4 inline mr-1" />Address</Label>
              <Input
                value={siteForm.address}
                onChange={(e) => setSiteForm({ ...siteForm, address: e.target.value })}
                placeholder="Street address"
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  value={siteForm.city}
                  onChange={(e) => setSiteForm({ ...siteForm, city: e.target.value })}
                  placeholder="City"
                />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input
                  value={siteForm.state}
                  onChange={(e) => setSiteForm({ ...siteForm, state: e.target.value })}
                  placeholder="State"
                />
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <Input
                  value={siteForm.country}
                  onChange={(e) => setSiteForm({ ...siteForm, country: e.target.value })}
                  placeholder="Country"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              <div className="space-y-2">
                <Label>Site Manager</Label>
                <Input
                  value={siteForm.siteManager}
                  onChange={(e) => setSiteForm({ ...siteForm, siteManager: e.target.value })}
                  placeholder="John Smith"
                />
              </div>
              <div className="space-y-2">
                <Label>Contact Email</Label>
                <Input
                  type="email"
                  value={siteForm.email}
                  onChange={(e) => setSiteForm({ ...siteForm, email: e.target.value })}
                  placeholder="site@company.com"
                />
              </div>
            </div>
          </div>
        );
        
      case 'area':
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900 rounded-lg flex items-center justify-center">
                <MapPin className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <h3 className="font-semibold">Area Information</h3>
                <p className="text-sm text-muted-foreground">Level 2 - Production area</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              <div className="space-y-2">
                <Label>Area Name *</Label>
                <Input
                  value={areaForm.name}
                  onChange={(e) => setAreaForm({ ...areaForm, name: e.target.value })}
                  placeholder="Production Area A"
                />
              </div>
              <div className="space-y-2">
                <Label>Area Code</Label>
                <Input
                  value={areaForm.code}
                  onChange={(e) => setAreaForm({ ...areaForm, code: e.target.value.toUpperCase() })}
                  placeholder="AREA-A"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              <div className="space-y-2">
                <Label>Area Type</Label>
                <Select
                  value={areaForm.areaType}
                  onValueChange={(value) => setAreaForm({ ...areaForm, areaType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AREA_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Supervisor</Label>
                <Input
                  value={areaForm.supervisor}
                  onChange={(e) => setAreaForm({ ...areaForm, supervisor: e.target.value })}
                  placeholder="Area supervisor name"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={areaForm.description}
                onChange={(e) => setAreaForm({ ...areaForm, description: e.target.value })}
                placeholder="Brief description of this area"
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
              <div className="space-y-2">
                <Label>Building</Label>
                <Input
                  value={areaForm.building}
                  onChange={(e) => setAreaForm({ ...areaForm, building: e.target.value })}
                  placeholder="Building 1"
                />
              </div>
              <div className="space-y-2">
                <Label>Floor</Label>
                <Input
                  value={areaForm.floor}
                  onChange={(e) => setAreaForm({ ...areaForm, floor: e.target.value })}
                  placeholder="Floor 1"
                />
              </div>
              <div className="space-y-2">
                <Label>Zone</Label>
                <Input
                  value={areaForm.zone}
                  onChange={(e) => setAreaForm({ ...areaForm, zone: e.target.value })}
                  placeholder="Zone A"
                />
              </div>
            </div>
          </div>
        );
        
      case 'workcenter':
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900 rounded-lg flex items-center justify-center">
                <Settings className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <h3 className="font-semibold">Work Center Information</h3>
                <p className="text-sm text-muted-foreground">Level 1 - Production line/equipment</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={workCenterForm.name}
                  onChange={(e) => setWorkCenterForm({ ...workCenterForm, name: e.target.value })}
                  placeholder="Reactor Line 1"
                />
              </div>
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  value={workCenterForm.code}
                  onChange={(e) => setWorkCenterForm({ ...workCenterForm, code: e.target.value.toUpperCase() })}
                  placeholder="RXT-001"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={workCenterForm.type}
                  onValueChange={(value) => setWorkCenterForm({ ...workCenterForm, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WORK_CENTER_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Process Type</Label>
                <Select
                  value={workCenterForm.processType}
                  onValueChange={(value) => setWorkCenterForm({ ...workCenterForm, processType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Batch">Batch</SelectItem>
                    <SelectItem value="Continuous">Continuous</SelectItem>
                    <SelectItem value="Discrete">Discrete</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              <div className="space-y-2">
                <Label>Capacity</Label>
                <Input
                  type="number"
                  value={workCenterForm.capacity}
                  onChange={(e) => setWorkCenterForm({ ...workCenterForm, capacity: e.target.value })}
                  placeholder="1000"
                />
              </div>
              <div className="space-y-2">
                <Label>Capacity Unit</Label>
                <Select
                  value={workCenterForm.capacityUnit}
                  onValueChange={(value) => setWorkCenterForm({ ...workCenterForm, capacityUnit: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="units/h">units/hour</SelectItem>
                    <SelectItem value="kg/h">kg/hour</SelectItem>
                    <SelectItem value="L/h">L/hour</SelectItem>
                    <SelectItem value="batches/day">batches/day</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={workCenterForm.description}
                onChange={(e) => setWorkCenterForm({ ...workCenterForm, description: e.target.value })}
                placeholder="Brief description of this work center"
              />
            </div>
          </div>
        );
        
      case 'complete':
        return (
          <div className="text-center py-8 space-y-6">
            <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
              <Check className="w-10 h-10 text-green-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Setup Complete!</h2>
              <p className="text-muted-foreground mt-2">
                Your manufacturing hierarchy has been set up successfully.
              </p>
            </div>
            <div className="bg-muted p-4 rounded-lg text-left space-y-2">
              <h3 className="font-semibold">Summary:</h3>
              <div className="text-sm space-y-1">
                <p>✓ Enterprise: {enterpriseForm.name}</p>
                <p>✓ Site: {siteForm.name}</p>
                <p>✓ Area: {areaForm.name}</p>
                <p>✓ Work Center: {workCenterForm.name}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              You can add more sites, areas, and work centers from the Administration panel.
            </p>
          </div>
        );
        
      default:
        return null;
    }
  };

  const getActionButton = () => {
    switch (STEPS[currentStep].id) {
      case 'welcome':
        return (
          <Button onClick={handleNext} className="ml-auto">
            Get Started
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        );
      case 'enterprise':
        return (
          <Button onClick={handleCreateEnterprise} disabled={loading} className="ml-auto">
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create Enterprise
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        );
      case 'site':
        return (
          <Button onClick={handleCreateSite} disabled={loading} className="ml-auto">
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create Site
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        );
      case 'area':
        return (
          <Button onClick={handleCreateArea} disabled={loading} className="ml-auto">
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create Area
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        );
      case 'workcenter':
        return (
          <Button onClick={handleCreateWorkCenter} disabled={loading} className="ml-auto">
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create Work Center
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        );
      case 'complete':
        return (
          <Button onClick={handleComplete} disabled={loading} className="ml-auto">
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Finish Setup
          </Button>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
        <DialogHeader>
          <DialogTitle>Setup Wizard</DialogTitle>
          <DialogDescription>
            Configure your ISA-95 manufacturing hierarchy
          </DialogDescription>
        </DialogHeader>
        
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Step {currentStep + 1} of {STEPS.length}</span>
            <span>{STEPS[currentStep].title}</span>
          </div>
          <Progress value={progress} />
          <div className="flex gap-2">
            {STEPS.map((step, index) => (
              <div
                key={step.id}
                className={`flex-1 h-2 rounded-full transition-colors ${
                  index <= currentStep ? 'bg-emerald-500' : 'bg-muted'
                }`}
              />
            ))}
          </div>
        </div>
        
        {/* Content */}
        <div className="py-4">
          {renderStepContent()}
        </div>
        
        {/* Actions */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          {getActionButton()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
