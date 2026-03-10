import DataModelPage from '@/components/pages/DataModelPage.vue';

describe('Component tests for the DataModelPage page', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/specifications/frameworks/*/resolved-schema', {
      statusCode: 200,
      body: {
        general: {
          general: {
            fiscalYearEnd: 'extendedDateFiscalYearEnd',
          },
        },
      },
    }).as('getResolvedSchema');
  });

  it('should show the frontend and backend data model tabs', () => {
    cy.mountWithPlugins(DataModelPage, {});

    cy.contains('button', 'DATA MODEL').should('be.visible').and('have.class', 'active');
    cy.contains('button', 'DATA MODEL BACKEND').should('be.visible');
  });

  it('should display backend schema data when switching to backend tab', () => {
    cy.mountWithPlugins(DataModelPage, {});

    cy.contains('button', 'DATA MODEL BACKEND').click();
    cy.wait('@getResolvedSchema');

    cy.get('tbody').should('contain.text', 'fiscalYearEnd');
    cy.get('tbody').should('contain.text', 'extendedDateFiscalYearEnd');
  });
});
