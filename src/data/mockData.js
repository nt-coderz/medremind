export const initialPatientProfile = {
  id: "USR-e87f3b14-9a2c-4d5e-88f1-209471ab5e82",
  name: "Alex Morgan",
  email: "alex.morgan@email.com",
  role: "patient",
  age: 38,
  gender: "Male",
  bloodType: "O+",
  allergies: ["Penicillin", "Sulfa drugs"],
  emergencyContact: {
    name: "Mary Morgan",
    relationship: "Spouse",
    phone: "+1 (555) 234-5678"
  },
  settings: {
    soundEnabled: true,
    doseReminders: true,
    quietHoursStart: "23:00",
    quietHoursEnd: "07:00"
  }
};

export const initialMedicines = [
  {
    id: "med-1",
    userId: "USR-e87f3b14-9a2c-4d5e-88f1-209471ab5e82",
    name: "Atorvastatin",
    dosage: "20 mg",
    form: "Tablet",
    frequency: "Once daily",
    timeSlots: ["Night (10:00 PM)"],
    times: ["22:00"],
    status: "Active",
    instructions: "Take at bedtime with a glass of water. Avoid consuming grapefruit.",
    prescribedBy: "Dr. Sarah Patel",
    startDate: "2026-10-01",
    duration: "Ongoing",
    refillsRemaining: 3,
    pillCount: 45,
    color: "#238B78"
  },
  {
    id: "med-2",
    userId: "USR-e87f3b14-9a2c-4d5e-88f1-209471ab5e82",
    name: "Metformin",
    dosage: "500 mg",
    form: "Tablet",
    frequency: "Twice daily",
    timeSlots: ["Morning (8:00 AM)", "Evening (7:00 PM)"],
    times: ["08:00", "19:00"],
    status: "Active",
    instructions: "Take with or immediately after meals to minimize gastrointestinal discomfort.",
    prescribedBy: "Dr. Sarah Patel",
    startDate: "2026-09-15",
    duration: "Ongoing",
    refillsRemaining: 2,
    pillCount: 60,
    color: "#3B82F6"
  },
  {
    id: "med-3",
    userId: "USR-e87f3b14-9a2c-4d5e-88f1-209471ab5e82",
    name: "Lisinopril",
    dosage: "10 mg",
    form: "Tablet",
    frequency: "Once daily",
    timeSlots: ["Morning (8:00 AM)"],
    times: ["08:00"],
    status: "Active",
    instructions: "Take in the morning. Check blood pressure periodically.",
    prescribedBy: "Dr. Robert Chen",
    startDate: "2026-10-10",
    duration: "Ongoing",
    refillsRemaining: 4,
    pillCount: 28,
    color: "#8B5CF6"
  },
  {
    id: "med-4",
    userId: "USR-e87f3b14-9a2c-4d5e-88f1-209471ab5e82",
    name: "Vitamin D3",
    dosage: "2000 IU",
    form: "Softgel",
    frequency: "Once daily",
    timeSlots: ["Afternoon (1:00 PM)"],
    times: ["13:00"],
    status: "Active",
    instructions: "Take with lunch or a healthy fat source for maximum absorption.",
    prescribedBy: "Dr. Sarah Patel",
    startDate: "2026-08-01",
    duration: "Ongoing",
    refillsRemaining: 0,
    pillCount: 82,
    color: "#F59E0B"
  }
];



export const samplePrescriptions = [
  {
    id: "rx-sample-1",
    doctor: "Dr. Emily Hayes, MD - Cardiology",
    clinic: "Oakwood Medical Center",
    date: "2026-11-10",
    extractedData: {
      medicineName: "Amoxicillin",
      dosage: "500 mg",
      form: "Capsule",
      frequency: "Three times daily",
      duration: "7 days",
      instructions: "Take with food every 8 hours. Complete full course even if feeling better.",
      timeSlots: ["Morning (8:00 AM)", "Afternoon (2:00 PM)", "Night (10:00 PM)"],
      times: ["08:00", "14:00", "22:00"],
      refills: 0,
      warnings: ["Allergy Warning: Contains Penicillin derivatives. Patient must verify allergy tolerance before taking."]
    }
  },
  {
    id: "rx-sample-2",
    doctor: "Dr. Sarah Patel, MD",
    clinic: "Metro Health Clinic",
    date: "2026-11-12",
    extractedData: {
      medicineName: "Omeprazole",
      dosage: "20 mg",
      form: "Delayed-Release Capsule",
      frequency: "Once daily",
      duration: "30 days",
      instructions: "Take 30 minutes before first meal of the day. Swallow whole.",
      timeSlots: ["Morning (7:30 AM)"],
      times: ["07:30"],
      refills: 2,
      warnings: []
    }
  }
];

// Registered Users Database (for Admin User Management)
export const initialRegisteredUsers = [
  {
    id: "USR-e87f3b14-9a2c-4d5e-88f1-209471ab5e82",
    name: "Alex Morgan",
    email: "alex.morgan@email.com",
    role: "patient",
    registeredAt: "2026-09-10",
    status: "Active",
    linkedCount: 2,
    activeMedsCount: 4
  },
  {
    id: "USR-3b91fa82-1204-4821-99ef-87a12b409d51",
    name: "Eleanor Vance",
    email: "eleanor.vance@email.com",
    role: "patient",
    registeredAt: "2026-10-02",
    status: "Active",
    linkedCount: 1,
    activeMedsCount: 3
  },
  {
    id: "USR-00000000-0000-4000-8000-000000000001",
    name: "System Administrator",
    email: "admin@medremind.internal",
    role: "admin",
    registeredAt: "2026-01-01",
    status: "Active",
    linkedCount: 0,
    activeMedsCount: 0
  }
];

// Mock System Activity Log (for Admin Audit Log)
export const initialSystemActivity = [
  {
    id: "ACT-001",
    type: "LOGIN",
    user: "Alex Morgan (Patient)",
    userId: "USR-e87f3b14-9a2c-4d5e-88f1-209471ab5e82",
    details: "Successful login via mobile client",
    timestamp: "Today, 08:05 AM"
  },
  {
    id: "ACT-002",
    type: "DOSE",
    user: "Alex Morgan (Patient)",
    userId: "USR-e87f3b14-9a2c-4d5e-88f1-209471ab5e82",
    details: "Confirmed Morning dose: Metformin 500mg taken",
    timestamp: "Today, 08:12 AM"
  },
  {
    id: "ACT-003",
    type: "PRESCRIPTION",
    user: "Alex Morgan (Patient)",
    userId: "USR-e87f3b14-9a2c-4d5e-88f1-209471ab5e82",
    details: "Completed OCR review and approved Amoxicillin 500mg",
    timestamp: "Today, 08:30 AM"
  },
  {
    id: "ACT-005",
    type: "REGISTRATION",
    user: "Eleanor Vance (Patient)",
    userId: "USR-3b91fa82-1204-4821-99ef-87a12b409d51",
    details: "New user account created via registration flow",
    timestamp: "Yesterday, 04:20 PM"
  }
];
