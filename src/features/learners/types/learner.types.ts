import type {
  LearnerStatus,
  BoardingType,
  LearnerEnrollmentStatus,
  GuardianRelationshipType,
  LearnerDocumentType,
} from '@/lib/database.types';

export type { LearnerStatus, BoardingType, LearnerEnrollmentStatus, GuardianRelationshipType, LearnerDocumentType };

export interface Learner {
  id: string;
  schoolId: string;
  profileId: string | null;
  learnerNumber: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  gender: string | null;
  dateOfBirth: string;
  idNumber: string | null;
  passportNumber: string | null;
  passportCountry: string | null;
  nationality: string | null;
  homeLanguage: string | null;
  additionalLanguages: string[] | null;
  photoUrl: string | null;
  transportMode: string | null;
  transportNotes: string | null;
  boardingType: BoardingType | null;
  status: LearnerStatus;
  statusReason: string | null;
  admissionDate: string;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LearnerEnrollment {
  id: string;
  schoolId: string;
  learnerId: string;
  academicYearId: string;
  gradeId: string;
  classId: string | null;
  house: string | null;
  stream: string | null;
  enrollmentDate: string;
  enrollmentStatus: LearnerEnrollmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface LearnerGuardian {
  id: string;
  schoolId: string;
  learnerId: string;
  guardianProfileId: string;
  relationshipType: GuardianRelationshipType;
  isPrimary: boolean;
  isEmergencyContact: boolean;
  isAuthorizedPickup: boolean;
  custodyNotes: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LearnerEmergencyContact {
  id: string;
  schoolId: string;
  learnerId: string;
  name: string;
  relationship: string | null;
  phone: string;
  alternatePhone: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LearnerMedicalInformation {
  id: string;
  schoolId: string;
  learnerId: string;
  allergies: string | null;
  medication: string | null;
  medicalConditions: string | null;
  doctorName: string | null;
  doctorPhone: string | null;
  medicalAidProvider: string | null;
  medicalAidNumber: string | null;
  emergencyMedicalNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LearnerDocument {
  id: string;
  schoolId: string;
  learnerId: string;
  documentType: LearnerDocumentType;
  fileUrl: string;
  fileName: string | null;
  uploadedAt: string;
  notes: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLearnerInput {
  learnerNumber: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  gender?: string | null;
  dateOfBirth: string;
  idNumber?: string | null;
  passportNumber?: string | null;
  passportCountry?: string | null;
  nationality?: string | null;
  homeLanguage?: string | null;
  additionalLanguages?: string[] | null;
  photoUrl?: string | null;
  transportMode?: string | null;
  transportNotes?: string | null;
  boardingType?: BoardingType | null;
  admissionDate: string;
}

export type UpdateLearnerInput = Partial<CreateLearnerInput>;

export interface CreateLearnerEnrollmentInput {
  academicYearId: string;
  gradeId: string;
  classId?: string | null;
  house?: string | null;
  stream?: string | null;
  enrollmentDate: string;
}

export type UpdateLearnerEnrollmentInput = Partial<Omit<CreateLearnerEnrollmentInput, 'academicYearId'>> & {
  enrollmentStatus?: LearnerEnrollmentStatus;
};

export interface CreateLearnerGuardianInput {
  guardianProfileId: string;
  relationshipType: GuardianRelationshipType;
  isPrimary?: boolean;
  isEmergencyContact?: boolean;
  isAuthorizedPickup?: boolean;
  custodyNotes?: string | null;
}

export type UpdateLearnerGuardianInput = Partial<CreateLearnerGuardianInput>;

export interface CreateLearnerEmergencyContactInput {
  name: string;
  relationship?: string | null;
  phone: string;
  alternatePhone?: string | null;
}

export type UpdateLearnerEmergencyContactInput = Partial<CreateLearnerEmergencyContactInput>;

export interface UpdateLearnerMedicalInformationInput {
  allergies?: string | null;
  medication?: string | null;
  medicalConditions?: string | null;
  doctorName?: string | null;
  doctorPhone?: string | null;
  medicalAidProvider?: string | null;
  medicalAidNumber?: string | null;
  emergencyMedicalNotes?: string | null;
}

export interface CreateLearnerDocumentInput {
  documentType: LearnerDocumentType;
  file: File;
  notes?: string | null;
}

export interface LearnersListFilters {
  search?: string;
  status?: LearnerStatus;
}

export interface LearnersListPage {
  learners: Learner[];
  totalCount: number;
  page: number;
  pageSize: number;
}
