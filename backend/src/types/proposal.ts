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
  flooringType: string;
  bathroomCount: number;
  kitchenFinishes: string;
  interiorCondition: string;
}

export interface ResearchReport {
  proposalId: string;
  property: ProposalInput['property'] & { county?: string; apn?: string };
  cad: { data: CADData | null };
  googleMaps: { data: GoogleMapsData | null };
  realtor: { data: RealtorData | null };
}
