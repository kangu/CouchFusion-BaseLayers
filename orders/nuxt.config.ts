export default defineNuxtConfig({
  extends: ['../database'],
  appConfig: {
    adminWorkspace: {
      sections: [
        {
          id: 'orders',
          title: 'Orders',
          requiresRoles: ['admin'],
          items: [
            {
              label: 'Products',
              route: '/admin/orders/products',
              icon: 'mdi:shopping-outline',
              requiresRoles: ['admin'],
            },
          ],
        },
      ],
    },
    uiNavigation: {
      sections: [
        {
          id: 'orders',
          title: 'Orders',
          requiresRoles: ['admin'],
          items: [
            {
              label: 'Products',
              route: '/admin/orders/products',
              icon: 'mdi:shopping-outline',
              requiresRoles: ['admin'],
            },
          ],
        },
      ],
    },
  },
})
