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
  coveredPorchPatioSqft?: number;
  lastSaleAmount?: number;
  lastSaleDate?: string;
  estimatedValue?: number;
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
