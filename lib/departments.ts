/**
 * Austin RTASS Department Configuration
 *
 * Public safety departments for radio traffic analysis.
 * RTASS focuses on Fire, Police, and EMS operations.
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
 * Austin RTASS Departments
 * Limited to public safety: Fire, Police, EMS
 */
export const AUSTIN_DEPARTMENTS: Department[] = [
  {
    id: 'fire',
    name: 'Austin Fire Department',
    nameEs: 'Departamento de Bomberos de Austin',
    abbreviation: 'AFD',
    color: 'bg-red-600',
    icon: '🚒',
  },
  {
    id: 'ems',
    name: 'Austin-Travis County EMS',
    nameEs: 'Servicios Médicos de Emergencia',
    abbreviation: 'ATCEMS',
    color: 'bg-blue-500',
    icon: '🚑',
  },
  {
    id: 'police',
    name: 'Austin Police Department',
    nameEs: 'Departamento de Policía de Austin',
    abbreviation: 'APD',
    color: 'bg-blue-800',
    icon: '👮',
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
