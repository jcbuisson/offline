import { createRouter, createWebHistory } from 'vue-router'

const routes = [
   {
      path: '/',
      redirect: '/stables',
   },
   {
      path: '/stables',
      component: () => import('/src/components/StableList.vue'),
      children: [
         {
            path: '/stables/:id',
            name: 'stable',
            component: () => import('/src/components/StableDetail.vue'),
            props: true,
         },
      ],
   },
]

const router = createRouter({
   history: createWebHistory('/'),
   routes
})

export default router
