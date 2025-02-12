export interface Risk {
  location: string;
  description: string;
  rewordedClause: string;
  legalAdvice: string;
}

export interface Contract {
  id: string;
  userId: string;
  title: string;
  fileUrl: string;
  fileName: string;
  fileType: string;
  status: 'pending' | 'analyzed' | 'error';
  error?: string;
  createdAt: Date;
  analysis?: {
    risks: Risk[];
    recommendations: string[];
    keyPoints: string[];
  };
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  createdAt: Date;
  contractsAnalyzed: number;
}