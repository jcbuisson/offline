
import { createRouter, createWebHistory } from 'vue-router'


const routes = [
   {
      path: '/',
      component: () => import('/src/views/Home.vue'),
      children: [
         {
            path: 'users',
            props: true,
            component: () => import('/src/views/ManageUsers.vue'),
            children: [
               {
                  path: 'create',
                  props: true,
                  component: () => import('/src/views/CreateUser.vue'),
               },
               {
                  path: ':user_uid',
                  props: true,
                  component: () => import('/src/views/EditUser.vue'),
               },
            ],      
         },
         // {
         //    path: 'groups',
         //    props: true,
         //    component: () => import('/src/views/ManageGroups.vue'),
         // },
      ],
   },

   {
      path: "/:catchAll(.*)",
      redirect: '/',
   },
]

const router = createRouter({
   history: createWebHistory(),
   routes
})


router.beforeEach(async (to, from, next) => {
   console.log('from', from.path, 'to', to.path)
   next()
})

export default router
