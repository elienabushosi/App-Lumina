export type TriggerSource = 'call' | 'apex_lead' | 'agency_zoom';

export interface ProposalInput {
  triggeredBy: TriggerSource;
  leadId: string;
  agentId: string;
  property: {
    address: string;
    city: string;
    state: string;
    zip: string;
  };
  contact: {
    firstName: string;
    lastName: string;
    phone?: string;
    email?: string;
  };
  rawPayload: Record<string, unknown>;
}

export type ProposalStatus =
  | 'queued'
  | 'researching'
  | 'research_complete'
  | 'apex_pending'
  | 'apex_running'
  | 'apex_needs_mfa'
  | 'apex_complete'
  | 'failed';

export interface Proposal {
  id: string;
  input: ProposalInput;
  status: ProposalStatus;
  createdAt: string;
  updatedAt: string;
  research?: ResearchReport;
  error?: string;
}

export interface CADData {
  propertyType: string;
  yearBuilt: number;
  livingAreaSqft: number;
  totalBuildingSqft: number;
  attachedGarageSqft: number;
  // Structure fields (feed directly into Alta + 360 forms)
  stories?: number;
  foundationType?: string;
  exteriorWallType?: string;
  garageType?: string;
  roofCover?: string;
  // Sale / value
  lastSaleAmount?: number;
  lastSaleDate?: string;
  // Location
  county?: string;
  apn?: string;
}

export interface GoogleMapsData {
  structureType: string;
  stories: number;
  exteriorMaterial: string;
  roofStyle: string;
  roofCovering: string;
  foundationType: string;
  solarPanelsVisible: boolean;
  poolVisible: boolean;
}

export interface RealtorData {
  // Legacy fields (kept for backwards compat — populated from best available source)
  flooringType: string;
  bathroomCount: number;
  kitchenFinishes: string;
  interiorCondition: string;

  // Raw RealtyAPI fields
  flooring: string[];
  foundationDetails: string[];
  exteriorFeatures: string[];
  constructionMaterials: string[];
  roofType: string | null;
  parkingFeatures: string[];
  hasFireplace: boolean | null;
  cooling: string[];
  heating: string[];

  // Valuation
  zestimate: number | null;
  rentZestimate: number | null;
  taxAssessedValue: number | null;
  taxAnnualAmount: number | null;
  propertyTaxRate: number | null;

  // Schools
  schools: Array<{
    name: string;
    rating: number | null;
    level: string;
    distance: number;
    grades: string;
  }>;

  // Meta
  streetViewUrl: string | null;
  hasInteriorPhotos: boolean;
  homeStatus: string | null;

  // Interior vision analysis — only populated for active listings with listing photos
  interiorAnalysis: {
    flooringType: string | null;
    flooringCondition: string | null;
    kitchenFinishes: string | null;
    interiorCondition: string | null;
    notableFeatures: string[];
  } | null;
}

export interface ResearchReport {
  proposalId: string;
  property: ProposalInput['property'] & { county?: string; apn?: string };
  cad: { data: CADData | null };
  googleMaps: { data: GoogleMapsData | null };
  realtor: { data: RealtorData | null };
}
