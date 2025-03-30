<template>
   <div style="display: flex; flex-direction: column; overflow: hidden; height: 100vh;">

      <NavigationBar></NavigationBar>

      <router-view></router-view>

   </div>
</template>

<script setup>
import NavigationBar from '/src/components/NavigationBar.vue'

import { app } from '/src/client-app.js'

import { synchronizeWhereList as synchronizeUserWhereList } from '/src/use/useUser'
import { synchronizeWhereList as synchronizeGroupWhereList } from '/src/use/useGroup'
import { synchronizeWhereList as synchronizeUserGroupRelationWhereList } from '/src/use/useUserGroupRelation'


// synchronize when connection starts or restarts
// (situated here because of import circularity issues)
app.addConnectListener(async () => {
   console.log(">>>>>>>>>>>>>>>> SYNC ALL")
   // order matters
   await synchronizeUserWhereList()
   await synchronizeGroupWhereList()
   await synchronizeUserGroupRelationWhereList()
})
</script>
