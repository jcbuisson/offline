
module.exports = {
   apps : [

      {
         name: "offline",
         script: "./src/app.js",
         watch: false,
         node_args: "--experimental-strip-types",
      },

   ]
}
