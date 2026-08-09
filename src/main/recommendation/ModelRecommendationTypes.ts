export type ModelCandidate = {
  id: string;
  name: string;
  size: string;
  language: string;
  engine: string;
};

export type SystemProfile = {
  cpuModel: string;
  logicalCores: number;
  totalMemoryGb: number;
  availableMemoryGb: number;
  gpuName: string | null;
  level: '入门' | '均衡' | '高性能';
};

export type RecommendedModel = {
  id: string;
  name: string;
  reason: string;
};

export type ModelRecommendationResult = {
  profile: SystemProfile;
  stt: RecommendedModel | null;
  llm: RecommendedModel | null;
  detectedAt: string;
};
