export default function useElectricModel(app: any, name: string) {
   return app.createElectricModel(name, {
      primaryKey: 'uid',
      streamOptions: {
         // The owner also serves visible tabs while its own tab is hidden.
         runtimeVisibility: {
            getCurrentState: () => 'visible',
            subscribe: () => () => {},
         },
      },
   })
}
