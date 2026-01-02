/**
 * Custom hook for fetching and managing templates from IndexedDB
 * Provides real-time updates when templates change
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { getAllTemplates, getTemplate, deleteTemplate as dbDeleteTemplate } from '@/lib/db';
import { useCallback } from 'react';

/**
 * Hook to fetch all templates with live updates
 * Automatically re-fetches when templates are added, updated, or deleted
 *
 * @returns Object containing templates array, loading state, error, and delete function
 */
export function useTemplates() {
  const templates = useLiveQuery(
    async () => {
      try {
        return await getAllTemplates();
      } catch (error) {
        console.error('Error fetching templates:', error);
        throw error;
      }
    },
    [],
    []
  );

  const deleteTemplate = useCallback(async (id: string) => {
    try {
      await dbDeleteTemplate(id);
    } catch (error) {
      console.error('Error deleting template:', error);
      throw error;
    }
  }, []);

  return {
    templates: templates || [],
    isLoading: templates === undefined,
    deleteTemplate,
  };
}

/**
 * Hook to fetch a single template by ID with live updates
 * Automatically re-fetches when the template is updated or deleted
 *
 * @param id - The template ID to fetch
 * @returns Object containing template, loading state, and error
 */
export function useTemplate(id: string) {
  const template = useLiveQuery(
    async () => {
      try {
        return await getTemplate(id);
      } catch (error) {
        console.error(`Error fetching template ${id}:`, error);
        throw error;
      }
    },
    [id],
    undefined
  );

  return {
    template: template,
    isLoading: template === undefined,
    error: template === null ? 'Template not found' : undefined,
  };
}

/**
 * Hook to get built-in templates only
 *
 * @returns Object containing built-in templates array and loading state
 */
export function useBuiltInTemplates() {
  const templates = useLiveQuery(
    async () => {
      try {
        const allTemplates = await getAllTemplates();
        return allTemplates.filter((template) => !template.isCustom);
      } catch (error) {
        console.error('Error fetching built-in templates:', error);
        throw error;
      }
    },
    [],
    []
  );

  return {
    templates: templates || [],
    isLoading: templates === undefined,
  };
}

/**
 * Hook to get custom templates only
 *
 * @returns Object containing custom templates array and loading state
 */
export function useCustomTemplates() {
  const templates = useLiveQuery(
    async () => {
      try {
        const allTemplates = await getAllTemplates();
        return allTemplates.filter((template) => template.isCustom);
      } catch (error) {
        console.error('Error fetching custom templates:', error);
        throw error;
      }
    },
    [],
    []
  );

  return {
    templates: templates || [],
    isLoading: templates === undefined,
  };
}

/**
 * Hook to get templates by category
 *
 * @param category - The category to filter by
 * @returns Object containing filtered templates array and loading state
 */
export function useTemplatesByCategory(category: string) {
  const templates = useLiveQuery(
    async () => {
      try {
        const allTemplates = await getAllTemplates();
        return allTemplates.filter((template) => template.category === category);
      } catch (error) {
        console.error('Error fetching templates by category:', error);
        throw error;
      }
    },
    [category],
    []
  );

  return {
    templates: templates || [],
    isLoading: templates === undefined,
  };
}

/**
 * Hook to search/filter templates
 *
 * @param searchTerm - Search term to filter templates
 * @returns Object containing filtered templates array and loading state
 */
export function useSearchTemplates(searchTerm: string) {
  const templates = useLiveQuery(
    async () => {
      try {
        const allTemplates = await getAllTemplates();

        if (!searchTerm.trim()) {
          return allTemplates;
        }

        const lowerSearch = searchTerm.toLowerCase();
        return allTemplates.filter((template) => {
          return (
            template.name.toLowerCase().includes(lowerSearch) ||
            template.description.toLowerCase().includes(lowerSearch) ||
            template.category.toLowerCase().includes(lowerSearch)
          );
        });
      } catch (error) {
        console.error('Error searching templates:', error);
        throw error;
      }
    },
    [searchTerm],
    []
  );

  return {
    templates: templates || [],
    isLoading: templates === undefined,
  };
}
