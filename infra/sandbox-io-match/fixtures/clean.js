const readline = require("readline");
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (name) => {
  console.log(`Hello, ${name}!`);
  rl.close();
});
