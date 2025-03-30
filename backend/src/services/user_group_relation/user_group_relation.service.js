
export default function (app) {

   app.createService('user_group_relation', app.get('prisma').user_group_relation)

}
