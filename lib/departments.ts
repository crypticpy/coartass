/**
 * City of Austin Departments Configuration
 *
 * Municipal departments for organizing transcripts
 * Based on actual City of Austin organizational structure
 */

export interface Department {
  id: string;
  name: string;
  nameEs: string;  // Spanish translation
  abbreviation: string;
  color: string;  // For UI badges/tags
  icon?: string;  // Optional emoji icon
}

/**
 * City of Austin Departments
 * Organized alphabetically for easy reference
 */
export const AUSTIN_DEPARTMENTS: Department[] = [
  {
    id: 'austin-code',
    name: 'Code Compliance',
    nameEs: 'Cumplimiento de Códigos',
    abbreviation: 'CODE',
    color: 'bg-orange-500',
    icon: '📋',
  },
  {
    id: 'austin-energy',
    name: 'Austin Energy',
    nameEs: 'Austin Energy',
    abbreviation: 'AE',
    color: 'bg-yellow-500',
    icon: '⚡',
  },
  {
    id: 'austin-public-health',
    name: 'Austin Public Health',
    nameEs: 'Salud Pública de Austin',
    abbreviation: 'APH',
    color: 'bg-green-500',
    icon: '🏥',
  },
  {
    id: 'austin-water',
    name: 'Austin Water',
    nameEs: 'Agua de Austin',
    abbreviation: 'AW',
    color: 'bg-blue-500',
    icon: '💧',
  },
  {
    id: 'aviation',
    name: 'Aviation Department',
    nameEs: 'Departamento de Aviación',
    abbreviation: 'AVIATION',
    color: 'bg-sky-500',
    icon: '✈️',
  },
  {
    id: 'building-services',
    name: 'Building Services',
    nameEs: 'Servicios de Edificios',
    abbreviation: 'BSD',
    color: 'bg-gray-500',
    icon: '🏗️',
  },
  {
    id: 'communication',
    name: 'Communication & Public Information',
    nameEs: 'Comunicación e Información Pública',
    abbreviation: 'CPI',
    color: 'bg-purple-500',
    icon: '📢',
  },
  {
    id: 'development-services',
    name: 'Development Services',
    nameEs: 'Servicios de Desarrollo',
    abbreviation: 'DSD',
    color: 'bg-indigo-500',
    icon: '🏘️',
  },
  {
    id: 'emergency-management',
    name: 'Emergency Management',
    nameEs: 'Gestión de Emergencias',
    abbreviation: 'HSEM',
    color: 'bg-red-500',
    icon: '🚨',
  },
  {
    id: 'financial-services',
    name: 'Financial Services',
    nameEs: 'Servicios Financieros',
    abbreviation: 'CTM',
    color: 'bg-emerald-500',
    icon: '💰',
  },
  {
    id: 'fire',
    name: 'Fire Department',
    nameEs: 'Departamento de Bomberos',
    abbreviation: 'AFD',
    color: 'bg-red-600',
    icon: '🚒',
  },
  {
    id: 'housing',
    name: 'Housing & Planning',
    nameEs: 'Vivienda y Planificación',
    abbreviation: 'HPD',
    color: 'bg-teal-500',
    icon: '🏠',
  },
  {
    id: 'human-resources',
    name: 'Human Resources',
    nameEs: 'Recursos Humanos',
    abbreviation: 'HR',
    color: 'bg-pink-500',
    icon: '👥',
  },
  {
    id: 'library',
    name: 'Austin Public Library',
    nameEs: 'Biblioteca Pública de Austin',
    abbreviation: 'APL',
    color: 'bg-amber-500',
    icon: '📚',
  },
  {
    id: 'parks-recreation',
    name: 'Parks & Recreation',
    nameEs: 'Parques y Recreación',
    abbreviation: 'PARD',
    color: 'bg-lime-500',
    icon: '🌳',
  },
  {
    id: 'police',
    name: 'Police Department',
    nameEs: 'Departamento de Policía',
    abbreviation: 'APD',
    color: 'bg-blue-600',
    icon: '👮',
  },
  {
    id: 'public-works',
    name: 'Public Works',
    nameEs: 'Obras Públicas',
    abbreviation: 'PWD',
    color: 'bg-stone-500',
    icon: '🛠️',
  },
  {
    id: 'resource-recovery',
    name: 'Austin Resource Recovery',
    nameEs: 'Recuperación de Recursos de Austin',
    abbreviation: 'ARR',
    color: 'bg-green-600',
    icon: '♻️',
  },
  {
    id: 'transportation',
    name: 'Transportation & Public Works',
    nameEs: 'Transporte y Obras Públicas',
    abbreviation: 'TPW',
    color: 'bg-slate-500',
    icon: '🚗',
  },
  {
    id: 'watershed',
    name: 'Watershed Protection',
    nameEs: 'Protección de Cuencas',
    abbreviation: 'WPD',
    color: 'bg-cyan-500',
    icon: '🌊',
  },
  {
    id: 'other',
    name: 'Other Department',
    nameEs: 'Otro Departamento',
    abbreviation: 'OTHER',
    color: 'bg-neutral-500',
    icon: '📁',
  },
];

/**
 * Get department by ID
 */
export function getDepartmentById(id: string): Department | undefined {
  return AUSTIN_DEPARTMENTS.find((dept) => dept.id === id);
}

/**
 * Get department name (locale-aware)
 */
export function getDepartmentName(id: string, locale: 'en' | 'es' = 'en'): string {
  const dept = getDepartmentById(id);
  if (!dept) return 'Unknown';
  return locale === 'es' ? dept.nameEs : dept.name;
}

/**
 * Get departments for dropdown (sorted alphabetically)
 */
export function getDepartmentsForSelect(locale: 'en' | 'es' = 'en') {
  return AUSTIN_DEPARTMENTS.map((dept) => ({
    value: dept.id,
    label: locale === 'es' ? dept.nameEs : dept.name,
    abbreviation: dept.abbreviation,
    color: dept.color,
    icon: dept.icon,
  })).sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Get department color class for UI badges
 */
export function getDepartmentColor(id: string): string {
  const dept = getDepartmentById(id);
  return dept?.color || 'bg-neutral-500';
}

/**
 * Get department icon
 */
export function getDepartmentIcon(id: string): string {
  const dept = getDepartmentById(id);
  return dept?.icon || '📁';
}

/**
 * Get localStorage key for stored department preference
 */
const DEPARTMENT_STORAGE_KEY = 'preferred-department';

/**
 * Get the user's preferred department from localStorage
 */
export function getStoredDepartment(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return localStorage.getItem(DEPARTMENT_STORAGE_KEY);
}

/**
 * Save the user's preferred department to localStorage
 */
export function setStoredDepartment(departmentId: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.setItem(DEPARTMENT_STORAGE_KEY, departmentId);
}

/**
 * Clear the stored department preference
 */
export function clearStoredDepartment(): void {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.removeItem(DEPARTMENT_STORAGE_KEY);
}
