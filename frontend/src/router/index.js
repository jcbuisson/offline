
import { createRouter, createWebHistory } from 'vue-router'

// Load every screen before offline navigation needs it.
import Home from '/src/views/Home.vue'
import ManageUsers from '/src/views/ManageUsers.vue'
import CreateUser from '/src/views/CreateUser.vue'
import EditUser from '/src/views/EditUser.vue'
import ManageGroups from '/src/views/ManageGroups.vue'
import CreateGroup from '/src/views/CreateGroup.vue'
import EditGroup from '/src/views/EditGroup.vue'
import Explanations from '/src/views/Explanations.vue'


const routes = [
   {
      path: '/',
      component: Home,
      redirect: '/users',
      children: [
         {
            path: 'users',
            props: true,
            component: ManageUsers,
            children: [
               {
                  path: 'create',
                  props: true,
                  component: CreateUser,
               },
               {
                  path: ':user_uid',
                  props: true,
                  component: EditUser,
               },
            ],      
         },
         {
            path: 'groups',
            props: true,
            component: ManageGroups,
            children: [
               {
                  path: 'create',
                  props: true,
                  component: CreateGroup,
               },
               {
                  path: ':group_uid',
                  props: true,
                  component: EditGroup,
               },
            ],      
         },
         {
            path: 'explanations',
            props: true,
            component: Explanations,
         },
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
