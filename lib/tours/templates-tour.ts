import type { TourConfig } from './types';

export const templatesTour: TourConfig = {
  id: 'templates',
  name: 'Manage Templates',
  description: 'Learn how to create and customize analysis templates',
  steps: [
    {
      id: 'templates-nav',
      target: 'nav-templates',
      title: 'Go to Templates',
      content: 'Click here to view and manage your analysis templates.',
      placement: 'bottom',
      route: '/',
    },
    {
      id: 'templates-list',
      target: 'templates-grid',
      title: 'Browse Templates',
      content: 'View built-in templates for common meeting types, or find your custom templates.',
      placement: 'bottom',
      route: '/templates',
    },
    {
      id: 'templates-create',
      target: 'create-template-button',
      title: 'Create Custom Template',
      content: 'Click here to create a new template tailored to your specific meeting needs.',
      placement: 'bottom',
      route: '/templates',
    },
    {
      id: 'templates-sections',
      target: 'template-sections',
      title: 'Define Sections',
      content: 'Add sections to your template. Each section tells the AI what to extract from the transcript.',
      placement: 'right',
      route: '/templates/new',
    },
    {
      id: 'templates-save',
      target: 'save-template-button',
      title: 'Save Template',
      content: 'Save your template to use it for future analyses. You can edit or delete custom templates anytime.',
      placement: 'top',
      route: '/templates/new',
    },
  ],
};
